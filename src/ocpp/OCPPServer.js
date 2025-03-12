const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const { RPCServer } = require('ocpp-rpc');
const Charger = require('../models/Charger');
const ChargingTransaction = require('../models/ChargingTransaction');

class OCPPServer {
    constructor() {
        const port = process.env.WS_PORT || process.env.PORT || 3001;

        // Configurações do servidor HTTPS
        const options = {
            ciphers: [
                'ECDHE-RSA-AES128-GCM-SHA256',
                'ECDHE-RSA-AES256-GCM-SHA384',
                'ECDHE-RSA-AES128-SHA256',
                'ECDHE-RSA-AES256-SHA384',
                'AES128-GCM-SHA256',
                'AES256-GCM-SHA384',
                'AES128-SHA256',
                'AES256-SHA256'
            ].join(':'),
            honorCipherOrder: true,
            ALPNProtocols: ['http/1.1']
        };

        // Criando servidor HTTPS
        const server = https.createServer(options);

        // Criando servidor WebSocket no caminho "/ocpp"
        const wss = new WebSocket.Server({ server, path: "/ocpp" });

        // Configuração do servidor OCPP
        this.server = new RPCServer({
            protocols: ['ocpp1.6'],
            strictMode: true
        });

        // Tratamento de erros globais
        process.on('uncaughtException', (err) => {
            console.error('Erro não tratado:', err);
        });

        process.on('unhandledRejection', (err) => {
            console.error('Promessa rejeitada não tratada:', err);
        });

        // Gerenciamento de conexões WebSocket
        wss.on('connection', (ws, req) => {
            console.info(`🔌 Nova conexão WebSocket: ${req.url}`);
            ws.setTimeout(30000, () => { // 30 segundos
                console.warn(`⚠️ Conexão inativa encerrada: ${req.url}`);
                ws.terminate();
            });
            this.server.handleConnection(ws);
        });

        // Mapeamento de carregadores e transações
        this.chargers = new Map();
        global.ocppClients = new Map();
        global.activeTransactions = new Map();

        // Handlers OCPP
        this.server.on('client', async (client) => {
            console.info(`🔌 Carregador conectado: ${client.identity}`);
            this.chargers.set(client.identity, client);
            global.ocppClients.set(client.identity, client);

            client.handle('BootNotification', async ({ params }) => {
                console.info(`📡 BootNotification de ${client.identity}:`, JSON.stringify(params, null, 2));
                if (!params.chargePointVendor || !params.chargePointModel) {
                    console.error("❌ BootNotification inválido. Dados ausentes.");
                    return { status: "Rejected", currentTime: new Date().toISOString() };
                }
                try {
                    let charger = await Charger.findOne({ serialNumber: client.identity });
                    if (!charger) {
                        charger = new Charger({
                            serialNumber: client.identity,
                            vendor: params.chargePointVendor,
                            model: params.chargePointModel,
                            status: 'Available',
                            lastHeartbeat: new Date(),
                            isOnline: true
                        });
                    } else {
                        charger.lastHeartbeat = new Date();
                        charger.isOnline = true;
                    }
                    await charger.save();
                    console.info(`✅ Carregador atualizado/salvo: ${client.identity}`);
                    return { status: "Accepted", interval: 300, currentTime: new Date().toISOString() };
                } catch (error) {
                    console.error(`❌ Erro ao salvar carregador ${client.identity}:`, error);
                    return { status: "Rejected", currentTime: new Date().toISOString() };
                }
            });

            client.handle('StartTransaction', async ({ params }) => {
                console.info(`🚀 StartTransaction de ${client.identity}:`, JSON.stringify(params, null, 2));
                let transactionId = params.transactionId || Math.floor(Math.random() * 100000);
                try {
                    const newTransaction = new ChargingTransaction({
                        chargerId: client.identity,
                        transactionId,
                        startTime: new Date()
                    });
                    await newTransaction.save();
                    global.activeTransactions.set(client.identity, transactionId);
                    console.info(`✅ Transação iniciada e salva no banco: ${transactionId}`);
                    return { transactionId, idTagInfo: { status: "Accepted" } };
                } catch (error) {
                    console.error(`❌ Erro ao iniciar transação:`, error);
                    return { idTagInfo: { status: "Rejected" } };
                }
            });

            client.handle('StopTransaction', async ({ params }) => {
                console.info(`🛑 StopTransaction de ${client.identity}:`, JSON.stringify(params, null, 2));
                const transactionId = global.activeTransactions.get(client.identity);
                if (!transactionId) {
                    console.warn(`⚠️ Nenhuma transação ativa para ${client.identity}. Ignorando StopTransaction.`);
                    return { idTagInfo: { status: "Rejected" } };
                }
                try {
                    const transaction = await ChargingTransaction.findOne({ transactionId });
                    if (transaction) {
                        transaction.endTime = new Date();
                        await transaction.save();
                        console.info(`✅ Transação finalizada: ${transactionId}`);
                    } else {
                        console.warn(`⚠️ Transação ${transactionId} não encontrada no banco.`);
                    }
                    global.activeTransactions.delete(client.identity);
                } catch (error) {
                    console.error(`❌ Erro ao finalizar transação:`, error);
                }
                return { idTagInfo: { status: "Accepted" } };
            });

            client.handle('MeterValues', async ({ params }) => {
                console.info(`⚡ MeterValues recebido de ${client.identity}:`, JSON.stringify(params, null, 2));
                const transactionId = global.activeTransactions.get(client.identity);
                if (!transactionId) {
                    console.warn(`⚠️ Nenhuma transação ativa para ${client.identity}. Ignorando MeterValues.`);
                    return {};
                }
                try {
                    const transaction = await ChargingTransaction.findOne({ transactionId });
                    if (transaction) {
                        const meterValue = {
                            timestamp: params.meterValue[0]?.timestamp || new Date(),
                            values: params.meterValue[0]?.sampledValue.map(value => ({
                                value: value.value,
                                unit: value.unit,
                                context: value.context,
                                measurand: value.measurand
                            }))
                        };
                        transaction.meterValues.push(meterValue);
                        await transaction.save();
                        console.info(`📥 MeterValue salvo para transactionId: ${transactionId}`);
                    } else {
                        console.warn(`⚠️ Transação ${transactionId} não encontrada no banco.`);
                    }
                } catch (error) {
                    console.error(`❌ Erro ao salvar MeterValues:`, error);
                }
                return {};
            });

            client.on('close', async () => {
                console.info(`🔌 Conexão encerrada: ${client.identity}`);
                try {
                    let charger = await Charger.findOne({ serialNumber: client.identity });
                    if (charger) {
                        charger.isOnline = false;
                        await charger.save();
                    }
                } catch (error) {
                    console.error(`❌ Erro ao atualizar desconexão de ${client.identity}:`, error);
                }
                this.chargers.delete(client.identity);
            });
        });

        // Iniciar o servidor HTTPS + WebSocket
        server.listen(port, () => {
            console.log(`🚀 Servidor OCPP rodando em wss://e2n.online:${port}/ocpp`);
        });
    }
}

module.exports = OCPPServer;
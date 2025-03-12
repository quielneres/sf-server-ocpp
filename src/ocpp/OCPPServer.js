const fs = require('fs');
const https = require('https');
const { RPCServer } = require('ocpp-rpc');
const Charger = require('../models/Charger');
const ChargingTransaction = require('../models/ChargingTransaction');

class OCPPServer {
    constructor() {
        const port = process.env.WS_PORT || process.env.PORT || 443; // Porta padrão HTTPS

        // 🔹 Carregar os certificados SSL/TLS
        const options = {
            cert: fs.readFileSync(__dirname + '/certs/fullchain.pem'),
            key: fs.readFileSync(__dirname + '/certs/privkey.pem'),
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

        // 🔹 Criar servidor HTTPS
        const server = https.createServer(options);

        // 🔹 Criar WebSocket Server OCPP sobre HTTPS
        this.server = new RPCServer({
            server,
            path: '/ocpp', // Define o caminho para os carregadores se conectarem
            protocols: ['ocpp1.6'],
            strictMode: true
        });

        this.chargers = new Map();
        global.ocppClients = new Map();
        global.activeTransactions = new Map();

        this.server.on('client', async (client) => {
            console.info(`🔌 Carregador conectado: ${client.identity}`);
            this.chargers.set(client.identity, client);
            global.ocppClients.set(client.identity, client);

            // 🔹 BootNotification: Quando o carregador se conecta
            client.handle('BootNotification', async ({ params }) => {
                console.info(`📡 BootNotification de ${client.identity}:`, params);

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

            // 🔹 StatusNotification: Atualiza status do carregador
            client.handle('StatusNotification', async ({ params }) => {
                console.info(`🔔 StatusNotification de ${client.identity}:`, params);

                try {
                    const charger = await Charger.findOne({ serialNumber: client.identity });
                    if (charger) {
                        charger.status = params.status;
                        charger.lastHeartbeat = new Date();
                        await charger.save();
                    }
                } catch (error) {
                    console.error(`❌ Erro ao atualizar status de ${client.identity}:`, error);
                }

                return {};
            });

            // 🔹 StartTransaction: Inicia uma transação de carregamento
            client.handle('StartTransaction', async ({ params }) => {
                console.info(`🚀 StartTransaction de ${client.identity}:`, params);

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

            // 🔹 StopTransaction: Finaliza uma transação de carregamento
            client.handle('StopTransaction', async ({ params }) => {
                console.info(`🛑 StopTransaction de ${client.identity}:`, params);

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

            // 🔹 Heartbeat: Atualiza o status do carregador
            client.handle('Heartbeat', async () => {
                console.info(`💓 Heartbeat recebido de ${client.identity}`);

                try {
                    let charger = await Charger.findOne({ serialNumber: client.identity });
                    if (charger) {
                        charger.lastHeartbeat = new Date();
                        charger.isOnline = true;
                        await charger.save();
                    }
                } catch (error) {
                    console.error(`❌ Erro ao atualizar heartbeat de ${client.identity}:`, error);
                }

                return { currentTime: new Date().toISOString() };
            });

            // 🔹 MeterValues: Atualiza os valores de medição do carregamento
            client.handle('MeterValues', async ({ params }) => {
                console.info(`⚡ MeterValues recebido de ${client.identity}:`, params);

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

            // 🔹 Evento de desconexão do carregador
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

        // 🔹 Inicia o servidor HTTPS
        server.listen(port, () => {
            console.log(`🚀 Servidor OCPP rodando em wss://e2n.online:${port}/ocpp`);
        });
    }
}

module.exports = OCPPServer;

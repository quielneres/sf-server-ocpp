const https = require('https');
const { RPCServer } = require('ocpp-rpc');
const { readFile } = require('fs/promises');
const Charger = require('../models/Charger');
const ChargingTransaction = require('../models/ChargingTransaction');

class OCPPServer {
    constructor() {
        this.chargers = new Map();
        global.ocppClients = new Map();
        global.activeTransactions = new Map();
    }

    async start() {
        const port = process.env.WS_PORT || process.env.PORT || 3001;

        try {
            // Carregue os certificados e chaves ANTES de criar o servidor HTTPS
            const [rsaCert, rsaKey, ecCert, ecKey] = await Promise.all([
                readFile('./certs/server.crt', 'utf8'), // Certificado RSA
                readFile('./certs/server.key', 'utf8'), // Chave privada RSA
                readFile('./certs/ec_server.crt', 'utf8'), // Certificado ECDSA
                readFile('./certs/ec_server.key', 'utf8'), // Chave privada ECDSA
            ]);

            // Configurações do servidor HTTPS
            const httpsServer = https.createServer({
                cert: [rsaCert, ecCert], // Certificados RSA e ECDSA
                key: [rsaKey, ecKey],    // Chaves privadas RSA e ECDSA
                minVersion: 'TLSv1.2',   // Força o uso do TLS 1.2
                maxVersion: 'TLSv1.2',   // Força o uso do TLS 1.2
                ciphers: 'TLS_RSA_WITH_AES_128_CBC_SHA:TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256', // Cifras suportadas
            });

            // Cria o servidor OCPP
            const server = new RPCServer({
                protocols: ['ocpp1.6'],
                strictMode: true
            });

            // Integra o servidor HTTPS com o ocpp-rpc
            httpsServer.on('upgrade', server.handleUpgrade);

            // Inicia o servidor HTTPS na porta configurada
            httpsServer.listen(port, () => {
                console.log(`🚀 Servidor OCPP rodando em wss://e2n.online:${port}/ocpp`);
            });

            // Handlers OCPP
            server.on('client', async (client) => {
                console.info(`🔌 Carregador conectado: ${client.identity}`);
                this.chargers.set(client.identity, client);
                global.ocppClients.set(client.identity, client);

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
        } catch (error) {
            console.error('❌ Erro ao iniciar o servidor OCPP:', error);
        }
    }
}

// (async () => {
//     const ocppServer = new OCPPServer();
//     await ocppServer.start();
// })();

module.exports = OCPPServer;
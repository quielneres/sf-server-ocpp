const fs = require('fs');
const https = require('https');
const { RPCServer } = require('ocpp-rpc');
const Charger = require('../models/Charger');
const ChargingTransaction = require('../models/ChargingTransaction');

class OCPPServer {
    constructor() {
        const port = process.env.WS_PORT || process.env.PORT || 443;
        const certPath = './certs/fullchain.pem';
        const keyPath = './certs/privkey.pem';

        if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
            console.error("❌ Certificados SSL não encontrados! Verifique os caminhos.");
            process.exit(1);
        }

        const httpsServer = https.createServer({
            // cert: fs.readFileSync(certPath),
            // key: fs.readFileSync(keyPath),
            // minVersion: 'TLSv1.2'
        });

        this.server = new RPCServer({ protocols: ['ocpp1.6'], strictMode: true });
        this.chargers = new Map();
        global.ocppClients = new Map();
        global.activeTransactions = new Map();

        this.server.on('client', async (client) => {
            console.info(`🔌 Carregador conectado: ${client.identity}`);
            this.chargers.set(client.identity, client);
            global.ocppClients.set(client.identity, client);

            client.handle('BootNotification', async ({ params }) => {
                console.info(`📡 BootNotification de ${client.identity}:`, params);
                if (!params.chargePointVendor || !params.chargePointModel) {
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
                    return { status: "Accepted", interval: 300, currentTime: new Date().toISOString() };
                } catch (error) {
                    console.error(`❌ Erro ao salvar carregador ${client.identity}:`, error);
                    return { status: "Rejected", currentTime: new Date().toISOString() };
                }
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
                    return { idTagInfo: { status: "Rejected" } };
                }

                try {
                    const transaction = await ChargingTransaction.findOne({ transactionId });
                    if (transaction) {
                        transaction.endTime = new Date();
                        await transaction.save();
                    }
                    global.activeTransactions.delete(client.identity);
                } catch (error) {
                    console.error(`❌ Erro ao finalizar transação:`, error);
                }

                return { idTagInfo: { status: "Accepted" } };
            });

            client.handle('MeterValues', async ({ params }) => {
                console.info(`⚡ MeterValues recebido de ${client.identity}:`, params);
                const transactionId = global.activeTransactions.get(client.identity);
                if (!transactionId) return {};

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

        httpsServer.on('upgrade', this.server.handleUpgrade);
        httpsServer.listen(port, () => {
            console.log(`🚀 Servidor OCPP rodando em wss://e2n.online/ocpp`);
        });
    }
}

module.exports = OCPPServer;

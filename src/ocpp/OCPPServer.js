const { RPCServer } = require('ocpp-rpc');
const Charger = require('../models/Charger');
const { handleMeterValues } = require("./handlers");
const ChargingTransaction = require('../models/ChargingTransaction');
const Wallet = require('../models/Wallet');
const { addLog } = require("../routes/logs");

class OCPPServer {
    constructor() {
        const port = 3000;

        this.server = new RPCServer({
            protocols: ['ocpp1.6'],
            strictMode: true,
        });

        this.chargers = new Map();
        global.ocppClients = new Map();
        global.activeTransactions = new Map();

        this.server.on('client', async (client) => {
            console.info(`🔌 Carregador conectado: ${client.identity}`);
            this.chargers.set(client.identity, client);
            global.ocppClients.set(client.identity, client);

            let charger = await Charger.findOne({ serialNumber: client.identity });

            if (charger) {
                charger.isOnline = true;
                charger.lastHeartbeat = new Date();
                // Marca todos conectores como Available ao conectar
                if (Array.isArray(charger.connectors)) {
                    charger.connectors = charger.connectors.map(connector => ({
                        ...connector,
                        status: 'Available'
                    }));
                }
                charger.status = 'Available';
                await charger.save();
            }

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
                            isOnline: true,
                            status: 'Available',
                            lastHeartbeat: new Date(),
                            connectors: []
                        });
                    } else {
                        charger.vendor = params.chargePointVendor;
                        charger.model = params.chargePointModel;
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
                    if (charger && Array.isArray(charger.connectors)) {
                        const index = charger.connectors.findIndex(c => c.connectorId === params.connectorId);
                        if (index !== -1) {
                            charger.connectors[index].status = params.status;
                        } else {
                            charger.connectors.push({
                                connectorId: params.connectorId,
                                status: params.status,
                                type: 'Desconhecido',
                                powerKw: 0
                            });
                        }
                        charger.lastHeartbeat = new Date();
                        charger.status = params.status;
                        await charger.save();
                    }
                } catch (error) {
                    console.error(`❌ Erro ao atualizar status de ${client.identity}:`, error);
                }

                return {};
            });

            client.handle('StartTransaction', async ({ params }) => {
                console.info(`🚀 StartTransaction de ${client.identity}:`, params);
                try {
                    const transaction = await findTransactionWithRetry(params.idTag);

                    if (!transaction) {
                        console.warn(`⚠️ Nenhuma transação ativa para ${client.identity}. Ignorando StartTransaction.`);
                        return { idTagInfo: { status: "Rejected" } };
                    }

                    transaction.meterStart = typeof params.meterStart === 'number' ? params.meterStart : 0;
                    transaction.startTime = new Date();
                    transaction.status = 'Active';
                    transaction.connectorId = params.connectorId;
                    await transaction.save();

                    global.pendingTransactions?.delete(params.idTag);

                    const transactionId = transaction.transactionId;
                    global.activeTransactions.set(`${client.identity}_${params.connectorId}`, transactionId);
                    console.info(`✅ Transação iniciada e salva no banco: ${transactionId}`);

                    return {
                        transactionId,
                        idTagInfo: { status: "Accepted" }
                    };
                } catch (error) {
                    console.error(`❌ Erro ao iniciar transação:`, error);
                    return { idTagInfo: { status: "Rejected" } };
                }
            });

            async function findTransactionWithRetry(idTag, maxAttempts = 5, delay = 100) {
                for (let i = 0; i < maxAttempts; i++) {
                    const cached = global.pendingTransactions?.get(idTag);
                    if (cached) return cached;

                    const fromDb = await ChargingTransaction.findOne({ idTag });
                    if (fromDb) return fromDb;

                    await new Promise(res => setTimeout(res, delay));
                }
                return null;
            }


            client.handle('StopTransaction', async ({ params }) => {
                console.info(`🛑 StopTransaction de ${client.identity}:`, params);

                const transactionId = params.transactionId;
                if (!transactionId) {
                    console.warn(`⚠️ Nenhuma transação ativa para ${client.identity}. Ignorando StopTransaction.`);
                    return { idTagInfo: { status: "Rejected" } };
                }

                try {
                    const transaction = await ChargingTransaction.findOne({ transactionId });
                    if (!transaction) {
                        console.warn(`⚠️ Transação ${transactionId} não encontrada no banco.`);
                        return { idTagInfo: { status: "Rejected" } };
                    }

                    transaction.endTime = new Date();
                    transaction.status = 'Completed';

                    if (typeof params.meterStop === 'number') {
                        transaction.meterStop = params.meterStop || 0;
                    }

                    if (transaction.meterStart != null && transaction.meterStop != null) {
                        transaction.consumedKwh = (transaction.meterStop - transaction.meterStart) / 1000;
                        console.log(`🔋 Consumo total: ${transaction.consumedKwh.toFixed(3)} kWh`);
                    }

                    await transaction.save();

                    if (transaction.consumedKwh > 0) {
                        const charger = await Charger.findOne({ serialNumber: client.identity }).lean();
                        const pricePerKwh = charger?.pricePerKw ?? 2;
                        const amountToDeduct = parseFloat((transaction.consumedKwh * pricePerKwh).toFixed(2));

                        const wallet = await Wallet.findOne({ userId: transaction.userId });

                        if (wallet) {
                            wallet.balance = parseFloat((wallet.balance - amountToDeduct).toFixed(2));
                            await wallet.save();
                            console.log(`💰 R$${amountToDeduct} debitado da carteira do ID Tag ${transaction.idTag}`);
                        }
                    }

                    global.activeTransactions.delete(`${client.identity}_${transaction.connectorId}`);

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
                const key = `${client.identity}_${params.connectorId}`;
                const transactionId = global.activeTransactions.get(key);
                if (!transactionId) {
                    console.warn(`⚠️ Nenhuma transação ativa para ${key}. Ignorando MeterValues.`);
                    return {};
                }

                try {
                    const transaction = await ChargingTransaction.findOne({ transactionId });
                    if (!transaction) return {};

                    const meterEntries = params.meterValue || [];
                    let lastValidEntry = null;
                    let energySample = null;

                    for (const entry of meterEntries) {
                        const samples = entry.sampledValue || [];
                        const candidate = samples.find(v => v.measurand === 'Energy.Active.Import.Register' && ['Wh', 'kWh'].includes(v.unit));
                        if (candidate && !isNaN(parseFloat(candidate.value))) {
                            energySample = candidate;
                            lastValidEntry = entry;
                        }
                    }

                    if (!energySample || !lastValidEntry) return {};

                    let currentMeterKwh = parseFloat(energySample.value);
                    if (energySample.unit === 'Wh') {
                        currentMeterKwh = currentMeterKwh / 1000;
                    }

                    transaction.lastMeterValue = currentMeterKwh;
                    const consumedKwh = currentMeterKwh - (transaction.meterStart / 1000);
                    transaction.consumedKwh = consumedKwh;
                    await transaction.save();

                    if (transaction.targetKwh && consumedKwh >= transaction.targetKwh) {
                        await client.call('RemoteStopTransaction', { transactionId });
                    }

                    addLog({
                        chargerId: client.identity,
                        transactionId,
                        timestamp: lastValidEntry.timestamp || new Date().toISOString(),
                        energyKwh: currentMeterKwh,
                        consumedKwh,
                        sampledValues: lastValidEntry.sampledValue || []
                    });

                } catch (error) {
                    console.error(`❌ Erro no processamento de MeterValues:`, error);
                }

                return {};
            });

            client.on('close', async () => {
                console.info(`🔌 Conexão encerrada: ${client.identity}`);
                try {
                    const charger = await Charger.findOne({ serialNumber: client.identity });
                    if (charger) {
                        charger.isOnline = false;
                        await charger.save();
                    }
                } catch (error) {
                    console.error(`❌ Erro ao atualizar desconexão:`, error);
                }
                this.chargers.delete(client.identity);
            });
        });

        this.server.listen(port, '0.0.0.0', { path: '/ocpp' }, () => {
            console.log(`🚀 Servidor OCPP rodando em wss://e2n.online:${port}/ocpp`);
        });
    }
}

module.exports = OCPPServer;
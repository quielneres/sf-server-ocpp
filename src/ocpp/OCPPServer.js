const { RPCServer } = require('ocpp-rpc');
const Charger = require('../models/Charger');
const { handleMeterValues } = require("./handlers");
const amqp = require('amqplib');
const ChargingTransaction = require('../models/ChargingTransaction');
const Wallet = require('../models/Wallet');
const { addLog } = require("../routes/logs");

class OCPPServer {
    constructor() {
        //const port = process.env.PORT || 3000;
        const port = 3000;

        // const port = process.env.PORT || process.env.OCPP_PORT || 3000;

        this.server = new RPCServer({
            protocols: ['ocpp1.6'],
            strictMode: true,
        });

        // this.initRabbitMQ();

        this.chargers = new Map();
        global.ocppClients = new Map();
        global.activeTransactions = new Map();

        this.server.on('client', async (client) => {
            console.info(`🔌 Carregador conectado: ${client.identity}`);
            this.chargers.set(client.identity, client);
            global.ocppClients.set(client.identity, client);

            let charger = await Charger.findOne({ serialNumber: client.identity });

            if (charger) {
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
                try {

                    const transaction = await ChargingTransaction.findOne({ idTag: params.idTag });
                    if (!transaction) {
                        console.warn(`⚠️ Nenhuma transação ativa para ${client.identity}. Ignorando StartTransaction.`);
                        return { idTagInfo: { status: "Rejected" } };
                    }

                    transaction.meterStart = typeof params.meterStart === 'number' ? params.meterStart : 0;
                    transaction.startTime = new Date();
                    transaction.status = 'Active';

                    await transaction.save();

                    let transactionId = transaction.transactionId;

                    global.activeTransactions.set(client.identity, transactionId);
                    console.info(`✅ Transação iniciada e salva no banco: ${transactionId}`);

                    return {transactionId, idTagInfo: { status: "Accepted" } };
                } catch (error) {
                    console.error(`❌ Erro ao iniciar transação:`, error);
                    return { idTagInfo: { status: "Rejected" } };
                }
            });

            client.handle('StopTransaction', async ({ params }) => {
                console.info(`🛑 StopTransaction de ${client.identity}:`, params);

                // const transactionId = global.activeTransactions.get(client.identity);
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

                    // Atualiza status e horário de término
                    transaction.endTime = new Date();
                    transaction.status = 'Completed';

                    // Registra o meterStop diretamente da requisição
                    if (typeof params.meterStop === 'number') {
                        transaction.meterStop = params.meterStop || 0;
                    }

                    // Calcula consumo
                    if (transaction.meterStart != null && transaction.meterStop != null) {
                        transaction.consumedKwh = (transaction.meterStop - transaction.meterStart) / 1000;
                        console.log(`🔋 Consumo total: ${transaction.consumedKwh.toFixed(3)} kWh`);
                    } else {
                        console.warn(`⚠️ Não foi possível calcular consumo — meterStart ou meterStop ausente.`);
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
                        } else {
                            console.warn(`⚠️ Carteira não encontrada para ID Tag ${transaction.idTag}`);
                        }
                    }

                    // Remove transação ativa da memória
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
                console.info(`⚡ MeterValues recebido de ${client.identity}:`, params.meterValue?.[0]?.sampledValue);

                const transactionId = global.activeTransactions.get(client.identity);
                if (!transactionId) {
                    console.warn(`⚠️ Nenhuma transação ativa para ${client.identity}. Ignorando MeterValues.`);
                    return {};
                }

                try {
                    const transaction = await ChargingTransaction.findOne({ transactionId });
                    if (!transaction) {
                        console.warn(`⚠️ Transação ${transactionId} não encontrada no banco de dados`);
                        return {};
                    }

                    const meterEntries = params.meterValue || params.meterValues || [];
                    let lastValidEntry = null;
                    let energySample = null;

                    for (const entry of meterEntries) {
                        const samples = entry.sampledValue || entry.values || [];
                        const candidate = samples.find(
                            v => v.measurand === 'Energy.Active.Import.Register' && ['Wh', 'kWh'].includes(v.unit)
                        );
                        if (candidate && !isNaN(parseFloat(candidate.value))) {
                            energySample = candidate;
                            lastValidEntry = entry;
                        }
                    }

                    if (!energySample || !lastValidEntry) {
                        console.warn(`⚠️ Nenhuma leitura válida de energia encontrada para ${client.identity}`);
                        return {};
                    }

                    let currentMeterKwh = parseFloat(energySample.value);
                    if (energySample.unit === 'Wh') {
                        currentMeterKwh = currentMeterKwh / 1000;
                    }

                    console.log(`🔋 Leitura atual: ${currentMeterKwh} kWh`);

                    if (transaction.meterStart == null) {
                        console.warn(`⚠️ meterStart não definido para transação ${transactionId}.`);
                        return {};
                    }

                    transaction.lastMeterValue = currentMeterKwh;

                    const consumedKwh = currentMeterKwh - (transaction.meterStart / 1000);
                    transaction.consumedKwh = consumedKwh;

                    console.log(`🔋 Transação ${transactionId} consumo atual: ${consumedKwh.toFixed(3)}kWh`);

                    await transaction.save();

                    if (transaction.targetKwh && consumedKwh >= transaction.targetKwh) {
                        console.log(`🎯 Meta de ${transaction.targetKwh}kWh atingida! Enviando comando de parada.`);
                        await client.call('RemoteStopTransaction', { transactionId });
                    }

                    addLog({
                        chargerId: client.identity,
                        transactionId,
                        timestamp: lastValidEntry.timestamp || new Date().toISOString(),
                        energyKwh: currentMeterKwh,
                        consumedKwh,
                        sampledValues: lastValidEntry.sampledValue || lastValidEntry.values || []
                    });

                } catch (error) {
                    console.error(`❌ Erro no processamento de MeterValues para ${client.identity}:`, error);
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

        this.server.listen(port, '0.0.0.0', { path: '/ocpp' }, () => {
            console.log(`🚀 Servidor OCPP rodando em wss://e2n.online:${port}/ocpp`);
        })

    }

}

module.exports = OCPPServer;

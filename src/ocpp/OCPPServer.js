const { RPCServer } = require('ocpp-rpc');
const Charger = require('../models/Charger');
const { handleMeterValues } = require("./handlers");
const amqp = require('amqplib');
const ChargingTransaction = require('../models/ChargingTransaction');
const UserTransaction = require('../models/UserTransaction');
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

            // client.handle('StartTransaction', async ({ params }) => {
            //     console.info(`🚀 StartTransaction de ${client.identity}:`, params);
            //
            //     let transactionId = params.transactionId || Math.floor(Math.random() * 100000);
            //     if (!params.transactionId) {
            //         console.warn(`⚠️ StartTransaction sem transactionId recebido, gerando um: ${transactionId}`);
            //     }
            //
            //     global.activeTransactions.set(client.identity, transactionId);
            //     console.info(`📌 Transaction armazenada: ${client.identity} -> ${transactionId}`);
            //
            //     return { transactionId, idTagInfo: { status: "Accepted" } };
            // });
            //
            // client.handle('StopTransaction', async ({ params }) => {
            //     console.info(`🛑 StopTransaction de ${client.identity}:`, params);
            //
            //     global.activeTransactions.delete(client.identity);
            //     console.info(`🗑 Transaction removida: ${client.identity}`);
            //
            //     return { idTagInfo: { status: "Accepted" } };
            // });


            client.handle('StartTransaction', async ({ params }) => {
                console.info(`🚀 StartTransaction de ${client.identity}:`, params);

                let transactionId = params.transactionId || Math.floor(Math.random() * 100000);

                try {
                    const newTransaction = new ChargingTransaction({
                        chargerId: client.identity,
                        idTag: params.idTag,
                        transactionId,
                        startTime: new Date(),
                        status: 'Active'
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
                    if (!transaction) {
                        console.warn(`⚠️ Transação ${transactionId} não encontrada no banco.`);
                        return { idTagInfo: { status: "Rejected" } };
                    }

                    // Atualiza dados da transação
                    transaction.endTime = new Date();
                    transaction.status = 'Completed';

                    // Captura consumo final (do meterStop ou do último registro)
                    let consumedKwh = 0;
                    if (params.meterStop) {
                        const energyValue = params.meterStop.find(
                            v => v.measurand === 'Energy.Active.Import.Register' &&
                                v.unit === 'kWh'
                        )?.value;

                        if (energyValue) {
                            consumedKwh = parseFloat(energyValue);
                            transaction.consumedKwh = consumedKwh;
                        }
                    }

                    await transaction.save();

                    // Busca a transação do usuário e atualiza
                    const userTransaction = await UserTransaction.findOne({
                        idTag: transaction.idTag,
                        status: 'Active'
                    });

                    if (userTransaction) {
                        // Se não encontrou consumo no meterStop, usa o que já estava na transação
                        if (consumedKwh === 0 && transaction.consumedKwh) {
                            consumedKwh = transaction.consumedKwh;
                        }

                        // Atualiza a transação do usuário
                        userTransaction.consumedKwh = consumedKwh;
                        userTransaction.status = 'Completed';
                        userTransaction.endTime = transaction.endTime;
                        await userTransaction.save();

                        if (consumedKwh > 0) {

                            const charger = await Charger.findOne({ serialNumber: client.identity }).lean();
                            const pricePerKwh = charger?.pricePerKw ?? 2; // Valor padrão de R$2 se não definido
                            const amountToDeduct = parseFloat((consumedKwh * pricePerKwh).toFixed(2));

                            const wallet = await Wallet.findOne({ userId: userTransaction.userId });

                            if (wallet) {
                                wallet.balance -= amountToDeduct;
                                await wallet.save();
                                console.log(`💰 Débito de R$${amountToDeduct} realizado na carteira do usuário ${userTransaction.userId}`);
                            } else {
                                console.warn(`⚠️ Carteira não encontrada para o usuário ${userTransaction.userId}`);
                            }
                        }
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

            // client.handle('MeterValues', async (params) => await handleMeterValues(client, params));


            // client.handle('MeterValues', async ({ params }) => {
            //     console.info(`⚡ MeterValues recebido de ${client.identity}:`, params);
            //
            //     const meterData = {
            //         chargerId: client.identity,
            //         timestamp: params.meterValue[0]?.timestamp || new Date().toISOString(),
            //         values: params.meterValue[0]?.sampledValue || [],
            //     };
            //
            //     this.sendToRabbitMQ(meterData); // 🔹 Envia para RabbitMQ
            //     return {};
            // });

            // client.handle('MeterValues', async ({ params }) => {
            //     console.info(`⚡ MeterValues recebido de ${client.identity}:`, params);
            //     // this.publishToRabbitMQ(client.identity, params); // Envia os dados para RabbitMQ
            //     return {};
            // });

            client.handle('MeterValues', async ({ params }) => {
                console.info(`⚡ MeterValues recebido de ${client.identity}:`, params);

                const transactionId = global.activeTransactions.get(client.identity);
                if (!transactionId) {
                    console.warn(`⚠️ Nenhuma transação ativa para ${client.identity}. Ignorando MeterValues.`);
                    return {};
                }

                try {
                    // Busca a transação principal
                    const transaction = await ChargingTransaction.findOne({ transactionId });
                    if (!transaction) {
                        console.warn(`⚠️ Transação ${transactionId} não encontrada no banco de dados`);
                        return {};
                    }

                    // Busca a transação do usuário CORRETAMENTE usando o idTag da transação principal
                    const userTransaction = await UserTransaction.findOne({
                        idTag: transaction.idTag  // Corrigido: usa transaction.idTag
                    });

                    if (!userTransaction) {
                        console.warn(`⚠️ Transação do usuário com idTag ${transaction.idTag} não encontrada`);
                        return {};
                    }

                    // ==============================================
                    // MODO DE TESTE - Incremento artificial
                    // ==============================================
                    const TEST_MODE = false;
                    const TEST_INCREMENT = 5;
                    let testParams = {...params};

                    if (TEST_MODE && params.meterValue) {
                        console.log('🔧 MODO DE TESTE ATIVO - Aplicando incremento artificial');

                        // Busca o último valor armazenado ou usa 0 se for a primeira vez
                        const lastConsumed = transaction.consumedKwh || 0;

                        testParams.meterValue = params.meterValue.map(meter => ({
                            ...meter,
                            sampledValue: meter.sampledValue.map(value => {
                                if (value.measurand === 'Energy.Active.Import.Register') {
                                    // Incrementa baseado no último valor armazenado
                                    const newValue = lastConsumed + TEST_INCREMENT;

                                    // Atualiza a transação com o novo valor
                                    transaction.consumedKwh = newValue;

                                    return {
                                        ...value,
                                        value: newValue.toString()
                                    };
                                }
                                return value;
                            })
                        }));

                        console.log('🔧 Valores simulados:', testParams.meterValue);
                    }
                    // ==============================================

                    // Processa os valores
                    const meterData = {
                        chargerId: client.identity,
                        timestamp: testParams.meterValue[0]?.timestamp || new Date().toISOString(),
                        values: testParams.meterValue[0]?.sampledValue || [],
                    };
                    addLog(meterData);

                    // Verificação do targetKwh (agora usando userTransaction corretamente)
                    if (userTransaction.targetKwh) {
                        const energyValue = testParams.meterValue[0]?.sampledValue?.find(
                            v => v.measurand === 'Energy.Active.Import.Register' &&
                                v.unit === 'kWh'
                        )?.value;

                        if (energyValue) {
                            const consumedKwh = parseFloat(energyValue);
                            console.log(`🔋 Consumo atual: ${consumedKwh.toFixed(2)}kWh / Meta: ${userTransaction.targetKwh}kWh`);

                            // Atualiza o consumo na transação do usuário
                            userTransaction.consumedKwh = consumedKwh;
                            await userTransaction.save();

                            // Verifica se atingiu a meta
                            if (consumedKwh >= userTransaction.targetKwh) {
                                console.log(`🎯 Meta de ${userTransaction.targetKwh}kWh atingida!`);

                                const stopResponse = await client.call('RemoteStopTransaction', {
                                    transactionId
                                });

                                if (stopResponse.status === 'Accepted') {
                                    // Atualiza ambas as transações
                                    transaction.status = 'Completed';
                                    transaction.endTime = new Date();
                                    transaction.consumedKwh = consumedKwh;
                                    await transaction.save();

                                    userTransaction.status = 'Completed';
                                    await userTransaction.save();

                                    global.activeTransactions.delete(client.identity);
                                    console.log('✅ Transação encerrada automaticamente');
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(`❌ Erro no processamento:`, error);
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

    // async initRabbitMQ() {
    //     try {
    //         this.rabbitConn = await amqp.connect(process.env.RABBITMQ_URL);
    //         this.rabbitChannel = await this.rabbitConn.createChannel();
    //         await this.rabbitChannel.assertExchange("meter_values_exchange", "direct", { durable: false });
    //         console.log("✅ Conectado ao RabbitMQ");
    //     } catch (error) {
    //         console.error("❌ Erro ao conectar ao RabbitMQ:", error);
    //     }
    // }
    //
    // publishToRabbitMQ(data) {
    //     if (this.rabbitChannel) {
    //         this.rabbitChannel.publish("meter_values_exchange", "meter.values", Buffer.from(JSON.stringify(data)));
    //         console.info("📤 Enviado para RabbitMQ:", data);
    //     } else {
    //         console.error("❌ Canal RabbitMQ não inicializado.");
    //     }
    // }
}

module.exports = OCPPServer;

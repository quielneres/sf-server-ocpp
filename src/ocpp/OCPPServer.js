const { RPCServer } = require('ocpp-rpc');
const Charger = require('../models/Charger');
const { handleMeterValues } = require("./handlers");
const amqp = require('amqplib');
const ChargingTransaction = require('../models/ChargingTransaction');

class OCPPServer {
    constructor() {
        //const port = process.env.PORT || 3000;
        const port = 9000;

        // const port = process.env.PORT || process.env.OCPP_PORT || 3000;

        this.server = new RPCServer({
            protocols: ['ocpp1.6'],
            strictMode: true,
        });
        // this.initRabbitMQ(); // 🔹 Inicia conexão com o RabbitMQ
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

        this.server.listen(port, '0.0.0.0', { path: '/ocpp' }, () => {
            console.log(`🚀 Servidor OCPP rodando em wss://e2n.online:${port}/ocpp`);
        })

    }



    // async initRabbitMQ() {
    //     try {
    //         this.rabbitConn = await amqp.connect( 'amqp://localhost');
    //         this.rabbitChannel = await this.rabbitConn.createChannel();
    //         await this.rabbitChannel.assertExchange('meter_values_exchange', 'direct', { durable: false });
    //         console.log("✅ Conectado ao RabbitMQ");
    //     } catch (error) {
    //         console.error("❌ Erro ao conectar ao RabbitMQ:", error);
    //     }
    // }
    //
    // publishToRabbitMQ(chargerId, data) {
    //     if (this.rabbitChannel) {
    //         this.rabbitChannel.publish('meter_values_exchange', `charger.${chargerId}`, Buffer.from(JSON.stringify(data)));
    //         console.info(`📤 Enviado para RabbitMQ (charger.${chargerId}):`, data);
    //     } else {
    //         console.error("❌ Canal RabbitMQ não inicializado.");
    //     }
    // }
}

module.exports = OCPPServer;

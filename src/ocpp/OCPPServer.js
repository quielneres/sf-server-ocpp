const { RPCServer, createRPCError } = require('ocpp-rpc');
const Charger = require('../models/Charger');

class OCPPServer {
    constructor() {
        this.server = new RPCServer({
            protocols: ['ocpp1.6'],
            strictMode: true
        });

        this.chargers = new Map();

        this.server.on('client', async (client) => {
            console.log(`🔌 Carregador conectado: ${client.identity}`);
            this.chargers.set(client.identity, client);

            // ✅ BootNotification Handler
            client.handle('BootNotification', async ({ params }) => {
                console.log(`📡 BootNotification de ${client.identity}:`, params);

                if (!params.chargePointVendor || !params.chargePointModel) {
                    console.error("❌ BootNotification inválido. Dados ausentes.");
                    return { status: "Rejected", currentTime: new Date().toISOString() };
                }

                let charger = await Charger.findOne({ serialNumber: client.identity });

                if (!charger) {
                    // ✅ Criar carregador caso não exista
                    charger = new Charger({
                        serialNumber: client.identity,
                        vendor: params.chargePointVendor,
                        model: params.chargePointModel,
                        status: 'Available',
                        lastHeartbeat: new Date(),
                        isOnline: true
                    });
                } else {
                    // ✅ Atualizar se já existir
                    charger.lastHeartbeat = new Date();
                    charger.isOnline = true;
                }

                await charger.save();
                console.log(`✅ Carregador atualizado/salvo: ${client.identity}`);

                return { status: "Accepted", interval: 300, currentTime: new Date().toISOString() };
            });

            // ✅ Heartbeat Handler
            client.handle('Heartbeat', async () => {
                console.log(`💓 Heartbeat recebido de ${client.identity}`);

                let charger = await Charger.findOne({ serialNumber: client.identity });

                if (charger) {
                    charger.lastHeartbeat = new Date();
                    charger.isOnline = true;
                    await charger.save();
                }

                return { currentTime: new Date().toISOString() };
            });

            // ✅ Quando um carregador se desconecta
            client.on('close', async () => {
                console.log(`🔌 Conexão encerrada: ${client.identity}`);

                let charger = await Charger.findOne({ serialNumber: client.identity });

                if (charger) {
                    charger.isOnline = false;
                    await charger.save();
                }

                this.chargers.delete(client.identity);
            });
        });

        this.server.listen(3000);
        console.log(`🚀 Servidor OCPP rodando em ws://localhost:3000`);
    }
}

module.exports = OCPPServer;

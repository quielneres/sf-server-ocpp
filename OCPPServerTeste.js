const { RPCServer } = require('ocpp-rpc');

class OCPPServerTeste {
    constructor() {
        const port = 9000;

        this.server = new RPCServer({
            protocols: ['ocpp1.6'],
            strictMode: true,
        });

        this.server.on('client', async (client) => {
            console.info(`🔌 Carregador conectado: ${client.identity}`);

            client.handle('BootNotification', async ({ params }) => {
                console.info(`📡 BootNotification de ${client.identity}:`, params);
                return { status: "Accepted", interval: 300, currentTime: new Date().toISOString() };
            });

            client.handle('StatusNotification', async ({ params }) => {
                console.info(`🔔 StatusNotification de ${client.identity}:`, params);
                return {};
            });

            client.handle('StartTransaction', async ({ params }) => {
                console.info(`🚀 StartTransaction de ${client.identity}:`, params);
                const transactionId = Math.floor(Math.random() * 100000);
                return { transactionId, idTagInfo: { status: "Accepted" } };
            });

            client.handle('StopTransaction', async ({ params }) => {
                console.info(`🛑 StopTransaction de ${client.identity}:`, params);
                return { idTagInfo: { status: "Accepted" } };
            });

            client.handle('Heartbeat', async () => {
                console.info(`💓 Heartbeat recebido de ${client.identity}`);
                return { currentTime: new Date().toISOString() };
            });

            client.handle('MeterValues', async ({ params }) => {
                console.info(`⚡ MeterValues recebido de ${client.identity}:`, params);
                return {};
            });

            client.on('close', async () => {
                console.info(`🔌 Conexão encerrada: ${client.identity}`);
            });
        });

        this.server.listen(port, '0.0.0.0', { path: '/ocpp' }, () => {
            console.log(`🚀 Servidor OCPP rodando em ws://localhost:${port}/ocpp`);
        });
    }
}

// Inicia o servidor automaticamente quando o arquivo for executado
new OCPPServerTeste();

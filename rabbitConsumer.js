// const amqp = require('amqplib');
// const WebSocket = require('ws');
// require('dotenv').config();
//
// const RABBITMQ_URL = 'amqp://localhost';
// const WS_PORT = process.env.WS_PORT || 5002;
//
// console.log('RABBITMQ_URL',process.env.RABBITMQ_URL);
//
// const wss = new WebSocket.Server({ port: WS_PORT });
// console.log(`✅ WebSocket rodando na porta ${WS_PORT}`);
//
// const clients = new Map(); // Mapear dispositivos conectados
//
// async function startRabbitConsumer() {
//     try {
//         console.log("🔄 Tentando conectar ao RabbitMQ...");
//         const conn = await amqp.connect(RABBITMQ_URL);
//         console.log("✅ Conectado ao RabbitMQ!");
//         const channel = await conn.createChannel();
//
//         await channel.assertExchange('meter_values_exchange', 'direct', { durable: false });
//
//         wss.on('connection', async (ws, req) => {
//             const url = new URL(req.url, `http://${req.headers.host}`);
//             const chargerId = url.searchParams.get('chargerId');
//
//             if (!chargerId) {
//                 ws.close(4001, "chargerId é obrigatório.");
//                 return;
//             }
//
//             console.log(`📡 Dispositivo conectado para chargerId: ${chargerId}`);
//             clients.set(ws, chargerId);
//
//             const { queue } = await channel.assertQueue(`queue_${chargerId}`, { exclusive: true });
//             await channel.bindQueue(queue, 'meter_values_exchange', `charger.${chargerId}`);
//
//             channel.consume(queue, (msg) => {
//                 if (msg) {
//                     const data = JSON.parse(msg.content.toString());
//                     console.log(`📥 Mensagem recebida:`, data);
//
//                     clients.forEach((id, wsClient) => {
//                         if (id === chargerId) {
//                             wsClient.send(JSON.stringify(data));
//                         }
//                     });
//
//                     channel.ack(msg);
//                 }
//             });
//
//             ws.on('close', () => {
//                 clients.delete(ws);
//                 console.log(`❌ Dispositivo desconectado (chargerId: ${chargerId})`);
//             });
//         });
//
//         console.log("✅ RabbitMQ Consumer iniciado!");
//     } catch (error) {
//         console.error("❌ Erro no RabbitMQ Consumer:", error);
//     }
// }
//
// startRabbitConsumer();

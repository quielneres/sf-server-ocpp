// const amqp = require('amqplib');
//
// async function sendTestMessage() {
//     const connection = await amqp.connect('amqp://localhost');
//     const channel = await connection.createChannel();
//     const queue = 'ocpp_queue';
//
//     await channel.assertQueue(queue, { durable: true });
//     channel.sendToQueue(queue, Buffer.from(JSON.stringify({ chargerId: 'charger-01', status: 'Charging' })));
//
//     console.log("✅ Mensagem enviada para a fila!");
//     setTimeout(() => { connection.close(); process.exit(0); }, 500);
// }
//
// sendTestMessage();

const amqp = require('amqplib');

async function sendTestMessage() {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();

    const exchange = 'meter_values_exchange';
    const routingKey = 'NBK0000324020022';  // Substitua pelo chargerId correto

    await channel.assertExchange(exchange, 'direct', { durable: false });
    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify({ chargerId: 'NBK0000324020022', status: 'Charging' })));

    console.log("✅ Mensagem enviada para o exchange!");

    setTimeout(() => { connection.close(); process.exit(0); }, 500);
}

sendTestMessage();


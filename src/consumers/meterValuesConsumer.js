// const amqp = require("amqplib");
const amqp = require("amqplib/callback_api");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://rabbitmq";
const { ocppServer } = require('../ocpp/OCPPServer'); // Ajuste o caminho conforme necessário

async function startConsumer() {
    amqp.connect(RABBITMQ_URL, (err, connection) => {
        if (err) {
            console.error("❌ Erro ao conectar ao RabbitMQ:", err);
            setTimeout(startConsumer, 5000);
            return;
        }

        connection.createChannel((err, channel) => {
            if (err) {
                console.error("❌ Erro ao criar canal RabbitMQ:", err);
                return;
            }

            const exchange = "meter_values_exchange";
            const queue = "meter_values_queue";

            channel.assertExchange(exchange, "direct", { durable: false });
            channel.assertQueue(queue, { durable: false });
            channel.bindQueue(queue, exchange, "meter.values");

            console.log("✅ Consumidor de MeterValues iniciado. Aguardando mensagens...");

            channel.consume(queue, (msg) => {
                if (msg !== null) {
                    const meterData = JSON.parse(msg.content.toString());
                    console.log("📥 Mensagem recebida:", meterData);

                    // Envia os dados para os clientes React Native
                    ocppServer.sendToReactNativeClients(meterData);

                    channel.ack(msg);
                }
            });
        });
    });
}

module.exports = { startConsumer };

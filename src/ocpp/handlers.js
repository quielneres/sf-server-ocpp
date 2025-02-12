const logger = require('../utils/logger');

function handleBootNotification(client, { params }) {
    logger.info(`📡 BootNotification de ${client.identity}:`, params);
    return { status: "Accepted", interval: 300, currentTime: new Date().toISOString() };
}

function handleHeartbeat(client) {
    logger.info(`💓 Heartbeat recebido de ${client.identity}`);
    return { currentTime: new Date().toISOString() };
}

function handleStatusNotification(client, { params }) {
    logger.info(`🔔 StatusNotification de ${client.identity}:`, params);
    return {};
}

async function handleMeterValues(client, { params }) {
    console.log(`📊 MeterValues recebido de ${client.identity}:`, params);

    // 🔍 Busca a transação ativa
    const transaction = await Transaction.findOne({
        chargerId: client.identity,
        transactionId: params.transactionId
    });

    if (!transaction) {
        console.warn(`⚠️ Nenhuma transação ativa encontrada para ${client.identity}`);
        return {};
    }

    // 🔹 Salva os valores de medição na transação
    transaction.meterValues.push({
        timestamp: new Date(params.meterValue[0]?.timestamp || Date.now()),
        energy: params.meterValue[0]?.sampledValue.find(v => v.measurand === "Energy.Active.Import.Register")?.value || 0,
        power: params.meterValue[0]?.sampledValue.find(v => v.measurand === "Power.Active.Import")?.value || 0,
    });

    await transaction.save();

    return {};
}


module.exports = {
    handleBootNotification,
    handleHeartbeat,
    handleStatusNotification,
    handleMeterValues
};

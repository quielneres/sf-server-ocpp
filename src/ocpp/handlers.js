const Charger = require('../models/Charger');
const logger = require('../utils/logger');
const Transaction = require('../models/Transaction');

// 📡 Trata BootNotification (quando o carregador se conecta)
async function handleBootNotification(client, { params }) {
    logger.info(`📡 BootNotification de ${client.identity}:`, params);

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
    return { status: "Accepted", interval: 300, currentTime: new Date().toISOString() };
}

// 💓 Trata Heartbeat (mantém conexão ativa)
async function handleHeartbeat(client) {
    logger.info(`💓 Heartbeat recebido de ${client.identity}`);

    let charger = await Charger.findOne({ serialNumber: client.identity });
    if (charger) {
        charger.lastHeartbeat = new Date();
        charger.isOnline = true;
        await charger.save();
    }

    return { currentTime: new Date().toISOString() };
}

// 🔔 Trata StatusNotification (status do carregador)
async function handleStatusNotification(client, { params }) {
    logger.info(`🔔 StatusNotification de ${client.identity}:`, params);

    let charger = await Charger.findOne({ serialNumber: client.identity });
    if (charger) {
        charger.status = params.status;
        charger.lastHeartbeat = new Date();
        await charger.save();
    }

    return {};
}

async function handleStartTransaction(client, { params }) {
    logger.info(`🚀 StartTransaction de ${client.identity}:`, params);

    console.log('params', client)
    console.log('params', params)

    // Gera um transactionId caso não tenha sido recebido
    const transactionId = params.transactionId || Math.floor(Math.random() * 100000);
    logger.warn(`⚠️ StartTransaction sem transactionId recebido, gerando um: ${transactionId}`);

    // Salva a transação no banco
    const newTransaction = new Transaction({
        transactionId,
        chargerId: client.identity,
        connectorId: params.connectorId,
        idTag: params.idTag,
        meterStart: params.meterStart,
        timestampStart: new Date()
    });

    await newTransaction.save();

    global.activeTransactions.set(client.identity, transactionId);

    console.log(`📌 Transaction armazenada: ${client.identity} -> ${transactionId}`);

    return { transactionId, idTagInfo: { status: "Accepted" } };
}

async function handleStopTransaction(client, { params }) {
    logger.info(`🛑 StopTransaction de ${client.identity}:`, params);

    console.log('start client', client)
    console.log('start params', params)

    // 🔍 Busca a transação ativa
    const transaction = await Transaction.findOne({
        chargerId: client.identity,
        transactionId: params.transactionId
    });


    if (!transaction) {
        logger.error(`❌ Nenhuma transação ativa encontrada para o carregador ${client.identity}`);
        return { idTagInfo: { status: "Invalid" } };
    }

    // 🔥 Finaliza a transação
    transaction.meterStop = params.meterStop;
    transaction.timestampStop = new Date();
    transaction.status = "Completed";

    await transaction.save();

    logger.info(`✅ Transação ${transaction.transactionId} finalizada.`);
    return { idTagInfo: { status: "Accepted" } };
}


module.exports = {
    handleBootNotification,
    handleHeartbeat,
    handleStatusNotification,
    handleStartTransaction,
    handleStopTransaction
};

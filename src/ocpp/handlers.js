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

module.exports = {
    handleBootNotification,
    handleHeartbeat,
    handleStatusNotification
};

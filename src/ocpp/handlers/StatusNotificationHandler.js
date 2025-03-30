const Charger = require('../../models/Charger');

module.exports = async (client, params) => {
    console.info(`🔔 StatusNotification recebido de ${client.identity}:`, params);

    try {
        const charger = await Charger.findOne({ serialNumber: client.identity });
        if (charger) {
            charger.status = params.status;
            await charger.save();
        }
    } catch (error) {
        console.error(`❌ Erro ao atualizar status de ${client.identity}:`, error);
    }

    return {};
};
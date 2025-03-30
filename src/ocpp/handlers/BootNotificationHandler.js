const Charger = require('../../models/Charger');

module.exports = async (client, params) => {
    console.info(`📡 BootNotification tste de ${client.identity}:`, params);

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
};
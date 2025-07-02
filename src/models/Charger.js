const mongoose = require('mongoose');

const ConnectorSchema = new mongoose.Schema({
    connectorId: { type: Number, required: true }, // ex: 1, 2, 3...
    status: { type: String, default: 'Available' }, // Available, Charging, SuspendedEV, etc.
    currentTransactionId: { type: Number, default: null },
    powerKw: { type: Number },
    lastStatusTimestamp: { type: Date, default: Date.now }
}, { _id: false }); // evita criar _id para cada subdocumento

const ChargerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    serialNumber: { type: String, required: true, unique: true },
    vendor: { type: String, required: true },
    model: { type: String, required: true },
    status: { type: String, default: 'Available' }, // status geral (opcional)
    lastHeartbeat: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },

    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    description: { type: String },
    address: { type: String, required: true },

    is24Hours: { type: Boolean, default: false },
    openingHours: { type: String }, // Ex: "08:00-22:00"

    connectorType: { type: String }, // Tipo geral (Ex: CCS, Type2)
    powerKw: { type: Number },
    pricePerKw: { type: Number, required: true },

    connectors: {
        type: [ConnectorSchema],
        default: []
    }

}, { timestamps: true });

ChargerSchema.methods.isOpenNow = function () {
    if (this.is24Hours) return true;
    if (!this.openingHours) return false;

    const [openTime, closeTime] = this.openingHours.split('-');
    const now = new Date();
    const [openHour, openMinute] = openTime.split(':').map(Number);
    const [closeHour, closeMinute] = closeTime.split(':').map(Number);

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = openHour * 60 + openMinute;
    const closeMinutes = closeHour * 60 + closeMinute;

    return nowMinutes >= openMinutes && nowMinutes <= closeMinutes;
};

module.exports = mongoose.model('Charger', ChargerSchema);

const mongoose = require('mongoose');

const ChargerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    serialNumber: { type: String, required: true, unique: true },
    vendor: { type: String, required: true },
    model: { type: String, required: true },
    status: { type: String, default: 'Available' },
    lastHeartbeat: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    description: { type: String },
    address: { type: String, required: true },
    is24Hours: { type: Boolean, default: false }, // ✅ Novo campo
    openingHours: { type: String }, // Exemplo: "08:00-22:00"
    connectorType: { type: String, required: true },
    powerKw: { type: Number, required: true },
    pricePerKw: { type: Number, required: true }
}, { timestamps: true });

// ✅ Método para verificar se o carregador está aberto
ChargerSchema.methods.isOpenNow = function () {
    if (this.is24Hours) return true; // Se for 24h, está sempre aberto

    if (!this.openingHours) return false; // Se não há horário definido, assume fechado

    const [openTime, closeTime] = this.openingHours.split('-'); // Exemplo: "08:00-22:00"

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const [openHour, openMinute] = openTime.split(':').map(Number);
    const [closeHour, closeMinute] = closeTime.split(':').map(Number);

    const isAfterOpen = currentHour > openHour || (currentHour === openHour && currentMinute >= openMinute);
    const isBeforeClose = currentHour < closeHour || (currentHour === closeHour && currentMinute <= closeMinute);

    return isAfterOpen && isBeforeClose;
};

module.exports = mongoose.model('Charger', ChargerSchema);

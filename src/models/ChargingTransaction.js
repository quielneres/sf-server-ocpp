const mongoose = require('mongoose');

const MeterValueSchema = new mongoose.Schema({
    timestamp: { type: Date, required: true },
    values: [{ value: String, unit: String, context: String, measurand: String }]
});

const ChargingTransactionSchema = new mongoose.Schema({
    chargerId: { type: String, required: true },
    idTag: { type: String, required: true },
    transactionId: { type: Number, required: true, unique: true },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    meterValues: [MeterValueSchema],
    status: { type: String, enum: ["Active", "Completed"], default: "Active" },
    targetKwh: Number,
    consumedKwh: { type: Number, default: 0 }
});

module.exports = mongoose.model('ChargingTransaction', ChargingTransactionSchema);

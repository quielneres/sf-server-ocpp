const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    chargerId: { type: String, required: true },
    connectorId: { type: Number, required: true },
    idTag: { type: String, required: true },
    startTime: { type: Date, default: Date.now },
    stopTime: { type: Date },
    status: { type: String, default: 'Active' }
});

module.exports = mongoose.model('Transaction', TransactionSchema);

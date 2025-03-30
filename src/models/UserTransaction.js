const mongoose = require('mongoose');

const UserTransactionSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    idTag: { type: String, required: true },
    targetKwh: Number,
    consumedKwh: { type: Number, default: 0 }
});

module.exports = mongoose.model('UserTransaction', UserTransactionSchema);
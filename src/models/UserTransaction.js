const mongoose = require('mongoose');

const UserTransactionSchema = new mongoose.Schema({
    userId: { type: String, required: true }, // ID do usuário
    idTag: { type: String, required: true },
});

module.exports = mongoose.model('UserTransaction', UserTransactionSchema);
const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    cardNumber: { type: String, required: true },
    holderName: { type: String, required: true },
    expirationDate: { type: String, required: true },
    cvv: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Card', cardSchema);
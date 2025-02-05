const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cardNumber: { type: String, required: true },
    cardHolder: { type: String, required: true },
    expirationDate: { type: String, required: true },
    cvv: { type: String, required: true },
    brand: { type: String, enum: ['Visa', 'Mastercard', 'Elo', 'Amex'], required: true }
});

module.exports = mongoose.model('Card', CardSchema);

const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    type: { type: String, enum: ['deposit', 'withdrawal'], required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    paymentMethod: { type: String, enum: ['pix', 'credit_card'], required: true },
    transactionId: { type: String, required: true }, // ID da transação na Pagar.me
    createdAt: { type: Date, default: Date.now }
});

const WalletSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    balance: { type: Number, default: 0 },
    transactions: [TransactionSchema]
});

module.exports = mongoose.model('Wallet', WalletSchema);

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    cpf: { type: String, required: true, unique: true }, // 📌 Adicionando CPF
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' }, // Relacionamento com Carteira
    cars: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Car' }], // Relacionamento com carros do usuário
    createdAt: { type: Date, default: Date.now }
});

// 🔐 Hash da senha antes de salvar
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

module.exports = mongoose.model('User', UserSchema);

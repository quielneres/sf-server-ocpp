const mongoose = require('mongoose');

const CarSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    brand: { type: String, required: true }, // Marca do carro (ex: Tesla, Nissan)
    model: { type: String, required: true }, // Modelo do carro (ex: Model 3, Leaf)
    year: { type: Number, required: true }, // Ano de fabricação
    connectorType: {
        type: String,
        enum: ['CCS Type 1', 'CCS Type 2', 'CHAdeMO', 'Tesla', 'GB/T'],
        required: true
    }, // Tipo de conector compatível
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Car', CarSchema);

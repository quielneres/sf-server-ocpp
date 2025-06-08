const express = require('express');
const router = express.Router();
const Wallet = require('../models/Wallet');

router.post('/pagarme', async (req, res) => {
    try {
        const { type, data } = req.body;

        if (!data || !data.charge || !data.charge.id || !data.charge.status) {
            return res.status(400).json({ error: 'Payload inválido' });
        }

        const transactionId = data.charge.id;
        const status = data.charge.status;

        // Localiza a carteira com a transação
        const wallet = await Wallet.findOne({ 'transactions.transactionId': transactionId });
        if (!wallet) return res.status(404).send('Carteira não encontrada');

        const transaction = wallet.transactions.find(tx => tx.transactionId === transactionId);
        if (!transaction) return res.status(404).send('Transação não encontrada');

        // Atualiza status e saldo
        transaction.status = status;
        transaction.updatedAt = new Date();

        if (status === 'paid') {
            wallet.balance += transaction.amount;
        }

        await wallet.save();
        console.log(`✔️ Webhook recebido: Transação ${transactionId} atualizada para "${status}"`);

        return res.status(200).send('OK');
    } catch (err) {
        console.error('Erro no webhook:', err);
        return res.status(500).send('Erro interno');
    }
});

module.exports = router;

const express = require('express');
const axios = require('axios');
const Wallet = require('../models/Wallet');
const router = express.Router();

const PAGARME_API_KEY = 'SUA_CHAVE_SECRETA_PAGARME';
const PAGARME_API_URL = 'https://api.pagar.me/core/v5';

// 🔹 **Criar pagamento via PIX**
router.post('/deposit/pix', async (req, res) => {
    try {
        const { userId, amount } = req.body;

        if (amount <= 0) {
            return res.status(400).json({ message: "O valor deve ser maior que zero." });
        }

        // 🔹 Criar ordem de pagamento via PIX na Pagar.me
        const response = await axios.post(`${PAGARME_API_URL}/orders`, {
            items: [{ amount: amount * 100, description: "Depósito via Pix", quantity: 1 }],
            payments: [{ payment_method: 'pix', pix: { expires_in: 3600 } }]
        }, {
            headers: { Authorization: `Basic ${Buffer.from(`${PAGARME_API_KEY}:`).toString('base64')}` }
        });

        const transaction = response.data.charges[0].last_transaction;
        const pixQrCode = transaction.qr_code;
        const transactionId = transaction.id;

        // 🔹 Criar transação pendente na carteira
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, transactions: [] });
        }
        wallet.transactions.push({
            amount,
            type: 'deposit',
            paymentMethod: 'pix',
            transactionId
        });

        await wallet.save();

        res.json({
            message: "QRCode gerado com sucesso",
            qrCode: pixQrCode,
            transactionId
        });
    } catch (error) {
        res.status(500).json({ message: "Erro ao gerar pagamento PIX", error: error.message });
    }
});

// 🔹 **Criar pagamento via Cartão de Crédito**
router.post('/deposit/card', async (req, res) => {
    try {
        const { userId, amount, cardNumber, cardCvv, cardHolderName, cardExpiration } = req.body;

        if (amount <= 0) {
            return res.status(400).json({ message: "O valor deve ser maior que zero." });
        }

        // 🔹 Criar ordem de pagamento via cartão na Pagar.me
        const response = await axios.post(`${PAGARME_API_URL}/orders`, {
            items: [{ amount: amount * 100, description: "Depósito via Cartão", quantity: 1 }],
            payments: [{
                payment_method: 'credit_card',
                credit_card: {
                    installments: 1,
                    statement_descriptor: "Recarga",
                    card: {
                        number: cardNumber,
                        cvv: cardCvv,
                        holder_name: cardHolderName,
                        exp_month: cardExpiration.split('/')[0],
                        exp_year: cardExpiration.split('/')[1]
                    }
                }
            }]
        }, {
            headers: { Authorization: `Basic ${Buffer.from(`${PAGARME_API_KEY}:`).toString('base64')}` }
        });

        const transaction = response.data.charges[0].last_transaction;
        const transactionId = transaction.id;

        // 🔹 Criar transação pendente na carteira
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, transactions: [] });
        }
        wallet.transactions.push({
            amount,
            type: 'deposit',
            paymentMethod: 'credit_card',
            transactionId
        });

        await wallet.save();

        res.json({ message: "Pagamento processado", transactionId });
    } catch (error) {
        res.status(500).json({ message: "Erro ao processar pagamento", error: error.message });
    }
});

// 🔹 **Confirmar Pagamento e Adicionar Saldo**
router.post('/confirm-payment', async (req, res) => {
    try {
        const { userId, transactionId } = req.body;

        // 🔹 Consultar status da transação na Pagar.me
        const response = await axios.get(`${PAGARME_API_URL}/charges/${transactionId}`, {
            headers: { Authorization: `Basic ${Buffer.from(`${PAGARME_API_KEY}:`).toString('base64')}` }
        });

        const status = response.data.status;
        const amount = response.data.amount / 100;

        if (status !== 'paid') {
            return res.status(400).json({ message: "Pagamento ainda não confirmado." });
        }

        // 🔹 Atualizar saldo do usuário
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) return res.status(404).json({ message: "Carteira não encontrada." });

        wallet.balance += amount;
        wallet.transactions = wallet.transactions.map(tx =>
            tx.transactionId === transactionId ? { ...tx, status: 'completed' } : tx
        );

        await wallet.save();
        res.json({ message: "Saldo atualizado com sucesso!", newBalance: wallet.balance });
    } catch (error) {
        res.status(500).json({ message: "Erro ao confirmar pagamento", error: error.message });
    }
});

module.exports = router;

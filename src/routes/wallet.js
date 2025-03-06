const express = require('express');
const axios = require('axios');
const Wallet = require('../models/Wallet');
const Charger = require("../models/Charger");
const router = express.Router();

const PAGARME_API_KEY = 'SUA_CHAVE_SECRETA_PAGARME';
const PAGARME_API_URL = 'https://api.pagar.me/core/v5';

/**
 * @swagger
 * /api/wallet/{userId}/balance:
 *   get:
 *     summary: Obtém o saldo da carteira do usuário
 *     tags: [Wallet]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Saldo retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   type: number
 *                   example: 0
 *                 message:
 *                   type: string
 *                   example: "Saldo não encontrado, retornando 0"
 *       404:
 *         description: Documento não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/:userId/balance', async (req, res) => {
    console.log('Recebendo requisição para saldo do usuário:', req.params.userId);
    try {
        const wallet = await Wallet.findOne({ userId: req.params.userId });
        if (!wallet) {
            // Retorna saldo 0 caso não exista
            return res.json({ balance: 0, message: 'Saldo não encontrado, retornando 0' });
        }
        res.json(wallet);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar carteira', error: error.message });
    }
});

router.post('/:userId/pix-generate', async (req, resp) => {

});

/**
 * @swagger
 * /api/wallet/deposit/pix:
 *   post:
 *     summary: Cria pagamento via PIX e registra uma transação pendente na carteira
 *     tags: [Wallet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - amount
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "65bd87a1e7b4e623a4f927e9"
 *               amount:
 *                 type: number
 *                 example: 100
 *     responses:
 *       200:
 *         description: QRCode gerado com sucesso para depósito via PIX
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "QRCode gerado com sucesso"
 *                 qrCode:
 *                   type: string
 *                   example: "QRCode aqui"
 *                 transactionId:
 *                   type: string
 *                   example: "transacao123"
 *       500:
 *         description: Erro ao gerar pagamento PIX
 */
router.post('/deposit/pix', async (req, res) => {
    try {
        const { userId, amount } = req.body;

        if (amount <= 0) {
            return res.status(400).json({ message: "O valor deve ser maior que zero." });
        }

        // Cria ordem de pagamento via PIX na Pagar.me
        const response = await axios.post(`${PAGARME_API_URL}/orders`, {
            items: [{ amount: amount * 100, description: "Depósito via Pix", quantity: 1 }],
            payments: [{ payment_method: 'pix', pix: { expires_in: 3600 } }]
        }, {
            headers: { Authorization: `Basic ${Buffer.from(`${PAGARME_API_KEY}:`).toString('base64')}` }
        });

        const transaction = response.data.charges[0].last_transaction;
        const pixQrCode = transaction.qr_code;
        const transactionId = transaction.id;

        // Cria ou atualiza a carteira do usuário
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, transactions: [] });
        }
        wallet.transactions.push({
            amount,
            type: 'deposit',
            paymentMethod: 'pix',
            transactionId,
            status: 'pending'
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

/**
 * @swagger
 * /api/wallet/deposit/card:
 *   post:
 *     summary: Cria pagamento via Cartão de Crédito e registra uma transação pendente na carteira
 *     tags: [Wallet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - amount
 *               - cardNumber
 *               - cardCvv
 *               - cardHolderName
 *               - cardExpiration
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "65bd87a1e7b4e623a4f927e9"
 *               amount:
 *                 type: number
 *                 example: 100
 *               cardNumber:
 *                 type: string
 *                 example: "4111111111111111"
 *               cardCvv:
 *                 type: string
 *                 example: "123"
 *               cardHolderName:
 *                 type: string
 *                 example: "João Silva"
 *               cardExpiration:
 *                 type: string
 *                 example: "12/2025"
 *     responses:
 *       200:
 *         description: Pagamento via cartão processado com sucesso e transação registrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Pagamento processado"
 *                 transactionId:
 *                   type: string
 *                   example: "transacao123"
 *       500:
 *         description: Erro ao processar pagamento
 */
router.post('/deposit/card', async (req, res) => {
    try {
        const { userId, amount, cardNumber, cardCvv, cardHolderName, cardExpiration } = req.body;

        if (amount <= 0) {
            return res.status(400).json({ message: "O valor deve ser maior que zero." });
        }

        // Cria ordem de pagamento via cartão na Pagar.me
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

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, transactions: [] });
        }
        wallet.transactions.push({
            amount,
            type: 'deposit',
            paymentMethod: 'credit_card',
            transactionId,
            status: 'pending'
        });

        await wallet.save();

        res.json({ message: "Pagamento processado", transactionId });
    } catch (error) {
        res.status(500).json({ message: "Erro ao processar pagamento", error: error.message });
    }
});

/**
 * @swagger
 * /api/wallet/confirm-payment:
 *   post:
 *     summary: Confirma o pagamento e atualiza o saldo da carteira do usuário
 *     tags: [Wallet]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - transactionId
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "65bd87a1e7b4e623a4f927e9"
 *               transactionId:
 *                 type: string
 *                 example: "transacao123"
 *     responses:
 *       200:
 *         description: Saldo atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Saldo atualizado com sucesso!"
 *                 newBalance:
 *                   type: number
 *                   example: 150.5
 *       400:
 *         description: Pagamento não confirmado ou outro erro de validação
 *       404:
 *         description: Carteira não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/confirm-payment', async (req, res) => {
    try {
        const { userId, transactionId } = req.body;

        // Consulta status da transação na Pagar.me
        const response = await axios.get(`${PAGARME_API_URL}/charges/${transactionId}`, {
            headers: { Authorization: `Basic ${Buffer.from(`${PAGARME_API_KEY}:`).toString('base64')}` }
        });

        const status = response.data.status;
        const amount = response.data.amount / 100;

        if (status !== 'paid') {
            return res.status(400).json({ message: "Pagamento ainda não confirmado." });
        }

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) return res.status(404).json({ message: "Carteira não encontrada." });

        wallet.balance += amount;
        wallet.transactions = wallet.transactions.map(tx =>
            tx.transactionId === transactionId ? { ...tx.toObject(), status: 'completed' } : tx
        );

        await wallet.save();
        res.json({ message: "Saldo atualizado com sucesso!", newBalance: wallet.balance });
    } catch (error) {
        res.status(500).json({ message: "Erro ao confirmar pagamento", error: error.message });
    }
});

module.exports = router;

const express = require('express');
const Card = require('../models/Card');
const CreditCardController = require("../controllers/CreditCardController"); // Importe o modelo de Cartão
const router = express.Router();

/**
 * @swagger
 * /api/cards:
 *   post:
 *     summary: Salva um novo cartão para o usuário.
 *     tags: [Cartões]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - cardNumber
 *               - holderName
 *               - expirationDate
 *               - cvv
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "1234567890"
 *               cardNumber:
 *                 type: string
 *                 example: "1234567812345678"
 *               holderName:
 *                 type: string
 *                 example: "João Silva"
 *               expirationDate:
 *                 type: string
 *                 example: "12/2025"
 *               cvv:
 *                 type: string
 *                 example: "123"
 *     responses:
 *       201:
 *         description: Cartão salvo com sucesso.
 *       400:
 *         description: Erro de validação.
 *       500:
 *         description: Erro interno do servidor.
 */
router.post('/', async (req, res) => {
    try {
        const { userId, cardNumber, holderName, expirationDate, cvv } = req.body;

        // Cria o novo cartão
        const newCard = new Card({ userId, cardNumber, holderName, expirationDate, cvv });
        await newCard.save();

        res.status(201).json({ message: 'Cartão salvo com sucesso!', card: newCard });
    } catch (error) {
        console.error('Erro ao salvar cartão:', error);
        res.status(500).json({ message: 'Erro ao salvar cartão', error: error.message });
    }
});

router.get('/:userId', async (req, res) => {
    try {
        const cards = await Card.find({ userId: req.params.userId });

        res.json(cards);
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar cartões", error });
    }
});


/**
 * @swagger
 * /api/cards/deposit-with-credit-card:
 *   post:
 *     summary: Transação cartão de créditos
 *     tags: [CreditCard]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               userId:
 *                  type: string
 *                  example: "67bd205ef5840dc4c3f24c14"
 *               creditCardId:
 *                  type: string
 *                  example: "67be6919f37a81eec3c68418"
 *               amount:
 *                 type: number
 *                 example: 50
 *     responses:
 *       200:
 *         description: Código PIX gerado com sucesso
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
 *                   example: "Código QR"
 *                 amount:
 *                   type: string
 *                   example: "R$ 50,00"
 *                 expiration:
 *                   type: string
 *                   example: "28/01/2025 15:00:00"
 *       400:
 *         description: Valor inválido
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/deposit-with-credit-card', CreditCardController.creditCardDeposit);

module.exports = router;
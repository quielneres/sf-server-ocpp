const express = require('express');
const router = express.Router();
const PixController = require('../controllers/PixController');
const {updateTransactionStatus} = require("../services/PixService");

/**
 * @swagger
 * /api/pix/{userId}/pix-generate:
 *   post:
 *     summary: Gera um pagamento via PIX para o usuário
 *     tags: [Pix]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
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
router.post('/:userId/pix-generate', PixController.pixGenerate);

/**
 * @swagger
 * /api/pix/check-payment:
 *   get:
 *     summary: Verifica o status de um pagamento via Pix ou Cartão
 *     tags: [Wallet]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário
 *       - in: query
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da transação na Pagar.me
 *     responses:
 *       200:
 *         description: Retorna o status da transação
 *       400:
 *         description: Dados ausentes
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/check-payment', async (req, res) => {
    try {
        const { userId, transactionId } = req.query;

        if (!userId || !transactionId) {
            return res.status(400).json({ message: "Parâmetros ausentes" });
        }

        const transactionDetail = await updateTransactionStatus(userId, transactionId);

        res.json(
            {
                message: `Pagamento ${transactionDetail.status}!`,
                status: transactionDetail.status,
                data: transactionDetail.data
            });
    } catch (error) {
        res.status(500).json({ message: "Erro ao verificar pagamento", error: error.message });
    }
});


module.exports = router;

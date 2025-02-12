const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');

/**
 * @swagger
 * /api/transactions/{id}/meter-values:
 *   get:
 *     summary: Obtém os valores de medição de uma transação
 *     tags: [Transações]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *         description: ID da transação
 *     responses:
 *       200:
 *         description: Valores de medição retornados com sucesso
 *       404:
 *         description: Transação não encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/:id/meter-values', async (req, res) => {
    try {
        const transaction = await Transaction.findOne({ transactionId: req.params.id });

        if (!transaction) {
            return res.status(404).json({ message: "Transação não encontrada." });
        }

        res.json({ meterValues: transaction.meterValues });
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar dados da transação", error: error.message });
    }
});

module.exports = router;

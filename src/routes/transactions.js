const express = require('express');
const Transaction = require('../models/Transaction');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Lista todas as transações
 */
router.get('/', async (req, res) => {
    try {
        const transactions = await Transaction.find();
        logger.info(`📄 Transações consultadas. Total: ${transactions.length}`);
        res.json(transactions);
    } catch (error) {
        logger.error(`❌ Erro ao buscar transações: ${error.message}`);
        res.status(500).json({ message: "Erro ao buscar transações" });
    }
});

module.exports = router;

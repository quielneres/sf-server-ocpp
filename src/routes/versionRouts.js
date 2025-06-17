const express = require('express');
const router = express.Router();

/**
 * @swagger
 * /api/version:
 *   get:
 *     summary: Retorna a versão da API
 *     tags: [Versão]
 *     responses:
 *       200:
 *         description: Retorna a versão da API.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 */
router.get('/', async (req, res) => {
    try {
        const version = '1.4.0';

        res.status(200).json({ version });
    } catch (error) {
        console.error("Erro ao retornar versão", error);
        res.status(500).json({ message: "Erro ao retornar versão", error: error.message });
    }
});

module.exports = router;

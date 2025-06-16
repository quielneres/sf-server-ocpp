// routes/ocpp.js
const express = require('express');
const router = express.Router();

const clients = global.ocppClients || new Map();


/**
 * @swagger
 * /api/config/{id}/send:
 *   post:
 *     summary: Envia uma configuração para um carregador OCPP
 *     tags: [Configuração]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "ID do carregador (charge point ID)"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - value
 *             properties:
 *               key:
 *                 type: string
 *                 example: "AllowOfflineTxForUnknownId"
 *               value:
 *                 type: string
 *                 example: "true"
 *     responses:
 *       200:
 *         description: "Comando de configuração enviado com sucesso"
 *       400:
 *         description: "Erro ao enviar configuração (ex: parâmetros inválidos)"
 *       404:
 *         description: "Carregador não encontrado ou não conectado"
 *       500:
 *         description: "Erro interno do servidor"
 */
router.post('/:id/send', async (req, res) => {
    const { key, value } = req.body;
    const chargePointId = req.params.id;

    if (!clients.has(chargePointId)) {
        return res.status(404).json({ error: 'Charge point not connected' });
    }

    const client = clients.get(chargePointId);

    try {
        const response = await client.call('ChangeConfiguration', {
            key: key || 'AllowOfflineTxForUnknownId',
            value: value || 'true'
        });

        console.log(`✅ Configuração enviada para ${chargePointId}:`, response);

        return res.json({ success: true, response });
    } catch (error) {
        console.error(`❌ Erro ao enviar ChangeConfiguration:`, error);
        return res.status(500).json({ error: 'Erro ao enviar configuração' });
    }
});

module.exports = router;

const express = require('express');
const Wallet = require('../models/Wallet');
const Charger = require('../models/Charger');
const router = express.Router();
const { getDistance } = require('../utils/geoUtils');

const ChargingTransaction = require('../models/ChargingTransaction');
const UserTransaction = require('../models/UserTransaction');

const MINIMUM_BALANCE = 30; // Valor mínimo para iniciar carregamento

/**
 * @swagger
 * tags:
 *   name: Carregamento
 *   description: Controle do carregamento via OCPP
 */

/**
 * @swagger
 * /api/charging/{id}/start:
 *   post:
 *     summary: Inicia o carregamento em um carregador OCPP
 *     tags: [Carregamento]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "ID do carregador"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - latitude
 *               - longitude
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "65bd87a1e7b4e623a4f927e9"
 *               latitude:
 *                 type: number
 *                 example: -15.8473680
 *               longitude:
 *                 type: number
 *                 example: -47.9782020
 *     responses:
 *       200:
 *         description: "Carregamento iniciado com sucesso"
 *       400:
 *         description: "Erro de validação (exemplo: saldo insuficiente, usuário longe do carregador)"
 *       404:
 *         description: "Carregador não encontrado ou não conectado"
 *       500:
 *         description: "Erro interno do servidor"
 */
router.post('/:id/start', async (req, res) => {
    try {
        const { userId, latitude, longitude } = req.body;
        const chargerId = req.params.id;
        // console.log('chargerId', chargerId);
        const client = global.ocppClients?.get(chargerId);




        if (!client) {
            return res.status(404).json({ message: `Carregador ${chargerId} não conectado.` });
        }

        // 🔹 Verifica saldo do usuário
        const wallet = await Wallet.findOne({ userId });
        // if (!wallet || wallet.balance < MINIMUM_BALANCE) {
        //     return res.status(400).json({ message: "Saldo insuficiente. Adicione créditos." });
        // }


        // 🔹 Verifica proximidade do usuário
        // const charger = await Charger.findOne({ serialNumber: chargerId });
        // if (!charger) return res.status(404).json({ message: "Carregador não encontrado." });

        // const distance = getDistance(latitude, longitude, charger.latitude, charger.longitude);
        // if (distance > 0.5) { // 500 metros
        //     return res.status(400).json({ message: "Você precisa estar mais próximo do carregador." });
        // }

        const idTag = generateIdTag();


        // 🔹 Envia comando para o carregador
        const response = await client.call('RemoteStartTransaction', {
            connectorId: 1,
            idTag
        });

        if (response.status === 'Accepted') {

            const userTransaction = new UserTransaction({
                userId,
                idTag
            });

            await userTransaction.save();

            res.json({ message: "Carregamento iniciado com sucesso!", idTag });
        } else {
            res.status(400).json({ message: "Carregador recusou o comando." });
        }
    } catch (error) {
        res.status(500).json({ message: "Erro ao iniciar carregamento", error: error.message });
    }
});

/**
 * @swagger
 * /api/charging/{id}/stop:
 *   post:
 *     summary: Para o carregamento em um carregador OCPP
 *     tags: [Carregamento]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "ID do carregador"
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
 *                 type: number
 *                 example: 12345
 *     responses:
 *       200:
 *         description: "Carregamento encerrado com sucesso"
 *       400:
 *         description: "Erro ao encerrar o carregamento (exemplo: transação não encontrada)"
 *       404:
 *         description: "Carregador não encontrado ou não conectado"
 *       500:
 *         description: "Erro interno do servidor"
 */
router.post('/:id/stop', async (req, res) => {
    try {
        const chargerId = req.params.id;
        const client = global.ocppClients.get(chargerId);

        if (!client) {
            return res.status(404).json({ message: `Carregador ${chargerId} não conectado.` });
        }

        // 🔹 Recupera o transactionId armazenado
        const transactionId = global.activeTransactions.get(chargerId);

        if (!transactionId) {
            return res.status(400).json({ message: "Nenhuma transação ativa encontrada para este carregador." });
        }

        // 🔹 Envia o comando para encerrar o carregamento
        const response = await client.call('RemoteStopTransaction', { transactionId });

        console.log("🔹 Resposta do RemoteStopTransaction:", response);

        if (response.status === 'Accepted') {
            // 🔹 Remove a transação ativa após o encerramento
            global.activeTransactions.delete(chargerId);
            res.json({ message: "Carregamento encerrado com sucesso!" });
        } else {
            res.status(400).json({ message: "Falha ao encerrar carregamento." });
        }
    } catch (error) {
        res.status(500).json({ message: "Erro ao encerrar carregamento", error: error.message });
    }
});


router.get('/charging-transactions/:transactionId', async (req, res) => {
    try {
        const transaction = await ChargingTransaction.findOne({ transactionId: req.params.transactionId });

        if (!transaction) {
            return res.status(404).json({ error: "Transação não encontrada" });
        }

        res.json(transaction);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar transação" });
    }
});

function generateIdTag(length = 20) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let idTag = '';
    for (let i = 0; i < length; i++) {
        idTag += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return idTag;
}

module.exports = router;

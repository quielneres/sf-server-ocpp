const express = require('express');
const Wallet = require('../models/Wallet');
const Charger = require('../models/Charger');
const router = express.Router();
const { getDistance } = require('../utils/geoUtils');

const ChargingTransaction = require('../models/ChargingTransaction');
const UserTransaction = require('../models/UserTransaction');

const MINIMUM_BALANCE = 30; // Valor mínimo para iniciar carregamento


router.get('/history/:userId', async (req, res) => {
    try {
        const userTransactions = await UserTransaction.find({ userId: req.params.userId });
        const idTags = userTransactions.map(ut => ut.idTag);
        const relatedTransactions = await ChargingTransaction.find({ idTag: { $in: idTags } });

        // Criar um array de promessas para buscar os carregadores
        const enrichedTransactions = await Promise.all(
            relatedTransactions.map(async (tx) => {
                const charger = await Charger.findOne({ serialNumber: tx.chargerId });
                return {
                    ...tx.toObject(), // Convertendo o Mongoose doc para objeto simples
                    chargerName: charger?.description || 'Desconhecido'
                };
            })
        );

        res.json({
            message: "Transações listadas com sucesso!",
            transactions: enrichedTransactions
        });
    } catch (error) {
        res.status(500).json({
            message: "Erro ao listar transações",
            error: error.message
        });
    }
});


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
        const { userId, latitude, longitude, targetKwh } = req.body;
        const chargerId = req.params.id;
        const client = global.ocppClients?.get(chargerId);

        // Validações iniciais
        if (!client) {
            return res.status(404).json({
                message: `Carregador ${chargerId} não conectado.`,
                errorCode: 'CHARGER_OFFLINE'
            });
        }

        const charger = await Charger.findOne({ serialNumber: chargerId });
        if (!charger) {
            return res.status(404).json({
                message: `Carregador ${chargerId} não encontrado.`,
                errorCode: 'CHARGER_NOT_FOUND'
            });
        }

        // Correção principal: Mudar para status 400
        if (charger.status !== 'Preparing') {
            // return res.status(400).json({
            //     message: `Carregador ${chargerId} não está pronto.`,
            //     status: charger.status,
            //     errorCode: 'CHARGER_NOT_READY'
            // });

            return res.status(200).json({
                message: `Carregador ${chargerId} não está pronto.`,
                status: charger.status,
                errorCode: 'CHARGER_NOT_READY'
            });
        }

        // Verificação de saldo
        // const wallet = await Wallet.findOne({ userId });
        // if (wallet && wallet.balance < MINIMUM_BALANCE) {
        //     return res.status(402).json({
        //         message: "Saldo insuficiente para iniciar carregamento.",
        //         errorCode: 'INSUFFICIENT_BALANCE'
        //     });
        // }

        // Inicia transação
        const idTag = generateIdTag();
        const response = await client.call('RemoteStartTransaction', {
            connectorId: 1,
            idTag
        });

        if (response.status !== 'Accepted') {
            return res.status(400).json({
                message: "Carregador recusou o comando.",
                errorCode: 'CHARGER_REJECTED'
            });
        }

        // Cria transação no banco
        const userTransaction = new UserTransaction({
            userId,
            idTag,
            targetKwh,
            status: 'Active',
            chargerId,
            startTime: new Date(),
            location: {
                type: 'Point',
                coordinates: [longitude, latitude]
            }
        });

        await userTransaction.save();

        // Atualiza status do carregador
        await Charger.updateOne(
            { serialNumber: chargerId },
            { $set: { status: 'Charging' } }
        );

        return res.json({
            message: "Carregamento iniciado com sucesso!",
            idTag,
            transactionId: userTransaction._id
        });

    } catch (error) {
        console.error(`Erro ao iniciar carregamento no carregador ${chargerId}:`, error);
        return res.status(500).json({
            message: "Erro interno ao iniciar carregamento",
            errorCode: 'INTERNAL_ERROR'
        });
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

        const transactionId = global.activeTransactions.get(chargerId);
        if (!transactionId) {
            return res.status(400).json({ message: "Nenhuma transação ativa encontrada para este carregador." });
        }

        const response = await client.call('RemoteStopTransaction', { transactionId });

        if (response.status === 'Accepted') {
            res.json({ message: "Comando para encerrar carregamento enviado com sucesso!" });
        } else {
            res.status(400).json({ message: "Falha ao enviar comando para encerrar carregamento." });
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


router.get('/sync-consumed/:transactionId', async (req, res) => {
    try {
        const transaction = await ChargingTransaction.findOne({
            transactionId: req.params.transactionId
        });

        if (!transaction) {
            return res.status(404).json({ error: "Transação não encontrada" });
        }

        res.json({
            consumedKwh: transactionx.consumedKwh,
            lastUpdated: transaction.updatedAt
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


/**
 * @swagger
 * /api/charging-transactions/active/{chargerId}:
 *   get:
 *     summary: Obtém a transação ativa de um carregador
 *     tags: [Carregamento]
 *     parameters:
 *       - in: path
 *         name: chargerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do carregador
 *     responses:
 *       200:
 *         description: Transação ativa encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChargingTransaction'
 *       404:
 *         description: Nenhuma transação ativa encontrada
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/active/:chargerId', async (req, res) => {
    try {
        const chargerId = req.params.chargerId;

        // Busca a transação ativa (status 'Active' ou sem endTime)
        const activeTransaction = await ChargingTransaction.findOne({
            chargerId,
            status: 'Active',
            endTime: { $exists: false }
        }).sort({ startTime: -1 }); // Pega a mais recente

        if (!activeTransaction) {
            return res.status(404).json({
                message: 'Nenhuma transação ativa encontrada para este carregador'
            });
        }

        res.json(activeTransaction);
    } catch (error) {
        console.error('Erro ao buscar transação ativa:', error);
        res.status(500).json({
            message: 'Erro interno ao buscar transação ativa',
            error: error.message
        });
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

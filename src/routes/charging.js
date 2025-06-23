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
 *                 example: "683ccdca63404d565d5f7e52"
 *               latitude:
 *                 type: number
 *                 example: -15.8473680
 *               longitude:
 *                 type: number
 *                 example: -47.9782020
 *               targetKwh:
 *                 type: number
 *                 example: 50
 *     security:
 *       - bearerAuth: []
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

        console.log('Charger ID:', chargerId);
        console.log('User ID:', userId);
        console.log('Target KWh:', targetKwh);


        // Validações iniciais
        if (!client) {
            return res.status(404).json({
                message: `Estação indisponível.`,
                errorCode: 'CHARGER_OFFLINE'
            });
        }

        const charger = await Charger.findOne({ serialNumber: chargerId });
        if (!charger) {
            return res.status(404).json({
                message: `Estação não encontrada.`,
                errorCode: 'CHARGER_NOT_FOUND'
            });
        }

        // Correção principal: Mudar para status 400
        if (charger.status !== 'Preparing') {

            return res.status(200).json({
                message: `Carregador não está pronto.`,
                status: charger.status,
                errorCode: 'CHARGER_NOT_READY'
            });
        }

        const idTag = generateIdTag();
        let transactionId = Math.floor(Math.random() * 100000);

        const transaction = new ChargingTransaction({
            idTag,
            userId,
            chargerId,
            targetKwh,
            transactionId,
            status: 'Pending',
        });
        await transaction.save();

        global.pendingTransactions = global.pendingTransactions || new Map();
        global.pendingTransactions.set(idTag, transaction);

        const response = await client.call('RemoteStartTransaction', {
            connectorId: 1,
            idTag
        });

        console.log(`✅ Comando enviado para ${chargerId}:`, response);

        if (response.status !== 'Accepted') {
            return res.status(400).json({
                message: "Carregador recusou o comando.",
                errorCode: 'CHARGER_REJECTED'
            });
        }

        // Atualiza status do carregador
        await Charger.updateOne(
            { serialNumber: chargerId },
            { $set: { status: 'Charging' } }
        );

        return res.json({
            message: "Carregamento iniciado com sucesso!",
            idTag,
            transactionId: transaction.transactionId
        });

    } catch (error) {
        console.error(`Erro ao iniciar carregamento no carregador`, error);
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

// async function generateIdTag(userId = '') {
//     const createId = () => {
//         const timestamp = Date.now().toString(36); // exemplo: 'lna1kz'
//         const userHash = userId
//             ? Buffer.from(userId).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 4)
//             : '';
//         const randomLength = 20 - timestamp.length - userHash.length;
//         const randomPart = [...Array(randomLength)].map(() =>
//             Math.random().toString(36)[2]
//         ).join('');
//
//         return `${timestamp}${userHash}${randomPart}`.slice(0, 20); // garante 20 caracteres
//     };
//
//     let idTag;
//     let exists = true;
//     let attempts = 0;
//
//     while (exists && attempts < 5) {
//         idTag = createId();
//         exists = await ChargingTransaction.findOne({ idTag });
//         attempts++;
//     }
//
//     if (exists) {
//         throw new Error("Falha ao gerar idTag única após várias tentativas.");
//     }
//
//     return idTag;
// }


router.get('/user-charging-transactions/:userId', async (req, res) => {
    try {
        // Usar findOne para pegar apenas a transação mais recente
        const transaction = await ChargingTransaction.findOne({
            userId: req.params.userId,
            status: 'Active'
        }).sort({ startTime: -1 });

        if (!transaction) {
            return res.status(404).json({ error: "Nenhuma transação ativa encontrada" });
        }

        // Agora transaction é um objeto único, podemos acessar chargerId diretamente
        const charger = await Charger.findOne({ serialNumber: transaction.chargerId });

        if (!charger) {
            return res.status(404).json({
                error: "Transação encontrada mas carregador não localizado",
                transaction // Retorna a transação mesmo sem o carregador
            });
        }

        res.json({ transaction, charger });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;

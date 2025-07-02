const express = require('express');
const Charger = require('../models/Charger');
const router = express.Router();

/**
 * @swagger
 * /api/chargers:
 *   get:
 *     summary: Lista todos os carregadores
 *     tags: [Carregadores]
 *     responses:
 *       200:
 *         description: Lista de carregadores retornada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Charger'
 */
router.get('/', async (req, res) => {
    try {
        const chargers = await Charger.find();
        res.json(chargers);
    } catch (error) {
        console.error('❌ Erro ao buscar carregadores:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});

/**
 * @swagger
 * /api/chargers:
 *   post:
 *     summary: Cadastra um novo carregador com múltiplos conectores
 *     tags: [Carregadores]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Charger'
 *     responses:
 *       201:
 *         description: Carregador cadastrado com sucesso.
 *       400:
 *         description: Erro de validação.
 */
router.post('/', async (req, res) => {
    try {
        const {
            name, serialNumber, vendor, model, latitude, longitude, description,
            address, openingHours, is24Hours, pricePerKw, connectors
        } = req.body;

        if (!name || !serialNumber || !vendor || !model || !latitude || !longitude || !address || !connectors || connectors.length === 0) {
            return res.status(400).json({ message: 'Campos obrigatórios ausentes.' });
        }

        const existing = await Charger.findOne({ serialNumber });
        if (existing) {
            return res.status(400).json({ message: 'Carregador já existente com este serialNumber.' });
        }

        const newCharger = new Charger({
            name, serialNumber, vendor, model, latitude, longitude, description,
            address, openingHours, is24Hours, pricePerKw,
            connectors
        });

        await newCharger.save();
        res.status(201).json({ message: 'Carregador criado com sucesso', charger: newCharger });
    } catch (error) {
        console.error('❌ Erro ao criar carregador:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});

router.post('/:chargerId/update', async (req, res) => {
    try {
        const charger = await Charger.findById(req.params.chargerId);
        if (!charger) return res.status(404).json({ message: 'Carregador não encontrado.' });

        const {
            name, serialNumber, vendor, model, latitude, longitude, description,
            address, openingHours, is24Hours, connectors
        } = req.body;

        if (!name || !serialNumber || !vendor || !model || !latitude || !longitude || !address || !connectors || connectors.length === 0) {
            return res.status(400).json({ message: 'Campos obrigatórios ausentes.' });
        }

        Object.assign(charger, {
            name, serialNumber, vendor, model, latitude, longitude, description,
            address, openingHours, is24Hours, connectors
        });

        await charger.save();
        res.status(200).json({ message: 'Carregador atualizado com sucesso', charger });
    } catch (error) {
        console.error('❌ Erro ao atualizar carregador:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});

/**
 * @swagger
 * /api/chargers/{id}:
 *   get:
 *     summary: Busca um carregador por ID
 *     tags: [Carregadores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do carregador
 *     responses:
 *       200:
 *         description: Carregador encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Charger'
 *       404:
 *         description: Carregador não encontrado
 */
router.get('/:id', async (req, res) => {
    try {
        const charger = await Charger.findById(req.params.id);
        if (!charger) return res.status(404).json({ message: 'Carregador não encontrado' });
        res.json(charger);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar carregador' });
    }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Charger:
 *       type: object
 *       required:
 *         - name
 *         - serialNumber
 *         - vendor
 *         - model
 *         - latitude
 *         - longitude
 *         - address
 *         - connectors
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         serialNumber:
 *           type: string
 *         vendor:
 *           type: string
 *         model:
 *           type: string
 *         status:
 *           type: string
 *         isOnline:
 *           type: boolean
 *         lastHeartbeat:
 *           type: string
 *           format: date-time
 *         latitude:
 *           type: number
 *         longitude:
 *           type: number
 *         description:
 *           type: string
 *         address:
 *           type: string
 *         is24Hours:
 *           type: boolean
 *         openingHours:
 *           type: string
 *           example: "08:00-22:00"
 *         connectors:
 *           type: array
 *           items:
 *             type: object
 *             required: [connectorId, type, powerKw, pricePerKw]
 *             properties:
 *               connectorId:
 *                 type: number
 *                 example: 1
 *               status:
 *                 type: string
 *                 example: "Available"
 *               type:
 *                 type: string
 *                 example: "CCS Type 2"
 *               powerKw:
 *                 type: number
 *                 example: 22
 *               pricePerKw:
 *                 type: number
 *                 example: 1.50
 *               currentTransactionId:
 *                 type: number
 *               lastStatusTimestamp:
 *                 type: string
 *                 format: date-time
 */

module.exports = router;

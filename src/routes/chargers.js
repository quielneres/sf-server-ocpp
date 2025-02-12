const express = require('express');
const Charger = require('../models/Charger');
const router = express.Router();

/**
 * @swagger
 * /api/chargers:
 *   get:
 *     summary: Lista todos os carregadores e indica se estão abertos
 *     tags: [Carregadores]
 *     responses:
 *       200:
 *         description: Retorna a lista de carregadores e se estão abertos.
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
 *     summary: Cadastra um novo carregador
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
            address, openingHours, connectorType, powerKw, pricePerKw
        } = req.body;

        if (!name || !serialNumber || !vendor || !model || !latitude || !longitude || !address || !openingHours || !connectorType || !powerKw || !pricePerKw) {
            return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos.' });
        }

        const existingCharger = await Charger.findOne({ serialNumber });
        if (existingCharger) {
            return res.status(400).json({ message: 'Já existe um carregador com este serialNumber.' });
        }

        const newCharger = new Charger({
            name, serialNumber, vendor, model, latitude, longitude, description,
            address, openingHours, connectorType, powerKw, pricePerKw
        });

        await newCharger.save();
        res.status(201).json({ message: 'Carregador cadastrado com sucesso!', charger: newCharger });
    } catch (error) {
        console.error('❌ Erro ao cadastrar carregador:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});

/**
 * @swagger
 * /api/chargers/{id}:
 *   get:
 *     summary: Busca um carregador pelo ID
 *     tags: [Carregadores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: O ID do carregador a ser buscado
 *     responses:
 *       200:
 *         description: Carregador encontrado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Charger'
 *       404:
 *         description: Carregador não encontrado.
 *       500:
 *         description: Erro interno do servidor.
 */
router.get('/:id', async (req, res) => {
    try {
        const charger = await Charger.findOne({ _id: req.params.id });
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
 *         - connectorType
 *         - powerKw
 *         - pricePerKw
 *       properties:
 *         _id:
 *           type: string
 *           example: "65bd87a1e7b4e623a4f927e9"
 *         name:
 *           type: string
 *           example: "Carregador Shopping Center"
 *         serialNumber:
 *           type: string
 *           example: "EV12345"
 *         vendor:
 *           type: string
 *           example: "EVCompany"
 *         model:
 *           type: string
 *           example: "EVChargerX"
 *         status:
 *           type: string
 *           default: "Available"
 *           example: "Charging"
 *         lastHeartbeat:
 *           type: string
 *           format: date-time
 *           example: "2025-02-02T19:49:50.011Z"
 *         isOnline:
 *           type: boolean
 *           example: true
 *         latitude:
 *           type: number
 *           example: -23.55052
 *         longitude:
 *           type: number
 *           example: -46.633308
 *         description:
 *           type: string
 *           example: "Ponto de carregamento rápido para veículos elétricos"
 *         address:
 *           type: string
 *           example: "Av. Paulista, 1000 - São Paulo, SP"
 *         is24Hours:
 *           type: boolean
 *           example: false
 *         openingHours:
 *           type: string
 *           example: "08:00-22:00"
 *         isOpenNow:
 *           type: boolean
 *           example: true
 *         connectorType:
 *           type: string
 *           example: "CCS Type 2"
 *         powerKw:
 *           type: number
 *           example: 40
 *         pricePerKw:
 *           type: number
 *           example: 2.00
 */

module.exports = router;
const express = require('express');
const Car = require('../models/Car');
const router = express.Router();

/**
 * @swagger
 * /api/cars/{userId}:
 *   get:
 *     summary: Lista todos os carros do usuário
 *     tags: [Carros]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Lista de carros do usuário.
 */
router.get('/:userId', async (req, res) => {
    try {
        const cars = await Car.find({ user: req.params.userId });
        res.json(cars);
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar carros", error });
    }
});

/**
 * @swagger
 * /api/cars/{userId}/add:
 *   post:
 *     summary: Adiciona um novo carro ao usuário
 *     tags: [Carros]
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
 *               - brand
 *               - model
 *               - year
 *               - connectorType
 *             properties:
 *               brand:
 *                 type: string
 *                 example: "Tesla"
 *               model:
 *                 type: string
 *                 example: "Model 3"
 *               year:
 *                 type: integer
 *                 example: 2022
 *               connectorType:
 *                 type: string
 *                 enum: ["CCS Type 1", "CCS Type 2", "CHAdeMO", "Tesla", "GB/T"]
 *     responses:
 *       201:
 *         description: Carro cadastrado com sucesso.
 */
router.post('/:userId/add', async (req, res) => {
    try {
        const { brand, model, year, connectorType } = req.body;

        const newCar = new Car({
            user: req.params.userId,
            brand,
            model,
            year,
            connectorType
        });

        await newCar.save();
        res.status(201).json({ message: "Carro cadastrado com sucesso!", car: newCar });
    } catch (error) {
        res.status(500).json({ message: "Erro ao cadastrar carro", error });
    }
});

module.exports = router;

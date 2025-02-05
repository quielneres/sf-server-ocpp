const express = require('express');
const Card = require('../models/Card');
const router = express.Router();

// 📌 Lista todos os cartões do usuário
router.get('/:userId', async (req, res) => {
    try {
        const cards = await Card.find({ user: req.params.userId });
        res.json(cards);
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar cartões", error });
    }
});

// 📌 Cadastra um novo cartão
router.post('/:userId/add', async (req, res) => {
    try {
        const { cardNumber, cardHolder, expirationDate, cvv, brand } = req.body;

        const newCard = new Card({
            user: req.params.userId,
            cardNumber,
            cardHolder,
            expirationDate,
            cvv,
            brand
        });

        await newCard.save();
        res.status(201).json({ message: "Cartão adicionado com sucesso!", card: newCard });
    } catch (error) {
        res.status(500).json({ message: "Erro ao adicionar cartão", error });
    }
});

module.exports = router;

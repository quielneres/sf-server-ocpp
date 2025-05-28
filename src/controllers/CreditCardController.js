const { creditCardTransaction } = require('../services/CreditCardService');
const Card = require('../models/Card');
const User = require('../models/User');
const Wallet = require("../models/Wallet");
const Address = require("../models/Address");
const CreditCardTransaction = require("../models/CreditCardTransaction");
const mongoose = require('mongoose');

// Função auxiliar movida para cima para evitar problemas de hoisting
const preparePayload = (amount, creditCard, user, address) => {
    // Extrai mês e ano da data de expiração (formato MM/AA)
    const [exp_month, exp_year] = creditCard.expirationDate.split('/');

    return {
        items: [
            {
                code: `RECARGA_${Date.now()}`,
                amount: Math.round(amount * 100), // Valor em centavos (inteiro)
                description: `Recarga Eletroposto`,
                quantity: 1,
            }
        ],
        customer: {
            name: user.name,
            email: user.email,
            document: user.cpf || '00000000000',
            type: 'individual',
            phones: {
                mobile_phone: {
                    country_code: '55',
                    area_code: user.phone_ddd,
                    number: user.phone_number
                }
            }
        },
        payments: [
            {
                payment_method: "credit_card",
                credit_card: {
                    recurrence_cycle: "first",
                    installments: 1,
                    statement_descriptor: "SOLFORT ELETRO",
                    card: {
                        // number: '4111111111111111',
                        // number: '4000000000000010',
                        number: creditCard.cardNumber.replace(/\s/g, ''),
                        holder_name: creditCard.holderName,
                        exp_month: parseInt(exp_month),
                        exp_year: 30,
                        cvv: creditCard.cvv,
                        billing_address: {
                            line_1: address?.neighborhood || "Av. Paulista, 1000",
                            zip_code: address?.cep || "01311000",
                            city: address?.city || "São Paulo",
                            state: user.state || 'UF',
                            country: 'BR'
                        }
                    }
                }
            }
        ]
    };
};

const creditCardDeposit = async (req, res) => {
    try {
        const { userId, creditCardId, amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "O valor deve ser maior que zero." });
        }

        const user = await User.findOne({ _id: userId });
        if (!user) {
            return res.status(400).json({ message: "Problema ao pesquisar usuário." });
        }

        const creditCard = await Card.findOne({ _id: creditCardId, userId: userId });
        if (!creditCard) {
            return res.status(400).json({ message: 'Problema ao pesquisar Cartão.' });
        }

        const address = await Address.findOne({ userId });
        if (!address) {
            return res.status(400).json({ message: 'Informe um endereço para realizar a transação.' });
        }

        const payload = preparePayload(amount, creditCard, user, address);


        // console.log('payload creditCardTransaction', payload);

        const result = await creditCardTransaction(payload);

        console.log('result creditCardTransaction' ,result);

        if (result.status === 'failed') {
            const transaction = result.charges[0].last_transaction;
            if (transaction.status === 'not_authorized') {
                return res.status(400).json({ message: 'Não autorizado.' });
            }
            return res.status(400).json({ message: 'Problema na transação.' });
        }

        const charge = result.charges[0];
        const transactionId = charge.id;

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, transactions: [] });
        }

        // Após verificar o status da transação
        const transactionRecord = {
            transactionId: charge.id,
            amount,
            type: 'deposit',
            status: charge.status,
            paymentMethod: 'credit_card',
            gatewayResponse: result
        };

        if (charge.status === 'paid') {
            wallet.balance += amount;
        }

        wallet.transactions.push(transactionRecord);
        await wallet.save();

        return {
            status: result.charges[0].status,
            transactionId: result.charges[0].id,
            amount,
            gatewayResponse: result
        };

        // res.json({ message: "Transação realizada com sucesso!", ...result });
    } catch (error) {
        console.error("Erro no CreditCardController.creditCardDeposit:", error.response?.data || error.message);
        res.status(500).json({ message: "Erro na transação. Tente novamente." });
    }
};

const chargeWithCreditCard = async (req, res) => {
    try {
        const { userId, creditCardId, amount } = req.body;

        // Verifique se os IDs são válidos
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'ID de usuário inválido' });
        }
        if (!mongoose.Types.ObjectId.isValid(creditCardId)) {
            return res.status(400).json({ message: 'ID de cartão inválido' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado." });
        }

        const address = await Address.findOne({ user: userId });
        if (!address) {
            return res.status(400).json({ message: 'Informe um endereço para realizar a transação.' });
        }

        // console.log('address 1', address  );
        // return;

        const creditCard = await Card.findOne({ _id: creditCardId, userId: userId });
        if (!creditCard) {
            return res.status(400).json({ message: 'Cartão não encontrado ou não pertence ao usuário.' });
        }

        const payload = preparePayload(amount, creditCard, user, address);
        console.log('payload creditCardTransaction', payload);

        const result = await creditCardTransaction(payload);

        if (result.status === 'failed') {
            const transaction = result.charges[0].last_transaction;
            if (transaction.status === 'not_authorized') {
                return res.status(400).json({ message: 'Transação não autorizada.' });
            }
            return res.status(400).json({ message: 'Falha na transação.' });
        }

        const charge = result.charges[0];

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, transactions: [] });
        }

        // Após verificar o status da transação
        const transactionRecord = {
            transactionId: charge.id,
            amount,
            type: 'deposit',
            status: charge.status,
            paymentMethod: 'credit_card',
            gatewayResponse: result
        };

        if (charge.status === 'paid') {
            wallet.balance += amount;
        }

        wallet.transactions.push(transactionRecord);
        await wallet.save();

        res.json({
            message: "Transação realizada com sucesso!",
            transactionId: charge.id,
            amount: amount
        });
    } catch (error) {
        console.error("Erro no chargeWithCreditCard:", error);
        res.status(500).json({
            message: "Erro na transação",
            error: error.message
        });
    }
};

module.exports = { creditCardDeposit, chargeWithCreditCard };
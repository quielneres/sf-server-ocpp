const { creditCardTransaction } = require('../services/CreditCardService');
const Card = require('../models/Card');
const User = require('../models/User');
const Wallet = require("../models/Wallet");
const CreditCardTransaction = require("../models/CreditCardTransaction");


/**
 * Gera um pagamento via PIX para o usuário.
 * @param {object} req - A requisição Express.
 * @param {object} res - A resposta Express.
 */
const creditCardDeposit = async (req, res) => {
    try {
        const { userId, creditCardId, amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "O valor deve ser maior que zero." });
        }
        const user = await User.findOne({ _id : userId});

        if (!user) {
            return res.status(400).json({ message: "Problema ao pesquisar usuário." });
        }

        const creditCard = await Card.findOne({_id: creditCardId, userId: userId });

        if (!creditCard) {
            return res.status(400).json({ message: 'Problema ao pesquisar Cartão.'});
        }

        const phone = user.phone;
        const areaCode = phone.slice(0, 2);
        const number = phone.slice(2);

        const expirationDate = creditCard.expirationDate;

        if (!/^\d{2}\/\d{4}$/.test(expirationDate)) {
            return res.status(400).json({ message: 'Formato de data de expiração inválido. Use MM/AAAA.'});
        }

        const exp_month = parseInt(expirationDate.slice(0, 2), 10);
        const exp_year = parseInt(expirationDate.slice(-2), 10);

        // Monta o payload para a ordem de pagamento via PIX
        const payload = {
                items: [
                    {
                        amount: amount * 100, // Valor em centavos
                        description: `Recarga Eletroposto`,
                        quantity: 1,
                    }
                ],
                customer: {
                    name: user.name,
                    email: user.email,
                },
                payments: [
                    {
                        payment_method: "credit_card",
                        credit_card: {
                            recurrence_cycle: "first",
                            installments: 1,
                            statement_descriptor: "SolFort Eletropost",
                            card: {
                                number: "4000000000000010",
                                holder_name: creditCard.holderName,
                                exp_month: 1,
                                exp_year: 30,
                                cvv: creditCard.cvv,
                                billing_address: {
                                    line_1: "10880, Malibu Point, Malibu Central",
                                    zip_code: "90265",
                                    city: "Malibu",
                                    state: "CA",
                                    country: "US"
                                }
                            }
                        }
                    }
                ]
            };


        const result = await creditCardTransaction(payload);

        if (result.status === 'failed') {
            const transaction = result.charges[0].last_transaction;

            if (transaction.status === 'not_authorized' ) {
                return res.status(400).json({ message: 'Não autorizado.'});
            }
            return res.status(400).json({ message: 'Problema na transação.'});
        }

        const charge = result.charges[0];
        const transactionId = charge.id;

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, transactions: [] });
        }


        wallet.balance += amount;

        wallet.transactions.push({
            transactionId,
            amount,
            type: 'deposit',
            status: charge.status,
            paymentMethod: 'credit_card'
        });

        await wallet.save();
        console.log("💾 Transação salva no banco de dados.");

        res.json({ message: "Trasação realiza com sucesso!", ...result });
    } catch (error) {
        console.error("Erro no PixController.pixGenerate:", error.response?.data || error.message);
        res.status(500).json({ message: "Erro na transacão. Tente novamente." });
    }
};

const chargeWithCreditCard = async (req, res) => {
    try {
        const { userId, creditCardId,  amount, } = req.body;

        const user = await User.findOne({ _id : userId});

        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado." });
        }

        const creditCard = await Card.findOne({_id: creditCardId, userId: userId });

        if (!creditCard) {
            return res.status(400).json({ message: 'Problema ao pesquisar Cartão.'});
        }

        const payload = preparePayload(amount, creditCard, user);

        const result = await creditCardTransaction(payload);

        if (result.status === 'failed') {
            const transaction = result.charges[0].last_transaction;

            if (transaction.status === 'not_authorized' ) {
                return res.status(400).json({ message: 'Não autorizado.'});
            }
            return res.status(400).json({ message: 'Problema na transação.'});
        }

        const charge = result.charges[0];
        const transactionId = charge.id;
        const transaction = result.charges[0].last_transaction;


        let creditCardTransaction = await new CreditCardTransaction(
            {
                userId,
                creditCardId,
                amount,
                transactions: []
            }
        );

        creditCardTransaction.transactions.push({
            transactionId,
            amount,
            type: 'deposit',
            status: charge.status,
            paymentMethod: 'credit_card'
        });

        await creditCardTransaction.save();

        res.json({ message: "Trasação realizada com sucesso!" });
    } catch (error) {
        console.error("Erro no PixController.pixGenerate:", error.response?.data || error.message);
        res.status(500).json({ message: "Erro na transação. Tente novamente." });
    }
};

const preparePayload = (amount, creditCard, user) => {
    return {
        items: [
            {
                amount: amount * 100, // Valor em centavos
                description: `Recarga Eletroposto`,
                quantity: 1,
            }
        ],
        customer: {
            name: user.name,
            email: user.email,
        },
        payments: [
            {
                payment_method: "credit_card",
                credit_card: {
                    recurrence_cycle: "first",
                    installments: 1,
                    statement_descriptor: "SolFort Eletropost",
                    card: {
                        number: "4000000000000010",
                        holder_name: creditCard.holderName,
                        exp_month: 1,
                        exp_year: 30,
                        cvv: creditCard.cvv,
                        billing_address: {
                            line_1: "10880, Malibu Point, Malibu Central",
                            zip_code: "90265",
                            city: "Malibu",
                            state: "CA",
                            country: "US"
                        }
                    }
                }
            }
        ]
    };
};

module.exports = { creditCardDeposit, chargeWithCreditCard};

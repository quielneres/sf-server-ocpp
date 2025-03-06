const { generatePix } = require('../services/PixService');
const User = require('../models/User');


/**
 * Gera um pagamento via PIX para o usuário.
 * @param {object} req - A requisição Express.
 * @param {object} res - A resposta Express.
 */
const pixGenerate = async (req, res) => {
    try {
        const { userId } = req.params;
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "O valor deve ser maior que zero." });
        }
        const user = await User.findOne({ _id : userId});

        if (!user) {
            return res.status(400).json({ message: "Problema ao pesquisar usuário." });
        }

        const phone = user.phone;
        const areaCode = phone.slice(0, 2);
        const number = phone.slice(2);

        // Monta o payload para a ordem de pagamento via PIX
        const payload = {
            items: [
                {
                    amount: amount * 100, // Valor em centavos
                    description: `Recarga Eletroposto`,
                    quantity: 1,
                },
            ],
            customer: {
                name: user.name,
                email: user.email,
                type: 'individual',
                document: user.cpf,
                phones: {
                    home_phone: {
                        country_code: '55',
                        number: number,
                        area_code: areaCode,
                    },
                },
            },
            payments: [
                {
                    payment_method: 'pix',
                    pix: {
                        expires_in: '3600',
                    },
                },
            ],
        };

        const result = await generatePix(userId, amount, payload);

        res.json({ message: "QRCode gerado com sucesso", ...result });
    } catch (error) {
        console.error("Erro no PixController.pixGenerate:", error.response?.data || error.message);
        res.status(500).json({ message: "Erro ao gerar código PIX. Tente novamente." });
    }
};

module.exports = { pixGenerate };

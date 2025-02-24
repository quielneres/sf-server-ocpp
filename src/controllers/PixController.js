const { generatePix } = require('../services/PixService');

/**
 * Gera um pagamento via PIX para o usuário.
 * @param {object} req - A requisição Express.
 * @param {object} res - A resposta Express.
 */
const pixGenerate = async (req, res) => {
    try {
        const { userId } = req.params;
        const { amount } = req.body;

        // Validação básica
        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "O valor deve ser maior que zero." });
        }

        // Monta o payload para a ordem de pagamento via PIX
        const payload = {
            items: [
                {
                    amount: amount * 100, // Valor em centavos
                    description: `Carregamento - ${userId}`,
                    quantity: 1,
                },
            ],
            customer: {
                name: 'Cliente Teste',
                email: 'cliente@email.com',
                type: 'individual',
                document: '111111111111', // Exemplo; substitua conforme necessário
                phones: {
                    home_phone: {
                        country_code: '55',
                        number: '22180513',
                        area_code: '21',
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

        const result = await generatePix(payload);

        // return res.status(200).;
        res.json({ message: "QRCode gerado com sucesso", ...result });
    } catch (error) {
        console.error("Erro no PixController.pixGenerate:", error.response?.data || error.message);
        res.status(500).json({ message: "Erro ao gerar código PIX. Tente novamente." });
    }
};

module.exports = { pixGenerate };

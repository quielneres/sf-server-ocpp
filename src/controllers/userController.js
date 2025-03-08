const UserService = require('../services/userService');
const User = require('../models/User');

class UserController {
    /**
     * Cadastra um novo usuário.
     * @param {Object} req - Objeto de requisição do Express.
     * @param {Object} res - Objeto de resposta do Express.
     */
    static async register(req, res) {
        try {
            const { name, cpf, email, password, phone, address } = req.body;

            if (!name || !cpf || !email || !password || !phone || !address) {
                return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
            }

            const result = await UserService.registerUser({ name, cpf, email, password, phone, address });

            res.status(201).json(result);
        } catch (error) {
            console.error('Erro ao cadastrar usuário:', error);
            res.status(500).json({ message: error.message || 'Erro ao cadastrar usuário' });
        }
    }

    static async acceptTerms(req, res) {
        try {

            const { userId, acceptedTerms } = req.body;
            const user = await User.findOne({ _id : userId});

            if (!user) {
                return res.status(404).json({ message: 'Usuário nao encontrado' });
            }

            user.termsAccepted = acceptedTerms;
            await user.save();

            res.status(200).json({ success: true, message: 'Termo de uso aceito com sucesso' });
        } catch (error) {
            console.error('Erro ao aceitar termo de uso:', error);
            res.status(500).json({ message: error.message || 'Erro ao aceitar termo de uso' });
        }
    }
}

module.exports = UserController;
const UserService = require('../services/userService');

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
}

module.exports = UserController;
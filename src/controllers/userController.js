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
            const {
                name,
                cpf,
                email,
                password,
                phone_ddd,
                phone_number,
                termsAccepted
            } = req.body;

            // Validação básica dos campos obrigatórios
            const requiredFields = ['name', 'cpf', 'email', 'password', 'phone_ddd', 'phone_number'];
            const missingFields = requiredFields.filter(field => !req.body[field]);

            if (missingFields.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Todos os campos são obrigatórios',
                    missingFields
                });
            }

            // Verifica se os termos foram aceitos
            if (termsAccepted !== true) {
                return res.status(400).json({
                    success: false,
                    message: 'Você deve aceitar os termos de uso'
                });
            }


            const result = await UserService.registerUser({
                name,
                cpf,
                email,
                password,
                phone_ddd,
                phone_number,
                termsAccepted
            });

            return res.status(201).json(result);

        } catch (error) {
            console.error('Erro no UserController:', error);

            return res.status(500).json({
                success: false,
                message: error.message || 'Erro ao cadastrar usuário',
                errorType: error.name || 'InternalServerError'
            });
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

    /**
     * Altera a senha do usuário.
     * @param {Object} req - Objeto de requisição do Express.
     * @param {Object} res - Objeto de resposta do Express.
     */
    static async changePassword(req, res) {
        try {
            const { userId, currentPassword, newPassword } = req.body;

            if (!userId || !currentPassword || !newPassword) {
                return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
            }

            const result = await UserService.changePassword(userId, currentPassword, newPassword);

            res.status(200).json(result);
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            res.status(500).json({ message: error.message || 'Erro ao alterar senha' });
        }
    }

    /**
     * Solicita a recuperação de senha.
     * @param {Object} req - Objeto de requisição do Express.
     * @param {Object} res - Objeto de resposta do Express.
     */
    static async requestPasswordReset(req, res) {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({ message: 'E-mail é obrigatório' });
            }

            const result = await UserService.requestPasswordReset(email);

            res.status(200).json(result);
        } catch (error) {
            console.error('Erro ao solicitar recuperação de senha:', error);
            res.status(500).json({ message: error.message || 'Erro ao solicitar recuperação de senha' });
        }
    }

    /**
     * Redefine a senha do usuário.
     * @param {Object} req - Objeto de requisição do Express.
     * @param {Object} res - Objeto de resposta do Express.
     */
    static async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;

            if (!token || !newPassword) {
                return res.status(400).json({ message: 'Token e nova senha são obrigatórios' });
            }

            const result = await UserService.resetPassword(token, newPassword);

            res.status(200).json(result);
        } catch (error) {
            console.error('Erro ao redefinir senha:', error);
            res.status(500).json({ message: error.message || 'Erro ao redefinir senha' });
        }
    }
}

module.exports = UserController;
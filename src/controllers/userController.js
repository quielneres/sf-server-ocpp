const UserService = require('../services/userService');
const User = require('../models/User');
const UserFavoriteService = require("../services/userFavoriteService");

class UserController {


    static async validatorEmail(req, res) {
        try {
            const user = await User.findOne({email: req.body.email});

            if (!user) {
                return res.status(400).json({ error: 'EMAIL_NOT_FOUND' });
            }

            return res.status(200).json(user);
        } catch (error) {
            console.error('Erro ao buscar usuário por e-mail:', error);
            throw error;
        }
    }

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
                termsAccepted,
                cep,
                city,
                complement,
                neighborhood,
                number,
                state,
                street
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
                termsAccepted,
                cep,
                city,
                complement,
                neighborhood,
                number,
                state,
                street
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
            // const { token, newPassword } = req.body;

            // if (!token || !newPassword) {
            //     return res.status(400).json({ message: 'Token e nova senha são obrigatórios' });
            // }

            const { cpf, email, password }  = req.body;

            if (!cpf || !email || !password) {
                return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
            }

            const result = await UserService.resetPassword( cpf, email, password);

            res.status(200).json(result);
        } catch (error) {
            console.error('Erro ao redefinir senha:', error);
            res.status(500).json({ message: error.message || 'Erro ao redefinir senha' });
        }
    }

    static async update(req, res) {
        try {
            const {userId} = req.params;
            const {name, phone_ddd, phone_number} = req.body;
            const result = await UserService.updateUser(userId, name, phone_ddd, phone_number);
            res.status(200).json(result);
        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
            res.status(500).json({message: error.message || 'Erro ao atualizar usuário'});
        }
    }

    static async favorites(req, res) {
        try {
            const { userId } = req.params;
            const result = await UserFavoriteService.getFavorites(userId);

            if (result.length === 0) {
                return res.status(200).json({ message: 'Nenhum favorito encontrado', favorites: [] });
            }

            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ message: error.message || 'Erro ao buscar favoritos' });
        }
    }
}

module.exports = UserController;
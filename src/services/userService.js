const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

class UserService {
    /**
     * Cadastra um novo usuário.
     * @param {Object} userData - Dados do usuário (name, cpf, email, password, phone, address).
     * @returns {Object} - Objeto com o resultado do cadastro.
     */
    static async registerUser(userData) {
        const { email, cpf } = userData;

        const existingUser = await User.findOne({ $or: [{ email }, { cpf }] });
        if (existingUser) {
            throw new Error('Usuário já cadastrado com este e-mail ou CPF');
        }

        const newUser = new User(userData);
        await newUser.save();

        return { message: 'Usuário cadastrado com sucesso!', user: newUser };
    }

    /**
     * Altera a senha do usuário.
     * @param {string} userId - ID do usuário.
     * @param {string} currentPassword - Senha atual.
     * @param {string} newPassword - Nova senha.
     */
    static async changePassword(userId, currentPassword, newPassword) {
        try {
            // Busca o usuário pelo ID
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('Usuário não encontrado');
            }

            // Verifica se a senha atual está correta
            if (user.password !== currentPassword) { // Aqui, o backend já deve estar criptografando a senha
                throw new Error('Senha atual incorreta');
            }

            // Atualiza a senha do usuário (o backend deve criptografar a nova senha antes de salvar)
            user.password = newPassword;
            await user.save();

            return { success: true, message: 'Senha alterada com sucesso' };
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            throw new Error(error.message || 'Erro ao alterar senha');
        }
    }

    /**
     * Gera um token de recuperação de senha e envia um e-mail ao usuário.
     * @param {string} email - E-mail do usuário.
     */
    static async requestPasswordReset(email) {
        try {
            // Busca o usuário pelo e-mail
            const user = await User.findOne({ email });
            if (!user) {
                throw new Error('Usuário não encontrado');
            }

            // Gera um token de recuperação de senha
            const resetToken = crypto.randomBytes(20).toString('hex');
            const resetTokenExpiry = Date.now() + 3600000; // Token válido por 1 hora

            // Atualiza o usuário com o token e a data de expiração
            user.resetPasswordToken = resetToken;
            user.resetPasswordExpires = resetTokenExpiry;
            await user.save();

            // Envia o e-mail com o link de recuperação
            const resetUrl = `http://seusite.com/reset-password/${resetToken}`;
            await this.sendResetEmail(user.email, resetUrl);

            return { success: true, message: 'E-mail de recuperação enviado com sucesso' };
        } catch (error) {
            console.error('Erro ao solicitar recuperação de senha:', error);
            throw new Error(error.message || 'Erro ao solicitar recuperação de senha');
        }
    }

    /**
     * Redefine a senha do usuário com base no token de recuperação.
     * @param {string} token - Token de recuperação.
     * @param {string} newPassword - Nova senha.
     */
    static async resetPassword(token, newPassword) {
        try {
            // Busca o usuário pelo token e verifica se ele ainda é válido
            const user = await User.findOne({
                resetPasswordToken: token,
                resetPasswordExpires: { $gt: Date.now() },
            });

            if (!user) {
                throw new Error('Token inválido ou expirado');
            }

            // Atualiza a senha do usuário
            user.password = newPassword;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();

            return { success: true, message: 'Senha redefinida com sucesso' };
        } catch (error) {
            console.error('Erro ao redefinir senha:', error);
            throw new Error(error.message || 'Erro ao redefinir senha');
        }
    }

    /**
     * Envia um e-mail com o link de recuperação de senha.
     * @param {string} email - E-mail do usuário.
     * @param {string} resetUrl - URL de recuperação de senha.
     */
    static async sendResetEmail(email, resetUrl) {
        const transporter = nodemailer.createTransport({
            service: 'Gmail', // Use o serviço de e-mail que preferir
            auth: {
                user: process.env.EMAIL_USER, // E-mail do remetente
                pass: process.env.EMAIL_PASS, // Senha do remetente
            },
        });

        const mailOptions = {
            to: email,
            subject: 'Recuperação de Senha',
            text: `Você solicitou a recuperação de senha. Clique no link abaixo para redefinir sua senha:\n\n${resetUrl}\n\nSe você não solicitou isso, ignore este e-mail.`,
        };

        await transporter.sendMail(mailOptions);
    }
}

module.exports = UserService;
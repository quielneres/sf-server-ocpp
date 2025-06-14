const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { hashPassword, comparePassword } = require('../utils/passwordUtils');
const AddressService = require("./AddressService");

class UserService {
    static async registerUser(userData) {
        try {
            const { email, cpf, phone_ddd, phone_number } = userData;

            const existingUser = await User.findOne({
                $or: [
                    { email },
                    { cpf },
                    { phone_ddd, phone_number }
                ]
            });

            if (existingUser) {
                let errorField = '';
                if (existingUser.email === email) errorField = 'e-mail';
                else if (existingUser.cpf === cpf) errorField = 'CPF';
                else errorField = 'telefone';

                throw new Error(`Já existe um usuário cadastrado com este ${errorField}`);
            }

            const hashedPassword = await hashPassword(userData.password);

            const newUser = new User({
                name: userData.name,
                cpf: userData.cpf,
                email: userData.email.toLowerCase(),
                password: hashedPassword,
                phone_ddd: userData.phone_ddd,
                phone_number: userData.phone_number,
                termsAccepted: userData.termsAccepted || false
            });

            await newUser.save();

            await AddressService.createAddress(newUser._id, userData);

            const userToReturn = newUser.toObject();
            delete userToReturn.password;

            return {
                success: true,
                message: 'Usuário cadastrado com sucesso!',
                user: userToReturn
            };

        } catch (error) {
            console.error('Erro no UserService:', error);

            if (error.name === 'ValidationError') {
                const errors = Object.values(error.errors).map(err => err.message);
                throw new Error(`Erro de validação: ${errors.join(', ')}`);
            }

            throw error;
        }
    }

    static async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('Usuário não encontrado');
            }

            const isMatch = await comparePassword(currentPassword, user.password);
            if (!isMatch) {
                throw new Error('Senha atual incorreta');
            }

            user.password = await hashPassword(newPassword);
            await user.save();

            return { success: true, message: 'Senha alterada com sucesso' };
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            throw new Error(error.message || 'Erro ao alterar senha');
        }
    }

    static async requestPasswordReset(email) {
        try {
            const user = await User.findOne({ email });
            if (!user) {
                throw new Error('Usuário não encontrado');
            }

            const resetToken = crypto.randomBytes(20).toString('hex');
            const resetTokenExpiry = Date.now() + 3600000;

            user.resetPasswordToken = resetToken;
            user.resetPasswordExpires = resetTokenExpiry;
            await user.save();

            const resetUrl = `http://seusite.com/reset-password/${resetToken}`;
            await this.sendResetEmail(user.email, resetUrl);

            return { success: true, message: 'E-mail de recuperação enviado com sucesso' };
        } catch (error) {
            console.error('Erro ao solicitar recuperação de senha:', error);
            throw new Error(error.message || 'Erro ao solicitar recuperação de senha');
        }
    }

    static async resetPassword(cpf, email, newPassword) {
        try {
            const user = await User.findOne({ cpf, email });

            if (!user) {
                throw new Error('Usuário não encontrado');
            }

            user.password = await hashPassword(newPassword);
            await user.save();

            return { success: true, message: 'Senha redefinida com sucesso' };
        } catch (error) {
            console.error('Erro ao redefinir senha:', error);
            throw new Error(error.message || 'Erro ao redefinir senha');
        }
    }

    static async sendResetEmail(email, resetUrl) {
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            to: email,
            subject: 'Recuperação de Senha',
            text: `Você solicitou a recuperação de senha. Clique no link abaixo para redefinir sua senha:\n\n${resetUrl}\n\nSe você não solicitou isso, ignore este e-mail.`,
        };

        await transporter.sendMail(mailOptions);
    }

    static async updateUser(userId, userData) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('Usuário não encontrado');
            }

            user.name = userData.name;
            user.phone_ddd = userData.phone_ddd;
            user.phone_number = userData.phone_number;
            await user.save();

            return { success: true, message: 'Usuário atualizado com sucesso' };
        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
            throw new Error(error.message || 'Erro ao atualizar usuário');
        }
    }
}

module.exports = UserService;

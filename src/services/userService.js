const User = require('../models/User');

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
}

module.exports = UserService;
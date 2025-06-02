const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Gera o hash da senha.
 * @param {string} password - Senha em texto puro.
 * @returns {Promise<string>} - Senha criptografada.
 */
const hashPassword = async (password) => {
    return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compara a senha em texto puro com o hash armazenado.
 * @param {string} password - Senha em texto puro.
 * @param {string} hashedPassword - Senha hash armazenada no banco.
 * @returns {Promise<boolean>} - True se as senhas conferem.
 */
const comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

module.exports = { hashPassword, comparePassword };

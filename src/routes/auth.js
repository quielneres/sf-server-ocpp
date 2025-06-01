const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');


/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Cadastra um novo usuário
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - cpf
 *               - email
 *               - password
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *                 example: "João Silva"
 *               cpf:
 *                 type: string
 *                 example: "123.456.789-00"
 *               email:
 *                 type: string
 *                 example: "joao@email.com"
 *               password:
 *                 type: string
 *                 example: "senha123"
 *               phone:
 *                 type: string
 *                 exemple: "61999996666"
 *
 *     responses:
 *       201:
 *         description: Usuário cadastrado com sucesso.
 *       400:
 *         description: Erro de validação.
 */
router.post('/register', async (req, res) => {
    try {
        const { name, cpf, email, password, phone } = req.body;

        // Verifica se o usuário já existe
        const existingUser = await User.findOne({ $or: [{ email }, { cpf }] });
        if (existingUser) {
            return res.status(400).json({ message: "Usuário já cadastrado com este e-mail ou CPF" });
        }


        // Cria novo usuário
        const newUser = new User({
            name,
            cpf,
            email,
            password, // Salva a senha de forma segura
            phone
        });

        await newUser.save();

        res.status(201).json({ message: "Usuário cadastrado com sucesso!" });
    } catch (error) {
        console.error("Erro ao cadastrar usuário:", error);
        res.status(500).json({ message: "Erro ao cadastrar usuário", error: error.message });
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Autentica um usuário
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: "joao@email.com"
 *               password:
 *                 type: string
 *                 example: "senha123"
 *     responses:
 *       200:
 *         description: Login bem-sucedido, retorna o token JWT.
 *       401:
 *         description: Credenciais inválidas.
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: "Usuário não encontrado" });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ message: "Senha incorreta" });
        }

        //validaccao provisoria
        // if ( user.password !== password) {
        //     return res.status(401).json({ message: "Senha incorreta" });
        // }

        res.status(200).json({ message: "Login bem-sucedido", user: user});
    } catch (error) {
        console.error("Erro ao autenticar usuário:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});


/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Retorna a lista de todos os usuários
 *     tags: [Usuários]
 *     responses:
 *       200:
 *         description: Lista de usuários retornada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "João Silva"
 *                   cpf:
 *                     type: string
 *                     example: "123.456.789-00"
 *                   email:
 *                     type: string
 *                     example: "joao@email.com"
 *                   phone:
 *                     type: string
 *                     example: "61999996666"
 *       500:
 *         description: Erro interno do servidor.
 */
router.get('/users', async (req, res) => {
    try {
        // Busca todos os usuários no banco de dados
        const users = await User.find();

        res.status(200).json(users);
    } catch (error) {
        console.error("Erro ao listar usuários:", error);
        res.status(500).json({ message: "Erro ao listar usuários", error: error.message });
    }
});


module.exports = router;

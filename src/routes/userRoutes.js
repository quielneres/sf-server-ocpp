const express = require('express');
const UserController = require('../controllers/userController');

const router = express.Router();

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
 *               - address
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
 *                 example: "61999996666"
 *               address:
 *                 type: string
 *                 example: "QR 01 lote 1 Cidade"
 *     responses:
 *       201:
 *         description: Usuário cadastrado com sucesso.
 *       400:
 *         description: Erro de validação.
 *       500:
 *         description: Erro interno do servidor.
 */
router.post('/register', UserController.register);

router.post('/accept-terms', UserController.acceptTerms);

router.post('/change-password', UserController.changePassword);

router.post('/request-password-reset', UserController.requestPasswordReset);
router.post('/reset-password', UserController.resetPassword);

module.exports = router;
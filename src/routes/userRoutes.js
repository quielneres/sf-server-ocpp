const express = require('express');
const UserController = require('../controllers/userController');

const router = express.Router();

/**
 * @swagger
 * /api/user/register:
 *   post:
 *     summary: Cadastra um novo usuário
 *     tags: [Autenticação]
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
 *               - phone_ddd
 *               - phone_number
 *               - termsAccepted
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 example: "João Silva"
 *               cpf:
 *                 type: string
 *                 pattern: '^\d{3}\.\d{3}\.\d{3}-\d{2}$'
 *                 description: Deve estar no formato 000.000.000-00
 *                 example: "123.456.789-00"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao@email.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "senha123"
 *               phone_ddd:
 *                 type: string
 *                 pattern: '^\d{2}$'
 *                 description: DDD com 2 dígitos
 *                 example: "61"
 *               phone_number:
 *                 type: string
 *                 pattern: '^\d{8,9}$'
 *                 description: Número com 8 ou 9 dígitos
 *                 example: "999998888"
 *               termsAccepted:
 *                 type: boolean
 *                 description: Deve ser true para aceitar os termos
 *                 example: true
 *     responses:
 *       201:
 *         description: Usuário cadastrado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Usuário cadastrado com sucesso!"
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                       description: "(DDD) número"
 *       400:
 *         description: Erro de validação ou termos não aceitos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Você deve aceitar os termos de uso"
 *                 missingFields:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["phone_ddd"]
 *       409:
 *         description: Conflito - Usuário já cadastrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Já existe um usuário cadastrado com este e-mail"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Erro ao processar o cadastro"
 *                 errorType:
 *                   type: string
 *                   example: "InternalServerError"
 */
router.post('/register', UserController.register);

router.post('/update/:userId', UserController.update);

router.post('/accept-terms', UserController.acceptTerms);

router.post('/change-password', UserController.changePassword);

router.post('/request-password-reset', UserController.requestPasswordReset);
router.post('/reset-password', UserController.resetPassword);

module.exports = router;
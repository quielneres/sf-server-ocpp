const express = require('express');
const router = express.Router();
const AddressController = require('../controllers/AddressController');
// const authMiddleware = require('../middlewares/auth');
//
// // Middleware de autenticação
// router.use(authMiddleware);

// Busca CEP (GET /api/addresses/cep?cep=00000-000)
router.get('/cep', AddressController.searchCEP);

// CRUD de Endereços
router.post('/:userId', AddressController.create); // POST /api/addresses/:userId
router.get('/:userId', AddressController.list);    // GET /api/addresses/:userId
router.put('/:userId/:id', AddressController.update);
router.patch('/:userId/:id/primary', AddressController.setPrimary);
router.delete('/:userId/:id', AddressController.delete);
module.exports = router;
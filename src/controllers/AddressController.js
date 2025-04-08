const AddressService = require('../services/AddressService');

class AddressController {
    static async searchCEP(req, res) {
        try {
            const { cep } = req.query;
            if (!cep) {
                return res.status(400).json({ error: 'CEP é obrigatório' });
            }

            const addressData = await AddressService.searchCEP(cep);
            res.json(addressData);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async create(req, res) {

        const { userId } = req.params;

        try {
            const address = await AddressService.createAddress(userId, req.body);
            res.status(201).json(address);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async update(req, res) {
        const { userId } = req.params;

        try {
            const address = await AddressService.updateAddress(
                userId,
                req.params.id,
                req.body
            );

            if (!address) {
                return res.status(404).json({ error: 'Endereço não encontrado' });
            }

            res.json(address);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async list(req, res) {
        try {
            const { userId } = req.params;

            const addresses = await AddressService.listAddresses(userId);
            res.json(addresses);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async setPrimary(req, res) {
        try {
            const address = await AddressService.setPrimaryAddress(
                req.user._id,
                req.params.id
            );

            if (!address) {
                return res.status(404).json({ error: 'Endereço não encontrado' });
            }

            res.json(address);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    static async delete(req, res) {
        try {
            const result = await AddressService.deleteAddress(
                req.user._id,
                req.params.id
            );

            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Endereço não encontrado' });
            }

            res.status(204).end();
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}

module.exports = AddressController;
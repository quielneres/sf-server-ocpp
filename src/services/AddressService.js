const Address = require('../models/Address');
const axios = require('axios');

class AddressService {
    static async searchCEP(cep) {
        try {
            const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);

            if (response.data.erro) {
                throw new Error('CEP não encontrado');
            }

            return {
                cep: response.data.cep,
                state: response.data.uf,
                city: response.data.localidade,
                neighborhood: response.data.bairro,
                street: response.data.logradouro
            };
        } catch (error) {
            console.error('CEP Service Error:', error);
            throw new Error('Falha ao buscar CEP');
        }
    }

    static async createAddress(userId, addressData) {

        try {
            const address = new Address({
                user: userId,
                ...addressData
            });

            // Se for o primeiro endereço, define como primário
            const count = await Address.countDocuments({ user: userId });
            if (count === 0) {
                address.isPrimary = true;
            }

            return await address.save();
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async updateAddress(userId, addressId, addressData) {
        try {
            return await Address.findOneAndUpdate(
                { _id: addressId, user: userId },
                addressData,
                { new: true, runValidators: true }
            );
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async listAddresses(userId) {
        return await Address.find({ user: userId }).sort({ isPrimary: -1, createdAt: 1 });
    }

    static async setPrimaryAddress(userId, addressId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Remove primary status from all addresses
            await Address.updateMany(
                { user: userId },
                { $set: { isPrimary: false } },
                { session }
            );

            // Set new primary address
            const address = await Address.findOneAndUpdate(
                { _id: addressId, user: userId },
                { $set: { isPrimary: true } },
                { new: true, session }
            );

            await session.commitTransaction();
            return address;
        } catch (error) {
            await session.abortTransaction();
            throw this.handleError(error);
        } finally {
            session.endSession();
        }
    }

    static async deleteAddress(userId, addressId) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const address = await Address.findOne({ _id: addressId, user: userId });

            if (!address) {
                throw new Error('Endereço não encontrado');
            }

            const result = await Address.deleteOne({ _id: addressId, user: userId }, { session });

            // If deleted address was primary, set another as primary
            if (address.isPrimary) {
                const anotherAddress = await Address.findOne({ user: userId }, null, { session });
                if (anotherAddress) {
                    anotherAddress.isPrimary = true;
                    await anotherAddress.save({ session });
                }
            }

            await session.commitTransaction();
            return result;
        } catch (error) {
            await session.abortTransaction();
            throw this.handleError(error);
        } finally {
            session.endSession();
        }
    }

    static handleError(error) {
        console.error('Address Service Error:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return new Error(messages.join(', '));
        }

        return error;
    }
}

module.exports = AddressService;
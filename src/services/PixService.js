const axios = require('axios');
const {Buffer} = require("buffer");
const Wallet = require('../models/Wallet');

const API_BASE_URL = process.env.API_BASE_URL;
const PAGARME_API_KEY = process.env.PAGARME_API_KEY;

/**
 * Gera uma ordem de pagamento via PIX usando a API do Pagar.me.
 * @param {object} payload - Os dados da ordem (amount, customer, etc.).
 * @returns {Promise<object>} - Retorna um objeto com o QR Code, valor formatado e data de expiração.
 */
const generatePix = async (userId, amount, payload) => {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/orders`,
            payload,
            {
                headers: {
                    Authorization: 'Basic ' + Buffer.from(`${PAGARME_API_KEY}:`).toString('base64'),
                    'Content-Type': 'application/json'
                }
            }
        );

        const charge = response.data.charges[0];
        const transaction = charge.last_transaction;

        // 🔹 Extrai os dados necessários
        const transactionId = charge.id;
        const qrCode = transaction.qr_code;
        const paymentAmount = (charge.amount / 100).toFixed(2).replace('.', ',');
        const expiration = new Date(transaction.expires_at).toLocaleString("pt-BR");

        console.log(`✅ PIX Criado com sucesso. Transaction ID: ${transactionId}`);

        // 🔹 Salva no banco de dados
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, transactions: [] });
        }


        wallet.transactions.push({
            transactionId,
            amount,
            type: 'deposit',
            status: charge.status,
            paymentMethod: 'pix'
        });

        await wallet.save();
        console.log("💾 Transação salva no banco de dados.");

        return response.data.valueOf();

    } catch (error) {
        console.error("Erro no PixService.generatePix:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Consulta o status de uma transação no Pagar.me
 * @param {string} transactionId - ID da transação no Pagar.me
 * @returns {Promise<{status: *, data: any}>} - Status da transação ("pending", "paid", "failed")
 */
const checkTransactionStatus = async (transactionId) => {
    try {
        const response = await axios.get(
            `${API_BASE_URL}/charges/${transactionId}`,
            {
                headers: {
                    Authorization: 'Basic ' + Buffer.from(`${PAGARME_API_KEY}:`).toString('base64'),
                    'Content-Type': 'application/json'
                }
            }
        );

        return {status: status, data: response.data};
    } catch (error) {
        console.error("❌ Erro ao verificar status do pagamento:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Atualiza o status da transação no banco de dados
 * @param {string} userId - ID do usuário
 * @param {string} transactionId - ID da transação
 * @returns {Promise<{status: *, data: *}>} - Retorna true se a transação foi confirmada
 */
const updateTransactionStatus = async (userId, transactionId) => {
    try {

        const wallet = await Wallet.findOne({ userId });
        if (!wallet) return false;

        const transaction = wallet.transactions.find(tx => tx.transactionId === transactionId);
        if (!transaction) return false;

        const transactionDetail = await checkTransactionStatus(transactionId);
        const status = transactionDetail.status;

        transaction.status = status;
        transaction.updatedAt = new Date();

        // Se foi pago, adiciona o saldo ao usuário
        if (status === 'paid') {
            wallet.balance += transaction.amount;
        }

        await wallet.save();
        console.log(`✅ Transação ${transactionId} atualizada para ${status}`);
        return transactionDetail;
    } catch (error) {
        console.error("❌ Erro ao atualizar transação:", error.message);
        return false;
    }
};

module.exports = {generatePix, checkTransactionStatus, updateTransactionStatus };


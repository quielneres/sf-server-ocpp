// migrate-chargers.js

const mongoose = require('mongoose');
require('dotenv').config();

const Charger = require('./src/models/Charger'); // ajuste o caminho conforme sua estrutura

const startMigration = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Conectado ao MongoDB');

        const chargers = await Charger.find();

        for (const charger of chargers) {
            if (!charger.connectors || charger.connectors.length === 0) {
                // Supondo que cada carregador tem 1 conector inicialmente
                charger.connectors = [
                    {
                        connectorId: 1,
                        status: charger.status || 'Available',
                        currentTransactionId: null,
                        lastStatusTimestamp: charger.lastHeartbeat || new Date()
                    }
                ];

                // Opcional: resetar o status geral, ou deixar para ser calculado dinamicamente
                charger.status = undefined;

                await charger.save();
                console.log(`🔧 Atualizado carregador: ${charger.serialNumber}`);
            }
        }

        console.log('✅ Migração concluída com sucesso!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro durante a migração:', err);
        process.exit(1);
    }
};

startMigration();

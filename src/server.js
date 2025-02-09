const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const OCPPServer = require('./ocpp/OCPPServer');
const chargersRouter = require('./routes/chargers');
const swaggerDocs = require('./utils/swagger');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
app.use(express.json());

// Conectar ao MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log(' MongoDB conectado'))
    .catch(err => console.error(' Erro ao conectar no MongoDB:', err));

// Iniciar Servidor OCPP
const ocppServer = new OCPPServer();
app.set('ocppServer', ocppServer);

global.ocppClients = new Map();
global.activeTransactions = new Map();


// Rotas REST API
// app.use('/api/chargers', chargersRouter);
//
// const chargingRoutes = require('./routes/charging');
// app.use('/api/charging', chargingRoutes);

const transactionRoutes = require('./routes/transactions');

app.use('/api/auth', require('./routes/auth'));

app.use('/api/chargers', require('./routes/chargers'));
app.use('/api/transactions', transactionRoutes);

app.use('/api/charging', require('./routes/charging'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/cards', require('./routes/cards'));
app.use('/api/cars', require('./routes/cars'));



//Documentação Swagger
swaggerDocs(app);

app.listen(PORT, "0.0.0.0",() => {
    console.log(`API REST rodando em http://localhost:${PORT}`);
});

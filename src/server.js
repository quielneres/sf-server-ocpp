const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const OCPPServer = require('./ocpp/OCPPServer');
const chargersRouter = require('./routes/chargers');
const swaggerDocs = require('./utils/swagger');
// const startConsumer = require("./consumers/meterValuesConsumer");
const { startConsumer } = require("./consumers/meterValuesConsumer"); // 🔹 Corrigir importação

dotenv.config();

const app = express();
// const PORT = process.env.PORT || 80;
const PORT = 4000;
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
// startConsumer();

global.ocppClients = new Map();
global.activeTransactions = new Map();

// Rotas REST API
// app.use('/api/chargers', chargersRouter);
//
// const chargingRoutes = require('./routes/charging');
// app.use('/api/charging', chargingRoutes);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/userRoutes'));
app.use('/api/chargers', require('./routes/chargers'));
app.use('/api/transactions', require('./routes/transactions'));

app.use('/api/charging', require('./routes/charging'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/cards', require('./routes/cardRoutes'));
app.use('/api/cars', require('./routes/cars'));
app.use('/api/pix', require('./routes/pix'));

const logsRouter = require("./routes/logs"); // 🔹 Agora importa corretamente
app.use("/api/logs", logsRouter); // 🔹 Agora funciona sem erro



//Documentação Swagger
swaggerDocs(app);

// console.log('RABBITMQ_URL',process.env.RABBITMQ_URL)

app.listen(PORT, "0.0.0.0",() => {
    console.log(`API REST rodando em ${process.env.OCPP_URL}`);
});

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const OCPPServer = require('./ocpp/OCPPServer');
const chargersRouter = require('./routes/chargers');
const swaggerDocs = require('./utils/swagger');
// const startConsumer = require("./consumers/meterValuesConsumer");
const { startConsumer } = require("./consumers/meterValuesConsumer"); // 🔹 Corrigir importação
const path = require('path');

dotenv.config();
const cors = require('cors');

const app = express();
// const PORT = process.env.PORT || 80;
const PORT = 4000;
app.use(express.json({ type: '*/*' }));
app.use(cors({
    origin: '*', // ou: ['http://localhost:19006'] para restringir
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Conectar ao MongoDB
mongoose.connect(process.env.MONGO_URI)
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

const addressRoutes = require('./routes/addressRoutes');
app.use('/api/addresses', addressRoutes);


// Rota do Webhook da Pagar.me
app.use('/webhooks', require('./routes/webhookRoutes'));



const logsRouter = require("./routes/logs"); // 🔹 Agora importa corretamente
app.use("/api/logs", logsRouter); // 🔹 Agora funciona sem erro


//======================================FRONTEND============================================================

app.use(express.static(path.join(__dirname, '../public')));

// // Rota opcional para acessar como /termo
app.get('/termo-de-uso', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/terms.html'));
});

app.get('/politica-de-privacidade', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/privacy-policy.html'));
});


app.use(express.static(path.join(__dirname, '../public/site')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/site/index.html'));
});

app.get('/solicitar-exclusao', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/site/delete-account.html'));
});

app.get('/resetar-senha', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/site/reset-pass.html'));
});


// app.get('/dashboard', (req, res) => {
//     res.sendFile(path.join(__dirname, '../public/dist/index.html'));
// });

//Documentação Swagger
swaggerDocs(app);

// console.log('RABBITMQ_URL',process.env.RABBITMQ_URL)

app.listen(PORT, "0.0.0.0",() => {
    console.log(`API REST rodando em ${process.env.OCPP_URL}`);
});

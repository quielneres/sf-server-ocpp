const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "OCPP Server API",
            version: "1.0.0",
            description: "API para gerenciamento de carregadores elétricos com OCPP",
        },
        servers: [
            { url: "https://sf-server-occp-env.up.railway.app" }
        ]
    },
    apis: ["./src/routes/*.js"] // Importa automaticamente a documentação das rotas
};

const swaggerSpec = swaggerJsdoc(options);

function swaggerDocs(app) {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    console.log(`📄 Swagger UI disponível emhttps://sf-server-occp-env.up.railway.app/api-docs`);
}

module.exports = swaggerDocs;

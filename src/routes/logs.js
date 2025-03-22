const express = require("express");
const router = express.Router();

let logs = []; // Buffer de logs temporários

// Endpoint para buscar logs
router.get("/", (req, res) => {
    res.json({ logs }); // Retorna todos os logs armazenados
    logs = []; // Limpa os logs depois de enviados
});

// Função para adicionar logs ao buffer
function addLog(log) {
    logs.push(log);
}

// 🔹 Corrige a exportação
module.exports = router;
module.exports.addLog = addLog;

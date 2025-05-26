require('dotenv').config();
const express = require('express');
const app = express();
const PORT = 3000;


app.use(express.static('public/meu-frontend'));

// Backend (Node.js)
app.get('/api/chave-google', (req, res) => {
  res.json({ apiKey: process.env.GOOGLE_API_KEY }); // Retorna JSON válido
});

// Rota simples na raiz só pra garantir
app.get('/', (req, res) => {
  res.send('Olá, backend rodando!');
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

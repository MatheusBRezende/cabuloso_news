require('dotenv').config();
const express = require('express');
const app = express();
const PORT = 3000;


app.use(express.static('public/meu-frontend'));

// Rota da API para a chave
app.get('/api/dados', (req, res) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  res.json({ message: 'Chave acessada com sucesso!', apiKey });
});

// Rota simples na raiz só pra garantir
app.get('/', (req, res) => {
  res.send('Olá, backend rodando!');
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

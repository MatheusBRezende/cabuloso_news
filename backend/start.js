require('dotenv').config({ path: 'api.env' }); // localmente, carrega o api.env
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/chave-google', (req, res) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave da API não definida' });
  }
  res.json({ apiKey });
});

app.use(express.static('../frontend'));

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
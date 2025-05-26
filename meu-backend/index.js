
require('dotenv').config();
const express = require('express');
const path = require('path');  // Adicione esta linha
const app = express();
const PORT = process.env.PORT || 3000;

// Configuração correta para arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Sua rota de API deve vir ANTES do static
app.get('/api/chave-google', (req, res) => {
  if (!process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ error: "Chave API não configurada" });
  }
  res.json({ apiKey: process.env.GOOGLE_API_KEY });
});

// Rota fallback para SPA (opcional)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
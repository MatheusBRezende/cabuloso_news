require('dotenv').config({ path: 'api.env' });
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());

// Configurações da API de Futebol
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || 'fe5750cb72254a9ab625ba3203905a97';

// Rota para a chave do Google (mantida do original)
app.get('/api/chave-google', (req, res) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave da API não definida' });
  }
  res.json({ apiKey });
});

// Nova rota para dados de futebol (do server.js)
app.get('/campeonatos', async (req, res) => {
  try {
    const response = await axios.get('http://api.football-data.org/v4/teams/1771/matches', {
      headers: {
        'X-Auth-Token': FOOTBALL_API_KEY
      }
    });

    if (!response.data) {
      throw new Error('Resposta vazia da API de futebol');
    }

    res.json(response.data.matches);

  } catch (err) {
    console.error('Erro ao buscar dados do campeonato:', err);
    res.status(500).json({ 
      error: 'Erro ao buscar dados',
      details: err.message
    });
  }
});

// Servir arquivos estáticos (mantido do original)
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Rota fallback para SPA (mantida do original)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
require('dotenv').config({ path: 'api.env' }); 

const express = require('express');
const path = require('path'); 
const app = express();
const PORT = process.env.PORT || 3000;

// Rota da API
app.get('/api/chave-google', (req, res) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave da API não definida' });
  }
  res.json({ apiKey });
});


const frontendPath = path.join(__dirname, '../frontend/public'); 
app.use(express.static(frontendPath));


app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
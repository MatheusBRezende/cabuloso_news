require('dotenv').config({ path: 'api.env' });
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(cors());

// Rotas
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Arquivos estáticos
app.use(express.static('../frontend/public'));

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
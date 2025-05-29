const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

let noticiasCache = [];
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1 minuto

async function fetchNoticiasUOL() {
  const { data: html } = await axios.get('https://zeiro.com.br/noticias-do-cruzeiro/');
  const $ = cheerio.load(html);
  const noticias = [];

  // Seleciona apenas os links de notícia dentro dos blocos de notícias
  $('.results-items a').each((i, el) => {
    const title = $(el).find('.thumb-title').text().trim();
    const url = $(el).attr('href');
    const image = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
    const date = $(el).find('.thumb-date').text().trim();

    if (title && url && image) {
      noticias.push({
        title,
        url: url.startsWith('http') ? url : `https://zeiro.com.br${url}`,
        description: date,
        image
      });
    }
  });

  return noticias;
}

app.get('/api/noticias-espn', async (req, res) => {
  try {
    const now = Date.now();
    if (noticiasCache.length > 0 && now - cacheTimestamp < CACHE_TTL) {
      return res.json(noticiasCache);
    }
    const noticias = await fetchNoticiasUOL();
    noticiasCache = noticias;
    cacheTimestamp = now;
    res.json(noticias);
  } catch (err) {
    console.error("Erro no scraping UOL:", err);
    res.status(500).json({
      error: 'Erro ao buscar notícias',
      details: err && err.message ? err.message : String(err)
    });
  }
});

app.get('/api/chave-google', (req, res) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  res.json({ apiKey: apiKey || 'not-set' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
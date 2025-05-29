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

async function fetchNoticiasZeiro() {
  const { data: html } = await axios.get('https://zeiro.com.br/noticias-do-cruzeiro/');
  const $ = cheerio.load(html);
  const noticias = [];

  $('.archive-column__top').each((i, el) => {
    const title = $(el).find('.archive-column__heading a').text().trim();
    const url = $(el).find('.archive-column__heading a').attr('href');
    const date = $(el).find('.grid-news__list-item_date').text().trim();

    // Busca o próximo .archive-column__media a partir do elemento atual
    let image = null;
    let next = $(el).next();
    while (next.length && !next.hasClass('archive-column__media')) {
      next = next.next();
    }
    if (next.length && next.hasClass('archive-column__media')) {
      image = next.find('img').attr('src') || null;
    }

    if (title && url && image) {
      noticias.push({
        title,
        url,
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
    const noticias = await fetchNoticiasZeiro();
    noticiasCache = noticias;
    cacheTimestamp = now;
    res.json(noticias);
  } catch (err) {
    console.error("Erro no scraping Zeiro:", err);
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
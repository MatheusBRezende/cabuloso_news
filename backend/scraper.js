const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.static(path.join(__dirname, '../frontend/public')));

let noticiasCache = [];
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1 minuto

// ========== SCRAPER ZEIRO ==========
async function fetchNoticiasZeiro() {
  console.log('Iniciando scraping do Zeiro...');
  const { data: html } = await axios.get('https://zeiro.com.br/noticias-do-cruzeiro/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });
  const $ = cheerio.load(html);
  const noticias = [];

  $('.archive-column__top').each((i, el) => {
    const title = $(el).find('.archive-column__heading a').text().trim();
    const url = $(el).find('.archive-column__heading a').attr('href');
    const date = $(el).find('.grid-news__list-item_date').text().trim();

    // Busca o próximo .archive-column__media para a imagem
    let image = null;
    let next = $(el).next();
    while (next.length && !next.hasClass('archive-column__media')) {
      next = next.next();
    }
    if (next.length && next.hasClass('archive-column__media')) {
      image = next.find('img').attr('data-src')
        || next.find('img').attr('src')
        || (() => {
          const srcset = next.find('source').attr('srcset');
          if (srcset) return srcset.split(',')[0].split(' ')[0];
          return null;
        })();
    }

    if (title && url && image) {
      noticias.push({
        fonte: 'Zeiro',
        title,
        url,
        description: date,
        image
      });
    }
  });

  console.log(`Zeiro: Encontradas ${noticias.length} notícias.`);
  if (noticias.length > 0) {
    console.log('Primeira notícia Zeiro:', noticias[0]);
  }
  return noticias;
}

// ========== UNIFICAÇÃO DAS FONTES ==========
async function fetchNoticiasTodasFontes() {
  const zeiro = await fetchNoticiasZeiro();
  console.log(`Total de notícias: ${zeiro.length}`);
  return zeiro.sort(() => Math.random() - 0.5);
}

// ========== ROTA PRINCIPAL DINÂMICA ==========
app.get('/api/noticias-espn', async (req, res) => {
  try {
    const now = Date.now();
    const fonte = req.query.fonte;

    let noticias = [];
    if (fonte === 'zeiro') {
      noticias = await fetchNoticiasZeiro();
      console.log('Retornando apenas notícias do Zeiro');
    } else {
      if (noticiasCache.length > 0 && now - cacheTimestamp < CACHE_TTL) {
        return res.json(noticiasCache);
      }
      noticias = await fetchNoticiasTodasFontes();
      noticiasCache = noticias;
      cacheTimestamp = now;
      console.log('Retornando notícias do Zeiro');
    }
    res.json(noticias);
  } catch (err) {
    console.error("Erro no scraping:", err);
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
  res.sendFile(path.join(__dirname, '../frontend/public', 'index.html'));
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
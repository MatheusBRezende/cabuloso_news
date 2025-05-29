const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const path = require('path');
const app = express();

// Configurações
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Cache de notícias
let noticiasCache = [];
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1 minuto

// Função para abrir o navegador (Puppeteer)
const getBrowser = async () => {
  const options = {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--single-process'
    ],
    headless: 'new'
  };

  // Tenta caminhos alternativos para o Chrome/Chromium
  const paths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable'
  ].filter(Boolean);

  for (const executablePath of paths) {
    try {
      return await puppeteer.launch({ ...options, executablePath });
    } catch (e) {
      console.log(`Não encontrado em ${executablePath}, tentando próximo...`);
    }
  }
  // Fallback final
  return await puppeteer.launch(options);
};

// Função para buscar notícias da ESPN do Cruzeiro
async function fetchNoticiasESPN() {
  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.goto('https://www.espn.com.br/futebol/time/_/id/2022/cruzeiro', {
      waitUntil: 'networkidle2',
      timeout: 20000
    });
    const html = await page.content();
    const $ = cheerio.load(html);
    const noticias = [];
    $('article.contentItem').each((i, el) => {
      const a = $(el).find('a.AnchorLink').first();
      const title = a.find('.contentItem__title').text().trim();
      const url = a.attr('href') || '';
      const description = a.find('.contentItem__subhead').text().trim();
      let image = $(el).find('figure source').first().attr('srcset') ||
                  $(el).find('figure img').first().attr('src') ||
                  $(el).find('img').first().attr('src');
      if (title && url) {
        noticias.push({
          title,
          url: url.startsWith('http') ? url : `https://www.espn.com.br${url}`,
          description,
          image: image || null
        });
      }
    });
    return noticias;
  } finally {
    if (browser) await browser.close();
  }
}

// Rota da API de notícias (com cache)
app.get('/api/noticias-espn', async (req, res) => {
  try {
    const now = Date.now();
    if (noticiasCache.length > 0 && now - cacheTimestamp < CACHE_TTL) {
      return res.json(noticiasCache);
    }
    const noticias = await fetchNoticiasESPN();
    noticiasCache = noticias;
    cacheTimestamp = now;
    res.json(noticias);
  } catch (err) {
    console.error("Erro no scraper:", err);
    res.status(500).json({
      error: 'Erro ao buscar notícias',
      details: process.env.NODE_ENV === 'development' ? err.message : null
    });
  }
});

// Rota para a chave da API do Google
app.get('/api/chave-google', (req, res) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  res.json({ apiKey: apiKey || 'not-set' });
});

// Rota principal (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
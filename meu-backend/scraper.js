const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const app = express();

app.use(cors());

// Configurações otimizadas para o Render
const puppeteerOptions = {
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process'
  ],
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser'
};

app.get('/api/noticias-espn', async (req, res) => {
  let browser;
  try {
    browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();
    
    // Configurações adicionais para evitar bloqueios
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });
    
    await page.goto('https://www.espn.com.br/futebol/time/_/id/2022/cruzeiro', { 
      waitUntil: 'networkidle2',
      timeout: 30000
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

    res.json(noticias);
  } catch (err) {
    console.error("Erro detalhado no scraper:", err);
    res.status(500).json({ 
      error: 'Erro ao buscar notícias da ESPN',
      details: err.message // Adiciona detalhes do erro
    });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
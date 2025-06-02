const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const app = express();

// Configuração inicial de middlewares
app.use(cors({
  origin: 'http://localhost:3000', // ou qual for seu frontend
  optionsSuccessStatus: 200
}));
app.use(express.json());
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

// ========== SCRAPER UOL ==========
async function fetchNoticiasUOL() {
  console.log('Iniciando scraping do UOL...');
  const { data: html } = await axios.get('https://www.uol.com.br/esporte/futebol/times/cruzeiro/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });
  const $ = cheerio.load(html);
  const noticias = [];

  $('a:has(.thumb-title)').each((i, el) => {
    const title = $(el).find('.thumb-title').text().trim();
    const url = $(el).attr('href');
    const image = $(el).find('img').attr('data-src')
      || $(el).find('img').attr('src')
      || (() => {
        const srcset = $(el).find('source').attr('srcset');
        if (srcset) return srcset.split(',')[0].split(' ')[0];
        return null;
      })();
    const date = $(el).find('.thumb-date').text().trim();

    if (title && url && image) {
      noticias.push({
        fonte: 'UOL',
        title,
        url: url.startsWith('http') ? url : `https://www.uol.com.br${url}`,
        description: date,
        image
      });
    }
  });

  console.log(`UOL: Encontradas ${noticias.length} notícias.`);
  if (noticias.length > 0) {
    console.log('Primeira notícia UOL:', noticias[0]);
  }
  return noticias;
}

// ========== UNIFICAÇÃO DAS FONTES ==========
async function fetchNoticiasTodasFontes() {
  const [zeiro, uol] = await Promise.all([
    fetchNoticiasZeiro(),
    fetchNoticiasUOL()
  ]);
  const todas = [...zeiro, ...uol];
  console.log(`Total de notícias unificadas: ${todas.length}`);
  return todas.sort(() => Math.random() - 0.5);
}

// ========== ROTAS PARA ESPN ==========
// Estas rotas devem vir ANTES do app.get('*')
app.get('/api/espn/jogo-ao-vivo', async (req, res) => {
  try {
    console.log("Rota acessada diretamente");
    const jogoId = await fetchJogoAoVivoCruzeiro();
    res.json({ jogoId });
  } catch (err) {
    console.error("Erro ao buscar jogo ao vivo:", err);
    res.status(500).json({ 
      error: 'Erro ao buscar jogo ao vivo',
      details: err.message
    });
  }
});

app.get('/api/espn/minuto-a-minuto/:jogoId', async (req, res) => {
  try {
    const comentarios = await fetchMinutoAMinuto(req.params.jogoId);
    res.json(comentarios);
  } catch (err) {
    console.error("Erro ao buscar minuto a minuto:", err);
    res.status(500).json({ error: 'Erro ao buscar minuto a minuto' });
  }
});

app.get('/api/espn/estatisticas/:jogoId', async (req, res) => {
  try {
    const estatisticas = await fetchEstatisticasJogo(req.params.jogoId);
    res.json(estatisticas);
  } catch (err) {
    console.error("Erro ao buscar estatísticas:", err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// Rota para testar com o jogoID específico (732696)
app.get('/api/espn/teste-jogo', async (req, res) => {
  try {
    const jogoId = '732696'; // ID do jogo para teste
    const [comentarios, estatisticas] = await Promise.all([
      fetchMinutoAMinuto(jogoId),
      fetchEstatisticasJogo(jogoId)
    ]);
    
    res.json({
      jogoId,
      comentarios,
      estatisticas
    });
  } catch (err) {
    console.error("Erro no teste do jogo:", err);
    res.status(500).json({ error: 'Erro no teste do jogo' });
  }
});

// ========== ROTA PRINCIPAL DINÂMICA ==========
app.get('/api/noticias-espn', async (req, res) => {
  try {
    const now = Date.now();
    const fonte = req.query.fonte;

    let noticias = [];
    if (fonte === 'zeiro') {
      noticias = await fetchNoticiasZeiro();
      console.log('Retornando apenas notícias do Zeiro');
    } else if (fonte === 'uol') {
      noticias = await fetchNoticiasUOL();
      console.log('Retornando apenas notícias do UOL');
    } else {
      if (noticiasCache.length > 0 && now - cacheTimestamp < CACHE_TTL) {
        return res.json(noticiasCache);
      }
      noticias = await fetchNoticiasTodasFontes();
      noticiasCache = noticias;
      cacheTimestamp = now;
      console.log('Retornando notícias de todas as fontes');
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

// Fallback para servir o frontend - DEVE SER A ÚLTIMA ROTA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public', 'index.html'));
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

// ========== SCRAPER ESPN - JOGO AO VIVO ==========
async function fetchJogoAoVivoCruzeiro() {
  console.log('Buscando jogo ao vivo do Cruzeiro na ESPN...');
  
  // Permitir testar com jogoID fixo
  const jogoTesteId = '732696'; // Seu jogoID de teste
  if (process.env.NODE_ENV === 'development') {
    console.log(`Modo desenvolvimento - usando jogoID fixo: ${jogoTesteId}`);
    return jogoTesteId;
  }

  try {
    const url = 'https://www.espn.com.br/futebol/time/calendario/_/id/2022/bra.cruzeiro';
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const livePattern = /<div class="Schedule__live[^>]*><a[^>]*href="\/futebol\/partida\/_\/jogoId\/(\d+)/;
    const match = html.match(livePattern);
    
    if (!match) {
      console.log('Nenhum jogo ao vivo encontrado');
      return null;
    }

    const jogoId = match[1];
    console.log(`Jogo ao vivo encontrado - ID: ${jogoId}`);
    return jogoId;
    
  } catch (e) {
    console.error(`Erro ao buscar jogo ao vivo: ${e.toString()}`);
    return null;
  }
}

// ========== SCRAPER ESPN - MINUTO A MINUTO ==========
async function fetchMinutoAMinuto(jogoId) {
  console.log(`Buscando minuto a minuto para jogo ID: ${jogoId}`);
  try {
    const url = `https://www.espn.com.br/futebol/comentario/_/jogoId/${jogoId}`;
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(html);
    const comentarios = [];

    // Verifica se estamos pegando todos os comentários
    $('tr.Table__TR').each((i, el) => {
      const tempo = $(el).find('.MatchCommentary__Comment__Timestamp span').text().trim();
      const texto = $(el).find('.MatchCommentary__Comment__GameDetails span').text().trim();
      
      if (texto) {
        comentarios.push(`${tempo} ${texto}`);
      }
    });

    console.log('Primeiros 5 comentários:', comentarios.slice(0, 5));
    console.log('Últimos 5 comentários:', comentarios.slice(-5));
    console.log(`Total de comentários encontrados: ${comentarios.length}`);
    
    return comentarios;
    
  } catch (e) {
    console.error(`Erro ao buscar minuto a minuto: ${e.toString()}`);
    return [];
  }
}

// ========== SCRAPER ESPN - ESTATÍSTICAS ==========
async function fetchEstatisticasJogo(jogoId) {
  console.log(`Buscando estatísticas para jogo ID: ${jogoId}`);
  try {
    const url = `https://www.espn.com.br/futebol/partida-estatisticas/_/jogoId/${jogoId}`;
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const estatisticas = extrairEstatisticasCompletas(html);
    console.log('Estatísticas extraídas:', estatisticas);
    return estatisticas;
    
  } catch (e) {
    console.error(`Erro ao buscar estatísticas: ${e.toString()}`);
    return null;
  }
}

// Funções auxiliares para extração de estatísticas
function extrairEstatisticasCompletas(html) {
  try {
    const estatisticas = {
      posse: extrairPosse(html),
      chutesNoGol: extrairEstatisticaGenerica(html, "Chutes no gol"),
      chutes: extrairEstatisticaGenerica(html, "Chutes"),
      faltas: extrairEstatisticaGenerica(html, "Faltas"),
      cartoesAmarelos: extrairEstatisticaGenerica(html, "Cartões amarelos"),
      cartoesVermelhos: extrairEstatisticaGenerica(html, "Cartões vermelhos"),
      escanteios: extrairEstatisticaGenerica(html, "Escanteios"),
      defesas: extrairEstatisticaGenerica(html, "Defesas")
    };

    return estatisticas;
  } catch (e) {
    console.error(`Erro ao extrair estatísticas: ${e.message}`);
    return null;
  }
}

function extrairPosse(html) {
  try {
    const possessionPattern = /<span[^>]*class="[^"]*bLeWt[^"]*"[^>]*>([\d.]+)<span[^>]*class="[^"]*LNzKp[^"]*"[^>]*>%<\/span><\/span>.*?<span[^>]*class="[^"]*bLeWt[^"]*"[^>]*>([\d.]+)<span[^>]*class="[^"]*LNzKp[^"]*"[^>]*>%<\/span><\/span>/s;
    const match = html.match(possessionPattern);
    
    if (match && match.length >= 3) {
      return {
        casa: parseFloat(match[1]) || 0,
        visitante: parseFloat(match[2]) || 0
      };
    }
    
    return { casa: 0, visitante: 0 };
  } catch (e) {
    console.error(`Erro ao extrair posse de bola: ${e.message}`);
    return { casa: 0, visitante: 0 };
  }
}

function extrairEstatisticaGenerica(html, nomeEstatistica) {
  try {
    const escapedName = nomeEstatistica.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = new RegExp(
      `(?:${escapedName}|${escapedName.toLowerCase()}|${escapedName.toUpperCase()})[\\s\\S]*?<span[^>]*>(\\d+)<\\/span>[\\s\\S]*?<span[^>]*>(\\d+)<\\/span>`,
      'i'
    );

    const match = html.match(regexPattern);
    
    if (match && match.length >= 3) {
      return {
        casa: parseInt(match[1]) || 0,
        visitante: parseInt(match[2]) || 0
      };
    }
    
    return { casa: 0, visitante: 0 };
  } catch (e) {
    console.error(`Erro ao extrair estatística "${nomeEstatistica}": ${e.message}`);
    return { casa: 0, visitante: 0 };
  }
}


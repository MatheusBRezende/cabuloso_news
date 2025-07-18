const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');

// Configurações
const CONFIG = {
  CRUZEIRO_TEAM_ID: '2022',
  UPDATE_INTERVAL: '0 * * * *', // A cada hora
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// Cache de dados
let cachedData = {
  calendar: null,
  liveMatches: [],
  lastUpdated: null
};

// Função principal para buscar dados da ESPN
async function fetchESPNData() {
  try {
    console.log('Iniciando atualização de dados da ESPN...');
    
    // 1. Buscar calendário do Cruzeiro
    const calendar = await fetchCruzeiroCalendar();
    
    // 2. Identificar jogos ao vivo
    const liveMatches = await identifyLiveMatches(calendar);
    
    // 3. Para cada jogo ao vivo, buscar detalhes
    for (const match of liveMatches) {
      const matchDetails = await fetchMatchDetails(match.id);
      Object.assign(match, matchDetails);
    }
    
    // Atualizar cache
    cachedData = {
      calendar,
      liveMatches,
      lastUpdated: new Date()
    };
    
    console.log('Dados atualizados com sucesso!');
    return cachedData;
  } catch (error) {
    console.error('Erro ao buscar dados da ESPN:', error.message);
    throw error;
  }
}

// Buscar calendário do Cruzeiro
async function fetchCruzeiroCalendar() {
  const url = `https://www.espn.com.br/futebol/time/calendario/_/id/${CONFIG.CRUZEIRO_TEAM_ID}/bra.cruzeiro`;
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  
  const matches = [];
  
  // Extrair jogos da tabela
  $('table.Table tbody tr').each((i, row) => {
    const columns = $(row).find('td');
    
    if (columns.length >= 6) {
      const matchLink = $(columns[1]).find('a').attr('href');
      const matchId = matchLink ? matchLink.split('/jogoId/')[1] : null;
      
      if (matchId) {
        matches.push({
          id: matchId,
          date: $(columns[0]).text().trim(),
          homeTeam: $(columns[2]).text().trim(),
          score: $(columns[3]).text().trim(),
          awayTeam: $(columns[4]).text().trim(),
          competition: $(columns[5]).text().trim(),
          status: determineStatus($(columns[3]).text().trim())
        });
      }
    }
  });
  
  return matches;
}

// Identificar jogos ao vivo
async function identifyLiveMatches(calendar) {
  const liveMatches = calendar.filter(match => match.status === 'live');
  
  // Verificar status mais detalhado para cada jogo potencialmente ao vivo
  for (const match of liveMatches) {
    const status = await checkMatchStatus(match.id);
    match.status = status;
  }
  
  return liveMatches.filter(match => match.status === 'live');
}

// Verificar status do jogo
async function checkMatchStatus(matchId) {
  try {
    const url = `https://www.espn.com.br/futebol/partida/_/jogoId/${matchId}`;
    const html = await fetchHTML(url);
    
    if (html.includes('"gameState":"live"') || html.match(/AO VIVO|Em andamento|LIVE/i)) {
      return 'live';
    }
    if (html.includes('"gameState":"post"') || html.match(/Finalizado|FT/i)) {
      return 'finished';
    }
    return 'scheduled';
  } catch (error) {
    console.error(`Erro ao verificar status do jogo ${matchId}:`, error.message);
    return 'unknown';
  }
}

// Buscar detalhes do jogo (minuto a minuto e estatísticas)
async function fetchMatchDetails(matchId) {
  const [commentary, stats] = await Promise.all([
    fetchMatchCommentary(matchId),
    fetchMatchStats(matchId)
  ]);
  
  return {
    commentary,
    stats
  };
}

// Buscar comentários minuto a minuto
async function fetchMatchCommentary(matchId) {
  const url = `https://www.espn.com.br/futebol/comentario/_/jogoId/${matchId}`;
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);
  
  const commentary = [];
  
  $('.MatchCommentary__Comment').each((i, comment) => {
    const time = $(comment).find('.MatchCommentary__Comment__Timestamp span').text().trim();
    const text = $(comment).find('.MatchCommentary__Comment__GameDetails span').text().trim();
    
    if (time && text && !['Início do primeiro tempo.', 'Escalações são anunciadas e os jogadores já estão se aquecendo.'].includes(text)) {
      commentary.push({
        time,
        text
      });
    }
  });
  
  return commentary;
}

// Buscar estatísticas do jogo
async function fetchMatchStats(matchId) {
  try {
    // Primeiro tenta a página de estatísticas completas
    let url = `https://www.espn.com.br/futebol/partida-estatisticas/_/jogoId/${matchId}`;
    let html = await fetchHTML(url);
    let stats = html ? extractStatsFromHTML(html) : null;
    
    // Se não encontrou estatísticas suficientes, tenta a página de resumo
    if (!stats || Object.keys(stats).length < 3) {
      url = `https://www.espn.com.br/futebol/partida/_/jogoId/${matchId}`;
      html = await fetchHTML(url);
      stats = html ? extractStatsFromHTML(html) : null;
    }
    
    return stats || {
      possession: { home: 0, away: 0 },
      shotsOnTarget: { home: 0, away: 0 },
      shots: { home: 0, away: 0 },
      fouls: { home: 0, away: 0 },
      yellowCards: { home: 0, away: 0 },
      redCards: { home: 0, away: 0 },
      corners: { home: 0, away: 0 },
      saves: { home: 0, away: 0 }
    };
  } catch (error) {
    console.error(`Erro ao buscar estatísticas do jogo ${matchId}:`, error.message);
    return null;
  }
}

// Extrair estatísticas do HTML
function extractStatsFromHTML(html) {
  const $ = cheerio.load(html);
  const stats = {};
  
  // Extrair posse de bola (pode estar em um gráfico)
  const possessionHome = $('.home .chartValue').first().text().trim().replace('%', '');
  const possessionAway = $('.away .chartValue').first().text().trim().replace('%', '');
  
  if (possessionHome && possessionAway) {
    stats.possession = {
      home: parseFloat(possessionHome) / 100,
      away: parseFloat(possessionAway) / 100
    };
  }
  
  // Extrair outras estatísticas
  $('.StatBlock__stat').each((i, stat) => {
    const name = $(stat).find('.StatBlock__statName').text().trim();
    const homeValue = $(stat).find('.StatBlock__statValue--home').text().trim();
    const awayValue = $(stat).find('.StatBlock__statValue--away').text().trim();
    
    if (name && homeValue && awayValue) {
      const statKey = mapStatNameToKey(name);
      if (statKey) {
        stats[statKey] = {
          home: parseInt(homeValue) || 0,
          away: parseInt(awayValue) || 0
        };
      }
    }
  });
  
  return stats;
}

// Mapear nomes de estatísticas para chaves consistentes
function mapStatNameToKey(name) {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('posse')) return 'possession';
  if (lowerName.includes('chute') && lowerName.includes('gol')) return 'shotsOnTarget';
  if (lowerName.includes('chute')) return 'shots';
  if (lowerName.includes('falt')) return 'fouls';
  if (lowerName.includes('amarel')) return 'yellowCards';
  if (lowerName.includes('vermelh')) return 'redCards';
  if (lowerName.includes('escante')) return 'corners';
  if (lowerName.includes('defes')) return 'saves';
  
  return null;
}

// Determinar status básico pelo placar
function determineStatus(scoreText) {
  if (scoreText.includes('AO VIVO') || scoreText.includes('LIVE')) return 'live';
  if (scoreText.includes('FT') || scoreText.includes('Final')) return 'finished';
  if (scoreText.match(/\d+\s*-\s*\d+/)) return 'live'; // Se tem placar, assume que está ao vivo
  return 'scheduled';
}

// Função auxiliar para buscar HTML
async function fetchHTML(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Accept-Language': 'pt-BR,pt;q=0.9'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Erro ao buscar URL ${url}:`, error.message);
    return null;
  }
}

// Iniciar atualização periódica
function startScheduledUpdates() {
  // Executar imediatamente
  fetchESPNData();
  
  // Agendar execução periódica
  cron.schedule(CONFIG.UPDATE_INTERVAL, fetchESPNData);
  
  console.log('Agendador de atualizações iniciado');
}

// Exportar funções
module.exports = {
  fetchESPNData,
  getCachedData: () => cachedData,
  startScheduledUpdates
};
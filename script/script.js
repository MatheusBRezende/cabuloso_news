// script.js - Cabuloso News
const { getFromCache, saveToCache, getFromCacheAPI, saveToCacheAPI } =
  window.cabulosoCacheModule || {};

const CONFIG = {
  apiUrl: 'https://cabuloso-api.cabulosonews92.workers.dev/?type=dados-completos',
  defaultImage:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/200px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png',
  CACHE_TTL: 5 * 60 * 1000,
};

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let allNews = [];
let displayedNewsCount = 0;
const NEWS_PER_PAGE = 10;

// ============================================
// UTILITÁRIOS
// ============================================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showErrorMessage(message) {
  const container = document.getElementById('newsContainer');
  if (!container) return;
  container.innerHTML = `
    <div class="news-loader">
      <i class="fas fa-exclamation-triangle" style="font-size:48px; color:var(--error);"></i>
      <p style="font-size:18px; font-weight:600; color:var(--gray-700);">${message}</p>
      <button onclick="location.reload()" class="btn btn-primary">
        <i class="fas fa-rotate-right"></i> Recarregar Página
      </button>
    </div>
  `;
}

// ============================================
// CARGA DE DADOS PRINCIPAL
// ============================================
async function loadMasterData() {
  try {
    // 1. Tenta o Cache API primeiro (mais rápido)
    if (typeof getFromCacheAPI === 'function') {
      const cachedResponse = await getFromCacheAPI(CONFIG.apiUrl);
      if (cachedResponse) {
        const cachedData = await cachedResponse.json();
        distributeData(cachedData);
        return;
      }
    }

    // 2. Busca dados frescos do Worker
    const response = await fetch(CONFIG.apiUrl);
    if (!response.ok) throw new Error(`Erro ${response.status}`);

    // Clona antes de ler para poder salvar no cache
    if (typeof saveToCacheAPI === 'function') {
      saveToCacheAPI(CONFIG.apiUrl, response.clone());
    }

    let data = await response.json();

    // Normaliza caso a API retorne array
    if (Array.isArray(data) && data.length > 0) data = data[0];

    distributeData(data);

  } catch (error) {
    console.error('❌ Erro ao carregar dados:', error);

    // Fallback: sessionStorage
    if (typeof getFromCache === 'function') {
      const backup = getFromCache('master_data_v3');
      if (backup) {
        distributeData(backup);
        return;
      }
    }

    showErrorMessage('Não foi possível carregar os dados. Verifique sua conexão.');
  }
}

// ============================================
// DISTRIBUIÇÃO DE DADOS
// ============================================
function distributeData(data) {
  if (!data) return;

  // Notícias
  if (Array.isArray(data.noticias) && data.noticias.length > 0) {
    initNews(data.noticias);
  } else {
    const container = document.getElementById('newsContainer');
    if (container) {
      container.innerHTML = `
        <div class="news-loader">
          <i class="far fa-newspaper" style="font-size:48px;"></i>
          <p>Nenhuma notícia disponível no momento.</p>
        </div>
      `;
    }
  }

  // Tabela
  if (data.tabelas?.brasileiro?.classificacao) {
    renderMiniTable(data.tabelas.brasileiro.classificacao);
  }

  // Próximos jogos
  if (Array.isArray(data.agenda) && data.agenda.length > 0) {
    renderNextMatches(data.agenda);
  }

  // Resultados recentes
  if (Array.isArray(data.resultados) && data.resultados.length > 0) {
    renderRecentResults(data.resultados);
  }

  // Notifica o live-match-detector com os dados já carregados
  // (evita uma segunda chamada de API desnecessária)
  window.dispatchEvent(new CustomEvent('cabuloso:data', { detail: data }));
}

// ============================================
// RENDERIZADORES
// ============================================

// --- NOTÍCIAS ---
function initNews(noticiasData) {
  const container = document.getElementById('newsContainer');
  if (!container) return;

  allNews = noticiasData;
  displayedNewsCount = 0;
  container.innerHTML = '';
  renderMoreNews();

  const loadMoreContainer = document.getElementById('loadMoreContainer');
  if (loadMoreContainer) {
    loadMoreContainer.style.display = allNews.length > NEWS_PER_PAGE ? 'block' : 'none';
    const btn = document.getElementById('btnLoadMore');
    if (btn) btn.onclick = renderMoreNews;
  }
}

function renderMoreNews() {
  const container = document.getElementById('newsContainer');
  if (!container) return;

  const newsToShow = allNews.slice(displayedNewsCount, displayedNewsCount + NEWS_PER_PAGE);

  newsToShow.forEach((noticia) => {
    const article = document.createElement('article');
    article.className = 'news-card';
    article.onclick = () => {
      const url = noticia.url || noticia.link;
      if (url) window.open(url, '_blank');
    };

    const imgUrl = noticia.image || CONFIG.defaultImage;

    article.innerHTML = `
      <div class="news-image">
        <img
          src="${imgUrl}"
          alt="${escapeHtml(noticia.title)}"
          loading="lazy"
          onerror="this.src='${CONFIG.defaultImage}'"
        >
        <div class="news-badge">${escapeHtml(noticia.fonte || 'Notícia')}</div>
      </div>
      <div class="news-content">
        <div class="news-date">
          <i class="far fa-clock"></i> ${escapeHtml(noticia.date || '')}
        </div>
        <h3 class="news-title">${escapeHtml(noticia.title)}</h3>
        <div class="news-footer">
          <span class="read-more">Ler mais <i class="fas fa-arrow-right"></i></span>
        </div>
      </div>
    `;

    container.appendChild(article);
  });

  displayedNewsCount += newsToShow.length;

  const loadMoreContainer = document.getElementById('loadMoreContainer');
  if (loadMoreContainer && displayedNewsCount >= allNews.length) {
    loadMoreContainer.style.display = 'none';
  }
}

// --- MINI TABELA ---
function renderMiniTable(classificacao) {
  const tbody = document.getElementById('miniTableBody');
  if (!tbody) return;

  tbody.innerHTML = classificacao
    .slice(0, 5)
    .map((time, index) => {
      const isCruzeiro = time.nome?.toLowerCase().includes('cruzeiro');
      return `
        <tr class="${isCruzeiro ? 'cruzeiro-row' : ''}">
          <td>${index + 1}º</td>
          <td>
            <div class="team-cell">
              <img
                src="${time.escudo || CONFIG.defaultImage}"
                alt="${escapeHtml(time.nome)}"
                class="team-logo"
                loading="lazy"
                onerror="this.src='${CONFIG.defaultImage}'"
              >
              <span>${escapeHtml(time.nome)}</span>
            </div>
          </td>
          <td><strong>${time.pontos}</strong></td>
        </tr>
      `;
    })
    .join('');
}

// --- PRÓXIMOS JOGOS ---
function renderNextMatches(agenda) {
  const container = document.getElementById('nextMatchesWidget');
  if (!container) return;

  const proximos = agenda.slice(0, 6);

  if (proximos.length === 0) {
    container.innerHTML = `
      <div class="loading-cell">
        <i class="far fa-calendar-times" style="font-size:28px; margin-bottom:8px;"></i>
        <p>Nenhum jogo agendado</p>
      </div>
    `;
    return;
  }

  container.innerHTML = proximos
    .map(
      (jogo) => `
      <div class="match-item">
        <div class="match-item-date">
          <i class="far fa-calendar"></i> ${escapeHtml(jogo.data)} - ${escapeHtml(jogo.hora)}
        </div>
        <div class="match-item-teams">
          <div class="match-team-widget">
            <img
              src="${jogo.escudo_mandante || CONFIG.defaultImage}"
              alt="${escapeHtml(jogo.mandante)}"
              loading="lazy"
              onerror="this.src='${CONFIG.defaultImage}'"
            >
            <span>${escapeHtml(jogo.mandante)}</span>
          </div>
          <span class="match-score-widget">X</span>
          <div class="match-team-widget">
            <span>${escapeHtml(jogo.visitante)}</span>
            <img
              src="${jogo.escudo_visitante || CONFIG.defaultImage}"
              alt="${escapeHtml(jogo.visitante)}"
              loading="lazy"
              onerror="this.src='${CONFIG.defaultImage}'"
            >
          </div>
        </div>
        <div class="match-item-competition">${escapeHtml(jogo.campeonato)}</div>
      </div>
    `
    )
    .join('');
}

// --- RESULTADOS RECENTES ---
function renderRecentResults(resultados) {
  const container = document.getElementById('recentResultsWidget');
  if (!container) return;

  const ultimos = resultados.slice(0, 5);

  if (ultimos.length === 0) {
    container.innerHTML = `
      <div class="loading-cell">
        <i class="fas fa-futbol" style="font-size:28px; margin-bottom:8px;"></i>
        <p>Nenhum resultado recente</p>
      </div>
    `;
    return;
  }

  container.innerHTML = ultimos
    .map((res) => {
      let score1 = '0', score2 = '0';
      if (res.score?.includes('-')) {
        [score1, score2] = res.score.split('-').map((s) => s.trim());
      }

      const team1 = res.team1 || 'Time 1';
      const team2 = res.team2 || 'Time 2';
      const s1 = parseInt(score1);
      const s2 = parseInt(score2);

      let statusClass = 'neutral';
      if (!isNaN(s1) && !isNaN(s2)) {
        if (s1 === s2) {
          statusClass = 'draw';
        } else {
          const cruzeiroVenceu =
            (team1.toLowerCase().includes('cruzeiro') && s1 > s2) ||
            (team2.toLowerCase().includes('cruzeiro') && s2 > s1);
          statusClass = cruzeiroVenceu ? 'win' : 'loss';
        }
      }

      return `
        <div class="result-mini">
          <div class="result-mini-teams">
            <div class="result-mini-team">
              <img src="${res.logo1 || CONFIG.defaultImage}" alt="${escapeHtml(team1)}" loading="lazy" onerror="this.src='${CONFIG.defaultImage}'">
              <span>${escapeHtml(team1)}</span>
            </div>
            <span class="result-mini-score ${statusClass}">${score1} - ${score2}</span>
            <div class="result-mini-team">
              <img src="${res.logo2 || CONFIG.defaultImage}" alt="${escapeHtml(team2)}" loading="lazy" onerror="this.src='${CONFIG.defaultImage}'">
              <span>${escapeHtml(team2)}</span>
            </div>
          </div>
          <div class="result-mini-info">
            ${escapeHtml(res.competition)} | ${escapeHtml(res.date)}
          </div>
        </div>
      `;
    })
    .join('');
}

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Menu mobile
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      navMenu.classList.toggle('active');
    });
  }

  loadMasterData();
});

// Força refresh limpando todos os caches
window.forceRefreshAll = async () => {
  sessionStorage.removeItem('cache_master_data_v3');
  if ('caches' in window) await caches.delete('cabuloso-v1');
  location.reload();
};
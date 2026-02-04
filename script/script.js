import { getFromCache, saveToCache } from './cache.js';

const CONFIG = {
  apiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/dados",
  defaultImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/200px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png',
  CACHE_TTL: 10 * 60 * 1000 // 10 minutos
};

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let allNews = [];
let displayedNewsCount = 0;
const NEWS_PER_PAGE = 6;

// ============================================
// UTILITÁRIOS
// ============================================
function parseNewsDate(dateString) {
  if (!dateString) return new Date();
  const date = new Date(dateString);
  return !isNaN(date.getTime()) ? date : new Date();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loadingScreen');
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }
}

// ============================================
// LÓGICA MESTRE DE DADOS (SINGLE FETCH)
// ============================================
async function loadMasterData() {
  const CACHE_KEY = 'master_data';
  console.log("🚀 Iniciando carga de dados...");
  
  try {
    // 1. Tenta pegar do Cache Global (via cache.js)
    const cachedData = getFromCache(CACHE_KEY); 
    if (cachedData) {
      console.log("📦 Dados recuperados do Cache Global");
      distributeData(cachedData);
      hideLoadingScreen();
      return;
    }

    // 2. Busca na Worker
    console.log("🌐 Buscando novos dados na API...");
    const response = await fetch(`${CONFIG.apiUrl}?t=${Date.now()}`);
    let data = await response.json();

    // 3. Normalização (n8n às vezes envia array)
    if (Array.isArray(data)) data = data[0];

    // 4. Salva no Cache Global apenas se os dados forem válidos (sem erro)
    if (data && !data.error) {
      saveToCache(CACHE_KEY, data, CONFIG.CACHE_TTL);
      distributeData(data);
    } else {
      throw new Error(data?.error || "Dados inválidos");
    }

  } catch (error) {
    console.error("❌ Erro na carga mestre:", error);
    
    // Tenta carregar qualquer coisa que sobrou no localStorage mesmo expirado em último caso
    const backup = localStorage.getItem(`cache_${CACHE_KEY}`);
    if (backup) {
      console.warn("⚠️ Usando backup de emergência");
      distributeData(JSON.parse(backup).data);
    }
  } finally {
    hideLoadingScreen();
  }
}

// Distribui os dados para cada seção do site
function distributeData(data) {
  if (!data) return;
  if (data.noticias) initNews(data.noticias);
  if (data.tabela_brasileiro?.classificacao) renderMiniTable(data.tabela_brasileiro.classificacao);
  if (data.agenda) renderNextMatches(data.agenda);
  if (data.resultados) renderRecentResults(data.resultados);
}

// ============================================
// RENDERIZADORES (UI)
// ============================================

// --- 1. NOTÍCIAS ---
function initNews(noticiasData) {
  const container = document.getElementById("newsContainer");
  if (!container) return;

  noticiasData.sort((a, b) => parseNewsDate(b.date) - parseNewsDate(a.date));
  allNews = noticiasData;
  displayedNewsCount = 0;
  
  container.innerHTML = '';
  renderMoreNews();

  const loadMoreContainer = document.getElementById("loadMoreContainer");
  if (loadMoreContainer) {
    loadMoreContainer.style.display = allNews.length > NEWS_PER_PAGE ? "block" : "none";
    const btnLoadMore = document.getElementById("btnLoadMore");
    if (btnLoadMore) btnLoadMore.onclick = renderMoreNews;
  }
}

function renderMoreNews() {
  const container = document.getElementById("newsContainer");
  if (!container) return;
  
  const newsToShow = allNews.slice(displayedNewsCount, displayedNewsCount + NEWS_PER_PAGE);
  
  newsToShow.forEach(noticia => {
    const newsCard = document.createElement("article");
    newsCard.className = "news-card";
    newsCard.onclick = () => window.open(noticia.url || noticia.link, '_blank');
    
    const imgUrl = noticia.image || CONFIG.defaultImage;

    newsCard.innerHTML = `
      <div class="news-image">
        <img src="${imgUrl}" alt="${escapeHtml(noticia.title)}" loading="lazy" onerror="this.src='${CONFIG.defaultImage}'">
        <div class="news-badge">${escapeHtml(noticia.fonte || "Notícia")}</div>
      </div>
      <div class="news-content">
        <div class="news-date"><i class="far fa-clock"></i> ${escapeHtml(noticia.date || '')}</div>
        <h3 class="news-title">${escapeHtml(noticia.title)}</h3>
        <div class="news-footer"><span class="read-more">Ler mais <i class="fas fa-arrow-right"></i></span></div>
      </div>
    `;
    container.appendChild(newsCard);
  });
  
  displayedNewsCount += newsToShow.length;
  const loadMoreContainer = document.getElementById("loadMoreContainer");
  if (loadMoreContainer && displayedNewsCount >= allNews.length) {
    loadMoreContainer.style.display = "none";
  }
}

// --- 2. MINI TABELA ---
function renderMiniTable(classificacao) {
  const tbody = document.getElementById("miniTableBody");
  if (!tbody) return;

  const top5 = classificacao.slice(0, 5);
  tbody.innerHTML = top5.map((time, index) => {
    const isCruzeiro = time.nome?.toLowerCase().includes("cruzeiro");
    return `
      <tr class="${isCruzeiro ? "cruzeiro-row" : ""}">
        <td>${index + 1}º</td>
        <td>
          <div class="team-cell">
            <img src="${time.escudo || CONFIG.defaultImage}" alt="" class="team-logo" loading="lazy">
            <span>${escapeHtml(time.nome)}</span>
          </div>
        </td>
        <td><strong>${time.pontos}</strong></td>
      </tr>
    `;
  }).join("");

  const cruzeiro = classificacao.find(t => t.nome?.toLowerCase().includes("cruzeiro"));
  const statPosition = document.getElementById("statPosition");
  if (statPosition && cruzeiro) {
    statPosition.textContent = `${cruzeiro.posicao || "?"}º lugar`;
  }
}

// --- 3. PRÓXIMOS JOGOS ---
function renderNextMatches(agenda) {
  const container = document.getElementById("nextMatchesWidget");
  if (!container) return;

  const proximos = agenda.slice(0, 3);
  container.innerHTML = proximos.map(jogo => `
    <div class="match-item">
      <div class="match-item-date"><i class="far fa-calendar"></i> ${escapeHtml(jogo.data)} - ${escapeHtml(jogo.hora)}</div>
      <div class="match-item-teams">
        <div class="match-team-widget">
          <img src="${jogo.escudo_mandante || CONFIG.defaultImage}" alt="" loading="lazy">
          <span>${escapeHtml(jogo.mandante)}</span>
        </div>
        <span class="match-score-widget">X</span>
        <div class="match-team-widget">
          <span>${escapeHtml(jogo.visitante)}</span>
          <img src="${jogo.escudo_visitante || CONFIG.defaultImage}" alt="" loading="lazy">
        </div>
      </div>
      <div class="match-item-competition">${escapeHtml(jogo.campeonato)}</div>
    </div>
  `).join("");

  const statNextGame = document.getElementById("statNextGame");
  if (statNextGame && proximos.length > 0) {
    const prox = proximos[0];
    const opponent = prox.mandante?.toLowerCase().includes("cruzeiro") ? prox.visitante : prox.mandante;
    statNextGame.textContent = `${prox.data?.split(" ")[0] || ""} vs ${opponent || "Adversário"}`;
  }
}

// --- 4. RESULTADOS RECENTES ---
// --- 4. RESULTADOS RECENTES ---
function renderRecentResults(resultados) {
  const container = document.getElementById("recentResultsWidget");
  if (!container) return;

  // Pega apenas os 5 últimos resultados
  const ultimosResultados = resultados.slice(0, 5);
  
  if (ultimosResultados.length === 0) {
    container.innerHTML = '<div class="loading-cell">Nenhum resultado recente</div>';
    return;
  }

  container.innerHTML = ultimosResultados.map(res => {
    // 1. Tratamento do Placar (Quebra a string "0 - 1")
    let score1 = "0", score2 = "0";
    if (res.score && res.score.includes('-')) {
      const partes = res.score.split('-');
      score1 = partes[0].trim();
      score2 = partes[1].trim();
    }

    const team1 = res.team1 || "Time 1";
    const team2 = res.team2 || "Time 2";
    
    // 2. Lógica de Cores (Vitória, Empate, Derrota)
    let statusClass = "neutral";
    const s1 = parseInt(score1);
    const s2 = parseInt(score2);

    if (!isNaN(s1) && !isNaN(s2)) {
      if (s1 === s2) {
        statusClass = "draw"; // Empate
      } else {
        const cruzeiroVenceuMandante = team1.toLowerCase().includes("cruzeiro") && s1 > s2;
        const cruzeiroVenceuVisitante = team2.toLowerCase().includes("cruzeiro") && s2 > s1;
        
        if (cruzeiroVenceuMandante || cruzeiroVenceuVisitante) {
          statusClass = "win"; // Vitória
        } else {
          statusClass = "loss"; // Derrota
        }
      }
    }

    return `
      <div class="result-mini">
        <div class="result-mini-teams">
          <div class="result-mini-team">
            <img src="${res.logo1 || CONFIG.defaultImage}" alt="" loading="lazy" onerror="this.src='${CONFIG.defaultImage}'">
            <span>${escapeHtml(team1)}</span>
          </div>
          <span class="result-mini-score ${statusClass}">${score1} - ${score2}</span>
          <div class="result-mini-team">
            <img src="${res.logo2 || CONFIG.defaultImage}" alt="" loading="lazy" onerror="this.src='${CONFIG.defaultImage}'">
            <span>${escapeHtml(team2)}</span>
          </div>
        </div>
        <div class="result-mini-info">${escapeHtml(res.competition)} | ${escapeHtml(res.date)}</div>
      </div>`;
  }).join("");
}

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Menu Mobile
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      navMenu.classList.toggle('active');
    });
  }

  loadMasterData();
  setTimeout(hideLoadingScreen, 4000);
});

const forceRefreshAll = () => {
  localStorage.removeItem('cache_master_data');
  location.reload();
};
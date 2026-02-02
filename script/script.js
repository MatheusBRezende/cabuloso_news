/**
 * Cabuloso News - Script Principal (OTIMIZADO: Single Request + Worker Fix)
 * Reduz requisições à Cloudflare de 4 para 1 por visita.
 */

// ============================================
// CONFIGURAÇÃO
// ============================================
const CONFIG = {
  // Uma única URL para tudo (Worker unificada)
  apiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/",
  
  defaultImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/200px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png',
  
  // Cache global de 10 minutos (alinha com a atualização de notícias)
  CACHE_TTL: 10 * 60 * 1000 
};

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let allNews = [];
let displayedNewsCount = 0;
const NEWS_PER_PAGE = 6;

// ============================================
// SISTEMA DE CACHE LOCAL (Mantido do original)
// ============================================
const LocalCache = {
  set(key, data, ttl) {
    const item = {
      data,
      timestamp: Date.now(),
      ttl
    };
    localStorage.setItem(`cache_${key}`, JSON.stringify(item));
  },

  get(key) {
    const raw = localStorage.getItem(`cache_${key}`);
    if (!raw) return null;
    
    const item = JSON.parse(raw);
    const now = Date.now();
    
    if (now - item.timestamp > item.ttl) {
      localStorage.removeItem(`cache_${key}`);
      return null;
    }
    
    return item.data;
  },

  clear() {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('cache_')) localStorage.removeItem(k);
    });
  }
};

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
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      setTimeout(() => {
        if (loadingScreen.parentNode) loadingScreen.style.display = 'none';
      }, 500);
    }, 800);
  }
}

// ============================================
// LÓGICA MESTRE DE DADOS (SINGLE FETCH)
// ============================================
async function loadMasterData() {
  console.log("🚀 Iniciando carga mestre de dados...");
  
  try {
    // 1. Tenta pegar do Cache Local primeiro
    const cachedData = LocalCache.get('master_data');
    if (cachedData) {
      console.log("📦 Usando dados do cache local (Economia de Request!)");
      distributeData(cachedData);
      return;
    }

    // 2. Se não tem cache, busca na Worker (Gasta 1 request)
    console.log("🌐 Buscando novos dados na Nuvem...");
    const response = await fetch(CONFIG.apiUrl);
    let data = await response.json();

    // 3. Corrige formato do n8n (Array -> Objeto)
    if (Array.isArray(data)) {
      data = data[0];
    }

    // 4. Salva no Cache e Distribui
    if (data) {
      LocalCache.set('master_data', data, CONFIG.CACHE_TTL);
      distributeData(data);
    } else {
      throw new Error("Dados vazios recebidos da API");
    }

  } catch (error) {
    console.error("❌ Erro na carga mestre:", error);
    // Tenta usar cache expirado como fallback de emergência
    const expired = localStorage.getItem('cache_master_data');
    if (expired) {
      console.warn("⚠️ Usando cache expirado como fallback");
      distributeData(JSON.parse(expired).data);
    }
  } finally {
    hideLoadingScreen();
  }
}

// Distribui os dados para cada seção do site
function distributeData(data) {
  // Notícias
  if (data.noticias) {
    initNews(data.noticias);
  }
  
  // Tabela
  if (data.tabela_brasileiro && data.tabela_brasileiro.classificacao) {
    renderMiniTable(data.tabela_brasileiro.classificacao);
  }
  
  // Agenda
  if (data.agenda) {
    renderNextMatches(data.agenda);
  }
  
  // Resultados
  if (data.resultados) {
    renderRecentResults(data.resultados);
  }
}

// ============================================
// RENDERIZADORES (UI)
// ============================================

// --- 1. NOTÍCIAS ---
function initNews(noticiasData) {
  const container = document.getElementById("newsContainer");
  if (!container) return;

  // Ordena e salva na variável global
  noticiasData.sort((a, b) => parseNewsDate(b.date) - parseNewsDate(a.date));
  allNews = noticiasData;
  displayedNewsCount = 0;
  
  container.innerHTML = '';
  renderMoreNews(); // Chama a função original de paginação

  // Configura botão "Carregar Mais"
  const loadMoreContainer = document.getElementById("loadMoreContainer");
  if (loadMoreContainer) {
    if (allNews.length > NEWS_PER_PAGE) {
      loadMoreContainer.style.display = "block";
      const btnLoadMore = document.getElementById("btnLoadMore");
      if (btnLoadMore) btnLoadMore.onclick = renderMoreNews;
    } else {
      loadMoreContainer.style.display = "none";
    }
  }
}

function renderMoreNews() {
  const container = document.getElementById("newsContainer");
  if (!container) return;
  
  const newsToShow = allNews.slice(displayedNewsCount, displayedNewsCount + NEWS_PER_PAGE);
  
  if (newsToShow.length === 0) {
    const loadMoreContainer = document.getElementById("loadMoreContainer");
    if (loadMoreContainer) loadMoreContainer.style.display = "none";
    return;
  }
  
  newsToShow.forEach(noticia => {
    const newsCard = document.createElement("article");
    newsCard.className = "news-card";
    newsCard.onclick = () => window.open(noticia.url || noticia.link, '_blank');
    
    let badgeClass = "news-badge";
    let badgeText = noticia.fonte || "Notícia";
    
    // Tratamento de imagem
    const imgUrl = noticia.image || CONFIG.defaultImage;

    newsCard.innerHTML = `
      <div class="news-image">
        <img src="${imgUrl}" 
             alt="${escapeHtml(noticia.title)}"
             loading="lazy"
             onerror="this.src='${CONFIG.defaultImage}'">
        <div class="${badgeClass}">${escapeHtml(badgeText)}</div>
      </div>
      <div class="news-content">
        <div class="news-date">
          <i class="far fa-clock"></i>
          ${escapeHtml(noticia.date || '')}
        </div>
        <h3 class="news-title">${escapeHtml(noticia.title)}</h3>
        <div class="news-footer">
          <span class="read-more">
            Ler mais <i class="fas fa-arrow-right"></i>
          </span>
        </div>
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

  // Atualiza posição no header se existir elemento
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
      <div class="match-item-date">
        <i class="far fa-calendar"></i>
        ${escapeHtml(jogo.data)} - ${escapeHtml(jogo.hora)}
      </div>
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

  // Atualiza próximo jogo no header
  const statNextGame = document.getElementById("statNextGame");
  if (statNextGame && proximos.length > 0) {
    const prox = proximos[0];
    const opponent = prox.mandante?.toLowerCase().includes("cruzeiro")
      ? prox.visitante
      : prox.mandante;
    statNextGame.textContent = `${prox.data?.split(" ")[0] || ""} vs ${opponent || "Adversário"}`;
  }
}

// --- 4. RESULTADOS RECENTES ---
function renderRecentResults(resultados) {
  const container = document.getElementById("recentResultsWidget");
  if (!container) return;

  const ultimosResultados = resultados.slice(0, 5);

  if (ultimosResultados.length === 0) {
    container.innerHTML = '<div class="loading-cell">Nenhum resultado recente</div>';
    return;
  }

  container.innerHTML = ultimosResultados.map(res => {
    // Lógica de placar robusta (mantida do original)
    let score1 = "0", score2 = "0";
    
    if (res.score1 !== undefined && res.score2 !== undefined) {
      score1 = res.score1; score2 = res.score2;
    } else if (res.score) {
      const parts = res.score.split(/[x\-]/);
      if (parts.length >= 2) { score1 = parts[0].trim(); score2 = parts[1].trim(); }
    }

    const team1 = res.team1 || res.mandante || "Time 1";
    const team2 = res.team2 || res.visitante || "Time 2";
    const isCruzeiroMandante = team1.toLowerCase().includes("cruzeiro");
    const isCruzeiroVisitante = team2.toLowerCase().includes("cruzeiro");
    
    // Define cores (win/loss/draw)
    let statusClass = "neutral";
    const s1 = parseInt(score1), s2 = parseInt(score2);
    
    if (!isNaN(s1) && !isNaN(s2)) {
      if (s1 === s2) statusClass = "draw";
      else if (isCruzeiroMandante) statusClass = s1 > s2 ? "win" : "loss";
      else if (isCruzeiroVisitante) statusClass = s2 > s1 ? "win" : "loss";
    }

    return `
      <div class="result-mini">
        <div class="result-mini-teams">
          <div class="result-mini-team">
            <img src="${res.logo1 || CONFIG.defaultImage}" alt="${team1}" loading="lazy" onerror="this.src='${CONFIG.defaultImage}'">
            <span>${escapeHtml(team1)}</span>
          </div>
          <span class="result-mini-score ${statusClass}">${score1} x ${score2}</span>
          <div class="result-mini-team">
            <img src="${res.logo2 || CONFIG.defaultImage}" alt="${team2}" loading="lazy" onerror="this.src='${CONFIG.defaultImage}'">
            <span>${escapeHtml(team2)}</span>
          </div>
        </div>
        <div class="result-mini-info">${escapeHtml(res.competition || 'Campeonato')}</div>
        ${res.data ? `<div class="result-mini-date"><i class="far fa-calendar"></i> ${escapeHtml(res.data)}</div>` : ''}
      </div>`;
  }).join("");
}

// ============================================
// INICIALIZAÇÃO E EVENTOS
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  
  // Menu Mobile
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      navMenu.classList.toggle('active');
    });
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        navMenu.classList.remove('active');
      });
    });
  }

  // Iniciar Carga Única
  loadMasterData();

  // Fallback de segurança para remover loading
  setTimeout(hideLoadingScreen, 4000);
});

// Função para debug manual no console
const forceRefreshAll = () => {
  LocalCache.clear();
  loadMasterData();
  alert("Cache limpo e dados recarregados!");
};
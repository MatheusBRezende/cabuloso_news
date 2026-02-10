// script.js - VERSÃO CORRIGIDA (usa window.cabulosoCacheModule)

// Obtém funções do cache global (carregado por cache.js)
const { getFromCache, saveToCache, getFromCacheAPI, saveToCacheAPI } = window.cabulosoCacheModule || {};

const CONFIG = {
  // ⭐ ENDPOINT ÚNICO CONSOLIDADO - Reduz de 3 para 1 requisição!
  apiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/?type=dados-completos",
  
  defaultImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/200px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png",
  CACHE_TTL: 5 * 60 * 1000, // 5 minutos (alinhado com Worker)
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
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) {
    loadingScreen.classList.add("hidden");
    setTimeout(() => {
      loadingScreen.style.display = "none";
    }, 500);
  }
}

function showErrorMessage(message) {
  const container = document.getElementById("newsContainer");
  if (container) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px; color:#999;">
        <i class="fas fa-exclamation-triangle" style="font-size:48px; color:#ff6b6b;"></i>
        <p style="margin-top:20px; font-size:18px;">${escapeHtml(message)}</p>
      </div>
    `;
  }
}

// ============================================
// CARREGAR DADOS CONSOLIDADOS
// ============================================
async function loadMasterData() {
  const CACHE_KEY = "master_data_v3";
  
  try {
    console.log("🎯 Iniciando carga de dados...");
    
    // 1. TENTA CACHE PRIMEIRO
    const cached = getFromCache(CACHE_KEY);
    if (cached) {
      console.log("📦 Dados recuperados do cache!");
      processAllData(cached);
      return cached;
    }

    // 2. BUSCA DO WORKER
    console.log("🌐 Buscando dados do Worker...");
    const response = await fetch(`${CONFIG.apiUrl}&t=${Date.now()}`, {
      cache: "no-cache"
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const masterData = Array.isArray(data) ? data[0] : data;

    // 3. VALIDA ESTRUTURA
    if (!masterData || typeof masterData !== 'object') {
      throw new Error("Estrutura de dados inválida");
    }

    console.log("✅ Dados recebidos:", {
      noticias: masterData.noticias?.length || 0,
      tabelas: Object.keys(masterData.tabelas || {}).length,
      agenda: masterData.agenda?.length || 0,
      resultados: masterData.resultados?.length || 0
    });

    // 4. SALVA NO CACHE
    saveToCache(CACHE_KEY, masterData, CONFIG.CACHE_TTL);
    
    // 5. PROCESSA DADOS
    processAllData(masterData);
    
    return masterData;

  } catch (error) {
    console.error("❌ Erro ao carregar dados:", error);
    showErrorMessage("Erro ao carregar dados. Tente novamente.");
    return null;
  } finally {
    hideLoadingScreen();
  }
}

// ============================================
// PROCESSAR DADOS
// ============================================
function processAllData(data) {
  if (!data) return;

  // Processa notícias
  if (data.noticias && Array.isArray(data.noticias)) {
    allNews = data.noticias;
    renderNews();
  }

  // Processa tabelas
  if (data.tabelas) {
    renderMiniTable(data.tabelas.brasileiro);
  }

  // Processa agenda
  if (data.agenda && Array.isArray(data.agenda)) {
    renderNextMatches(data.agenda);
  }

  // Processa resultados
  if (data.resultados && Array.isArray(data.resultados)) {
    renderRecentResults(data.resultados);
  }

  console.log("✅ Todos os widgets renderizados");
}

// ============================================
// RENDERIZAR NOTÍCIAS
// ============================================
function renderNews() {
  const container = document.getElementById("newsContainer");
  const loadMoreBtn = document.getElementById("btnLoadMore");
  const loadMoreContainer = document.getElementById("loadMoreContainer");

  if (!container) return;

  if (allNews.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px; color:#999;">
        <i class="fas fa-newspaper" style="font-size:48px;"></i>
        <p style="margin-top:20px;">Nenhuma notícia disponível</p>
      </div>
    `;
    return;
  }

  // Ordena por data
  const sortedNews = [...allNews].sort((a, b) => 
    parseNewsDate(b.data_publicacao) - parseNewsDate(a.data_publicacao)
  );

  // Renderiza as primeiras 6
  const newsToShow = sortedNews.slice(0, displayedNewsCount + NEWS_PER_PAGE);
  displayedNewsCount = newsToShow.length;

  container.innerHTML = newsToShow.map(news => `
    <article class="news-card">
      <div class="news-image">
        <img 
          src="${news.imagem || CONFIG.defaultImage}" 
          alt="${escapeHtml(news.titulo)}"
          onerror="this.src='${CONFIG.defaultImage}'"
        >
        <div class="news-category">${escapeHtml(news.categoria || 'Notícias')}</div>
      </div>
      <div class="news-content">
        <h3 class="news-title">${escapeHtml(news.titulo)}</h3>
        <p class="news-excerpt">${escapeHtml(news.descricao || '')}</p>
        <div class="news-footer">
          <span class="news-date">
            <i class="far fa-clock"></i>
            ${new Date(parseNewsDate(news.data_publicacao)).toLocaleDateString('pt-BR')}
          </span>
          <a href="${news.link}" target="_blank" class="news-link">
            Ler mais <i class="fas fa-arrow-right"></i>
          </a>
        </div>
      </div>
    </article>
  `).join('');

  // Controla botão "Carregar Mais"
  if (displayedNewsCount < sortedNews.length) {
    if (loadMoreContainer) loadMoreContainer.style.display = 'block';
    if (loadMoreBtn) {
      loadMoreBtn.onclick = () => {
        displayedNewsCount += NEWS_PER_PAGE;
        renderNews();
      };
    }
  } else {
    if (loadMoreContainer) loadMoreContainer.style.display = 'none';
  }
}

// ============================================
// RENDERIZAR MINI TABELA
// ============================================
function renderMiniTable(tabelaBrasileiro) {
  const tbody = document.getElementById("miniTableBody");
  if (!tbody || !tabelaBrasileiro?.classificacao) return;

  const top5 = tabelaBrasileiro.classificacao.slice(0, 5);

  tbody.innerHTML = top5.map((time, index) => {
    const isCruzeiro = time.nome?.toLowerCase().includes("cruzeiro");
    return `
      <tr class="${isCruzeiro ? 'cruzeiro-highlight' : ''}">
        <td>${index + 1}º</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <img 
              src="${time.escudo || CONFIG.defaultImage}" 
              alt="${escapeHtml(time.nome)}"
              style="width:20px; height:20px; object-fit:contain;"
              onerror="this.src='${CONFIG.defaultImage}'"
            >
            <span>${escapeHtml(time.nome)}</span>
          </div>
        </td>
        <td><strong>${time.pontos}</strong></td>
      </tr>
    `;
  }).join('');
}

// ============================================
// RENDERIZAR PRÓXIMOS JOGOS
// ============================================
function renderNextMatches(agenda) {
  const container = document.getElementById("nextMatchesWidget");
  if (!container) return;

  if (!agenda || agenda.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999;">Nenhum jogo agendado</p>';
    return;
  }

  const proximos3 = agenda.slice(0, 3);

  container.innerHTML = proximos3.map(jogo => `
    <div class="match-item">
      <div class="match-date">
        <i class="far fa-calendar"></i>
        ${escapeHtml(jogo.data)} - ${escapeHtml(jogo.hora)}
      </div>
      <div class="match-teams">
        <div class="team">
          <img 
            src="${jogo.escudo_mandante || CONFIG.defaultImage}" 
            alt="${escapeHtml(jogo.mandante)}"
            onerror="this.src='${CONFIG.defaultImage}'"
          >
          <span>${escapeHtml(jogo.mandante)}</span>
        </div>
        <span class="vs">VS</span>
        <div class="team">
          <span>${escapeHtml(jogo.visitante)}</span>
          <img 
            src="${jogo.escudo_visitante || CONFIG.defaultImage}" 
            alt="${escapeHtml(jogo.visitante)}"
            onerror="this.src='${CONFIG.defaultImage}'"
          >
        </div>
      </div>
      <div class="match-info">${escapeHtml(jogo.campeonato)}</div>
    </div>
  `).join('');
}

// ============================================
// RENDERIZAR ÚLTIMOS RESULTADOS
// ============================================
function renderRecentResults(resultados) {
  const container = document.getElementById("recentResultsWidget");
  if (!container) return;

  if (!resultados || resultados.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999;">Nenhum resultado disponível</p>';
    return;
  }

  const ultimos4 = resultados.slice(0, 4);

  container.innerHTML = ultimos4.map(jogo => {
    const isCruzeiro = jogo.mandante?.toLowerCase().includes("cruzeiro") || 
                       jogo.visitante?.toLowerCase().includes("cruzeiro");
    
    return `
      <div class="result-item ${isCruzeiro ? 'cruzeiro-game' : ''}">
        <div class="result-date">${escapeHtml(jogo.data)}</div>
        <div class="result-teams">
          <div class="team">
            <img 
              src="${jogo.escudo_mandante || CONFIG.defaultImage}" 
              alt="${escapeHtml(jogo.mandante)}"
              onerror="this.src='${CONFIG.defaultImage}'"
            >
            <span>${escapeHtml(jogo.mandante)}</span>
          </div>
          <div class="score">
            ${jogo.placar_mandante} x ${jogo.placar_visitante}
          </div>
          <div class="team">
            <span>${escapeHtml(jogo.visitante)}</span>
            <img 
              src="${jogo.escudo_visitante || CONFIG.defaultImage}" 
              alt="${escapeHtml(jogo.visitante)}"
              onerror="this.src='${CONFIG.defaultImage}'"
            >
          </div>
        </div>
        <div class="result-info">${escapeHtml(jogo.campeonato)}</div>
      </div>
    `;
  }).join('');
}

// ============================================
// MENU MOBILE
// ============================================
function initMobileMenu() {
  const menuToggle = document.getElementById("menuToggle");
  const navMenu = document.getElementById("navMenu");

  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => {
      menuToggle.classList.toggle("active");
      navMenu.classList.toggle("active");
    });

    // Fecha ao clicar em link
    navMenu.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        menuToggle.classList.remove("active");
        navMenu.classList.remove("active");
      });
    });
  }
}

// ============================================
// INICIALIZAÇÃO
// ============================================
function init() {
  console.log("🚀 Inicializando Cabuloso News...");
  
  // Verifica se cache está disponível
  if (!window.cabulosoCacheModule) {
    console.error("❌ Cache module não encontrado! Aguardando...");
    setTimeout(init, 100);
    return;
  }

  initMobileMenu();
  loadMasterData();
}

// Inicia quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Expõe para debug
window.cabulosoNews = {
  reloadData: loadMasterData,
  clearCache: () => {
    sessionStorage.clear();
    location.reload();
  }
};

console.log("💡 Dica: Use window.cabulosoNews.reloadData() para recarregar dados");
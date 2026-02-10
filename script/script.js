// script.js - VERSÃO OTIMIZADA
import { getFromCache, saveToCache, getFromCacheAPI, saveToCacheAPI } from "./cache.js";

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
        <p style="margin-top:20px; font-size:18px; font-weight:600;">${message}</p>
        <button 
          onclick="location.reload()" 
          style="margin-top:20px; padding:12px 24px; background:#003399; color:white; border:none; border-radius:8px; cursor:pointer; font-size:16px; font-weight:600; transition: all 0.3s;"
          onmouseover="this.style.background='#002266'"
          onmouseout="this.style.background='#003399'"
        >
          🔄 Recarregar Página
        </button>
      </div>
    `;
  }
}

// ============================================
// LÓGICA MESTRE DE DADOS (UMA REQUISIÇÃO!)
// ============================================
async function loadMasterData() {
  const CACHE_KEY = "master_data_v3"; // v3 para limpar cache antigo
  console.log("🚀 Iniciando carga de dados...");

  try {
    // 1. Tenta sessionStorage primeiro (mais rápido)
    const cachedData = getFromCache(CACHE_KEY);
    if (cachedData) {
      console.log("📦 Dados recuperados do sessionStorage");
      distributeData(cachedData);
      hideLoadingScreen();
      return;
    }

    // 2. Tenta Cache API (persistente entre sessões)
    const cachedResponse = await getFromCacheAPI(CONFIG.apiUrl);
    if (cachedResponse) {
      console.log("📦 Dados recuperados do Cache API");
      const data = await cachedResponse.json();
      
      // Salva também no sessionStorage para próximas consultas
      saveToCache(CACHE_KEY, data, CONFIG.CACHE_TTL);
      
      distributeData(data);
      hideLoadingScreen();
      return;
    }

    // 3. Busca dados frescos (UMA requisição consolidada!)
    console.log("🌐 Buscando dados frescos do Worker...");
    
    const startTime = performance.now();
    
    const response = await fetch(`${CONFIG.apiUrl}&t=${Date.now()}`, {
      cache: 'no-cache',
      headers: {
        'Accept': 'application/json'
      }
    });

    const fetchTime = performance.now() - startTime;
    console.log(`⏱️ Tempo de resposta: ${Math.round(fetchTime)}ms`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Verifica se veio do cache do Worker
    const cacheStatus = response.headers.get('X-Cache');
    console.log(`📊 Status do cache do Worker: ${cacheStatus || 'N/A'}`);
    console.log("✅ Dados recebidos:", data);

    // 4. Valida dados
    if (!data || data.error) {
      throw new Error(data?.error || "Dados inválidos recebidos");
    }

    // 5. Salva em AMBOS os caches
    saveToCache(CACHE_KEY, data, CONFIG.CACHE_TTL);
    await saveToCacheAPI(CONFIG.apiUrl, response);

    // 6. Distribui para UI
    distributeData(data);

  } catch (error) {
    console.error("❌ Erro na carga de dados:", error);
    showErrorMessage(`Erro ao carregar dados: ${error.message}`);
  } finally {
    hideLoadingScreen();
  }
}

// ============================================
// DISTRIBUIÇÃO DE DADOS
// ============================================
function distributeData(data) {
  if (!data) {
    console.warn("⚠️ Nenhum dado para distribuir");
    return;
  }

  console.log("📤 Distribuindo dados para interface");

  // 1. Notícias
  if (data.noticias && Array.isArray(data.noticias) && data.noticias.length > 0) {
    initNews(data.noticias);
    console.log(`✅ ${data.noticias.length} notícias carregadas`);
  } else {
    console.warn("⚠️ Nenhuma notícia encontrada");
    const container = document.getElementById("newsContainer");
    if (container) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px; color:#999;">
          <i class="far fa-newspaper" style="font-size:48px;"></i>
          <p style="margin-top:20px;">Nenhuma notícia disponível no momento</p>
        </div>
      `;
    }
  }

  // 2. Tabela do Brasileiro
  if (data.tabelas?.brasileiro?.classificacao) {
    renderMiniTable(data.tabelas.brasileiro.classificacao);
    console.log("✅ Tabela do Brasileiro carregada");
  } else {
    console.warn("⚠️ Tabela do Brasileiro não encontrada");
  }

  // 3. Agenda (Próximos Jogos)
  if (data.agenda && Array.isArray(data.agenda) && data.agenda.length > 0) {
    renderNextMatches(data.agenda);
    console.log(`✅ ${data.agenda.length} jogos na agenda`);
  } else {
    console.warn("⚠️ Agenda não encontrada");
  }

  // 4. Resultados Recentes
  if (data.resultados && Array.isArray(data.resultados) && data.resultados.length > 0) {
    renderRecentResults(data.resultados);
    console.log(`✅ ${data.resultados.length} resultados carregados`);
  } else {
    console.warn("⚠️ Resultados não encontrados");
  }
}

// ============================================
// RENDERIZADORES (UI)
// ============================================

// --- 1. NOTÍCIAS ---
function initNews(noticiasData) {
  const container = document.getElementById("newsContainer");
  if (!container) return;

  // Ordena por data (mais recente primeiro)
  noticiasData.sort((a, b) => parseNewsDate(b.date) - parseNewsDate(a.date));
  allNews = noticiasData;
  displayedNewsCount = 0;

  container.innerHTML = "";
  renderMoreNews();

  // Configura botão "Carregar Mais"
  const loadMoreContainer = document.getElementById("loadMoreContainer");
  if (loadMoreContainer) {
    loadMoreContainer.style.display = allNews.length > NEWS_PER_PAGE ? "block" : "none";
    
    const btnLoadMore = document.getElementById("btnLoadMore");
    if (btnLoadMore) {
      btnLoadMore.onclick = renderMoreNews;
    }
  }
}

function renderMoreNews() {
  const container = document.getElementById("newsContainer");
  if (!container) return;

  const newsToShow = allNews.slice(
    displayedNewsCount,
    displayedNewsCount + NEWS_PER_PAGE
  );

  newsToShow.forEach((noticia) => {
    const newsCard = document.createElement("article");
    newsCard.className = "news-card";
    newsCard.onclick = () => {
      const url = noticia.url || noticia.link;
      if (url) window.open(url, "_blank");
    };

    const imgUrl = noticia.image || CONFIG.defaultImage;

    newsCard.innerHTML = `
      <div class="news-image">
        <img 
          src="${imgUrl}" 
          alt="${escapeHtml(noticia.title)}" 
          loading="lazy" 
          onerror="this.src='${CONFIG.defaultImage}'"
        >
        <div class="news-badge">${escapeHtml(noticia.fonte || "Notícia")}</div>
      </div>
      <div class="news-content">
        <div class="news-date">
          <i class="far fa-clock"></i> ${escapeHtml(noticia.date || "")}
        </div>
        <h3 class="news-title">${escapeHtml(noticia.title)}</h3>
        <div class="news-footer">
          <span class="read-more">Ler mais <i class="fas fa-arrow-right"></i></span>
        </div>
      </div>
    `;
    
    container.appendChild(newsCard);
  });

  displayedNewsCount += newsToShow.length;

  // Esconde botão se não há mais notícias
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
  
  tbody.innerHTML = top5
    .map((time, index) => {
      const isCruzeiro = time.nome?.toLowerCase().includes("cruzeiro");
      return `
        <tr class="${isCruzeiro ? "cruzeiro-row" : ""}">
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
    .join("");

  // Atualiza estatística de posição
  const cruzeiro = classificacao.find((t) =>
    t.nome?.toLowerCase().includes("cruzeiro")
  );
  
  const statPosition = document.getElementById("statPosition");
  if (statPosition && cruzeiro) {
    const posicao = cruzeiro.posicao || (classificacao.indexOf(cruzeiro) + 1);
    statPosition.textContent = `${posicao}º lugar`;
  }
}

// --- 3. PRÓXIMOS JOGOS ---
function renderNextMatches(agenda) {
  const container = document.getElementById("nextMatchesWidget");
  if (!container) return;

  const proximos = agenda.slice(0, 3);
  
  if (proximos.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:20px; color:#999;">
        <i class="far fa-calendar-times" style="font-size:32px;"></i>
        <p style="margin-top:10px;">Nenhum jogo agendado</p>
      </div>
    `;
    return;
  }

  container.innerHTML = proximos
    .map((jogo) => `
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
    `)
    .join("");

  // Atualiza estatística do próximo jogo
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
    container.innerHTML = `
      <div style="text-align:center; padding:20px; color:#999;">
        <i class="fas fa-futbol" style="font-size:32px;"></i>
        <p style="margin-top:10px;">Nenhum resultado recente</p>
      </div>
    `;
    return;
  }

  container.innerHTML = ultimosResultados
    .map((res) => {
      // Tratamento do Placar
      let score1 = "0", score2 = "0";
      if (res.score && res.score.includes("-")) {
        const partes = res.score.split("-");
        score1 = partes[0].trim();
        score2 = partes[1].trim();
      }

      const team1 = res.team1 || "Time 1";
      const team2 = res.team2 || "Time 2";

      // Lógica de Cores (Vitória, Empate, Derrota)
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
              <img 
                src="${res.logo1 || CONFIG.defaultImage}" 
                alt="${escapeHtml(team1)}" 
                loading="lazy" 
                onerror="this.src='${CONFIG.defaultImage}'"
              >
              <span>${escapeHtml(team1)}</span>
            </div>
            <span class="result-mini-score ${statusClass}">${score1} - ${score2}</span>
            <div class="result-mini-team">
              <img 
                src="${res.logo2 || CONFIG.defaultImage}" 
                alt="${escapeHtml(team2)}" 
                loading="lazy" 
                onerror="this.src='${CONFIG.defaultImage}'"
              >
              <span>${escapeHtml(team2)}</span>
            </div>
          </div>
          <div class="result-mini-info">
            ${escapeHtml(res.competition)} | ${escapeHtml(res.date)}
          </div>
        </div>
      `;
    })
    .join("");
}

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("🎯 Inicializando Cabuloso News...");
  
  // Menu Mobile
  const menuToggle = document.getElementById("menuToggle");
  const navMenu = document.getElementById("navMenu");
  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => {
      menuToggle.classList.toggle("active");
      navMenu.classList.toggle("active");
    });
  }

  // Carrega dados
  loadMasterData();
  
  // Fallback de segurança: esconde loading após 10s
  setTimeout(() => {
    hideLoadingScreen();
  }, 10000);
});

// ============================================
// FUNÇÕES GLOBAIS (expostas para HTML)
// ============================================

/**
 * Força refresh de todos os dados (limpa cache)
 */
const forceRefreshAll = async () => {
  console.log("🔄 Forçando refresh completo...");
  
  // Limpa sessionStorage
  sessionStorage.removeItem("cache_master_data_v3");
  
  // Limpa Cache API
  if ('caches' in window) {
    await caches.delete('cabuloso-v1');
  }
  
  // Recarrega página
  location.reload();
};

// Expõe para uso global
window.forceRefreshAll = forceRefreshAll;

// Debug no console
console.log("💡 Dica: Use window.cabulosoCache.stats() para ver estatísticas do cache");
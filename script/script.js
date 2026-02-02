/**
 * Cabuloso News - Script Principal
 * Portal do Cruzeiro Esporte Clube
 */

// ============================================
// CONFIGURAÇÕES
// ============================================
const CONFIG = {
  newsApiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/",
  tabelaApiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/",
  agendaApiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/",
  resultadosApiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/",
  webhookUrl: 'https://cabuloso-api.cabulosonews92.workers.dev/', 
};

// ============================================
// UTILITÁRIOS
// ============================================
const escapeHtml = (str) => {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
};

// ============================================
// LOADING SCREEN
// ============================================
const hideLoadingScreen = () => {
  const screen = document.getElementById("loadingScreen");
  if (screen) {
    setTimeout(() => {
      screen.classList.add("hidden");
    }, 800);
  }
};

// ============================================
// NAVEGAÇÃO MOBILE
// ============================================
const initMobileMenu = () => {
  const toggle = document.getElementById("menuToggle");
  const menu = document.getElementById("navMenu");

  if (!toggle || !menu) return;

  toggle.addEventListener("click", () => {
    toggle.classList.toggle("active");
    menu.classList.toggle("active");
  });

  menu.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      toggle.classList.remove("active");
      menu.classList.remove("active");
    });
  });
};

// ============================================
// FUNÇÃO DE CONVERSÃO DE DATA (MELHORADA)
// ============================================
const parseNewsDate = (dateStr) => {
  if (!dateStr) return 0;
  
  try {
    // Remove qualquer texto após "·" (incluindo a hora)
    let cleanDate = dateStr.split('·')[0].trim().toLowerCase();
    
    // Se ainda tiver números com barras (formato DD/MM/YYYY)
    if (cleanDate.includes('/')) {
      const [dia, mes, ano] = cleanDate.split('/');
      // Retorna timestamp para comparação
      return new Date(ano, mes - 1, dia).getTime();
    }
    
    // Formato "de janeiro de"
    const meses = {
      "janeiro": 0, "fevereiro": 1, "março": 2, "abril": 3, "maio": 4, "junho": 5,
      "julho": 6, "agosto": 7, "setembro": 8, "outubro": 9, "novembro": 10, "dezembro": 11
    };
    
    // Formato "23 de janeiro de 2026"
    const partes = cleanDate.split(' de ');
    if (partes.length >= 3) {
      const d = parseInt(partes[0]);
      const m = meses[partes[1]] || 0;
      const a = parseInt(partes[2]);
      return new Date(a, m, d).getTime();
    }
    
    // Tenta qualquer outro formato que o Date reconheça
    return new Date(cleanDate).getTime() || 0;
  } catch (e) { 
    console.warn(`Erro ao converter data: ${dateStr}`, e);
    return 0; 
  }
};

// ============================================
// VARIÁVEIS GLOBAIS PARA PAGINAÇÃO
// ============================================
let allNews = [];
let displayedNewsCount = 0;
const NEWS_PER_PAGE = 6;

// ============================================
// BUSCAR E ORGANIZAR NOTÍCIAS
// ============================================
const fetchNews = async () => {
  try {
    const response = await fetch(CONFIG.newsApiUrl);
    let data = await response.json();

    // Se a API retornar um Array [ {...} ], pegamos o primeiro item
    if (Array.isArray(data)) {
      data = data[0];
    }

    // Agora acessamos a chave 'noticias' dentro do objeto
    const news = data.noticias;

    if (!news || !Array.isArray(news)) {
      throw new Error("Formato de notícias inválido: chave 'noticias' não encontrada");
    }

    renderNews(news);
  } catch (error) {
    console.error("Erro notícias:", error);
    const container = document.getElementById("newsContainer");
    if (container) container.innerHTML = '<div class="error-cell">Erro ao carregar notícias</div>';
  }
};

// ============================================
// FUNÇÃO PARA RENDERIZAR MAIS NOTÍCIAS
// ============================================
const renderMoreNews = () => {
  const container = document.getElementById("newsContainer");
  const loadMoreContainer = document.getElementById("loadMoreContainer");

  if (!container || allNews.length === 0) return;

  const nextBatch = allNews.slice(
    displayedNewsCount,
    displayedNewsCount + NEWS_PER_PAGE,
  );

  nextBatch.forEach((item) => {
    const card = document.createElement("article");
    card.className = "news-card";
    
    // Define classe do badge baseado na fonte
    let badgeClass = "";
    if (item.fonte === "Samuca TV") {
      badgeClass = "news-badge--samuca";
    } else if (item.fonte === "Zeiro") {
      badgeClass = "news-badge--zeiro";
    }

    card.innerHTML = `
      <div class="news-image">
        <img src="${escapeHtml(item.image || CONFIG.defaultImage)}" 
             alt="${escapeHtml(item.title)}" 
             loading="lazy" 
             onerror="this.src='${CONFIG.defaultImage}'">
        <span class="news-badge ${badgeClass}">${escapeHtml(item.fonte || "Notícia")}</span>
      </div>
      <div class="news-content">
        <span class="news-date"><i class="far fa-clock"></i> ${escapeHtml(item.date || "")}</span>
        <h3 class="news-title">${escapeHtml(item.title)}</h3>
        <div class="news-footer">
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" class="read-more">
            Ler notícia <i class="fas fa-arrow-right"></i>
          </a>
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });

  displayedNewsCount += nextBatch.length;
  
  // Atualiza visibilidade do botão
  if (loadMoreContainer) {
    if (displayedNewsCount >= allNews.length) {
      loadMoreContainer.style.display = "none";
    }
  }
};

// ============================================
// WIDGETS - MINI TABELA
// ============================================
const fetchMiniTable = async () => {
  const container = document.getElementById("miniTableBody");
  try {
    const response = await fetch(CONFIG.tabelaApiUrl);
    let data = await response.json();

    if (Array.isArray(data)) {
      data = data[0];
    }

    // Acessa 'tabela_brasileiro' e depois 'classificacao'
    const tabelaWrap = data.tabela_brasileiro;
    
    if (!tabelaWrap || !tabelaWrap.classificacao) {
      throw new Error("Dados da tabela não encontrados no JSON");
    }

    renderMiniTable(tabelaWrap.classificacao);
  } catch (error) {
    console.error("Erro mini tabela:", error);
    if (container) container.innerHTML = '<tr><td colspan="3">Erro ao carregar</td></tr>';
  }
};

// ============================================
// WIDGETS - PRÓXIMOS JOGOS
// ============================================
const fetchNextMatches = async () => {
  try {
    const response = await fetch(CONFIG.agendaApiUrl);
    let data = await response.json();

    if (Array.isArray(data)) {
      data = data[0];
    }

    const agenda = data.agenda;
    if (!agenda) throw new Error("Agenda não encontrada no JSON");

    renderNextMatches(agenda);
  } catch (error) {
    console.error("Erro agenda:", error);
  }
};

// ============================================
// WIDGETS - ÚLTIMOS RESULTADOS (DINÂMICO)
// ============================================
const fetchRecentResults = async () => {
  try {
    const response = await fetch(CONFIG.resultadosApiUrl);
    let data = await response.json();

    if (Array.isArray(data)) {
      data = data[0];
    }

    const resultados = data.resultados;
    if (!resultados) throw new Error("Resultados não encontrados no JSON");

    renderRecentResults(resultados);
  } catch (error) {
    console.error("Erro resultados:", error);
  }
};

// ============================================
// INICIALIZAÇÃO
// ============================================
const init = () => {
  initMobileMenu();
  hideLoadingScreen();
  fetchNews();
  fetchMiniTable();
  fetchNextMatches();
  fetchRecentResults();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
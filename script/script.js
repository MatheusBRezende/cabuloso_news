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
  const container = document.getElementById("newsContainer");
  if (!container) return;

  try {
    const response = await fetch(`${CONFIG.newsApiUrl}?v=${Date.now()}`);
    
    if (!response.ok) {
      console.error(`ERRO ${response.status}: Caminho falhou -> ${CONFIG.newsApiUrl}`);
      throw new Error("Arquivo não encontrado");
    }

    const news = await response.json();
    
    // DEBUG: Mostra as datas originais e convertidas
    console.log("Notícias antes da ordenação:");
    news.forEach(item => {
      console.log(`${item.date} -> ${parseNewsDate(item.date)} -> ${new Date(parseNewsDate(item.date)).toLocaleDateString()}`);
    });
    
    // 1. ORDENAÇÃO: Mais recente primeiro (decrescente)
    news.sort((a, b) => parseNewsDate(b.date) - parseNewsDate(a.date));
    
    // DEBUG: Mostra após ordenação
    console.log("Notícias após ordenação:");
    news.forEach(item => {
      console.log(item.date);
    });
    
    // 2. Salva todas as notícias para paginação
    allNews = news;
    
    // 3. Reseta contador
    displayedNewsCount = 0;
    
    // 4. Limpa container
    container.innerHTML = '';
    
    // 5. Renderiza primeiro lote
    renderMoreNews();
    
    // 6. Mostra/Esconde botão "Carregar mais"
    const loadMoreContainer = document.getElementById("loadMoreContainer");
    if (loadMoreContainer) {
      if (allNews.length > NEWS_PER_PAGE) {
        loadMoreContainer.style.display = "block";
        
        // Configura evento do botão
        const btnLoadMore = document.getElementById("btnLoadMore");
        if (btnLoadMore) {
          btnLoadMore.onclick = renderMoreNews;
        }
      } else {
        loadMoreContainer.style.display = "none";
      }
    }

  } catch (error) {
    console.error("Erro detalhado:", error);
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: white;">
        <i class="fas fa-exclamation-circle" style="font-size: 2rem; color: #ff4444;"></i>
        <p>Não foi possível carregar as notícias. Verifique se a pasta 'backend' está na raiz do site.</p>
      </div>`;
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
  const tbody = document.getElementById("miniTableBody");

  if (!tbody) return;

  try {
    const response = await fetch(CONFIG.tabelaApiUrl, { cache: "no-cache" });

    if (!response.ok) throw new Error("Erro ao carregar tabela");

    const data = await response.json();

    if (!data.classificacao) throw new Error("Dados inválidos");

    // Pegar top 5 times
    const top5 = data.classificacao.slice(0, 5);

    tbody.innerHTML = top5
      .map((time) => {
        const isCruzeiro = time.nome?.toLowerCase().includes("cruzeiro");

        return `
        <tr class="${isCruzeiro ? "cruzeiro-row" : ""}">
          <td>${time.posicao}º</td>
          <td>
            <div class="team-cell">
              <img src="${time.escudo || CONFIG.defaultImage}" alt="" class="team-logo" loading="lazy">
              <span>${escapeHtml(time.nome)}</span>
            </div>
          </td>
          <td><strong>${time.pontos}</strong></td>
        </tr>
      `;
      })
      .join("");

    // Atualizar stat de posição
    const cruzeiro = data.classificacao.find((t) =>
      t.nome?.toLowerCase().includes("cruzeiro"),
    );

    const statPosition = document.getElementById("statPosition");
    if (statPosition && cruzeiro) {
      statPosition.textContent = `${cruzeiro.posicao}º lugar`;
    }
  } catch (error) {
    console.error("Erro ao buscar mini tabela:", error);

    tbody.innerHTML =
      '<tr><td colspan="3" class="loading-cell">Erro ao carregar</td></tr>';
  }
};

// ============================================
// WIDGETS - PRÓXIMOS JOGOS
// ============================================
const fetchNextMatches = async () => {
  const container = document.getElementById("nextMatchesWidget");

  if (!container) return;

  try {
    const response = await fetch(CONFIG.agendaApiUrl, { cache: "no-cache" });

    if (!response.ok) throw new Error("Erro ao carregar agenda");

    const data = await response.json();

    const jogos = data.dados_completos || data || [];

    if (!Array.isArray(jogos) || jogos.length === 0) {
      container.innerHTML =
        '<div class="loading-cell">Nenhum jogo agendado.</div>';
      return;
    }

    const proximos = jogos.slice(0, 3);

    container.innerHTML = proximos
      .map(
        (jogo) => `
      <div class="match-item">
        <div class="match-item-date">
          <i class="far fa-calendar"></i>
          ${escapeHtml(jogo.data)} - ${escapeHtml(jogo.hora)}
        </div>
        <div class="match-item-teams">
          <div class="match-team-widget">
            <img src="${jogo.escudo_mandante || CONFIG.defaultImage}" alt="">
            <span>${escapeHtml(jogo.mandante)}</span>
          </div>
          <span class="match-score-widget">X</span>
          <div class="match-team-widget">
            <span>${escapeHtml(jogo.visitante)}</span>
            <img src="${jogo.escudo_visitante || CONFIG.defaultImage}" alt="">
          </div>
        </div>
        <div class="match-item-competition">${escapeHtml(jogo.campeonato)}</div>
      </div>
    `,
      )
      .join("");

    // Atualizar stat de próximo jogo
    const statNextGame = document.getElementById("statNextGame");
    if (statNextGame && proximos.length > 0) {
      const prox = proximos[0];
      const opponent = prox.mandante?.toLowerCase().includes("cruzeiro")
        ? prox.visitante
        : prox.mandante;
      statNextGame.textContent = `${prox.data?.split(" ")[0] || ""} vs ${opponent || "Adversário"}`;
    }
  } catch (error) {
    console.error("Erro ao buscar próximos jogos:", error);
    container.innerHTML =
      '<div class="loading-cell">Erro ao carregar jogos.</div>';
  }
};

// ============================================
// WIDGETS - ÚLTIMOS RESULTADOS (DINÂMICO)
// ============================================
const fetchRecentResults = async () => {
  // AQUI ESTAVA O ERRO: Mudamos de "recentResultsContainer" para "recentResultsWidget"
  const container = document.getElementById("recentResultsWidget"); 
  
  if (!container) {
    console.error("ERRO: Elemento 'recentResultsWidget' não encontrado no HTML.");
    return;
  }

  try {
    const response = await fetch(`${CONFIG.resultadosApiUrl}?v=${Date.now()}`);
    
    if (!response.ok) throw new Error("Erro ao carregar arquivo de resultados");

    const data = await response.json();
    const resultsArray = Array.isArray(data) ? data : (data.results || []);

    if (resultsArray.length === 0) {
      container.innerHTML = '<div class="loading-cell">Nenhum resultado.</div>';
      return;
    }

    // Pega apenas os 5 últimos
    const ultimosResultados = resultsArray.slice(0, 5);

    container.innerHTML = ultimosResultados.map(res => {
        const scoreStr = res.score || "0 - 0";
        // Verifica se Cruzeiro é o time 1 ou 2 para pintar a bolinha de verde/vermelho
        const isCruzeiroMandante = (res.team1 || "").toLowerCase().includes("cruzeiro");
        
        let statusClass = "draw"; // Padrão empate
        if (scoreStr.includes("-")) {
          const [s1, s2] = scoreStr.split("-").map(s => parseInt(s.trim()));
          
          if (!isNaN(s1) && !isNaN(s2)) {
            if (s1 === s2) statusClass = "draw";
            else if (isCruzeiroMandante) {
              statusClass = s1 > s2 ? "win" : "loss";
            } else {
              statusClass = s2 > s1 ? "win" : "loss";
            }
          }
        }

        return `
        <div class="result-mini">
          <div class="result-mini-teams">
            <div class="result-mini-team">
              <img src="${escapeHtml(res.logo1 || CONFIG.defaultImage)}" alt="${escapeHtml(res.team1)}">
              <span>${escapeHtml(res.team1)}</span>
            </div>
            <span class="result-mini-score ${statusClass}">${escapeHtml(scoreStr)}</span>
            <div class="result-mini-team">
              <img src="${escapeHtml(res.logo2 || CONFIG.defaultImage)}" alt="${escapeHtml(res.team2)}">
              <span>${escapeHtml(res.team2)}</span>
            </div>
          </div>
          <div class="result-mini-info">${escapeHtml(res.competition)}</div>
        </div>`;
    }).join("");

  } catch (error) {
    console.error("Erro resultados:", error);
    container.innerHTML = '<div class="loading-cell">Indisponível</div>';
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
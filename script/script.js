/**
 * Cabuloso News - Script Principal (Design Original + Worker Fix)
 */

const CONFIG = {
  newsApiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/",
  tabelaApiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/",
  agendaApiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/",
  resultadosApiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/",
  defaultImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/200px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png'
};

const escapeHtml = (str) => {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
};

// ============================================
// UTILITÁRIOS DE DATA (DO ANTIGO)
// ============================================
const parseNewsDate = (dateStr) => {
  if (!dateStr) return 0;
  
  try {
    let cleanDate = dateStr.split('·')[0].trim().toLowerCase();
    
    if (cleanDate.includes('/')) {
      const [dia, mes, ano] = cleanDate.split('/');
      return new Date(ano, mes - 1, dia).getTime();
    }
    
    const meses = {
      "janeiro": 0, "fevereiro": 1, "março": 2, "abril": 3, "maio": 4, "junho": 5,
      "julho": 6, "agosto": 7, "setembro": 8, "outubro": 9, "novembro": 10, "dezembro": 11
    };
    
    const partes = cleanDate.split(' de ');
    if (partes.length >= 3) {
      const d = parseInt(partes[0]);
      const m = meses[partes[1]] || 0;
      const a = parseInt(partes[2]);
      return new Date(a, m, d).getTime();
    }
    
    return new Date(cleanDate).getTime() || 0;
  } catch (e) { 
    console.warn(`Erro ao converter data: ${dateStr}`, e);
    return 0; 
  }
};

// ============================================
// VARIÁVEIS PARA PAGINAÇÃO (DO ANTIGO)
// ============================================
let allNews = [];
let displayedNewsCount = 0;
const NEWS_PER_PAGE = 6;

// ============================================
// BUSCA DE DADOS (AJUSTADO PARA A ESTRUTURA DA WORKER)
// ============================================

const fetchNews = async () => {
  const container = document.getElementById("newsContainer");
  if (!container) return;

  try {
    const response = await fetch(CONFIG.newsApiUrl);
    let data = await response.json();
    if (Array.isArray(data)) data = data[0]; 

    if (!data || !data.noticias) {
      throw new Error("Dados de notícias não encontrados");
    }

    // DEBUG: Mostra as datas originais e convertidas
    console.log("Notícias antes da ordenação:");
    data.noticias.forEach(item => {
      console.log(`${item.date} -> ${parseNewsDate(item.date)} -> ${new Date(parseNewsDate(item.date)).toLocaleDateString()}`);
    });
    
    // 1. ORDENAÇÃO: Mais recente primeiro (decrescente)
    data.noticias.sort((a, b) => parseNewsDate(b.date) - parseNewsDate(a.date));
    
    // 2. Salva todas as notícias para paginação
    allNews = data.noticias;
    
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
        <p>Não foi possível carregar as notícias.</p>
      </div>`;
  }
};

// ============================================
// FUNÇÃO PARA RENDERIZAR MAIS NOTÍCIAS (ESTILO ANTIGO)
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

const fetchMiniTable = async () => {
  const tbody = document.getElementById("miniTableBody");

  if (!tbody) return;

  try {
    const response = await fetch(CONFIG.tabelaApiUrl);
    let data = await response.json();
    if (Array.isArray(data)) data = data[0];

    if (!data || !data.tabela_brasileiro || !data.tabela_brasileiro.classificacao) {
      throw new Error("Dados de tabela não encontrados");
    }

    // Pegar top 5 times
    const top5 = data.tabela_brasileiro.classificacao.slice(0, 5);

    tbody.innerHTML = top5
      .map((time, index) => {
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
      })
      .join("");

    // Atualizar stat de posição
    const cruzeiro = data.tabela_brasileiro.classificacao.find((t) =>
      t.nome?.toLowerCase().includes("cruzeiro"),
    );

    const statPosition = document.getElementById("statPosition");
    if (statPosition && cruzeiro) {
      statPosition.textContent = `${cruzeiro.posicao || "?"}º lugar`;
    }
  } catch (error) {
    console.error("Erro ao buscar mini tabela:", error);

    tbody.innerHTML =
      '<tr><td colspan="3" class="loading-cell">Erro ao carregar</td></tr>';
  }
};

const fetchNextMatches = async () => {
  const container = document.getElementById("nextMatchesWidget"); // MUDADO para nextMatchesWidget

  if (!container) return;

  try {
    const response = await fetch(CONFIG.agendaApiUrl);
    let data = await response.json();
    if (Array.isArray(data)) data = data[0];
    
    if (!data || !data.agenda) {
      throw new Error("Dados de agenda não encontrados");
    }

    const proximos = data.agenda.slice(0, 3); // MUDADO para 3 jogos como no antigo

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
    `
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

const fetchRecentResults = async () => {
  const container = document.getElementById("recentResultsWidget"); // MUDADO para recentResultsWidget
  
  if (!container) {
    console.error("ERRO: Elemento 'recentResultsWidget' não encontrado no HTML.");
    return;
  }

  try {
    const response = await fetch(CONFIG.resultadosApiUrl);
    let data = await response.json();
    if (Array.isArray(data)) data = data[0];
    
    if (!data || !data.resultados) {
      throw new Error("Dados de resultados não encontrados");
    }

    // Pega apenas os 5 últimos (como no antigo)
    const ultimosResultados = data.resultados.slice(0, 5);

    container.innerHTML = ultimosResultados.map(res => {
        const isCruzeiroMandante = (res.team1 || "").toLowerCase().includes("cruzeiro");
        
        let statusClass = "draw"; // Padrão empate
        const s1 = parseInt(res.score1 || 0);
        const s2 = parseInt(res.score2 || 0);
        
        if (!isNaN(s1) && !isNaN(s2)) {
          if (s1 === s2) {
            statusClass = "draw";
          } else if (isCruzeiroMandante) {
            statusClass = s1 > s2 ? "win" : "loss";
          } else {
            statusClass = s2 > s1 ? "win" : "loss";
          }
        }

        return `
        <div class="result-mini">
          <div class="result-mini-teams">
            <div class="result-mini-team">
              <img src="${escapeHtml(res.logo1 || CONFIG.defaultImage)}" alt="${escapeHtml(res.team1)}" loading="lazy">
              <span>${escapeHtml(res.team1)}</span>
            </div>
            <span class="result-mini-score ${statusClass}">${escapeHtml(res.score1)} x ${escapeHtml(res.score2)}</span>
            <div class="result-mini-team">
              <img src="${escapeHtml(res.logo2 || CONFIG.defaultImage)}" alt="${escapeHtml(res.team2)}" loading="lazy">
              <span>${escapeHtml(res.team2)}</span>
            </div>
          </div>
          <div class="result-mini-info">${escapeHtml(res.competition || '')}</div>
        </div>`;
    }).join("");

  } catch (error) {
    console.error("Erro resultados:", error);
    container.innerHTML = '<div class="loading-cell">Indisponível</div>';
  }
};

// ============================================
// INICIALIZAÇÃO E MENU MOBILE
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

const hideLoadingScreen = () => {
  const screen = document.getElementById("loadingScreen");
  if (screen) {
    setTimeout(() => {
      screen.classList.add("hidden");
    }, 800);
  }
};

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
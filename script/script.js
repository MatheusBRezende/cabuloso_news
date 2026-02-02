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
// BUSCA DE DADOS (AJUSTADO PARA A ESTRUTURA DA WORKER)
// ============================================

const fetchNews = async () => {
  try {
    const response = await fetch(CONFIG.newsApiUrl);
    let data = await response.json();
    if (Array.isArray(data)) data = data[0]; 

    if (data.noticias) renderNews(data.noticias);
  } catch (error) {
    console.error("Erro notícias:", error);
  }
};

const fetchMiniTable = async () => {
  try {
    const response = await fetch(CONFIG.tabelaApiUrl);
    let data = await response.json();
    if (Array.isArray(data)) data = data[0];

    if (data.tabela_brasileiro && data.tabela_brasileiro.classificacao) {
      renderMiniTable(data.tabela_brasileiro.classificacao);
    }
  } catch (error) {
    console.error("Erro mini tabela:", error);
  }
};

const fetchNextMatches = async () => {
  try {
    const response = await fetch(CONFIG.agendaApiUrl);
    let data = await response.json();
    if (Array.isArray(data)) data = data[0];
    
    if (data.agenda) renderNextMatches(data.agenda);
  } catch (error) {
    console.error("Erro agenda:", error);
  }
};

const fetchRecentResults = async () => {
  try {
    const response = await fetch(CONFIG.resultadosApiUrl);
    let data = await response.json();
    if (Array.isArray(data)) data = data[0];
    
    if (data.resultados) renderRecentResults(data.resultados);
  } catch (error) {
    console.error("Erro resultados:", error);
  }
};

// ============================================
// RENDERIZAÇÃO (DESIGN ORIGINAL RESTAURADO)
// ============================================

const renderNews = (news) => {
  const container = document.getElementById("newsContainer");
  if (!container) return;

  container.innerHTML = news.map(item => `
    <article class="news-card">
      <a href="${item.url}" target="_blank">
        <img src="${item.image || CONFIG.defaultImage}" alt="${escapeHtml(item.title)}">
        <div class="news-content">
          <span class="news-source">${escapeHtml(item.fonte)}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <span class="news-date">${escapeHtml(item.date || '')}</span>
        </div>
      </a>
    </article>
  `).join("");
};

const renderMiniTable = (classificacao) => {
  const container = document.getElementById("miniTableBody");
  if (!container) return;

  container.innerHTML = classificacao.slice(0, 5).map((team, index) => `
    <tr>
      <td>${index + 1}º</td>
      <td class="team-cell">
        <img src="${team.escudo}" alt="${team.nome}">
        <span>${team.nome}</span>
      </td>
      <td><strong>${team.pontos}</strong></td>
    </tr>
  `).join("");
};

const renderNextMatches = (agenda) => {
  const container = document.getElementById("nextMatchesContainer");
  if (!container) return;
  
  // Design Original dos Cards de Próximos Jogos
  const proximos = agenda.slice(0, 2);
  container.innerHTML = proximos.map(jogo => `
    <div class="match-mini">
      <div class="match-mini-header">${escapeHtml(jogo.campeonato)}</div>
      <div class="match-mini-teams">
        <div class="match-mini-team">
            <img src="${jogo.escudo_mandante || CONFIG.defaultImage}" alt="${jogo.mandante}">
            <span>${escapeHtml(jogo.mandante)}</span>
        </div>
        <span class="vs">vs</span>
        <div class="match-mini-team">
            <img src="${jogo.escudo_visitante || CONFIG.defaultImage}" alt="${jogo.visitante}">
            <span>${escapeHtml(jogo.visitante)}</span>
        </div>
      </div>
      <div class="match-mini-footer">
        <span><i class="far fa-calendar-alt"></i> ${jogo.data}</span>
        <span><i class="far fa-clock"></i> ${jogo.hora}</span>
      </div>
    </div>
  `).join("");
};

const renderRecentResults = (resultados) => {
  const container = document.getElementById("recentResultsContainer");
  if (!container) return;

  const ultimos = resultados.slice(0, 2);
  container.innerHTML = ultimos.map(res => {
    // Lógica de cores (win/loss/draw) baseada no seu script original
    const s1 = parseInt(res.score1);
    const s2 = parseInt(res.score2);
    let statusClass = "draw";
    if (res.team1.includes("Cruzeiro")) {
        statusClass = s1 > s2 ? "win" : (s1 < s2 ? "loss" : "draw");
    } else {
        statusClass = s2 > s1 ? "win" : (s2 < s1 ? "loss" : "draw");
    }

    return `
    <div class="result-mini">
      <div class="result-mini-teams">
        <div class="result-mini-team">
          <img src="${res.logo1 || CONFIG.defaultImage}" alt="${res.team1}">
          <span>${escapeHtml(res.team1)}</span>
        </div>
        <span class="result-mini-score ${statusClass}">${res.score1} x ${res.score2}</span>
        <div class="result-mini-team">
          <img src="${res.logo2 || CONFIG.defaultImage}" alt="${res.team2}">
          <span>${escapeHtml(res.team2)}</span>
        </div>
      </div>
      <div class="result-mini-info">${escapeHtml(res.competition || '')}</div>
    </div>`;
  }).join("");
};

// ============================================
// INICIALIZAÇÃO E MENU MOBILE
// ============================================
const initMobileMenu = () => {
  const toggle = document.getElementById("menuToggle");
  const menu = document.getElementById("navMenu");
  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("active");
      menu.classList.toggle("active");
    });
  }
};

const init = () => {
  initMobileMenu();
  fetchNews();
  fetchMiniTable();
  fetchNextMatches();
  fetchRecentResults();
  
  // Esconde o loading screen
  const screen = document.getElementById("loadingScreen");
  if (screen) {
    setTimeout(() => screen.classList.add("hidden"), 800);
  }
};

document.addEventListener("DOMContentLoaded", init);
/**
 * Cabuloso News - Script Principal (VERSÃO CORRIGIDA WORKER)
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
// BUSCA DE DADOS (CORRIGIDO PARA ARRAY [0])
// ============================================

const fetchNews = async () => {
  try {
    const response = await fetch(CONFIG.newsApiUrl);
    let data = await response.json();
    if (Array.isArray(data)) data = data[0]; // Trata o formato do n8n

    const news = data.noticias;
    if (!news) throw new Error("Notícias não encontradas");
    
    renderNews(news);
  } catch (error) {
    console.error("Erro notícias:", error);
  }
};

const fetchMiniTable = async () => {
  try {
    const response = await fetch(CONFIG.tabelaApiUrl);
    let data = await response.json();
    if (Array.isArray(data)) data = data[0];

    const tabela = data.tabela_brasileiro;
    if (tabela && tabela.classificacao) {
      renderMiniTable(tabela.classificacao);
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
// FUNÇÕES DE RENDERIZAÇÃO (O QUE ESTAVA FALTANDO)
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
  
  const proximos = agenda.slice(0, 2);
  container.innerHTML = proximos.map(jogo => `
    <div class="match-mini">
      <div class="match-mini-header">${escapeHtml(jogo.campeonato)}</div>
      <div class="match-mini-teams">
        <span>${escapeHtml(jogo.mandante)}</span>
        <span>vs</span>
        <span>${escapeHtml(jogo.visitante)}</span>
      </div>
      <div class="match-mini-footer">${jogo.data} - ${jogo.hora}</div>
    </div>
  `).join("");
};

const renderRecentResults = (resultados) => {
  const container = document.getElementById("recentResultsContainer");
  if (!container) return;

  const ultimos = resultados.slice(0, 2);
  container.innerHTML = ultimos.map(res => `
    <div class="result-mini">
       <div class="result-mini-teams">
          <span>${res.team1} ${res.score1} x ${res.score2} ${res.team2}</span>
       </div>
    </div>
  `).join("");
};

// ============================================
// INICIALIZAÇÃO
// ============================================
const init = () => {
  fetchNews();
  fetchMiniTable();
  fetchNextMatches();
  fetchRecentResults();
  
  // Esconde o loading após 1 segundo
  setTimeout(() => {
    const screen = document.getElementById("loadingScreen");
    if (screen) screen.classList.add("hidden");
  }, 1000);
};

document.addEventListener("DOMContentLoaded", init);
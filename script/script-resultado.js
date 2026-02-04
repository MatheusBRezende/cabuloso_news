import { getFromCache, saveToCache } from './cache.js';

const CONFIG_RESULTADOS = {
  apiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/dados",
  itemsPerPage: 12,
  defaultLogo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/200px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png',
  CACHE_TTL: 15 * 60 * 1000 
};

const state = {
  allResults: [],
  filteredResults: [],
  currentPage: 1,
  currentView: 'cards',
  currentCompetition: 'all',
  stats: { total: 0, vitorias: 0, empates: 0, derrotas: 0 }
};

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initViewToggle();
  initCompetitionTabs();
  initPagination();
  loadResultados();
});

const initNavigation = () => {
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('nav-menu');

  if (!menuToggle || !navMenu) return;

  menuToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    const isExpanded = navMenu.classList.contains('active');
    menuToggle.setAttribute('aria-expanded', isExpanded);
  });

  navMenu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('active');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
};

const initViewToggle = () => {
  const viewBtns = document.querySelectorAll('.view-btn');

  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      viewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentView = view;
      renderResults();
    });
  });
};


const initCompetitionTabs = () => {
  const tabs = document.querySelectorAll('.tab-btn');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const competition = tab.dataset.competition;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentCompetition = competition;
      filterByCompetition();
      updateStatsCards();
    });
  });
};

const initPagination = () => {
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderResults();
        updatePagination();
        scrollToTop();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(state.filteredResults.length / CONFIG_RESULTADOS.itemsPerPage);
      if (state.currentPage < totalPages) {
        state.currentPage++;
        renderResults();
        updatePagination();
        scrollToTop();
      }
    });
  }
};

const updatePagination = () => {
  const totalPages = Math.ceil(state.filteredResults.length / CONFIG_RESULTADOS.itemsPerPage);
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');

  if (pageInfo) pageInfo.textContent = `Página ${state.currentPage} de ${totalPages || 1}`;
  if (prevBtn) prevBtn.disabled = state.currentPage === 1;
  if (nextBtn) nextBtn.disabled = state.currentPage >= totalPages;
};

const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

const loadResultados = async () => {
  const CACHE_KEY = 'master_data'; 
  showLoading();

  try {
    let data;

    const cached = getFromCache(CACHE_KEY);
    
    if (cached) {
      console.log("📦 Resultados: Usando Cache Central");
      data = cached;
    } else {
      console.log("🌐 Resultados: Buscando novos dados...");
      const response = await fetch(`${CONFIG_RESULTADOS.apiUrl}?t=${Date.now()}`);
      if (!response.ok) throw new Error('Erro ao carregar dados');

      let rawData = await response.json();
      if (Array.isArray(rawData)) rawData = rawData[0];
      
      data = rawData;
      // Salva no cache central
      saveToCache(CACHE_KEY, data, CONFIG_RESULTADOS.CACHE_TTL);
    }

    if (data.resultados) {
      state.allResults = data.resultados;
    } else {
      throw new Error("Chave 'resultados' não encontrada");
    }

    if (state.allResults.length === 0) {
      showEmpty();
      return;
    }

    state.filteredResults = [...state.allResults];
    calculateStats();
    updateHeaderStats();
    updateStatsCards();
    renderHorizontalHistory();
    renderResults();
    updatePagination();

  } catch (error) {
    console.error('Erro ao carregar resultados:', error);
    showError();
  }
};

const filterByCompetition = () => {
  if (state.currentCompetition === 'all') {
    state.filteredResults = [...state.allResults];
  } else {
    // Filtro mais flexível (case insensitive)
    state.filteredResults = state.allResults.filter(r => 
      r.competition && r.competition.toLowerCase().includes(state.currentCompetition.toLowerCase())
    );
  }
  state.currentPage = 1;
  renderResults();
  updatePagination();
};

const calculateStats = () => {
  const stats = { total: state.allResults.length, vitorias: 0, empates: 0, derrotas: 0 };

  state.allResults.forEach(res => {
    let s1 = 0, s2 = 0;
    
    // Tratamento robusto do placar
    if (res.score1 !== undefined) {
       s1 = parseInt(res.score1); s2 = parseInt(res.score2);
    } else if (res.score) {
       const parts = res.score.split(/[\sx\-]+/); // Separa por espaço, x ou hífen
       if (parts.length >= 2) { s1 = parseInt(parts[0]); s2 = parseInt(parts[1]); }
    }

    const team1 = res.team1 || res.mandante || "";
    const isCruzeiroHome = team1.toLowerCase().includes('cruzeiro');

    if (isNaN(s1) || isNaN(s2)) return;

    if (isCruzeiroHome) {
      if (s1 > s2) stats.vitorias++;
      else if (s1 < s2) stats.derrotas++;
      else stats.empates++;
    } else {
      if (s2 > s1) stats.vitorias++;
      else if (s2 < s1) stats.derrotas++;
      else stats.empates++;
    }
  });

  state.stats = stats;
};

const updateHeaderStats = () => {
  const elements = {
    total: document.getElementById('statTotalGames'),
    vitorias: document.getElementById('statVitorias'),
    empates: document.getElementById('statEmpates'),
    derrotas: document.getElementById('statDerrotas')
  };

  if (elements.total) elements.total.textContent = state.stats.total;
  if (elements.vitorias) elements.vitorias.textContent = state.stats.vitorias;
  if (elements.empates) elements.empates.textContent = state.stats.empates;
  if (elements.derrotas) elements.derrotas.textContent = state.stats.derrotas;
};

const updateStatsCards = () => {
  const container = document.getElementById('statsGridContainer');
  if (!container) return;

  const filtered = state.filteredResults;
  let vitorias = 0, empates = 0, derrotas = 0, golsMarcados = 0, golsSofridos = 0;

  filtered.forEach(res => {
    let s1 = 0, s2 = 0;
    if (res.score1 !== undefined) {
       s1 = parseInt(res.score1); s2 = parseInt(res.score2);
    } else if (res.score) {
       const parts = res.score.split(/[\sx\-]+/);
       if (parts.length >= 2) { s1 = parseInt(parts[0]); s2 = parseInt(parts[1]); }
    }

    if (isNaN(s1) || isNaN(s2)) return;

    const team1 = res.team1 || res.mandante || "";
    const isCruzeiroHome = team1.toLowerCase().includes('cruzeiro');

    if (isCruzeiroHome) {
      golsMarcados += s1; golsSofridos += s2;
      if (s1 > s2) vitorias++; else if (s1 < s2) derrotas++; else empates++;
    } else {
      golsMarcados += s2; golsSofridos += s1;
      if (s2 > s1) vitorias++; else if (s2 < s1) derrotas++; else empates++;
    }
  });

  const totalJogos = vitorias + empates + derrotas;
  const aproveitamento = totalJogos > 0 
    ? Math.round((vitorias * 3 + empates) / (totalJogos * 3) * 100) 
    : 0;

  container.innerHTML = `
    <div class="stat-card-item"><span class="value">${totalJogos}</span><span class="label">Jogos</span></div>
    <div class="stat-card-item"><span class="value">${vitorias}</span><span class="label">Vitórias</span></div>
    <div class="stat-card-item"><span class="value">${empates}</span><span class="label">Empates</span></div>
    <div class="stat-card-item"><span class="value">${derrotas}</span><span class="label">Derrotas</span></div>
    <div class="stat-card-item"><span class="value">${golsMarcados}</span><span class="label">Gols Pró</span></div>
    <div class="stat-card-item"><span class="value">${golsSofridos}</span><span class="label">Gols Contra</span></div>
    <div class="stat-card-item"><span class="value">${aproveitamento}%</span><span class="label">Aproveitamento</span></div>
  `;
};

const renderHorizontalHistory = () => {
  const container = document.getElementById('horizontalMatches');
  if (!container) return;

  const recent = state.allResults.slice(0, 10);

  container.innerHTML = recent.map(res => {
    let s1 = 0, s2 = 0;
    if (res.score) {
       const parts = res.score.split(/[\sx\-]+/);
       if (parts.length >= 2) { s1 = parseInt(parts[0]); s2 = parseInt(parts[1]); }
    }

    const team1 = res.team1 || res.mandante || "Time 1";
    const team2 = res.team2 || res.visitante || "Time 2";
    const isCruzeiroHome = team1.toLowerCase().includes('cruzeiro');
    
    let resultClass = 'empate';
    if (!isNaN(s1) && !isNaN(s2)) {
        if (isCruzeiroHome) resultClass = s1 > s2 ? 'vitoria' : (s1 < s2 ? 'derrota' : 'empate');
        else resultClass = s2 > s1 ? 'vitoria' : (s2 < s1 ? 'derrota' : 'empate');
    }

    return `
      <div class="horizontal-match-card ${resultClass}">
        <div class="horizontal-card-header">
          <span>${escapeHtml(res.competition)}</span>
          <span>${escapeHtml(res.date)}</span>
        </div>
        <div class="horizontal-card-teams">
          <div class="horizontal-card-team">
            <img src="${res.logo1 || CONFIG_RESULTADOS.defaultLogo}" alt="" class="team-logo-uniform" loading="lazy">
            <span class="${isCruzeiroHome ? 'home' : ''}">${escapeHtml(team1)}</span>
          </div>
          <span class="horizontal-card-score">${escapeHtml(res.score)}</span>
          <div class="horizontal-card-team">
            <img src="${res.logo2 || CONFIG_RESULTADOS.defaultLogo}" alt="" class="team-logo-uniform" loading="lazy">
            <span class="${!isCruzeiroHome ? 'home' : ''}">${escapeHtml(team2)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

const renderResults = () => {
  const start = (state.currentPage - 1) * CONFIG_RESULTADOS.itemsPerPage;
  const end = start + CONFIG_RESULTADOS.itemsPerPage;
  const pageResults = state.filteredResults.slice(start, end);

  if (state.currentView === 'cards') renderCardsView(pageResults);
  else renderTableView(pageResults);
};

const renderCardsView = (results) => {
  const cardsContainer = document.getElementById('resultsCards');
  const tableContainer = document.getElementById('resultsTable');

  if (cardsContainer) cardsContainer.style.display = 'grid';
  if (tableContainer) tableContainer.style.display = 'none';
  if (!cardsContainer) return;

  cardsContainer.innerHTML = results.map(res => {
    let s1 = 0, s2 = 0;
    if (res.score) {
       const parts = res.score.split(/[\sx\-]+/);
       if (parts.length >= 2) { s1 = parseInt(parts[0]); s2 = parseInt(parts[1]); }
    }

    const team1 = res.team1 || res.mandante || "Time 1";
    const team2 = res.team2 || res.visitante || "Time 2";
    const isCruzeiroHome = team1.toLowerCase().includes('cruzeiro');
    
    let resultClass = 'empate';
    if (!isNaN(s1) && !isNaN(s2)) {
        if (isCruzeiroHome) resultClass = s1 > s2 ? 'vitoria' : (s1 < s2 ? 'derrota' : 'empate');
        else resultClass = s2 > s1 ? 'vitoria' : (s2 < s1 ? 'derrota' : 'empate');
    }

    return `
      <div class="match-card ${resultClass}">
        <div class="card-header">
          <span>${escapeHtml(res.competition)}</span>
          <span>${escapeHtml(res.date)}</span>
        </div>
        <div class="card-teams">
          <div class="card-team">
            <img src="${res.logo1 || CONFIG_RESULTADOS.defaultLogo}" alt="" loading="lazy" onerror="this.src='${CONFIG_RESULTADOS.defaultLogo}'">
            <span class="${isCruzeiroHome ? 'home' : ''}">${escapeHtml(team1)}</span>
          </div>
          <span class="card-score">${escapeHtml(res.score)}</span>
          <div class="card-team">
            <img src="${res.logo2 || CONFIG_RESULTADOS.defaultLogo}" alt="" loading="lazy" onerror="this.src='${CONFIG_RESULTADOS.defaultLogo}'">
            <span class="${!isCruzeiroHome ? 'home' : ''}">${escapeHtml(team2)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

const renderTableView = (results) => {
  const cardsContainer = document.getElementById('resultsCards');
  const tableContainer = document.getElementById('resultsTable');
  const tableBody = document.getElementById('resultsTableBody');

  if (cardsContainer) cardsContainer.style.display = 'none';
  if (tableContainer) tableContainer.style.display = 'block';
  if (!tableBody) return;

  tableBody.innerHTML = results.map(res => {
    let s1 = 0, s2 = 0;
    if (res.score) {
       const parts = res.score.split(/[\sx\-]+/);
       if (parts.length >= 2) { s1 = parseInt(parts[0]); s2 = parseInt(parts[1]); }
    }

    const team1 = res.team1 || res.mandante || "Time 1";
    const team2 = res.team2 || res.visitante || "Time 2";
    const isCruzeiroHome = team1.toLowerCase().includes('cruzeiro');
    
    let resultBadge = '';
    if (!isNaN(s1) && !isNaN(s2)) {
        if (isCruzeiroHome) {
          if (s1 > s2) resultBadge = '<span class="result-badge vitoria"><i class="fas fa-check"></i> Vitória</span>';
          else if (s1 < s2) resultBadge = '<span class="result-badge derrota"><i class="fas fa-times"></i> Derrota</span>';
          else resultBadge = '<span class="result-badge empate"><i class="fas fa-minus"></i> Empate</span>';
        } else {
          if (s2 > s1) resultBadge = '<span class="result-badge vitoria"><i class="fas fa-check"></i> Vitória</span>';
          else if (s2 < s1) resultBadge = '<span class="result-badge derrota"><i class="fas fa-times"></i> Derrota</span>';
          else resultBadge = '<span class="result-badge empate"><i class="fas fa-minus"></i> Empate</span>';
        }
    }

    return `
      <tr>
        <td>${escapeHtml(res.date)}</td>
        <td>
          <div class="match-teams">
            <img src="${res.logo1 || CONFIG_RESULTADOS.defaultLogo}" alt="" class="team-logo" loading="lazy">
            <span class="team-name ${isCruzeiroHome ? 'home' : ''}">${escapeHtml(team1)}</span>
            <span class="vs">vs</span>
            <span class="team-name ${!isCruzeiroHome ? 'home' : ''}">${escapeHtml(team2)}</span>
            <img src="${res.logo2 || CONFIG_RESULTADOS.defaultLogo}" alt="" class="team-logo" loading="lazy">
          </div>
        </td>
        <td><strong>${escapeHtml(res.score)}</strong></td>
        <td>${escapeHtml(res.competition)}</td>
        <td>${resultBadge}</td>
      </tr>
    `;
  }).join('');
};


const showLoading = () => {
  const cardsContainer = document.getElementById('resultsCards');
  if (cardsContainer) cardsContainer.innerHTML = `<div class="loading-state"><div class="loading-spinner"></div><p>Carregando resultados...</p></div>`;
};

const showError = () => {
  const cardsContainer = document.getElementById('resultsCards');
  if (cardsContainer) cardsContainer.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>Erro ao carregar resultados.</p><button class="btn-retry" onclick="loadResultados()"><i class="fas fa-sync-alt"></i> Tentar Novamente</button></div>`;
};

const showEmpty = () => {
  const cardsContainer = document.getElementById('resultsCards');
  if (cardsContainer) cardsContainer.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum resultado encontrado.</p></div>`;
};

const escapeHtml = (text) => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const init = () => {
  initNavigation();
  initViewToggle();
  initCompetitionTabs();
  initPagination();
  loadResultados();
};

window.retryLoadResultados = loadResultados;
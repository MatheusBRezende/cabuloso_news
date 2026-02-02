/**
 * Cabuloso News - Script de Resultados
 * Página de resultados completos dos jogos
 */

// ============================================
// CONFIGURAÇÃO
// ============================================
const CONFIG_RESULTADOS = {
  resultadosUrl: 'https://cabuloso-api.cabulosonews92.workers.dev/',
  itemsPerPage: 12,
  defaultLogo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/200px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png'
};

// ============================================
// ESTADO
// ============================================
const state = {
  allResults: [],
  filteredResults: [],
  currentPage: 1,
  currentView: 'cards',
  currentCompetition: 'all',
  stats: {
    total: 0,
    vitorias: 0,
    empates: 0,
    derrotas: 0
  }
};

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initViewToggle();
  initCompetitionTabs();
  initPagination();
  loadResultados();
});

// ============================================
// NAVEGAÇÃO MOBILE
// ============================================
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

// ============================================
// TOGGLE DE VISUALIZAÇÃO
// ============================================
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

// ============================================
// TABS DE COMPETIÇÃO
// ============================================
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

// ============================================
// PAGINAÇÃO
// ============================================
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

  if (pageInfo) {
    pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
  }

  if (prevBtn) {
    prevBtn.disabled = state.currentPage === 1;
  }

  if (nextBtn) {
    nextBtn.disabled = state.currentPage >= totalPages;
  }
};

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ============================================
// CARREGAR RESULTADOS
// ============================================
const loadResultados = async () => {
  showLoading();

  try {
    const response = await fetch(CONFIG_RESULTADOS.resultadosUrl, { cache: 'no-cache' });
    if (!response.ok) throw new Error('Erro ao carregar resultados');

    const data = await response.json();
    state.allResults = data.results || data || [];

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

// ============================================
// FILTRAR POR COMPETIÇÃO
// ============================================
const filterByCompetition = () => {
  if (state.currentCompetition === 'all') {
    state.filteredResults = [...state.allResults];
  } else {
    state.filteredResults = state.allResults.filter(
      r => r.competition === state.currentCompetition
    );
  }

  state.currentPage = 1;
  renderResults();
  updatePagination();
};

// ============================================
// CALCULAR ESTATÍSTICAS
// ============================================
const calculateStats = () => {
  const stats = {
    total: state.allResults.length,
    vitorias: 0,
    empates: 0,
    derrotas: 0
  };

  state.allResults.forEach(res => {
    const [score1, score2] = res.score.split(' - ').map(s => parseInt(s) || 0);
    const isCruzeiroHome = res.team1.toLowerCase().includes('cruzeiro');

    if (isCruzeiroHome) {
      if (score1 > score2) stats.vitorias++;
      else if (score1 < score2) stats.derrotas++;
      else stats.empates++;
    } else {
      if (score2 > score1) stats.vitorias++;
      else if (score2 < score1) stats.derrotas++;
      else stats.empates++;
    }
  });

  state.stats = stats;
};

// ============================================
// ATUALIZAR ESTATÍSTICAS DO HEADER
// ============================================
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

// ============================================
// ATUALIZAR CARDS DE ESTATÍSTICAS
// ============================================
const updateStatsCards = () => {
  const container = document.getElementById('statsGridContainer');
  if (!container) return;

  const filtered = state.currentCompetition === 'all' 
    ? state.allResults 
    : state.allResults.filter(r => r.competition === state.currentCompetition);

  let vitorias = 0, empates = 0, derrotas = 0, golsMarcados = 0, golsSofridos = 0;

  filtered.forEach(res => {
    const [score1, score2] = res.score.split(' - ').map(s => parseInt(s) || 0);
    const isCruzeiroHome = res.team1.toLowerCase().includes('cruzeiro');

    if (isCruzeiroHome) {
      golsMarcados += score1;
      golsSofridos += score2;
      if (score1 > score2) vitorias++;
      else if (score1 < score2) derrotas++;
      else empates++;
    } else {
      golsMarcados += score2;
      golsSofridos += score1;
      if (score2 > score1) vitorias++;
      else if (score2 < score1) derrotas++;
      else empates++;
    }
  });

  const aproveitamento = filtered.length > 0 
    ? Math.round((vitorias * 3 + empates) / (filtered.length * 3) * 100) 
    : 0;

  container.innerHTML = `
    <div class="stat-card-item">
      <span class="value">${filtered.length}</span>
      <span class="label">Jogos</span>
    </div>
    <div class="stat-card-item">
      <span class="value">${vitorias}</span>
      <span class="label">Vitórias</span>
    </div>
    <div class="stat-card-item">
      <span class="value">${empates}</span>
      <span class="label">Empates</span>
    </div>
    <div class="stat-card-item">
      <span class="value">${derrotas}</span>
      <span class="label">Derrotas</span>
    </div>
    <div class="stat-card-item">
      <span class="value">${golsMarcados}</span>
      <span class="label">Gols Marcados</span>
    </div>
    <div class="stat-card-item">
      <span class="value">${golsSofridos}</span>
      <span class="label">Gols Sofridos</span>
    </div>
    <div class="stat-card-item">
      <span class="value">${aproveitamento}%</span>
      <span class="label">Aproveitamento</span>
    </div>
  `;
};

// ============================================
// RENDERIZAR HISTÓRICO HORIZONTAL
// ============================================
const renderHorizontalHistory = () => {
  const container = document.getElementById('horizontalMatches');
  if (!container) return;

  const recent = state.allResults.slice(0, 10);

  container.innerHTML = recent.map(res => {
    const [score1, score2] = res.score.split(' - ').map(s => parseInt(s) || 0);
    const isCruzeiroHome = res.team1.toLowerCase().includes('cruzeiro');
    
    let resultClass = '';
    if (isCruzeiroHome) {
      resultClass = score1 > score2 ? 'vitoria' : (score1 < score2 ? 'derrota' : 'empate');
    } else {
      resultClass = score2 > score1 ? 'vitoria' : (score2 < score1 ? 'derrota' : 'empate');
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
            <span class="${isCruzeiroHome ? 'home' : ''}">${escapeHtml(res.team1)}</span>
          </div>
          <span class="horizontal-card-score">${escapeHtml(res.score)}</span>
          <div class="horizontal-card-team">
            <img src="${res.logo2 || CONFIG_RESULTADOS.defaultLogo}" alt="" class="team-logo-uniform" loading="lazy">
            <span class="${!isCruzeiroHome ? 'home' : ''}">${escapeHtml(res.team2)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

// ============================================
// RENDERIZAR RESULTADOS
// ============================================
const renderResults = () => {
  const start = (state.currentPage - 1) * CONFIG_RESULTADOS.itemsPerPage;
  const end = start + CONFIG_RESULTADOS.itemsPerPage;
  const pageResults = state.filteredResults.slice(start, end);

  if (state.currentView === 'cards') {
    renderCardsView(pageResults);
  } else {
    renderTableView(pageResults);
  }
};

const renderCardsView = (results) => {
  const cardsContainer = document.getElementById('resultsCards');
  const tableContainer = document.getElementById('resultsTable');

  if (cardsContainer) cardsContainer.style.display = 'grid';
  if (tableContainer) tableContainer.style.display = 'none';

  if (!cardsContainer) return;

  cardsContainer.innerHTML = results.map(res => {
    const [score1, score2] = res.score.split(' - ').map(s => parseInt(s) || 0);
    const isCruzeiroHome = res.team1.toLowerCase().includes('cruzeiro');
    
    let resultClass = '';
    if (isCruzeiroHome) {
      resultClass = score1 > score2 ? 'vitoria' : (score1 < score2 ? 'derrota' : 'empate');
    } else {
      resultClass = score2 > score1 ? 'vitoria' : (score2 < score1 ? 'derrota' : 'empate');
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
            <span class="${isCruzeiroHome ? 'home' : ''}">${escapeHtml(res.team1)}</span>
          </div>
          <span class="card-score">${escapeHtml(res.score)}</span>
          <div class="card-team">
            <img src="${res.logo2 || CONFIG_RESULTADOS.defaultLogo}" alt="" loading="lazy" onerror="this.src='${CONFIG_RESULTADOS.defaultLogo}'">
            <span class="${!isCruzeiroHome ? 'home' : ''}">${escapeHtml(res.team2)}</span>
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
    const [score1, score2] = res.score.split(' - ').map(s => parseInt(s) || 0);
    const isCruzeiroHome = res.team1.toLowerCase().includes('cruzeiro');
    
    let resultBadge = '';
    if (isCruzeiroHome) {
      if (score1 > score2) resultBadge = '<span class="result-badge vitoria"><i class="fas fa-check"></i> Vitória</span>';
      else if (score1 < score2) resultBadge = '<span class="result-badge derrota"><i class="fas fa-times"></i> Derrota</span>';
      else resultBadge = '<span class="result-badge empate"><i class="fas fa-minus"></i> Empate</span>';
    } else {
      if (score2 > score1) resultBadge = '<span class="result-badge vitoria"><i class="fas fa-check"></i> Vitória</span>';
      else if (score2 < score1) resultBadge = '<span class="result-badge derrota"><i class="fas fa-times"></i> Derrota</span>';
      else resultBadge = '<span class="result-badge empate"><i class="fas fa-minus"></i> Empate</span>';
    }

    return `
      <tr>
        <td>${escapeHtml(res.date)}</td>
        <td>
          <div class="match-teams">
            <img src="${res.logo1 || CONFIG_RESULTADOS.defaultLogo}" alt="" class="team-logo" loading="lazy">
            <span class="team-name ${isCruzeiroHome ? 'home' : ''}">${escapeHtml(res.team1)}</span>
            <span class="vs">vs</span>
            <span class="team-name ${!isCruzeiroHome ? 'home' : ''}">${escapeHtml(res.team2)}</span>
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

// ============================================
// ESTADOS DE CARREGAMENTO
// ============================================
const showLoading = () => {
  const cardsContainer = document.getElementById('resultsCards');
  if (cardsContainer) {
    cardsContainer.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Carregando resultados...</p>
      </div>
    `;
  }
};

const showError = () => {
  const cardsContainer = document.getElementById('resultsCards');
  if (cardsContainer) {
    cardsContainer.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Erro ao carregar resultados.</p>
        <button class="btn-retry" onclick="loadResultados()">
          <i class="fas fa-sync-alt"></i> Tentar Novamente
        </button>
      </div>
    `;
  }
};

const showEmpty = () => {
  const cardsContainer = document.getElementById('resultsCards');
  if (cardsContainer) {
    cardsContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <p>Nenhum resultado encontrado.</p>
      </div>
    `;
  }
};

// ============================================
// UTILITÁRIOS
// ============================================
const escapeHtml = (text) => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Exportar para uso global
window.loadResultados = loadResultados;
/**
 * Cabuloso News - Resultados dos Jogos
 * Versão 100% JSON - Sem conflitos de inicialização
 */

const CONFIG_RESULTADOS = {
  jsonUrl: './backend/resultados.json', 
  updateInterval: 60000,
  placeholderLogo: 'https://vignette.wikia.nocookie.net/p__/images/2/2a/Flag_placeholder.png/revision/latest?cb=20140706154316&path-prefix=protagonist'
};

const stateResultados = {
  isLoading: true,
  allResults: [],
  currentFilter: 'all',
  lastMatchesCount: 5
};

// --- LÓGICA DE DADOS ---

function determinarResultado(score, team1) {
  if (!score) return 'empate';
  const scores = score.split('-').map(s => parseInt(s.trim()) || 0);
  if (scores.length !== 2) return 'empate';
  const [golsT1, golsT2] = scores;
  const isCruzeiroHome = team1.toLowerCase().includes('cruzeiro');
  if (isCruzeiroHome) {
    if (golsT1 > golsT2) return 'vitoria';
    if (golsT1 < golsT2) return 'derrota';
    return 'empate';
  } else {
    if (golsT2 > golsT1) return 'vitoria';
    if (golsT2 < golsT1) return 'derrota';
    return 'empate';
  }
}

async function loadResults() {
  stateResultados.isLoading = true;
  const container = document.getElementById('results-cards');
  if (container) container.innerHTML = '<div class="loading-cell">Carregando...</div>';

try {
    const response = await fetch(`${CONFIG_RESULTADOS.jsonUrl}?t=${Date.now()}`);
    const data = await response.json();

    // AJUSTE AQUI: O seu JSON tem a chave "results"
    // Usamos o || [] para garantir que, se o arquivo estiver vazio, o código não quebre
    const rawList = data.results || []; 

    if (!Array.isArray(rawList)) {
      throw new Error("Os dados recebidos não são uma lista (Array). Verifique o JSON.");
    }

    stateResultados.allResults = rawList.map(item => ({
      ...item,
      resultadoStatus: determinarResultado(item.score, item.team1)
    }));

    renderHorizontalMatches();
    applyFilter(stateResultados.currentFilter);
    updateStats();

  } catch (error) {
    console.error('Erro ao carregar resultados:', error);
    showToast('Erro ao carregar dados dos resultados.', 'error');
  }
}


// --- FILTROS E RENDERIZAÇÃO ---

function applyFilter(filter) {
  stateResultados.currentFilter = filter;
  const filtered = stateResultados.allResults.filter(game => {
    if (filter === 'all') return true;
    return game.competition.includes(filter) || (filter === 'Campeonato' && game.competition === 'Campeonato Mineiro');
  });
  renderResultsList(filtered);
}

function renderResultsList(results) {
  const tbody = document.getElementById('results-tbody');
  const cardsContainer = document.getElementById('results-cards');
  const emptyState = document.getElementById('results-empty');
  const loadingState = document.getElementById('results-loading');

  if (!tbody || !cardsContainer) return;

  tbody.innerHTML = '';
  cardsContainer.innerHTML = '';
  loadingState.style.display = 'none'; // Garante que o carregando suma

  if (results.length === 0) {
    emptyState.style.display = 'block';
    document.getElementById('table-view').style.display = 'none';
    document.getElementById('cards-view').style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  
  // Decide qual visualização mostrar baseado no botão ativo
  const isTableView = document.getElementById('view-table').classList.contains('active');
  document.getElementById('table-view').style.display = isTableView ? 'block' : 'none';
  document.getElementById('cards-view').style.display = isTableView ? 'none' : 'block';

  results.forEach(game => {
    // Tabela
    tbody.innerHTML += `
      <tr>
        <td>${game.date}</td>
        <td><div class="match-teams">
          <span class="${game.isCruzeiroHome ? 'home' : ''}">${game.team1}</span> × 
          <span class="${!game.isCruzeiroHome ? 'home' : ''}">${game.team2}</span>
        </div></td>
        <td><span class="result-badge ${game.resultado}">${game.score}</span></td>
        <td>${game.competition}</td>
      </tr>`;

    // Cards
    cardsContainer.innerHTML += `
      <div class="match-card ${game.resultado}">
        <div class="card-header"><span>${game.competition}</span><span>${game.date}</span></div>
        <div class="card-teams">
          <div class="card-team"><img src="${game.logo1}" onerror="this.src='${CONFIG_RESULTADOS.placeholderLogo}'"><span>${game.team1}</span></div>
          <div class="card-score">${game.score}</div>
          <div class="card-team"><img src="${game.logo2}" onerror="this.src='${CONFIG_RESULTADOS.placeholderLogo}'"><span>${game.team2}</span></div>
        </div>
      </div>`;
  });
}

// --- ESTADOS E AUXILIARES ---

function updateStatistics() {
  const total = stateResultados.allResults.length;
  const vitorias = stateResultados.allResults.filter(g => g.resultado === 'vitoria').length;
  const empates = stateResultados.allResults.filter(g => g.resultado === 'empate').length;
  let gols = 0;
  stateResultados.allResults.forEach(g => {
    const s = g.score.split('-').map(x => parseInt(x.trim()) || 0);
    gols += g.isCruzeiroHome ? s[0] : s[1];
  });
  const aprov = total > 0 ? Math.round(((vitorias * 3 + empates) / (total * 3)) * 100) : 0;
  
  document.getElementById('preview-games').textContent = total;
  document.getElementById('preview-wins').textContent = vitorias;
  document.getElementById('preview-goals').textContent = gols;
  document.getElementById('preview-performance').textContent = `${aprov}%`;
}

function renderHorizontalMatches() {
  const container = document.getElementById('horizontal-matches');
  if (!container) return;
  const last = stateResultados.allResults.slice(0, 5);
  container.innerHTML = last.map(game => `
    <div class="horizontal-match-card ${game.resultado}">
      <div class="horizontal-card-header"><span>${game.competition}</span><span>${game.date}</span></div>
      <div class="horizontal-card-teams">
        <div class="horizontal-card-team"><img src="${game.logo1}" class="team-logo-uniform"><span>${game.team1}</span></div>
        <div class="horizontal-card-score">${game.score}</div>
        <div class="horizontal-card-team"><img src="${game.logo2}" class="team-logo-uniform"><span>${game.team2}</span></div>
      </div>
    </div>`).join('');
}

function showLoadingState() {
  document.getElementById('results-loading').style.display = 'block';
  document.getElementById('results-error').style.display = 'none';
  document.getElementById('results-empty').style.display = 'none';
}

function showErrorState() {
  document.getElementById('results-loading').style.display = 'none';
  document.getElementById('results-error').style.display = 'block';
}

function showToast(msg, type='info') {
  const container = document.getElementById('toast-container');
  if(!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// --- INICIALIZAÇÃO ÚNICA ---

document.addEventListener('DOMContentLoaded', () => {
  loadResults();

  // Filtros de competição
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.getAttribute('data-filter'));
    });
  });

  // Alternar visualização (Tabela/Cards)
  const viewTableBtn = document.getElementById('view-table');
  const viewCardsBtn = document.getElementById('view-cards');

  viewTableBtn.addEventListener('click', () => {
    viewTableBtn.classList.add('active');
    viewCardsBtn.classList.remove('active');
    applyFilter(stateResultados.currentFilter);
  });

  viewCardsBtn.addEventListener('click', () => {
    viewCardsBtn.classList.add('active');
    viewTableBtn.classList.remove('active');
    applyFilter(stateResultados.currentFilter);
  });

  // Botão Atualizar
  const btnAtu = document.getElementById('btn-atualizar');
  if(btnAtu) {
    btnAtu.addEventListener('click', () => {
      loadResults();
      showToast('Dados atualizados!', 'success');
    });
  }
});
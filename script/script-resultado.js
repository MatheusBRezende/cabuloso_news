/**
 * Cabuloso News - Resultados dos Jogos
 * Versão Atualizada: Layout Horizontal + Estatísticas Esquerda
 */

const CONFIG_RESULTADOS = {
  jsonUrl: './backend/resultados.json',
  updateInterval: 60000,
  defaultLogo: './assets/logo-placeholder.png',
  placeholderLogo: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSI2IiBmaWxsPSIjRkZGRkZGIiBzdHJva2U9IiNFMEUwRTAiLz48cGF0aCBkPSJNMjQgMTZDMjAgMTYgMTcgMTkgMTcgMjNTMjAgMzAgMjQgMzBDMjggMzAgMzEgMjcgMzEgMjNDMzEgMTkgMjggMTYgMjQgMTZaIiBmaWxsPSIjRkM3QjAwIi8+PHBhdGggZD0iTTE5IDE3SDE3VjMxSDE5IiBmaWxsPSIjRkM3QjAwIi8+PHBhdGggZD0iTTMxIDE3SDI5VjMxSDMxIiBmaWxsPSIjRkM3QjAwIi8+PC9zdmc+'
};

const stateResultados = {
  isLoading: true,
  allResults: [],
  filteredResults: [],
  currentFilter: 'todos',
  lastMatchesCount: 5 // Quantidade de jogos no histórico horizontal
};

// Função para determinar resultado com base no placar
function determinarResultado(score, team1) {
  if (!score) return 'empate';
  
  const scores = score.split('-').map(s => parseInt(s.trim()) || 0);
  if (scores.length !== 2) return 'empate';
  
  const [golsTime1, golsTime2] = scores;
  
  // Verifica se o Cruzeiro é o team1
  const isCruzeiroHome = team1.toLowerCase().includes('cruzeiro');
  
  if (isCruzeiroHome) {
    if (golsTime1 > golsTime2) return 'vitoria';
    if (golsTime1 < golsTime2) return 'derrota';
    return 'empate';
  } else {
    // Se Cruzeiro é team2 (visitante)
    if (golsTime2 > golsTime1) return 'vitoria';
    if (golsTime2 < golsTime1) return 'derrota';
    return 'empate';
  }
}

// Carregar dados do JSON
async function loadResults() {
  try {
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.remove('hidden');

    // Mostrar estado de carregamento
    showLoadingState();
    
    const response = await fetch(`${CONFIG_RESULTADOS.jsonUrl}?v=${new Date().getTime()}`);
    if (!response.ok) throw new Error('Erro ao carregar arquivo JSON');
    
    const data = await response.json();
    
    let rawList = [];
    if (data.results && Array.isArray(data.results)) {
      rawList = data.results;
    } else if (Array.isArray(data)) {
      rawList = data;
    } else {
      rawList = [data];
    }

    stateResultados.allResults = rawList.map((game, index) => {
      const resultado = determinarResultado(game.score, game.team1);
      
      return {
        id: index,
        date: game.date || "",
        competition: game.competition || "",
        team1: game.team1 || "",
        logo1: game.logo1 || CONFIG_RESULTADOS.placeholderLogo,
        score: game.score || "0 - 0",
        team2: game.team2 || "",
        logo2: game.logo2 || CONFIG_RESULTADOS.placeholderLogo,
        status: game.status || "",
        resultado: resultado,
        isCruzeiroHome: game.team1.toLowerCase().includes('cruzeiro')
      };
    });

    // Ordenar por data (mais recente primeiro)
    stateResultados.allResults.sort((a, b) => {
      // Converter datas simples para ordenação
      return new Date(b.date) - new Date(a.date);
    });

    updateStatistics();
    renderHorizontalMatches();
    renderAllResults();
    
    // Atualizar data de atualização
    const now = new Date();
    document.getElementById('data-atualizacao').textContent = 
      `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    
  } catch (error) {
    console.error('Erro ao carregar resultados:', error);
    showErrorState();
  } finally {
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.classList.add('hidden');
  }
}

// Atualizar estatísticas no header
function updateStatistics() {
  const totalJogos = stateResultados.allResults.length;
  const vitorias = stateResultados.allResults.filter(g => g.resultado === 'vitoria').length;
  const empates = stateResultados.allResults.filter(g => g.resultado === 'empate').length;
  
  // Calcular gols pró
  let golsPro = 0;
  stateResultados.allResults.forEach(game => {
    const scores = game.score.split('-').map(s => parseInt(s.trim()) || 0);
    if (game.isCruzeiroHome) {
      golsPro += scores[0] || 0;
    } else {
      golsPro += scores[1] || 0;
    }
  });
  
  // Calcular aproveitamento (3 pontos por vitória, 1 por empate)
  const aproveitamento = totalJogos > 0 
    ? Math.round(((vitorias * 3 + empates * 1) / (totalJogos * 3)) * 100)
    : 0;
  
  // Atualizar preview no header
  document.getElementById('preview-games').textContent = totalJogos;
  document.getElementById('preview-wins').textContent = vitorias;
  document.getElementById('preview-goals').textContent = golsPro;
  document.getElementById('preview-performance').textContent = `${aproveitamento}%`;
}

// Renderizar jogos horizontais
function renderHorizontalMatches() {
  const container = document.getElementById('horizontal-matches');
  if (!container) return;
  
  const lastMatches = stateResultados.allResults.slice(0, stateResultados.lastMatchesCount);
  
  if (lastMatches.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="width: 100%; padding: var(--space-8);">
        <i class="fas fa-search fa-2x" style="margin-bottom: 1rem;"></i>
        <p>Nenhum jogo recente encontrado</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = lastMatches.map(game => `
    <div class="horizontal-match-card ${game.resultado}">
      <div class="horizontal-card-header">
        <span>${game.competition}</span>
        <span>${game.date}</span>
      </div>
      
      <div class="horizontal-card-teams">
        <div class="horizontal-card-team">
          <img src="${game.logo1}" 
               class="team-logo-uniform" 
               alt="${game.team1}"
               onerror="this.src='${CONFIG_RESULTADOS.placeholderLogo}'">
          <span class="${game.isCruzeiroHome ? 'home' : ''}">${game.team1}</span>
        </div>
        
        <div class="horizontal-card-score">
          ${game.score}
        </div>
        
        <div class="horizontal-card-team">
          <img src="${game.logo2}" 
               class="team-logo-uniform" 
               alt="${game.team2}"
               onerror="this.src='${CONFIG_RESULTADOS.placeholderLogo}'">
          <span class="${!game.isCruzeiroHome ? 'home' : ''}">${game.team2}</span>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: var(--space-2);">
        <span class="result-badge ${game.resultado}">
          <i class="fas fa-${game.resultado === 'vitoria' ? 'check-circle' : game.resultado === 'empate' ? 'minus-circle' : 'times-circle'}"></i>
          ${game.resultado === 'vitoria' ? 'Vitória' : game.resultado === 'empate' ? 'Empate' : 'Derrota'}
        </span>
      </div>
    </div>
  `).join('');
}

// Renderizar todos os resultados (tabela/cards)
function renderAllResults() {
  const tbody = document.getElementById('results-tbody');
  const cardsContainer = document.getElementById('results-cards');
  
  if (!tbody || !cardsContainer) return;
  
  // Limpar containers
  tbody.innerHTML = '';
  cardsContainer.innerHTML = '';
  
  if (stateResultados.allResults.length === 0) {
    document.getElementById('results-empty').style.display = 'block';
    document.getElementById('table-view').style.display = 'none';
    document.getElementById('cards-view').style.display = 'none';
    return;
  }
  
  // Esconder estados vazios/erro
  document.getElementById('results-empty').style.display = 'none';
  document.getElementById('results-error').style.display = 'none';
  
  // Renderizar tabela
  stateResultados.allResults.forEach(game => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${game.date}</td>
      <td>
        <div class="match-teams">
          <span class="team-name ${game.isCruzeiroHome ? 'home' : ''}">${game.team1}</span>
          <span class="vs">×</span>
          <span class="team-name ${!game.isCruzeiroHome ? 'home' : ''}">${game.team2}</span>
        </div>
      </td>
      <td>
        <span class="result-badge ${game.resultado}">
          ${game.score}
        </span>
      </td>
      <td>${game.competition}</td>
    `;
    
    tbody.appendChild(row);
  });
  
  // Renderizar cards
  stateResultados.allResults.forEach(game => {
    const card = document.createElement('div');
    card.className = `match-card ${game.resultado}`;
    
    card.innerHTML = `
      <div class="card-header">
        <span>${game.competition}</span>
        <span>${game.date}</span>
      </div>
      
      <div class="card-teams">
        <div class="card-team">
          <img src="${game.logo1}" 
               class="team-logo-uniform" 
               alt="${game.team1}"
               onerror="this.src='${CONFIG_RESULTADOS.placeholderLogo}'">
          <span class="${game.isCruzeiroHome ? 'home' : ''}">${game.team1}</span>
        </div>
        
        <div class="card-score">
          ${game.score}
        </div>
        
        <div class="card-team">
          <img src="${game.logo2}" 
               class="team-logo-uniform" 
               alt="${game.team2}"
               onerror="this.src='${CONFIG_RESULTADOS.placeholderLogo}'">
          <span class="${!game.isCruzeiroHome ? 'home' : ''}">${game.team2}</span>
        </div>
      </div>
      
      <div style="text-align: center;">
        <span class="result-badge ${game.resultado}" style="font-size: 0.8rem;">
          <i class="fas fa-${game.resultado === 'vitoria' ? 'check-circle' : game.resultado === 'empate' ? 'minus-circle' : 'times-circle'}"></i>
          ${game.resultado === 'vitoria' ? 'Vitória' : game.resultado === 'empate' ? 'Empate' : 'Derrota'}
        </span>
      </div>
    `;
    
    cardsContainer.appendChild(card);
  });
}

// Estados de loading/erro
function showLoadingState() {
  document.getElementById('results-loading').style.display = 'block';
  document.getElementById('results-error').style.display = 'none';
  document.getElementById('results-empty').style.display = 'none';
  document.getElementById('table-view').style.display = 'none';
  document.getElementById('cards-view').style.display = 'none';
}

function showErrorState() {
  document.getElementById('results-loading').style.display = 'none';
  document.getElementById('results-error').style.display = 'block';
  document.getElementById('results-empty').style.display = 'none';
  document.getElementById('table-view').style.display = 'none';
  document.getElementById('cards-view').style.display = 'none';
}

// Função para alternar entre visualizações
function setupViewToggle() {
  const viewTableBtn = document.getElementById('view-table');
  const viewCardsBtn = document.getElementById('view-cards');
  
  if (viewTableBtn && viewCardsBtn) {
    viewTableBtn.addEventListener('click', () => {
      viewTableBtn.classList.add('active');
      viewCardsBtn.classList.remove('active');
      document.getElementById('table-view').style.display = 'block';
      document.getElementById('cards-view').style.display = 'none';
    });
    
    viewCardsBtn.addEventListener('click', () => {
      viewCardsBtn.classList.add('active');
      viewTableBtn.classList.remove('active');
      document.getElementById('cards-view').style.display = 'block';
      document.getElementById('table-view').style.display = 'none';
    });
  }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  // Carregar dados
  loadResults();
  
  // Configurar toggle de visualização
  setupViewToggle();
  
  // Botão de atualizar
  const btnAtualizar = document.getElementById('btn-atualizar');
  if (btnAtualizar) {
    btnAtualizar.addEventListener('click', () => {
      btnAtualizar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando...';
      btnAtualizar.disabled = true;
      
      loadResults().finally(() => {
        setTimeout(() => {
          btnAtualizar.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Dados';
          btnAtualizar.disabled = false;
          
          // Mostrar toast de sucesso
          showToast('Dados atualizados com sucesso!', 'success');
        }, 500);
      });
    });
  }
  
  // Botão de tentar novamente
  const btnRetry = document.getElementById('btn-retry');
  if (btnRetry) {
    btnRetry.addEventListener('click', loadResults);
  }
  
  // Botão "Ver Todos" do histórico horizontal
  const viewMoreBtn = document.getElementById('view-more-horizontal');
  if (viewMoreBtn) {
    viewMoreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
    });
  }
  
  // Atualização automática
  setInterval(() => {
    if (!stateResultados.isLoading) {
      loadResults();
    }
  }, CONFIG_RESULTADOS.updateInterval);
});

// Função auxiliar para mostrar toast
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    </div>
    <button class="toast-close"><i class="fas fa-times"></i></button>
  `;
  
  container.appendChild(toast);
  
  // Remover toast após 5 segundos
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
  
  // Botão de fechar
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  });
}
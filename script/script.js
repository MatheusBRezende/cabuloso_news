/**
 * Cabuloso News - Script Principal
 * Portal do Cruzeiro Esporte Clube
 */

// ============================================
// CONFIGURAÇÕES
// ============================================
const CONFIG = {
  newsApiUrl: 'backend/noticias.json',
  tabelaApiUrl: 'backend/tabela_resultado.json',
  agendaApiUrl: 'backend/agenda_cruzeiro.json',
  defaultImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/200px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png',
};

// ============================================
// UTILITÁRIOS
// ============================================
const escapeHtml = (str) => {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return dateStr;
};

// ============================================
// LOADING SCREEN
// ============================================
const hideLoadingScreen = () => {
  const screen = document.getElementById('loadingScreen');
  if (screen) {
    setTimeout(() => {
      screen.classList.add('hidden');
    }, 800);
  }
};

// ============================================
// NAVEGAÇÃO MOBILE
// ============================================
const initMobileMenu = () => {
  const toggle = document.getElementById('menuToggle');
  const menu = document.getElementById('navMenu');

  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    menu.classList.toggle('active');
  });

  // Fechar menu ao clicar em link
  menu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      toggle.classList.remove('active');
      menu.classList.remove('active');
    });
  });
};

// ============================================
// TOAST NOTIFICATIONS
// ============================================
const showToast = (message, type = 'success') => {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${icons[type]} toast-icon"></i>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close"><i class="fas fa-times"></i></button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => toast.remove());

  setTimeout(() => toast.remove(), 5000);

  container.appendChild(toast);
};

// ============================================
// BUSCAR NOTÍCIAS
// ============================================
// Adicione estas variáveis no topo do arquivo ou dentro do escopo principal
let allNews = [];
let displayedNewsCount = 0;
const NEWS_PER_PAGE = 6;

const fetchNews = async () => {
  const container = document.getElementById('newsContainer');
  const loader = document.getElementById('newsLoader');
  const loadMoreBtn = document.getElementById('btnLoadMore');
  const loadMoreContainer = document.getElementById('loadMoreContainer');

  if (!container) return;

  try {
    const response = await fetch(CONFIG.newsApiUrl, { cache: 'no-cache' });
    if (!response.ok) throw new Error('Erro ao carregar notícias');

    allNews = await response.json();
    if (loader) loader.classList.add('hidden');
    
    container.innerHTML = '';
    displayedNewsCount = 0;

    if (!Array.isArray(allNews) || allNews.length === 0) {
      container.innerHTML = '<p class="loading-cell">Nenhuma notícia disponível.</p>';
      return;
    }

    // Renderiza a primeira leva
    renderMoreNews();

    // Configura o clique do botão
    loadMoreBtn.onclick = () => renderMoreNews();

  } catch (error) {
    console.error('Erro ao buscar notícias:', error);
    if (loader) loader.classList.add('hidden');
    container.innerHTML = `<p class="loading-cell">Erro ao carregar notícias.</p>`;
  }
};

const renderMoreNews = () => {
  const container = document.getElementById('newsContainer');
  const loadMoreContainer = document.getElementById('loadMoreContainer');
  
  const nextBatch = allNews.slice(displayedNewsCount, displayedNewsCount + NEWS_PER_PAGE);
  
  nextBatch.forEach(item => {
    const card = document.createElement('article');
    card.className = 'news-card';
    const badgeClass = item.fonte === 'Samuca TV' ? 'news-badge--samuca' : '';

    card.innerHTML = `
      <div class="news-image">
        <img src="${escapeHtml(item.image || CONFIG.defaultImage)}" alt="" loading="lazy">
        <span class="news-badge ${badgeClass}">${escapeHtml(item.fonte || 'Notícia')}</span>
      </div>
      <div class="news-content">
        <span class="news-date"><i class="far fa-clock"></i> ${escapeHtml(item.date || '')}</span>
        <h3 class="news-title">${escapeHtml(item.title)}</h3>
        <div class="news-footer"><span class="read-more">Ler notícia <i class="fas fa-arrow-right"></i></span></div>
      </div>
    `;
    card.addEventListener('click', () => window.open(item.url, '_blank'));
    container.appendChild(card);
  });

  displayedNewsCount += nextBatch.length;

  // Esconde o botão se não houver mais notícias para carregar
  if (displayedNewsCount >= allNews.length) {
    loadMoreContainer.style.display = 'none';
  } else {
    loadMoreContainer.style.display = 'block';
  }
};


// ============================================
// WIDGETS - MINI TABELA
// ============================================
const fetchMiniTable = async () => {
  const tbody = document.getElementById('miniTableBody');
  if (!tbody) return;

  try {
    const response = await fetch(CONFIG.tabelaApiUrl, { cache: 'no-cache' });
    if (!response.ok) throw new Error('Erro ao carregar tabela');

    const data = await response.json();

    if (!data.classificacao) throw new Error('Dados inválidos');

    // Pegar top 5 times
    const top5 = data.classificacao.slice(0, 5);

    tbody.innerHTML = top5.map(time => {
      const isCruzeiro = time.nome?.toLowerCase().includes('cruzeiro');
      return `
        <tr class="${isCruzeiro ? 'cruzeiro-row' : ''}">
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
    }).join('');

    // Atualizar stat de posição
    const cruzeiro = data.classificacao.find(t => t.nome?.toLowerCase().includes('cruzeiro'));
    const statPosition = document.getElementById('statPosition');
    if (statPosition && cruzeiro) {
      statPosition.textContent = `${cruzeiro.posicao}º lugar`;
    }

  } catch (error) {
    console.error('Erro ao buscar mini tabela:', error);
    tbody.innerHTML = '<tr><td colspan="3" class="loading-cell">Erro ao carregar</td></tr>';
  }
};

// ============================================
// WIDGETS - PRÓXIMOS JOGOS
// ============================================
const fetchNextMatches = async () => {
  const container = document.getElementById('nextMatchesWidget');
  if (!container) return;

  try {
    const response = await fetch(CONFIG.agendaApiUrl, { cache: 'no-cache' });
    if (!response.ok) throw new Error('Erro ao carregar agenda');

    const data = await response.json();
    const jogos = data.dados_completos || data || [];

    if (!Array.isArray(jogos) || jogos.length === 0) {
      container.innerHTML = '<div class="loading-cell">Nenhum jogo agendado.</div>';
      return;
    }

    const proximos = jogos.slice(0, 3);

    container.innerHTML = proximos.map(jogo => `
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
    `).join('');

    // Atualizar stat de próximo jogo
    const statNextGame = document.getElementById('statNextGame');
    if (statNextGame && proximos.length > 0) {
      const prox = proximos[0];
      const opponent = prox.mandante?.toLowerCase().includes('cruzeiro') 
        ? prox.visitante 
        : prox.mandante;
      statNextGame.textContent = `${prox.data?.split(' ')[0] || ''} vs ${opponent || 'Adversário'}`;
    }

  } catch (error) {
    console.error('Erro ao buscar próximos jogos:', error);
    container.innerHTML = '<div class="loading-cell">Erro ao carregar jogos.</div>';
  }
};

// ============================================
// WIDGETS - ÚLTIMOS RESULTADOS
// ============================================
const fetchRecentResults = async () => {
  const container = document.getElementById('recentResultsWidget');
  if (!container) return;

  // Como não temos endpoint específico, simular com dados estáticos
  // Em produção, isso viria de uma API
  container.innerHTML = `
    <div class="result-mini">
      <div class="result-mini-teams">
        <div class="result-mini-team">
          <img src="${CONFIG.defaultImage}" alt="">
          <span>Cruzeiro</span>
        </div>
        <span class="result-mini-score win">2 x 1</span>
        <div class="result-mini-team">
          <span>Atlético-MG</span>
        </div>
      </div>
      <div class="result-mini-info">Brasileirão - Série A</div>
    </div>
    <div class="result-mini">
      <div class="result-mini-teams">
        <div class="result-mini-team">
          <img src="${CONFIG.defaultImage}" alt="">
          <span>Cruzeiro</span>
        </div>
        <span class="result-mini-score win">3 x 0</span>
        <div class="result-mini-team">
          <span>América-MG</span>
        </div>
      </div>
      <div class="result-mini-info">Campeonato Mineiro</div>
    </div>
  `;

  // Atualizar stat
  const statLastResult = document.getElementById('statLastResult');
  if (statLastResult) {
    statLastResult.textContent = 'Cruzeiro 2x1 Atlético';
  }
};

// ============================================
// INICIALIZAÇÃO
// ============================================
const init = () => {
  console.log('🔵 Cabuloso News iniciando...');

  initMobileMenu();
  hideLoadingScreen();

  // Carregar conteúdo
  fetchNews();
  fetchMiniTable();
  fetchNextMatches();
  fetchRecentResults();

  console.log('✅ Cabuloso News carregado!');
};

// Aguardar DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

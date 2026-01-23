/**
 * Cabuloso News - Brasileirão, Mineiro & Competições
 * Versão com Campeonato Mineiro em 3 Grupos
 */

// ============================================
// CONFIGURATION & STATE
// ============================================

const CONFIG_BRASILEIRAO = {
  tabelaApiUrl: './backend/tabela_resultado.json',
  tabelaMineiroUrl: './backend/tabela_mineiro.json',
  agendaApiUrl: './backend/agenda_cruzeiro.json', 
  intervaloAtualizacao: 300000,
  defaultEscudo: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png',
};

const stateBrasileirao = {
  isLoading: true,
  tabelaData: null,
  agendaData: null,
  ultimaAtualizacao: null,
  widgetOpen: false,
  currentFilter: 'todos',
  campeonatoAtual: 'brasileirao',
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const escapeHtml = (text) => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// ============================================
// DATA FETCHING
// ============================================

const fetchTabelaData = async (url = CONFIG_BRASILEIRAO.tabelaApiUrl) => {
  const container = document.getElementById('tabela-container');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner">
        <div class="spinner"></div>
      </div>
      <p>Carregando dados do campeonato...</p>
    </div>
  `;

  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    
    const parsedData = await response.json();
    
    if (Array.isArray(parsedData)) {
      renderizarTabelaMineiro(parsedData);
    } else if (parsedData.classificacao) {
      stateBrasileirao.tabelaData = parsedData;
      renderizarTabelaCompleta(parsedData);
    } else {
      throw new Error('Formato de dados não reconhecido');
    }
  } catch (error) {
    console.error('Erro ao buscar dados da tabela:', error);
    container.innerHTML = `
      <div class="error-jogos">
        <p><i class="fas fa-exclamation-triangle"></i> Erro ao carregar a tabela.</p>
        <p style="font-size: 0.9rem; margin-top: 0.5rem;">Tente novamente mais tarde.</p>
      </div>
    `;
  }
};

const fetchAgendaCruzeiro = async () => {
  const container = document.querySelector('.games-list');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-jogos" style="padding: 2rem; text-align: center;">
      <p>Carregando próximos jogos...</p>
    </div>
  `;

  try {
    const response = await fetch(CONFIG_BRASILEIRAO.agendaApiUrl, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    
    const data = await response.json();
    const jogos = data.dados_completos ? data.dados_completos : (Array.isArray(data) ? data : []); 
    
    stateBrasileirao.agendaData = jogos;
    renderizarAgenda(jogos);
  } catch (error) {
    console.error('Erro ao buscar agenda:', error);
    container.innerHTML = `
      <div class="error-jogos" style="padding: 2rem;">
        <p>Agenda temporariamente indisponível.</p>
      </div>
    `;
  }
};

// ============================================
// RENDERING FUNCTIONS
// ============================================

const renderizarTabelaCompleta = (data) => {
  const container = document.getElementById('tabela-container');
  const nomeCamp = document.getElementById('campeonato-nome');
  
  if (nomeCamp && data.edicao) {
    nomeCamp.textContent = escapeHtml(data.edicao.nome);
  }
  
  if (!data.classificacao) {
    container.innerHTML = '<div class="error-jogos"><p>Dados de classificação não disponíveis.</p></div>';
    return;
  }

  let html = `
    <table id="tabela-brasileirao">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Time</th>
          <th>Pts</th>
          <th>J</th>
          <th>V</th>
          <th>E</th>
          <th>D</th>
          <th>SG</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.classificacao.forEach((time) => {
    const isCruzeiro = time.nome?.toLowerCase().includes('cruzeiro') ? 'cruzeiro' : '';
    const positionClass = getPositionClass(time.posicao);
    
    html += `
      <tr class="${positionClass} ${isCruzeiro}">
        <td class="posicao">${time.posicao}º</td>
        <td class="time">
          <img 
            src="${time.escudo || CONFIG_BRASILEIRAO.defaultEscudo}" 
            class="escudo" 
            alt="Escudo ${escapeHtml(time.nome)}"
            loading="lazy"
          >
          <span>${escapeHtml(time.nome)}</span>
        </td>
        <td><strong>${time.pontos}</strong></td>
        <td>${time.jogos}</td>
        <td>${time.vitorias || '-'}</td>
        <td>${time.empates || '-'}</td>
        <td>${time.derrotas || '-'}</td>
        <td>${time.saldo_gols > 0 ? '+' : ''}${time.saldo_gols}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
};

const renderizarTabelaMineiro = (data) => {
  const container = document.getElementById('tabela-container');
  const nomeCamp = document.getElementById('campeonato-nome');
  
  if (nomeCamp) {
    nomeCamp.textContent = 'Campeonato Mineiro 2026';
  }

  if (!Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<div class="error-jogos"><p>Dados da tabela não disponíveis.</p></div>';
    return;
  }

  // Dividir os 12 times em 3 grupos de 4
  const grupoA = data.slice(0, 4);
  const grupoB = data.slice(4, 8);
  const grupoC = data.slice(8, 12);

  const renderGrupo = (grupo, nomeGrupo) => {
    return `
      <div class="grupo-card">
        <div class="grupo-header">
          <h3><i class="fas fa-users"></i> ${nomeGrupo}</h3>
        </div>
        <table class="grupo-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Time</th>
              <th>Pts</th>
              <th>J</th>
              <th>V</th>
              <th>SG</th>
            </tr>
          </thead>
          <tbody>
            ${grupo.map((time, index) => {
              const isCruzeiro = time.time?.toLowerCase().includes('cruzeiro') ? 'cruzeiro' : '';
              const positionClass = index < 2 ? 'pos1-4' : ''; // Primeiros 2 de cada grupo classificam
              
              return `
                <tr class="${positionClass} ${isCruzeiro}">
                  <td class="posicao">${index + 1}º</td>
                  <td class="time">
                    <img 
                      src="${time.escudo || CONFIG_BRASILEIRAO.defaultEscudo}" 
                      class="escudo" 
                      alt="Escudo ${escapeHtml(time.time)}"
                      loading="lazy"
                    >
                    <span>${escapeHtml(time.time)}</span>
                  </td>
                  <td><strong>${time.pontos}</strong></td>
                  <td>${time.jogos}</td>
                  <td>${time.vitorias}</td>
                  <td>${time.saldo > 0 ? '+' : ''}${time.saldo}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  container.innerHTML = `
    <div class="grupos-mineiro">
      ${renderGrupo(grupoA, 'Grupo A')}
      ${renderGrupo(grupoB, 'Grupo B')}
      ${renderGrupo(grupoC, 'Grupo C')}
    </div>
  `;
};

const renderizarAgenda = (jogos) => {
  const container = document.querySelector('.games-list');
  if (!container) return;

  if (!jogos || jogos.length === 0) {
    container.innerHTML = `
      <div class="error-jogos" style="padding: 2rem;">
        <p>Nenhum jogo agendado no momento.</p>
      </div>
    `;
    return;
  }

  const filtrados = stateBrasileirao.currentFilter === 'todos' 
    ? jogos 
    : jogos.filter(j => j.campeonato?.includes(stateBrasileirao.currentFilter));

  const proximosCinco = filtrados.slice(0, 5);

  if (proximosCinco.length === 0) {
    container.innerHTML = `
      <div class="error-jogos" style="padding: 2rem;">
        <p>Nenhum jogo encontrado para este filtro.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = proximosCinco.map(jogo => `
    <article class="next-match destaque-cruzeiro">
      <div class="match-date">
        <i class="far fa-calendar"></i> ${escapeHtml(jogo.data)} - ${escapeHtml(jogo.hora)}
      </div>
      <div class="match-teams">
        <div class="match-team">
          <img 
            src="${jogo.escudo_mandante || CONFIG_BRASILEIRAO.defaultEscudo}" 
            alt="Escudo ${escapeHtml(jogo.mandante)}"
            loading="lazy"
          >
          <span>${escapeHtml(jogo.mandante)}</span>
        </div>
        <span class="vs">X</span>
        <div class="match-team">
          <span>${escapeHtml(jogo.visitante)}</span>
          <img 
            src="${jogo.escudo_visitante || CONFIG_BRASILEIRAO.defaultEscudo}" 
            alt="Escudo ${escapeHtml(jogo.visitante)}"
            loading="lazy"
          >
        </div>
      </div>
      <div class="match-info">
        ${escapeHtml(jogo.campeonato)} | ${escapeHtml(jogo.estadio)}
      </div>
    </article>
  `).join('');
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const getPositionClass = (pos) => {
  if (pos <= 4) return 'pos1-4';
  if (pos <= 6) return 'pos5-6';
  if (pos <= 12) return 'pos7-12';
  return pos >= 17 ? 'pos17-20' : '';
};

// ============================================
// INTERFACE & INITIALIZATION
// ============================================

const initInterface = () => {
  // Menu Mobile
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('nav-menu');
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const isExpanded = navMenu.classList.contains('active');
      menuToggle.setAttribute('aria-expanded', isExpanded);
    });
  }

  // Widget de Jogos
  const widgetToggle = document.getElementById('widget-toggle');
  const widget = document.getElementById('games-widget');
  const widgetClose = document.getElementById('widget-close');

  if (widgetToggle && widget) {
    widgetToggle.addEventListener('click', () => {
      widget.classList.add('active');
      widgetToggle.setAttribute('aria-expanded', 'true');
      widget.setAttribute('aria-hidden', 'false');
      fetchAgendaCruzeiro();
    });
  }

  if (widgetClose && widget) {
    widgetClose.addEventListener('click', () => {
      widget.classList.remove('active');
      const toggle = document.getElementById('widget-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
      widget.setAttribute('aria-hidden', 'true');
    });
  }

  // Filtros de campeonato no widget
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      stateBrasileirao.currentFilter = btn.dataset.filter;
      if (stateBrasileirao.agendaData) renderizarAgenda(stateBrasileirao.agendaData);
    });
  });

  initCampeonatoSelector();
  initScrollHandler();
};

const initCampeonatoSelector = () => {
  const select = document.getElementById('campeonato-select');
  if (!select) return;

  select.addEventListener('change', async (e) => {
    const value = e.target.value;
    const copaGames = document.getElementById('copa-static-games');
    const legendContainer = document.querySelector('.legend-container');
    
    stateBrasileirao.campeonatoAtual = value;

    if (value === 'brasileirao') {
      if (copaGames) copaGames.style.display = 'none';
      if (legendContainer) legendContainer.style.display = 'block';
      await fetchTabelaData(CONFIG_BRASILEIRAO.tabelaApiUrl);
    } 
    else if (value === 'mineiro') {
      if (copaGames) copaGames.style.display = 'none';
      if (legendContainer) legendContainer.style.display = 'block';
      await fetchTabelaData(CONFIG_BRASILEIRAO.tabelaMineiroUrl);
    }
    else if (value === 'copa-do-brasil') {
      if (copaGames) {
        copaGames.style.display = 'block';
        const container = document.getElementById('tabela-container');
        if (container) container.innerHTML = '';
      }
      if (legendContainer) legendContainer.style.display = 'none';
    }
  });
};

const initScrollHandler = () => {
  window.addEventListener('scroll', debounce(() => {
    const nav = document.querySelector('.navbar');
    if (nav) {
      if (window.scrollY > 50) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    }
  }, 10));
};

// ============================================
// INITIALIZATION
// ============================================

const initBrasileirao = () => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initInterface();
      fetchTabelaData();
    });
  } else {
    initInterface();
    fetchTabelaData();
  }
};

initBrasileirao();
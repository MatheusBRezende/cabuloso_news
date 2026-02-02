/**
 * Cabuloso News - Brasileirão, Mineiro & Competições
 * CORRIGIDO: Posições 1-20 baseadas no index do array
 * CORRIGIDO: Cores das zonas funcionando corretamente
 */

// ============================================
// CONFIGURATION & STATE
// ============================================
const CONFIG_BRASILEIRAO = {
  tabelaApiUrl: 'https://cabuloso-api.cabulosonews92.workers.dev/',
  tabelaMineiroUrl: 'https://cabuloso-api.cabulosonews92.workers.dev/',
  agendaApiUrl: 'https://cabuloso-api.cabulosonews92.workers.dev/',
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
// ZONE COLOR FUNCTIONS - CORRIGIDO
// ============================================

/**
 * Retorna a classe CSS correta para a zona baseada na posicao (indicador)
 * @param {number} posicao - Posicao do time (1-20)
 * @returns {string} - Classe CSS da zona
 */
const getZoneClass = (posicao) => {
  if (posicao >= 1 && posicao <= 4) return 'zona-libertadores';    // Azul escuro (G4)
  if (posicao >= 5 && posicao <= 6) return 'zona-preliberta';      // Azul claro (Pre-Libertadores)
  if (posicao >= 7 && posicao <= 12) return 'zona-sulamericana';   // Laranja (Sul-Americana)
  if (posicao >= 17 && posicao <= 20) return 'zona-rebaixamento';  // Vermelho (Z4)
  return '';  // Posicoes 13-16: neutro (cinza padrao)
};

/**
 * Retorna a classe CSS para fundo da linha (Brasileirao)
 * @param {number} posicao - Posicao do time (1-20)
 * @returns {string} - Classe CSS para fundo da linha
 */
const getRowZoneClass = (posicao) => {
  if (posicao >= 1 && posicao <= 4) return 'row-libertadores';
  if (posicao >= 5 && posicao <= 6) return 'row-preliberta';
  if (posicao >= 7 && posicao <= 12) return 'row-sulamericana';
  if (posicao >= 17 && posicao <= 20) return 'row-rebaixamento';
  return '';
};

/**
 * Retorna a classe CSS para grupos do Mineiro (indicador)
 * 1o de cada grupo: Classificado direto (verde esmeralda)
 * 2o de cada grupo: Melhor segundo classifica (dourado) / Outros segundos (roxo)
 * 3o: Eliminado (cinza)
 * 4o: Repescagem (ciano)
 * @param {number} posicao - Posicao no grupo (1-4)
 * @param {boolean} isMelhorSegundo - Se este time eh o melhor segundo colocado
 * @returns {string} - Classe CSS da zona
 */
const getZoneClassMineiro = (posicao, isMelhorSegundo = false) => {
  if (posicao === 1) return 'zona-classificado-direto';   // Verde esmeralda
  if (posicao === 2 && isMelhorSegundo) return 'zona-melhor-segundo';  // Dourado (classifica)
  if (posicao === 2) return 'zona-segundo-normal';  // Roxo (nao classifica)
  if (posicao === 3) return 'zona-eliminado';  // Cinza (eliminado)
  if (posicao === 4) return 'zona-repescagem';  // Ciano (repescagem)
  return '';
};

/**
 * Retorna a classe CSS para fundo da linha (Mineiro)
 * @param {number} posicao - Posicao no grupo (1-4)
 * @param {boolean} isMelhorSegundo - Se este time eh o melhor segundo colocado
 * @returns {string} - Classe CSS para fundo da linha
 */
const getRowZoneClassMineiro = (posicao, isMelhorSegundo = false) => {
  if (posicao === 1) return 'row-classificado-direto';
  if (posicao === 2 && isMelhorSegundo) return 'row-melhor-segundo';
  if (posicao === 2) return 'row-segundo-normal';
  if (posicao === 3) return 'row-eliminado';
  if (posicao === 4) return 'row-repescagem';
  return '';
};

/**
 * Encontra o melhor segundo colocado entre os 3 grupos
 * Criterios: 1) Pontos, 2) Vitorias, 3) Saldo de gols
 * @param {Array} grupoA - Times do grupo A
 * @param {Array} grupoB - Times do grupo B
 * @param {Array} grupoC - Times do grupo C
 * @returns {string} - Nome do time que eh o melhor segundo
 */
const encontrarMelhorSegundo = (grupoA, grupoB, grupoC) => {
  // Pega o segundo colocado de cada grupo (index 1)
  const segundos = [
    grupoA[1] ? { ...grupoA[1], grupo: 'A' } : null,
    grupoB[1] ? { ...grupoB[1], grupo: 'B' } : null,
    grupoC[1] ? { ...grupoC[1], grupo: 'C' } : null
  ].filter(t => t !== null);

  if (segundos.length === 0) return null;

  // Ordena por: pontos (desc), vitorias (desc), saldo (desc)
  segundos.sort((a, b) => {
    // Pontos
    const pontosA = parseInt(a.pontos) || 0;
    const pontosB = parseInt(b.pontos) || 0;
    if (pontosB !== pontosA) return pontosB - pontosA;
    
    // Vitorias
    const vitoriasA = parseInt(a.vitorias) || 0;
    const vitoriasB = parseInt(b.vitorias) || 0;
    if (vitoriasB !== vitoriasA) return vitoriasB - vitoriasA;
    
    // Saldo de gols
    const saldoA = parseInt(a.saldo) || 0;
    const saldoB = parseInt(b.saldo) || 0;
    return saldoB - saldoA;
  });

  // Retorna o nome do melhor segundo
  return segundos[0]?.time || null;
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

    // Detecta qual tabela renderizar
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

/**
 * Renderiza a tabela completa do Brasileirão
 * CORRIGIDO: Usa index do array para calcular posição real (1-20)
 */
const renderizarTabelaCompleta = (data) => {
  const container = document.getElementById('tabela-container');
  const nomeCamp = document.getElementById('campeonato-nome');

  if (nomeCamp && data.edicao) {
    nomeCamp.textContent = data.edicao.nome;
  }

  if (!data.classificacao) {
    container.innerHTML = '<div class="error-jogos"><p>Dados não disponíveis.</p></div>';
    return;
  }

  let html = `
    <table id="tabela-brasileirao">
      <thead>
        <tr>
          <th class="col-time">Classificação</th>
          <th class="col-pontos">P</th>
          <th>J</th>
          <th>V</th>
          <th>E</th>
          <th>D</th>
          <th>SG</th>
        </tr>
      </thead>
      <tbody>
  `;

  // CORRECAO PRINCIPAL: Usa o INDEX para determinar a posicao real
  data.classificacao.forEach((time, index) => {
    const posicaoReal = index + 1; // 1, 2, 3... ate 20

    // Verifica se e Cruzeiro para destacar a linha
    const isCruzeiro = time.nome?.toLowerCase().includes('cruzeiro');
    
    // Classe da linha: zona + cruzeiro (se aplicavel)
    const rowZoneClass = getRowZoneClass(posicaoReal);
    const rowClass = isCruzeiro ? `cruzeiro-row ${rowZoneClass}` : rowZoneClass;

    // Classe do indicador de zona
    const zoneClass = getZoneClass(posicaoReal);

    // Emoji de raposa para o Cruzeiro
    const foxEmoji = isCruzeiro ? '<span class="cruzeiro-fox" aria-label="Raposa">🦊</span>' : '';

    html += `
      <tr class="${rowClass}">
        <td class="celula-time-completa">
          <div class="posicao-container">
            <span class="indicador-zona ${zoneClass}"></span>
            <span class="numero-posicao">${foxEmoji}${posicaoReal}º</span>
          </div>
          
          <div class="time-info">
            <img 
              src="${time.escudo || CONFIG_BRASILEIRAO.defaultEscudo}" 
              class="escudo-pequeno" 
              alt="Escudo ${escapeHtml(time.nome)}"
              loading="lazy"
              onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'"
            >
            <span class="nome-time-texto">${escapeHtml(time.nome)}</span>
          </div>
        </td>
        
        <td class="dado-pontos"><strong>${time.pontos}</strong></td>
        <td>${time.jogos}</td>
        <td>${time.vitorias}</td>
        <td>${time.empates}</td>
        <td>${time.derrotas}</td>
        <td>${time.saldo_gols >= 0 ? '+' + time.saldo_gols : time.saldo_gols}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
};

/**
 * Renderiza a tabela do Campeonato Mineiro com grupos
 * CORRIGIDO: Cores das zonas de classificacao/eliminacao
 * CORRIGIDO: Melhor segundo colocado agora eh calculado dinamicamente
 */
const renderizarTabelaMineiro = (data) => {
  const container = document.getElementById('tabela-container');
  const nomeCamp = document.getElementById('campeonato-nome');

  if (nomeCamp) {
    nomeCamp.textContent = 'Campeonato Mineiro 2026';
  }

  if (!Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<div class="error-jogos"><p>Dados da tabela nao disponiveis.</p></div>';
    return;
  }

  // Divide os times em 3 grupos de 4
  const grupoA = data.slice(0, 4);
  const grupoB = data.slice(4, 8);
  const grupoC = data.slice(8, 12);

  // Encontra o melhor segundo colocado entre os 3 grupos
  const melhorSegundoNome = encontrarMelhorSegundo(grupoA, grupoB, grupoC);

  /**
   * Renderiza um grupo individual
   */
  const renderGrupo = (grupo, nomeGrupo) => {
    return `
      <div class="grupo-card">
        <div class="grupo-header">
          <h3><i class="fas fa-layer-group"></i> ${nomeGrupo}</h3>
        </div>
        <table class="grupo-table">
          <thead>
            <tr>
              <th>Equipe</th>
              <th>P</th>
              <th>J</th>
              <th>V</th>
              <th>SG</th>
            </tr>
          </thead>
          <tbody>
            ${grupo.map((time, index) => {
              const posicaoGrupo = index + 1;
              const isCruzeiro = time.time?.toLowerCase().includes('cruzeiro');
              
              // Verifica se este time eh o melhor segundo colocado
              const isMelhorSegundo = posicaoGrupo === 2 && time.time === melhorSegundoNome;
              
              // Classe da linha com fundo de zona
              const rowZoneClass = getRowZoneClassMineiro(posicaoGrupo, isMelhorSegundo);
              const rowClass = isCruzeiro ? `cruzeiro ${rowZoneClass}` : rowZoneClass;
              
              // Classe do indicador de zona
              const zoneClass = getZoneClassMineiro(posicaoGrupo, isMelhorSegundo);

              // Emoji de raposa para o Cruzeiro
              const foxEmoji = isCruzeiro ? '<span class="cruzeiro-fox" aria-label="Raposa">🦊</span>' : '';

              // Formata o saldo de gols
              const saldo = parseInt(time.saldo) || 0;
              const saldoFormatado = saldo > 0 ? `+${saldo}` : saldo.toString();

              return `
                <tr class="${rowClass}">
                  <td class="celula-combinada">
                    <div class="posicao-num">
                      <span class="zona-indicador ${zoneClass}"></span>
                      ${foxEmoji}${posicaoGrupo}º
                    </div>
                    <div class="time">
                      <img 
                        src="${time.escudo || CONFIG_BRASILEIRAO.defaultEscudo}" 
                        class="escudo" 
                        alt="Escudo ${escapeHtml(time.time)}"
                        loading="lazy"
                        onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'"
                      >
                      <span>${escapeHtml(time.time)}</span>
                    </div>
                  </td>
                  <td><strong>${time.pontos}</strong></td>
                  <td>${time.jogos}</td>
                  <td>${time.vitorias}</td>
                  <td>${saldoFormatado}</td>
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

/**
 * Renderiza a agenda de próximos jogos
 */
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
            onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'"
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
            onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'"
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
// LEGEND MANAGEMENT
// ============================================

/**
 * Atualiza a legenda baseada no campeonato selecionado
 */
const updateLegend = (campeonato) => {
  const legendBrasileirao = document.getElementById('legend-brasileirao');
  const legendMineiro = document.getElementById('legend-mineiro');
  const legendContainer = document.getElementById('legend-container');

  if (campeonato === 'brasileirao') {
    if (legendBrasileirao) legendBrasileirao.style.display = 'flex';
    if (legendMineiro) legendMineiro.style.display = 'none';
    if (legendContainer) legendContainer.style.display = 'block';
  } else if (campeonato === 'mineiro') {
    if (legendBrasileirao) legendBrasileirao.style.display = 'none';
    if (legendMineiro) legendMineiro.style.display = 'flex';
    if (legendContainer) legendContainer.style.display = 'block';
  } else {
    // Copa do Brasil - esconde legenda
    if (legendContainer) legendContainer.style.display = 'none';
  }
};

// ============================================
// INTERFACE & INITIALIZATION
// ============================================

const initInterface = () => {
  // Menu Mobile Toggle
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('nav-menu');

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const isExpanded = navMenu.classList.contains('active');
      menuToggle.setAttribute('aria-expanded', isExpanded);
    });

    // Fecha o menu ao clicar em um link (mobile)
    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Widget de Jogos (Toggle e Fechar)
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

  // Fechar widget ao clicar fora
  document.addEventListener('click', (e) => {
    if (widget && widget.classList.contains('active')) {
      if (!widget.contains(e.target) && !widgetToggle.contains(e.target)) {
        widget.classList.remove('active');
        if (widgetToggle) widgetToggle.setAttribute('aria-expanded', 'false');
        widget.setAttribute('aria-hidden', 'true');
      }
    }
  });

  // Filtros do Widget
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

/**
 * Inicializa os botoes de campeonato
 */
const initCampeonatoSelector = () => {
  const buttons = document.querySelectorAll('.campeonato-btn');
  if (!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.campeonato;
      const container = document.getElementById('tabela-container');
      const nomeCamp = document.getElementById('campeonato-nome');

      // Atualiza estado visual dos botoes
      buttons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      stateBrasileirao.campeonatoAtual = value;

      // Atualiza a legenda
      updateLegend(value);

      if (value === 'brasileirao') {
        await fetchTabelaData(CONFIG_BRASILEIRAO.tabelaApiUrl);
      }
      else if (value === 'mineiro') {
        await fetchTabelaData(CONFIG_BRASILEIRAO.tabelaMineiroUrl);
      }
      else if (value === 'copa-do-brasil') {
        // Limpa a tabela e mostra apenas o aviso da Copa
        if (container) {
          container.innerHTML = `
            <div class="fase-copa fade-in-up" id="copa-static-games">
              <h3><i class="fas fa-trophy" aria-hidden="true"></i> Copa do Brasil 2026</h3>
              <div class="aviso-sem-jogos-copa" role="alert">
                <div class="aviso-icon" aria-hidden="true">
                  <i class="fas fa-clock"></i>
                </div>
                <div class="aviso-content">
                  <h3>AGUARDE ENQUANTO NAO HA PARTIDAS</h3>
                  <p>As informacoes dos proximos jogos da Copa do Brasil serao atualizadas em breve.</p>
                </div>
              </div>
            </div>
          `;
        }
        if (nomeCamp) {
          nomeCamp.textContent = 'Copa do Brasil 2026';
        }
      }
    });
  });
};

/**
 * Handler de scroll para efeitos no navbar
 */
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
      updateLegend('brasileirao'); // Legenda inicial
    });
  } else {
    initInterface();
    fetchTabelaData();
    updateLegend('brasileirao'); // Legenda inicial
  }
};

// Inicia a aplicação
initBrasileirao();

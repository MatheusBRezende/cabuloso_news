/**
 * Cabuloso News - Brasileirão, Mineiro & Competições
 * VERSÃO OTIMIZADA: Single Request + Worker Fix + Cache Local
 */

// ============================================
// CONFIGURATION & STATE
// ============================================
const CONFIG_BRASILEIRAO = {
  // URL Única para todos os dados
  apiUrl: 'https://cabuloso-api.cabulosonews92.workers.dev/',
  
  defaultEscudo: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png',
  CACHE_TTL: 10 * 60 * 1000 // 10 minutos de cache
};

const stateBrasileirao = {
  isLoading: true,
  dadosCompletos: null, // Guarda o pacote inteiro aqui
  currentFilter: 'todos',
  campeonatoAtual: 'brasileirao',
};

// ============================================
// SISTEMA DE CACHE LOCAL (Igual ao script.js)
// ============================================
const LocalCacheBrasileirao = {
  set(key, data, ttl) {
    const item = { data, timestamp: Date.now(), ttl };
    localStorage.setItem(`cache_br_${key}`, JSON.stringify(item));
  },
  get(key) {
    const raw = localStorage.getItem(`cache_br_${key}`);
    if (!raw) return null;
    const item = JSON.parse(raw);
    if (Date.now() - item.timestamp > item.ttl) {
      localStorage.removeItem(`cache_br_${key}`);
      return null;
    }
    return item.data;
  }
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
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// ============================================
// ZONE COLOR FUNCTIONS
// ============================================
const getZoneClass = (posicao) => {
  if (posicao >= 1 && posicao <= 4) return 'zona-libertadores';
  if (posicao >= 5 && posicao <= 6) return 'zona-preliberta';
  if (posicao >= 7 && posicao <= 12) return 'zona-sulamericana';
  if (posicao >= 17 && posicao <= 20) return 'zona-rebaixamento';
  return '';
};

const getRowZoneClass = (posicao) => {
  if (posicao >= 1 && posicao <= 4) return 'row-libertadores';
  if (posicao >= 5 && posicao <= 6) return 'row-preliberta';
  if (posicao >= 7 && posicao <= 12) return 'row-sulamericana';
  if (posicao >= 17 && posicao <= 20) return 'row-rebaixamento';
  return '';
};

const getZoneClassMineiro = (posicao, isMelhorSegundo = false) => {
  if (posicao === 1) return 'zona-classificado-direto';
  if (posicao === 2 && isMelhorSegundo) return 'zona-melhor-segundo';
  if (posicao === 2) return 'zona-segundo-normal';
  if (posicao === 3) return 'zona-eliminado';
  if (posicao === 4) return 'zona-repescagem';
  return '';
};

const getRowZoneClassMineiro = (posicao, isMelhorSegundo = false) => {
  if (posicao === 1) return 'row-classificado-direto';
  if (posicao === 2 && isMelhorSegundo) return 'row-melhor-segundo';
  if (posicao === 2) return 'row-segundo-normal';
  if (posicao === 3) return 'row-eliminado';
  if (posicao === 4) return 'row-repescagem';
  return '';
};

const encontrarMelhorSegundo = (grupoA, grupoB, grupoC) => {
  const segundos = [
    grupoA[1] ? { ...grupoA[1] } : null,
    grupoB[1] ? { ...grupoB[1] } : null,
    grupoC[1] ? { ...grupoC[1] } : null
  ].filter(t => t !== null);

  if (segundos.length === 0) return null;

  segundos.sort((a, b) => {
    const pontosA = parseInt(a.pontos) || 0;
    const pontosB = parseInt(b.pontos) || 0;
    if (pontosB !== pontosA) return pontosB - pontosA;
    
    const vitoriasA = parseInt(a.vitorias) || 0;
    const vitoriasB = parseInt(b.vitorias) || 0;
    if (vitoriasB !== vitoriasA) return vitoriasB - vitoriasA;
    
    const saldoA = parseInt(a.saldo) || 0;
    const saldoB = parseInt(b.saldo) || 0;
    return saldoB - saldoA;
  });

  return segundos[0]?.time || null;
};

// ============================================
// MAIN DATA LOADER (SINGLE REQUEST)
// ============================================
const loadMasterDataBrasileirao = async () => {
  const container = document.getElementById('tabela-container');
  const agendaContainer = document.querySelector('.games-list');
  
  if (container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"><div class="spinner"></div></div>
        <p>Atualizando tabelas e jogos...</p>
      </div>`;
  }

  try {
    let data;
    
    // 1. Tenta Cache Local
    const cached = LocalCacheBrasileirao.get('camp_data');
    if (cached) {
      console.log("📦 Usando cache local para tabelas");
      data = cached;
    } else {
      // 2. Busca na Worker (1 Request)
      console.log("🌐 Buscando tabelas na nuvem...");
      const response = await fetch(CONFIG_BRASILEIRAO.apiUrl);
      if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
      
      let rawData = await response.json();
      
      // 3. Tratamento do formato [ { ... } ]
      if (Array.isArray(rawData)) rawData = rawData[0];
      
      data = rawData;
      LocalCacheBrasileirao.set('camp_data', data, CONFIG_BRASILEIRAO.CACHE_TTL);
    }

    // Salva no estado global
    stateBrasileirao.dadosCompletos = data;

    // 4. Renderiza Agenda (Sempre visível no widget)
    if (data.agenda) {
      renderizarAgenda(data.agenda);
    } else if (agendaContainer) {
      agendaContainer.innerHTML = '<div class="error-jogos"><p>Agenda indisponível</p></div>';
    }

    // 5. Renderiza Tabela Inicial (Brasileirão por padrão)
    refreshCurrentView();

  } catch (error) {
    console.error('Erro geral:', error);
    if (container) {
      container.innerHTML = `
        <div class="error-jogos">
          <p><i class="fas fa-exclamation-triangle"></i> Falha ao carregar dados.</p>
          <button onclick="loadMasterDataBrasileirao()" class="btn-retry">Tentar Novamente</button>
        </div>`;
    }
  }
};

/**
 * Atualiza a visualização com base na aba selecionada (Sem nova requisição)
 */
const refreshCurrentView = () => {
  const data = stateBrasileirao.dadosCompletos;
  if (!data) return;

  const camp = stateBrasileirao.campeonatoAtual;
  const container = document.getElementById('tabela-container');
  const nomeCamp = document.getElementById('campeonato-nome');

  if (camp === 'brasileirao') {
    if (data.tabela_brasileiro) {
      renderizarTabelaCompleta(data.tabela_brasileiro);
    } else {
      container.innerHTML = '<div class="error-jogos"><p>Tabela do Brasileirão não encontrada.</p></div>';
    }
  } 
  else if (camp === 'mineiro') {
    if (data.tabela_mineiro) {
      renderizarTabelaMineiro(data.tabela_mineiro);
    } else {
      container.innerHTML = '<div class="error-jogos"><p>Tabela do Mineiro não encontrada.</p></div>';
    }
  }
  else if (camp === 'copa-do-brasil') {
    renderCopaDoBrasilPlaceholder();
  }
};

// ============================================
// RENDERING FUNCTIONS
// ============================================

const renderizarTabelaCompleta = (data) => {
  const container = document.getElementById('tabela-container');
  const nomeCamp = document.getElementById('campeonato-nome');

  if (nomeCamp && data.edicao) nomeCamp.textContent = data.edicao.nome || "Brasileirão";

  if (!data.classificacao) return;

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

  data.classificacao.forEach((time, index) => {
    const posicaoReal = index + 1;
    const isCruzeiro = time.nome?.toLowerCase().includes('cruzeiro');
    const rowZoneClass = getRowZoneClass(posicaoReal);
    const rowClass = isCruzeiro ? `cruzeiro-row ${rowZoneClass}` : rowZoneClass;
    const zoneClass = getZoneClass(posicaoReal);
    const foxEmoji = isCruzeiro ? '<span class="cruzeiro-fox">🦊</span>' : '';

    html += `
      <tr class="${rowClass}">
        <td class="celula-time-completa">
          <div class="posicao-container">
            <span class="indicador-zona ${zoneClass}"></span>
            <span class="numero-posicao">${foxEmoji}${posicaoReal}º</span>
          </div>
          <div class="time-info">
            <img src="${time.escudo || CONFIG_BRASILEIRAO.defaultEscudo}" class="escudo-pequeno" loading="lazy">
            <span class="nome-time-texto">${escapeHtml(time.nome)}</span>
          </div>
        </td>
        <td class="dado-pontos"><strong>${time.pontos}</strong></td>
        <td>${time.jogos}</td>
        <td>${time.vitorias}</td>
        <td>${time.empates}</td>
        <td>${time.derrotas}</td>
        <td>${time.saldo_gols >= 0 ? '+' + time.saldo_gols : time.saldo_gols}</td>
      </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
};

const renderizarTabelaMineiro = (data) => {
  const container = document.getElementById('tabela-container');
  const nomeCamp = document.getElementById('campeonato-nome');

  if (nomeCamp) nomeCamp.textContent = 'Campeonato Mineiro 2026';

  // Se não for array, pode ser erro ou formato errado
  if (!Array.isArray(data)) return;

  const grupoA = data.slice(0, 4);
  const grupoB = data.slice(4, 8);
  const grupoC = data.slice(8, 12);
  const melhorSegundoNome = encontrarMelhorSegundo(grupoA, grupoB, grupoC);

  const renderGrupo = (grupo, nomeGrupo) => {
    return `
      <div class="grupo-card">
        <div class="grupo-header"><h3><i class="fas fa-layer-group"></i> ${nomeGrupo}</h3></div>
        <table class="grupo-table">
          <thead><tr><th>Equipe</th><th>P</th><th>J</th><th>V</th><th>SG</th></tr></thead>
          <tbody>
            ${grupo.map((time, index) => {
              const posicaoGrupo = index + 1;
              const isCruzeiro = time.time?.toLowerCase().includes('cruzeiro');
              const isMelhorSegundo = posicaoGrupo === 2 && time.time === melhorSegundoNome;
              const rowZoneClass = getRowZoneClassMineiro(posicaoGrupo, isMelhorSegundo);
              const rowClass = isCruzeiro ? `cruzeiro ${rowZoneClass}` : rowZoneClass;
              const zoneClass = getZoneClassMineiro(posicaoGrupo, isMelhorSegundo);
              const foxEmoji = isCruzeiro ? '<span class="cruzeiro-fox">🦊</span>' : '';
              const saldo = parseInt(time.saldo) || 0;

              return `
                <tr class="${rowClass}">
                  <td class="celula-combinada">
                    <div class="posicao-num"><span class="zona-indicador ${zoneClass}"></span>${foxEmoji}${posicaoGrupo}º</div>
                    <div class="time">
                      <img src="${time.escudo || CONFIG_BRASILEIRAO.defaultEscudo}" class="escudo" loading="lazy">
                      <span>${escapeHtml(time.time)}</span>
                    </div>
                  </td>
                  <td><strong>${time.pontos}</strong></td>
                  <td>${time.jogos}</td>
                  <td>${time.vitorias}</td>
                  <td>${saldo > 0 ? '+' + saldo : saldo}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  };

  container.innerHTML = `
    <div class="grupos-mineiro">
      ${renderGrupo(grupoA, 'Grupo A')}
      ${renderGrupo(grupoB, 'Grupo B')}
      ${renderGrupo(grupoC, 'Grupo C')}
    </div>`;
};

const renderCopaDoBrasilPlaceholder = () => {
  const container = document.getElementById('tabela-container');
  const nomeCamp = document.getElementById('campeonato-nome');
  if (nomeCamp) nomeCamp.textContent = 'Copa do Brasil 2026';
  
  if (container) {
    container.innerHTML = `
      <div class="fase-copa fade-in-up" id="copa-static-games">
        <h3><i class="fas fa-trophy"></i> Copa do Brasil 2026</h3>
        <div class="aviso-sem-jogos-copa">
          <div class="aviso-icon"><i class="fas fa-clock"></i></div>
          <div class="aviso-content">
            <h3>AGUARDE</h3>
            <p>Tabela da Copa do Brasil será atualizada em breve.</p>
          </div>
        </div>
      </div>`;
  }
};

const renderizarAgenda = (jogos) => {
  const container = document.querySelector('.games-list');
  if (!container) return;

  if (!jogos || jogos.length === 0) {
    container.innerHTML = '<div class="error-jogos" style="padding:2rem;"><p>Sem jogos agendados.</p></div>';
    return;
  }

  const filtrados = stateBrasileirao.currentFilter === 'todos'
    ? jogos
    : jogos.filter(j => j.campeonato?.toLowerCase().includes(stateBrasileirao.currentFilter.toLowerCase()));

  const proximosCinco = filtrados.slice(0, 5);

  if (proximosCinco.length === 0) {
    container.innerHTML = '<div class="error-jogos" style="padding:2rem;"><p>Nenhum jogo encontrado.</p></div>';
    return;
  }

  container.innerHTML = proximosCinco.map(jogo => `
    <article class="next-match destaque-cruzeiro">
      <div class="match-date"><i class="far fa-calendar"></i> ${escapeHtml(jogo.data)} - ${escapeHtml(jogo.hora)}</div>
      <div class="match-teams">
        <div class="match-team">
          <img src="${jogo.escudo_mandante || CONFIG_BRASILEIRAO.defaultEscudo}" loading="lazy" onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'">
          <span>${escapeHtml(jogo.mandante)}</span>
        </div>
        <span class="vs">X</span>
        <div class="match-team">
          <span>${escapeHtml(jogo.visitante)}</span>
          <img src="${jogo.escudo_visitante || CONFIG_BRASILEIRAO.defaultEscudo}" loading="lazy" onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'">
        </div>
      </div>
      <div class="match-info">${escapeHtml(jogo.campeonato)} | ${escapeHtml(jogo.estadio)}</div>
    </article>
  `).join('');
};

// ============================================
// INTERFACE & INITIALIZATION
// ============================================

const initInterface = () => {
  // Configuração das abas de campeonato
  const buttons = document.querySelectorAll('.campeonato-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const value = btn.dataset.campeonato;
      
      // Atualiza UI dos botões
      buttons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      // Muda estado e atualiza tela sem fetch
      stateBrasileirao.campeonatoAtual = value;
      updateLegend(value);
      refreshCurrentView();
    });
  });

  // Configuração do Widget de Filtro
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      stateBrasileirao.currentFilter = btn.dataset.filter;
      if (stateBrasileirao.dadosCompletos?.agenda) {
        renderizarAgenda(stateBrasileirao.dadosCompletos.agenda);
      }
    });
  });

  // Toggle do Widget
  const widgetToggle = document.getElementById('widget-toggle');
  const widget = document.getElementById('games-widget');
  const widgetClose = document.getElementById('widget-close');

  if (widgetToggle && widget) {
    widgetToggle.addEventListener('click', () => {
      widget.classList.add('active');
      widgetToggle.setAttribute('aria-expanded', 'true');
    });
  }
  if (widgetClose && widget) {
    widgetClose.addEventListener('click', () => {
      widget.classList.remove('active');
      if (widgetToggle) widgetToggle.setAttribute('aria-expanded', 'false');
    });
  }
};

const updateLegend = (campeonato) => {
  const lBr = document.getElementById('legend-brasileirao');
  const lMin = document.getElementById('legend-mineiro');
  const lContainer = document.getElementById('legend-container');

  if (!lContainer) return;

  if (campeonato === 'brasileirao') {
    if (lBr) lBr.style.display = 'flex';
    if (lMin) lMin.style.display = 'none';
    lContainer.style.display = 'block';
  } else if (campeonato === 'mineiro') {
    if (lBr) lBr.style.display = 'none';
    if (lMin) lMin.style.display = 'flex';
    lContainer.style.display = 'block';
  } else {
    lContainer.style.display = 'none';
  }
};

const initBrasileirao = () => {
  const start = () => {
    initInterface();
    loadMasterDataBrasileirao();
    updateLegend('brasileirao');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
};

initBrasileirao();
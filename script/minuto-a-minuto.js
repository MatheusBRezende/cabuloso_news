/**
 * Cabuloso News - Minuto a Minuto
 * Versão: 9.0 - TIMELINE FULL WIDTH + WIDGETS SUPERIORES
 */
let ultimoLanceId = null;
let lastValidStats = null;

const CONFIG = {
  webhookUrl: "https://cabuloso-api.cabulosonews92.workers.dev/?type=ao-vivo",
  apiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/dados",
  updateInterval: 10000,
};

const golControl = {
  lastScore: { home: 0, away: 0 },
  lastTrigger: 0,
  cooldown: 12000,
};

const state = {
  matchStarted: false,
  agendaData: null,
  countdownInterval: null,
  match: {
    home: { name: "Mandante", logo: "" },
    away: { name: "Visitante", logo: "" },
    score: { home: 0, away: 0 },
    status: "AO VIVO",
    minute: "0'",
  },
  logsEnabled: true,
};

const animationQueue = {
  queue: [],
  isPlaying: false,
  
  add(animationType) {
    this.queue.push(animationType);
    if (!this.isPlaying) {
      this.playNext();
    }
  },
  
  async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }
    
    this.isPlaying = true;
    const animationType = this.queue.shift();
    
    await this.playAnimation(animationType);
    
    // Aguarda um pequeno intervalo antes da próxima animação
    setTimeout(() => {
      this.playNext();
    }, 1000); // 1 segundo entre animações
  },
  
  async playAnimation(type) {
    return new Promise((resolve) => {
      if (type === 'amarelo') {
        dispararAnimacaoCartao('amarelo');
      } else if (type === 'vermelho') {
        dispararAnimacaoCartao('vermelho');
      } else if (type === 'gol') {
        dispararAnimacaoGol();
      } else if (type === 'penalti') {
        dispararAnimacaoPenalti();
      }
      
      // A animação completa chama resolve()
      setTimeout(() => {
        resolve();
      }, 3000); // Tempo máximo para qualquer animação
    });
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  initNavigation();
  initTopFloatingButtons(); // ← AGORA USA OS BOTÕES SUPERIORES
  await loadAgenda();
  await fetchLiveData();
  setInterval(fetchLiveData, CONFIG.updateInterval);
});

const fetchLiveData = async () => {
  try {
    const response = await fetch(
      `${CONFIG.webhookUrl}&t=${Date.now()}`
    );

    let data = await response.json();

    // Se a API retornar uma lista [], pegamos o primeiro objeto
    if (Array.isArray(data)) {
      data = data[0];
    }

    // 🔐 Cacheia estatísticas válidas
    if (data.estatisticas && Object.keys(data.estatisticas).length > 0) {
      lastValidStats = data.estatisticas;
    }

    // Verifica se é jogo ao vivo
    const isLiveMatch = data && (
      data.success === true ||
      (data.placar && data.placar.status)
    );

    if (!isLiveMatch || data.error) {
      if (state.logsEnabled) console.log("⏱️ Modo Agenda: Sem jogo ao vivo.");
      state.matchStarted = false;
      showNextMatchCountdown();
      return;
    }

    console.log("✅ Jogo ao vivo detectado! Renderizando...");
    state.matchStarted = true;
    showLiveMatchUI();

    updateMatchState(data);
    processarGol();
    detectarNovoLance(data);
    renderAllComponents(data);

  } catch (e) {
    if (state.logsEnabled) console.error("⚠️ Erro na requisição:", e);
    state.matchStarted = false;
    showNextMatchCountdown();
  }
};

function detectarNovoLance(data) {
  if (!data.narracao || data.narracao.length === 0) return;

  const lance = data.narracao[0];
  const minutoSafe = lance.minuto ? String(lance.minuto) : "";
  const id = btoa(unescape(encodeURIComponent(minutoSafe + lance.descricao)));

  if (id !== ultimoLanceId) {
    ultimoLanceId = id;
    processarNovoLance(lance);
  }
}

function detectarGolComDelay() {
  const now = Date.now();
  const atual = state.match.score;
  const anterior = golControl.lastScore;

  if (now - golControl.lastTrigger < golControl.cooldown) {
    return null;
  }

  if (atual.home > anterior.home) {
    golControl.lastTrigger = now;
    golControl.lastScore = { ...atual };
    return "HOME";
  }

  if (atual.away > anterior.away) {
    golControl.lastTrigger = now;
    golControl.lastScore = { ...atual };
    return "AWAY";
  }

  golControl.lastScore = { ...atual };
  return null;
}

function processarGol() {
  const gol = detectarGolComDelay();
  if (!gol) return;

  if (gol === "HOME") {
    dispararAnimacaoFullScreen("gol");
  }

  if (gol === "AWAY") {
    dispararAnimacaoFullScreen("gol");
  }
}

function processarNovoLance(lance) {
  const desc = lance.descricao ? lance.descricao.toUpperCase() : "";

  // Verifica pênalti primeiro (mais específico)
  if (desc.includes("PENALIDADE MÁXIMA") || desc.includes("PÊNALTI") || 
      desc.includes("PENALTI") || desc.includes("MARCA DA CAL")) {
    console.log("🎯 PÊNALTI DETECTADO!");
    animationQueue.add('penalti');
    return;
  }

  if (desc.includes("CARTÃO VERMELHO") || desc.includes("EXPULSO")) {
    animationQueue.add('vermelho');
    return;
  }

  if (desc.includes("CARTÃO AMARELO") || desc.includes("AMARELO")) {
    animationQueue.add('amarelo');
    return;
  }
}

/**
 * EXIBE A INTERFACE DE JOGO AO VIVO
 */
const showLiveMatchUI = () => {
  const liveSections = document.getElementById("live-match-sections");
  const countdownWrapper = document.getElementById("countdown-wrapper");

  if (liveSections) liveSections.style.display = "block";
  if (countdownWrapper) countdownWrapper.style.display = "none";

  if (state.countdownInterval) {
    clearInterval(state.countdownInterval);
    state.countdownInterval = null;
  }
};

/**
 * EXIBE O COUNTDOWN E ESCONDE O MINUTO A MINUTO
 */
const showNextMatchCountdown = () => {
  const nextMatch = getNextMatchFromAgenda();

  if (!nextMatch) {
    console.warn("⚠️ Nenhum próximo jogo encontrado na agenda");
    return;
  }

  const liveSections = document.getElementById("live-match-sections");
  const countdownWrapper = document.getElementById("countdown-wrapper");

  if (liveSections) liveSections.style.display = "none";
  if (countdownWrapper) countdownWrapper.style.display = "block";

  renderNextMatchCard(nextMatch);
  startCountdown(nextMatch.dataObj);
};

/**
 * RENDERIZA O CARD DO PRÓXIMO JOGO
 */
const renderNextMatchCard = (match) => {
  const container = document.getElementById("live-match-container");
  if (!container) return;

  container.innerHTML = `
    <div class="match-header-card" style="background: linear-gradient(135deg, #1a1f3a 0%, #002266 100%); border: 2px solid var(--primary-light);">
      <div class="match-status-badge" style="background: var(--accent); color: var(--primary-dark);">
        <i class="fas fa-clock"></i> PRÓXIMO JOGO
      </div>
      <div class="score-row" style="flex-direction: column; gap: 30px; padding: 40px 20px;">
        <div style="display: flex; justify-content: center; align-items: center; gap: 40px; width: 100%;">
          <div class="team-info" style="flex-direction: column; text-align: center; flex: 1; max-width: 200px;">
            <img src="${match.escudo_mandante}" class="team-logo" style="width: 100px; height: 100px; margin-bottom: 15px;">
            <span class="team-name">${match.mandante}</span>
          </div>
          <div class="vs-divider">VS</div>
          <div class="team-info" style="flex-direction: column; text-align: center; flex: 1; max-width: 200px;">
            <img src="${match.escudo_visitante}" class="team-logo" style="width: 100px; height: 100px; margin-bottom: 15px;">
            <span class="team-name">${match.visitante}</span>
          </div>
        </div>
        <div class="match-game-info">
          <div class="match-competition"><i class="fas fa-trophy"></i> ${match.campeonato}</div>
          <div class="match-date"><i class="fas fa-calendar-alt"></i> ${match.data}</div>
          <div class="match-time"><i class="fas fa-clock"></i> ${match.hora}</div>
        </div>
      </div>
    </div>
  `;
};

/**
 * LÓGICA DO CONTADOR (COUNTDOWN)
 */
const startCountdown = (targetDate) => {
  if (state.countdownInterval) clearInterval(state.countdownInterval);
  const timerElement = document.getElementById("timer-text");
  if (!timerElement) return;

  const update = () => {
    const now = new Date().getTime();
    const distance = targetDate.getTime() - now;
    if (distance < 0) {
      timerElement.textContent = "JOGO COMEÇOU!";
      clearInterval(state.countdownInterval);
      return;
    }
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    timerElement.textContent =
      days > 0
        ? `${days}d ${String(hours).padStart(2, "0")}h ${String(
            minutes
          ).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`
        : `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(
            2,
            "0"
          )}m ${String(seconds).padStart(2, "0")}s`;
  };
  update();
  state.countdownInterval = setInterval(update, 1000);
};

async function loadAgenda() {
  try {
    const response = await fetch(
      `${CONFIG.apiUrl}?type=geral&t=${Date.now()}`
    );
    const data = await response.json();
    
    if (data && !data.error && data.agenda && Array.isArray(data.agenda)) {
      state.agendaData = {
        jogos: data.agenda
      };
      console.log("📅 Agenda carregada:", data.agenda.length, "jogos");
    } else {
      console.warn("⚠️ Agenda retornou vazia ou com erro");
    }
  } catch (e) {
    console.error("⚠️ Erro ao carregar agenda:", e);
  }
}

function getNextMatchFromAgenda() {
  if (!state.agendaData || !state.agendaData.jogos) return null;
  const now = new Date();
  let closest = null;
  let minDiff = Infinity;

  state.agendaData.jogos.forEach((jogo) => {
    const dataMatch = parseMatchDate(jogo.data, jogo.hora);
    if (!dataMatch || dataMatch < now) return;

    const diff = dataMatch - now;
    if (diff < minDiff) {
      minDiff = diff;
      closest = { ...jogo, dataObj: dataMatch };
    }
  });

  return closest;
}

function parseMatchDate(dateStr, timeStr) {
  try {
    const cleanDate = dateStr.replace(/^[a-z]{3}\.,\s*/i, '').trim();
    
    let day, month, year;
    
    if (cleanDate.includes('/')) {
      [day, month, year] = cleanDate.split('/');
    } else {
      const meses = {
        'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
        'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
      };
      
      const parts = cleanDate.split(' ');
      day = parts[0];
      const mesStr = parts[1]?.replace('.', '').toLowerCase();
      month = meses[mesStr] || 1;
      year = new Date().getFullYear();
    }
    
    let hour = 0, minute = 0;
    if (timeStr && timeStr !== 'A definir') {
      [hour, minute] = timeStr.split(':').map(n => parseInt(n));
    }
    
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour) || 0,
      parseInt(minute) || 0
    );
  } catch (e) {
    console.error("Erro ao processar data:", dateStr, timeStr, e);
    return null;
  }
}

function updateMatchState(data) {
  if (!data || !data.placar) return;

  if (data.partida && data.partida.includes(" x ")) {
    const [home, away] = data.partida.split(" x ");
    state.match.home.name = home.trim();
    state.match.away.name = away.trim();
  }

  state.match.score.home = Number(data.placar.home ?? 0);
  state.match.score.away = Number(data.placar.away ?? 0);
  state.match.status = data.placar.status || "AO VIVO";
}

function renderAllComponents(data) {
  renderMatchHeader(data.placar, data.narracao);
  renderTimelineFullWidth(data.narracao); // ← NOVA FUNÇÃO
  
  // Renderizar estatísticas principais
  if (data.estatisticas && Object.keys(data.estatisticas).length > 0) {
    renderPanelStats(data.estatisticas);
  }
  
  // Renderizar arbitragem no widget superior
  updateTopArbitro(data.arbitragem);
  
  // Renderizar escalações no painel
  renderPanelLineups(data.escalacao);
}

function renderMatchHeader(placar, narracao) {
  const container = document.getElementById("live-match-container");
  if (!container || !placar) return;

  let currentMinute = "0'";
  if (narracao && narracao.length > 0 && narracao[0].minuto) {
    currentMinute = String(narracao[0].minuto)
      .replace(/<[^>]*>/g, "")
      .trim();
  }

  let matchStatus = placar.status || "AO VIVO";
  
  if (currentMinute.includes("45'") && currentMinute.includes("1°T")) {
    matchStatus = "FIM DO 1° TEMPO";
  } else if (currentMinute.includes("Int") || currentMinute.toLowerCase().includes("intervalo")) {
    matchStatus = "INTERVALO";
  } else if (currentMinute.includes("90'") || (currentMinute.includes("45'") && currentMinute.includes("2°T"))) {
    matchStatus = "FIM DO 2° TEMPO";
  } else if (currentMinute.includes("2°T")) {
    matchStatus = "2° TEMPO";
  } else if (currentMinute.includes("1°T")) {
    matchStatus = "1° TEMPO";
  }

  container.innerHTML = `
    <div class="match-header-card">
      <div class="match-status-badge ${
        matchStatus.includes("AO VIVO") || matchStatus.includes("TEMPO") ? "live-pulse" : ""
      }">
        <i class="fas fa-circle"></i> ${matchStatus}
      </div>
      <div class="score-row">
        <div class="team-info team-home">
          <img src="${placar.home_logo}" alt="${placar.home_name}" class="team-logo" />
          <span class="team-name">${placar.home_name}</span>
        </div>
        <div class="score-display">
          <div class="match-timer-badge">
            <i class="fas fa-clock"></i>
            <span>${currentMinute}</span>
          </div>
          <div class="score-numbers">
            <span class="score-number">${placar.home || 0}</span>
            <span class="score-divider">-</span>
            <span class="score-number">${placar.away || 0}</span>
          </div>
        </div>
        <div class="team-info team-away">
          <img src="${placar.away_logo}" alt="${placar.away_name}" class="team-logo" />
          <span class="team-name">${placar.away_name}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * RENDERIZA TIMELINE EM LARGURA TOTAL
 */
function renderTimelineFullWidth(narracao) {
  const container = document.getElementById("timeline-container-full");
  const statusIndicator = document.getElementById("match-status-indicator-full");
  const noEventsMessage = document.getElementById("no-events-message-full");

  if (!container) return;

  if (!narracao || narracao.length === 0) {
    if (noEventsMessage) noEventsMessage.style.display = "block";
    if (statusIndicator) statusIndicator.textContent = "AGUARDANDO";
    return;
  }

  if (noEventsMessage) noEventsMessage.style.display = "none";
  if (statusIndicator) statusIndicator.textContent = "AO VIVO";

  container.innerHTML = "";

  narracao.forEach((lance) => {
    const item = document.createElement("div");

    let iconClass = "";
    let iconContent = lance.icone || "📝";
    let extraClass = "lance-normal";
    const desc = lance.descricao ? lance.descricao.toLowerCase() : "";

    // Lógica de Ícones
    if (lance.is_gol || desc.includes("gol")) {
        iconClass = "icon-goal";
        iconContent = '<i class="fas fa-futbol"></i>';
        extraClass = "lance-gol";
    } else if (desc.includes("amarelo")) {
        iconClass = "icon-yellow-card";
        iconContent = '<i class="fas fa-square-full" style="font-size: 0.8em;"></i>';
    } else if (desc.includes("vermelho")) {
        iconClass = "icon-red-card";
        iconContent = '<i class="fas fa-square-full" style="font-size: 0.8em;"></i>';
    } else if (desc.includes("pênalti") || desc.includes("penalidade") || desc.includes("marca da cal")) {
        iconClass = "icon-penalty";
        iconContent = '<i class="fas fa-bullseye"></i>';
        extraClass = "lance-importante";
    }

    item.className = `timeline-item-full ${extraClass}`;

    let min = "0'";
    if(lance.minuto !== undefined && lance.minuto !== null) {
        min = String(lance.minuto)
            .replace(/<[^>]*>/g, "")
            .trim();
    }

    item.innerHTML = `
      <div class="timeline-time-full">
        <span class="time-badge-full">${min}</span>
      </div>
      <div class="timeline-content-full">
        <div class="timeline-icon-full ${iconClass}">${iconContent}</div>
        <div class="timeline-text-full"><p>${lance.descricao}</p></div>
      </div>
    `;
    container.appendChild(item);
  });
}

/**
 * RENDERIZA ESTATÍSTICAS EM GRID
 */
function renderGridStats(stats) {
  const homeContainer = document.getElementById("home-stats-list-grid");
  const awayContainer = document.getElementById("away-stats-list-grid");
  const homeHeader = document.getElementById("home-stats-header-grid");
  const awayHeader = document.getElementById("away-stats-header-grid");
  
  if (!stats) return;
  
  // Atualizar cabeçalhos
  if (homeHeader && state.match.home.name) {
    homeHeader.innerHTML = `
      <i class="fas fa-chart-bar"></i>
      <span>${state.match.home.name.toUpperCase()}</span>
    `;
  }
  
  if (awayHeader && state.match.away.name) {
    awayHeader.innerHTML = `
      <i class="fas fa-chart-pie"></i>
      <span>${state.match.away.name.toUpperCase()}</span>
    `;
  }
  
  // Renderizar estatísticas do mandante
  if (homeContainer) {
    const homeItems = [
      { label: "Posse de bola", value: stats.posse_home || "0%" },
      { label: "Chutes", value: stats.chutes_home || 0 },
      { label: "Chutes a gol", value: stats.chutes_gol_home || 0 },
      { label: "Passes certos", value: stats.passes_certos_home || 0 },
      { label: "Passes errados", value: stats.passes_errados_home || 0 },
      { label: "Faltas", value: stats.faltas_home || 0 },
      { label: "Desarmes", value: stats.desarmes_home || 0 },
      { label: "Escanteios", value: stats.escanteios_home || 0 },
      { label: "Impedimentos", value: stats.impedimentos_home || 0 },
      { label: "Cartões amarelos", value: stats.amarelos_home || 0 },
      { label: "Cartões vermelhos", value: stats.vermelhos_home || 0 },
    ];
    
    homeContainer.innerHTML = homeItems.map(item => `
      <div class="stat-item-grid">
        <span class="stat-label-grid">${item.label}</span>
        <span class="stat-value-grid">${item.value}</span>
      </div>
    `).join('');
  }
  
  // Renderizar estatísticas do visitante
  if (awayContainer) {
    const awayItems = [
      { label: "Posse de bola", value: stats.posse_away || "0%" },
      { label: "Chutes", value: stats.chutes_away || 0 },
      { label: "Chutes a gol", value: stats.chutes_gol_away || 0 },
      { label: "Passes certos", value: stats.passes_certos_away || 0 },
      { label: "Passes errados", value: stats.passes_errados_away || 0 },
      { label: "Faltas", value: stats.faltas_away || 0 },
      { label: "Desarmes", value: stats.desarmes_away || 0 },
      { label: "Escanteios", value: stats.escanteios_away || 0 },
      { label: "Impedimentos", value: stats.impedimentos_away || 0 },
      { label: "Cartões amarelos", value: stats.amarelos_away || 0 },
      { label: "Cartões vermelhos", value: stats.vermelhos_away || 0 },
    ];
    
    awayContainer.innerHTML = awayItems.map(item => `
      <div class="stat-item-grid">
        <span class="stat-label-grid">${item.label}</span>
        <span class="stat-value-grid">${item.value}</span>
      </div>
    `).join('');
  }
}

/**
 * ATUALIZA ÁRBITRO NO WIDGET SUPERIOR
 */
function updateTopArbitro(arbitragem) {
  const arbitroNome = document.querySelector('.top-arbitro-nome');
  if (arbitroNome && arbitragem) {
    arbitroNome.textContent = arbitragem;
  }
}

/**
 * INICIALIZA OS BOTÕES FLUTUANTES SUPERIORES
 */
function initTopFloatingButtons() {
  const statsBtn = document.getElementById('top-stats-btn');
  const lineupBtn = document.getElementById('top-lineup-btn');
  const overlay = document.getElementById('floating-overlay');

  if (statsBtn) {
    statsBtn.onclick = (e) => {
      e.preventDefault();
      console.log("Botão Estatísticas clicado");
      openStatsPanel(); // Chama a função correta que já limpa o outro painel
    };
  }

  if (lineupBtn) {
    lineupBtn.onclick = (e) => {
      e.preventDefault();
      console.log("Botão Escalação clicado");
      openLineupPanel(); // Chama a função correta que já limpa o outro painel
    };
  }
  
  if (overlay) {
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        closeAllPanels();
      }
    };
  }
}

function openStatsPanel() {
  const overlay = document.getElementById('floating-overlay');
  const statsPanel = document.getElementById('stats-panel');
  const lineupPanel = document.getElementById('lineup-panel');

  if (overlay && statsPanel) {
    overlay.classList.add('active');
    statsPanel.classList.add('active');
    lineupPanel.classList.remove('active');
    document.body.style.overflow = 'hidden';
    
    // ATUALIZA OS DADOS QUANDO ABRIR O PAINEL
    updateStatsPanel();
  }
}

function openLineupPanel() {
  const overlay = document.getElementById('floating-overlay');
  const lineupPanel = document.getElementById('lineup-panel');
  const statsPanel = document.getElementById('stats-panel');

  if (overlay && lineupPanel) {
    overlay.classList.add('active');
    lineupPanel.classList.add('active');
    statsPanel.classList.remove('active');
    document.body.style.overflow = 'hidden';
    
    // ATUALIZA OS DADOS QUANDO ABRIR O PAINEL
    updateLineupPanel();
  }
}

function updateStatsPanel() {
  // Use as estatísticas em cache (lastValidStats) ou busque se não houver
  if (lastValidStats) {
    renderPanelStats(lastValidStats);
  } else {
    // Tenta buscar estatísticas da API
    fetchLiveDataForPanel();
  }
}

/**
 * ATUALIZA OS DADOS DO PAINEL DE ESCALAÇÕES
 */
function updateLineupPanel() {
  // Tenta buscar escalações da API
  fetchLiveDataForPanel();
}

async function fetchLiveDataForPanel() {
  try {
    const response = await fetch(
      `${CONFIG.webhookUrl}&t=${Date.now()}`
    );
    let data = await response.json();
    
    if (Array.isArray(data)) {
      data = data[0];
    }
    
    // Atualiza estatísticas se disponíveis
    if (data.estatisticas && Object.keys(data.estatisticas).length > 0) {
      lastValidStats = data.estatisticas;
      renderPanelStats(data.estatisticas);
    }
    
    // Atualiza escalações se disponíveis
    if (data.escalacao) {
      renderPanelLineups(data.escalacao);
    }
    
    // Atualiza árbitro se disponível
    if (data.arbitragem) {
      updateTopArbitro(data.arbitragem);
    }
    
  } catch (e) {
    console.error("⚠️ Erro ao buscar dados para painéis:", e);
  }
}


function closeAllPanels() {
  const overlay = document.getElementById('floating-overlay');
  const panels = document.querySelectorAll('.floating-panel');
  
  if (overlay) overlay.classList.remove('active');
  panels.forEach(panel => panel.classList.remove('active'));
  
  // DEVOLVE O SCROLL
  document.body.style.overflow = ''; 
  console.log("Painéis fechados e scroll liberado");
}

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('floating-overlay');
  if (overlay) {
      overlay.addEventListener('click', (e) => {
          if (e.target === overlay) closeAllPanels();
      });
  }
  
  // CORREÇÃO AQUI: O seu HTML usa 'panel-close-btn'
  document.querySelectorAll('.panel-close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
          e.preventDefault();
          closeAllPanels();
      });
  });

  // ADICIONE ISSO PARA O ESC FUNCIONAR SEMPRE:
  document.addEventListener('keydown', (e) => {
      if (e.key === "Escape") closeAllPanels();
  });
});

/**
 * RENDERIZAR ESTATÍSTICAS NO PAINEL FLUTUANTE
 */
function renderPanelStats(stats) {
  if (!stats) return;
  
  const homeTeamName = document.getElementById('panel-home-team');
  const awayTeamName = document.getElementById('panel-away-team');
  
  if (homeTeamName && state.match.home.name) {
    homeTeamName.innerHTML = `<span>${state.match.home.name.toUpperCase()}</span>`;
  }
  
  if (awayTeamName && state.match.away.name) {
    awayTeamName.innerHTML = `<span>${state.match.away.name.toUpperCase()}</span>`;
  }
  
  const homeStatsList = document.getElementById('panel-home-stats');
  if (homeStatsList) {
    const homeItems = [
      { label: "Posse de bola", value: stats.posse_home || "0%" },
      { label: "Chutes", value: stats.chutes_home || 0 },
      { label: "Chutes a gol", value: stats.chutes_gol_home || 0 },
      { label: "Precisão", value: stats.chutes_home ? `${Math.round((stats.chutes_gol_home / stats.chutes_home) * 100) || 0}%` : "0%" },
      { label: "Passes certos", value: stats.passes_certos_home || 0 },
      { label: "Passes errados", value: stats.passes_errados_home || 0 },
      { label: "Precisão passes", value: stats.passes_certos_home ? `${Math.round((stats.passes_certos_home / (stats.passes_certos_home + stats.passes_errados_home)) * 100) || 0}%` : "0%" },
      { label: "Faltas", value: stats.faltas_home || 0 },
      { label: "Desarmes", value: stats.desarmes_home || 0 },
      { label: "Escanteios", value: stats.escanteios_home || 0 },
      { label: "Impedimentos", value: stats.impedimentos_home || 0 },
      { label: "Cartões amarelos", value: stats.amarelos_home || 0 },
      { label: "Cartões vermelhos", value: stats.vermelhos_home || 0 },
    ];
    
    homeStatsList.innerHTML = homeItems.map(item => `
      <div class="panel-stat-item">
        <span class="panel-stat-label">${item.label}</span>
        <span class="panel-stat-value">${item.value}</span>
      </div>
    `).join('');
  }
  
  const awayStatsList = document.getElementById('panel-away-stats');
  if (awayStatsList) {
    const awayItems = [
      { label: "Posse de bola", value: stats.posse_away || "0%" },
      { label: "Chutes", value: stats.chutes_away || 0 },
      { label: "Chutes a gol", value: stats.chutes_gol_away || 0 },
      { label: "Precisão", value: stats.chutes_away ? `${Math.round((stats.chutes_gol_away / stats.chutes_away) * 100) || 0}%` : "0%" },
      { label: "Passes certos", value: stats.passes_certos_away || 0 },
      { label: "Passes errados", value: stats.passes_errados_away || 0 },
      { label: "Precisão passes", value: stats.passes_certos_away ? `${Math.round((stats.passes_certos_away / (stats.passes_certos_away + stats.passes_errados_away)) * 100) || 0}%` : "0%" },
      { label: "Faltas", value: stats.faltas_away || 0 },
      { label: "Desarmes", value: stats.desarmes_away || 0 },
      { label: "Escanteios", value: stats.escanteios_away || 0 },
      { label: "Impedimentos", value: stats.impedimentos_away || 0 },
      { label: "Cartões amarelos", value: stats.amarelos_away || 0 },
      { label: "Cartões vermelhos", value: stats.vermelhos_away || 0 },
    ];
    
    awayStatsList.innerHTML = awayItems.map(item => `
      <div class="panel-stat-item">
        <span class="panel-stat-label">${item.label}</span>
        <span class="panel-stat-value">${item.value}</span>
      </div>
    `).join('');
  }
}

/**
 * RENDERIZAR ESCALAÇÕES NO PAINEL FLUTUANTE
 */
/**
 * RENDERIZAR ESCALAÇÕES NO PAINEL FLUTUANTE (COM SUPORTE A FOTOS)
 */
function renderPanelLineups(escalacao) {
  if (!escalacao) return;
  
  const homeTeamName = document.getElementById('panel-home-team-name');
  const awayTeamName = document.getElementById('panel-away-team-name');
  
  if (homeTeamName && state.match.home.name) {
    homeTeamName.textContent = state.match.home.name.toUpperCase();
  }
  
  if (awayTeamName && state.match.away.name) {
    awayTeamName.textContent = state.match.away.name.toUpperCase();
  }
  
  // Função auxiliar para criar o HTML do jogador
  const createPlayerItem = (jogador, tipo) => {
    const item = document.createElement('div');
    item.className = `panel-player-item ${tipo === 'titular' ? 'titular' : 'reserva'}`;
    
    // Tratamento para suportar tanto string antiga quanto novo objeto com foto
    let nome = jogador;
    let fotoUrl = null;
    let numero = '';
    
    if (typeof jogador === 'object' && jogador !== null) {
        nome = jogador.nome;
        fotoUrl = jogador.foto;
        numero = jogador.numero ? `<span class="player-number">${jogador.numero}</span>` : '';
    }

    // Lógica da Imagem
    let iconHtml = '';
    if (fotoUrl) {
        // Se tiver foto, usa a imagem
        iconHtml = `<div class="panel-player-photo" style="background-image: url('${fotoUrl}');"></div>`;
    } else {
        // Se não, usa o ícone padrão
        iconHtml = `<div class="panel-player-icon"><i class="fas fa-user"></i></div>`;
    }

    item.innerHTML = `
      ${iconHtml}
      <div class="player-info-wrapper">
         <span class="panel-player-name">${numero} ${nome}</span>
         <span class="panel-player-position">${tipo.toUpperCase()}</span>
      </div>
    `;
    return item;
  };

  const homeLineupList = document.getElementById('panel-home-lineup');
  if (homeLineupList && escalacao.home) {
    homeLineupList.innerHTML = '';
    
    // Titulares
    const titulares = escalacao.home.titulares || [];
    titulares.forEach(jogador => {
      homeLineupList.appendChild(createPlayerItem(jogador, 'titular'));
    });
    
    // Reservas
    const reservas = escalacao.home.reservas || [];
    reservas.forEach(jogador => {
      homeLineupList.appendChild(createPlayerItem(jogador, 'reserva'));
    });
    
    // Técnico
    if (escalacao.home.tecnico) {
      const tecnicoItem = document.createElement('div');
      tecnicoItem.className = 'panel-player-item';
      tecnicoItem.style.borderLeft = '3px solid var(--accent)';
      tecnicoItem.innerHTML = `
        <div class="panel-player-icon"><i class="fas fa-whistle"></i></div>
        <span class="panel-player-name"><strong>Técnico:</strong> ${escalacao.home.tecnico}</span>
      `;
      homeLineupList.appendChild(tecnicoItem);
    }
  }
  
  const awayLineupList = document.getElementById('panel-away-lineup');
  if (awayLineupList && escalacao.away) {
    awayLineupList.innerHTML = '';
    
    // Titulares
    const titulares = escalacao.away.titulares || [];
    titulares.forEach(jogador => {
      awayLineupList.appendChild(createPlayerItem(jogador, 'titular'));
    });
    
    // Reservas
    const reservas = escalacao.away.reservas || [];
    reservas.forEach(jogador => {
      awayLineupList.appendChild(createPlayerItem(jogador, 'reserva'));
    });
    
    // Técnico
    if (escalacao.away.tecnico) {
      const tecnicoItem = document.createElement('div');
      tecnicoItem.className = 'panel-player-item';
      tecnicoItem.style.borderLeft = '3px solid var(--accent)';
      tecnicoItem.innerHTML = `
        <div class="panel-player-icon"><i class="fas fa-whistle"></i></div>
        <span class="panel-player-name"><strong>Técnico:</strong> ${escalacao.away.tecnico}</span>
      `;
      awayLineupList.appendChild(tecnicoItem);
    }
  }
}

/**
 * NAVEGAÇÃO / MENU
 */
function initNavigation() {
  const toggle = document.getElementById("menuToggle");
  const menu = document.getElementById("navMenu");
  if (toggle && menu) {
    toggle.onclick = () => {
      menu.classList.toggle("active");
      toggle.classList.toggle("active");
    };
  }
}

function dispararAnimacaoFullScreen(tipo) {
  const overlay = document.getElementById("fullscreen-overlay");
  const container = document.getElementById("lottie-fullscreen");
  const textOverlay = document.getElementById("animation-text-overlay");

  if (!overlay || !container || !textOverlay) return;

  textOverlay.classList.remove("jump", "text-amarelo", "text-vermelho");
  textOverlay.innerText = "";
  container.innerHTML = "";
  overlay.style.display = "flex";

  if (tipo === "amarelo") {
    textOverlay.innerText = "CARTÃO AMARELO";
    textOverlay.classList.add("text-amarelo");
  } else if (tipo === "vermelho") {
    textOverlay.innerText = "CARTÃO VERMELHO";
    textOverlay.classList.add("text-vermelho");
  } else if (tipo === "penalti") {
    textOverlay.innerText = "PÊNALTI";
    textOverlay.style.color = "#fff";
  }
  
  void textOverlay.offsetWidth;
  textOverlay.classList.add("jump");

  let path =
    tipo === "amarelo"
      ? "../assets/Carto Amarelo.json"
      : tipo === "vermelho"
      ? "../assets/Cartão Vermelho.json"
      : "../assets/Penalti.json";
  if (tipo === "gol") path = "../assets/goal.json";

  const anim = lottie.loadAnimation({
    container: container,
    renderer: "svg",
    loop: false,
    autoplay: true,
    path: path,
  });

  anim.onComplete = () => {
    setTimeout(() => {
      overlay.style.display = "none";
      textOverlay.classList.remove("jump");
    }, 500); 
  };
}

/**
 * FUNÇÕES DE TESTE PARA DEBUG
 */
window.cabulosoTeste = {
  gol: () => {
    dispararAnimacaoFullScreen("gol");
    console.log("⚽ GOOOOL EM TELA CHEIA!");
  },
  amarelo: () => {
    dispararAnimacaoFullScreen("amarelo");
    console.log("🟨 CARTÃO AMARELO EM TELA CHEIA!");
  },
  vermelho: () => {
    dispararAnimacaoFullScreen("vermelho");
    console.log("🟥 CARTÃO VERMELHO EM TELA CHEIA!");
  },
  penalti: () => {
    console.log("🎯 PÊNALTI DETECTADO!");
    dispararAnimacaoFullScreen("penalti");
  },
  abrirEstatisticas: () => {
    const overlay = document.getElementById('floating-overlay');
    const statsPanel = document.getElementById('stats-panel');
    if (overlay && statsPanel) {
      overlay.classList.add('active');
      statsPanel.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },
  abrirEscalacoes: () => {
    const overlay = document.getElementById('floating-overlay');
    const lineupPanel = document.getElementById('lineup-panel');
    if (overlay && lineupPanel) {
      overlay.classList.add('active');
      lineupPanel.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }
}
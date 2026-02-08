/**
 * Cabuloso News - Minuto a Minuto
 * Versão: 9.0 - TIMELINE FULL WIDTH + WIDGETS SUPERIORES
 */
let ultimoLanceId = null;
let lastValidStats = null;
let animationLock = false;

const CONFIG = {
  webhookUrl: "https://cabuloso-api.cabulosonews92.workers.dev/?type=ao-vivo",
  apiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/?type=jogos",
  updateInterval: 5000, // ✅ CORRIGIDO: 5 segundos ao invés de 10
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

const EVENT_PRIORITY = {
  gol: 1,
  penalti: 2,
  vermelho: 3,
  amarelo: 4,
};

const animationQueue = {
  queue: [],
  isPlaying: false,
  lastEvents: new Map(), // hash -> timestamp
  MAX_EVENT_AGE: 10 * 60 * 1000, // 10 minutos
  
  add(event) {
    const now = Date.now();
  
    for (const [hash, time] of this.lastEvents.entries()) {
      if (now - time > this.MAX_EVENT_AGE) {
        this.lastEvents.delete(hash);
      }
    }
  
    if (this.lastEvents.has(event.hash)) return;
  
    this.lastEvents.set(event.hash, now);
  
    this.queue.push(event);
  
    this.queue.sort(
      (a, b) => EVENT_PRIORITY[a.type] - EVENT_PRIORITY[b.type]
    );
  
    if (!this.isPlaying) this.playNext();
  },  

  async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }
  
    this.isPlaying = true;
    const event = this.queue.shift();
  
    await this.playAnimation(event.type);
  
    this.isPlaying = false;
    this.playNext();
  },

  playAnimation(type) {
    return new Promise((resolve) => {
      dispararAnimacaoFullScreen(type);

      setTimeout(resolve, 100);
    });
  },
};

function gerarHashLance(minuto, descricao) {
  const minutoNormalizado = String(minuto).replace(/\D/g, "");
  return btoa(
    unescape(
      encodeURIComponent(
        `${minutoNormalizado}|${descricao
          .toLowerCase()
          .replace(/gol|cartão|amarelo|vermelho|pênalti/g, "")
          .trim()}`,
      ),
    ),
  );
}

let liveInterval = null;

function startLivePolling() {
  if (liveInterval) return;
  console.log("🔄 Iniciando polling a cada", CONFIG.updateInterval / 1000, "segundos");
  liveInterval = setInterval(fetchLiveData, CONFIG.updateInterval);
}

function stopLivePolling() {
  if (liveInterval) {
    console.log("⏸️ Parando polling automático");
    clearInterval(liveInterval);
    liveInterval = null;
  }
}

const animationCache = {};

function preloadAnimations() {
  animationCache.gol = "../assets/goal.json";
  animationCache.amarelo = "../assets/Carto Amarelo.json";
  animationCache.vermelho = "../assets/Cartão Vermelho.json";
  animationCache.penalti = "../assets/Penalti.json";

  console.log("🎬 Animações pré-carregadas");
}


document.addEventListener("DOMContentLoaded", async () => {
  initNavigation();
  initTopFloatingButtons();
  fetchLiveData();
  startLivePolling(); // ✅ CORRIGIDO: Inicia o polling automático
  loadAgenda();
  setInterval(loadAgenda, 30000);
});

const fetchLiveData = async () => {
  try {
    const response = await fetch(`${CONFIG.webhookUrl}&t=${Date.now()}`);

    let data = await response.json();

    // Se a API retornar uma lista [], pegamos o primeiro objeto
    if (Array.isArray(data)) {
      data = data[0];
    }

    if (data && data[""] !== undefined) {
      data = data[""]; // Extrai os dados da chave vazia
    }

    if (data.estatisticas && Object.keys(data.estatisticas).length > 0) {
      lastValidStats = data.estatisticas;
    }

    // Verifica se é jogo ao vivo
    const isLiveMatch =
      data && (data.success === true || (data.placar && data.placar.status));

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

  const minuto = state.match.minute || "0'";
  const hash = gerarHashLance(minuto, "GOL");

  animationQueue.add({
    type: "gol",
    minute: minuto,
    hash,
  });
}

function processarNovoLance(lance) {
  const desc = lance.descricao?.toUpperCase() || "";
  const minuto = lance.minuto ? String(lance.minuto) : "0'";
  const hash = gerarHashLance(minuto, desc);

  if (desc.includes("GOL")) {
    animationQueue.add({ type: "gol", minute: minuto, hash });
    return;
  }

  if (desc.includes("CARTÃO VERMELHO") || desc.includes("EXPULSO")) {
    animationQueue.add({ type: "vermelho", minute: minuto, hash });
    return;
  }

  if (
    desc.includes("PENALIDADE MÁXIMA") ||
    desc.includes("PÊNALTI") ||
    desc.includes("PENALTI") ||
    desc.includes("MARCA DA CAL")
  ) {
    animationQueue.add({ type: "penalti", minute: minuto, hash });
    return;
  }

  if (desc.includes("CARTÃO AMARELO") || desc.includes("AMARELO")) {
    animationQueue.add({ type: "amarelo", minute: minuto, hash });
  }
}

/**
 * EXIBE A INTERFACE DE JOGO AO VIVO
 */
const showLiveMatchUI = () => {
  const liveSections = document.getElementById("live-match-sections");
  const countdownWrapper = document.getElementById("countdown-wrapper");
  document.body.classList.add("live-match");
  if (liveSections) liveSections.style.display = "block";
  if (countdownWrapper) countdownWrapper.style.display = "none";

  if (state.countdownInterval) {
    clearInterval(state.countdownInterval);
    state.countdownInterval = null;
  }

  if (!liveInterval) {
    startLivePolling();
  }
};

/**
 * EXIBE CONTAGEM REGRESSIVA PARA PRÓXIMO JOGO
 */
const showNextMatchCountdown = () => {
  const liveSections = document.getElementById("live-match-sections");
  const countdownWrapper = document.getElementById("countdown-wrapper");
  document.body.classList.remove("live-match");
  if (liveSections) liveSections.style.display = "none";
  if (countdownWrapper) countdownWrapper.style.display = "flex";

  updateNextMatchCountdown();
};

/**
 * ATUALIZA CONTAGEM REGRESSIVA
 */
function updateNextMatchCountdown() {
  const now = new Date();
  if (!state.agendaData || !state.agendaData.proximos) {
    displayDefaultCountdown();
    return;
  }

  const nextMatch = state.agendaData.proximos.find((jogo) => {
    const matchDate = new Date(jogo.data);
    return matchDate > now;
  });

  if (!nextMatch) {
    displayDefaultCountdown();
    return;
  }

  const matchDate = new Date(nextMatch.data);
  const diff = matchDate - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  updateCountdownDisplay({
    hours: hours.toString().padStart(2, "0"),
    minutes: minutes.toString().padStart(2, "0"),
    seconds: seconds.toString().padStart(2, "0"),
    home: nextMatch.mandante,
    away: nextMatch.visitante,
    homeLogo: nextMatch.logo_mandante,
    awayLogo: nextMatch.logo_visitante,
  });
}

/**
 * ATUALIZA O HTML DA CONTAGEM REGRESSIVA
 */
function updateCountdownDisplay(data) {
  const container = document.getElementById("countdown-wrapper");
  if (!container) return;

  container.innerHTML = `
    <div class="countdown-container">
      <div class="countdown-header">
        <h2>PRÓXIMA PARTIDA EM</h2>
      </div>
      <div class="countdown-timer">
        <div class="countdown-box">
          <span class="countdown-number">${data.hours}</span>
          <span class="countdown-label">HORAS</span>
        </div>
        <div class="countdown-box">
          <span class="countdown-number">${data.minutes}</span>
          <span class="countdown-label">MINUTOS</span>
        </div>
        <div class="countdown-box">
          <span class="countdown-number">${data.seconds}</span>
          <span class="countdown-label">SEGUNDOS</span>
        </div>
      </div>
      <div class="countdown-match">
        <div class="countdown-team">
          <img src="${data.homeLogo}" alt="${data.home}" />
          <span>${data.home}</span>
        </div>
        <span class="countdown-vs">VS</span>
        <div class="countdown-team">
          <img src="${data.awayLogo}" alt="${data.away}" />
          <span>${data.away}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * EXIBE MENSAGEM PADRÃO QUANDO NÃO HÁ PRÓXIMO JOGO
 */
function displayDefaultCountdown() {
  const container = document.getElementById("countdown-wrapper");
  if (!container) return;

  container.innerHTML = `
    <div class="countdown-container">
      <div class="countdown-header">
        <h2>AGUARDANDO PRÓXIMA PARTIDA</h2>
      </div>
      <p>Nenhum jogo agendado no momento.</p>
    </div>
  `;
}

/**
 * ATUALIZAR O ESTADO DA PARTIDA
 */
function updateMatchState(data) {
  if (!data.placar) return;

  state.match.home.name = data.placar.mandante || "Mandante";
  state.match.home.logo = data.placar.logo_mandante || "";
  state.match.away.name = data.placar.visitante || "Visitante";
  state.match.away.logo = data.placar.logo_visitante || "";
  state.match.score.home = parseInt(data.placar.gols_mandante) || 0;
  state.match.score.away = parseInt(data.placar.gols_visitante) || 0;
  state.match.status = data.placar.status || "AO VIVO";
  state.match.minute =
    data.placar.tempo || data.placar.minuto || data.placar.periodo || "0'";
}

/**
 * RENDERIZAR TODOS OS COMPONENTES
 */
function renderAllComponents(data) {
  renderScoreboard();
  renderTimeline(data.narracao || []);
  renderTopWidgets(data);
  renderStats(data.estatisticas || {});
}

/**
 * RENDERIZAR PLACAR
 */
function renderScoreboard() {
  const scoreboardContainer = document.getElementById("scoreboard");
  if (!scoreboardContainer) return;

  const { home, away, score, status, minute } = state.match;

  scoreboardContainer.innerHTML = `
    <div class="scoreboard">
      <div class="team home-team">
        <img src="${home.logo}" alt="${home.name}" />
        <span>${home.name}</span>
      </div>
      <div class="score-center">
        <div class="score">
          <span class="score-home">${score.home}</span>
          <span class="score-separator">×</span>
          <span class="score-away">${score.away}</span>
        </div>
        <div class="match-info">
          <span class="match-status">${status}</span>
          <span class="match-time">${minute}</span>
        </div>
      </div>
      <div class="team away-team">
        <img src="${away.logo}" alt="${away.name}" />
        <span>${away.name}</span>
      </div>
    </div>
  `;
}

/**
 * RENDERIZAR TIMELINE DE LANCES
 */
function renderTimeline(narracao) {
  const timelineContainer = document.getElementById("timeline");
  if (!timelineContainer) return;

  if (!narracao || narracao.length === 0) {
    timelineContainer.innerHTML = `
      <div class="timeline-empty">
        <i class="fas fa-clock"></i>
        <p>Aguardando lances...</p>
      </div>
    `;
    return;
  }

  timelineContainer.innerHTML = narracao
    .map((lance, index) => {
      const desc = lance.descricao || "";
      let icon = "fa-circle";
      let eventType = "";

      if (desc.toUpperCase().includes("GOL")) {
        icon = "fa-futbol";
        eventType = "gol";
      } else if (
        desc.toUpperCase().includes("CARTÃO AMARELO") ||
        desc.toUpperCase().includes("AMARELO")
      ) {
        icon = "fa-square";
        eventType = "amarelo";
      } else if (
        desc.toUpperCase().includes("CARTÃO VERMELHO") ||
        desc.toUpperCase().includes("EXPULSO")
      ) {
        icon = "fa-square";
        eventType = "vermelho";
      } else if (
        desc.toUpperCase().includes("PÊNALTI") ||
        desc.toUpperCase().includes("PENALTI")
      ) {
        icon = "fa-dot-circle";
        eventType = "penalti";
      }

      return `
        <div class="timeline-item ${eventType}" data-index="${index}">
          <div class="timeline-marker">
            <i class="fas ${icon}"></i>
          </div>
          <div class="timeline-content">
            <div class="timeline-time">${lance.minuto || "0'"}</div>
            <div class="timeline-description">${desc}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

/**
 * RENDERIZAR WIDGETS SUPERIORES
 */
function renderTopWidgets(data) {
  const widgetsContainer = document.getElementById("top-widgets");
  if (!widgetsContainer) return;

  const stats = data.estatisticas || lastValidStats || {};

  const posse_home = stats.posse_home || "50%";
  const posse_away = stats.posse_away || "50%";
  const chutes_home = stats.chutes_gol_home || 0;
  const chutes_away = stats.chutes_gol_away || 0;
  const escanteios_home = stats.escanteios_home || 0;
  const escanteios_away = stats.escanteios_away || 0;

  widgetsContainer.innerHTML = `
    <div class="widget">
      <div class="widget-title">Posse de Bola</div>
      <div class="widget-content">
        <div class="widget-bar">
          <div class="widget-bar-fill home" style="width: ${posse_home}"></div>
          <div class="widget-bar-fill away" style="width: ${posse_away}"></div>
        </div>
        <div class="widget-values">
          <span>${posse_home}</span>
          <span>${posse_away}</span>
        </div>
      </div>
    </div>

    <div class="widget">
      <div class="widget-title">Chutes a Gol</div>
      <div class="widget-content">
        <div class="widget-values">
          <span class="widget-stat-home">${chutes_home}</span>
          <span class="widget-stat-away">${chutes_away}</span>
        </div>
      </div>
    </div>

    <div class="widget">
      <div class="widget-title">Escanteios</div>
      <div class="widget-content">
        <div class="widget-values">
          <span class="widget-stat-home">${escanteios_home}</span>
          <span class="widget-stat-away">${escanteios_away}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * RENDERIZAR ESTATÍSTICAS NO PAINEL FLUTUANTE
 */
function renderStats(stats) {
  renderPanelStats(stats);
}

/**
 * CARREGAR AGENDA
 */
async function loadAgenda() {
  try {
    const response = await fetch(`${CONFIG.apiUrl}&t=${Date.now()}`);
    const data = await response.json();

    if (data && data.proximos) {
      state.agendaData = data;
    }
  } catch (error) {
    console.error("Erro ao carregar agenda:", error);
  }
}

/**
 * INICIALIZAR BOTÕES FLUTUANTES
 */
function initTopFloatingButtons() {
  const overlay = document.getElementById("floating-overlay");
  const statsBtn = document.getElementById("open-stats");
  const lineupBtn = document.getElementById("open-lineup");
  const statsPanel = document.getElementById("stats-panel");
  const lineupPanel = document.getElementById("lineup-panel");

  if (statsBtn) {
    statsBtn.onclick = () => {
      if (overlay && statsPanel) {
        overlay.classList.add("active");
        statsPanel.classList.add("active");
        document.body.style.overflow = "hidden";
      }
    };
  }

  if (lineupBtn) {
    lineupBtn.onclick = () => {
      if (overlay && lineupPanel) {
        overlay.classList.add("active");
        lineupPanel.classList.add("active");
        document.body.style.overflow = "hidden";
      }
    };
  }

  if (overlay) {
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        closeAllPanels();
      }
    };
  }

  const closeBtns = document.querySelectorAll(".panel-close");
  closeBtns.forEach((btn) => {
    btn.onclick = closeAllPanels;
  });
}

function closeAllPanels() {
  const overlay = document.getElementById("floating-overlay");
  const panels = document.querySelectorAll(".floating-panel");

  if (overlay) overlay.classList.remove("active");
  panels.forEach((panel) => panel.classList.remove("active"));
  document.body.style.overflow = "";
}

/**
 * RENDERIZAR ESTATÍSTICAS NO PAINEL FLUTUANTE
 */
function renderPanelStats(stats) {
  const homeStatsList = document.getElementById("panel-home-stats");
  if (homeStatsList) {
    const homeItems = [
      { label: "Posse de bola", value: stats.posse_home || "0%" },
      { label: "Chutes", value: stats.chutes_home || 0 },
      { label: "Chutes a gol", value: stats.chutes_gol_home || 0 },
      {
        label: "Precisão",
        value: stats.chutes_home
          ? `${Math.round((stats.chutes_gol_home / stats.chutes_home) * 100) || 0}%`
          : "0%",
      },
      { label: "Passes certos", value: stats.passes_certos_home || 0 },
      { label: "Passes errados", value: stats.passes_errados_home || 0 },
      {
        label: "Precisão passes",
        value: stats.passes_certos_home
          ? `${Math.round((stats.passes_certos_home / (stats.passes_certos_home + stats.passes_errados_home)) * 100) || 0}%`
          : "0%",
      },
      { label: "Faltas", value: stats.faltas_home || 0 },
      { label: "Desarmes", value: stats.desarmes_home || 0 },
      { label: "Escanteios", value: stats.escanteios_home || 0 },
      { label: "Impedimentos", value: stats.impedimentos_home || 0 },
      { label: "Cartões amarelos", value: stats.amarelos_home || 0 },
      {
        label: "Cartões vermelhos",
        value:
          stats.vermelhos_home?.total !== undefined
            ? stats.vermelhos_home.total
            : stats.vermelhos_home || 0,
      },
    ];

    homeStatsList.innerHTML = homeItems
      .map(
        (item) => `
      <div class="panel-stat-item">
        <span class="panel-stat-label">${item.label}</span>
        <span class="panel-stat-value">${item.value}</span>
      </div>
    `,
      )
      .join("");
  }

  const awayStatsList = document.getElementById("panel-away-stats");
  if (awayStatsList) {
    const awayItems = [
      { label: "Posse de bola", value: stats.posse_away || "0%" },
      { label: "Chutes", value: stats.chutes_away || 0 },
      { label: "Chutes a gol", value: stats.chutes_gol_away || 0 },
      {
        label: "Precisão",
        value: stats.chutes_away
          ? `${Math.round((stats.chutes_gol_away / stats.chutes_away) * 100) || 0}%`
          : "0%",
      },
      { label: "Passes certos", value: stats.passes_certos_away || 0 },
      { label: "Passes errados", value: stats.passes_errados_away || 0 },
      {
        label: "Precisão passes",
        value: stats.passes_certos_away
          ? `${Math.round((stats.passes_certos_away / (stats.passes_certos_away + stats.passes_errados_away)) * 100) || 0}%`
          : "0%",
      },
      { label: "Faltas", value: stats.faltas_away || 0 },
      { label: "Desarmes", value: stats.desarmes_away || 0 },
      { label: "Escanteios", value: stats.escanteios_away || 0 },
      { label: "Impedimentos", value: stats.impedimentos_away || 0 },
      { label: "Cartões amarelos", value: stats.amarelos_away || 0 },
      {
        label: "Cartões vermelhos",
        value:
          stats.vermelhos_home?.total !== undefined
            ? stats.vermelhos_home.total
            : stats.vermelhos_home || 0,
      },
    ];

    awayStatsList.innerHTML = awayItems
      .map(
        (item) => `
      <div class="panel-stat-item">
        <span class="panel-stat-label">${item.label}</span>
        <span class="panel-stat-value">${item.value}</span>
      </div>
    `,
      )
      .join("");
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

  const homeTeamName = document.getElementById("panel-home-team-name");
  const awayTeamName = document.getElementById("panel-away-team-name");

  if (homeTeamName && state.match.home.name) {
    homeTeamName.textContent = state.match.home.name.toUpperCase();
  }

  if (awayTeamName && state.match.away.name) {
    awayTeamName.textContent = state.match.away.name.toUpperCase();
  }

  // Função auxiliar para criar o HTML do jogador
  const createPlayerItem = (jogador, tipo) => {
    const item = document.createElement("div");
    item.className = `panel-player-item ${tipo === "titular" ? "titular" : "reserva"}`;

    // Tratamento para suportar tanto string antiga quanto novo objeto com foto
    let nome = jogador;
    let fotoUrl = null;
    let numero = "";

    if (typeof jogador === "object" && jogador !== null) {
      nome = jogador.nome;
      fotoUrl = jogador.foto;
      numero = jogador.numero
        ? `<span class="player-number">${jogador.numero}</span>`
        : "";
    }

    // Lógica da Imagem
    let iconHtml = "";
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

  const homeLineupList = document.getElementById("panel-home-lineup");
  if (homeLineupList && escalacao.home) {
    homeLineupList.innerHTML = "";

    // Titulares
    const titulares = escalacao.home.titulares || [];
    titulares.forEach((jogador) => {
      homeLineupList.appendChild(createPlayerItem(jogador, "titular"));
    });

    // Reservas
    const reservas = escalacao.home.reservas || [];
    reservas.forEach((jogador) => {
      homeLineupList.appendChild(createPlayerItem(jogador, "reserva"));
    });

    // Técnico
    if (escalacao.home.tecnico) {
      const tecnicoItem = document.createElement("div");
      tecnicoItem.className = "panel-player-item";
      tecnicoItem.style.borderLeft = "3px solid var(--accent)";
      tecnicoItem.innerHTML = `
        <div class="panel-player-icon"><i class="fas fa-whistle"></i></div>
        <span class="panel-player-name"><strong>Técnico:</strong> ${escalacao.home.tecnico}</span>
      `;
      homeLineupList.appendChild(tecnicoItem);
    }
  }

  const awayLineupList = document.getElementById("panel-away-lineup");
  if (awayLineupList && escalacao.away) {
    awayLineupList.innerHTML = "";

    // Titulares
    const titulares = escalacao.away.titulares || [];
    titulares.forEach((jogador) => {
      awayLineupList.appendChild(createPlayerItem(jogador, "titular"));
    });

    // Reservas
    const reservas = escalacao.away.reservas || [];
    reservas.forEach((jogador) => {
      awayLineupList.appendChild(createPlayerItem(jogador, "reserva"));
    });

    // Técnico
    if (escalacao.away.tecnico) {
      const tecnicoItem = document.createElement("div");
      tecnicoItem.className = "panel-player-item";
      tecnicoItem.style.borderLeft = "3px solid var(--accent)";
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
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

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

  const path = animationCache[tipo];
  if (!path) return;
  
  const anim = lottie.loadAnimation({
    container,
    renderer: "svg",
    loop: false,
    autoplay: true,
    path,
  });
  
  anim.addEventListener("complete", () => {
    setTimeout(() => {
      textOverlay.classList.remove("jump");
      overlay.style.display = "none";
  
      anim.destroy(); // ⛔ impede sobreposição
    }, 4500);
  });  
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
    const overlay = document.getElementById("floating-overlay");
    const statsPanel = document.getElementById("stats-panel");
    if (overlay && statsPanel) {
      overlay.classList.add("active");
      statsPanel.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  },
  abrirEscalacoes: () => {
    const overlay = document.getElementById("floating-overlay");
    const lineupPanel = document.getElementById("lineup-panel");
    if (overlay && lineupPanel) {
      overlay.classList.add("active");
      lineupPanel.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  },
};
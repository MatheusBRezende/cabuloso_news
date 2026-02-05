/**
 * Cabuloso News - Minuto a Minuto
 * Versão: 7.2 - CORRIGIDA (Renderização Garantida)
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

document.addEventListener("DOMContentLoaded", async () => {
  initNavigation();
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

  if (desc.includes("CARTÃO VERMELHO") || desc.includes("EXPULSO")) {
    dispararAnimacaoFullScreen("vermelho");
    return;
  }

  if (desc.includes("AMARELO") || desc.includes("CARTÃO AMARELO")) {
    dispararAnimacaoFullScreen("amarelo");
    return;
  }

  if (desc.includes("PÊNALTI") || desc.includes("PENALIDADE MÁXIMA")) {
    console.log("🎯 CHANCE REAL DE GOL: PÊNALTI!");
    // Opcional: Se quiser animação de tela cheia para pênalti, descomente abaixo:
    // dispararAnimacaoFullScreen("penalti"); 
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
    
    // Verifica se existe a propriedade 'agenda' com jogos
    if (data && !data.error && data.agenda && Array.isArray(data.agenda)) {
      // Converte a estrutura da agenda para o formato esperado
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
    // Remove "qui., " ou "dom., " etc. da data se existir
    const cleanDate = dateStr.replace(/^[a-z]{3}\.,\s*/i, '').trim();
    
    // Separa dia, mês e ano (pode vir como "5 fev." ou "05/02/2026")
    let day, month, year;
    
    if (cleanDate.includes('/')) {
      // Formato: "05/02/2026"
      [day, month, year] = cleanDate.split('/');
    } else {
      // Formato: "5 fev."
      const meses = {
        'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
        'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
      };
      
      const parts = cleanDate.split(' ');
      day = parts[0];
      const mesStr = parts[1]?.replace('.', '').toLowerCase();
      month = meses[mesStr] || 1;
      year = new Date().getFullYear(); // Usa ano atual se não especificado
    }
    
    // Processa hora (pode ser "21:30" ou "A definir")
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
  renderTimeline(data.narracao);
  if (data.estatisticas && Object.keys(data.estatisticas).length > 0) {
    renderStats(data.estatisticas, "home");
    renderStats(data.estatisticas, "away");
  }  
  renderLineups(data.escalacao, data.arbitragem);
}

function renderMatchHeader(placar, narracao) {
  const container = document.getElementById("live-match-container");
  if (!container || !placar) return;

  // Pega o minuto atual do primeiro lance (mais recente)
  let currentMinute = "0'";
  if (narracao && narracao.length > 0 && narracao[0].minuto) {
    currentMinute = String(narracao[0].minuto)
      .replace(/<[^>]*>/g, "")
      .trim();
  }

  // Determina o status baseado no minuto
  let matchStatus = placar.status || "AO VIVO";
  
  // Lógica de mudança automática de status
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


function renderTimeline(narracao) {
  const container = document.getElementById("timeline-container");
  const statusIndicator = document.getElementById("match-status-indicator");
  const noEventsMessage = document.getElementById("no-events-message");

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
    let extraClass = lance.classe || "lance-normal";
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

    item.className = `timeline-item ${extraClass}`;

    let min = "0'";
    if(lance.minuto !== undefined && lance.minuto !== null) {
        min = String(lance.minuto)
            .replace(/<[^>]*>/g, "")
            .trim();
    }

    item.innerHTML = `
      <div class="timeline-time"><span class="time-badge">${min}</span></div>
      <div class="timeline-content">
        <div class="timeline-icon ${iconClass}">${iconContent}</div>
        <div class="timeline-text"><p>${lance.descricao}</p></div>
      </div>
    `;
    container.appendChild(item);
  });
}

function renderStats(stats, side) {
  const container = document.getElementById(`${side}-stats-list`);
  const teamNameContainer = document.getElementById(`${side}-stats-header`);
  if (!container || !stats) return;

  container.innerHTML = ""; // 👈 BLINDAGEM

  if (teamNameContainer) {
    const teamName =
      side === "home" ? state.match.home.name : state.match.away.name;

    teamNameContainer.innerHTML = `
      <i class="fas fa-chart-bar"></i>
      <span>ESTATÍSTICAS ${teamName.toUpperCase()}</span>
    `;
  }

  const isHome = side === "home";

  const items = [
    { label: "Posse de bola", val: isHome ? stats.posse_home : stats.posse_away },
    { label: "Chutes", val: isHome ? stats.chutes_home : stats.chutes_away },
    { label: "Chutes a gol", val: isHome ? stats.chutes_gol_home : stats.chutes_gol_away },
    { label: "Chutes para fora", val: isHome ? stats.chutes_fora_home : stats.chutes_fora_away },
    { label: "Passes certos", val: isHome ? stats.passes_certos_home : stats.passes_certos_away },
    { label: "Passes errados", val: isHome ? stats.passes_errados_home : stats.passes_errados_away },
    { label: "Faltas cometidas", val: isHome ? stats.faltas_home : stats.faltas_away },
    { label: "Desarmes", val: isHome ? stats.desarmes_home : stats.desarmes_away },
    { label: "Escanteios", val: isHome ? stats.escanteios_home : stats.escanteios_away },
    { label: "Impedimentos", val: isHome ? stats.impedimentos_home : stats.impedimentos_away },
    { label: "Cartões amarelos", val: isHome ? stats.amarelos_home : stats.amarelos_away },
    { label: "Cartões vermelhos", val: isHome ? stats.vermelhos_home : stats.vermelhos_away },
  ];

  container.innerHTML = items
    .map(
      (i) => `
        <div class="stat-item">
          <span class="stat-label">${i.label}</span>
          <span class="stat-value">${i.val !== undefined ? i.val : 0}</span>
        </div>
      `
    )
    .join("");
}



/**
 * LOGICA DE ESCALAÇÃO HORIZONTAL (LOOP)
 */
const renderPlayerTrack = (titulares, reservas) => {
  const tpl = (name, isRes) => `
    <div class="player-item-min">
      <i class="fas fa-user-circle" style="margin-right:8px; color:${
        isRes ? "var(--gray-400)" : "var(--primary)"
      };"></i>
      <span style="${
        isRes ? "color:var(--gray-500); font-weight:400;" : ""
      }">${name}</span>
    </div>
  `;

  const allPlayers = [
    ...titulares.map((p) => tpl(p, false)),
    ...reservas.map((p) => tpl(p, true)),
   ].join("");

  return `<div class="lineup-players-track">${allPlayers}${allPlayers}</div>`;
};

/**
 * RENDERIZA AS ESCALAÇÕES COM ROLAGEM INDEPENDENTE
 */
function renderLineups(escalacao, arbitragem) {
  if (!escalacao || !escalacao.home || !escalacao.away) {
    console.warn("⚠️ Escalação inválida:", escalacao);
    return;
  }
  
  const hCont = document.getElementById("home-lineup-content");
  const aCont = document.getElementById("away-lineup-content");
  const homeTeamName = document.getElementById("home-team-name-lineup");
  const awayTeamName = document.getElementById("away-team-name-lineup");

  if (homeTeamName) {
    homeTeamName.innerHTML = `<i class="fas fa-users"></i> ${state.match.home.name.toUpperCase()}`;
  }

  if (awayTeamName) {
    awayTeamName.innerHTML = `<i class="fas fa-users"></i> ${state.match.away.name.toUpperCase()}`;
  }

  if (hCont && escalacao && escalacao.home) {
    const titulares = escalacao.home.titulares || [];
    const reservas = escalacao.home.reservas || [];
    const tecnico = escalacao.home.tecnico || "Técnico não informado";

    hCont.innerHTML = `
      <div class="lineup-players-container">
        ${renderPlayerTrack(titulares, reservas)}
      </div>
      <div style="margin-top:10px; text-align:center; font-size:0.8rem; border-top:1px solid var(--gray-200); padding-top:5px">
        <strong>Técnico:</strong> ${tecnico}
      </div>
    `;
  } else if (hCont) {
    hCont.innerHTML =
      '<div class="loading-stats">Escalação não disponível</div>';
  }

  if (aCont && escalacao && escalacao.away) {
    const titulares = escalacao.away.titulares || [];
    const reservas = escalacao.away.reservas || [];
    const tecnico = escalacao.away.tecnico || "Técnico não informado";

    aCont.innerHTML = `
      <div class="lineup-players-container">
        ${renderPlayerTrack(titulares, reservas)}
      </div>
      <div style="margin-top:10px; text-align:center; font-size:0.8rem; border-top:1px solid var(--gray-200); padding-top:5px">
        <strong>Técnico:</strong> ${tecnico}
      </div>
    `;
  } else if (aCont) {
    aCont.innerHTML =
      '<div class="loading-stats">Escalação não disponível</div>';
  }

  const ref = document.getElementById("match-referee-info");
  if (ref && arbitragem) {
    ref.innerHTML = `
      <i class="fas fa-whistle" style="color:var(--primary); font-size: 1.2rem; margin-bottom: 5px;"></i>
      <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--gray-500);">Árbitro</div>
      <div style="font-weight: bold; font-size: 0.9rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis;">${arbitragem}</div>
    `;
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
}
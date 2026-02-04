/**
 * Cabuloso News - Minuto a Minuto
 * Versão: 7.0 - COMPLETA com Loop Infinito de Escalações
 */
let ultimoLanceId = null;

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
      `${CONFIG.webhookUrl}?type=ao-vivo&t=${Date.now()}`
    );
    const data = await response.json();

    if (data.error || !data.mandante) {
      if (state.logsEnabled) console.log("⏱️ Modo Agenda: Sem jogo ao vivo.");
      state.matchStarted = false;
      showNextMatchCountdown(); 
      return;
    }

    // Se chegou aqui, tem jogo!
    state.matchStarted = true;
    showLiveMatchUI();

    updateMatchState(data);
    processarGol();
    detectarNovoLance(data);
    renderAllComponents(data);
    
  } catch (e) {
    if (state.logsEnabled) console.log("⚠️ Erro na requisição, ativando Countdown");
    state.matchStarted = false;
    showNextMatchCountdown();
  }
};

function detectarNovoLance(data) {
  if (!data.narracao || data.narracao.length === 0) return;

  const lance = data.narracao[0];
  const id = btoa(unescape(encodeURIComponent(lance.minuto + lance.descricao)));

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
  const desc = lance.descricao.toUpperCase();
  const icone = lance.icone;

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
  state.countdownInterval = setInterval(update, 1000);
  update();
};

/**
 * CARREGA AGENDA E PEGA PRÓXIMO JOGO
 */
const loadAgenda = async () => {
  try {
    const response = await fetch(CONFIG.apiUrl);
    const data = await response.json();
    state.agendaData =
      Array.isArray(data) && data.length > 0 ? data[0].agenda : [];
  } catch (error) {
    console.error("❌ Erro ao carregar agenda:", error);
    state.agendaData = [];
  }
};

const getNextMatchFromAgenda = () => {
  if (!state.agendaData || state.agendaData.length === 0) return null;
  const meses = {
    jan: 0,
    fev: 1,
    mar: 2,
    abr: 3,
    mai: 4,
    jun: 5,
    jul: 6,
    ago: 7,
    set: 8,
    out: 9,
    nov: 10,
    dez: 11,
  };
  const now = new Date();
  const matches = state.agendaData
    .map((m) => {
      try {
        const parts = m.data
          .trim()
          .split(/[,.\s]+/)
          .filter((p) => p);
        const day = parseInt(parts.find((p) => /^\d+$/.test(p)));
        const mesTexto = parts.find((p) =>
          meses.hasOwnProperty(p.toLowerCase())
        );
        const [hh, mm] = m.hora.split(":").map(Number);
        const d = new Date(
          now.getFullYear(),
          meses[mesTexto.toLowerCase()],
          day,
          hh || 0,
          mm || 0
        );
        if (d < now && now - d > 86400000) d.setFullYear(now.getFullYear() + 1);
        return { ...m, dataObj: d };
      } catch (e) {
        return null;
      }
    })
    .filter((m) => m !== null)
    .sort((a, b) => a.dataObj - b.dataObj);
  return matches.find((m) => m.dataObj > now) || matches[0];
};

/**
 * ATUALIZA O ESTADO E RENDERIZA COMPONENTES
 */
function updateMatchState(data) {
  const placar = data.placar || data;
  state.match.home.name = placar.home_name || placar.mandante || "Mandante";
  state.match.away.name = placar.away_name || placar.visitante || "Visitante";
  state.match.home.logo = placar.home_logo || placar.escudo_mandante || "";
  state.match.away.logo = placar.away_logo || placar.escudo_visitante || "";
  state.match.score.home = placar.home ?? placar.placar_mandante ?? 0;
  state.match.score.away = placar.away ?? placar.placar_visitante ?? 0;
  state.match.status = placar.status || "AO VIVO";

  // Lógica aprimorada para pegar o minuto
  let minutoAtual = "0'";

  // Tenta pegar direto do campo minuto
  if (data.minuto) {
    minutoAtual = data.minuto;
  }
  // Se não, pega do último lance da narração
  else if (
    data.narracao &&
    Array.isArray(data.narracao) &&
    data.narracao.length > 0
  ) {
    // Pega o primeiro elemento (geralmente o mais recente é o índice 0 ou o último, dependendo da ordem da API)
    // Assumindo que o índice 0 é o lance mais novo:
    minutoAtual = data.narracao[0].minuto;
  }

  // Limpa caracteres HTML estranhos se vierem da API
  state.match.minute = minutoAtual.replace(/<[^>]*>?/gm, "").trim();
}

function renderAllComponents(data) {
  renderScoreboard();
  if (data.narracao) renderTimeline(data.narracao);
  if (data.estatisticas) {
    renderStats(data.estatisticas, "home");
    renderStats(data.estatisticas, "away");
  }
  if (data.escalacao) renderLineups(data.escalacao, data.arbitragem);
}

function renderScoreboard() {
  const container = document.getElementById("live-match-container");
  if (!container) return;

  // HTML do Badge de Minuto
  const minuteBadge = `
    <div class="match-timer-badge">
        <div class="timer-dot"></div>
        <div class="timer-text">${state.match.minute}</div>
    </div>
  `;

  container.innerHTML = `
    <div class="match-header-card">
      ${minuteBadge} <div class="match-status-badge">${state.match.status}</div>
      
      <div class="score-row">
        <div class="team-info team-home">
          <span class="team-name">${state.match.home.name}</span>
          <img src="${state.match.home.logo}" class="team-logo" alt="${state.match.home.name}">
        </div>
        
        <div class="score-container">
          <span class="score">${state.match.score.home}</span>
          <span class="score-divider">×</span>
          <span class="score">${state.match.score.away}</span>
        </div>
        
        <div class="team-info team-away">
          <span class="team-name">${state.match.away.name}</span>
          <img src="${state.match.away.logo}" class="team-logo" alt="${state.match.away.name}">
        </div>
      </div>
    </div>
  `;
}

function renderTimeline(narracao) {
  const container = document.getElementById("timeline-container");
  if (!container) return;
  container.innerHTML = "";

  narracao.forEach((lance, i) => {
    const item = document.createElement("div");

    // Determina classes especiais para ícones
    let iconClass = "";
    let iconContent = lance.icone || "📝";
    let extraClass = lance.classe || "lance-normal";

    // Lógica para detectar cartões e gol baseado na descrição ou classe
    const desc = lance.descricao.toLowerCase();

    if (lance.is_gol || desc.includes("gol")) {
      iconClass = "icon-goal";
      iconContent = '<i class="fas fa-futbol"></i>';
      extraClass = "lance-gol";
    } else if (desc.includes("amarelo")) {
      iconClass = "icon-yellow-card";
      // Ícone de quadrado (cartão) para animar
      iconContent =
        '<i class="fas fa-square-full" style="font-size: 0.8em;"></i>';
    } else if (desc.includes("vermelho")) {
      iconClass = "icon-red-card";
      iconContent =
        '<i class="fas fa-square-full" style="font-size: 0.8em;"></i>';
    } else if (
      desc.includes("pênalti") ||
      desc.includes("penalidade máxima") ||
      desc.includes("na marca da cal")
    ) {
      iconClass = "icon-penalty";
      iconContent = '<i class="fas fa-bullseye"></i>'; // Ícone de alvo ou bola
      extraClass = "lance-importante";
    }

    item.className = `timeline-item ${extraClass}`;
    const min = lance.minuto
      .replace(/\//g, "")
      .replace(/<[^>]*>?/gm, "")
      .trim();

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
  const teamNameContainer = document.getElementById(`${side}-team-name-lineup`);
  if (!container) return;

  // Atualiza o nome do time no header da escalação
  if (teamNameContainer) {
    const teamName =
      side === "home" ? state.match.home.name : state.match.away.name;
    teamNameContainer.innerHTML = `<i class="fas fa-users"></i> ${teamName.toUpperCase()}`;
  }

  // Atualiza estatísticas
  const items = [
    {
      label: "Posse",
      val: side === "home" ? stats.posse_home : stats.posse_away,
    },
    {
      label: "Chutes",
      val: side === "home" ? stats.finalizacoes_home : stats.finalizacoes_away,
    },
    {
      label: "Cantos",
      val: side === "home" ? stats.escanteios_home : stats.escanteios_away,
    },
  ];

  container.innerHTML = items
    .map(
      (i) => `
    <div class="stat-item"><span class="stat-label">${
      i.label
    }</span><span class="stat-value">${i.val || 0}</span></div>
  `
    )
    .join("");
}

/**
 * LOGICA DE ESCALAÇÃO HORIZONTAL (LOOP)
 */
const renderPlayerTrack = (titulares, reservas) => {
  // Criamos o HTML dos jogadores
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

  // Retornamos a trilha duplicada para o efeito de loop infinito no CSS
  return `<div class="lineup-players-track">${allPlayers}${allPlayers}</div>`;
};

/**
 * RENDERIZA AS ESCALAÇÕES COM ROLAGEM INDEPENDENTE
 */
function renderLineups(escalacao, arbitragem) {
  const hCont = document.getElementById("home-lineup-content");
  const aCont = document.getElementById("away-lineup-content");
  const homeTeamName = document.getElementById("home-team-name-lineup");
  const awayTeamName = document.getElementById("away-team-name-lineup");

  // Atualiza nomes dos times nos headers
  if (homeTeamName) {
    homeTeamName.innerHTML = `<i class="fas fa-users"></i> ${state.match.home.name.toUpperCase()}`;
  }

  if (awayTeamName) {
    awayTeamName.innerHTML = `<i class="fas fa-users"></i> ${state.match.away.name.toUpperCase()}`;
  }

  // Escalação do Mandante - CORREÇÃO: Verifica se existem dados
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

  // Escalação do Visitante - CORREÇÃO: Verifica se existem dados
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

  // Informação da Arbitragem
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

  // Reseta classes e estado
  textOverlay.classList.remove("jump", "text-amarelo", "text-vermelho");
  textOverlay.innerText = "";
  container.innerHTML = "";
  overlay.style.display = "flex";

  // Define o texto
  if (tipo === "amarelo") {
    textOverlay.innerText = "CARTÃO AMARELO";
    textOverlay.classList.add("text-amarelo");
  } else if (tipo === "vermelho") {
    textOverlay.innerText = "CARTÃO VERMELHO";
    textOverlay.classList.add("text-vermelho");
  }
  // Força o navegador a reconhecer o reset para reiniciar a animação CSS
  void textOverlay.offsetWidth;

  // Dispara a animação
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
    // Esperamos a animação de 2.8s de cores + a piscada acabar
    setTimeout(() => {
      overlay.style.display = "none";
      textOverlay.classList.remove("jump");
    }, 500); // Ajustado para dar tempo de ver o cinza final
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
  // ADICIONE ESTA LINHA:
  penalti: () => {
    console.log("🎯 PÊNALTI DETECTADO!");
    dispararAnimacaoFullScreen("penalti");
  },
};

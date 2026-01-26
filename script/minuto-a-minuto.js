/**
 * Cabuloso News - Minuto a Minuto
 * Versão Melhorada: Contador Premium com Dias, Horas, Minutos e Segundos
 */

// ============================================
// CONFIGURACAO
// ============================================
const CONFIG = {
  webhookUrl: "https://spikeofino-meu-n8n-cabuloso.hf.space/webhook/placar-ao-vivo",
  agendaUrl: "backend/agenda_cruzeiro.json",
  updateInterval: 10000,
};

// Estado da aplicacao
const state = {
  matchData: null,
  agendaData: null,
  lastGoalCount: 0,
  liveUpdateInterval: null,
  countdownInterval: null,
  teamsInfo: {
    cruzeiro: { name: "Cruzeiro", logo: "https://admin.cnnbrasil.com.br/wp-content/uploads/sites/12/cruzeiro.png" },
    adversario: { name: "Adversário", logo: "" },
    isCruzeiroHome: false,
  },
  realScore: { home: 0, away: 0 },
  matchStarted: false,
};

// ============================================
// INICIALIZACAO
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  loadAgenda();
  fetchLiveData();
  startLiveUpdates();
});

// ============================================
// CARREGAR AGENDA (ESSENCIAL PARA O PRÓXIMO JOGO)
// ============================================
const loadAgenda = async () => {
  try {
    const response = await fetch(`${CONFIG.agendaUrl}?v=${Date.now()}`);
    if (response.ok) {
      state.agendaData = await response.json();
      console.log("Agenda carregada:", state.agendaData);
      if (!state.matchStarted) renderPreMatchState();
    }
  } catch (error) {
    console.error("Erro ao carregar agenda:", error);
  }
};

// ============================================
// BUSCAR DADOS DO WEBHOOK (COM CORREÇÃO DE ERRO JSON)
// ============================================
const fetchLiveData = async () => {
  try {
    const response = await fetch(`${CONFIG.webhookUrl}?t=${Date.now()}`);
    
    // CORREÇÃO: Verifica se a resposta está OK e se não está vazia
    if (!response.ok || response.status === 204) {
      showEmptyState();
      return;
    }

    const text = await response.text();
    if (!text || text.trim() === "" || text === "[]" || text === "{}") {
      showEmptyState();
      return;
    }

    // Só tenta fazer o parse se tivermos um texto válido
    const rawData = JSON.parse(text);
    const data = Array.isArray(rawData) ? rawData[0] : rawData;
    const lances = data.resultados || [];

    if (lances.length > 0) {
      state.matchStarted = true;
      if (state.countdownInterval) clearInterval(state.countdownInterval);
      processMatchData(lances);
    } else {
      showEmptyState();
    }
  } catch (error) {
    console.error("Aguardando início ou erro no Webhook:", error);
    showEmptyState();
  }
};

// ============================================
// LÓGICA DO PRÓXIMO JOGO E CONTADOR MELHORADO
// ============================================
const getNextMatch = () => {
  if (!state.agendaData || !Array.isArray(state.agendaData)) return null;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const monthMap = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };

  // Filtra jogos que ainda vão acontecer
  const matches = state.agendaData.map(match => {
    try {
      const dateMatch = match.data.match(/(\d+)\s+(\w+)/);
      if (!dateMatch) return null;
      
      const day = parseInt(dateMatch[1]);
      const monthStr = dateMatch[2].toLowerCase().substring(0, 3);
      const month = monthMap[monthStr];
      const [hour, min] = match.hora.split(":").map(Number);
      
      const matchDate = new Date(currentYear, month, day, hour || 0, min || 0);
      if (matchDate < new Date(now.getTime() - 10800000)) matchDate.setFullYear(currentYear + 1);
      
      return { ...match, dateObj: matchDate };
    } catch (e) { return null; }
  }).filter(m => m && m.dateObj > now);

  return matches.length > 0 ? matches[0] : null;
};

// Função para formatar o tempo restante
const formatTimeRemaining = (diff) => {
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isStarting: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, isStarting: false };
};

// Função para atualizar o countdown visualmente
const updateCountdownDisplay = (time) => {
  const daysEl = document.getElementById("countdown-days");
  const hoursEl = document.getElementById("countdown-hours");
  const minutesEl = document.getElementById("countdown-minutes");
  const secondsEl = document.getElementById("countdown-seconds");
  const wrapperEl = document.getElementById("countdown-wrapper");

  if (time.isStarting) {
    if (wrapperEl) {
      wrapperEl.innerHTML = `
        <div class="countdown-starting">
          <div class="countdown-starting-text">
            <i class="fas fa-futbol fa-spin" style="margin-right: 12px;"></i>
            O JOGO VAI COMEÇAR!
          </div>
        </div>
      `;
    }
    return;
  }

  if (daysEl) daysEl.textContent = String(time.days).padStart(2, "0");
  if (hoursEl) hoursEl.textContent = String(time.hours).padStart(2, "0");
  if (minutesEl) minutesEl.textContent = String(time.minutes).padStart(2, "0");
  if (secondsEl) secondsEl.textContent = String(time.seconds).padStart(2, "0");
};

const startCountdown = (targetDate) => {
  if (state.countdownInterval) clearInterval(state.countdownInterval);
  
  const update = () => {
    const now = new Date();
    const diff = targetDate - now;
    const time = formatTimeRemaining(diff);

    updateCountdownDisplay(time);

    if (time.isStarting) {
      clearInterval(state.countdownInterval);
      setTimeout(() => fetchLiveData(), 1000);
    }
  };

  update();
  state.countdownInterval = setInterval(update, 1000);
};

const renderPreMatchState = () => {
  const nextMatch = getNextMatch();
  const container = document.getElementById("live-match-container");
  const timeline = document.getElementById("timeline-container");
  
  if (!container || !nextMatch) return;

  // Formatar data de exibição
  const matchDate = nextMatch.dateObj;
  const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  const formattedDate = matchDate.toLocaleDateString('pt-BR', dateOptions);
  const formattedTime = nextMatch.hora;

  container.innerHTML = `
    <div class="live-match-container">
      <div class="match-header">
        <div class="match-competition">
          <i class="fas fa-calendar-alt"></i> 
          <span>Próxima Partida</span>
        </div>
        <div class="match-status waiting">AGUARDANDO</div>
      </div>
      
      <div class="score-row">
        <div class="team">
          <img src="${nextMatch.escudo_mandante}" class="team-logo" alt="${nextMatch.mandante}" onerror="this.src='assets/logo.png'">
          <div class="team-name">${nextMatch.mandante}</div>
        </div>
        <div class="score-container">
          <div class="score">VS</div>
          <div class="match-time">
            <i class="fas fa-clock" style="margin-right: 6px;"></i>
            ${formattedTime}
          </div>
        </div>
        <div class="team">
          <img src="${nextMatch.escudo_visitante}" class="team-logo" alt="${nextMatch.visitante}" onerror="this.src='assets/logo.png'">
          <div class="team-name">${nextMatch.visitante}</div>
        </div>
      </div>

      <div id="countdown-wrapper" class="countdown-wrapper">
        <div class="countdown-label">
          <i class="fas fa-stopwatch" style="margin-right: 8px;"></i>
          Tempo para o início
        </div>
        <div class="countdown-grid">
          <div class="countdown-unit">
            <span id="countdown-days" class="countdown-value">00</span>
            <span class="countdown-text">Dias</span>
          </div>
          <span class="countdown-separator">:</span>
          <div class="countdown-unit">
            <span id="countdown-hours" class="countdown-value">00</span>
            <span class="countdown-text">Horas</span>
          </div>
          <span class="countdown-separator">:</span>
          <div class="countdown-unit">
            <span id="countdown-minutes" class="countdown-value">00</span>
            <span class="countdown-text">Min</span>
          </div>
          <span class="countdown-separator">:</span>
          <div class="countdown-unit">
            <span id="countdown-seconds" class="countdown-value">00</span>
            <span class="countdown-text">Seg</span>
          </div>
        </div>
      </div>
    </div>
  `;

  if (timeline) {
    timeline.innerHTML = `
      <div class="no-events-message">
        <div class="no-events-icon">
          <i class="fas fa-futbol"></i>
        </div>
        <p>O minuto a minuto começará assim que a bola rolar!</p>
        <span>${formattedDate} às ${formattedTime}</span>
      </div>
    `;
  }

  startCountdown(matchDate);
};

// ============================================
// PROCESSAMENTO DOS LANCES (GOL E LOGOS)
// ============================================
const isRealGoal = (lance) => {
  const desc = (lance.lance_descricao || "").toLowerCase();
  const tipo = (lance.lance_tipo || "").toLowerCase();
  
  if (tipo.includes("fim") || desc.includes("fim de jogo") || desc.includes("apita o juiz")) return false;
  
  const falsosPositivos = ["perdeu", "quase", "defesa", "trave", "fora", "bloqueado", "evita"];
  if (falsosPositivos.some(p => desc.includes(p))) return false;
  
  const padroesGolo = ["goool", "gol do", "gol de", "marca o"];
  return padroesGolo.some(p => desc.includes(p));
};

const processMatchData = (lances) => {
  const lancesOrdenados = lances;
  const statusEl = document.getElementById("match-status-indicator");
  
  // Atualiza Logos conforme o texto para evitar erro de troca de lado
  lancesOrdenados.forEach(l => {
    const d = l.lance_descricao.toLowerCase();
    if (d.includes("cruzeiro")) l.logo_final = state.teamsInfo.cruzeiro.logo;
    else if (d.includes("atletico") || d.includes("galo")) l.logo_final = "https://admin.cnnbrasil.com.br/wp-content/uploads/sites/12/atletico-mg.png";
    else l.logo_final = l.lance_logo_time;
  });

  updateTimeline(lancesOrdenados);
  if (statusEl) {
      const isFim = lancesOrdenados[0].lance_descricao.toLowerCase().includes("fim de jogo");
      statusEl.innerText = isFim ? "ENCERRADO" : "AO VIVO";
      statusEl.className = `match-status ${isFim ? 'finished' : 'live'}`;
  }
};

const updateTimeline = (lances) => {
  const container = document.getElementById("timeline-container");
  if (!container) return;

  container.innerHTML = lances.map(lance => {
    const ehGol = isRealGoal(lance);
    return `
      <div class="timeline-item ${ehGol ? 'goal-event' : ''}">
        <div class="timeline-time">${lance.lance_tipo}</div>
        <div class="timeline-content">
          <div class="timeline-header">
            <img src="${lance.logo_final || lance.lance_logo_time}" class="timeline-team-logo" alt="Time" onerror="this.src='assets/logo.png'">
            <span class="timeline-type">${ehGol ? '⚽ GOL!' : 'LANCE'}</span>
          </div>
          <div class="timeline-desc">${lance.lance_descricao}</div>
        </div>
      </div>
    `;
  }).join('');
};

const showEmptyState = () => {
  state.matchStarted = false;
  renderPreMatchState();
};

const initNavigation = () => {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("nav-menu");
  
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      nav.classList.toggle("active");
      const isExpanded = nav.classList.contains("active");
      toggle.setAttribute("aria-expanded", isExpanded);
    });
  }
};

const startLiveUpdates = () => {
  setInterval(fetchLiveData, CONFIG.updateInterval);
};

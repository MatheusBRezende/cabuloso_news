/**
 * Cabuloso News - Minuto a Minuto
 * Versão Final v5 - Correção JSON Array e Funções Auxiliares
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
    cruzeiro: { name: "Cruzeiro", logo: "" },
    adversario: { name: "Adversário", logo: "" },
  },
  placar: {
    cruzeiro: 0,
    adversario: 0,
  },
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
// CARREGAR AGENDA
// ============================================
const loadAgenda = async () => {
  try {
    const response = await fetch(CONFIG.agendaUrl);
    if (response.ok) {
      state.agendaData = await response.json();
      if (!state.matchStarted) renderPreMatchState();
    }
  } catch (error) {
    console.error("Erro ao carregar agenda:", error);
  }
};

// ============================================
// BUSCAR PROXIMO JOGO
// ============================================
const getNextMatch = () => {
  if (!state.agendaData || !Array.isArray(state.agendaData)) return null;
  const now = new Date();
  const currentYear = now.getFullYear();

  for (const match of state.agendaData) {
    const dateStr = match.data;
    const timeStr = match.hora;
    if (!dateStr || timeStr === "A definir") continue;

    const dateMatch = dateStr.match(/(\d+)\s+(\w+)/);
    if (!dateMatch) continue;

    const day = parseInt(dateMatch[1]);
    const monthStr = dateMatch[2].toLowerCase();
    const monthMap = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
    
    const month = monthMap[monthStr.substring(0, 3)];
    if (month === undefined) continue;

    const timeParts = timeStr.split(":");
    const matchDate = new Date(currentYear, month, day, parseInt(timeParts[0])||0, parseInt(timeParts[1])||0);

    if (matchDate < now) matchDate.setFullYear(currentYear + 1);
    if (matchDate > now) return { ...match, dateObj: matchDate };
  }
  return null;
};

// ============================================
// BUSCA DE DADOS (WEBHOOK) - CORRIGIDO
// ============================================
const fetchLiveData = async () => {
  try {
    const response = await fetch(`${CONFIG.webhookUrl}?t=${Date.now()}`);
    if (!response.ok) throw new Error("Erro na comunicação com n8n");
    
    const rawData = await response.json();
    
    // CORREÇÃO CRÍTICA: O n8n manda [ {resultados: ...} ]
    // Precisamos pegar o primeiro item se for um array
    const data = Array.isArray(rawData) ? rawData[0] : rawData;
    
    const lances = data.resultados || [];
    const placarServer = data.placar || { home: 0, away: 0 };

    if (lances.length > 0) {
      state.matchStarted = true;
      if (state.countdownInterval) clearInterval(state.countdownInterval);

      processMatchData(lances, placarServer);
      
      const loading = document.getElementById("loading-lances");
      if (loading) loading.classList.add("hidden");
    } else {
      // Se array vazio, chama a função que estava faltando
      showEmptyState();
    }
  } catch (error) {
    console.error("Erro no Webhook:", error);
    // showEmptyState(); // Opcional: mostrar vazio se der erro
  }
};

// ============================================
// PROCESSAMENTO
// ============================================
const processMatchData = (lances, placarServer) => {
  extractTeamsFromData(lances);
  
  const currentMatch = getNextMatch();
  // Lógica de teste Atlético x Cruzeiro (Atlético Mandante)
  let isCruzeiroMandante = currentMatch ? currentMatch.mandante.toLowerCase().includes("cruzeiro") : false;

  if (isCruzeiroMandante) {
      state.placar.cruzeiro = placarServer.home;
      state.placar.adversario = placarServer.away;
  } else {
      state.placar.cruzeiro = placarServer.away;
      state.placar.adversario = placarServer.home;
  }

  const lancesOrdenados = sortLances(lances);
  const ultimoLance = lancesOrdenados[0];
  
  let statusJogo = "AO VIVO";
  let tempoJogo = "Tempo Real";

  if (ultimoLance) {
    const tipo = (ultimoLance.lance_tipo || "").toLowerCase();
    const desc = (ultimoLance.lance_descricao || "").toLowerCase();
    tempoJogo = ultimoLance.lance_tipo;

    if (tipo.includes("fim") || desc.includes("fim de jogo") || placarServer.status === "Finalizado") {
      statusJogo = "ENCERRADO";
    } else if (tipo.includes("intervalo")) {
      statusJogo = "INTERVALO";
    }
  }

  renderLiveMatch(statusJogo, tempoJogo);
  updateStatusIndicator(statusJogo);
  updateTimeline(lancesOrdenados);

  // Animação Gol
  const totalGols = state.placar.cruzeiro + state.placar.adversario;
  if (totalGols > state.lastGoalCount && state.lastGoalCount !== 0) {
    playGoalAnimation();
  }
  state.lastGoalCount = totalGols;
};

// ============================================
// AUXILIARES (Extração e Ordenação)
// ============================================
const extractTeamsFromData = (lances) => {
  lances.forEach((lance) => {
    if (lance.lance_time && lance.lance_logo_time) {
      const nomeTime = lance.lance_time.trim();
      const isCruzeiro = nomeTime.toLowerCase().includes("cruzeiro");
      if (isCruzeiro) {
        state.teamsInfo.cruzeiro = { name: nomeTime, logo: lance.lance_logo_time };
      } else {
        state.teamsInfo.adversario = { name: nomeTime, logo: lance.lance_logo_time };
      }
    }
  });
};

const sortLances = (lances) => lances; // Já vem ordenado do n8n

// ============================================
// RENDERIZAÇÃO
// ============================================
const renderLiveMatch = (status, tempo) => {
  const container = document.getElementById("live-match-container");
  if (!container) return;

  const currentMatch = getNextMatch();
  // Fallback para teste sem agenda
  let mandante = currentMatch ? {name: currentMatch.mandante, logo: currentMatch.escudo_mandante} 
                              : (state.teamsInfo.adversario.name ? state.teamsInfo.adversario : {name: "Atlético-MG", logo: ""});
  let visitante = currentMatch ? {name: currentMatch.visitante, logo: currentMatch.escudo_visitante} 
                               : (state.teamsInfo.cruzeiro.name ? state.teamsInfo.cruzeiro : {name: "Cruzeiro", logo: ""});

  const placarTexto = `${state.placar.adversario} - ${state.placar.cruzeiro}`;

  container.innerHTML = `
        <div class="live-match-container">
            <div class="match-header">
                <div class="match-competition"><i class="fas fa-trophy"></i> ${currentMatch?.campeonato || "Ao Vivo"}</div>
                <div class="match-status ${status === "ENCERRADO" ? "finished" : "live"}">${status}</div>
            </div>
            <div class="score-row">
                <div class="team">
                    <img src="${mandante.logo}" class="team-logo" onerror="this.style.display='none'">
                    <div class="team-name">${mandante.name}</div>
                </div>
                <div class="score-container">
                    <div class="score">${placarTexto}</div>
                    <div class="match-time">${tempo}</div>
                </div>
                <div class="team">
                    <img src="${visitante.logo}" class="team-logo" onerror="this.style.display='none'">
                    <div class="team-name">${visitante.name}</div>
                </div>
            </div>
        </div>
    `;
};

const updateTimeline = (lances) => {
  const container = document.getElementById("timeline-container") || document.getElementById("lances-container");
  const noEventsMessage = document.getElementById("no-events-message");
  
  if (!container) return;

  if (lances.length === 0) {
      if (noEventsMessage) noEventsMessage.style.display = "block";
      return;
  }
  if (noEventsMessage) noEventsMessage.style.display = "none";

  container.innerHTML = lances.map((lance, index) => {
    const isGol = lance.is_gol === "GOOOLLLLL";
    const isCruzeiro = lance.lance_time && lance.lance_time.toLowerCase().includes("cruzeiro");
    let classeExtra = isGol ? "goal-event" : "";
    if (isCruzeiro) classeExtra += " timeline-cruzeiro";

    return `
        <div class="timeline-item ${classeExtra}" style="animation-delay: ${index * 50}ms">
            <div class="timeline-time">${lance.lance_tipo}</div>
            <div class="timeline-content">
                <div class="timeline-header">
                     ${lance.lance_logo_time ? `<img src="${lance.lance_logo_time}" class="timeline-team-logo">` : ''}
                    <span class="timeline-type">${isGol ? 'GOL!' : 'LANCE'}</span>
                </div>
                <div class="timeline-desc">${lance.lance_descricao}</div>
            </div>
        </div>
    `;
  }).join('');
};

// ============================================
// FUNÇÕES QUE FALTAVAM (CORREÇÃO DO ERRO)
// ============================================

// 1. A função que causava o erro ReferenceError
const showEmptyState = () => {
    const container = document.getElementById("timeline-container") || document.getElementById("lances-container");
    const noEventsMessage = document.getElementById("no-events-message");
    
    // Se ainda não começou o jogo e não tem dados
    if (container) container.innerHTML = "";
    if (noEventsMessage) {
        noEventsMessage.style.display = "block";
        noEventsMessage.innerHTML = "<p>Aguardando início da partida ou lances...</p>";
    } else if (container) {
        container.innerHTML = "<div style='text-align:center; padding:20px; color:#888;'>Aguardando lances...</div>";
    }
    
    if (!state.matchStarted) renderPreMatchState();
};

const renderPreMatchState = () => {
    const nextMatch = getNextMatch();
    const container = document.getElementById("live-match-container");
    if (!container) return;

    if (!nextMatch) {
        container.innerHTML = `<div class="live-match-container"><div class="match-status waiting">SEM JOGOS</div></div>`;
        return;
    }
    
    container.innerHTML = `
      <div class="live-match-container">
          <div class="match-header">
              <div class="match-competition">${nextMatch.campeonato}</div>
              <div class="match-status waiting">EM BREVE</div>
          </div>
          <div class="pre-match-content" style="text-align:center;">
              <h3 style="color:#fff; margin-bottom:10px;">${nextMatch.mandante} x ${nextMatch.visitante}</h3>
              <div id="countdown-timer" class="countdown-timer" style="font-size:1.5rem; font-weight:bold; color:#fbbf24;">Carregando...</div>
          </div>
      </div>`;
    startCountdown(nextMatch.dateObj);
};

const startCountdown = (targetDate) => {
    if (state.countdownInterval) clearInterval(state.countdownInterval);
    const update = () => {
        const diff = targetDate - new Date();
        const el = document.getElementById("countdown-timer");
        if (el) {
            if (diff <= 0) {
                el.innerText = "A bola vai rolar!";
                fetchLiveData(); 
            } else {
                const h = Math.floor(diff / 36e5);
                const m = Math.floor((diff % 36e5) / 6e4);
                el.innerText = `Faltam ${h}h ${m}m`;
            }
        }
    };
    state.countdownInterval = setInterval(update, 1000);
    update();
};

const updateStatusIndicator = (status) => {
    const el = document.getElementById("match-status-indicator");
    if (el) {
        el.innerText = status;
        el.className = `match-status ${status === "ENCERRADO" ? "finished" : "live"}`;
    }
};

const playGoalAnimation = () => {
    const el = document.getElementById("goal-animation");
    if(el) {
        el.classList.add("active");
        setTimeout(() => el.classList.remove("active"), 3000);
    }
};

const initNavigation = () => {
    const t = document.getElementById("menuToggle");
    const n = document.getElementById("nav-menu");
    if (t && n) t.addEventListener("click", () => n.classList.toggle("active"));
};

const startLiveUpdates = () => {
    if (state.liveUpdateInterval) clearInterval(state.liveUpdateInterval);
    state.liveUpdateInterval = setInterval(fetchLiveData, CONFIG.updateInterval);
};
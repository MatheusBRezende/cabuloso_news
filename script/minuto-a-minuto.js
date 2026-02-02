/**
 * Cabuloso News - Minuto a Minuto
 * Versão: 2.5 - Otimizado com Worker Unificada e Correção de Cache
 */

const CONFIG = {
  // Webhook para dados em tempo real (n8n)
  webhookUrl: "https://spikeofino-meu-n8n-cabuloso.hf.space/webhook/placar-ao-vivo",
  // Worker para dados da agenda/calendário
  apiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/",
  updateInterval: 10000,
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
  },
  logsEnabled: true,
  agendaLoaded: false,
  cachedData: {
    resultados: null,
    estatisticas: null,
    escalacao: null,
  },
};

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  loadAgenda();
  fetchLiveData();
  setInterval(fetchLiveData, CONFIG.updateInterval);
});

/**
 * Busca dados dinâmicos do jogo ao vivo
 */
const fetchLiveData = async () => {
  try {
    const response = await fetch(`${CONFIG.webhookUrl}?t=${Date.now()}`);
    let rawData = await response.json();

    // Se vier um array, validamos o primeiro item
    const data = Array.isArray(rawData) ? rawData[0] : rawData;

    // Se não houver jogo ativo no webhook
    if (!data || data.tem_jogo_ao_vivo === false) {
      if (!state.matchStarted) {
        renderPreMatchState();
      }
      return;
    }

    if (state.logsEnabled) console.log("📥 Dados ao vivo recebidos:", rawData);

    // Processamento do Payload do Webhook (Array de objetos)
    let placarData = null;
    let resultadosData = null;
    let estatisticasData = null;
    let escalacaoData = null;

    if (Array.isArray(rawData)) {
      rawData.forEach((item) => {
        if (item.resultados && item.placar) {
          placarData = item.placar;
          resultadosData = item.resultados;
          state.cachedData.resultados = resultadosData;
        }
        if (item.estatisticas) {
          estatisticasData = item.estatisticas;
          state.cachedData.estatisticas = estatisticasData;
        }
        if (item.partida || item.escalacao) {
          escalacaoData = item;
          state.cachedData.escalacao = escalacaoData;
        }
      });
    }

    if (!placarData || !resultadosData) return;

    // O jogo começou: limpa o cronómetro da agenda
    if (state.countdownInterval) {
      clearInterval(state.countdownInterval);
      state.countdownInterval = null;
    }

    state.matchStarted = true;

    // Atualiza o estado da partida
    state.match.home.name = placarData.home_name || "Mandante";
    state.match.home.logo = placarData.home_logo || "assets/logo.png";
    state.match.away.name = placarData.away_name || "Cruzeiro";
    state.match.away.logo = placarData.away_logo || "https://admin.cnnbrasil.com.br/wp-content/uploads/sites/12/cruzeiro.png";
    state.match.score.home = placarData.home ?? 0;
    state.match.score.away = placarData.away ?? 0;
    state.match.status = placarData.status || "AO VIVO";

    // Renderiza os componentes da UI
    renderLiveMatch(resultadosData);
    
    // Estatísticas
    if (estatisticasData || state.cachedData.estatisticas) {
      renderStats(estatisticasData || state.cachedData.estatisticas);
    }

    // Escalações
    if (escalacaoData || state.cachedData.escalacao) {
      updateLineups(escalacaoData || state.cachedData.escalacao);
    }

  } catch (error) {
    if (state.logsEnabled) console.error("Erro no LiveData:", error);
  }
};

/**
 * Renderiza o placar e lances
 */
const renderLiveMatch = (lances) => {
  const container = document.getElementById("live-match-container");
  const timeline = document.getElementById("timeline-container");
  if (!container) return;

  container.innerHTML = `
    <div class="live-match-container fade-in">
      <div class="match-header">
        <div class="match-competition"><i class="fas fa-trophy"></i> CRUZEIRO AO VIVO</div>
        <div class="match-status ${state.match.status.toLowerCase().includes("encerrado") ? "finished" : "live"}">
          ${state.match.status.toUpperCase() === "AO VIVO" ? '<span class="blink-dot"></span>' : ""} ${state.match.status}
        </div>
      </div>
      <div class="score-row">
        <div class="team">
          <img src="${state.match.home.logo}" class="team-logo" onerror="this.src='assets/logo.png'">
          <div class="team-name">${state.match.home.name}</div>
        </div>
        <div class="score-container">
          <div class="score">${state.match.score.home} <span>x</span> ${state.match.score.away}</div>
          <div class="match-time">Tempo Real</div>
        </div>
        <div class="team">
          <img src="${state.match.away.logo}" class="team-logo" onerror="this.src='assets/logo.png'">
          <div class="team-name">${state.match.away.name}</div>
        </div>
      </div>
    </div>`;

  if (timeline) {
    if (!lances || lances.length === 0) {
      timeline.innerHTML = `<p class="no-events">Aguardando lances...</p>`;
    } else {
      timeline.innerHTML = lances.map(lance => `
        <div class="timeline-item ${lance.is_gol ? "goal-event" : ""}">
          <div class="timeline-time">${lance.minuto || '---'}</div>
          <div class="timeline-content">
            <div class="timeline-desc">${lance.descricao}</div>
          </div>
        </div>`).join("");
    }
  }
};

/**
 * Atualiza Estatísticas
 */
const renderStats = (statsData) => {
  const homeList = document.getElementById("home-stats-list");
  const awayList = document.getElementById("away-stats-list");
  if (!homeList || !awayList) return;

  let statsArray = Array.isArray(statsData) ? statsData : (statsData.estatisticas || []);
  
  let homeHTML = "";
  let awayHTML = "";

  statsArray.forEach(stat => {
    const label = stat.metrica || stat.item || "";
    homeHTML += `<div class="stat-row"><span class="stat-value">${stat.mandante || stat.home || 0}</span><span class="stat-label">${label}</span></div>`;
    awayHTML += `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-value">${stat.visitante || stat.away || 0}</span></div>`;
  });

  homeList.innerHTML = homeHTML;
  awayList.innerHTML = awayHTML;
};

/**
 * Atualiza Escalações e Árbitro
 */
const updateLineups = (data) => {
  const payload = Array.isArray(data) ? data[0] : data;
  const partida = payload.partida;
  if (!partida) return;

  const homeContent = document.getElementById("home-lineup-content");
  const awayContent = document.getElementById("away-lineup-content");
  const refCard = document.getElementById("match-referee-info");

  const fmtList = (players) => (players || []).map(p => `
    <div class="player-item-min">
      <span class="player-number">${p.numero_posicao.split(' ')[0]}</span>
      <span class="player-name">${p.nome}</span>
    </div>`).join("");

  if (homeContent) {
    homeContent.innerHTML = `<h4>Titulares</h4>${fmtList(partida.mandante.titulares)}<h4>Técnico: ${partida.mandante.tecnico}</h4>`;
  }
  if (awayContent) {
    awayContent.innerHTML = `<h4>Titulares</h4>${fmtList(partida.visitante.titulares)}<h4>Técnico: ${partida.visitante.tecnico}</h4>`;
  }
  if (refCard && payload.arbitragem) {
    refCard.innerHTML = `<div class="ref-box"><i class="fas fa-gavel"></i> ${payload.arbitragem.nome} (${payload.arbitragem.funcao})</div>`;
  }
};

/**
 * Lógica de Agenda e Cronómetro
 */
const loadAgenda = async () => {
  try {
    const response = await fetch(`${CONFIG.apiUrl}?v=${Date.now()}`);
    if (response.ok) {
      const data = await response.json();
      // Ajuste para o formato da sua Worker unificada
      state.agendaData = data.agenda || (Array.isArray(data) ? data : []);
      state.agendaLoaded = true;
      if (!state.matchStarted) renderPreMatchState();
    }
  } catch (e) {
    console.error("Erro ao carregar agenda:", e);
  }
};

const renderPreMatchState = () => {
  const next = getNextMatchFromAgenda();
  const container = document.getElementById("live-match-container");
  if (!container || !next) return;

  container.innerHTML = `
    <div class="live-match-container waiting-mode">
      <div class="match-header"><div class="match-competition">PRÓXIMO JOGO</div></div>
      <div class="score-row">
        <div class="team"><img src="${next.escudo_mandante}" class="team-logo"><div>${next.mandante}</div></div>
        <div id="countdown-wrapper" class="countdown-wrapper">
          <div class="countdown-label">A BOLA ROLA EM</div>
          <div class="time-display">--:--:--</div>
        </div>
        <div class="team"><img src="${next.escudo_visitante}" class="team-logo"><div>${next.visitante}</div></div>
      </div>
    </div>`;
  
  startCountdown(next.dateObj);
};

const startCountdown = (targetDate) => {
  if (state.countdownInterval) clearInterval(state.countdownInterval);
  
  const update = () => {
    const diff = targetDate - new Date();
    const wrapper = document.getElementById("countdown-wrapper");
    if (!wrapper || diff <= 0) {
      clearInterval(state.countdownInterval);
      if (diff <= 0) fetchLiveData();
      return;
    }

    const h = Math.floor((diff / 3600000));
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    
    wrapper.querySelector(".time-display").innerText = 
      `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  state.countdownInterval = setInterval(update, 1000);
  update();
};

const getNextMatchFromAgenda = () => {
  if (!state.agendaData) return null;
  const now = new Date();
  const meses = { jan:0, fev:1, mar:2, abr:3, mai:4, jun:5, jul:6, ago:7, set:8, out:9, nov:10, dez:11 };

  return state.agendaData.map(m => {
    try {
      const parts = m.data.trim().split(" ");
      const day = parseInt(parts[1]);
      const month = meses[parts[2].replace(/[.,]/g, "").toLowerCase()];
      const [hh, mm] = m.hora.split(":").map(Number);
      let d = new Date();
      d.setMonth(month, day); d.setHours(hh, mm, 0, 0);
      if (d < now) d.setFullYear(d.getFullYear() + 1);
      return { ...m, dateObj: d };
    } catch(e) { return null; }
  }).filter(m => m && m.dateObj > now).sort((a,b) => a.dateObj - b.dateObj)[0];
};

const initNavigation = () => {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("nav-menu");
  if (toggle && nav) toggle.addEventListener("click", () => nav.classList.toggle("active"));
};
/**
 * Cabuloso News - Minuto a Minuto
 * Versão: 3.0 - Contador de Tempo Melhorado
 */

const CONFIG = {
  webhookUrl: "https://spikeofino-meu-n8n-cabuloso.hf.space/webhook/placar-ao-vivo",
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

    const hasLiveGameFlag = rawData.tem_jogo_ao_vivo !== undefined;
    
    if ((hasLiveGameFlag && rawData.tem_jogo_ao_vivo === false) || 
        (!rawData.narracao && !rawData.placar)) {
      if (!state.matchStarted) {
        renderPreMatchState();
      }
      return;
    }

    if (state.logsEnabled) console.log("🔥 Dados ao vivo recebidos:", rawData);

    let placarData = rawData.placar || null;
    let resultadosData = rawData.narracao || null;
    let estatisticasData = rawData.estatisticas || null;
    let escalacaoData = rawData.escalacao || null;
    let arbitragemData = rawData.arbitragem || null;

    if (resultadosData) {
      state.cachedData.resultados = resultadosData;
    }
    if (estatisticasData) {
      state.cachedData.estatisticas = estatisticasData;
    }
    if (escalacaoData) {
      state.cachedData.escalacao = {
        partida: {
          mandante: escalacaoData.home || escalacaoData.mandante,
          visitante: escalacaoData.away || escalacaoData.visitante
        },
        arbitragem: arbitragemData ? { nome: arbitragemData, funcao: "Árbitro Principal" } : null
      };
    }

    if (!placarData || !resultadosData) return;

    if (state.countdownInterval) {
      clearInterval(state.countdownInterval);
      state.countdownInterval = null;
    }

    state.matchStarted = true;

    state.match.home.name = placarData.home_name || placarData.mandante || "Mandante";
    state.match.home.logo = placarData.home_logo || "assets/logo.png";
    state.match.away.name = placarData.away_name || placarData.visitante || "Cruzeiro";
    state.match.away.logo = placarData.away_logo || "https://admin.cnnbrasil.com.br/wp-content/uploads/sites/12/cruzeiro.png";
    state.match.score.home = placarData.home ?? 0;
    state.match.score.away = placarData.away ?? 0;
    state.match.status = placarData.status || "AO VIVO";

    renderLiveMatch(resultadosData);
    
    if (estatisticasData || state.cachedData.estatisticas) {
      renderStats(estatisticasData || state.cachedData.estatisticas);
    }

    if (escalacaoData || state.cachedData.escalacao) {
      updateLineups(state.cachedData.escalacao);
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

  const statsArray = [
    { metrica: "Posse de Bola", mandante: statsData.posse_home || "0%", visitante: statsData.posse_away || "0%" },
    { metrica: "Escanteios", mandante: statsData.escanteios_home || "0", visitante: statsData.escanteios_away || "0" },
    { metrica: "Finalizações", mandante: statsData.finalizacoes_home || "0", visitante: statsData.finalizacoes_away || "0" },
    { metrica: "Faltas", mandante: statsData.faltas_home || "0", visitante: statsData.faltas_away || "0" }
  ];
  
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
  if (!data || !data.partida) return;

  const homeContent = document.getElementById("home-lineup-content");
  const awayContent = document.getElementById("away-lineup-content");
  const refCard = document.getElementById("match-referee-info");

  const fmtList = (players) => {
    if (!players || !Array.isArray(players)) return "<div>Não disponível</div>";
    
    return players.map(p => {
      const parts = p.toString().split(' - ');
      const number = parts[0] || '';
      const name = parts[1] || p;
      
      return `
        <div class="player-item-min">
          <span class="player-number">${number}</span>
          <span class="player-name">${name}</span>
        </div>`;
    }).join("");
  };

  if (homeContent && data.partida.mandante) {
    homeContent.innerHTML = `
      <h4>Titulares</h4>
      ${fmtList(data.partida.mandante.titulares)}
      <h4>Técnico: ${data.partida.mandante.tecnico || "Não informado"}</h4>`;
  }
  
  if (awayContent && data.partida.visitante) {
    awayContent.innerHTML = `
      <h4>Titulares</h4>
      ${fmtList(data.partida.visitante.titulares)}
      <h4>Técnico: ${data.partida.visitante.tecnico || "Não informado"}</h4>`;
  }
  
  if (refCard && data.arbitragem) {
    refCard.innerHTML = `<div class="ref-box"><i class="fas fa-gavel"></i> ${data.arbitragem.nome} (${data.arbitragem.funcao})</div>`;
  }
};

/**
 * Lógica de Agenda e Cronômetro MELHORADO
 */
const loadAgenda = async () => {
  try {
    const response = await fetch(`${CONFIG.apiUrl}?v=${Date.now()}`);
    if (response.ok) {
      const data = await response.json();
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

  // Formata a data do jogo
  const matchDate = formatMatchDate(next.dateObj);
  
  container.innerHTML = `
    <div class="live-match-container waiting-mode">
      <div class="match-header">
        <div class="match-competition">
          <i class="fas fa-calendar-alt"></i> PRÓXIMO JOGO
        </div>
        <div class="match-date">${matchDate}</div>
      </div>
      <div class="score-row">
        <div class="team">
          <img src="${next.escudo_mandante}" class="team-logo" onerror="this.src='assets/logo.png'">
          <div class="team-name">${next.mandante}</div>
        </div>
        <div id="countdown-wrapper" class="countdown-wrapper-enhanced">
          <div class="countdown-label">
            <i class="fas fa-clock"></i>
            A BOLA ROLA EM
          </div>
          <div class="countdown-grid" id="countdown-grid">
            <div class="countdown-block">
              <div class="countdown-number" id="days">--</div>
              <div class="countdown-unit">DIAS</div>
            </div>
            <div class="countdown-separator">:</div>
            <div class="countdown-block">
              <div class="countdown-number" id="hours">--</div>
              <div class="countdown-unit">HORAS</div>
            </div>
            <div class="countdown-separator">:</div>
            <div class="countdown-block">
              <div class="countdown-number" id="minutes">--</div>
              <div class="countdown-unit">MIN</div>
            </div>
            <div class="countdown-separator">:</div>
            <div class="countdown-block">
              <div class="countdown-number" id="seconds">--</div>
              <div class="countdown-unit">SEG</div>
            </div>
          </div>
          <div class="match-info">
            <div class="match-info-item">
              <i class="fas fa-trophy"></i>
              <span>${next.campeonato}</span>
            </div>
            <div class="match-info-item">
              <i class="fas fa-map-marker-alt"></i>
              <span>${next.estadio}</span>
            </div>
            <div class="match-info-item">
              <i class="fas fa-clock"></i>
              <span>${next.hora}</span>
            </div>
          </div>
        </div>
        <div class="team">
          <img src="${next.escudo_visitante}" class="team-logo" onerror="this.src='assets/logo.png'">
          <div class="team-name">${next.visitante}</div>
        </div>
      </div>
    </div>`;
  
  startCountdown(next.dateObj);
};

const startCountdown = (targetDate) => {
  if (state.countdownInterval) clearInterval(state.countdownInterval);
  
  const update = () => {
    const now = new Date();
    const diff = targetDate - now;
    
    if (diff <= 0) {
      clearInterval(state.countdownInterval);
      fetchLiveData();
      return;
    }

    // Calcula dias, horas, minutos e segundos
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    // Atualiza os elementos
    const daysEl = document.getElementById("days");
    const hoursEl = document.getElementById("hours");
    const minutesEl = document.getElementById("minutes");
    const secondsEl = document.getElementById("seconds");
    
    if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
    
    // Adiciona animação de pulso nos segundos
    if (secondsEl) {
      secondsEl.style.animation = 'none';
      setTimeout(() => {
        secondsEl.style.animation = 'pulse 1s ease-in-out';
      }, 10);
    }
  };

  state.countdownInterval = setInterval(update, 1000);
  update();
};

const formatMatchDate = (date) => {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  
  return `${dayName}, ${day} ${month}`;
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
      d.setMonth(month, day); 
      d.setHours(hh, mm, 0, 0);
      if (d < now) d.setFullYear(d.getFullYear() + 1);
      return { ...m, dateObj: d };
    } catch(e) { 
      return null; 
    }
  }).filter(m => m && m.dateObj > now).sort((a,b) => a.dateObj - b.dateObj)[0];
};

const initNavigation = () => {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("nav-menu");
  if (toggle && nav) toggle.addEventListener("click", () => nav.classList.toggle("active"));
};
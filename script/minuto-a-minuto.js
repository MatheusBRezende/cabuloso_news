/**
 * Cabuloso News - Minuto a Minuto
 * Versão: 2.5 - Otimizado com Worker Unificada e Correção de Cache
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
    const data = await response.json();

    if (state.logsEnabled) console.log("📥 Dados recebidos:", data);

    // SE O N8N RETORNAR QUE NÃO HÁ JOGO (success: false)
    if (!data.success) {
      if (state.logsEnabled) console.log("ℹ️ Sem jogo ao vivo. Verificando próxima partida...");
      state.matchStarted = false;
      renderProximaPartida(); // CHAMA O CONTADOR
      return;
    }

    // Se houver dados, atualiza o estado e a tela
    state.matchStarted = true;
    state.match.home.name = data.placar.home_name;
    state.match.away.name = data.placar.away_name;
    state.match.score.home = data.placar.home;
    state.match.score.away = data.placar.away;
    state.match.status = data.placar.status;

    updateHeader();

    // Cache para as abas
    state.cachedData.resultados = data.narracao;
    state.cachedData.estatisticas = data.estatisticas;
    state.cachedData.escalacao = data.escalacao;

    // Renderiza a aba ativa
    const activeTab = document.querySelector(".tab-btn.active").dataset.tab;
    if (activeTab === "lances") renderLances(data.narracao);
    if (activeTab === "estatisticas") renderEstatisticas(data.estatisticas);
    if (activeTab === "escalacao") renderEscalacao(data.escalacao);

  } catch (error) {
    console.error("❌ Erro ao buscar dados:", error);
    // Se der erro de conexão (n8n offline), também tenta mostrar a próxima partida
    renderProximaPartida();
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

  // Crie um array de estatísticas manualmente baseado no formato atual
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

  // Função auxiliar para formatar jogadores
  const fmtList = (players) => {
    if (!players || !Array.isArray(players)) return "<div>Não disponível</div>";
    
    return players.map(p => {
      // Extrai número e nome (assumindo formato "1 - Jori")
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
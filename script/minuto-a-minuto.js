/**
 * Cabuloso News - Minuto a Minuto
 * Versão: 3.0 - Sistema de Contador para Próxima Partida
 */

const CONFIG = {
  webhookUrl:
    "https://spikeofino-meu-n8n-cabuloso.hf.space/webhook/placar-ao-vivo",
  apiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/",
  updateInterval: 10000,
};

const state = {
  matchStarted: false,
  agendaData: null,
  countdownInterval: null,
  match: {
    home: { name: "Cruzeiro", logo: "./assets/logo.png" },
    away: { name: "Adversário", logo: "" },
    score: { home: 0, away: 0 },
    status: "AGUARDANDO",
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

    if (!response.ok) throw new Error("Erro na rede");

    const text = await response.text();

    // Se a resposta vier vazia
    if (!text || text.trim() === "") {
      if (state.logsEnabled) console.log("ℹ️ Resposta vazia do servidor.");
      showNextMatchCountdown();
      return;
    }

    const data = JSON.parse(text);

    // Se não há jogo ativo
    if (!data.success) {
      if (state.logsEnabled) console.log("📅 Não há jogo em andamento.");
      showNextMatchCountdown();
      return;
    }

    // --- SE CHEGOU AQUI, TEM JOGO ATIVO ---
    state.matchStarted = true;
    state.match.home.name = data.placar.home_name;
    state.match.away.name = data.placar.away_name;
    state.match.score.home = data.placar.home;
    state.match.score.away = data.placar.away;
    state.match.status = data.placar.status;

    updateLiveMatch();
    updateHeader();

    state.cachedData.resultados = data.narracao;
    state.cachedData.estatisticas = data.estatisticas;
    state.cachedData.escalacao = data.escalacao;

    renderLances(data.narracao);
    renderStats(data.estatisticas);
    renderLineup(data.escalacao);
    
  } catch (error) {
    if (state.logsEnabled) console.error("❌ Erro ao buscar dados:", error);
    showNextMatchCountdown();
  }
};

/**
 * Mostra o contador para próxima partida
 */
const showNextMatchCountdown = () => {
  if (state.logsEnabled) console.log("⏳ Mostrando contador para próxima partida...");

  state.matchStarted = false;

  // Remove qualquer mensagem anterior de "sem jogo"
  const existingAlert = document.querySelector('.no-game-alert');
  if (existingAlert) existingAlert.remove();

  // Mostra o container principal
  const mainContainer = document.querySelector(".main-content");
  if (mainContainer) mainContainer.classList.remove("hidden");

  // Atualiza o título do hero
  const heroTitle = document.querySelector(".title-main");
  const heroSubtitle = document.querySelector(".title-sub");
  if (heroTitle) heroTitle.textContent = "Próxima Partida";
  if (heroSubtitle) heroSubtitle.textContent = "Contagem regressiva para o próximo jogo do Cruzeiro";

  // Atualiza o badge do hero
  const heroBadge = document.querySelector(".hero-badge");
  if (heroBadge) {
    heroBadge.innerHTML = `
      <span class="badge-pulse" style="background: var(--primary)"></span>
      <i class="far fa-calendar-alt" aria-hidden="true"></i>
      <span>Próximo Jogo</span>
    `;
  }

  // Renderiza o contador no container do placar
  const liveMatchContainer = document.getElementById("live-match-container");
  
  // Primeiro, carrega a agenda se necessário
  if (!state.agendaLoaded) {
    loadAgenda(() => {
      renderNextMatchCountdown(liveMatchContainer);
    });
  } else {
    renderNextMatchCountdown(liveMatchContainer);
  }

  // Esconde elementos que só fazem sentido durante o jogo
  const timelineHeader = document.querySelector(".timeline-header h2");
  if (timelineHeader) {
    timelineHeader.innerHTML = '<i class="fas fa-history"></i> ÚLTIMOS JOGOS';
  }

  // Mostra mensagem na timeline
  const timeline = document.getElementById("timeline-container");
  if (timeline) {
    timeline.innerHTML = `
      <div class="no-events-message">
        <div class="no-events-icon">
          <i class="far fa-clock"></i>
        </div>
        <p>Nenhum jogo em andamento no momento.</p>
        <span>Aguarde o início da próxima partida.</span>
      </div>
    `;
  }

  // Esconde estatísticas e escalações
  const statsColumns = document.querySelectorAll('.stats-column');
  statsColumns.forEach(col => col.classList.add('hidden'));
  
  const lineupSection = document.querySelector('.lineup-section');
  if (lineupSection) lineupSection.classList.add('hidden');
};

/**
 * Renderiza o contador da próxima partida
 */
const renderNextMatchCountdown = (container) => {
  const nextMatch = getNextMatchFromAgenda();
  
  if (!nextMatch) {
    container.innerHTML = `
      <div class="match-card">
        <div class="match-info">
          <div class="match-championship">CAMPEONATO BRASILEIRO SÉRIE A</div>
          <div class="match-date">
            <i class="far fa-calendar"></i>
            <span>Próximo jogo a ser definido</span>
          </div>
        </div>
        <div class="score-row">
          <div class="team">
            <img src="./assets/logo.png" class="team-logo" alt="Cruzeiro">
            <div class="team-name">Cruzeiro</div>
          </div>
          <div class="countdown-wrapper">
            <div class="countdown-label">PRÓXIMO JOGO</div>
            <div class="countdown-grid">
              <div class="countdown-unit">
                <div class="countdown-value">--</div>
                <div class="countdown-text">DIAS</div>
              </div>
              <div class="countdown-unit">
                <div class="countdown-value">--</div>
                <div class="countdown-text">HORAS</div>
              </div>
              <div class="countdown-unit">
                <div class="countdown-value">--</div>
                <div class="countdown-text">MIN</div>
              </div>
              <div class="countdown-unit">
                <div class="countdown-value">--</div>
                <div class="countdown-text">SEG</div>
              </div>
            </div>
            <div class="match-status-badge" style="background: var(--gray-600)">
              <i class="far fa-clock"></i>
              <span>AGENDADO</span>
            </div>
          </div>
          <div class="team">
            <div class="team-logo-placeholder">
              <i class="fas fa-question"></i>
            </div>
            <div class="team-name">A DEFINIR</div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Formata a data
  const matchDate = nextMatch.dateObj;
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const formattedDate = matchDate.toLocaleDateString('pt-BR', options);
  const formattedTime = matchDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  container.innerHTML = `
    <div class="match-card">
      <div class="match-info">
        <div class="match-championship">${nextMatch.campeonato || 'CAMPEONATO BRASILEIRO SÉRIE A'}</div>
        <div class="match-date">
          <i class="far fa-calendar"></i>
          <span>${formattedDate} • ${formattedTime}</span>
        </div>
      </div>
      <div class="score-row">
        <div class="team">
          <img src="${nextMatch.escudo_mandante || './assets/logo.png'}" class="team-logo" alt="${nextMatch.mandante}" onerror="this.src='./assets/logo.png'">
          <div class="team-name">${nextMatch.mandante}</div>
        </div>
        <div class="countdown-wrapper">
          <div class="countdown-label">A BOLA ROLA EM</div>
          <div class="countdown-grid" id="countdown-grid">
            <div class="countdown-unit">
              <div class="countdown-value" id="countdown-days">00</div>
              <div class="countdown-text">DIAS</div>
            </div>
            <div class="countdown-unit">
              <div class="countdown-value" id="countdown-hours">00</div>
              <div class="countdown-text">HORAS</div>
            </div>
            <div class="countdown-unit">
              <div class="countdown-value" id="countdown-minutes">00</div>
              <div class="countdown-text">MIN</div>
            </div>
            <div class="countdown-unit">
              <div class="countdown-value" id="countdown-seconds">00</div>
              <div class="countdown-text">SEG</div>
            </div>
          </div>
          <div class="match-status-badge" style="background: var(--primary)">
            <span class="status-pulse"></span>
            <span>PRÓXIMA PARTIDA</span>
          </div>
        </div>
        <div class="team">
          <img src="${nextMatch.escudo_visitante || ''}" class="team-logo" alt="${nextMatch.visitante}" onerror="this.src='./assets/logo.png'">
          <div class="team-name">${nextMatch.visitante}</div>
        </div>
      </div>
    </div>
  `;

  // Inicia o contador
  startNextMatchCountdown(matchDate);
};

/**
 * Inicia o contador regressivo
 */
const startNextMatchCountdown = (targetDate) => {
  // Limpa intervalo anterior
  if (state.countdownInterval) {
    clearInterval(state.countdownInterval);
  }

  const updateCountdown = () => {
    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) {
      // Tempo esgotado, atualiza para mostrar o jogo
      clearInterval(state.countdownInterval);
      fetchLiveData(); // Verifica se o jogo já começou
      return;
    }

    // Calcula dias, horas, minutos, segundos
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // Atualiza os elementos
    const daysEl = document.getElementById('countdown-days');
    const hoursEl = document.getElementById('countdown-hours');
    const minutesEl = document.getElementById('countdown-minutes');
    const secondsEl = document.getElementById('countdown-seconds');

    if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
  };

  // Atualiza imediatamente e a cada segundo
  updateCountdown();
  state.countdownInterval = setInterval(updateCountdown, 1000);
};

/**
 * Atualiza o placar ao vivo
 */
const updateLiveMatch = () => {
  const container = document.getElementById("live-match-container");
  if (!container) return;

  const statusClass = state.match.status.includes("AO VIVO") ? "live" : 
                     state.match.status.includes("INTERVALO") ? "half-time" : 
                     state.match.status.includes("ENCERRADO") ? "finished" : "scheduled";

  container.innerHTML = `
    <div class="match-card">
      <div class="match-info">
        <div class="match-championship">CAMPEONATO BRASILEIRO SÉRIE A</div>
        <div class="match-date">
          <i class="far fa-calendar"></i>
          <span>${new Date().toLocaleDateString('pt-BR')} • Tempo Real</span>
        </div>
      </div>
      <div class="score-row">
        <div class="team">
          <img src="${state.match.home.logo}" class="team-logo" alt="${state.match.home.name}" onerror="this.src='./assets/logo.png'">
          <div class="team-name">${state.match.home.name}</div>
        </div>
        <div class="score-display">
          <div class="score">${state.match.score.home}</div>
          <div class="score-separator">:</div>
          <div class="score">${state.match.score.away}</div>
        </div>
        <div class="team">
          <img src="${state.match.away.logo}" class="team-logo" alt="${state.match.away.name}" onerror="this.src='./assets/logo.png'">
          <div class="team-name">${state.match.away.name}</div>
        </div>
      </div>
      <div class="match-status-badge ${statusClass}">
        <span class="status-pulse"></span>
        <span>${state.match.status}</span>
      </div>
    </div>
  `;
};

/**
 * Renderiza os lances na timeline
 */
const renderLances = (lances) => {
  const timeline = document.getElementById("timeline-container");
  if (!timeline) return;

  // Mostra estatísticas e escalações
  const statsColumns = document.querySelectorAll('.stats-column');
  statsColumns.forEach(col => col.classList.remove('hidden'));
  
  const lineupSection = document.querySelector('.lineup-section');
  if (lineupSection) lineupSection.classList.remove('hidden');

  // Atualiza o status no header
  const statusIndicator = document.getElementById("match-status-indicator");
  if (statusIndicator) {
    statusIndicator.textContent = state.match.status;
    statusIndicator.style.background = state.match.status.includes("AO VIVO") ? "var(--live-red)" :
                                      state.match.status.includes("INTERVALO") ? "var(--half-time)" :
                                      state.match.status.includes("ENCERRADO") ? "var(--finished)" : "var(--primary)";
  }

  if (!lances || lances.length === 0) {
    timeline.innerHTML = `
      <div class="no-events-message">
        <div class="no-events-icon">
          <i class="fas fa-futbol"></i>
        </div>
        <p>Nenhum lance registrado ainda.</p>
        <span>Aguardando o início do jogo.</span>
      </div>
    `;
    return;
  }

  timeline.innerHTML = lances
    .slice() // Cria uma cópia para não alterar o array original
    .reverse() // Mostra os mais recentes primeiro
    .map(lance => {
      const isCruzeiro = lance.time === "Cruzeiro" || lance.time?.includes("Cruzeiro");
      const isGoal = lance.is_gol || lance.descricao?.toLowerCase().includes("gol");
      
      return `
        <div class="timeline-item ${isCruzeiro ? '' : 'timeline-adversario'} ${isGoal ? 'goal-event' : ''}">
          <div class="timeline-time">${lance.minuto || '--'}'</div>
          <div class="timeline-content">
            <div class="timeline-desc">${lance.descricao || lance.evento || 'Lance'}</div>
            <div class="timeline-team">
              <i class="fas fa-user"></i>
              ${lance.jogador || lance.time || 'Jogador'}
            </div>
          </div>
        </div>
      `;
    })
    .join('');
};

/**
 * Atualiza estatísticas
 */
const renderStats = (statsData) => {
  const homeList = document.getElementById("home-stats-list");
  const awayList = document.getElementById("away-stats-list");
  const homeHeader = document.getElementById("stats-home-header");
  const awayHeader = document.getElementById("stats-away-header");

  if (!statsData) {
    if (homeList) homeList.innerHTML = '<div class="loading-stats">Aguardando estatísticas...</div>';
    if (awayList) awayList.innerHTML = '<div class="loading-stats">Aguardando estatísticas...</div>';
    return;
  }

  // Atualiza headers com nomes dos times
  if (homeHeader) homeHeader.innerHTML = `<i class="fas fa-chart-bar"></i> <span>${state.match.home.name.toUpperCase()}</span>`;
  if (awayHeader) awayHeader.innerHTML = `<span>${state.match.away.name.toUpperCase()}</span> <i class="fas fa-chart-pie"></i>`;

  // Estatísticas padrão
  const stats = [
    { label: "POSSE DE BOLA", home: statsData.posse_home || "0%", away: statsData.posse_away || "0%" },
    { label: "FINALIZAÇÕES", home: statsData.finalizacoes_home || "0", away: statsData.finalizacoes_away || "0" },
    { label: "FINALIZAÇÕES NO GOL", home: statsData.finalizacoes_gol_home || "0", away: statsData.finalizacoes_gol_away || "0" },
    { label: "ESCANTEIOS", home: statsData.escanteios_home || "0", away: statsData.escanteios_away || "0" },
    { label: "FALTAS", home: statsData.faltas_home || "0", away: statsData.faltas_away || "0" },
    { label: "IMPEÇÕES", home: statsData.impedimentos_home || "0", away: statsData.impedimentos_away || "0" },
  ];

  if (homeList) {
    homeList.innerHTML = stats.map(stat => `
      <div class="stat-row">
        <span class="stat-value">${stat.home}</span>
        <span class="stat-label">${stat.label}</span>
        <div class="stat-bar">
          <div class="stat-fill" style="width: ${parseInt(stat.home) || 0}%"></div>
        </div>
      </div>
    `).join('');
  }

  if (awayList) {
    awayList.innerHTML = stats.map(stat => `
      <div class="stat-row">
        <span class="stat-label">${stat.label}</span>
        <span class="stat-value">${stat.away}</span>
        <div class="stat-bar">
          <div class="stat-fill" style="width: ${parseInt(stat.away) || 0}%"></div>
        </div>
      </div>
    `).join('');
  }
};

/**
 * Renderiza escalações
 */
const renderLineup = (lineupData) => {
  const homeContent = document.getElementById("home-lineup-content");
  const awayContent = document.getElementById("away-lineup-content");
  const refCard = document.getElementById("match-referee-info");
  const homeHeader = document.getElementById("home-team-name-lineup");
  const awayHeader = document.getElementById("away-team-name-lineup");

  if (homeHeader) homeHeader.textContent = `${state.match.home.name}`;
  if (awayHeader) awayHeader.textContent = `${state.match.away.name}`;

  if (!lineupData) {
    if (homeContent) homeContent.innerHTML = '<div class="loading-stats">Aguardando escalações...</div>';
    if (awayContent) awayContent.innerHTML = '<div class="loading-stats">Aguardando escalações...</div>';
    if (refCard) refCard.innerHTML = '<div class="loading-stats">Árbitro não definido</div>';
    return;
  }

  // Renderiza escalação do mandante
  if (homeContent && lineupData.mandante) {
    const players = lineupData.mandante.titulares || [];
    homeContent.innerHTML = players.map(player => {
      const parts = player.split(' - ');
      const number = parts[0] || '';
      const name = parts.slice(1).join(' - ') || player;
      return `
        <div class="player-item-min">
          <span class="player-number">${number}</span>
          <div class="player-info-text">
            <span class="player-name">${name}</span>
            <span class="player-pos">Jogador</span>
          </div>
        </div>
      `;
    }).join('') + `<div style="margin-top: var(--space-4); padding-top: var(--space-2); border-top: 1px solid var(--gray-200);">
      <div style="font-size: 0.8rem; color: var(--gray-600);"><strong>Técnico:</strong> ${lineupData.mandante.tecnico || 'Não informado'}</div>
    </div>`;
  }

  // Renderiza escalação do visitante
  if (awayContent && lineupData.visitante) {
    const players = lineupData.visitante.titulares || [];
    awayContent.innerHTML = players.map(player => {
      const parts = player.split(' - ');
      const number = parts[0] || '';
      const name = parts.slice(1).join(' - ') || player;
      return `
        <div class="player-item-min">
          <span class="player-number">${number}</span>
          <div class="player-info-text">
            <span class="player-name">${name}</span>
            <span class="player-pos">Jogador</span>
          </div>
        </div>
      `;
    }).join('') + `<div style="margin-top: var(--space-4); padding-top: var(--space-2); border-top: 1px solid var(--gray-200);">
      <div style="font-size: 0.8rem; color: var(--gray-600);"><strong>Técnico:</strong> ${lineupData.visitante.tecnico || 'Não informado'}</div>
    </div>`;
  }

  // Renderiza árbitro
  if (refCard && lineupData.arbitragem) {
    refCard.innerHTML = `
      <div style="text-align: center;">
        <i class="fas fa-whistle" style="font-size: 2rem; color: var(--primary); margin-bottom: var(--space-3);"></i>
        <div style="font-weight: 700; font-size: 1.1rem;">${lineupData.arbitragem.nome || 'Árbitro'}</div>
        <div style="font-size: 0.85rem; color: var(--gray-600); margin-top: var(--space-1);">${lineupData.arbitragem.funcao || 'Árbitro Principal'}</div>
      </div>
    `;
  }
};

/**
 * Atualiza o header
 */
const updateHeader = () => {
  // Atualiza o badge do hero
  const heroBadge = document.querySelector(".hero-badge");
  if (heroBadge) {
    const pulseColor = state.match.status.includes("AO VIVO") ? "var(--live-red)" : 
                      state.match.status.includes("INTERVALO") ? "var(--half-time)" : 
                      state.match.status.includes("ENCERRADO") ? "var(--finished)" : "var(--primary)";
    
    heroBadge.innerHTML = `
      <span class="badge-pulse" style="background: ${pulseColor}"></span>
      <i class="fas fa-play-circle" aria-hidden="true"></i>
      <span>${state.match.status}</span>
    `;
  }

  // Atualiza o título
  const heroTitle = document.querySelector(".title-main");
  const heroSubtitle = document.querySelector(".title-sub");
  
  if (heroTitle) heroTitle.textContent = "Minuto a Minuto";
  if (heroSubtitle) heroSubtitle.textContent = `Acompanhe ${state.match.home.name} vs ${state.match.away.name} em tempo real`;
};

/**
 * Lógica de Agenda e Cronómetro
 */
const loadAgenda = (callback = null) => {
  fetch(`${CONFIG.apiUrl}?v=${Date.now()}`)
    .then(response => response.json())
    .then(data => {
      // Ajuste para o formato da sua Worker unificada
      state.agendaData = data.agenda || (Array.isArray(data) ? data : []);
      state.agendaLoaded = true;
      if (callback) callback();
    })
    .catch(e => {
      console.error("Erro ao carregar agenda:", e);
      if (callback) callback();
    });
};

/**
 * Obtém a próxima partida da agenda
 */
const getNextMatchFromAgenda = () => {
  if (!state.agendaData || !Array.isArray(state.agendaData) || state.agendaData.length === 0) {
    return null;
  }

  const meses = {
    jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
    jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11
  };

  const now = new Date();
  
  // Filtra e converte datas
  const matchesWithDates = state.agendaData
    .filter(match => match && match.data && match.hora)
    .map(match => {
      try {
        // Formato esperado: "16 fev" ou "16 fev."
        const dateStr = match.data.trim().replace(/\./g, '');
        const [dayStr, monthStr] = dateStr.split(' ');
        const day = parseInt(dayStr);
        const month = meses[monthStr.toLowerCase()];
        
        if (isNaN(day) || month === undefined) return null;

        const [hours, minutes] = match.hora.split(':').map(Number);
        
        const matchDate = new Date();
        matchDate.setMonth(month, day);
        matchDate.setHours(hours, minutes || 0, 0, 0);
        
        // Se a data já passou este ano, considera para o próximo ano
        if (matchDate < now) {
          matchDate.setFullYear(matchDate.getFullYear() + 1);
        }
        
        return {
          ...match,
          dateObj: matchDate
        };
      } catch (e) {
        console.error('Erro ao processar data do jogo:', match, e);
        return null;
      }
    })
    .filter(match => match !== null && match.dateObj > now)
    .sort((a, b) => a.dateObj - b.dateObj);

  return matchesWithDates[0] || null;
};

/**
 * Inicializa navegação mobile
 */
const initNavigation = () => {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("navMenu");
  
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      nav.classList.toggle("active");
      toggle.classList.toggle("active");
    });
  }

  // Fecha menu ao clicar em um link
  const navLinks = document.querySelectorAll(".nav-link");
  navLinks.forEach(link => {
    link.addEventListener("click", () => {
      nav.classList.remove("active");
      toggle.classList.remove("active");
    });
  });
};

// Inicializa mostrando o contador
setTimeout(() => {
  if (!state.matchStarted) {
    showNextMatchCountdown();
  }
}, 100);
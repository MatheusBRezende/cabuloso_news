/**
 * Cabuloso News - Minuto a Minuto OTIMIZADO V12.0
 * ✨ NOVIDADES:
 * - Lances mais recentes aparecem PRIMEIRO
 * - Detecção aprimorada de eventos (gols, cartões, substituições, pênaltis)
 * - Melhor categorização e apresentação visual
 * - Ícones e badges melhorados para cada tipo de evento
 */

let ultimoLanceId = null;
let lastValidStats = null;
let animationLock = false;

const CONFIG = {
  webhookUrl: "https://cabuloso-api.cabulosonews92.workers.dev/?type=ao-vivo",
  apiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/?type=jogos",
  
  // ⚡ MODOS DE ATUALIZAÇÃO
  updateIntervalLive: 5000,      // 5s durante jogo AO VIVO (RÁPIDO!)
  updateIntervalIdle: 60000,     // 60s quando não há jogo (ECONOMIZA)
  updateIntervalPreMatch: 15000, // 15s 30min antes do jogo
};

const golControl = {
  lastScore: { home: 0, away: 0 },
  lastTrigger: 0,
  cooldown: 8000,
  matchId: null,
  
  loadSavedScore() {
    try {
      const saved = localStorage.getItem('cabuloso_last_score');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.matchId === this.matchId && data.timestamp > Date.now() - 3600000) {
          this.lastScore = data.score;
          console.log('📥 Placar restaurado:', this.lastScore);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar placar:', e);
    }
  },
  
  saveScore(score) {
    try {
      localStorage.setItem('cabuloso_last_score', JSON.stringify({
        matchId: this.matchId,
        score: score,
        timestamp: Date.now()
      }));
    } catch (e) {}
  }
};

const state = {
  matchStarted: false,
  agendaData: null,
  countdownInterval: null,
  currentUpdateInterval: CONFIG.updateIntervalLive,
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
  lastEvents: new Map(),
  MAX_EVENT_AGE: 30 * 60 * 1000,
  
  loadShownEvents() {
    try {
      const saved = localStorage.getItem('cabuloso_shown_events');
      if (saved) {
        const data = JSON.parse(saved);
        const cutoff = Date.now() - 2 * 60 * 60 * 1000;
        for (const [hash, time] of Object.entries(data)) {
          if (time > cutoff) {
            this.lastEvents.set(hash, time);
          }
        }
        console.log(`📥 ${this.lastEvents.size} eventos anteriores carregados`);
      }
    } catch (e) {
      console.warn('Erro ao carregar eventos:', e);
    }
  },
  
  saveShownEvents() {
    try {
      const data = {};
      for (const [hash, time] of this.lastEvents.entries()) {
        data[hash] = time;
      }
      localStorage.setItem('cabuloso_shown_events', JSON.stringify(data));
    } catch (e) {}
  },
  
  add(event) {
    const now = Date.now();
  
    for (const [hash, time] of this.lastEvents.entries()) {
      if (now - time > this.MAX_EVENT_AGE) {
        this.lastEvents.delete(hash);
      }
    }
  
    if (this.lastEvents.has(event.hash)) {
      console.log('🔄 Evento ignorado (já mostrado):', event.type);
      return;
    }
  
    this.lastEvents.set(event.hash, now);
    this.saveShownEvents();
  
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
    await this.playNext();
  },

  playAnimation(type) {
    return new Promise((resolve) => {
      dispararAnimacaoFullScreen(type);
      setTimeout(resolve, 100);
    });
  },
};

function gerarHashLance(minuto, descricao, tipo = '') {
  const minutoNormalizado = String(minuto).replace(/\D/g, "");
  const descNormalizada = descricao
    .toLowerCase()
    .replace(/[^\w\sáàâãéèêíïóôõöúçñ]/g, "")
    .trim()
    .substring(0, 100);
  
  const hashString = `${minutoNormalizado}|${tipo}|${descNormalizada}`;
  
  return btoa(unescape(encodeURIComponent(hashString)));
}

let liveInterval = null;

function startLivePolling(intervalMs = CONFIG.updateIntervalLive) {
  stopLivePolling();
  
  state.currentUpdateInterval = intervalMs;
  console.log(`🔄 Iniciando polling: ${intervalMs}ms (${intervalMs === CONFIG.updateIntervalLive ? 'RÁPIDO - AO VIVO' : intervalMs === CONFIG.updateIntervalPreMatch ? 'MODERADO - PRÉ-JOGO' : 'LENTO - AGUARDANDO'})`);
  
  liveInterval = setInterval(fetchLiveData, intervalMs);
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
  
  preloadAnimations();
  animationQueue.loadShownEvents();
  
  await fetchLiveData();
  startLivePolling(state.currentUpdateInterval);
  
  loadAgenda();
  setInterval(loadAgenda, 60000);
  
  console.log("✅ Sistema iniciado com polling adaptativo");
});

/**
 * ⭐ DETECÇÃO APRIMORADA DE EVENTOS
 * Identifica com mais precisão gols, cartões, substituições e pênaltis
 */
function detectarTipoEvento(lance) {
  const descricao = lance.descricao?.toLowerCase() || '';
  const tipo = lance.tipo?.toLowerCase() || '';
  const icone = lance.icone || '';
  
  // Detecção de GOL (prioridade máxima)
  if (
    lance.is_gol === true ||
    tipo === 'gol' ||
    icone === '⚽' ||
    descricao.includes('gol do') ||
    descricao.includes('golaço') ||
    descricao.includes('fez 1 a') ||
    descricao.includes('fez 2 a') ||
    descricao.includes('fez 3 a') ||
    descricao.includes('amplia') ||
    descricao.includes('abre o placar') ||
    descricao.includes('empata')
  ) {
    return {
      categoria: 'gol',
      prioridade: 1,
      animacao: true,
      badge: 'GOL',
      badgeClass: 'badge-gol',
      iconeCustom: '⚽'
    };
  }
  
  // Detecção de PÊNALTI
  if (
    tipo === 'penalti' ||
    tipo === 'pênalti' ||
    descricao.includes('pênalti') ||
    descricao.includes('penalti') ||
    descricao.includes('é pênalti') ||
    descricao.includes('marca na hora a penalidade')
  ) {
    return {
      categoria: 'penalti',
      prioridade: 2,
      animacao: true,
      badge: 'PÊNALTI',
      badgeClass: 'badge-penalti',
      iconeCustom: '🎯'
    };
  }
  
  // Detecção de CARTÃO VERMELHO
  if (
    tipo === 'cartão vermelho' ||
    tipo === 'cartao vermelho' ||
    icone === '🟥' ||
    descricao.includes('cartão vermelho') ||
    descricao.includes('expulso')
  ) {
    return {
      categoria: 'vermelho',
      prioridade: 3,
      animacao: true,
      badge: 'VERMELHO',
      badgeClass: 'badge-vermelho',
      iconeCustom: '🟥'
    };
  }
  
  // Detecção de CARTÃO AMARELO
  if (
    tipo === 'cartão amarelo' ||
    tipo === 'cartao amarelo' ||
    icone === '🟨' ||
    descricao.includes('cartão amarelo')
  ) {
    return {
      categoria: 'amarelo',
      prioridade: 4,
      animacao: true,
      badge: 'AMARELO',
      badgeClass: 'badge-amarelo',
      iconeCustom: '🟨'
    };
  }
  
  // Detecção de SUBSTITUIÇÃO
  if (
    tipo === 'substituição' ||
    tipo === 'substituicao' ||
    descricao.includes('sai:') ||
    descricao.includes('entra:') ||
    (descricao.includes('sai') && descricao.includes('entra'))
  ) {
    return {
      categoria: 'substituicao',
      prioridade: 5,
      animacao: false,
      badge: 'SUBSTITUIÇÃO',
      badgeClass: 'badge-substituicao',
      iconeCustom: '🔄'
    };
  }
  
  // Detecção de LANCE IMPORTANTE
  if (
    tipo === 'lance importante' ||
    descricao.includes('incrível') ||
    descricao.includes('defendeu') ||
    descricao.includes('tirou a tempo') ||
    descricao.includes('que chance') ||
    descricao.includes('perto')
  ) {
    return {
      categoria: 'importante',
      prioridade: 6,
      animacao: false,
      badge: 'IMPORTANTE',
      badgeClass: 'badge-importante',
      iconeCustom: '⚠️'
    };
  }
  
  // Detecção de RESUMO AUTOMÁTICO
  if (tipo === 'resumo automático' || tipo === 'resumo automatico') {
    return {
      categoria: 'resumo',
      prioridade: 7,
      animacao: false,
      badge: 'RESUMO',
      badgeClass: 'badge-resumo',
      iconeCustom: '📊'
    };
  }
  
  // Lance comum
  return {
    categoria: 'normal',
    prioridade: 10,
    animacao: false,
    badge: null,
    badgeClass: '',
    iconeCustom: '📝'
  };
}

/**
 * ⭐ FETCH OTIMIZADO
 */
const fetchLiveData = async () => {
  try {
    const response = await fetch(CONFIG.webhookUrl, {
      cache: 'no-cache'
    });
    
    let data = await response.json();

    const cacheStatus = response.headers.get('X-Cache');
    if (cacheStatus) {
      console.log(`📦 Cache status: ${cacheStatus}`);
    }

    // Tratamento do envelope
    if (data && data.dados_prontos) {
      data = data.dados_prontos;
    } else if (Array.isArray(data)) {
      data = data[0];
    }

    if (data && data[""] !== undefined) {
      data = data[""];
    }

    // Lógica de adaptação de velocidade
    const isLiveMatch = data && data.success === true && (data.placar || data.narracao);
    const isAgenda = data && (data.status === "agenda" || data.modo_agenda === true);
    const hasError = data && data.error;

    if (isLiveMatch) {
      if (state.currentUpdateInterval !== CONFIG.updateIntervalLive) {
        console.log('🔥 JOGO AO VIVO DETECTADO - Acelerando polling!');
        startLivePolling(CONFIG.updateIntervalLive);
      }
    } else if (isAgenda) {
      const gameTime = data.informacoes?.horario;
      if (gameTime) {
        const now = new Date();
        const [hours, minutes] = gameTime.split(':');
        const gameDate = new Date();
        gameDate.setHours(parseInt(hours), parseInt(minutes), 0);
        const diff = gameDate - now;
        
        if (diff > 0 && diff < 30 * 60 * 1000) {
          if (state.currentUpdateInterval !== CONFIG.updateIntervalPreMatch) {
            console.log('⏰ 30min antes do jogo - Acelerando polling');
            startLivePolling(CONFIG.updateIntervalPreMatch);
          }
        } else if (state.currentUpdateInterval !== CONFIG.updateIntervalIdle) {
          console.log('💤 Nenhum jogo próximo - Polling lento');
          startLivePolling(CONFIG.updateIntervalIdle);
        }
      }
    } else if (hasError) {
      if (state.currentUpdateInterval !== CONFIG.updateIntervalIdle) {
        console.log('❌ Erro detectado - Polling lento');
        startLivePolling(CONFIG.updateIntervalIdle);
      }
    }

    if (!data || data.error) {
      showCountdown();
      return;
    }

    if (data.modo_agenda === true || data.status === "agenda") {
      renderAgenda(data);
      return;
    }

    hideCountdown();
    renderLiveMatch(data);
  } catch (err) {
    console.error("Erro ao buscar dados:", err);
    showCountdown();
  }
};

/**
 * ⭐ RENDERIZAÇÃO DO JOGO AO VIVO COM MELHORIAS
 */
function renderLiveMatch(data) {
  const container = document.getElementById("live-match-container");
  if (!container) return;

  updateMatchState(data);

  container.innerHTML = `
    <div class="scoreboard-card">
      <div class="scoreboard-header">
        <span class="match-status ${getStatusClass(data.placar?.status)}">${data.placar?.status || "AO VIVO"}</span>
        <span class="match-minute">${extractMinute(data.placar?.status)}</span>
      </div>

      <div class="scoreboard-teams">
        <div class="team team-home">
          <div class="team-logo-wrapper">
            ${
              data.placar?.home_logo
                ? `<img src="${data.placar.home_logo}" alt="${data.placar.home_name}" class="team-logo" />`
                : `<div class="team-logo-placeholder"><i class="fas fa-shield-alt"></i></div>`
            }
          </div>
          <div class="team-name">${data.placar?.home_name || "Mandante"}</div>
          <div class="team-score">${data.placar?.home ?? 0}</div>
        </div>

        <div class="score-separator">
          <div class="score-vs">VS</div>
        </div>

        <div class="team team-away">
          <div class="team-score">${data.placar?.away ?? 0}</div>
          <div class="team-name">${data.placar?.away_name || "Visitante"}</div>
          <div class="team-logo-wrapper">
            ${
              data.placar?.away_logo
                ? `<img src="${data.placar.away_logo}" alt="${data.placar.away_name}" class="team-logo" />`
                : `<div class="team-logo-placeholder"><i class="fas fa-shield-alt"></i></div>`
            }
          </div>
        </div>
      </div>

      <div class="scoreboard-info">
        <div class="info-item">
          <i class="fas fa-trophy"></i>
          <span>${data.informacoes?.campeonato || "Campeonato"}</span>
        </div>
        <div class="info-item">
          <i class="fas fa-calendar"></i>
          <span>${formatDate(data.informacoes?.data)}</span>
        </div>
        <div class="info-item">
          <i class="fas fa-map-marker-alt"></i>
          <span>${data.informacoes?.estadio || data.informacoes?.local || "Estádio"}</span>
        </div>
      </div>
    </div>
  `;

  renderArbitro(data.arbitragem);
  renderPanelStats(data.estatisticas);
  renderPanelLineups(data.escalacao);
  
  // 🔥 RENDERIZAÇÃO DOS LANCES COM ORDEM INVERTIDA
  renderTimeline(data.narracao);
  
  detectAndTriggerEvents(data);
}

/**
 * ⭐ RENDERIZAÇÃO DA TIMELINE COM LANCES MAIS RECENTES PRIMEIRO
 */
function renderTimeline(narracao) {
  const timelineFull = document.getElementById("timeline-container-full");
  const noEventsMsg = document.getElementById("no-events-message-full");

  if (!timelineFull) return;

  if (!narracao || narracao.length === 0) {
    timelineFull.innerHTML = "";
    if (noEventsMsg) noEventsMsg.style.display = "flex";
    return;
  }

  if (noEventsMsg) noEventsMsg.style.display = "none";

  // 🔥 INVERTE A ORDEM: Lances mais recentes primeiro!
  const lancesOrdenados = [...narracao].reverse();

  const html = lancesOrdenados
    .map((lance) => {
      const evento = detectarTipoEvento(lance);
      const minutoDisplay = lance.minuto || "Pré-jogo";
      const periodo = lance.periodo || "";
      
      // Remove tags HTML da descrição para exibição limpa
      const descricaoLimpa = lance.descricao
        ? lance.descricao.replace(/<[^>]*>/g, '')
        : 'Lance do jogo';

      return `
        <div class="timeline-item-full ${evento.categoria}" data-categoria="${evento.categoria}">
          <div class="timeline-marker-full">
            <span class="timeline-icon-full">${evento.iconeCustom}</span>
          </div>
          <div class="timeline-content-full">
            <div class="timeline-header-full">
              <span class="timeline-minute-full">${minutoDisplay}</span>
              ${evento.badge ? `<span class="timeline-badge ${evento.badgeClass}">${evento.badge}</span>` : ''}
              ${periodo ? `<span class="timeline-periodo">${periodo}</span>` : ''}
            </div>
            <div class="timeline-text-full">${descricaoLimpa}</div>
            ${lance.timestamp ? `<div class="timeline-timestamp">${formatTimestamp(lance.timestamp)}</div>` : ''}
          </div>
        </div>
      `;
    })
    .join("");

  timelineFull.innerHTML = html;
}

/**
 * FUNÇÃO AUXILIAR: Formatar timestamp
 */
function formatTimestamp(timestamp) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return '';
  }
}

/**
 * DETECÇÃO E DISPARO DE EVENTOS (Gols, Cartões, etc.)
 */
function detectAndTriggerEvents(data) {
  if (!data.narracao || data.narracao.length === 0) return;

  const placar = data.placar || {};
  const currentScore = {
    home: placar.home ?? 0,
    away: placar.away ?? 0,
  };

  const matchId = `${placar.home_name}-${placar.away_name}-${data.informacoes?.data}`;
  
  if (golControl.matchId !== matchId) {
    golControl.matchId = matchId;
    golControl.loadSavedScore();
  }

  const scoreChanged =
    currentScore.home !== golControl.lastScore.home ||
    currentScore.away !== golControl.lastScore.away;

  if (scoreChanged) {
    const now = Date.now();
    if (now - golControl.lastTrigger > golControl.cooldown) {
      console.log("⚽ GOL DETECTADO! Placar mudou:", golControl.lastScore, "→", currentScore);

      const hash = gerarHashLance("GOL", `${currentScore.home}-${currentScore.away}`, "gol");
      animationQueue.add({ type: "gol", hash });

      golControl.lastScore = { ...currentScore };
      golControl.lastTrigger = now;
      golControl.saveScore(currentScore);
    }
  }

  // Processa últimos 5 lances para detectar eventos
  const ultimosLances = data.narracao.slice(0, 5);
  
  ultimosLances.forEach((lance) => {
    const evento = detectarTipoEvento(lance);
    
    if (evento.animacao) {
      const hash = gerarHashLance(lance.minuto, lance.descricao, evento.categoria);
      
      if (!animationQueue.lastEvents.has(hash)) {
        console.log(`🎬 Evento ${evento.categoria.toUpperCase()} detectado:`, lance.descricao);
        animationQueue.add({ 
          type: evento.categoria, 
          hash 
        });
      }
    }
  });
}

function extractMinute(status) {
  if (!status) return "";
  const match = status.match(/\d+/);
  return match ? `${match[0]}'` : "";
}

function getStatusClass(status) {
  if (!status) return "";
  const s = status.toLowerCase();
  if (s.includes("encerrado") || s.includes("fim")) return "status-finished";
  if (s.includes("intervalo")) return "status-halftime";
  return "status-live";
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function updateMatchState(data) {
  if (data.placar) {
    state.match.home.name = data.placar.home_name || "Mandante";
    state.match.home.logo = data.placar.home_logo || "";
    state.match.away.name = data.placar.away_name || "Visitante";
    state.match.away.logo = data.placar.away_logo || "";
    state.match.score.home = data.placar.home ?? 0;
    state.match.score.away = data.placar.away ?? 0;
    state.match.status = data.placar.status || "AO VIVO";
  }
}

function hideCountdown() {
  const wrapper = document.getElementById("countdown-wrapper");
  const sections = document.getElementById("live-match-sections");
  if (wrapper) wrapper.style.display = "none";
  if (sections) sections.style.display = "block";
  state.matchStarted = true;
}

function showCountdown() {
  const wrapper = document.getElementById("countdown-wrapper");
  const sections = document.getElementById("live-match-sections");
  if (wrapper) wrapper.style.display = "block";
  if (sections) sections.style.display = "none";
  state.matchStarted = false;
}

function renderAgenda(data) {
  showCountdown();
  const container = document.getElementById("live-match-container");
  if (!container) return;

  container.innerHTML = `
    <div class="scoreboard-card agenda-card">
      <div class="agenda-badge">
        <i class="fas fa-calendar-check"></i>
        <span>PRÓXIMO JOGO</span>
      </div>

      <div class="scoreboard-teams">
        <div class="team team-home">
          <div class="team-logo-wrapper">
            ${
              data.placar?.home_logo
                ? `<img src="${data.placar.home_logo}" alt="${data.placar.home_name}" class="team-logo" />`
                : `<div class="team-logo-placeholder"><i class="fas fa-shield-alt"></i></div>`
            }
          </div>
          <div class="team-name">${data.placar?.home_name || "A definir"}</div>
        </div>

        <div class="score-separator">
          <div class="score-vs">VS</div>
        </div>

        <div class="team team-away">
          <div class="team-name">${data.placar?.away_name || "A definir"}</div>
          <div class="team-logo-wrapper">
            ${
              data.placar?.away_logo
                ? `<img src="${data.placar.away_logo}" alt="${data.placar.away_name}" class="team-logo" />`
                : `<div class="team-logo-placeholder"><i class="fas fa-shield-alt"></i></div>`
            }
          </div>
        </div>
      </div>

      <div class="scoreboard-info">
        <div class="info-item">
          <i class="fas fa-trophy"></i>
          <span>${data.informacoes?.campeonato || "Campeonato"}</span>
        </div>
        <div class="info-item">
          <i class="fas fa-clock"></i>
          <span>${data.informacoes?.horario || "Horário"}</span>
        </div>
        <div class="info-item">
          <i class="fas fa-calendar"></i>
          <span>${formatDate(data.informacoes?.data)}</span>
        </div>
        <div class="info-item">
          <i class="fas fa-map-marker-alt"></i>
          <span>${data.informacoes?.estadio || data.informacoes?.local || "Estádio"}</span>
        </div>
      </div>
    </div>
  `;

  startCountdown(data.informacoes?.data, data.informacoes?.horario);
}

function startCountdown(dateStr, timeStr) {
  if (!dateStr || !timeStr) return;

  if (state.countdownInterval) {
    clearInterval(state.countdownInterval);
  }

  try {
    const [year, month, day] = dateStr.split("-");
    const [hours, minutes] = timeStr.split(":");
    const targetDate = new Date(year, month - 1, day, hours, minutes);

    const timerEl = document.getElementById("timer-text");
    if (!timerEl) return;

    state.countdownInterval = setInterval(() => {
      const now = new Date();
      const diff = targetDate - now;

      if (diff <= 0) {
        clearInterval(state.countdownInterval);
        timerEl.textContent = "INICIANDO...";
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      timerEl.textContent = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }, 1000);
  } catch (e) {
    console.warn("Erro no countdown:", e);
  }
}

async function loadAgenda() {
  try {
    const res = await fetch(CONFIG.apiUrl);
    let data = await res.json();

    if (data && data.dados_prontos) {
      data = data.dados_prontos;
    } else if (Array.isArray(data)) {
      data = data[0];
    }

    if (data && data[""] !== undefined) {
      data = data[""];
    }

    state.agendaData = data;
  } catch (err) {
    console.warn("Erro ao carregar agenda:", err);
  }
}

/**
 * INICIALIZAÇÃO DOS BOTÕES FLUTUANTES
 */
function initTopFloatingButtons() {
  const overlay = document.getElementById("floating-overlay");
  const statsPanel = document.getElementById("stats-panel");
  const lineupPanel = document.getElementById("lineup-panel");

  const topStatsBtn = document.getElementById("top-stats-btn");
  const topLineupBtn = document.getElementById("top-lineup-btn");
  const mobileStatsBtn = document.getElementById("mobile-stats-btn");
  const mobileLineupBtn = document.getElementById("mobile-lineup-btn");

  function openPanel(panel) {
    closeAllPanels();
    overlay.classList.add("active");
    panel.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeAllPanels() {
    overlay.classList.remove("active");
    if (statsPanel) statsPanel.classList.remove("active");
    if (lineupPanel) lineupPanel.classList.remove("active");
    document.body.style.overflow = "";
  }

  if (topStatsBtn) {
    topStatsBtn.addEventListener("click", () => openPanel(statsPanel));
  }

  if (topLineupBtn) {
    topLineupBtn.addEventListener("click", () => openPanel(lineupPanel));
  }

  if (mobileStatsBtn) {
    mobileStatsBtn.addEventListener("click", () => openPanel(statsPanel));
  }

  if (mobileLineupBtn) {
    mobileLineupBtn.addEventListener("click", () => openPanel(lineupPanel));
  }

  if (overlay) {
    overlay.addEventListener("click", closeAllPanels);
  }

  const closeBtns = document.querySelectorAll(".panel-close-btn");
  closeBtns.forEach((btn) => {
    btn.addEventListener("click", closeAllPanels);
  });
}

function renderArbitro(arbitragem) {
  const arbitroWidget = document.getElementById("top-arbitro-info");
  if (!arbitroWidget) return;

  const arbitroNome = arbitroWidget.querySelector(".top-arbitro-nome");
  if (!arbitroNome) return;

  if (arbitragem && typeof arbitragem === "string") {
    const match = arbitragem.match(/Árbitro:\s*(.+?)(?:\s*\(|$)/i);
    if (match && match[1]) {
      arbitroNome.textContent = match[1].trim();
    } else {
      arbitroNome.textContent = arbitragem;
    }
  } else {
    arbitroNome.textContent = "Não informado";
  }
}

/**
 * RENDERIZAR ESTATÍSTICAS NO PAINEL FLUTUANTE
 */
function renderPanelStats(stats) {
  if (!stats) {
    lastValidStats = null;
    return;
  }

  lastValidStats = stats;

  const homeStatsList = document.getElementById("panel-home-stats");
  const awayStatsList = document.getElementById("panel-away-stats");

  if (!homeStatsList || !awayStatsList) return;

  const homeTeamHeader = document.getElementById("panel-home-team");
  const awayTeamHeader = document.getElementById("panel-away-team");

  if (homeTeamHeader && state.match.home.name) {
    homeTeamHeader.querySelector("span").textContent =
      state.match.home.name.toUpperCase();
  }

  if (awayTeamHeader && state.match.away.name) {
    awayTeamHeader.querySelector("span").textContent =
      state.match.away.name.toUpperCase();
  }

  // Estatísticas do time da casa
  if (homeStatsList) {
    const homeItems = [
      {
        label: "Posse de bola",
        value: stats.posse_home || "0%",
      },
      { label: "Chutes", value: stats.chutes_home || 0 },
      { label: "Chutes no gol", value: stats.chutes_gol_home || 0 },
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

  // Estatísticas do time visitante
  if (awayStatsList) {
    const awayItems = [
      {
        label: "Posse de bola",
        value: stats.posse_away || "0%",
      },
      { label: "Chutes", value: stats.chutes_away || 0 },
      { label: "Chutes no gol", value: stats.chutes_gol_away || 0 },
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
          stats.vermelhos_away?.total !== undefined
            ? stats.vermelhos_away.total
            : stats.vermelhos_away || 0,
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

  const createPlayerItem = (jogador, tipo) => {
    const item = document.createElement("div");
    item.className = `panel-player-item ${tipo === "titular" ? "titular" : "reserva"}`;

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

    let iconHtml = "";
    if (fotoUrl) {
      iconHtml = `<div class="panel-player-photo" style="background-image: url('${fotoUrl}');"></div>`;
    } else {
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

    const titulares = escalacao.home.titulares || [];
    titulares.forEach((jogador) => {
      homeLineupList.appendChild(createPlayerItem(jogador, "titular"));
    });

    const reservas = escalacao.home.reservas || [];
    reservas.forEach((jogador) => {
      homeLineupList.appendChild(createPlayerItem(jogador, "reserva"));
    });

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

    const titulares = escalacao.away.titulares || [];
    titulares.forEach((jogador) => {
      awayLineupList.appendChild(createPlayerItem(jogador, "titular"));
    });

    const reservas = escalacao.away.reservas || [];
    reservas.forEach((jogador) => {
      awayLineupList.appendChild(createPlayerItem(jogador, "reserva"));
    });

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
  
      anim.destroy();
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

window.addEventListener('beforeunload', () => {
  golControl.saveScore(golControl.lastScore);
  animationQueue.saveShownEvents();
});
/**
 * Cabuloso News - Minuto a Minuto OTIMIZADO
 * Versão: 12.0 - LANCES RECENTES PRIMEIRO
 * - Mantém 5s de atualização durante jogos ao vivo
 * - Exibe lances mais recentes no topo
 * - Fade out automático de lances antigos (mais de 10 lances)
 * - Animações suaves de entrada e saída
 */

let ultimoLanceId = null;
let lastValidStats = null;
let animationLock = false;
let lancesExibidos = new Set(); // Controla quais lances já foram exibidos
const MAX_LANCES_VISIVEIS = 15; // Quantidade máxima de lances visíveis

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

/**
 * POLLING INTELIGENTE - Adapta velocidade baseado no estado do jogo
 */
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

    if (data && data.dados_prontos) {
      data = data.dados_prontos;
    } else if (Array.isArray(data)) {
      data = data[0];
    }

    if (data && data[""] !== undefined) {
      data = data[""];
    }

    const isLiveMatch = data && data.success === true && (data.placar || data.narracao);
    const isAgenda = data && (data.status === "agenda" || data.modo_agenda === true);
    const hasError = data && data.error;

    if (hasError) {
      console.log("⚠️ API retornou erro - Modo ocioso");
      if (state.currentUpdateInterval !== CONFIG.updateIntervalIdle) {
        startLivePolling(CONFIG.updateIntervalIdle);
      }
      return;
    }

    if (isLiveMatch) {
      console.log("⚽ JOGO AO VIVO DETECTADO");
      
      if (!state.matchStarted) {
        state.matchStarted = true;
        document.body.classList.add("live-match");
        hideCountdown();
      }

      if (state.currentUpdateInterval !== CONFIG.updateIntervalLive) {
        console.log("🚀 Acelerando polling para 5s (AO VIVO)");
        startLivePolling(CONFIG.updateIntervalLive);
      }

      updateMatchState(data);
      renderAllComponents(data);
      detectarEventosImportantes(data);

    } else if (isAgenda) {
      console.log("📅 Modo Agenda");
      
      if (state.currentUpdateInterval !== CONFIG.updateIntervalIdle) {
        startLivePolling(CONFIG.updateIntervalIdle);
      }

      state.agendaData = data;
      
      if (data.proximo_jogo) {
        const dataProxJogo = parseBrazilianDate(
          data.proximo_jogo.data,
          data.proximo_jogo.horario
        );

        if (dataProxJogo) {
          const agora = new Date();
          const diffMs = dataProxJogo - agora;
          const diffMin = Math.floor(diffMs / 60000);

          if (diffMin <= 30 && diffMin > 0) {
            console.log(`⏰ Faltam ${diffMin}min - Acelerando para 15s`);
            if (state.currentUpdateInterval !== CONFIG.updateIntervalPreMatch) {
              startLivePolling(CONFIG.updateIntervalPreMatch);
            }
          }

          showCountdown(dataProxJogo, data.proximo_jogo);
        }
      }
    }

    if (data.estatisticas && Object.keys(data.estatisticas).length > 0) {
      lastValidStats = data.estatisticas;
    }

  } catch (error) {
    console.error("❌ Erro ao buscar dados:", error);
    if (state.currentUpdateInterval !== CONFIG.updateIntervalIdle) {
      startLivePolling(CONFIG.updateIntervalIdle);
    }
  }
};

function detectarEventosImportantes(data) {
  if (!data || !data.narracao) return;
  
  const primeirosLances = data.narracao.slice(0, 5);
  
  primeirosLances.forEach((lance) => {
    if (!lance.descricao) return;
    
    const desc = lance.descricao.toLowerCase();
    const hash = gerarHashLance(lance.minuto, lance.descricao, lance.tipo);
    
    let tipoEvento = null;
    
    if (lance.is_gol || desc.includes("gol")) {
      tipoEvento = "gol";
    } else if (desc.includes("pênalti") || desc.includes("penalidade")) {
      tipoEvento = "penalti";
    } else if (desc.includes("vermelho")) {
      tipoEvento = "vermelho";
    } else if (desc.includes("amarelo") && !desc.includes("expulsão")) {
      tipoEvento = "amarelo";
    }
    
    if (tipoEvento) {
      animationQueue.add({ hash, type: tipoEvento });
    }
  });

  if (data.placar) {
    const homeScore = Number(data.placar.home ?? 0);
    const awayScore = Number(data.placar.away ?? 0);
    
    if (homeScore !== golControl.lastScore.home || awayScore !== golControl.lastScore.away) {
      const now = Date.now();
      if (now - golControl.lastTrigger > golControl.cooldown) {
        const hash = `gol_${homeScore}_${awayScore}_${now}`;
        
        console.log('⚽ GOL DETECTADO! Hash:', hash);
        animationQueue.add({ hash, type: "gol" });
        
        golControl.lastScore = { home: homeScore, away: awayScore };
        golControl.lastTrigger = now;
        golControl.saveScore(golControl.lastScore);
      }
    }
  }
}

async function loadAgenda() {
  try {
    const response = await fetch(CONFIG.apiUrl);
    let data = await response.json();

    if (data && data.dados_prontos) {
      data = data.dados_prontos;
    } else if (Array.isArray(data)) {
      data = data[0];
    }

    if (data && data[""] !== undefined) {
      data = data[""];
    }

    if (data && data.modo_agenda === true) {
      state.agendaData = data;
      
      if (data.proximo_jogo) {
        const dataProxJogo = parseBrazilianDate(
          data.proximo_jogo.data,
          data.proximo_jogo.horario
        );
        
        if (dataProxJogo) {
          showCountdown(dataProxJogo, data.proximo_jogo);
        }
      }
    }
  } catch (error) {
    console.error("Erro ao carregar agenda:", error);
  }
}

function showCountdown(targetDate, matchInfo) {
  const wrapper = document.getElementById("countdown-wrapper");
  const timerText = document.getElementById("timer-text");

  if (!wrapper || !timerText) return;

  wrapper.style.display = "block";

  if (state.countdownInterval) {
    clearInterval(state.countdownInterval);
  }

  state.countdownInterval = setInterval(() => {
    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) {
      clearInterval(state.countdownInterval);
      timerText.textContent = "AGUARDANDO INÍCIO...";
      return;
    }

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    timerText.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, 1000);
}

function hideCountdown() {
  const wrapper = document.getElementById("countdown-wrapper");
  if (wrapper) {
    wrapper.style.display = "none";
  }
  if (state.countdownInterval) {
    clearInterval(state.countdownInterval);
    state.countdownInterval = null;
  }
}

function parseBrazilianDate(dateStr, timeStr) {
  try {
    if (!dateStr) return null;

    const cleanDate = dateStr.replace(/<[^>]*>/g, "").trim();
    
    let day, month, year;

    if (cleanDate.includes("/")) {
      const parts = cleanDate.split("/");
      day = parts[0];
      month = parts[1];
      year = parts[2];
      
      if (year && year.length === 2) {
        year = "20" + year;
      }
    } else {
      const meses = {
        jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
        jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12
      };

      const parts = cleanDate.split(" ");
      day = parts[0];
      const mesStr = parts[1]?.replace(".", "").toLowerCase();
      month = meses[mesStr] || 1;
      year = new Date().getFullYear();
    }

    let hour = 0, minute = 0;
    if (timeStr && timeStr !== "A definir") {
      [hour, minute] = timeStr.split(":").map((n) => parseInt(n));
    }

    const utcMillis = Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      (parseInt(hour) || 0) + 3,
      parseInt(minute) || 0
    );
    
    const date = new Date(utcMillis);
    
    return date;
  } catch (e) {
    console.error("Erro ao processar data:", dateStr, timeStr, e);
    return null;
  }
}

function updateMatchState(data) {
  if (!data || !data.placar) return;

  const placar = data.placar;
  
  const matchId = btoa(`${placar.home_name}-${placar.away_name}-${data.informacoes?.data || ''}`);
  
  if (golControl.matchId !== matchId) {
    golControl.matchId = matchId;
    golControl.loadSavedScore();
  }

  if (data.partida && data.partida.includes(" x ")) {
    const [home, away] = data.partida.split(" x ");
    state.match.home.name = home.trim();
    state.match.away.name = away.trim();
  }

  state.match.score.home = Number(data.placar.home ?? 0);
  state.match.score.away = Number(data.placar.away ?? 0);
  state.match.status = data.placar.status || "AO VIVO";
  state.match.minute = data.narracao?.[0]?.minuto || "0'";
}

function renderAllComponents(data) {
  renderMatchHeader(data.placar, data.narracao, data.informacoes);
  renderTimelineFullWidth(data.narracao);
  if (data.estatisticas && Object.keys(data.estatisticas).length > 0) {
    renderPanelStats(data.estatisticas);
  }
  updateTopArbitro(data.arbitragem);
  renderPanelLineups(data.escalacao);
}

function renderMatchHeader(placar, narracao, informacoes) {
  const container = document.getElementById("live-match-container");
  if (!container || !placar) return;

  let currentMinute = "0'";
  if (narracao && narracao.length > 0 && narracao[0].minuto) {
    currentMinute = String(narracao[0].minuto)
      .replace(/<[^>]*>/g, "")
      .trim();
  }

  let matchStatus = placar.status || "AO VIVO";

  if (currentMinute.includes("45'") && currentMinute.includes("1°T")) {
    matchStatus = "FIM DO 1° TEMPO";
  } else if (
    currentMinute.includes("Int") ||
    currentMinute.toLowerCase().includes("intervalo")
  ) {
    matchStatus = "INTERVALO";
  } else if (
    currentMinute.includes("90'") ||
    (currentMinute.includes("45'") && currentMinute.includes("2°T"))
  ) {
    matchStatus = "FIM DO 2° TEMPO";
  } else if (currentMinute.includes("2°T")) {
    matchStatus = "2° TEMPO";
  } else if (currentMinute.includes("1°T")) {
    matchStatus = "1° TEMPO";
  }

  const localPartida = informacoes?.estadio || "Local não informado";
  const nomeCampeonato = informacoes?.campeonato || "Partida";

  container.innerHTML = `
  <div class="match-header-card">
    <div class="match-status-badge ${matchStatus.includes("AO VIVO") || matchStatus.includes("TEMPO") ? "live-pulse" : ""}">
      <i class="fas fa-circle"></i> ${matchStatus.toUpperCase()}
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

    <div class="match-footer-info" style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.8rem; color: var(--gray-300); text-align: center; display: flex; flex-direction: column; gap: 5px;">
      <div><i class="fas fa-trophy" style="color: var(--accent); margin-right: 5px;"></i> ${nomeCampeonato}</div>
      <div><i class="fas fa-location-dot" style="color: var(--accent); margin-right: 5px;"></i> ${localPartida}</div>
    </div>
  </div>
`;
}

/**
 * RENDERIZA TIMELINE EM LARGURA TOTAL
 * ⭐ LANCES RECENTES APARECEM PRIMEIRO
 * ⭐ FADE OUT AUTOMÁTICO DOS ANTIGOS
 */
function renderTimelineFullWidth(narracao) {
  const container = document.getElementById("timeline-container-full");
  const statusIndicator = document.getElementById("match-status-indicator-full");
  const noEventsMessage = document.getElementById("no-events-message-full");

  if (!container) return;

  if (!narracao || narracao.length === 0) {
    if (noEventsMessage) noEventsMessage.style.display = "block";
    if (statusIndicator) statusIndicator.textContent = "AGUARDANDO";
    return;
  }

  if (noEventsMessage) noEventsMessage.style.display = "none";
  if (statusIndicator) statusIndicator.textContent = "AO VIVO";

  // Pega os IDs dos lances atuais
  const lancesAtuaisIds = new Set(narracao.slice(0, MAX_LANCES_VISIVEIS).map(l => l.id));
  
  // Remove lances antigos com animação de fade out
  const itemsAtuais = Array.from(container.querySelectorAll('.timeline-item-full'));
  itemsAtuais.forEach(item => {
    const lanceId = item.dataset.lanceId;
    if (lanceId && !lancesAtuaisIds.has(lanceId)) {
      if (!item.classList.contains('fading-out')) {
        item.classList.add('fading-out');
        setTimeout(() => {
          if (item.parentNode === container) {
            container.removeChild(item);
          }
          lancesExibidos.delete(lanceId);
        }, 800); // Tempo da animação fade-out
      }
    }
  });

  // Renderiza apenas os lances mais recentes (ordem inversa - mais recente primeiro)
  const lancesParaExibir = narracao.slice(0, MAX_LANCES_VISIVEIS);
  
  lancesParaExibir.forEach((lance, index) => {
    const lanceId = lance.id || `lance-${index}`;
    
    // Verifica se o lance já está no DOM
    if (container.querySelector(`[data-lance-id="${lanceId}"]`)) {
      return; // Lance já existe, não adiciona novamente
    }

    const item = document.createElement("div");
    item.dataset.lanceId = lanceId;

    // Define classe base e tipo do lance
    let tipoClass = "";
    let iconContent = lance.icone || "📝";
    const desc = (lance.descricao || "").toLowerCase();

    // Determina o tipo de lance para estilização
    if (lance.is_gol || desc.includes("gol")) {
      tipoClass = "gol";
      iconContent = '<i class="fas fa-futbol"></i>';
    } else if (desc.includes("pênalti") || desc.includes("penalidade")) {
      tipoClass = "penalti";
      iconContent = '<i class="fas fa-bullseye"></i>';
    } else if (desc.includes("vermelho")) {
      tipoClass = "vermelho";
      iconContent = '<i class="fas fa-square-full"></i>';
    } else if (desc.includes("amarelo")) {
      tipoClass = "amarelo";
      iconContent = '<i class="fas fa-square-full"></i>';
    } else if (desc.includes("substituição") || desc.includes("sai:") || desc.includes("entra:")) {
      tipoClass = "substituicao";
      iconContent = '<i class="fas fa-exchange-alt"></i>';
    } else if (lance.tipo === "Lance importante") {
      tipoClass = "importante";
      iconContent = '<i class="fas fa-star"></i>';
    } else if (lance.tipo === "Resumo automático" || desc.includes("resumo")) {
      tipoClass = "resumo";
      iconContent = '<i class="fas fa-list-ul"></i>';
    }

    // Verifica se é um lance novo (primeiros 3)
    const isNovo = !lancesExibidos.has(lanceId) && index < 3;
    
    item.className = `timeline-item-full ${tipoClass} ${isNovo ? 'novo' : ''}`;

    // Formata o minuto
    let minuto = "0'";
    if (lance.minuto !== undefined && lance.minuto !== null) {
      minuto = String(lance.minuto).replace(/<[^>]*>/g, "").trim();
    }

    // Formata o período
    let periodo = "";
    if (lance.periodo) {
      periodo = `<span class="timeline-periodo">${lance.periodo}</span>`;
    }

    // Formata o timestamp se existir
    let timestamp = "";
    if (lance.timestamp) {
      const dataLance = new Date(lance.timestamp);
      const horas = String(dataLance.getHours()).padStart(2, '0');
      const minutos = String(dataLance.getMinutes()).padStart(2, '0');
      timestamp = `<div class="timeline-timestamp">${horas}:${minutos}</div>`;
    }

    // Limpa descrição de HTML
    const descricaoLimpa = (lance.descricao || "").replace(/<strong>/g, '').replace(/<\/strong>/g, '');

    // Monta o HTML do item
    item.innerHTML = `
      <div class="timeline-content-full">
        <div class="timeline-marker-full">
          <div class="timeline-icon-full">${iconContent}</div>
        </div>
        <div class="timeline-info-full">
          <div class="timeline-header-full">
            <span class="timeline-minute-full">${minuto}</span>
            ${periodo}
            ${lance.tipo ? `<span class="timeline-badge">${lance.tipo}</span>` : ''}
          </div>
          <div class="timeline-text-full">${descricaoLimpa}</div>
          ${timestamp}
        </div>
      </div>
    `;

    // Adiciona no início do container (mais recentes primeiro)
    if (container.firstChild) {
      container.insertBefore(item, container.firstChild);
    } else {
      container.appendChild(item);
    }

    // Marca como exibido
    lancesExibidos.add(lanceId);

    // Remove classe 'novo' após 8 segundos
    if (isNovo) {
      setTimeout(() => {
        item.classList.remove('novo');
      }, 8000);
    }
  });
}

/**
 * ATUALIZA ÁRBITRO NO WIDGET SUPERIOR
 */
function updateTopArbitro(arbitragem) {
  const arbitroNome = document.querySelector(".top-arbitro-nome");
  if (arbitroNome && arbitragem) {
    arbitroNome.textContent = arbitragem;
  }
}

/**
 * RENDERIZAR ESTATÍSTICAS NO PAINEL FLUTUANTE
 */
function renderPanelStats(stats) {
  if (!stats) return;

  const homeTeam = document.getElementById("panel-home-team");
  const awayTeam = document.getElementById("panel-away-team");

  if (homeTeam && state.match.home.name) {
    homeTeam.innerHTML = `<span>${state.match.home.name.toUpperCase()}</span>`;
  }

  if (awayTeam && state.match.away.name) {
    awayTeam.innerHTML = `<span>${state.match.away.name.toUpperCase()}</span>`;
  }

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

/**
 * INICIALIZA OS BOTÕES FLUTUANTES SUPERIORES
 */
function initTopFloatingButtons() {
  const btnStats = document.getElementById("top-stats-btn");
  const btnLineup = document.getElementById("top-lineup-btn");
  const btnStatsMobile = document.getElementById("mobile-stats-btn");
  const btnLineupMobile = document.getElementById("mobile-lineup-btn");

  const openStats = () => {
    const overlay = document.getElementById("floating-overlay");
    const statsPanel = document.getElementById("stats-panel");
    const lineupPanel = document.getElementById("lineup-panel");
    overlay.classList.add("active");
    statsPanel.classList.add("active");
    lineupPanel.classList.remove("active");
    document.body.style.overflow = "hidden";
  };

  const openLineup = () => {
    const overlay = document.getElementById("floating-overlay");
    const statsPanel = document.getElementById("stats-panel");
    const lineupPanel = document.getElementById("lineup-panel");
    overlay.classList.add("active");
    lineupPanel.classList.add("active");
    statsPanel.classList.remove("active");
    document.body.style.overflow = "hidden";
  };

  if (btnStats) btnStats.onclick = openStats;
  if (btnStatsMobile) btnStatsMobile.onclick = openStats;
  if (btnLineup) btnLineup.onclick = openLineup;
  if (btnLineupMobile) btnLineupMobile.onclick = openLineup;

  // Fecha painéis ao clicar no overlay
  const overlay = document.getElementById("floating-overlay");
  if (overlay) {
    overlay.onclick = () => {
      overlay.classList.remove("active");
      document.getElementById("stats-panel")?.classList.remove("active");
      document.getElementById("lineup-panel")?.classList.remove("active");
      document.body.style.overflow = "";
    };
  }

  // Botões de fechar
  const closeBtns = document.querySelectorAll(".panel-close-btn");
  closeBtns.forEach(btn => {
    btn.onclick = () => {
      overlay.classList.remove("active");
      document.getElementById("stats-panel")?.classList.remove("active");
      document.getElementById("lineup-panel")?.classList.remove("active");
      document.body.style.overflow = "";
    };
  });
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
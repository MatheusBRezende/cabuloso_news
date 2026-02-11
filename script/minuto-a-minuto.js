/**
 * Cabuloso News - Minuto a Minuto OTIMIZADO
 * Versão: 11.0 - SEM COMPROMETER TEMPO REAL
 * - Mantém 5s de atualização durante jogos ao vivo
 * - Economiza requisições quando não há jogo
 * - Usa cache inteligente do Worker (RAM)
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
  currentUpdateInterval: CONFIG.updateIntervalLive, // Começa otimista
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
    // CORREÇÃO: Aguarda a próxima execução antes de marcar como não em execução
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
  stopLivePolling(); // Limpa qualquer intervalo anterior
  
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
  
  // Pré-carregar animações
  preloadAnimations();
  
  animationQueue.loadShownEvents();
  
  // Primeira busca imediata
  await fetchLiveData();
  
  // Inicia polling (velocidade será ajustada automaticamente)
  startLivePolling(state.currentUpdateInterval);
  
  // Agenda (menos frequente)
  loadAgenda();
  setInterval(loadAgenda, 60000); // 1 minuto
  
  console.log("✅ Sistema iniciado com polling adaptativo");
});

/**
 * ⭐ FETCH OTIMIZADO - Aproveita cache do Worker
 */
const fetchLiveData = async () => {
  try {
    // ⚡ NÃO adiciona ?t= aqui - deixa o Worker decidir se usa cache
    // Durante jogo ao vivo, o Worker vai buscar dados frescos automaticamente
    const response = await fetch(CONFIG.webhookUrl, {
      cache: 'no-cache' // Força bypass do cache do navegador, mas permite cache do Worker
    });
    
    let data = await response.json();

    // Verifica status do cache no Worker
    const cacheStatus = response.headers.get('X-Cache');
    if (cacheStatus) {
      console.log(`📦 Cache status: ${cacheStatus}`);
    }

    // 1. TRATAMENTO DO ENVELOPE (n8n ou Array)
    if (data && data.dados_prontos) {
      data = data.dados_prontos;
    } else if (Array.isArray(data)) {
      data = data[0];
    }

    // 2. MANTÉM LÓGICA DE EXTRAÇÃO DE CHAVE VAZIA
    if (data && data[""] !== undefined) {
      data = data[""];
    }

    // 3. LÓGICA INTELIGENTE DE ADAPTAÇÃO DE VELOCIDADE
    const isLiveMatch = data && data.success === true && (data.placar || data.narracao);
    const isAgenda = data && (data.status === "agenda" || data.modo_agenda === true);
    const hasError = data && data.error;

    // 🎯 DECISÃO DE VELOCIDADE
    if (hasError || !data) {
      // ERRO: Modo super lento (60s)
      if (state.logsEnabled) {
        console.log("❌ Erro detectado. Aguardando 60s...");
      }
      state.matchStarted = false;
      showNextMatchCountdown();
      startLivePolling(CONFIG.updateIntervalIdle);
      return;
    }

    if (isAgenda && !isLiveMatch) {
      // MODO AGENDA: Verifica se está próximo do jogo
      const proximoJogo = await checkProximoJogo();
      
      if (proximoJogo && proximoJogo.minutosParaInicio <= 30) {
        // 30 minutos antes: modo PRÉ-JOGO (15s)
        if (state.logsEnabled) {
          console.log(`⏰ Jogo em ${proximoJogo.minutosParaInicio}min. Polling moderado (15s).`);
        }
        state.matchStarted = false;
        showNextMatchCountdown();
        startLivePolling(CONFIG.updateIntervalPreMatch);
      } else {
        // Mais de 30min: modo LENTO (60s)
        if (state.logsEnabled) {
          console.log("📅 Sem jogos próximos. Polling lento (60s).");
        }
        state.matchStarted = false;
        showNextMatchCountdown();
        startLivePolling(CONFIG.updateIntervalIdle);
      }
      return;
    }

    // 4. JOGO AO VIVO! ⚽
    if (isLiveMatch) {
      // Garante polling RÁPIDO (5s)
      if (state.currentUpdateInterval !== CONFIG.updateIntervalLive) {
        console.log("⚽ JOGO AO VIVO DETECTADO! Ativando polling RÁPIDO (5s)");
        state.matchStarted = true;
        startLivePolling(CONFIG.updateIntervalLive);
      }

      // 5. ATUALIZAÇÃO DOS COMPONENTES VISUAIS
      if (state.logsEnabled) console.log("✅ Renderizando lances do jogo...");
      
      showLiveMatchUI();

      // Cache de estatísticas
      if (data.estatisticas && Object.keys(data.estatisticas).length > 0) {
        lastValidStats = data.estatisticas;
      }

      updateMatchState(data);
      processarGol();
      detectarNovoLance(data);
      renderTimeline(data.narracao || []);
      renderPanelStats(lastValidStats || data.estatisticas);
      renderLineups(data.escalacao);
    }

  } catch (error) {
    console.error("❌ Erro ao buscar dados ao vivo:", error);
    
    // Em caso de erro de rede, mantém polling lento
    if (state.currentUpdateInterval !== CONFIG.updateIntervalIdle) {
      console.log("🔄 Erro de rede. Reduzindo frequência...");
      startLivePolling(CONFIG.updateIntervalIdle);
    }
  }
};

/**
 * Verifica se há jogo próximo na agenda
 */
async function checkProximoJogo() {
  try {
    // 🟢 CORREÇÃO: Verifica se agendaData existe e se a propriedade 'jogos' é um array populado
    if (state.agendaData && Array.isArray(state.agendaData.jogos) && state.agendaData.jogos.length > 0) {
      const proximoJogo = state.agendaData.jogos[0];
      
      // CORREÇÃO: Validação de dados da data/hora
      const dataParts = proximoJogo.data ? proximoJogo.data.split('/') : [];
      const horaParts = proximoJogo.hora ? proximoJogo.hora.split(':') : [];
      
      if (dataParts.length !== 3 || horaParts.length < 2) {
        console.warn("Formato de data/hora inválido:", proximoJogo.data, proximoJogo.hora);
        return null;
      }
      
      const dia = parseInt(dataParts[0], 10);
      const mes = parseInt(dataParts[1], 10);
      const ano = parseInt(dataParts[2], 10);
      const hora = parseInt(horaParts[0], 10);
      const minuto = parseInt(horaParts[1] || 0, 10);
      
      // Valida valores numéricos
      if (!isFinite(dia) || !isFinite(mes) || !isFinite(ano) || !isFinite(hora) || !isFinite(minuto)) {
        console.warn("Valores de data/hora não são números válidos");
        return null;
      }
      
      // Valida faixas razoáveis
      if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 2000 || ano > 2100 || 
          hora < 0 || hora > 23 || minuto < 0 || minuto > 59) {
        console.warn("Valores de data/hora fora da faixa esperada");
        return null;
      }
      
      // CORREÇÃO: Cria a data UTC para Brasília (UTC-3)
      // A hora fornecida é em Brasília, então adicionamos 3 horas para converter para UTC
      const utcMillis = Date.UTC(ano, mes - 1, dia, hora + 3, minuto);
      const dataJogo = new Date(utcMillis);
      
      const agora = new Date();
      const minutosParaInicio = Math.floor((dataJogo - agora) / 1000 / 60);
      
      return {
        jogo: proximoJogo,
        minutosParaInicio: minutosParaInicio
      };
    }
  } catch (e) {
    console.warn("Erro ao verificar próximo jogo:", e);
  }
  return null; // Retorna null se não houver jogos ou em caso de erro
}

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

  if (atual.home === anterior.home && atual.away === anterior.away) {
    return null;
  }

  let quemFezGol = null;
  
  if (atual.home > anterior.home) {
    quemFezGol = "HOME";
  } else if (atual.away > anterior.away) {
    quemFezGol = "AWAY";
  }

  if (quemFezGol) {
    console.log(`⚽ GOL! ${quemFezGol} - Placar: ${atual.home} x ${atual.away}`);
    
    golControl.lastTrigger = now;
    golControl.lastScore = { ...atual };
    golControl.saveScore(atual);
    
    return quemFezGol;
  }

  golControl.lastScore = { ...atual };
  golControl.saveScore(atual);
  
  return null;
}

function processarGol() {
  const gol = detectarGolComDelay();
  if (!gol) return;

  const minuto = state.match.minute || "0'";
  const placar = `${state.match.score.home}x${state.match.score.away}`;
  const hash = gerarHashLance(minuto, `GOL_${placar}`, 'GOL');

  animationQueue.add({
    type: "gol",
    minute: minuto,
    hash,
    team: gol
  });
}

function processarNovoLance(lance) {
  const desc = lance.descricao?.toUpperCase() || "";
  const minuto = lance.minuto ? String(lance.minuto) : "0'";

  // REMOVIDO: Detecção de gol por palavra-chave
  // Gols agora são detectados APENAS por mudança de placar

  if (desc.includes("CARTÃO VERMELHO") || desc.includes("EXPULSO")) {
    const hash = gerarHashLance(minuto, desc, 'VERMELHO');
    animationQueue.add({ type: "vermelho", minute: minuto, hash });
    return;
  }

  if (
    desc.includes("PENALIDADE MÁXIMA") ||
    desc.includes("PÊNALTI") ||
    desc.includes("PENALTI") ||
    desc.includes("MARCA DA CAL")
  ) {
    const hash = gerarHashLance(minuto, desc, 'PENALTI');
    animationQueue.add({ type: "penalti", minute: minuto, hash });
    return;
  }

  if (desc.includes("CARTÃO AMARELO") || desc.includes("AMARELO")) {
    const hash = gerarHashLance(minuto, desc, 'AMARELO');
    animationQueue.add({ type: "amarelo", minute: minuto, hash });
  }
}

/**
 * EXIBE A INTERFACE DE JOGO AO VIVO
 */
const showLiveMatchUI = () => {
  const liveSections = document.getElementById("live-match-sections");
  const countdownWrapper = document.getElementById("countdown-wrapper");
  document.body.classList.add("live-match");
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
    
    // Mostra uma mensagem padrão se não houver próximos jogos
    const liveSections = document.getElementById("live-match-sections");
    const countdownWrapper = document.getElementById("countdown-wrapper");
    
    if (liveSections) liveSections.style.display = "none";
    if (countdownWrapper) {
      countdownWrapper.style.display = "block";
      
      // Mensagem de fallback
      const container = document.getElementById("live-match-container");
      if (container) {
        container.innerHTML = `
          <div class="match-header-card" style="text-align: center; padding: 40px;">
            <div class="match-status-badge" style="background: var(--gray-600);">
              <i class="fas fa-calendar-times"></i> SEM PRÓXIMOS JOGOS
            </div>
            <div style="margin-top: 20px; color: var(--gray-300);">
              Nenhum jogo encontrado na agenda
            </div>
          </div>
        `;
      }
    }
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

  // Verifica se o Cruzeiro é o mandante para organizar o escudo na esquerda
  const isCruzeiroMandante = match.mandante?.toLowerCase().includes("cruzeiro");

  const escudoMandante = match.escudo_mandante || "../assets/default-logo.png";
  const escudoVisitante = match.escudo_visitante || "../assets/default-logo.png";
  const nomeMandante = match.mandante || "A definir";
  const nomeVisitante = match.visitante || "A definir";

  container.innerHTML = `
    <div class="match-header-card" style="background: linear-gradient(135deg, #1a1f3a 0%, #002266 100%); border: 2px solid var(--primary-light);">
      <div class="match-status-badge" style="background: var(--accent); color: var(--primary-dark);">
        <i class="fas fa-clock"></i> PRÓXIMO JOGO
      </div>
      <div class="score-row" style="flex-direction: column; gap: 30px; padding: 40px 20px;">
        <div style="display: flex; justify-content: center; align-items: center; gap: 40px; width: 100%;">
          <div class="team-info" style="flex-direction: column; text-align: center; flex: 1; max-width: 200px;">
            <img src="${escudoMandante}" class="team-logo" style="width: 100px; height: 100px; margin-bottom: 15px;">
            <span class="team-name">${nomeMandante}</span>
          </div>
          <div class="vs-divider">VS</div>
          <div class="team-info" style="flex-direction: column; text-align: center; flex: 1; max-width: 200px;">
            <img src="${escudoVisitante}" class="team-logo" style="width: 100px; height: 100px; margin-bottom: 15px;">
            <span class="team-name">${nomeVisitante}</span>
          </div>
        </div>
        <div class="match-game-info">
          <div class="match-competition"><i class="fas fa-trophy"></i> ${match.campeonato || 'Partida'}</div>
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
      (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    timerElement.textContent =
      days > 0
        ? `${days}d ${String(hours).padStart(2, "0")}h ${String(
            minutes,
          ).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`
        : `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(
            2,
            "0",
          )}m ${String(seconds).padStart(2, "0")}s`;
  };
  update();
  state.countdownInterval = setInterval(update, 1000);
};

async function loadAgenda() {
  try {
    const response = await fetch(`${CONFIG.apiUrl}&t=${Date.now()}`);
    const data = await response.json();

    console.log("📦 Dados brutos da agenda:", data);

    // 1. Normalização: Se a API vier como Array, pegamos o primeiro item. 
    // Se vier como Objeto (seu caso atual), usamos o objeto direto.
    const rawData = Array.isArray(data) ? data[0] : data;
    
    // 2. Verificação: O seu JSON tem a chave "agenda"
    if (rawData && rawData.agenda && Array.isArray(rawData.agenda)) {
      state.agendaData = {
        jogos: rawData.agenda // Mapeamos 'agenda' da API para o 'jogos' do seu state
      };
      
      console.log("✅ Agenda carregada:", rawData.agenda.length, "jogos");
      
      // Se não tiver jogo ao vivo, exibe o próximo jogo
      if (!state.matchStarted) {
        showNextMatchCountdown();
      }
    } else {
      console.warn("⚠️ Formato de agenda não reconhecido ou vazio:", data);
      state.agendaData = { jogos: [] };
    }
    
  } catch (e) {
    console.error("❌ Erro ao carregar agenda:", e);
    state.agendaData = { jogos: [] };
  }
}

function getNextMatchFromAgenda() {
  if (!state.agendaData || !state.agendaData.jogos) return null;
  const now = new Date();
  let closest = null;
  let minDiff = Infinity;

  state.agendaData.jogos.forEach((jogo) => {
    const dataMatch = parseMatchDate(jogo.data, jogo.hora);
    if (!dataMatch) return;

    const diff = dataMatch - now;
    // Considera jogos futuros ou que começaram há menos de 3 horas
    if (dataMatch > now - 10800000) {
      if (diff < minDiff) {
        minDiff = diff;
        closest = { ...jogo, dataObj: dataMatch };
      }
    }
  });

  return closest;
}

function parseMatchDate(dateStr, timeStr) {
  try {
    // Remove prefixos como "dom.," se existir
    const cleanDate = dateStr.replace(/^[a-z]{3}\.,?\s*/i, "").trim();
    
    let day, month, year;

    if (cleanDate.includes("/")) {
      const parts = cleanDate.split("/");
      day = parts[0];
      month = parts[1];
      year = parts[2];
      
      // Se o ano tiver apenas 2 dígitos, assume século 21
      if (year && year.length === 2) {
        year = "20" + year;
      }
    } else {
      // Fallback para formato textual
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

    // CORREÇÃO: Cria a data UTC para Brasília (UTC-3)
    const utcMillis = Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      (parseInt(hour) || 0) + 3, // Adiciona 3 horas para converter Brasília -> UTC
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

  // Lógica de status (mantida igual a sua)
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
 */
function renderTimelineFullWidth(narracao) {
  const container = document.getElementById("timeline-container-full");
  const statusIndicator = document.getElementById(
    "match-status-indicator-full",
  );
  const noEventsMessage = document.getElementById("no-events-message-full");

  if (!container) return;

  if (!narracao || narracao.length === 0) {
    if (noEventsMessage) noEventsMessage.style.display = "block";
    if (statusIndicator) statusIndicator.textContent = "AGUARDANDO";
    return;
  }

  if (noEventsMessage) noEventsMessage.style.display = "none";
  if (statusIndicator) statusIndicator.textContent = "AO VIVO";

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  narracao.forEach((lance) => {
    const item = document.createElement("div");

    let iconClass = "";
    let iconContent = lance.icone || "📝";
    let extraClass = "lance-normal";
    const desc = lance.descricao ? lance.descricao.toLowerCase() : "";

    // Lógica de Ícones
    if (lance.is_gol || desc.includes("gol")) {
      iconClass = "icon-goal";
      iconContent = '<i class="fas fa-futbol"></i>';
      extraClass = "lance-gol";
    } else if (desc.includes("amarelo")) {
      iconClass = "icon-yellow-card";
      iconContent =
        '<i class="fas fa-square-full" style="font-size: 0.8em;"></i>';
    } else if (desc.includes("vermelho")) {
      iconClass = "icon-red-card";
      iconContent =
        '<i class="fas fa-square-full" style="font-size: 0.8em;"></i>';
    } else if (
      desc.includes("pênalti") ||
      desc.includes("penalidade") ||
      desc.includes("marca da cal")
    ) {
      iconClass = "icon-penalty";
      iconContent = '<i class="fas fa-bullseye"></i>';
      extraClass = "lance-importante";
    }

    item.className = `timeline-item-full ${extraClass}`;

    let min = "0'";
    if (lance.minuto !== undefined && lance.minuto !== null) {
      min = String(lance.minuto)
        .replace(/<[^>]*>/g, "")
        .trim();
    }

    // CORREÇÃO: Sanitização de HTML usando textContent
    const timeElement = document.createElement("div");
    timeElement.className = "timeline-time-full";
    timeElement.innerHTML = `<span class="time-badge-full">${min}</span>`;

    const contentElement = document.createElement("div");
    contentElement.className = "timeline-content-full";
    
    const iconElement = document.createElement("div");
    iconElement.className = `timeline-icon-full ${iconClass}`;
    iconElement.innerHTML = iconContent;
    
    const textElement = document.createElement("div");
    textElement.className = "timeline-text-full";
    
    const pElement = document.createElement("p");
    pElement.textContent = lance.descricao || "";
    textElement.appendChild(pElement);
    
    contentElement.appendChild(iconElement);
    contentElement.appendChild(textElement);
    
    item.appendChild(timeElement);
    item.appendChild(contentElement);
    
    container.appendChild(item);
  });
}

/**
 * RENDERIZA ESTATÍSTICAS EM GRID
 */
function renderGridStats(stats) {
  const homeContainer = document.getElementById("home-stats-list-grid");
  const awayContainer = document.getElementById("away-stats-list-grid");
  const homeHeader = document.getElementById("home-stats-header-grid");
  const awayHeader = document.getElementById("away-stats-header-grid");

  if (!stats) return;

  // Atualizar cabeçalhos
  if (homeHeader && state.match.home.name) {
    homeHeader.innerHTML = `
      <i class="fas fa-chart-bar"></i>
      <span>${state.match.home.name.toUpperCase()}</span>
    `;
  }

  if (awayHeader && state.match.away.name) {
    awayHeader.innerHTML = `
      <i class="fas fa-chart-pie"></i>
      <span>${state.match.away.name.toUpperCase()}</span>
    `;
  }

  // Renderizar estatísticas do mandante
  if (homeContainer) {
    const homeItems = [
      { label: "Posse de bola", value: stats.posse_home || "0%" },
      { label: "Chutes", value: stats.chutes_home || 0 },
      { label: "Chutes a gol", value: stats.chutes_gol_home || 0 },
      { label: "Passes certos", value: stats.passes_certos_home || 0 },
      { label: "Passes errados", value: stats.passes_errados_home || 0 },
      { label: "Faltas", value: stats.faltas_home || 0 },
      { label: "Desarmes", value: stats.desarmes_home || 0 },
      { label: "Escanteios", value: stats.escanteios_home || 0 },
      { label: "Impedimentos", value: stats.impedimentos_home || 0 },
      { label: "Cartões amarelos", value: stats.amarelos_home || 0 },
      { label: "Cartões vermelhos", value: stats.vermelhos_home || 0 },
    ];

    homeContainer.innerHTML = homeItems
      .map(
        (item) => `
      <div class="stat-item-grid">
        <span class="stat-label-grid">${item.label}</span>
        <span class="stat-value-grid">${item.value}</span>
      </div>
    `,
      )
      .join("");
  }

  // Renderizar estatísticas do visitante
  if (awayContainer) {
    const awayItems = [
      { label: "Posse de bola", value: stats.posse_away || "0%" },
      { label: "Chutes", value: stats.chutes_away || 0 },
      { label: "Chutes a gol", value: stats.chutes_gol_away || 0 },
      { label: "Passes certos", value: stats.passes_certos_away || 0 },
      { label: "Passes errados", value: stats.passes_errados_away || 0 },
      { label: "Faltas", value: stats.faltas_away || 0 },
      { label: "Desarmes", value: stats.desarmes_away || 0 },
      { label: "Escanteios", value: stats.escanteios_away || 0 },
      { label: "Impedimentos", value: stats.impedimentos_away || 0 },
      { label: "Cartões amarelos", value: stats.amarelos_away || 0 },
      // CORREÇÃO: Cartões vermelhos do visitante
      { label: "Cartões vermelhos", value: stats.vermelhos_away || 0 },
    ];

    awayContainer.innerHTML = awayItems
      .map(
        (item) => `
      <div class="stat-item-grid">
        <span class="stat-label-grid">${item.label}</span>
        <span class="stat-value-grid">${item.value}</span>
      </div>
    `,
      )
      .join("");
  }
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
 * INICIALIZA OS BOTÕES FLUTUANTES SUPERIORES
 */
function initTopFloatingButtons() {
  const btnStats = document.getElementById("top-stats-btn");
  const btnLineup = document.getElementById("top-lineup-btn");

  // SEUS NOVOS SELETORES MOBILE:
  const btnStatsMobile = document.getElementById("mobile-stats-btn");
  const btnLineupMobile = document.getElementById("mobile-lineup-btn");

  const openStats = () => {
    const overlay = document.getElementById("floating-overlay");
    const statsPanel = document.getElementById("stats-panel");
    const lineupPanel = document.getElementById("lineup-panel");
    overlay.classList.add("active");
    statsPanel.classList.add("active");
    lineupPanel.classList.remove("active");
  };

  const openLineup = () => {
    const overlay = document.getElementById("floating-overlay");
    const statsPanel = document.getElementById("stats-panel");
    const lineupPanel = document.getElementById("lineup-panel");
    overlay.classList.add("active");
    lineupPanel.classList.add("active");
    statsPanel.classList.remove("active");
  };

  if (btnStats) btnStats.onclick = openStats;
  if (btnStatsMobile) btnStatsMobile.onclick = openStats; // Ativa no mobile

  if (btnLineup) btnLineup.onclick = openLineup;
  if (btnLineupMobile) btnLineupMobile.onclick = openLineup; // Ativa no mobile
}

function openStatsPanel() {
  const overlay = document.getElementById("floating-overlay");
  const statsPanel = document.getElementById("stats-panel");
  const lineupPanel = document.getElementById("lineup-panel");

  if (overlay && statsPanel) {
    overlay.classList.add("active");
    statsPanel.classList.add("active");
    lineupPanel.classList.remove("active");
    document.body.style.overflow = "hidden";

    // ATUALIZA OS DADOS QUANDO ABRIR O PAINEL
    updateStatsPanel();
  }
}

function openLineupPanel() {
  const overlay = document.getElementById("floating-overlay");
  const lineupPanel = document.getElementById("lineup-panel");
  const statsPanel = document.getElementById("stats-panel");

  if (overlay && lineupPanel) {
    overlay.classList.add("active");
    lineupPanel.classList.add("active");
    statsPanel.classList.remove("active");
    document.body.style.overflow = "hidden";

    // ATUALIZA OS DADOS QUANDO ABRIR O PAINEL
    updateLineupPanel();
  }
}

function updateStatsPanel() {
  // Use as estatísticas em cache (lastValidStats) ou busque se não houver
  if (lastValidStats) {
    renderPanelStats(lastValidStats);
  } else {
    // Tenta buscar estatísticas da API
    fetchLiveDataForPanel();
  }
}

/**
 * ATUALIZA OS DADOS DO PAINEL DE ESCALAÇÕES
 */
function updateLineupPanel() {
  // Tenta buscar escalações da API
  fetchLiveDataForPanel();
}

async function fetchLiveDataForPanel() {
  try {
    const response = await fetch(`${CONFIG.webhookUrl}&t=${Date.now()}`);
    let data = await response.json();

    if (data && data[""] !== undefined) {
      data = data[""];
    }

    if (Array.isArray(data)) {
      data = data[0];
    }

    // Atualiza estatísticas se disponíveis
    if (data.estatisticas && Object.keys(data.estatisticas).length > 0) {
      lastValidStats = data.estatisticas;
      renderPanelStats(data.estatisticas);
    }

    // Atualiza escalações se disponíveis
    if (data.escalacao) {
      renderPanelLineups(data.escalacao);
    }

    // Atualiza árbitro se disponível
    if (data.arbitragem) {
      updateTopArbitro(data.arbitragem);
    }
    
    // CORREÇÃO: Remove controle de polling deste método
    // O polling é controlado apenas pela função fetchLiveData
    // NÃO chamamos startLivePolling ou stopLivePolling aqui
  } catch (e) {
    console.error("⚠️ Erro ao buscar dados para painéis:", e);
  }
}

function closeAllPanels() {
  const overlay = document.getElementById("floating-overlay");
  const panels = document.querySelectorAll(".floating-panel");

  if (overlay) overlay.classList.remove("active");
  panels.forEach((panel) => panel.classList.remove("active"));

  // DEVOLVE O SCROLL
  document.body.style.overflow = "";
  console.log("Painéis fechados e scroll liberado");
}

document.addEventListener("DOMContentLoaded", () => {
  preloadAnimations();
  const overlay = document.getElementById("floating-overlay");
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeAllPanels();
    });
  }

  // CORREÇÃO AQUI: O seu HTML usa 'panel-close-btn'
  document.querySelectorAll(".panel-close-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      closeAllPanels();
    });
  });

  // ADICIONE ISSO PARA O ESC FUNCIONAR SEMPRE:
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllPanels();
  });
});

/**
 * RENDERIZAR TIMELINE DE LANCES
 */
function renderTimeline(narracao = []) {
  const timelineContainer = document.getElementById('timeline-container-full');
  const noEventsMessage = document.getElementById('no-events-message-full');
  const matchStatusIndicator = document.getElementById('match-status-indicator-full');
  
  if (!timelineContainer) {
    console.warn('⚠️ Container da timeline não encontrado');
    return;
  }
  
  // Atualizar status do jogo
  if (matchStatusIndicator) {
    const status = state.match.status || 'AGUARDANDO';
    matchStatusIndicator.textContent = status;
    matchStatusIndicator.className = 'match-status-full';
    
    if (status.includes('AO VIVO') || status.includes('TEMPO')) {
      matchStatusIndicator.classList.add('live');
    }
  }
  
  // Se não há eventos, mostrar mensagem
  if (!narracao || narracao.length === 0) {
    if (noEventsMessage) {
      noEventsMessage.style.display = 'flex';
    }
    // Limpar timeline existente
    const existingItems = timelineContainer.querySelectorAll('.timeline-item-full');
    existingItems.forEach(item => item.remove());
    console.log('📋 Nenhum lance para mostrar ainda');
    return;
  }
  
  // Ocultar mensagem de "sem eventos"
  if (noEventsMessage) {
    noEventsMessage.style.display = 'none';
  }
  
  // Renderizar eventos (do mais recente para o mais antigo)
  const eventosOrdenados = [...narracao].reverse();
  
  // Limpar timeline
  const existingItems = timelineContainer.querySelectorAll('.timeline-item-full');
  existingItems.forEach(item => item.remove());
  
  eventosOrdenados.forEach((lance) => {
    const item = document.createElement('div');
    item.className = 'timeline-item-full';
    
    // Detectar tipo de evento
    let tipoEvento = 'normal';
    let iconClass = 'fas fa-futbol';
    let iconColor = 'var(--gray-500)';
    
    const descLower = lance.descricao?.toLowerCase() || '';
    
    if (descLower.includes('gol') || descLower.includes('goool')) {
      tipoEvento = 'gol';
      iconClass = 'fas fa-futbol';
      iconColor = 'var(--success)';
      item.style.borderLeft = '3px solid var(--success)';
    } else if (descLower.includes('cartão amarelo') || descLower.includes('amarelo')) {
      tipoEvento = 'amarelo';
      iconClass = 'fas fa-square';
      iconColor = '#FFC107';
      item.style.borderLeft = '3px solid #FFC107';
    } else if (descLower.includes('cartão vermelho') || descLower.includes('vermelho')) {
      tipoEvento = 'vermelho';
      iconClass = 'fas fa-square';
      iconColor = '#F44336';
      item.style.borderLeft = '3px solid #F44336';
    } else if (descLower.includes('pênalti') || descLower.includes('penalti')) {
      tipoEvento = 'penalti';
      iconClass = 'fas fa-circle-dot';
      iconColor = 'var(--accent)';
      item.style.borderLeft = '3px solid var(--accent)';
    } else if (descLower.includes('substituição') || descLower.includes('substituicao')) {
      tipoEvento = 'substituicao';
      iconClass = 'fas fa-retweet';
      iconColor = 'var(--primary)';
    }
    
    item.innerHTML = `
      <div class="timeline-time-full">
        <span>${lance.minuto || '0\''}</span>
      </div>
      <div class="timeline-icon-full" style="background-color: ${iconColor}20; border-color: ${iconColor};">
        <i class="${iconClass}" style="color: ${iconColor};"></i>
      </div>
      <div class="timeline-content-full">
        <p class="timeline-desc-full">${lance.descricao || 'Evento sem descrição'}</p>
      </div>
    `;
    
    timelineContainer.appendChild(item);
  });
  
  console.log(`✅ Timeline renderizada com ${narracao.length} eventos`);
}

/**
 * RENDERIZAR ESTATÍSTICAS NO PAINEL FLUTUANTE
 */
function renderPanelStats(stats) {
  if (!stats) return;

  const homeTeamName = document.getElementById("panel-home-team");
  const awayTeamName = document.getElementById("panel-away-team");

  if (homeTeamName && state.match.home.name) {
    homeTeamName.innerHTML = `<span>${state.match.home.name.toUpperCase()}</span>`;
  }

  if (awayTeamName && state.match.away.name) {
    awayTeamName.innerHTML = `<span>${state.match.away.name.toUpperCase()}</span>`;
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
      // CORREÇÃO: Cartões vermelhos do visitante
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
 * RENDERIZAR ESCALAÇÕES NO PAINEL FLUTUANTE (COM SUPORTE A FOTOS)
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

  // Função auxiliar para criar o HTML do jogador
  const createPlayerItem = (jogador, tipo) => {
    const item = document.createElement("div");
    item.className = `panel-player-item ${tipo === "titular" ? "titular" : "reserva"}`;

    // Tratamento para suportar tanto string antiga quanto novo objeto com foto
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

    // Lógica da Imagem
    let iconHtml = "";
    if (fotoUrl) {
      // Se tiver foto, usa a imagem
      iconHtml = `<div class="panel-player-photo" style="background-image: url('${fotoUrl}');"></div>`;
    } else {
      // Se não, usa o ícone padrão
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

    // Titulares
    const titulares = escalacao.home.titulares || [];
    titulares.forEach((jogador) => {
      homeLineupList.appendChild(createPlayerItem(jogador, "titular"));
    });

    // Reservas
    const reservas = escalacao.home.reservas || [];
    reservas.forEach((jogador) => {
      homeLineupList.appendChild(createPlayerItem(jogador, "reserva"));
    });

    // Técnico
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

    // Titulares
    const titulares = escalacao.away.titulares || [];
    titulares.forEach((jogador) => {
      awayLineupList.appendChild(createPlayerItem(jogador, "titular"));
    });

    // Reservas
    const reservas = escalacao.away.reservas || [];
    reservas.forEach((jogador) => {
      awayLineupList.appendChild(createPlayerItem(jogador, "reserva"));
    });

    // Técnico
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
  
      anim.destroy(); // ⛔ impede sobreposição
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

// Salvar dados antes de fechar/recarregar a página
window.addEventListener('beforeunload', () => {
  golControl.saveScore(golControl.lastScore);
  animationQueue.saveShownEvents();
});
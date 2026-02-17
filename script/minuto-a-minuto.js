/**
 * Cabuloso News - Minuto a Minuto OTIMIZADO
 * Versão: 13.0 - COM TRATAMENTO APRIMORADO
 * - Mantém 5s de atualização durante jogos ao vivo
 * - Economiza requisições quando não há jogo
 * - Usa cache inteligente do Worker (RAM)
 * - Sistema de logs organizado e profissional
 * - Tratamento adequado quando não há jogos ao vivo (200 OK em vez de 404)
 * - Detector de próximos jogos aprimorado
 */

// ═══════════════════ SISTEMA DE LOGS PROFISSIONAL ═══════════════════
const Logger = {
  enabled: true,
  
  _format(level, category, message, data) {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warn: '⚠️',
      error: '❌',
      match: '⚽',
      api: '🔌',
      cache: '📦'
    };
    const icon = icons[level] || 'ℹ️';
    const prefix = `[${timestamp}] ${icon} [${category}]`;
    
    if (data) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  },
  
  info(category, message, data = null) {
    if (!this.enabled) return;
    this._format('info', category, message, data);
  },
  
  success(category, message, data = null) {
    if (!this.enabled) return;
    this._format('success', category, message, data);
  },
  
  warn(category, message, data = null) {
    if (!this.enabled) return;
    this._format('warn', category, message, data);
  },
  
  error(category, message, data = null) {
    if (!this.enabled) return;
    this._format('error', category, message, data);
  },
  
  match(category, message, data = null) {
    if (!this.enabled) return;
    this._format('match', category, message, data);
  },
  
  api(category, message, data = null) {
    if (!this.enabled) return;
    this._format('api', category, message, data);
  },
  
  cache(category, message, data = null) {
    if (!this.enabled) return;
    this._format('cache', category, message, data);
  }
};

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
          Logger.info('PLACAR', 'Placar restaurado', this.lastScore);
        }
      }
    } catch (e) {
      Logger.warn('PLACAR', 'Erro ao carregar placar', e);
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
        Logger.success('EVENTOS', `${this.lastEvents.size} eventos anteriores carregados`);
      }
    } catch (e) {
      Logger.warn('EVENTOS', 'Erro ao carregar eventos', e);
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
      Logger.info('EVENTOS', `Evento ${event.type} ignorado (já mostrado)`);
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
 * FIX 3: Limpa cache do localStorage quando não há jogo ao vivo
 * Evita que dados do jogo anterior fiquem persistindo
 */
function limparCacheAoVivo() {
  try {
    localStorage.removeItem('cabuloso_shown_events');
    localStorage.removeItem('cabuloso_last_score');
    // Também reseta o estado interno
    ultimoLanceId = null;
    lastValidStats = null;
    Logger.info('CACHE', 'Cache do jogo ao vivo limpo com sucesso');
  } catch (e) {
    Logger.warn('CACHE', 'Erro ao limpar cache', e);
  }
}

/**
 * POLLING INTELIGENTE - Adapta velocidade baseado no estado do jogo
 */
function startLivePolling(intervalMs = CONFIG.updateIntervalLive) {
  stopLivePolling(); // Limpa qualquer intervalo anterior
  
  state.currentUpdateInterval = intervalMs;
  const mode = intervalMs === CONFIG.updateIntervalLive ? 'RÁPIDO - AO VIVO' : 
               intervalMs === CONFIG.updateIntervalPreMatch ? 'MODERADO - PRÉ-JOGO' : 
               'LENTO - AGUARDANDO';
  
  Logger.info('POLLING', `Iniciando: ${intervalMs}ms (${mode})`);
  
  liveInterval = setInterval(fetchLiveData, intervalMs);
}

function stopLivePolling() {
  if (liveInterval) {
    Logger.info('POLLING', 'Parando polling automático');
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
  Logger.success('ANIMAÇÕES', 'Animações pré-carregadas');
}

document.addEventListener("DOMContentLoaded", async () => {
  Logger.success('SISTEMA', '══════════════════════════════════════');
  Logger.success('SISTEMA', 'CABULOSO NEWS - MINUTO A MINUTO v12.0');
  Logger.success('SISTEMA', '══════════════════════════════════════');
  
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
  
  Logger.success('SISTEMA', 'Sistema iniciado com sucesso!');
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
    
    // FIX: Se Worker retorna 404 = sem jogo ao vivo, limpa cache e mostra countdown
    if (response.status === 404) {
      Logger.info('STATUS', 'Worker retornou 404 — sem jogo ao vivo. Limpando cache...');
      limparCacheAoVivo();
      state.matchStarted = false;
      showNextMatchCountdown();
      startLivePolling(CONFIG.updateIntervalIdle);
      return;
    }

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    
    let data = await response.json();

    // Verifica status do cache no Worker
    const cacheStatus = response.headers.get('X-Cache');
    const matchStatus = response.headers.get('X-Match-Status');
    
    if (cacheStatus) {
      Logger.cache('CACHE', `Status: ${cacheStatus}${matchStatus ? ` | Match: ${matchStatus}` : ''}`);
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

    // 3. VERIFICA SE É RESPOSTA "SEM JOGO AO VIVO"
    if (data && (
      data.status === "sem_jogo_ao_vivo" ||
      data.error === "no_live_match" ||
      data.mensagem === "Nenhum jogo ao vivo no momento"
    )) {
      Logger.info('STATUS', 'Nenhum jogo ao vivo no momento. Limpando cache...');
      // FIX 3: Limpa localStorage para não persistir dados do jogo anterior
      limparCacheAoVivo();
      state.matchStarted = false;
      showNextMatchCountdown();
      startLivePolling(CONFIG.updateIntervalIdle);
      return;
    }

    // 4. LÓGICA INTELIGENTE DE ADAPTAÇÃO DE VELOCIDADE
    const isLiveMatch = data && data.success === true && (data.placar || data.narracao);
    const isAgenda = data && (data.status === "agenda" || data.modo_agenda === true);
    const hasError = data && data.error;

    // 🎯 DECISÃO DE VELOCIDADE
    if (hasError) {
      // ERRO: Modo super lento (60s)
      Logger.warn('API', `Erro na API: ${data.mensagem || 'Desconhecido'}. Aguardando 60s...`);
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
        Logger.info('PRÉ-JOGO', `Jogo em ${proximoJogo.minutosParaInicio}min. Polling moderado (15s).`);
        state.matchStarted = false;
        showNextMatchCountdown();
        startLivePolling(CONFIG.updateIntervalPreMatch);
      } else {
        // Mais de 30min: modo LENTO (60s)
        const tempoRestante = proximoJogo ? `${proximoJogo.minutosParaInicio}min` : 'sem data definida';
        Logger.info('AGENDA', `Próximo jogo em ${tempoRestante}. Polling lento (60s).`);
        state.matchStarted = false;
        showNextMatchCountdown();
        startLivePolling(CONFIG.updateIntervalIdle);
      }
      return;
    }

    // 5. JOGO AO VIVO! ⚽
    if (isLiveMatch) {
      // Garante polling RÁPIDO (5s)
      if (state.currentUpdateInterval !== CONFIG.updateIntervalLive) {
        Logger.match('AO VIVO', 'JOGO AO VIVO DETECTADO! Ativando polling RÁPIDO (5s)');
        state.matchStarted = true;
        startLivePolling(CONFIG.updateIntervalLive);
      }

      // 6. ATUALIZAÇÃO DOS COMPONENTES VISUAIS
      Logger.info('RENDER', 'Renderizando lances do jogo...');
      
      showLiveMatchUI();

      // Cache de estatísticas
      if (data.estatisticas && Object.keys(data.estatisticas).length > 0) {
        lastValidStats = data.estatisticas;
      }

      updateMatchState(data);
      renderMatchHeader(data.placar, data.narracao, data.informacoes);
      processarGol();
      detectarNovoLance(data);
      renderTimeline(data.narracao || []);
      renderPanelStats(lastValidStats || data.estatisticas);
      renderPanelLineups(data.escalacao);
      updateTopArbitro(data.arbitragem);
    }

  } catch (error) {
    Logger.error('API', 'Erro ao buscar dados ao vivo', error);
    
    // Em caso de erro de rede, mantém polling lento
    if (state.currentUpdateInterval !== CONFIG.updateIntervalIdle) {
      Logger.warn('API', 'Erro de rede. Reduzindo frequência...');
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
    if (!state.agendaData || !Array.isArray(state.agendaData.jogos) || state.agendaData.jogos.length === 0) {
      Logger.warn('AGENDA', 'Nenhum jogo encontrado na agenda');
      return null;
    }
    
    const proximoJogo = state.agendaData.jogos[0];
    
    // CORREÇÃO: Validação de dados da data/hora
    const dataParts = proximoJogo.data ? proximoJogo.data.split('/') : [];
    const horaParts = proximoJogo.hora ? proximoJogo.hora.split(':') : [];
    
    if (dataParts.length !== 3 || horaParts.length < 2) {
      Logger.warn('AGENDA', 'Formato de data/hora inválido', { data: proximoJogo.data, hora: proximoJogo.hora });
      return null;
    }
    
    const dia = parseInt(dataParts[0], 10);
    const mes = parseInt(dataParts[1], 10);
    const ano = parseInt(dataParts[2], 10);
    const hora = parseInt(horaParts[0], 10);
    const minuto = parseInt(horaParts[1] || 0, 10);
    
    // Valida valores numéricos
    if (!isFinite(dia) || !isFinite(mes) || !isFinite(ano) || !isFinite(hora) || !isFinite(minuto)) {
      Logger.warn('AGENDA', 'Valores de data/hora não são números válidos');
      return null;
    }
    
    // Valida faixas razoáveis
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 2000 || ano > 2100 || 
        hora < 0 || hora > 23 || minuto < 0 || minuto > 59) {
      Logger.warn('AGENDA', 'Valores de data/hora fora da faixa esperada');
      return null;
    }
    
    // CORREÇÃO: Cria a data UTC para Brasília (UTC-3)
    // A hora fornecida é em Brasília, então adicionamos 3 horas para converter para UTC
    const utcMillis = Date.UTC(ano, mes - 1, dia, hora + 3, minuto);
    const dataJogo = new Date(utcMillis);
    
    const agora = new Date();
    const minutosParaInicio = Math.floor((dataJogo - agora) / 1000 / 60);
    
    Logger.success('PRÓXIMO JOGO', `${proximoJogo.mandante} vs ${proximoJogo.visitante} - ${proximoJogo.data} ${proximoJogo.hora}`);
    
    return {
      jogo: proximoJogo,
      minutosParaInicio: minutosParaInicio
    };
    
  } catch (e) {
    Logger.error('AGENDA', 'Erro ao verificar próximo jogo', e);
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
  const matchContainer = document.getElementById("live-match-container");
  
  document.body.classList.add("live-match");
  
  if (liveSections) liveSections.style.display = "block";
  if (countdownWrapper) countdownWrapper.style.display = "none";
  
  // 🔧 CORREÇÃO: Limpa o container da agenda quando jogo ao vivo começar
  if (matchContainer) {
    matchContainer.innerHTML = "";
  }

  if (state.countdownInterval) {
    clearInterval(state.countdownInterval);
    state.countdownInterval = null;
  }
};

/**
 * EXIBE O COUNTDOWN E ESCONDE O MINUTO A MINUTO
 *
 * CORREÇÃO DA RACE CONDITION:
 * fetchLiveData() é chamado ANTES de loadAgenda(), então quando não há
 * jogo ao vivo, a agenda ainda está vazia (null). Nesse caso NÃO devemos
 * mostrar o fallback "Sem Próximos Jogos" — apenas aguardar a agenda carregar.
 * O loadAgenda() vai chamar showNextMatchCountdown() novamente com os dados.
 */
const showNextMatchCountdown = () => {
  const nextMatch = getNextMatchFromAgenda();

  if (!nextMatch) {
    // Se a agenda ainda não foi carregada (null), aguarda silenciosamente
    // sem mostrar nada — loadAgenda() chamará este método em seguida
    if (!state.agendaData) {
      Logger.info('COUNTDOWN', 'Agenda ainda não carregada, aguardando...');
      return;
    }

    // Agenda foi carregada mas realmente não tem jogos futuros
    Logger.warn('COUNTDOWN', 'Agenda carregada mas sem próximos jogos');

    const liveSections = document.getElementById("live-match-sections");
    const countdownWrapper = document.getElementById("countdown-wrapper");
    const container = document.getElementById("live-match-container");

    if (liveSections) liveSections.style.display = "none";

    // Limpa o live-match-container para não sobrepor nada
    if (container) container.innerHTML = "";

    if (countdownWrapper) {
      countdownWrapper.style.display = "block";
      // Injeta mensagem de fallback DENTRO do countdown-wrapper, não no container
      const timerEl = document.getElementById("timer-text");
      const noteEl = countdownWrapper.querySelector(".countdown-note");
      if (timerEl) timerEl.textContent = "--";
      if (noteEl) noteEl.textContent = "Nenhum jogo agendado no momento.";

      // Mostra indicação no header do card
      const headerEl = document.getElementById("next-home-name");
      const awayEl   = document.getElementById("next-away-name");
      if (headerEl) headerEl.textContent = "A definir";
      if (awayEl)   awayEl.textContent   = "A definir";
    }
    return;
  }

  const liveSections = document.getElementById("live-match-sections");
  const countdownWrapper = document.getElementById("countdown-wrapper");
  const container = document.getElementById("live-match-container");

  if (liveSections) liveSections.style.display = "none";
  // Limpa qualquer mensagem de fallback anterior no container
  if (container) container.innerHTML = "";
  if (countdownWrapper) countdownWrapper.style.display = "block";

  renderNextMatchCard(nextMatch);
  startCountdown(nextMatch.dataObj);
};

/**
 * RENDERIZA O CARD DO PRÓXIMO JOGO
 */
const renderNextMatchCard = (match) => {
  // Preenche os novos campos do card melhorado
  const nextHomeLogo = document.getElementById('next-home-logo');
  const nextHomeName = document.getElementById('next-home-name');
  const nextAwayLogo = document.getElementById('next-away-logo');
  const nextAwayName = document.getElementById('next-away-name');
  const nextCompetition = document.getElementById('next-competition');
  const nextStadium = document.getElementById('next-stadium');
  const nextDatetime = document.getElementById('next-datetime');
  
  if (nextHomeLogo) nextHomeLogo.src = match.escudo_mandante || "../assets/default-logo.png";
  if (nextHomeName) nextHomeName.textContent = match.mandante || "A definir";
  if (nextAwayLogo) nextAwayLogo.src = match.escudo_visitante || "../assets/default-logo.png";
  if (nextAwayName) nextAwayName.textContent = match.visitante || "A definir";
  if (nextCompetition) nextCompetition.textContent = match.campeonato || "Partida";
  if (nextStadium) nextStadium.textContent = match.estadio || "A definir";
  if (nextDatetime) nextDatetime.textContent = `${match.data} às ${match.hora}`;
  
  Logger.success('PRÓXIMO JOGO', `${match.mandante} vs ${match.visitante} - ${match.data} ${match.hora}`);
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
  
  // ⚽ NOVA: Posse de bola visual
  if (data.estatisticas && (data.estatisticas.posse_home || data.estatisticas.posse_away)) {
    renderPossessionBar(data.estatisticas, data.placar);
  }
  
  renderTimelineFullWidth(data.narracao);
  if (data.estatisticas && Object.keys(data.estatisticas).length > 0) {
    renderPanelStats(data.estatisticas);
  }
  updateTopArbitro(data.arbitragem);
  renderPanelLineups(data.escalacao);
}

/**
 * ⚽ NOVA FUNCIONALIDADE: Barra visual de posse de bola
 */
function renderPossessionBar(stats, placar) {
  const container = document.getElementById("live-match-container");
  if (!container || !stats) return;
  
  const posseHome = parseInt(stats.posse_home) || 50;
  const posseAway = parseInt(stats.posse_away) || 50;
  
  const possessionHTML = `
    <div class="possession-bar-container">
      <div class="possession-bar-title">
        <i class="fas fa-futbol"></i>
        <span>POSSE DE BOLA</span>
      </div>
      <div class="possession-teams">
        <span>${placar?.home_name || 'Casa'}</span>
        <span>${placar?.away_name || 'Visitante'}</span>
      </div>
      <div class="possession-bar">
        <div class="possession-home" style="width: ${posseHome}%">
          ${posseHome}%
        </div>
        <div class="possession-away" style="width: ${posseAway}%">
          ${posseAway}%
        </div>
      </div>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', possessionHTML);
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

    <div class="match-footer-info">
      <div><i class="fas fa-trophy" ></i> ${nomeCampeonato}</div>
      <div><i class="fas fa-location-dot" ></i> ${localPartida}</div>
    </div>
  </div>
`;
}

/**
 * RENDERIZA TIMELINE EM LARGURA TOTAL - NOVOS LANCES PRIMEIRO
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

  // 🎯 LANCES NOVOS PRIMEIRO - Inverte a ordem
  const lancesInvertidos = [...narracao].reverse();

  lancesInvertidos.forEach((lance, index) => {
    const item = document.createElement("div");

    let tipoClasse = "";
    let iconeHtml = lance.icone || "📝";
    const desc = lance.descricao ? lance.descricao.toLowerCase() : "";
    const tipo = (lance.tipo || "").toLowerCase();

    // Detecta tipo do lance
    if (lance.is_gol || desc.includes("gol do ") || tipo === "gol") {
      tipoClasse = "gol";
      iconeHtml = '<i class="fas fa-futbol"></i>';
    } else if (desc.includes("cartão amarelo") || desc.includes("amarelo para") || tipo === "cartão amarelo") {
      tipoClasse = "amarelo";
      iconeHtml = '<i class="fas fa-square"></i>';
    } else if (desc.includes("cartão vermelho") || desc.includes("expuls") || tipo === "cartão vermelho") {
      tipoClasse = "vermelho";
      iconeHtml = '<i class="fas fa-square"></i>';
    } else if (desc.includes("pênalti") || desc.includes("penalti") || desc.includes("penalidade")) {
      tipoClasse = "penalti";
      iconeHtml = '<i class="fas fa-bullseye"></i>';
    } else if (tipo === "substituição" || desc.includes("sai:") || desc.includes("entra:")) {
      tipoClasse = "substituicao";
      iconeHtml = '<i class="fas fa-retweet"></i>';
    } else if (tipo === "lance importante" || desc.includes("<strong>")) {
      tipoClasse = "importante";
    } else if (tipo === "resumo automático") {
      tipoClasse = "resumo";
      iconeHtml = '<i class="fas fa-list-alt"></i>';
    }

    item.className = `timeline-item-full ${tipoClasse}`;
    
    // Marca os 5 primeiros lances como "novo"
    if (index < 5) {
      item.classList.add("novo");
      // Remove a classe após 10 segundos
      setTimeout(() => {
        item.classList.remove("novo");
        item.classList.add("novo-fade");
      }, 10000);
    }

    // Extrai minuto
    let minuto = "0'";
    if (lance.minuto !== undefined && lance.minuto !== null) {
      minuto = String(lance.minuto).replace(/<[^>]*>/g, "").trim();
    }

    // Extrai período
    const periodo = lance.periodo || "";

    // Monta HTML do item
    item.innerHTML = `
      <div class="timeline-marker-full">
        <div class="timeline-icon-full">${iconeHtml}</div>
      </div>
      <div class="timeline-header-full">
        <div class="timeline-minute-full">
          ${minuto}
          ${periodo ? `<span class="timeline-periodo">${periodo}</span>` : ''}
        </div>
      </div>
      <div class="timeline-text-full">
        ${lance.descricao || 'Sem descrição'}
      </div>
      ${lance.timestamp ? `<div class="timeline-timestamp">${new Date(lance.timestamp).toLocaleTimeString('pt-BR')}</div>` : ''}
    `;
    
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

  textOverlay.classList.remove("jump", "text-amarelo", "text-vermelho", "text-penalti");
  textOverlay.innerText = "";
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  overlay.style.display = "flex";

  // ⚡ PÊNALTI: Apenas texto, SEM animação Lottie
  if (tipo === "penalti") {
    textOverlay.innerText = "⚽ PÊNALTI! ⚽";
    textOverlay.classList.add("text-penalti");
    textOverlay.classList.add("jump");
    
    // Fecha mais rápido (só texto)
    setTimeout(() => {
      textOverlay.classList.remove("jump");
      overlay.style.display = "none";
    }, 2000); // 2 segundos apenas
    
    return; // Retorna sem carregar Lottie
  }

  // Textos para outros tipos
  if (tipo === "amarelo") {
    textOverlay.innerText = "🟨 CARTÃO AMARELO";
    textOverlay.classList.add("text-amarelo");
  } else if (tipo === "vermelho") {
    textOverlay.innerText = "🟥 CARTÃO VERMELHO";
    textOverlay.classList.add("text-vermelho");
  } else if (tipo === "gol") {
    textOverlay.innerText = "⚽ GOOOOL! ⚽";
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
    // ⚡ REDUZIDO: De 4500ms para 2500ms
    setTimeout(() => {
      textOverlay.classList.remove("jump");
      overlay.style.display = "none";
  
      anim.destroy();
    }, 2500); // Animações mais rápidas!
  });  
}

/**
 * FUNÇÕES DE TESTE PARA DEBUG E DEMONSTRAÇÃO
 */
window.cabulosoTeste = {
  // ═══ ANIMAÇÕES ═══
  gol: () => {
    dispararAnimacaoFullScreen("gol");
    Logger.match('TESTE', 'Animação de GOL disparada!');
  },
  amarelo: () => {
    dispararAnimacaoFullScreen("amarelo");
    Logger.warn('TESTE', 'Animação de CARTÃO AMARELO disparada!');
  },
  vermelho: () => {
    dispararAnimacaoFullScreen("vermelho");
    Logger.error('TESTE', 'Animação de CARTÃO VERMELHO disparada!');
  },
  penalti: () => {
    dispararAnimacaoFullScreen("penalti");
    Logger.info('TESTE', 'Animação de PÊNALTI disparada!');
  },
  
  // ═══ PAINÉIS FLUTUANTES ═══
  abrirEstatisticas: () => {
    const overlay = document.getElementById("floating-overlay");
    const statsPanel = document.getElementById("stats-panel");
    if (overlay && statsPanel) {
      overlay.classList.add("active");
      statsPanel.classList.add("active");
      document.body.style.overflow = "hidden";
      Logger.success('TESTE', 'Painel de Estatísticas aberto');
    }
  },
  abrirEscalacoes: () => {
    const overlay = document.getElementById("floating-overlay");
    const lineupPanel = document.getElementById("lineup-panel");
    if (overlay && lineupPanel) {
      overlay.classList.add("active");
      lineupPanel.classList.add("active");
      document.body.style.overflow = "hidden";
      Logger.success('TESTE', 'Painel de Escalações aberto');
    }
  },
  
  // ═══ ESTADOS DE INTERFACE ═══
  mostrarProximoJogo: () => {
    state.matchStarted = false;
    showNextMatchCountdown();
    Logger.info('TESTE', 'Mostrando próximo jogo');
  },
  simularJogoAoVivo: () => {
    state.matchStarted = true;
    showLiveMatchUI();
    Logger.match('TESTE', 'Simulando jogo ao vivo');
  },
  
  // ═══ LOGS ═══
  ligarLogs: () => {
    Logger.enabled = true;
    Logger.success('TESTE', 'Logs ATIVADOS');
  },
  desligarLogs: () => {
    Logger.enabled = false;
    console.log('Logs DESATIVADOS');
  },
  
};

// Salvar dados antes de fechar/recarregar a página
window.addEventListener('beforeunload', () => {
  golControl.saveScore(golControl.lastScore);
  animationQueue.saveShownEvents();
});
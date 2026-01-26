/**
 * Cabuloso News - Minuto a Minuto
 * Acompanhamento ao vivo dos jogos do Cruzeiro
 * Versao Corrigida v3 - Ordenacao e Placar
 */

// ============================================
// CONFIGURACAO
// ============================================
const CONFIG = {
  webhookUrl: "https://spikeofino-meu-n8n-cabuloso.hf.space/webhook/placar-ao-vivo",
  agendaUrl: "backend/agenda_cruzeiro.json", // Use barras normais e caminho direto
  updateInterval: 5000,
};

// Estado da aplicacao
const state = {
  matchData: null,
  agendaData: null,
  lastGoalCount: 0,
  liveUpdateInterval: null,
  countdownInterval: null,
  teamsInfo: {
    cruzeiro: { name: "", logo: "" },
    adversario: { name: "", logo: "" },
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
// CARREGAR AGENDA DO CRUZEIRO
// ============================================
const loadAgenda = async () => {
  try {
    const response = await fetch(CONFIG.agendaUrl);
    if (response.ok) {
      state.agendaData = await response.json();
    }
  } catch (error) {
    console.error("Erro ao carregar agenda:", error);
  }
};

// ============================================
// BUSCAR PROXIMO JOGO DA AGENDA
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

    const monthMap = {
      jan: 0,
      fev: 1,
      mar: 2,
      abr: 3,
      mai: 4,
      jun: 5,
      jul: 6,
      ago: 7,
      set: 8,
      out: 9,
      nov: 10,
      dez: 11,
    };

    const month = monthMap[monthStr.substring(0, 3)];
    if (month === undefined) continue;

    const timeParts = timeStr.split(":");
    const hours = parseInt(timeParts[0]) || 0;
    const minutes = parseInt(timeParts[1]) || 0;

    const matchDate = new Date(currentYear, month, day, hours, minutes);

    if (matchDate < now) {
      matchDate.setFullYear(currentYear + 1);
    }

    if (matchDate > now) {
      return { ...match, dateObj: matchDate };
    }
  }

  return null;
};

// ============================================
// RENDERIZAR ESTADO PRE-JOGO
// ============================================
const renderPreMatchState = () => {
  const nextMatch = getNextMatch();
  const container = document.getElementById("live-match-container");

  if (!container) return;

  if (!nextMatch) {
    container.innerHTML = `
            <div class="live-match-container">
                <div class="match-header">
                    <div class="match-competition">
                        <i class="fas fa-calendar-alt"></i>
                        Aguardando próximo jogo
                    </div>
                    <div class="match-status waiting">SEM JOGOS</div>
                </div>
                <div class="pre-match-content">
                    <div class="pre-match-icon"><i class="fas fa-futbol"></i></div>
                    <h3>Nenhum jogo agendado</h3>
                </div>
            </div>
        `;
    return;
  }

  // Lógica corrigida: Respeita a ordem do JSON (Mandante vs Visitante)
  const mandanteLogo = nextMatch.escudo_mandante 
    ? `<img src="${nextMatch.escudo_mandante}" alt="${nextMatch.mandante}" class="team-logo">`
    : `<div class="team-logo-placeholder"><i class="fas fa-shield-alt"></i></div>`;

  const visitanteLogo = nextMatch.escudo_visitante
    ? `<img src="${nextMatch.escudo_visitante}" alt="${nextMatch.visitante}" class="team-logo">`
    : `<div class="team-logo-placeholder"><i class="fas fa-shield-alt"></i></div>`;

  container.innerHTML = `
        <div class="live-match-container">
            <div class="match-header">
                <div class="match-competition">
                    <i class="fas fa-trophy"></i>
                    ${nextMatch.campeonato}
                </div>
                <div class="match-status waiting">PRÓXIMO JOGO</div>
            </div>
            <div class="pre-match-content">
                <div class="countdown-container">
                    <div class="countdown-label">Faltam</div>
                    <div class="countdown-timer" id="countdown-timer">
                        <div class="countdown-unit"><span class="countdown-value" id="countdown-days">--</span><span class="countdown-text">dias</span></div>
                        <div class="countdown-separator">:</div>
                        <div class="countdown-unit"><span class="countdown-value" id="countdown-hours">--</span><span class="countdown-text">horas</span></div>
                        <div class="countdown-separator">:</div>
                        <div class="countdown-unit"><span class="countdown-value" id="countdown-minutes">--</span><span class="countdown-text">min</span></div>
                        <div class="countdown-separator">:</div>
                        <div class="countdown-unit"><span class="countdown-value" id="countdown-seconds">--</span><span class="countdown-text">seg</span></div>
                    </div>
                </div>
                <div class="pre-match-teams">
                    <div class="team">
                        ${mandanteLogo}
                        <div class="team-name">${nextMatch.mandante}</div>
                    </div>
                    <div class="pre-match-vs">
                        <span>VS</span>
                        <div class="pre-match-date">${nextMatch.data}</div>
                        <div class="pre-match-time">${nextMatch.hora}</div>
                    </div>
                    <div class="team">
                        ${visitanteLogo}
                        <div class="team-name">${nextMatch.visitante}</div>
                    </div>
                </div>
                </div>
        </div>
    `;

  startCountdown(nextMatch.dateObj);
  updateStatusIndicator("AGUARDANDO");
};

// ============================================
// COUNTDOWN
// ============================================
const startCountdown = (targetDate) => {
  if (state.countdownInterval) {
    clearInterval(state.countdownInterval);
  }

  const updateCountdown = () => {
    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) {
      clearInterval(state.countdownInterval);
      fetchLiveData();
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const daysEl = document.getElementById("countdown-days");
    const hoursEl = document.getElementById("countdown-hours");
    const minutesEl = document.getElementById("countdown-minutes");
    const secondsEl = document.getElementById("countdown-seconds");

    if (daysEl) daysEl.textContent = String(days).padStart(2, "0");
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, "0");
    if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, "0");
    if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, "0");
  };

  updateCountdown();
  state.countdownInterval = setInterval(updateCountdown, 1000);
};

// ============================================
// BUSCA DE DADOS (WEBHOOK n8n)
// ============================================
const fetchLiveData = async () => {
  try {
    const response = await fetch(`${CONFIG.webhookUrl}?t=${Date.now()}`);
    if (!response.ok) throw new Error("Erro ao buscar dados");
    
    const data = await response.json();
    
    // 1. Pega os lances e o placar do novo formato do n8n
    const lancesValidos = data.resultados || [];
    const placarReal = data.placar || { home: 0, away: 0 };

    if (lancesValidos.length > 0) {
      state.matchStarted = true;
      
      // 2. Atualiza o placar no estado (ajusta quem é home/away)
      // Se o Cruzeiro for o visitante na agenda, ele pega placarReal.away
      state.placar.cruzeiro = (state.teamsInfo.cruzeiro.name === HOME_TEAM) ? placarReal.home : placarReal.away;
      state.placar.adversario = (state.teamsInfo.cruzeiro.name === HOME_TEAM) ? placarReal.away : placarReal.home;

      // 3. Renderiza na tela
      renderLances(lancesValidos);
      updatePlacarUI();
      
      document.getElementById("loading-lances").classList.add("hidden");
    } else {
      showEmptyState();
    }
  } catch (error) {
    console.error("Erro no Webhook:", error);
    showErrorState();
  }
};

// ============================================
// ATUALIZAR TIMELINE PRE-JOGO
// ============================================
const updateTimelinePreMatch = () => {
  const container = document.getElementById("timeline-container");
  const noEventsMessage = document.getElementById("no-events-message");

  if (!container) return;

  const existingItems = container.querySelectorAll(".timeline-item");
  existingItems.forEach((item) => item.remove());

  if (noEventsMessage) {
    noEventsMessage.style.display = "block";
    noEventsMessage.innerHTML = `
            <i class="fas fa-clock"></i>
            <p>O jogo ainda nao comecou. Aguarde o inicio da partida.</p>
        `;
  }
};

// ============================================
// EXTRAIR INFORMACOES DOS TIMES DOS DADOS
// ============================================
const extractTeamsFromData = (lances) => {
  lances.forEach((lance) => {
    if (lance.lance_time && lance.lance_logo_time) {
      const nomeTime = lance.lance_time.trim();
      const isCruzeiro = nomeTime.toLowerCase().includes("cruzeiro");

      if (isCruzeiro && !state.teamsInfo.cruzeiro.logo) {
        state.teamsInfo.cruzeiro = {
          name: nomeTime.replace(/Sub-20|sub-20/gi, "").trim(),
          logo: lance.lance_logo_time,
        };
      } else if (!isCruzeiro && !state.teamsInfo.adversario.logo) {
        state.teamsInfo.adversario = {
          name: nomeTime.replace(/Sub-20|sub-20/gi, "").trim(),
          logo: lance.lance_logo_time,
        };
      }
    }
  });
};

// ============================================
// PROCESSAMENTO DOS DADOS DO JOGO
// ============================================
const processMatchData = (lances) => {
  const lancesComDescricao = lances.filter(
    (l) => l.lance_descricao && l.lance_descricao.trim() !== "",
  );

  if (lancesComDescricao.length === 0) return;

  // Contar gols analisando APENAS a descricao (forma mais confiavel)
  let golsCruzeiro = 0;
  let golsAdversario = 0;

  lancesComDescricao.forEach((l) => {
    const desc = (l.lance_descricao || "").toLowerCase();

    // Detectar se eh um lance de gol pela descricao
    const isGolDescricao =
      (desc.includes("goooo") && desc.includes("gol")) ||
      desc.includes("balança a rede") ||
      desc.includes("para abrir o marcador") ||
      desc.includes("gol contra");

    if (isGolDescricao) {
      // Verificar de qual time eh o gol
      if (desc.includes("gol contra")) {
        // Gol contra: analisar quem sofreu
        // "Bola toca nas costas de João Pedro" - João Pedro eh goleiro do São Paulo
        // Logo, eh gol PRO Cruzeiro
        if (desc.includes("joão pedro") || desc.includes("joao pedro")) {
          golsCruzeiro++;
        } else if (
          l.lance_time &&
          l.lance_time.toLowerCase().includes("cruzeiro")
        ) {
          // Se o lance_time eh Cruzeiro e eh gol contra, Cruzeiro sofreu
          golsAdversario++;
        } else {
          // Se o lance_time eh adversario e eh gol contra, adversario sofreu
          golsCruzeiro++;
        }
      } else if (desc.includes("cruzeiro") || desc.includes("cabuloso")) {
        golsCruzeiro++;
      } else if (
        desc.includes("são paulo") ||
        desc.includes("tricolor") ||
        desc.includes("sao paulo")
      ) {
        golsAdversario++;
      }
    }
  });

  state.placar.cruzeiro = golsCruzeiro;
  state.placar.adversario = golsAdversario;

  // Determinar status e tempo do jogo
  const lancesOrdenados = sortLances(lancesComDescricao);
  const ultimoLance = lancesOrdenados[0];

  let statusJogo = "AO VIVO";
  let tempoJogo = ultimoLance ? ultimoLance.lance_tipo : "";

  if (ultimoLance) {
    const tipoLower = (ultimoLance.lance_tipo || "").toLowerCase();
    const descLower = (ultimoLance.lance_descricao || "").toLowerCase();

    if (
      tipoLower.includes("fim") ||
      descLower.includes("fim de jogo") ||
      descLower.includes("apita o árbitro")
    ) {
      statusJogo = "ENCERRADO";
    } else if (
      tipoLower.includes("intervalo") ||
      descLower.includes("fim de primeiro tempo")
    ) {
      statusJogo = "INTERVALO";
    }
  }

  renderLiveMatch(statusJogo, tempoJogo);
  updateStatusIndicator(statusJogo);

  // Animacao de Gol
  const totalGols = golsCruzeiro + golsAdversario;
  if (totalGols > state.lastGoalCount && state.lastGoalCount !== 0) {
    playGoalAnimation();
  }
  state.lastGoalCount = totalGols;
};

// ============================================
// RENDERIZAR PLACAR
// ============================================
const renderLiveMatch = (status, tempo) => {
  const container = document.getElementById("live-match-container");
  if (!container) return;

  // Busca o jogo atual na agenda para saber a ordem correta
  const currentMatch = getNextMatch(); 
  
  // Define quem aparece na esquerda e direita com base na agenda
  const nomeEsquerda = currentMatch ? currentMatch.mandante : (state.teamsInfo.cruzeiro.name || "Mandante");
  const nomeDireita = currentMatch ? currentMatch.visitante : (state.teamsInfo.adversario.name || "Visitante");
  
  const logoEsquerda = currentMatch ? currentMatch.escudo_mandante : state.teamsInfo.cruzeiro.logo;
  const logoDireita = currentMatch ? currentMatch.escudo_visitante : state.teamsInfo.adversario.logo;

  // Lógica de Placar: Ajuste conforme quem é o Cruzeiro
  // Se o Cruzeiro for visitante, o placar deve ser [Gols Adversário] - [Gols Cruzeiro]
  const isCruzeiroMandante = currentMatch?.mandante.toLowerCase().includes("cruzeiro");
  const placarExibicao = isCruzeiroMandante 
    ? `${state.placar.cruzeiro} - ${state.placar.adversario}`
    : `${state.placar.adversario} - ${state.placar.cruzeiro}`;

  container.innerHTML = `
        <div class="live-match-container">
            <div class="match-header">
                <div class="match-competition">
                    <i class="fas fa-trophy"></i>
                    ${currentMatch?.campeonato || "Partida ao Vivo"}
                </div>
                <div class="match-status">${status}</div>
            </div>
            <div class="score-row">
                <div class="team">
                    <img src="${logoEsquerda}" class="team-logo">
                    <div class="team-name">${nomeEsquerda}</div>
                </div>
                <div class="score-container">
                    <div class="score">${placarExibicao}</div>
                    <div class="match-time">${tempo || "Aguardando..."}</div>
                </div>
                <div class="team">
                    <img src="${logoDireita}" class="team-logo">
                    <div class="team-name">${nomeDireita}</div>
                </div>
            </div>
        </div>
    `;
};

// ============================================
// ATUALIZAR INDICADOR DE STATUS
// ============================================
const updateStatusIndicator = (status) => {
  const statusIndicator = document.getElementById("match-status-indicator");
  if (!statusIndicator) return;

  statusIndicator.textContent = status;
  statusIndicator.className = "match-status";

  if (status === "ENCERRADO") {
    statusIndicator.classList.add("finished");
  } else if (status === "INTERVALO") {
    statusIndicator.classList.add("interval");
  } else if (status === "AGUARDANDO") {
    statusIndicator.classList.add("waiting");
  } else {
    statusIndicator.classList.add("live");
  }
};

// ============================================
// FUNCAO PARA PARSEAR MINUTAGEM
// ============================================
const parseMinuto = (lanceTipo) => {
  if (!lanceTipo) return { minuto: -999, tempo: 0, isEvento: false };

  const texto = lanceTipo.toLowerCase().trim();

  // Eventos de marco do jogo (ordem especifica)
  if (texto.includes("pré") || texto.includes("pre")) {
    return { minuto: -100, tempo: 0, isEvento: true };
  }
  if (texto.includes("começo do primeiro") || texto === "começo do 1°t") {
    return { minuto: 0, tempo: 1, isEvento: true };
  }
  if (texto.includes("intervalo")) {
    return { minuto: 46, tempo: 1, isEvento: true };
  }
  if (texto.includes("começo do segundo")) {
    return { minuto: 0, tempo: 2, isEvento: true };
  }
  if (texto.includes("fim de jogo") || texto.includes("fim")) {
    return { minuto: 100, tempo: 2, isEvento: true };
  }
  if (texto.includes("acréscimos") || texto.includes("acrescimos")) {
    // Acréscimos - verificar se eh 1T ou 2T pelo contexto
    if (texto.includes("1°t") || texto.includes("1t")) {
      return { minuto: 45, tempo: 1, isEvento: true };
    }
    return { minuto: 45, tempo: 2, isEvento: true };
  }

  // Extrair minuto e tempo (ex: "35' - 2°T", "45' - 1°T")
  const matchFull = texto.match(/(\d+)['′]?\s*[-–]?\s*(\d)[°º]?t/i);
  if (matchFull) {
    return {
      minuto: parseInt(matchFull[1]),
      tempo: parseInt(matchFull[2]),
      isEvento: false,
    };
  }

  // Apenas numero com apostrofo (ex: "35'")
  const matchSimples = texto.match(/(\d+)['′]/);
  if (matchSimples) {
    return { minuto: parseInt(matchSimples[1]), tempo: 1, isEvento: false };
  }

  // Eventos sem minuto (VAR, Falta, etc.) - manter posicao original
  return { minuto: -999, tempo: 0, isEvento: true };
};

// ============================================
// FUNCAO PARA ORDENAR LANCES
// ============================================
const sortLances = (lances) => {
  // Cria copia com indice original para manter ordem de eventos sem minuto
  const lancesComIndice = lances.map((lance, index) => ({
    ...lance,
    _originalIndex: index,
  }));

  return lancesComIndice.sort((a, b) => {
    const parseA = parseMinuto(a.lance_tipo);
    const parseB = parseMinuto(b.lance_tipo);

    // Primeiro: ordenar por tempo (2°T > 1°T > Pre)
    if (parseA.tempo !== parseB.tempo) {
      return parseB.tempo - parseA.tempo;
    }

    // Segundo: dentro do mesmo tempo, ordenar por minuto (maior primeiro)
    if (parseA.minuto !== parseB.minuto) {
      return parseB.minuto - parseA.minuto;
    }

    // Terceiro: se mesmo minuto, manter ordem original (indice menor = mais recente no array original)
    return a._originalIndex - b._originalIndex;
  });
};

// ============================================
// ATUALIZAR TIMELINE (MINUTO A MINUTO)
// ============================================
const updateTimeline = (lances) => {
  const container = document.getElementById("timeline-container");
  const noEventsMessage = document.getElementById("no-events-message");

  if (!container) return;

  // Filtra lances validos (com descricao)
  const lancesValidos = lances.filter(
    (l) => l.lance_descricao && l.lance_descricao.trim() !== "",
  );

  if (lancesValidos.length === 0) {
    if (noEventsMessage) noEventsMessage.style.display = "block";
    return;
  }

  if (noEventsMessage) noEventsMessage.style.display = "none";

  // Limpa container
  const existingItems = container.querySelectorAll(".timeline-item");
  existingItems.forEach((item) => item.remove());

  // Ordenar lances (mais recente primeiro)
  const lancesOrdenados = sortLances(lancesValidos);

  // Criar elementos da timeline
  lancesOrdenados.forEach((lance, index) => {
    const desc = (lance.lance_descricao || "").toLowerCase();
    const isGol =
      desc.includes("goooo") ||
      desc.includes("balança a rede") ||
      desc.includes("gol contra");
    const isCruzeiro =
      lance.lance_time && lance.lance_time.toLowerCase().includes("cruzeiro");

    const item = document.createElement("div");
    item.className = "timeline-item";

    if (isGol) item.classList.add("goal-event");
    if (lance.lance_time) {
      item.classList.add(
        isCruzeiro ? "timeline-cruzeiro" : "timeline-adversario",
      );
    }

    // Logo do time (so mostrar se existir)
    const logoHtml = lance.lance_logo_time
      ? `<img src="${lance.lance_logo_time}" alt="${lance.lance_time || "Time"}" class="timeline-team-logo">`
      : "";

    // Tipo do lance para exibicao
    const tipoDisplay = getTipoDisplay(lance.lance_tipo, desc);

    item.innerHTML = `
            <div class="timeline-time">${lance.lance_tipo || ""}</div>
            <div class="timeline-content">
                <div class="timeline-header">
                    ${logoHtml}
                    <span class="timeline-type">${tipoDisplay}</span>
                </div>
                <div class="timeline-desc">${lance.lance_descricao}</div>
                ${lance.lance_time ? `<div class="timeline-team">${lance.lance_time}</div>` : ""}
            </div>
        `;

    // Animacao de entrada
    item.style.opacity = "0";
    item.style.transform = "translateY(-10px)";
    container.appendChild(item);

    setTimeout(() => {
      item.style.transition = "all 0.3s ease";
      item.style.opacity = "1";
      item.style.transform = "translateY(0)";
    }, index * 20);
  });
};

// ============================================
// OBTER TIPO PARA EXIBICAO
// ============================================
const getTipoDisplay = (lanceTipo, descLower) => {
  if (!lanceTipo) return "Lance";

  const tipo = lanceTipo.toLowerCase();

  if (descLower.includes("goooo") || descLower.includes("balança a rede"))
    return "GOL";
  if (descLower.includes("gol contra")) return "GOL CONTRA";
  if (tipo.includes("fim de jogo") || tipo.includes("fim"))
    return "FIM DE JOGO";
  if (tipo.includes("intervalo")) return "INTERVALO";
  if (tipo.includes("começo")) return "INICIO";
  if (tipo.includes("acréscimos") || tipo.includes("acrescimos"))
    return "ACRESCIMOS";
  if (tipo.includes("var")) return "VAR";
  if (tipo.includes("pré") || tipo.includes("pre")) return "PRE-JOGO";

  // Se tem minuto, mostrar o tipo original
  const matchMinuto = tipo.match(/\d+['′]?\s*[-–]?\s*\d[°º]?t/i);
  if (matchMinuto) {
    // Verificar descricao para tipo especifico
    if (descLower.includes("substituição") || descLower.includes("entra:"))
      return "SUBSTITUICAO";
    if (descLower.includes("cartão amarelo")) return "CARTAO AMARELO";
    if (descLower.includes("cartão vermelho")) return "CARTAO VERMELHO";
    if (descLower.includes("falta")) return "FALTA";
    if (descLower.includes("escanteio")) return "ESCANTEIO";
    if (descLower.includes("impedimento")) return "IMPEDIMENTO";
    if (descLower.includes("defesa")) return "DEFESA";
    return "LANCE";
  }

  return lanceTipo;
};

// ============================================
// ANIMACAO DE GOL
// ============================================
const playGoalAnimation = () => {
  const goalAnimation = document.getElementById("goal-animation");
  if (!goalAnimation) return;

  goalAnimation.classList.add("active");

  setTimeout(() => {
    goalAnimation.classList.remove("active");
  }, 3000);
};

// ============================================
// ESTADO DE ERRO
// ============================================
const showErrorState = () => {
  const container = document.getElementById("live-match-container");
  if (!container) return;

  container.innerHTML = `
        <div class="live-match-container">
            <div class="match-header">
                <div class="match-competition">
                    <i class="fas fa-exclamation-triangle"></i>
                    Erro ao carregar dados
                </div>
            </div>
            <div style="padding: 3rem; text-align: center; color: #64748b;">
                <i class="fas fa-wifi" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                <p>Nao foi possivel conectar ao servidor.</p>
                <p>Tentando reconectar automaticamente...</p>
            </div>
        </div>
    `;
};

// ============================================
// CONTROLE DE ATUALIZACOES
// ============================================
const startLiveUpdates = () => {
  if (state.liveUpdateInterval) clearInterval(state.liveUpdateInterval);
  state.liveUpdateInterval = setInterval(fetchLiveData, CONFIG.updateInterval);
};

const stopLiveUpdates = () => {
  if (state.liveUpdateInterval) clearInterval(state.liveUpdateInterval);
  if (state.countdownInterval) clearInterval(state.countdownInterval);
};

// ============================================
// NAVEGACAO MOBILE
// ============================================
const initNavigation = () => {
  const menuToggle = document.getElementById("menuToggle");
  const navMenu = document.getElementById("nav-menu");

  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => {
      navMenu.classList.toggle("active");
      const isExpanded = navMenu.classList.contains("active");
      menuToggle.setAttribute("aria-expanded", isExpanded);
    });

    navMenu.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        navMenu.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }
};

// Expor funcoes globalmente
window.fetchLiveData = fetchLiveData;
window.playGoalAnimation = playGoalAnimation;

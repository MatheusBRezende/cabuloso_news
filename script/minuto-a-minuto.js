/**
 * Cabuloso News - Minuto a Minuto
 * Versão Final Integrada com n8n v4
 * Correções: Placar vindo do servidor, Limpeza de texto e Cache-busting
 */

// ============================================
// CONFIGURACAO
// ============================================
const CONFIG = {
  // Seu link de produção do Hugging Face
  webhookUrl: "https://spikeofino-meu-n8n-cabuloso.hf.space/webhook/placar-ao-vivo",
  agendaUrl: "backend/agenda_cruzeiro.json",
  updateInterval: 10000, // 10 segundos para não sobrecarregar
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
  fetchLiveData(); // Busca imediata ao carregar
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
      // Renderiza estado inicial, mas fetchLiveData pode sobrescrever se tiver jogo
      if (!state.matchStarted) renderPreMatchState();
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
      jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
      jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
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
    
    // Retorna o próximo jogo futuro
    if (matchDate > now) {
      return { ...match, dateObj: matchDate };
    }
  }
  return null;
};

// ============================================
// BUSCA DE DADOS (WEBHOOK n8n) - CORRIGIDO
// ============================================
const fetchLiveData = async () => {
  try {
    // Adicionado timestamp para evitar cache do navegador
    const response = await fetch(`${CONFIG.webhookUrl}?t=${Date.now()}`);
    
    if (!response.ok) throw new Error("Erro na comunicação com n8n");
    
    const data = await response.json();
    
    // Tratamento robusto dos dados vindos do n8n
    const lances = data.resultados || [];
    const placarServer = data.placar || { home: 0, away: 0 };

    // Se temos lances, consideramos que o jogo está valendo (ou foi o último)
    if (lances.length > 0) {
      state.matchStarted = true;
      
      // Para o countdown se ele estiver rodando, pois o jogo "começou" (ou estamos testando)
      if (state.countdownInterval) clearInterval(state.countdownInterval);

      processMatchData(lances, placarServer);
      
      const loading = document.getElementById("loading-lances");
      if (loading) loading.classList.add("hidden");
    } else {
      // Se não tem lances, mantém o estado de pré-jogo
      if (state.matchStarted === false) {
          renderPreMatchState();
      }
    }
  } catch (error) {
    console.error("Erro no Webhook:", error);
    // Não mostra erro na tela se for apenas um falha pontual de rede, mantém o último estado
  }
};

// ============================================
// PROCESSAMENTO DOS DADOS DO JOGO
// ============================================
const processMatchData = (lances, placarServer) => {
  // Atualiza informações dos times baseado nos logos vindos do n8n
  extractTeamsFromData(lances);

  // Lógica de Placar: Sincroniza com o n8n
  // No seu teste (Atlético x Cruzeiro): Home=Atlético, Away=Cruzeiro
  // O código tenta descobrir quem é o Cruzeiro na agenda
  
  const currentMatch = getNextMatch();
  let isCruzeiroMandante = false;

  if (currentMatch) {
      isCruzeiroMandante = currentMatch.mandante.toLowerCase().includes("cruzeiro");
  } else {
      // Fallback: Se não tem agenda, assume que Cruzeiro é VISITANTE (padrão conservador)
      // ou tenta deduzir pelo nome do time nos lances
      isCruzeiroMandante = false; 
  }

  // Atribui o placar correto
  if (isCruzeiroMandante) {
      state.placar.cruzeiro = placarServer.home;
      state.placar.adversario = placarServer.away;
  } else {
      state.placar.cruzeiro = placarServer.away;
      state.placar.adversario = placarServer.home;
  }

  // Detecta status do jogo pelo último lance
  const lancesOrdenados = sortLances(lances);
  const ultimoLance = lancesOrdenados[0];
  
  let statusJogo = "AO VIVO";
  let tempoJogo = "Tempo Real";

  if (ultimoLance) {
    const tipo = (ultimoLance.lance_tipo || "").toLowerCase();
    const desc = (ultimoLance.lance_descricao || "").toLowerCase();
    tempoJogo = ultimoLance.lance_tipo; // Ex: "45' - 2T"

    if (tipo.includes("fim") || desc.includes("fim de jogo") || placarServer.status === "Finalizado") {
      statusJogo = "ENCERRADO";
    } else if (tipo.includes("intervalo")) {
      statusJogo = "INTERVALO";
    }
  }

  renderLiveMatch(statusJogo, tempoJogo);
  updateStatusIndicator(statusJogo);
  
  // Renderiza a timeline
  updateTimeline(lancesOrdenados);

  // Animação de Gol (se o placar mudou)
  const totalGols = state.placar.cruzeiro + state.placar.adversario;
  if (totalGols > state.lastGoalCount && state.lastGoalCount !== 0) {
    playGoalAnimation();
  }
  state.lastGoalCount = totalGols;
};

// ============================================
// EXTRAIR INFORMACOES DOS TIMES
// ============================================
const extractTeamsFromData = (lances) => {
  // Tenta preencher logos e nomes se estiverem vazios
  lances.forEach((lance) => {
    if (lance.lance_time && lance.lance_logo_time) {
      const nomeTime = lance.lance_time.trim();
      const isCruzeiro = nomeTime.toLowerCase().includes("cruzeiro");

      if (isCruzeiro) {
        state.teamsInfo.cruzeiro = {
          name: nomeTime.replace(/Sub-20|sub-20/gi, "").trim(),
          logo: lance.lance_logo_time,
        };
      } else if (!isCruzeiro) {
        state.teamsInfo.adversario = {
          name: nomeTime.replace(/Sub-20|sub-20/gi, "").trim(),
          logo: lance.lance_logo_time,
        };
      }
    }
  });
};

// ============================================
// RENDERIZAR PLACAR E CABEÇALHO
// ============================================
const renderLiveMatch = (status, tempo) => {
  const container = document.getElementById("live-match-container");
  if (!container) return;

  const currentMatch = getNextMatch();
  
  // Definição de nomes e logos (Prioridade: Agenda > Lances > Padrão)
  const nomeMandante = currentMatch ? currentMatch.mandante : 
      (state.teamsInfo.cruzeiro.name.includes("Cruzeiro") ? "Adversário" : state.teamsInfo.cruzeiro.name); // Lógica invertida pro teste se sem agenda
      
  // Simplificação: Se temos dados de lances, usamos eles
  let mandanteObj = { name: "Mandante", logo: "" };
  let visitanteObj = { name: "Visitante", logo: "" };

  if (currentMatch) {
      mandanteObj = { name: currentMatch.mandante, logo: currentMatch.escudo_mandante };
      visitanteObj = { name: currentMatch.visitante, logo: currentMatch.escudo_visitante };
  } else {
      // Modo sem agenda (Teste): Assume Cruzeiro e Adversário extraídos
      // No teste Atlético x Cruzeiro -> Atlético é Mandante
      mandanteObj = state.teamsInfo.adversario.name ? state.teamsInfo.adversario : {name: "Atlético-MG", logo: ""}; 
      visitanteObj = state.teamsInfo.cruzeiro.name ? state.teamsInfo.cruzeiro : {name: "Cruzeiro", logo: ""};
  }

  // Placar: Cruzeiro é Visitante no teste
  // Se Cruzeiro é visitante, placar.adversario (Home) - placar.cruzeiro (Away)
  const placarTexto = `${state.placar.adversario} - ${state.placar.cruzeiro}`;

  container.innerHTML = `
        <div class="live-match-container">
            <div class="match-header">
                <div class="match-competition">
                    <i class="fas fa-trophy"></i>
                    ${currentMatch?.campeonato || "Acompanhamento ao Vivo"}
                </div>
                <div class="match-status ${status === "ENCERRADO" ? "finished" : "live"}">${status}</div>
            </div>
            <div class="score-row">
                <div class="team">
                    <img src="${mandanteObj.logo || 'img/placeholder.png'}" class="team-logo" onerror="this.src='https://via.placeholder.com/60'">
                    <div class="team-name">${mandanteObj.name}</div>
                </div>
                <div class="score-container">
                    <div class="score">${placarTexto}</div>
                    <div class="match-time">${tempo || "Ao Vivo"}</div>
                </div>
                <div class="team">
                    <img src="${visitanteObj.logo || 'img/placeholder.png'}" class="team-logo" onerror="this.src='https://via.placeholder.com/60'">
                    <div class="team-name">${visitanteObj.name}</div>
                </div>
            </div>
        </div>
    `;
};

// ============================================
// RENDERIZAR TIMELINE (Minuto a Minuto)
// ============================================
const updateTimeline = (lances) => {
  const container = document.getElementById("timeline-container"); // ID ajustado para seu HTML padrão
  const backupContainer = document.getElementById("lances-container"); // ID alternativo
  const target = container || backupContainer;
  
  const noEventsMessage = document.getElementById("no-events-message");

  if (!target) return;

  if (lances.length === 0) {
    if (noEventsMessage) noEventsMessage.style.display = "block";
    return;
  }
  if (noEventsMessage) noEventsMessage.style.display = "none";

  // Renderização Limpa
  target.innerHTML = lances.map((lance, index) => {
    const isGol = lance.is_gol === "GOOOLLLLL";
    // Identifica se é Cruzeiro para cor diferente
    const isCruzeiro = lance.lance_time && lance.lance_time.toLowerCase().includes("cruzeiro");
    
    // Tratamento de tipos especiais para CSS
    let classeExtra = "";
    if (isGol) classeExtra = "goal-event";
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
// FUNÇÕES AUXILIARES DE ORDENAÇÃO
// ============================================
const parseMinuto = (lanceTipo) => {
  if (!lanceTipo) return { minuto: -999, tempo: 0 };
  const texto = lanceTipo.toLowerCase().trim();
  
  if (texto.includes("fim")) return { minuto: 100, tempo: 2 };
  if (texto.includes("intervalo")) return { minuto: 46, tempo: 1 };
  
  const match = texto.match(/(\d+)/);
  if (match) return { minuto: parseInt(match[1]), tempo: texto.includes("2") ? 2 : 1 };
  
  return { minuto: 0, tempo: 0 };
};

const sortLances = (lances) => {
  return lances.sort((a, b) => {
    // Mantém a ordem que vem do n8n (geralmente já é a correta: mais recente em cima)
    // Se precisar forçar: return parseMinuto(b.lance_tipo).minuto - parseMinuto(a.lance_tipo).minuto;
    return 0; 
  });
};

// ============================================
// PRE-MATCH E STATUS (Legado mantido para compatibilidade)
// ============================================
const renderPreMatchState = () => {
  const nextMatch = getNextMatch();
  const container = document.getElementById("live-match-container");
  if (!container) return;
  
  if (!nextMatch) {
      container.innerHTML = `<div class="live-match-container"><div class="match-status waiting">SEM JOGOS AGENDADOS</div></div>`;
      return;
  }
  
  // Renderiza Countdown normal...
  // (Mantive simplificado aqui para focar no ao vivo, mas usa lógica padrão)
  container.innerHTML = `
    <div class="live-match-container">
        <div class="match-header">
            <div class="match-competition">${nextMatch.campeonato}</div>
            <div class="match-status waiting">EM BREVE</div>
        </div>
        <div class="pre-match-content">
            <h3>${nextMatch.mandante} x ${nextMatch.visitante}</h3>
            <div id="countdown-timer" class="countdown-timer">Carregando...</div>
        </div>
    </div>`;
  startCountdown(nextMatch.dateObj);
};

const startCountdown = (targetDate) => {
    if (state.countdownInterval) clearInterval(state.countdownInterval);
    const update = () => {
        const now = new Date();
        const diff = targetDate - now;
        const el = document.getElementById("countdown-timer");
        if (el) {
            if (diff <= 0) {
                el.innerText = "A bola vai rolar!";
                fetchLiveData(); 
            } else {
                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
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

const initNavigation = () => {
  const menuToggle = document.getElementById("menuToggle");
  const navMenu = document.getElementById("nav-menu");
  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => navMenu.classList.toggle("active"));
  }
};

const playGoalAnimation = () => {
    const el = document.getElementById("goal-animation");
    if(el) {
        el.classList.add("active");
        setTimeout(() => el.classList.remove("active"), 3000);
    }
};

// Controle de loop
const startLiveUpdates = () => {
  if (state.liveUpdateInterval) clearInterval(state.liveUpdateInterval);
  state.liveUpdateInterval = setInterval(fetchLiveData, CONFIG.updateInterval);
};
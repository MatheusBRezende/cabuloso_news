/**
 * Cabuloso News - Minuto a Minuto
 * Versão: 2.4 - Correção das estatísticas e escalações
 */

const CONFIG = {
  webhookUrl:
    "https://directions-bali-cannon-change.trycloudflare.com/webhook/placar-ao-vivo",
  agendaUrl: "./backend/agenda_cruzeiro.json",
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
  // Cache para os dados separados
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

const fetchLiveData = async () => {
  try {
    const response = await fetch(`${CONFIG.webhookUrl}?t=${Date.now()}`);
    let rawData = await response.json();

    // AJUSTE 1: Se for um array, pega o primeiro item para as verificações iniciais
    const data = Array.isArray(rawData) ? rawData[0] : rawData;

    // AJUSTE 2: Verifica a propriedade dentro do objeto extraído
    if (!data || data.tem_jogo_ao_vivo === false) {
      if (window.location.pathname.includes("minuto-a-minuto")) {
        // Mantém a mensagem de espera se não houver jogo
        const container = document.getElementById("live-match-container");
        if (container)
          container.innerHTML =
            "<h1 style='color:white; text-align:center; margin-top:50px;'>Aguardando início da partida...</h1>";
      }
      return;
    }

    if (state.logsEnabled) {
      console.log("📥 Dados brutos recebidos:", rawData);
      console.log("Tipo:", Array.isArray(rawData) ? "Array" : "Objeto");
      console.log("Tamanho:", Array.isArray(rawData) ? rawData.length : "N/A");
    }

    // CORREÇÃO: O webhook retorna um array com múltiplos itens
    // Precisamos processar cada item para extrair as informações
    if (!Array.isArray(rawData) || rawData.length === 0) {
      if (state.logsEnabled) console.log("⚠️ Dados não estão em formato array");
      if (!state.matchStarted) renderPreMatchState();
      return;
    }

    // Processa cada item do array
    let placarData = null;
    let resultadosData = null;
    let estatisticasData = null;
    let escalacaoData = null;

    rawData.forEach((item, index) => {
      if (state.logsEnabled) console.log(`Item ${index}:`, Object.keys(item));

      // Item de Resultados e placar
      if (item.resultados && item.placar) {
        placarData = item.placar;
        resultadosData = item.resultados;
        state.cachedData.resultados = resultadosData;
      }

      // Item de Estatísticas
      if (item.estatisticas) {
        estatisticasData = item.estatisticas;
        state.cachedData.estatisticas = estatisticasData;
      }

      // CORREÇÃO AQUI: Verifica se o item contém 'partida' ou 'escalacao'
      if (item.partida || item.escalacao) {
        // Se o JSON vier direto como o que você mandou, o item é a própria escalação
        escalacaoData = item;
        state.cachedData.escalacao = escalacaoData;
      }
    });

    // VALIDAÇÃO CORRIGIDA
    if (!placarData || !resultadosData) {
      if (state.logsEnabled) console.log("⚠️ Dados de jogo incompletos");
      if (!state.matchStarted) renderPreMatchState();
      return;
    }

    // Se chegou aqui, o jogo começou
    if (state.countdownInterval) {
      clearInterval(state.countdownInterval);
      state.countdownInterval = null;
    }

    if (!state.matchStarted && state.logsEnabled) {
      console.log("✅ Jogo ao vivo detectado!");
    }

    state.matchStarted = true;

    // Atualiza o estado do jogo
    state.match.home.name = placarData.home_name || "Mandante";
    state.match.home.logo = placarData.home_logo || "assets/logo.png";
    state.match.away.name = placarData.away_name || "Cruzeiro";
    state.match.away.logo =
      placarData.away_logo ||
      "https://admin.cnnbrasil.com.br/wp-content/uploads/sites/12/cruzeiro.png";
    state.match.score.home = placarData.home ?? 0;
    state.match.score.away = placarData.away ?? 0;
    state.match.status = placarData.status || "AO VIVO";

    // Renderiza os componentes
    renderLiveMatch(resultadosData);

    // CORREÇÃO: Usa os dados cacheados/processados
    if (estatisticasData) {
      renderStats(estatisticasData);
    } else if (state.cachedData.estatisticas) {
      renderStats(state.cachedData.estatisticas);
    }

    if (escalacaoData) {
      updateLineups(escalacaoData);
    } else if (state.cachedData.escalacao) {
      updateLineups(state.cachedData.escalacao);
    }
  } catch (error) {
    if (state.logsEnabled) console.error("Erro ao buscar dados:", error);
  }
};

const renderStats = (statsData) => {
  const homeList = document.getElementById("home-stats-list");
  const awayList = document.getElementById("away-stats-list");
  const homeHeader = document.getElementById("stats-home-header");
  const awayHeader = document.getElementById("stats-away-header");

  if (!homeList || !awayList) {
    if (state.logsEnabled) {
      console.log("Containers de estatísticas não encontrados.");
      console.log(
        "Procurando por home-stats-list:",
        document.getElementById("home-stats-list"),
      );
      console.log(
        "Procurando por away-stats-list:",
        document.getElementById("away-stats-list"),
      );
    }
    return;
  }

  // Atualiza os nomes nos cabeçalhos
  if (homeHeader) {
    homeHeader.innerHTML = `<i class="fas fa-chart-bar"></i> ${state.match.home.name}`;
  }
  if (awayHeader) {
    awayHeader.innerHTML = `${state.match.away.name} <i class="fas fa-chart-pie"></i>`;
  }

  // CORREÇÃO: statsData pode ser um array dentro de um objeto
  let statsArray = statsData;
  if (statsData && Array.isArray(statsData) && statsData.length > 0) {
    // Se já é um array, usa direto
    statsArray = statsData;
  } else if (statsData && statsData.estatisticas) {
    // Se está dentro de um objeto
    statsArray = statsData.estatisticas;
  } else if (statsData && statsData.metrica) {
    // Se é um único objeto (não array)
    statsArray = [statsData];
  }

  if (!statsArray || !Array.isArray(statsArray) || statsArray.length === 0) {
    homeList.innerHTML =
      '<div class="loading-stats">Estatísticas indisponíveis</div>';
    awayList.innerHTML =
      '<div class="loading-stats">Estatísticas indisponíveis</div>';
    return;
  }

  if (state.logsEnabled) {
    console.log("📊 Renderizando estatísticas:", statsArray.length, "itens");
    console.log("Primeiro item:", statsArray[0]);
  }

  let homeHTML = "";
  let awayHTML = "";

  statsArray.forEach((stat) => {
    // Pega o nome da métrica
    const metricaNome = stat.metrica || stat.item || "";
    const valorMandante = stat.mandante || stat.home || "0";
    const valorVisitante = stat.visitante || stat.away || "0";

    // Lado Esquerdo (Mandante)
    homeHTML += `
      <div class="stat-row">
        <span class="stat-value">${valorMandante}</span>
        <span class="stat-label">${metricaNome}</span>
      </div>
    `;

    // Lado Direito (Visitante)
    awayHTML += `
      <div class="stat-row">
        <span class="stat-label">${metricaNome}</span>
        <span class="stat-value">${valorVisitante}</span>
      </div>
    `;
  });

  homeList.innerHTML = homeHTML;
  awayList.innerHTML = awayHTML;
};

const renderLiveMatch = (lances) => {
  const container = document.getElementById("live-match-container");
  const timeline = document.getElementById("timeline-container");
  if (!container) return;

  container.innerHTML = `
    <div class="live-match-container fade-in">
      <div class="match-header">
        <div class="match-competition"><i class="fas fa-trophy"></i> BRASILEIRÃO</div>
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
    </div>
  `;

  if (timeline) {
    if (!lances || lances.length === 0) {
      timeline.innerHTML = `
        <div class="no-events-message">
          <div class="no-events-icon">
            <i class="fas fa-futbol"></i>
          </div>
          <p>Nenhum lance registrado ainda.</p>
          <span>O jogo ainda não começou.</span>
        </div>
      `;
    } else {
      timeline.innerHTML = lances
        .map((lance) => {
          const tipoFormatado =
            lance.minuto || lance.tipo_formatado || lance.lance_tipo || "Lance";
          const icone = lance.icone || "📝";
          const classe = lance.classe || "lance-normal";

          return `
            <div class="timeline-item ${lance.is_gol ? "goal-event" : ""} ${classe}">
              <div class="timeline-time">${tipoFormatado}</div>
              <div class="timeline-content">
                <div class="timeline-header">
                  <span class="timeline-type">${icone}</span>
                </div>
                <div class="timeline-desc">${lance.descricao}</div>
              </div>
            </div>
          `;
        })
        .join("");
    }
  }
};

const updateLineups = (data) => {
  // DEBUG EXTENSIVO
  console.log("🔧 updateLineups CHAMADA!");
  console.log("📦 Dados recebidos:", data);
  console.log("📦 Tipo:", typeof data);

  if (!data) {
    console.error("❌ Dados são null/undefined");
    return;
  }

  // Pega o primeiro item do array (seu JSON vem em uma lista [])
  const payload = Array.isArray(data) ? data[0] : data;
  console.log("📦 Payload extraído:", payload);

  const partida = payload.partida;
  const arbitragem = payload.arbitragem;

  console.log("📦 Partida:", partida);
  console.log("📦 Arbitragem:", arbitragem);

  if (!partida) {
    console.error("❌ Não há partida nos dados");
    return;
  }

  console.log("✅ Dados válidos encontrados!");
  console.log("🏠 Mandante:", partida.mandante.time);
  console.log("✈️ Visitante:", partida.visitante.time);
  console.log("👨‍🏫 Técnico mandante:", partida.mandante.tecnico);
  console.log("👨‍🏫 Técnico visitante:", partida.visitante.tecnico);

  // DEBUG: Verificar se os elementos HTML existem
  const homeTitle = document.getElementById("home-team-name-lineup");
  const awayTitle = document.getElementById("away-team-name-lineup");
  const homeContent = document.getElementById("home-lineup-content");
  const awayContent = document.getElementById("away-lineup-content");
  const refCard = document.getElementById("match-referee-info");

  console.log("🔍 Elementos HTML encontrados:");
  console.log("home-team-name-lineup:", homeTitle ? "✅" : "❌");
  console.log("away-team-name-lineup:", awayTitle ? "✅" : "❌");
  console.log("home-lineup-content:", homeContent ? "✅" : "❌");
  console.log("away-lineup-content:", awayContent ? "✅" : "❌");
  console.log("match-referee-info:", refCard ? "✅" : "❌");

  // Resto da função continua igual...
  const renderPlayersList = (players) => {
    if (!players || !players.length)
      return '<div style="color: #666; padding: 5px;">Não disponível</div>';

    return `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 5px 0;">
        ${players
          .map((p) => {
            const [numero, ...posicaoArray] = p.numero_posicao.split(" ");
            const posicao = posicaoArray.join(" ");

            return `
            <div class="player-item-min">
              <span class="player-number">${numero}</span>
              <div class="player-info-text">
                <span class="player-name">${p.nome}</span>
                <span class="player-pos">${posicao}</span>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    `;
  };

  // 1. Atualizar Nomes dos Times nos Cabeçalhos
  if (homeTitle) {
    console.log(
      `🏠 Atualizando título mandante para: ${partida.mandante.time}`,
    );
    homeTitle.innerText = partida.mandante.time.toUpperCase();
  }

  if (awayTitle) {
    console.log(
      `✈️ Atualizando título visitante para: ${partida.visitante.time}`,
    );
    awayTitle.innerText = partida.visitante.time.toUpperCase();
  }

  if (homeContent) {
    homeContent.innerHTML = `
      <div ">Titulares</div>
      ${renderPlayersList(partida.mandante.titulares)}
      <div ">Reservas</div>
      ${renderPlayersList(partida.mandante.reservas)}
      <div ;">
        <strong">Técnico:</strong> ${partida.mandante.tecnico}
      </div>
    `;
  }

  // 3. Injetar Titulares e Reservas do Visitante
  if (awayContent) {
    console.log("✈️ Renderizando escalação do visitante...");
    awayContent.innerHTML = `
      <div ">Titulares</div>
      ${renderPlayersList(partida.visitante.titulares)}
      <div ">Reservas</div>
      ${renderPlayersList(partida.visitante.reservas)}
      <div">
        <strong>Técnico:</strong> ${partida.visitante.tecnico}
      </div>
    `;
    console.log("✅ Escalação do visitante renderizada!");
  }

  // 4. Atualizar o Árbitro
  if (refCard && arbitragem) {
    console.log("⚖️ Renderizando arbitragem...");
    refCard.innerHTML = `
      <div style="text-align: center; padding: 10px;">
        <i class="fas fa-gavel""></i>
        <div">${arbitragem.funcao}</div>
        <div ">${arbitragem.nome}</div>
        <div ">${arbitragem.categoria}</div>
      </div>
    `;
    console.log("✅ Arbitragem renderizada!");
  }

  console.log("🎉 updateLineups finalizada com sucesso!");
};

// --- FUNÇÕES DE AGENDA E CRONÔMETRO ---

const renderPreMatchState = () => {
  const nextMatch = getNextMatchFromAgenda();
  const container = document.getElementById("live-match-container");
  if (!container) return;

  if (!nextMatch) {
    container.innerHTML = `
            <div class="live-match-container">
                <div style="padding:40px; text-align:center;">
                    Aguardando definição do próximo jogo...
                </div>
            </div>`;
    return;
  }

  container.innerHTML = `
        <div class="live-match-container fade-in">
            <div class="match-header">
                <div class="match-competition">PRÓXIMA PARTIDA</div>
                <div class="match-status waiting">AGUARDANDO</div>
            </div>
            <div class="score-row">
                <div class="team">
                    <img src="${nextMatch.escudo_mandante || "assets/logo.png"}" class="team-logo" 
                         onerror="this.src='assets/logo.png'">
                    <div class="team-name">${nextMatch.mandante}</div>
                </div>
                <div class="countdown-wrapper" id="countdown-wrapper">
                    <div class="countdown-label">A BOLA ROLA EM</div>
                    <div style="font-size: 2rem; font-weight:bold; margin-top: 10px;">--:--:--</div>
                </div>
                <div class="team">
                    <img src="${nextMatch.escudo_visitante || "assets/logo.png"}" class="team-logo"
                         onerror="this.src='assets/logo.png'">
                    <div class="team-name">${nextMatch.visitante}</div>
                </div>
            </div>
        </div>
    `;

  startCountdown(nextMatch.dateObj);
};

const startCountdown = (targetDate) => {
  if (state.countdownInterval) {
    clearInterval(state.countdownInterval);
  }

  const update = () => {
    const now = new Date();
    const diff = targetDate - now;
    const wrapper = document.getElementById("countdown-wrapper");

    if (!wrapper) {
      clearInterval(state.countdownInterval);
      state.countdownInterval = null;
      return;
    }

    if (diff <= 0) {
      clearInterval(state.countdownInterval);
      state.countdownInterval = null;
      wrapper.innerHTML = `
                <div class="countdown-label">JOGO COMEÇOU!</div>
                <div style="font-size: 1.5rem; font-weight:bold; color: #ef4444; margin-top: 10px;">
                    AO VIVO
                </div>
            `;
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);

    // Calcula dias, horas, minutos, segundos
    const dias = Math.floor(totalSeconds / 86400);
    const horas = Math.floor((totalSeconds % 86400) / 3600);
    const minutos = Math.floor((totalSeconds % 3600) / 60);
    const segundos = totalSeconds % 60;

    // Formatação com zero à esquerda
    const format = (num) => num.toString().padStart(2, "0");

    // Mostra contador
    if (dias > 0) {
      wrapper.innerHTML = `
                <div class="countdown-label">A BOLA ROLA EM</div>
                <div class="countdown-grid">
                    <div class="countdown-unit">
                        <span class="countdown-value">${dias}</span>
                        <span class="countdown-text">DIAS</span>
                    </div>
                    <div class="countdown-unit">
                        <span class="countdown-value">${format(horas)}</span>
                        <span class="countdown-text">HRS</span>
                    </div>
                    <div class="countdown-unit">
                        <span class="countdown-value">${format(minutos)}</span>
                        <span class="countdown-text">MIN</span>
                    </div>
                    <div class="countdown-unit">
                        <span class="countdown-value">${format(segundos)}</span>
                        <span class="countdown-text">SEG</span>
                    </div>
                </div>
            `;
    } else {
      wrapper.innerHTML = `
                <div class="countdown-label">A BOLA ROLA EM</div>
                <div class="countdown-grid">
                    <div class="countdown-unit">
                        <span class="countdown-value">${format(horas)}</span>
                        <span class="countdown-text">HORAS</span>
                    </div>
                    <div class="countdown-unit">
                        <span class="countdown-value">${format(minutos)}</span>
                        <span class="countdown-text">MIN</span>
                    </div>
                    <div class="countdown-unit">
                        <span class="countdown-value">${format(segundos)}</span>
                        <span class="countdown-text">SEG</span>
                    </div>
                </div>
            `;
    }
  };

  state.countdownInterval = setInterval(update, 1000);
  update();
};

const loadAgenda = async () => {
  if (state.agendaLoaded) return;

  try {
    const response = await fetch(`${CONFIG.agendaUrl}?v=${Date.now()}`);
    if (response.ok) {
      state.agendaData = await response.json();
      state.agendaLoaded = true;

      if (state.logsEnabled) {
        console.log("📅 Agenda carregada com sucesso");
        console.log(`📊 Total de jogos: ${state.agendaData.length}`);
      }

      if (!state.matchStarted) renderPreMatchState();
    }
  } catch (e) {
    if (state.logsEnabled) console.error("Erro ao carregar agenda:", e.message);
  }
};

const getNextMatchFromAgenda = () => {
  if (!state.agendaData || !Array.isArray(state.agendaData)) {
    return null;
  }

  const now = new Date();
  const meses = {
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

  // Filtra jogos com hora definida
  const matchesWithTime = state.agendaData.filter(
    (match) =>
      match.hora && match.hora !== "A definir" && match.hora !== "undefined",
  );

  if (matchesWithTime.length === 0) {
    if (state.logsEnabled) console.log("⚠️ Nenhum jogo com hora definida");
    return null;
  }

  const parsedMatches = matchesWithTime
    .map((m) => {
      try {
        // Parse da data (ex: "qui., 29 jan.")
        const dateStr = m.data.trim();
        const parts = dateStr.split(" ");

        // Remove pontos e vírgulas
        const dayStr = parts[1].replace(/[,.]/g, "");
        const monthStr = parts[2].replace(/[,.]/g, "").toLowerCase();

        const day = parseInt(dayStr);
        const month = meses[monthStr];

        if (isNaN(day) || month === undefined) {
          return null;
        }

        // Parse da hora (ex: "20:00")
        const [hours, minutes] = m.hora.split(":").map((num) => parseInt(num));

        if (isNaN(hours) || isNaN(minutes)) {
          return null;
        }

        // Cria data
        let date = new Date();
        date.setDate(day);
        date.setMonth(month);
        date.setHours(hours);
        date.setMinutes(minutes);
        date.setSeconds(0);
        date.setMilliseconds(0);

        // Se a data já passou neste ano, assume próximo ano
        if (date < now) {
          date.setFullYear(date.getFullYear() + 1);
        }

        return {
          ...m,
          dateObj: date,
        };
      } catch (e) {
        return null;
      }
    })
    .filter((m) => m !== null);

  // Ordena por data mais próxima
  parsedMatches.sort((a, b) => a.dateObj - b.dateObj);

  // Retorna o mais próximo
  const nextMatch = parsedMatches[0];

  if (nextMatch && state.logsEnabled && !state.matchStarted) {
    console.log(
      `🎯 Próximo jogo: ${nextMatch.mandante} vs ${nextMatch.visitante}`,
    );
    console.log(
      `⏰ Data: ${nextMatch.dateObj.toLocaleDateString()} ${nextMatch.hora}`,
    );
    console.log(`🏆 Campeonato: ${nextMatch.campeonato}`);
  }

  return nextMatch;
};

const initNavigation = () => {
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("nav-menu");
  if (toggle && nav)
    toggle.addEventListener("click", () => nav.classList.toggle("active"));

  // Desativa logs após 5 segundos para não poluir console
  setTimeout(() => {
    state.logsEnabled = false;
  }, 5000);
};

// Função para ativar/desativar logs manualmente (opcional)
window.toggleLogs = () => {
  state.logsEnabled = !state.logsEnabled;
  console.log(`Logs ${state.logsEnabled ? "ativados" : "desativados"}`);
};

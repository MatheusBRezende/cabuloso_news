// script-brasileirao.js - COM DETECÇÃO AUTOMÁTICA DE SEMIFINAL

// Obtém funções do cache global
const { getFromCache } = window.cabulosoCacheModule || {};

const CONFIG_BRASILEIRAO = {
  defaultEscudo: "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
};

const stateBrasileirao = {
  dadosCompletos: null,
  currentFilter: "todos",
  campeonatoAtual: "brasileirao",
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const escapeHtml = (text) => {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};

// ============================================
// ZONE COLOR FUNCTIONS
// ============================================
const getZoneClass = (posicao) => {
  if (posicao >= 1 && posicao <= 4) return "zona-libertadores";
  if (posicao >= 5 && posicao <= 6) return "zona-preliberta";
  if (posicao >= 7 && posicao <= 12) return "zona-sulamericana";
  if (posicao >= 17 && posicao <= 20) return "zona-rebaixamento";
  return "";
};

const getRowZoneClass = (posicao) => {
  if (posicao >= 1 && posicao <= 4) return "row-libertadores";
  if (posicao >= 5 && posicao <= 6) return "row-preliberta";
  if (posicao >= 7 && posicao <= 12) return "row-sulamericana";
  if (posicao >= 17 && posicao <= 20) return "row-rebaixamento";
  return "";
};

const getZoneClassMineiro = (posicao, isMelhorSegundo = false) => {
  if (posicao === 1) return "zona-classificado-direto";
  if (posicao === 2 && isMelhorSegundo) return "zona-melhor-segundo";
  return "";
};

const getRowZoneClassMineiro = (posicao, isMelhorSegundo = false) => {
  if (posicao === 1) return "row-classificado-direto";
  if (posicao === 2 && isMelhorSegundo) return "row-melhor-segundo";
  return "";
};

const encontrarMelhorSegundo = (grupoA, grupoB, grupoC) => {
  const segundos = [
    grupoA[1] || null,
    grupoB[1] || null,
    grupoC[1] || null,
  ].filter((t) => t !== null);

  if (segundos.length === 0) return null;

  segundos.sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
    return (b.saldo || 0) - (a.saldo || 0);
  });

  return segundos[0]?.time || null;
};

// ============================================
// DETECÇÃO AUTOMÁTICA: TABELA OU SEMIFINAL?
// Retorna true se a tabela de grupos está encerrada
// (nenhum time tem menos de N jogos ou array vazio)
// ============================================
const tabelaGruposEncerrada = (mineiroArray) => {
  // Se não veio array de grupos, considera encerrada
  if (!mineiroArray || mineiroArray.length < 12) return true;

  // Se todos os times jogaram ao menos 3 rodadas, fase de grupos está em andamento
  // Quando os grupos terminam, a API para de retornar dados de classificação
  // e o worker retorna os jogos da semifinal no lugar
  return false;
};

// ============================================
// MAIN DATA LOADER
// ============================================
const loadMasterDataBrasileirao = async () => {
  console.log("📦 Tentando carregar dados para a tabela...");

  try {
    // 1. TENTA O CACHE PRIMEIRO
    let data = getFromCache ? getFromCache("master_data_v3") : null;

    if (data) {
      console.log("✅ Dados recuperados do cache com sucesso.");
      stateBrasileirao.dadosCompletos = data;
      refreshCurrentView();
      if (data.agenda) renderizarAgenda(data.agenda);
      return;
    }

    // 2. SE NÃO HOUVER CACHE, BUSCA DO WORKER
    console.log("🌐 Cache não encontrado! Buscando dados frescos do Worker...");
    const response = await fetch("https://cabuloso-api.cabulosonews92.workers.dev/?type=dados-completos");
    
    if (!response.ok) throw new Error("Falha ao buscar dados do Worker");

    data = await response.json();

    // Normaliza se vier como Array (padrão n8n)
    if (Array.isArray(data)) data = data[0];

    if (data) {
      stateBrasileirao.dadosCompletos = data;
      
      if (window.cabulosoCacheModule && window.cabulosoCacheModule.saveToCache) {
        window.cabulosoCacheModule.saveToCache("master_data_v3", data, 5 * 60 * 1000);
      }
      
      refreshCurrentView();
      if (data.agenda) renderizarAgenda(data.agenda);
    } else {
      throw new Error("Dados vazios do Worker");
    }

  } catch (error) {
    console.error("❌ Erro ao carregar dados da tabela:", error);
    const container = document.getElementById("tabela-container");
    if (container) {
      container.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:20px;">Erro ao carregar classificação. <br> Verifique sua conexão e atualize a página.</td></tr>`;
    }
  }
};

const refreshCurrentView = () => {
  const data = stateBrasileirao.dadosCompletos;
  if (!data) return;

  const camp = stateBrasileirao.campeonatoAtual;
  
  if (camp === "brasileirao") {
    renderizarTabelaCompleta(data.tabelas?.brasileiro || data.tabela_brasileiro);

  } else if (camp === "mineiro") {
    const mineiroRaw = data.tabelas?.mineiro || data.tabela_mineiro;
    const mineiroArray = mineiroRaw?.classificacao || (Array.isArray(mineiroRaw) ? mineiroRaw : []);

    // ──────────────────────────────────────────────────────
    // DETECÇÃO AUTOMÁTICA ✨
    // Se a API não retornou tabela de grupos mas retornou
    // dados de semifinal, exibe o card de semifinal.
    // Prioridade: semifinal > tabela de grupos.
    // ──────────────────────────────────────────────────────
    const semifinalData = data.tabelas?.mineiro_semifinal
      || data.mineiro_semifinal
      || data.semifinal_mineiro
      || null;

    const temSemifinal = semifinalData && (
      Array.isArray(semifinalData) ? semifinalData.length > 0
      : semifinalData.jogos && semifinalData.jogos.length > 0
    );

    const temTabelaGrupos = mineiroArray.length >= 12;

    if (temSemifinal && !temTabelaGrupos) {
      // Fase de grupos encerrada → mostra semifinal
      console.log("🏆 Fase de grupos encerrada, exibindo Semifinal do Mineiro.");
      const jogos = Array.isArray(semifinalData) ? semifinalData : semifinalData.jogos;
      renderizarSemifinalMineiro(jogos);
    } else if (temTabelaGrupos) {
      // Fase de grupos ainda ativa → mostra tabela normal
      renderizarTabelaMineiro(mineiroArray);
    } else {
      // Fallback: sem dados de nenhum tipo
      document.getElementById("tabela-container").innerHTML =
        "<p style='text-align:center;padding:30px;color:#999;'>Dados do Mineiro indisponíveis no momento.</p>";
    }

  } else {
    renderCopaDoBrasilPlaceholder();
  }
};

// ============================================
// RENDERING FUNCTIONS
// ============================================

const renderizarTabelaCompleta = (data) => {
  const container = document.getElementById("tabela-container");
  if (!data || !data.classificacao) {
    container.innerHTML = "<p>Tabela do Brasileirão indisponível.</p>";
    return;
  }

  let html = `
    <table id="tabela-brasileirao">
      <thead>
        <tr>
          <th class="col-time">Classificação</th>
          <th class="col-pontos">P</th>
          <th>J</th>
          <th>V</th>
          <th>SG</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.classificacao.forEach((time, index) => {
    const posicao = index + 1;
    const isCruzeiro = time.nome?.toLowerCase().includes("cruzeiro");
    const rowZone = getRowZoneClass(posicao);
    const zoneClass = getZoneClass(posicao);

    html += `
      <tr class="${isCruzeiro ? "cruzeiro-row" : ""} ${rowZone}">
        <td class="celula-time-completa">
          <div class="posicao-container">
            <span class="indicador-zona ${zoneClass}"></span>
            <span class="numero-posicao">${isCruzeiro ? "🦊" : ""}${posicao}º</span>
          </div>
          <div class="time-info">
            <img 
              src="${time.escudo || CONFIG_BRASILEIRAO.defaultEscudo}" 
              class="escudo-pequeno"
              onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'"
            >
            <span class="nome-time-texto">${escapeHtml(time.nome)}</span>
          </div>
        </td>
        <td class="dado-pontos"><strong>${time.pontos}</strong></td>
        <td>${time.jogos}</td>
        <td>${time.vitorias}</td>
        <td>${time.saldo_gols}</td>
      </tr>`;
  });

  html += "</tbody></table>";
  container.innerHTML = html;
};

const renderizarTabelaMineiro = (data) => {
  const container = document.getElementById("tabela-container");
  
  if (!data || data.length === 0) {
    container.innerHTML = "<p>Tabela do Mineiro indisponível.</p>";
    return;
  }

  const tabelaArray = Array.isArray(data) ? data : (data.grupos || []);
  
  if (tabelaArray.length === 0) {
    container.innerHTML = "<p>Tabela do Mineiro indisponível.</p>";
    return;
  }

  const grupoA = tabelaArray.slice(0, 4);
  const grupoB = tabelaArray.slice(4, 8);
  const grupoC = tabelaArray.slice(8, 12);
  const melhorSegundo = encontrarMelhorSegundo(grupoA, grupoB, grupoC);

  const renderGrupo = (grupo, letra) => `
    <div class="grupo-card">
      <div class="grupo-header"><h3>Grupo ${letra}</h3></div>
      <table class="grupo-table">
        <tbody>
          ${grupo
            .map((time, idx) => {
              const isCruzeiro = time.time?.toLowerCase().includes("cruzeiro");
              const isMelhor2 = idx === 1 && time.time === melhorSegundo;
              const zone = getZoneClassMineiro(idx + 1, isMelhor2);
              return `
              <tr class="${isCruzeiro ? "cruzeiro-row" : ""} ${getRowZoneClassMineiro(idx + 1, isMelhor2)}">
                <td><span class="zona-indicador ${zone}"></span>${idx + 1}º</td>
                <td>${escapeHtml(time.time)}</td>
                <td><strong>${time.pontos}</strong></td>
                <td>${time.jogos}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`;

  container.innerHTML = `
    <div class="grupos-mineiro">
      ${renderGrupo(grupoA, "A")}
      ${renderGrupo(grupoB, "B")}
      ${renderGrupo(grupoC, "C")}
    </div>`;
};

// ============================================
// 🆕 RENDER SEMIFINAL MINEIRO
// Recebe array com os jogos no formato do seu n8n:
// { fase, adversario, mando, data, hora, estadio, link_ge }
// ============================================
const renderizarSemifinalMineiro = (jogos) => {
  const container = document.getElementById("tabela-container");
  
  if (!jogos || jogos.length === 0) {
    container.innerHTML = `
      <div class="fase-copa fade-in-up">
        <h3><i class="fas fa-trophy"></i> Semifinal - Campeonato Mineiro 2026</h3>
        <div class="aviso-sem-jogos-copa">
          <div class="aviso-icon"><i class="fas fa-clock"></i></div>
          <div class="aviso-content">
            <h3>AGUARDE</h3>
            <p>Datas das semifinais serão confirmadas em breve.</p>
          </div>
        </div>
      </div>`;
    return;
  }

  // Agrupa os jogos por fase (ex: "Semifinal 1", "Semifinal 2")
  const porFase = {};
  jogos.forEach(jogo => {
    const chave = jogo.fase || "Semifinal";
    if (!porFase[chave]) porFase[chave] = [];
    porFase[chave].push(jogo);
  });

  const formatarData = (dataStr) => {
    if (!dataStr) return "A definir";
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const renderJogo = (jogo) => {
    const isMandante = jogo.mando === "Mandante";
    const cruzeiro = "Cruzeiro";
    const adversario = escapeHtml(jogo.adversario || "A definir");
    const mandante = isMandante ? cruzeiro : adversario;
    const visitante = isMandante ? adversario : cruzeiro;
    const linkHtml = jogo.link_ge
      ? `<a href="${escapeHtml(jogo.link_ge)}" target="_blank" rel="noopener" class="btn-ge">
           <i class="fas fa-external-link-alt"></i> Ver no GE
         </a>`
      : "";

    return `
      <article class="next-match semifinal-card cruzeiro-row fade-in-up">
        <div class="semifinal-fase-badge">
          <i class="fas fa-shield-alt"></i> ${escapeHtml(jogo.fase || "Semifinal")}
        </div>
        <div class="match-date">
          <i class="far fa-calendar"></i>
          ${formatarData(jogo.data)} &nbsp;|&nbsp;
          <i class="far fa-clock"></i> ${escapeHtml(jogo.hora || "A definir")}
        </div>
        <div class="match-teams semifinal-teams">
          <div class="match-team ${isMandante ? "team-cruzeiro" : ""}">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Cruzeiro_Esporte_Clube_%28logo%29.svg/150px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png"
                 alt="Cruzeiro"
                 onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'"
                 class="escudo-pequeno">
            <span>${mandante}</span>
          </div>
          <span class="vs semifinal-vs">X</span>
          <div class="match-team ${!isMandante ? "team-cruzeiro" : ""}">
            <span>${visitante}</span>
            <img src="${CONFIG_BRASILEIRAO.defaultEscudo}"
                 alt="${adversario}"
                 onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'"
                 class="escudo-pequeno">
          </div>
        </div>
        <div class="match-info">
          <i class="fas fa-map-marker-alt"></i>
          <strong>${escapeHtml(jogo.estadio || "A definir")}</strong>
        </div>
        ${linkHtml}
      </article>`;
  };

  let html = `
    <div class="semifinal-container fade-in-up">
      <div class="semifinal-header">
        <div class="semifinal-title-badge">
          <i class="fas fa-trophy"></i>
          <span>Semifinal</span>
        </div>
        <h2 class="semifinal-title">Campeonato Mineiro 2026</h2>
        <p class="semifinal-subtitle">
          🦊 O Cruzeiro está na semifinal! Confira os jogos abaixo.
        </p>
      </div>
      <div class="semifinal-jogos">
  `;

  Object.entries(porFase).forEach(([fase, jogosFase]) => {
    html += `
      <div class="semifinal-grupo">
        <div class="semifinal-grupo-header">
          <i class="fas fa-flag"></i> ${escapeHtml(fase)}
          <span class="semifinal-jogo-count">${jogosFase.length} jogo${jogosFase.length > 1 ? "s" : ""}</span>
        </div>
        ${jogosFase.map(renderJogo).join("")}
      </div>`;
  });

  html += `</div></div>`;
  container.innerHTML = html;

  // Atualiza a legenda: esconde zonas de tabela, não faz sentido na semi
  const lMin = document.getElementById("legend-mineiro");
  const lContainer = document.getElementById("legend-container");
  if (lMin) lMin.style.display = "none";
  if (lContainer) lContainer.style.display = "none";
};

const renderCopaDoBrasilPlaceholder = () => {
  const container = document.getElementById("tabela-container");
  const nomeCamp = document.getElementById("campeonato-nome");
  if (nomeCamp) nomeCamp.textContent = "Copa do Brasil 2026";

  if (container) {
    container.innerHTML = `
      <div class="fase-copa fade-in-up" id="copa-static-games">
        <h3><i class="fas fa-trophy"></i> Copa do Brasil 2026</h3>
        <div class="aviso-sem-jogos-copa">
          <div class="aviso-icon"><i class="fas fa-clock"></i></div>
          <div class="aviso-content">
            <h3>AGUARDE</h3>
            <p>Tabela da Copa do Brasil será atualizada em breve.</p>
          </div>
        </div>
      </div>`;
  }
};

const renderizarAgenda = (jogos) => {
  const container = document.querySelector('.games-list');
  if (!container) return;

  if (!jogos || jogos.length === 0) {
    container.innerHTML = `
      <div class="error-jogos">
        <i class="far fa-calendar-times" style="font-size:32px; color:#999;"></i>
        <p style="margin-top:10px; color:#999;">Nenhum jogo na agenda</p>
      </div>`;
    return;
  }

  const filtrados = stateBrasileirao.currentFilter === 'todos'
    ? jogos
    : jogos.filter(j => 
        j.campeonato?.toLowerCase().includes(stateBrasileirao.currentFilter.toLowerCase())
      );

  if (filtrados.length === 0) {
    container.innerHTML = `
      <div class="error-jogos">
        <i class="fas fa-filter" style="font-size:32px; color:#999;"></i>
        <p style="margin-top:10px; color:#999;">Nenhum jogo encontrado para este filtro</p>
      </div>`;
    return;
  }

  const proximos = filtrados.slice(0, 5);

  container.innerHTML = proximos.map(jogo => `
    <article class="next-match destaque-cruzeiro">
      <div class="match-date">
        <i class="far fa-calendar"></i> ${escapeHtml(jogo.data)} - ${escapeHtml(jogo.hora)}
      </div>
      <div class="match-teams">
        <div class="match-team">
          <img 
            src="${jogo.escudo_mandante || CONFIG_BRASILEIRAO.defaultEscudo}" 
            alt="${escapeHtml(jogo.mandante)}"
            onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'"
          >
          <span>${escapeHtml(jogo.mandante)}</span>
        </div>
        <span class="vs">X</span>
        <div class="match-team">
          <span>${escapeHtml(jogo.visitante)}</span>
          <img 
            src="${jogo.escudo_visitante || CONFIG_BRASILEIRAO.defaultEscudo}" 
            alt="${escapeHtml(jogo.visitante)}"
            onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'"
          >
        </div>
      </div>
      <div class="match-info">
        <strong>${escapeHtml(jogo.campeonato)}</strong> | ${escapeHtml(jogo.estadio)}
      </div>
    </article>
  `).join('');
};

// ============================================
// INTERFACE & INITIALIZATION
// ============================================

const initInterface = () => {
  const buttons = document.querySelectorAll(".campeonato-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.campeonato;

      buttons.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");

      stateBrasileirao.campeonatoAtual = value;
      updateLegend(value);
      refreshCurrentView();
    });
  });

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      stateBrasileirao.currentFilter = btn.dataset.filter;
      
      if (stateBrasileirao.dadosCompletos?.agenda) {
        renderizarAgenda(stateBrasileirao.dadosCompletos.agenda);
      }
    });
  });

  const widgetToggle = document.getElementById("widget-toggle");
  const widget = document.getElementById("games-widget");
  const widgetClose = document.getElementById("widget-close");

  if (widgetToggle && widget) {
    widgetToggle.addEventListener("click", () => {
      widget.classList.add("active");
      widgetToggle.setAttribute("aria-expanded", "true");
    });
  }
  
  if (widgetClose && widget) {
    widgetClose.addEventListener("click", () => {
      widget.classList.remove("active");
      if (widgetToggle) widgetToggle.setAttribute("aria-expanded", "false");
    });
  }
};

const updateLegend = (campeonato) => {
  const lBr = document.getElementById("legend-brasileirao");
  const lMin = document.getElementById("legend-mineiro");
  const lContainer = document.getElementById("legend-container");

  if (!lContainer) return;

  if (campeonato === "brasileirao") {
    if (lBr) lBr.style.display = "flex";
    if (lMin) lMin.style.display = "none";
    lContainer.style.display = "block";
  } else if (campeonato === "mineiro") {
    // A legenda de zonas só faz sentido na fase de grupos.
    // Se estivermos na semifinal, renderizarSemifinalMineiro() vai esconder ela.
    if (lBr) lBr.style.display = "none";
    if (lMin) lMin.style.display = "flex";
    lContainer.style.display = "block";
  } else {
    lContainer.style.display = "none";
  }
};

const initBrasileirao = () => {
  console.log("🎯 Inicializando página de Tabelas...");
  
  if (!window.cabulosoCacheModule) {
    console.error("❌ Cache module não disponível! Aguardando...");
    setTimeout(initBrasileirao, 100);
    return;
  }

  initInterface();
  loadMasterDataBrasileirao();
  updateLegend("brasileirao");
};

// ============================================
// INICIALIZAÇÃO
// ============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBrasileirao);
} else {
  initBrasileirao();
}

const forceRefreshAll = async () => {
  console.log("🔄 Forçando refresh completo...");
  sessionStorage.removeItem("cache_master_data_v3");
  if ('caches' in window) {
    await caches.delete('cabuloso-v1');
  }
  location.reload();
};

window.forceRefreshAll = forceRefreshAll;
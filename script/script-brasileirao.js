// script-brasileirao.js - VERSÃO CORRIGIDA (usa window.cabulosoCacheModule)

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
// MAIN DATA LOADER - REUTILIZA CACHE! ⭐
// ============================================
const loadMasterDataBrasileirao = async () => {
  console.log("📦 Tentando carregar dados para a tabela...");

  try {
    // 1. TENTA O CACHE PRIMEIRO
    let data = getFromCache ? getFromCache("master_data_v3") : null;

    if (data) {
      console.log("✅ Dados recuperados do cache com sucesso.");
      stateBrasileirao.dadosCompletos = data;
      // CHAMA AS FUNÇÕES CORRETAS QUE EXISTEM NO SEU SCRIPT
      renderTable();
      renderAgenda();
      return;
    }

    // 2. SE NÃO HOUVER CACHE, BUSCA DIRETO DO WORKER
    console.log("🌐 Cache não encontrado! Buscando dados frescos do Worker...");
    const response = await fetch("https://cabuloso-api.cabulosonews92.workers.dev/?type=dados-completos");
    
    if (!response.ok) throw new Error("Falha ao buscar dados do Worker");

    data = await response.json();

    // Normaliza se vier como Array (padrão n8n)
    if (Array.isArray(data)) data = data[0];

    if (data) {
      stateBrasileirao.dadosCompletos = data;
      
      // Salva no sessionStorage para evitar novos fetches ao navegar
      if (window.cabulosoCacheModule && window.cabulosoCacheModule.saveToCache) {
          window.cabulosoCacheModule.saveToCache("master_data_v3", data, 5 * 60 * 1000);
      }
      
      // CHAMA AS FUNÇÕES CORRETAS QUE EXISTEM NO SEU SCRIPT
      renderTable();
      renderAgenda();
    } else {
      throw new Error("Dados vazios do Worker");
    }

  } catch (error) {
    console.error("❌ Erro ao carregar dados da tabela:", error);
    const container = document.getElementById("tabela-corpo");
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
    renderizarTabelaCompleta(data.tabela_brasileiro);
  } else if (camp === "mineiro") {
    renderizarTabelaMineiro(data.tabela_mineiro);
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

  const grupoA = data.slice(0, 4);
  const grupoB = data.slice(4, 8);
  const grupoC = data.slice(8, 12);
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
      </div>
    `;
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
      </div>
    `;
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
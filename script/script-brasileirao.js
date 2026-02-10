// script-brasileirao.js - VERSÃO OTIMIZADA
// Reutiliza dados já carregados pelo script.js (sem fazer novas requisições!)

import { getFromCache } from "./cache.js";

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
  // ⭐ USA A MESMA CHAVE DO script.js - Reutiliza dados!
  const CACHE_KEY = "master_data_v3";
  const container = document.getElementById("tabela-container");

  try {
    console.log("📦 Tentando reutilizar dados do cache principal...");
    
    // Reutiliza dados já carregados pelo script.js
    const cached = getFromCache(CACHE_KEY);
    
    if (cached) {
      console.log("✅ Dados reutilizados do cache! (Sem requisição HTTP)");
      
      // Extrai apenas o que precisa do objeto consolidado
      stateBrasileirao.dadosCompletos = {
        tabela_brasileiro: cached.tabelas?.brasileiro || null,
        tabela_mineiro: cached.tabelas?.mineiro || [],
        agenda: cached.agenda || [],
        resultados: cached.resultados || []
      };
      
      // Renderiza tudo
      renderizarAgenda(stateBrasileirao.dadosCompletos.agenda);
      refreshCurrentView();
      return;
    }

    // Se não tem cache, avisa o usuário
    console.warn("⚠️ Cache não encontrado!");
    
    if (container) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px; color:#999;">
          <i class="fas fa-exclamation-triangle" style="font-size:48px; color:#ff6b6b;"></i>
          <p style="margin-top:20px; font-size:18px;">Dados não carregados ainda.</p>
          <p style="margin-top:10px; color:#666;">Por favor, visite a página inicial primeiro ou aguarde.</p>
          <button 
            onclick="window.location.href='/'" 
            style="margin-top:20px; padding:12px 24px; background:#003399; color:white; border:none; border-radius:8px; cursor:pointer; font-size:16px; font-weight:600;"
          >
            Ir para Página Inicial
          </button>
        </div>
      `;
    }
    
  } catch (error) {
    console.error("❌ Erro:", error);
    if (container) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px;">
          <p style="color:#ff6b6b;">Erro ao carregar dados: ${error.message}</p>
        </div>
      `;
    }
  }
};

/**
 * Atualiza a visualização com base na aba selecionada (Sem nova requisição)
 */
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

  // Divide em grupos de 4
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

  // Filtra por campeonato se houver filtro ativo
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

  // Mostra os 5 primeiros
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
  // Configuração das abas de campeonato
  const buttons = document.querySelectorAll(".campeonato-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.campeonato;

      // Atualiza UI dos botões
      buttons.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");

      // Muda estado e atualiza tela SEM FETCH!
      stateBrasileirao.campeonatoAtual = value;
      updateLegend(value);
      refreshCurrentView();
    });
  });

  // Configuração do Widget de Filtro
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

  // Toggle do Widget
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
  initInterface();
  loadMasterDataBrasileirao();
  updateLegend("brasileirao");
};

// ============================================
// INICIALIZAÇÃO
// ============================================
initBrasileirao();

// Força refresh (limpa cache)
const forceRefreshAll = async () => {
  console.log("🔄 Forçando refresh completo...");
  sessionStorage.removeItem("cache_master_data_v3");
  if ('caches' in window) {
    await caches.delete('cabuloso-v1');
  }
  location.reload();
};

window.forceRefreshAll = forceRefreshAll;
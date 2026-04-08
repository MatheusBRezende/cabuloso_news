const { getFromCache } = window.cabulosoCacheModule || {};

const CONFIG_BRASILEIRAO = {
  defaultEscudo: "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png",
  escudoCruzeiro: "https://s.sde.globo.com/media/organizations/2021/02/13/cruzeiro_2021.svg",
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

// Funções para Libertadores
const getZoneClassLibertadores = (posicao) => {
  if (posicao >= 1 && posicao <= 4) return "zona-libertadores-grupos";
  if (posicao >= 5 && posicao <= 8) return "zona-libertadores-playoff";
  if (posicao >= 9 && posicao <= 12) return "zona-libertadores-eliminado";
  return "";
};

const getRowZoneClassLibertadores = (posicao) => {
  if (posicao >= 1 && posicao <= 4) return "row-libertadores-grupos";
  if (posicao >= 5 && posicao <= 8) return "row-libertadores-playoff";
  if (posicao >= 9 && posicao <= 12) return "row-libertadores-eliminado";
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
  const segundos = [grupoA[1] || null, grupoB[1] || null, grupoC[1] || null].filter(Boolean);
  if (segundos.length === 0) return null;
  segundos.sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
    return (b.saldo || 0) - (a.saldo || 0);
  });
  return segundos[0]?.time || null;
};

// ============================================
// NORMALIZA ARRAY DE JOGOS DA SEMIFINAL
// ============================================
const normalizarSemifinalJogos = (raw) => {
  if (!raw) return null;

  let arr = null;

  if (Array.isArray(raw)) {
    if (raw[0]?.jogos && Array.isArray(raw[0].jogos)) {
      arr = raw[0].jogos;
    } else if (raw[0]?.json?.fase) {
      arr = raw.map(i => i.json);
    } else {
      // Aceita qualquer array de jogos — formato antigo (adversario) ou novo (mandante/visitante)
      arr = raw;
    }
  } else if (typeof raw === "object" && raw.jogos && Array.isArray(raw.jogos)) {
    arr = raw.jogos;
  }

  // Válido se tiver pelo menos um campo identificador de jogo
  if (arr && arr.length > 0 && (arr[0]?.fase || arr[0]?.adversario || arr[0]?.mandante)) {
    return arr;
  }

  return null;
};

// ============================================
// MAIN DATA LOADER
// ============================================
const loadMasterDataBrasileirao = async () => {
  console.log("📦 Tentando carregar dados para a tabela...");

  try {
    let data = getFromCache ? getFromCache("master_data_v3") : null;

    if (data) {
      console.log("✅ Dados recuperados do cache com sucesso.");
      stateBrasileirao.dadosCompletos = data;
      refreshCurrentView();
      if (data.agenda) renderizarAgenda(data.agenda);
      return;
    }

    console.log("🌐 Cache não encontrado! Buscando dados frescos do Worker...");
    const response = await fetch("https://cabuloso-api.cabulosonews92.workers.dev/?type=dados-completos");

    if (!response.ok) throw new Error("Falha ao buscar dados do Worker");

    data = await response.json();
    if (Array.isArray(data)) data = data[0];

    if (data) {
      stateBrasileirao.dadosCompletos = data;

      if (window.cabulosoCacheModule?.saveToCache) {
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
      container.innerHTML = `
        <div style="text-align:center; padding:40px; color:#999;">
          <i class="fas fa-exclamation-circle" style="font-size:32px; margin-bottom:12px; display:block;"></i>
          Erro ao carregar classificação.<br>Verifique sua conexão e atualize a página.
        </div>`;
    }
  }
};

// ============================================
// REFRESH: decide o que renderizar
// ============================================
const TITULOS_CAMPEONATO = {
  "brasileirao":    "Brasileirão Serie A",
  "mineiro":        "Campeonato Mineiro 2026",
  "copa-do-brasil": "Copa do Brasil 2026",
  "libertadores":   "Copa Libertadores 2026",
};

const refreshCurrentView = () => {
  const data = stateBrasileirao.dadosCompletos;
  if (!data) return;

  const camp = stateBrasileirao.campeonatoAtual;

  const nomeCamp = document.getElementById("campeonato-nome");
  if (nomeCamp) nomeCamp.textContent = TITULOS_CAMPEONATO[camp] || "Competições 2026";

  const wrapper = document.querySelector(".table-wrapper");
  if (wrapper) {
    wrapper.classList.toggle("brasileirao-wrapper", camp === "brasileirao");
  }

  if (camp === "brasileirao") {
    renderizarTabelaCompleta(data.tabelas?.brasileiro || data.tabela_brasileiro);
  } else if (camp === "libertadores") {
  const libertadoresData = data.tabelas?.libertadores || 
                          data.libertadores || 
                          data.tabela_libertadores;
  console.log("📊 Dados enviados para Libertadores:", libertadoresData);
  renderizarTabelaLibertadores(libertadoresData);
  } else if (camp === "mineiro") {
    const mineiroRaw = data.tabelas?.mineiro || data.tabela_mineiro;
    const mineiroArray = mineiroRaw?.classificacao || (Array.isArray(mineiroRaw) ? mineiroRaw : []);

    // Detecta campeão — campo pode vir como string ou objeto
    const campeaoRaw =
      data.tabelas?.mineiro?.campeao ||
      data.mineiro_campeao ||
      data.campeao_mineiro ||
      mineiroRaw?.campeao ||
      null;

    const semifinalRaw =
      data.tabelas?.mineiro?.semifinal ||
      data.tabelas?.mineiro_semifinal ||
      data.mineiro_semifinal ||
      data.semifinal_mineiro ||
      null;

    const semifinalJogos = normalizarSemifinalJogos(semifinalRaw);

    const temCampeao   = !!(campeaoRaw);
    const temSemifinal = !!(semifinalJogos && semifinalJogos.length > 0);
    const temTabelaGrupos = mineiroArray.length >= 12;

    console.log(`🔍 Mineiro — temTabelaGrupos: ${temTabelaGrupos}, temSemifinal: ${temSemifinal}, temCampeao: ${temCampeao}`);

    if (temCampeao) {
      console.log("🏆 Cruzeiro CAMPEÃO! Exibindo tela de título.");
      renderizarCampeaoMineiro(campeaoRaw, semifinalJogos);
    } else if (temSemifinal && !temTabelaGrupos) {
      console.log("🏆 Fase de grupos encerrada, exibindo Semifinal do Mineiro.");
      renderizarSemifinalMineiro(filtrarJogosCruzeiro(semifinalJogos));
    } else if (temTabelaGrupos) {
      renderizarTabelaMineiro(mineiroArray);
    } else {
      document.getElementById("tabela-container").innerHTML =
        "<p style='text-align:center;padding:30px;color:#999;'>Dados do Mineiro indisponíveis no momento.</p>";
    }
  } else {
    renderCopaDoBrasilPlaceholder();
  }
};

// ============================================
// HELPER: Barra de navegação de fases do Mineiro
// ============================================
const FASES_MINEIRO = [
  { id: 'grupos',    label: 'Grupos' },
  { id: 'semifinal', label: 'Semifinal' },
  { id: 'final',     label: 'Final' },
];

// Filtra apenas jogos em que o Cruzeiro participa
const filtrarJogosCruzeiro = (jogos) => {
  if (!Array.isArray(jogos)) return [];
  return jogos.filter(j => {
    const mand = (j.mandante || j.adversario || "").toLowerCase();
    const vis  = (j.visitante || "").toLowerCase();
    return mand.includes("cruzeiro") || vis.includes("cruzeiro");
  });
};

const renderNavFasesMineiro = (faseAtiva) => {
  const idx = FASES_MINEIRO.findIndex(f => f.id === faseAtiva);
  const anterior = idx > 0 ? FASES_MINEIRO[idx - 1] : null;
  const proxima  = idx < FASES_MINEIRO.length - 1 ? FASES_MINEIRO[idx + 1] : null;

  const btnAnterior = anterior
    ? `<button class="fase-nav-btn fase-nav-prev" onclick="filtrarFaseMineiro(event,'${anterior.id}')" type="button">
         <i class="fas fa-chevron-left"></i>
         <span>${anterior.label}</span>
       </button>`
    : `<span class="fase-nav-btn fase-nav-disabled"><i class="fas fa-chevron-left"></i></span>`;

  const btnProxima = proxima
    ? `<button class="fase-nav-btn fase-nav-next" onclick="filtrarFaseMineiro(event,'${proxima.id}')" type="button">
         <span>${proxima.label}</span>
         <i class="fas fa-chevron-right"></i>
       </button>`
    : `<span class="fase-nav-btn fase-nav-disabled"><i class="fas fa-chevron-right"></i></span>`;

  return `
    <div class="fase-nav-bar">
      ${btnAnterior}
      <span class="fase-nav-label">
        <i class="fas fa-flag"></i> ${FASES_MINEIRO[idx]?.label || faseAtiva}
      </span>
      ${btnProxima}
    </div>`;
};

function filtrarFaseMineiro(event, fase) {
    // 1. Atualiza visual dos botões
    document.querySelectorAll('.btn-fase').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    // 2. Recupera os dados mestres
    const dadosGerais = stateBrasileirao.dadosCompletos;
    if (!dadosGerais) return;

    // 3. Pega os dados do Mineiro (usando a mesma lógica do refreshCurrentView)
    const mineiroRaw = dadosGerais.tabelas?.mineiro || dadosGerais.tabela_mineiro;
    
    const container = document.getElementById('tabela-container');
    if (!container) return;

    // 4. Lógica de Filtragem
    if (fase === 'grupos') {
        const mineiroArray = mineiroRaw?.classificacao || (Array.isArray(mineiroRaw) ? mineiroRaw : []);
        renderizarTabelaMineiro(mineiroArray);
    } else if (fase === 'final') {
        // Na aba Final: se há campeão, mostra tela de campeão + resultados da final
        const campeaoRaw = dadosGerais.tabelas?.mineiro?.campeao || mineiroRaw?.campeao || null;
        const finalRaw   = mineiroRaw?.final || [];
        const semifinalRaw = mineiroRaw?.semifinal || [];
        const finalJogos = filtrarJogosCruzeiro(Array.isArray(finalRaw) ? finalRaw : []);
        if (campeaoRaw) {
            // Passa os jogos da final como "semifinalJogos" para renderizar o resultado
            renderizarCampeaoMineiro(campeaoRaw, [...finalJogos, ...filtrarJogosCruzeiro(Array.isArray(semifinalRaw) ? semifinalRaw : [])]);
        } else if (finalJogos.length > 0) {
            renderizarSemifinalMineiro(finalJogos);
        } else {
            renderizarSemifinalMineiro([]);
        }
    } else {
        // Semifinal
        const semifinalRaw = mineiroRaw?.semifinal || dadosGerais.mineiro_semifinal || [];
        const jogosParaExibir = filtrarJogosCruzeiro(Array.isArray(semifinalRaw) ? semifinalRaw : []);
        renderizarSemifinalMineiro(jogosParaExibir);
    }
}

// ============================================
// RENDER: Tabela Brasileirão
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

// ============================================
// RENDER: Tabela Libertadores
// ============================================
const renderizarTabelaLibertadores = (data) => {
  const container = document.getElementById("tabela-container");
  
  console.log("🔍 Dados Libertadores recebidos:", data);
  
  // Verifica se há dados
  if (!data) {
    container.innerHTML = `
      <div class="fase-copa fade-in-up">
        <h3><i class="fas fa-trophy"></i> Copa Libertadores 2026</h3>
        <div class="aviso-sem-jogos-copa">
          <div class="aviso-icon"><i class="fas fa-clock"></i></div>
          <div class="aviso-content">
            <h3>AGUARDE</h3>
            <p>Tabela da Libertadores será atualizada em breve.</p>
          </div>
        </div>
      </div>`;
    return;
  }
  
  // Extrai os dados do formato do n8n
  let gruposData = {};
  let faseAtual = "Fase de Grupos";
  
  // Caso 1: Array do n8n [{ tipo: "libertadores", grupo: 4, dados: [...] }]
  if (Array.isArray(data) && data.length > 0 && data[0].tipo === "libertadores") {
    const libertadoresData = data[0];
    const grupoNumero = libertadoresData.grupo || 4;
    const times = libertadoresData.dados || [];
    
    // Ordena os times por posição
    const timesOrdenados = [...times].sort((a, b) => (a.posicao || 999) - (b.posicao || 999));
    
    gruposData[`Grupo ${grupoNumero}`] = timesOrdenados.map(time => ({
      nome: time.nome,
      escudo: time.escudo,
      pontos: time.pontos,
      jogos: time.jogos,
      vitorias: time.vitorias,
      saldo_gols: time.gols?.saldo || 0,
      posicao: time.posicao
    }));
  }
  // Caso 2: Formato esperado original { grupos: { ... } }
  else if (data.grupos) {
    gruposData = data.grupos;
    faseAtual = data.fase_atual || faseAtual;
  }
  // Caso 3: Objeto com grupos dentro
  else if (data.tabela_libertadores?.grupos) {
    gruposData = data.tabela_libertadores.grupos;
    faseAtual = data.tabela_libertadores.fase_atual || faseAtual;
  }
  
  // Verifica se conseguiu extrair os dados
  if (Object.keys(gruposData).length === 0) {
    container.innerHTML = `
      <div class="fase-copa fade-in-up">
        <h3><i class="fas fa-trophy"></i> Copa Libertadores 2026</h3>
        <div class="aviso-sem-jogos-copa">
          <div class="aviso-icon"><i class="fas fa-clock"></i></div>
          <div class="aviso-content">
            <h3>DADOS INDISPONÍVEIS</h3>
            <p>Tabela da Libertadores será atualizada em breve.</p>
            <p style="font-size:11px; margin-top:8px; color:#666;">Formato recebido: ${typeof data}</p>
          </div>
        </div>
      </div>`;
    return;
  }

  // Renderiza os grupos
  let html = `
    <div class="libertadores-container">
      <div class="libertadores-header">
        <div class="libertadores-title-badge">
          <i class="fas fa-trophy"></i>
          <span>${escapeHtml(faseAtual)}</span>
        </div>
        <h2 class="libertadores-title">Copa Libertadores 2026</h2>
        <p class="libertadores-subtitle">🦊 Acompanhe a campanha do Cruzeiro na América</p>
      </div>
      <div class="grupos-libertadores">
  `;

  for (const [nomeGrupo, times] of Object.entries(gruposData)) {
    if (!Array.isArray(times) || times.length === 0) continue;
    
    html += `
      <div class="grupo-card libertadores-card">
        <div class="grupo-header">
          <h3><i class="fas fa-users"></i> ${escapeHtml(nomeGrupo)}</h3>
        </div>
        <table class="grupo-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Time</th>
              <th>P</th>
              <th>J</th>
              <th>V</th>
              <th>SG</th>
            </tr>
          </thead>
          <tbody>
            ${times.map((time, idx) => {
              const posicao = time.posicao || (idx + 1);
              const isCruzeiro = (time.nome || "").toLowerCase().includes("cruzeiro");
              const rowZone = getRowZoneClassLibertadores(posicao);
              const zoneClass = getZoneClassLibertadores(posicao);
              
              return `
                <tr class="${isCruzeiro ? "cruzeiro-row" : ""} ${rowZone}">
                  <td>
                    <span class="indicador-zona ${zoneClass}"></span>
                    ${posicao}º
                  </td>
                  <td class="libertadores-time-cell">
                    <img src="${time.escudo || CONFIG_BRASILEIRAO.defaultEscudo}" 
                         class="escudo-pequeno" 
                         onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'">
                    <span>${escapeHtml(time.nome)}</span>
                  </td>
                  <td><strong>${time.pontos || 0}</strong></td>
                  <td>${time.jogos || 0}</td>
                  <td>${time.vitorias || 0}</td>
                  <td>${time.saldo_gols || 0}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  html += `</div></div>`;
  container.innerHTML = html;
};

// ============================================
// RENDER: Campeão Mineiro 2026 🏆
// ============================================
const renderizarCampeaoMineiro = (campeaoRaw, semifinalJogos) => {
  const container = document.getElementById("tabela-container");

  // Normaliza — pode chegar como string "Cruzeiro" ou objeto { nome, escudo, adversario, placar }
  const campeao = typeof campeaoRaw === "string"
    ? { nome: campeaoRaw, escudo: null, adversario: null, placar: null }
    : campeaoRaw;

  const isCruzeiro = (campeao.nome || "").toLowerCase().includes("cruzeiro");
  const escudoCampeao = campeao.escudo ||
    (isCruzeiro ? CONFIG_BRASILEIRAO.escudoCruzeiro : CONFIG_BRASILEIRAO.defaultEscudo);

  // Busca o placar da final nos jogos da semifinal (fase "Final")
  let finalInfo = null;
  if (semifinalJogos) {
    const jogosFinal = semifinalJogos.filter(j =>
      (j.fase || "").toLowerCase().includes("final") &&
      !(j.fase || "").toLowerCase().includes("semi")
    );
    if (jogosFinal.length > 0) finalInfo = jogosFinal;
  }

  // Monta linha do resultado da final se disponível
  const renderFinalJogo = (jogo) => {
    const cruzEhCasa = jogo.mando === "Mandante";
    const adversario = escapeHtml(jogo.adversario || campeao.adversario || "Adversário");
    const placarCruz = jogo.placar_cruzeiro ?? "–";
    const placarAdv  = jogo.placar_adversario ?? "–";
    const mandante   = cruzEhCasa ? "Cruzeiro" : adversario;
    const visitante  = cruzEhCasa ? adversario : "Cruzeiro";
    const golsMand   = cruzEhCasa ? placarCruz : placarAdv;
    const golsVis    = cruzEhCasa ? placarAdv  : placarCruz;
    const legLabel   = jogo.jogo_numero ? `${jogo.jogo_numero}º Jogo` : (jogo.fase || "Final");

    return `
      <div class="campeao-final-jogo">
        <span class="campeao-final-leg">${escapeHtml(legLabel)}</span>
        <span class="campeao-final-placar">
          <strong>${escapeHtml(mandante)}</strong>
          <span class="campeao-placar-num">${golsMand} – ${golsVis}</span>
          <strong>${escapeHtml(visitante)}</strong>
        </span>
      </div>`;
  };

  const finalHtml = finalInfo
    ? `<div class="campeao-final-resultados">
         <p class="campeao-final-label"><i class="fas fa-flag-checkered"></i> Resultado da Final</p>
         ${finalInfo.map(renderFinalJogo).join("")}
       </div>`
    : (campeao.adversario
        ? `<div class="campeao-final-resultados">
             <p class="campeao-final-label"><i class="fas fa-flag-checkered"></i> Final</p>
             <div class="campeao-final-jogo">
               <span class="campeao-final-placar">
                 <strong>Cruzeiro</strong>
                 ${campeao.placar ? `<span class="campeao-placar-num">${escapeHtml(String(campeao.placar))}</span>` : ""}
                 <strong>${escapeHtml(campeao.adversario)}</strong>
               </span>
             </div>
           </div>`
        : "");

  container.innerHTML = renderNavFasesMineiro('final') + `
    <div class="campeao-container fade-in-up">
      <div class="campeao-header">
        <div class="campeao-confetti" aria-hidden="true">
          <span>🏆</span><span>⭐</span><span>🦊</span><span>⭐</span><span>🏆</span>
        </div>
        <div class="campeao-titulo-badge">
          <i class="fas fa-trophy"></i> CAMPEÃO MINEIRO 2026
        </div>
        <div class="campeao-escudo-wrap">
          <img src="${escudoCampeao}"
               alt="${escapeHtml(campeao.nome)}"
               class="campeao-escudo"
               onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'">
          <div class="campeao-coroa">👑</div>
        </div>
        <h2 class="campeao-nome">${escapeHtml(campeao.nome)}</h2>
        <p class="campeao-subtitulo">O Maior de Minas é CAMPEÃO!</p>
        ${finalHtml}
      </div>
    </div>`;

  // Oculta legenda — não faz sentido no modo campeão
  const lContainer = document.getElementById("legend-container");
  if (lContainer) lContainer.style.display = "none";
};

// ============================================
// RENDER: Tabela Mineiro (fase de grupos)
// ============================================
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
        <thead>
          <tr>
            <th colspan="2">Time</th>
            <th>P</th>
            <th>J</th>
            <th>V</th>
            <th>SG</th>
          </tr>
        </thead>
        <tbody>
          ${grupo.map((time, idx) => {
            const isCruzeiro = time.time?.toLowerCase().includes("cruzeiro");
            const isMelhor2 = idx === 1 && time.time === melhorSegundo;
            const zone = getZoneClassMineiro(idx + 1, isMelhor2);
            const escudo = time.escudo || CONFIG_BRASILEIRAO.defaultEscudo;
            return `
              <tr class="${isCruzeiro ? "cruzeiro-row" : ""} ${getRowZoneClassMineiro(idx + 1, isMelhor2)}">
                <td>
                  <div class="posicao-container">
                    <span class="indicador-zona ${zone}"></span>
                    <span class="numero-posicao">${isCruzeiro ? "🦊" : ""}${idx + 1}º</span>
                  </div>
                </td>
                <td>
                  <div class="time-info">
                    <img src="${escudo}" class="escudo-pequeno"
                         onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'">
                    <span class="nome-time-texto">${escapeHtml(time.time)}</span>
                  </div>
                </td>
                <td class="dado-pontos"><strong>${time.pontos}</strong></td>
                <td>${time.jogos}</td>
                <td>${time.vitorias}</td>
                <td>${time.saldo ?? 0}</td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;

  container.innerHTML = renderNavFasesMineiro('grupos') + `
    <div class="grupos-mineiro">
      ${renderGrupo(grupoA, "A")}
      ${renderGrupo(grupoB, "B")}
      ${renderGrupo(grupoC, "C")}
    </div>`;
};

// ============================================
// RENDER: Semifinal do Mineiro
// ============================================
const renderizarSemifinalMineiro = (jogos) => {
  const container = document.getElementById("tabela-container");

  if (!jogos || jogos.length === 0) {
    container.innerHTML = renderNavFasesMineiro('semifinal') + `
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

  // Detecta qual fase está sendo exibida (para a barra de navegação)
  const faseAtual = jogos[0]?.fase?.toUpperCase().includes("FINAL") &&
                    !jogos[0]?.fase?.toUpperCase().includes("SEMI")
    ? 'final' : 'semifinal';

  // Agrupa por fase
  const porFase = {};
  jogos.forEach(jogo => {
    const chave = jogo.fase || "Semifinal";
    if (!porFase[chave]) porFase[chave] = [];
    porFase[chave].push(jogo);
  });

  const formatarData = (dataStr) => {
    if (!dataStr) return "A definir";
    // Já vem no formato DD/MM/YYYY do n8n
    return dataStr;
  };

  // Normaliza jogo — aceita tanto formato antigo {adversario, mando} quanto novo {mandante, visitante}
  const normalizarJogo = (jogo) => {
    // Formato novo (dados reais do n8n): mandante, visitante, escudo_mandante, placar_mandante, placar_visitante
    if (jogo.mandante !== undefined) {
      const isCruzMandante = (jogo.mandante || "").toLowerCase().includes("cruzeiro");
      const isCruzVisitante = (jogo.visitante || "").toLowerCase().includes("cruzeiro");

      return {
        fase: jogo.fase || "SEMIFINAL",
        data: jogo.data,
        hora: jogo.hora,
        estadio: jogo.estadio,
        encerrado: jogo.encerrado || jogo.jogo_encerrado || false,
        aoVivo: jogo.ao_vivo || jogo.jogo_ao_vivo || false,
        linkGe: jogo.link_ge || "",
        timeEsquerda: {
          nome: jogo.mandante,
          escudo: jogo.escudo_mandante || CONFIG_BRASILEIRAO.defaultEscudo,
          isCruz: isCruzMandante,
          label: "Casa",
          placar: jogo.placar_mandante,
        },
        timeDireita: {
          nome: jogo.visitante,
          escudo: jogo.escudo_visitante || CONFIG_BRASILEIRAO.defaultEscudo,
          isCruz: isCruzVisitante,
          label: "Fora",
          placar: jogo.placar_visitante,
        },
      };
    }

    // Formato antigo (legado): adversario, mando, placar_cruzeiro, placar_adversario
    const cruzEhCasa = jogo.mando === "Mandante";
    const nomeAdv = jogo.adversario || "A definir";
    let escudoAdv = jogo.escudo_adversario || null;
    if (!escudoAdv) {
      const agendaJogo = stateBrasileirao.dadosCompletos?.agenda?.find(j =>
        j.mandante === nomeAdv || j.visitante === nomeAdv
      );
      escudoAdv = cruzEhCasa
        ? (agendaJogo?.escudo_visitante || CONFIG_BRASILEIRAO.defaultEscudo)
        : (agendaJogo?.escudo_mandante || CONFIG_BRASILEIRAO.defaultEscudo);
    }
    return {
      fase: jogo.fase || "SEMIFINAL",
      data: jogo.data,
      hora: jogo.hora,
      estadio: jogo.estadio,
      encerrado: jogo.jogo_encerrado || false,
      aoVivo: jogo.jogo_ao_vivo || false,
      linkGe: jogo.link_ge || "",
      timeEsquerda: {
        nome: cruzEhCasa ? "Cruzeiro" : nomeAdv,
        escudo: cruzEhCasa ? CONFIG_BRASILEIRAO.escudoCruzeiro : escudoAdv,
        isCruz: cruzEhCasa,
        label: "Casa",
        placar: cruzEhCasa ? jogo.placar_cruzeiro : jogo.placar_adversario,
      },
      timeDireita: {
        nome: cruzEhCasa ? nomeAdv : "Cruzeiro",
        escudo: cruzEhCasa ? escudoAdv : CONFIG_BRASILEIRAO.escudoCruzeiro,
        isCruz: !cruzEhCasa,
        label: "Fora",
        placar: cruzEhCasa ? jogo.placar_adversario : jogo.placar_cruzeiro,
      },
    };
  };

  const renderJogo = (jogoRaw) => {
    const jogo = normalizarJogo(jogoRaw);
    const { timeEsquerda, timeDireita, encerrado, aoVivo } = jogo;

    const temPlacar = timeEsquerda.placar != null && timeDireita.placar != null;

    const vsOuPlacar = temPlacar
      ? `<div class="semifinal-placar ${encerrado ? "placar-encerrado" : aoVivo ? "placar-ao-vivo" : "placar-encerrado"}">
           <span>${timeEsquerda.placar}</span>
           <span class="placar-sep">–</span>
           <span>${timeDireita.placar}</span>
         </div>`
      : `<span class="vs semifinal-vs">X</span>`;

    const renderTime = (time) => `
      <div class="semifinal-team ${time.isCruz ? "team-cruzeiro" : ""}">
        <img src="${time.escudo}"
             alt="${escapeHtml(time.nome)}"
             onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'"
             class="semifinal-escudo">
        <span class="semifinal-team-name">${escapeHtml(time.nome)}</span>
        <span class="semifinal-mando-label">${time.label}</span>
      </div>`;

    return `
      <article class="semifinal-card ${timeEsquerda.isCruz || timeDireita.isCruz ? "cruzeiro-row" : ""} fade-in-up">
        <div class="semifinal-card-top">
          <span class="semifinal-fase-badge">
            <i class="fas fa-shield-alt"></i> ${escapeHtml(jogo.fase)}
          </span>
        </div>
        <div class="semifinal-card-date">
          <i class="far fa-calendar-alt"></i> ${formatarData(jogo.data)}
          &nbsp;|&nbsp;
          <i class="far fa-clock"></i> ${escapeHtml(jogo.hora || "A definir")}
        </div>
        <div class="semifinal-teams">
          ${renderTime(timeEsquerda)}
          <div class="semifinal-vs-box">${vsOuPlacar}</div>
          ${renderTime(timeDireita)}
        </div>
        <div class="semifinal-footer">
          <div class="semifinal-estadio">
            <i class="fas fa-map-marker-alt"></i>
            <strong>${escapeHtml(jogo.estadio || "A definir")}</strong>
          </div>
          ${jogo.linkGe ? `<a href="${escapeHtml(jogo.linkGe)}" target="_blank" rel="noopener" class="btn-ge">
            <i class="fas fa-play-circle"></i> Acompanhar
          </a>` : ""}
        </div>
      </article>`;
  };

  let html = `
    <div class="semifinal-container fade-in-up">
      <div class="semifinal-jogos">
  `;

  Object.entries(porFase).forEach(([fase, jogosFase]) => {
    html += `
      <div class="semifinal-grupo">
        <div class="semifinal-grupo-header">
          <i class="fas fa-flag"></i> ${escapeHtml(fase)}
          <span class="semifinal-jogo-count">${jogosFase.length} jogo${jogosFase.length > 1 ? "s" : ""}</span>
        </div>
        <div class="semifinal-cards-grid">
          ${jogosFase.map(renderJogo).join("")}
        </div>
      </div>`;
  });

  html += `</div></div>`;
  container.innerHTML = renderNavFasesMineiro(faseAtual) + html;

  const lMin = document.getElementById("legend-mineiro");
  const lContainer = document.getElementById("legend-container");
  if (lMin) lMin.style.display = "none";
  if (lContainer) lContainer.style.display = "none";
};

// ============================================
// RENDER: Copa do Brasil — próximos jogos
// ============================================
const renderCopaDoBrasilPlaceholder = () => {
  const container = document.getElementById("tabela-container");
  const nomeCamp = document.getElementById("campeonato-nome");
  if (nomeCamp) nomeCamp.textContent = "Copa do Brasil 2026";
  if (!container) return;

  // Tenta buscar jogos da Copa do Brasil na agenda
  const agenda = stateBrasileirao.dadosCompletos?.agenda || [];
  const jogosCopa = agenda.filter(j =>
    j.campeonato?.toLowerCase().includes("copa do brasil")
  );

  if (jogosCopa.length > 0) {
    const escapeHtmlLocal = (text) => {
      if (!text) return "";
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    };

    const cardsHtml = jogosCopa.map(jogo => `
      <article class="copa-jogo-card">
        <div class="copa-jogo-data">
          <i class="far fa-calendar-alt"></i>
          <span>${escapeHtmlLocal(jogo.data)}${jogo.hora && jogo.hora !== "A definir" ? " às " + escapeHtmlLocal(jogo.hora) : ""}</span>
          ${jogo.hora === "A definir" ? '<span class="hora-indefinida">Horário a definir</span>' : ""}
        </div>
        <div class="copa-jogo-times">
          <div class="copa-time">
            <img src="${jogo.escudo_mandante || CONFIG_BRASILEIRAO.defaultEscudo}"
                 alt="${escapeHtmlLocal(jogo.mandante)}"
                 onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'">
            <span class="${jogo.mandante?.toLowerCase().includes('cruzeiro') ? 'time-cruzeiro' : ''}">${escapeHtmlLocal(jogo.mandante)}</span>
          </div>
          <div class="copa-vs">X</div>
          <div class="copa-time copa-time-visitante">
            <span class="${jogo.visitante?.toLowerCase().includes('cruzeiro') ? 'time-cruzeiro' : ''}">${escapeHtmlLocal(jogo.visitante)}</span>
            <img src="${jogo.escudo_visitante || CONFIG_BRASILEIRAO.defaultEscudo}"
                 alt="${escapeHtmlLocal(jogo.visitante)}"
                 onerror="this.src='${CONFIG_BRASILEIRAO.defaultEscudo}'">
          </div>
        </div>
        ${jogo.estadio ? `<div class="copa-jogo-estadio"><i class="fas fa-map-marker-alt"></i> ${escapeHtmlLocal(jogo.estadio)}</div>` : ""}
        ${jogo.fase ? `<div class="copa-jogo-fase"><i class="fas fa-sitemap"></i> ${escapeHtmlLocal(jogo.fase)}</div>` : ""}
      </article>`).join("");

    container.innerHTML = `
      <div class="fase-copa fade-in-up">
        <h3><i class="fas fa-trophy"></i> Copa do Brasil 2026</h3>
        <div class="copa-jogos-lista">
          ${cardsHtml}
        </div>
      </div>`;
  } else {
    // Sem jogos na agenda — mostra aviso
    container.innerHTML = `
      <div class="fase-copa fade-in-up" id="copa-static-games">
        <h3><i class="fas fa-trophy"></i> Copa do Brasil 2026</h3>
        <div class="aviso-sem-jogos-copa">
          <div class="aviso-icon"><i class="fas fa-clock"></i></div>
          <div class="aviso-content">
            <h3>Aguardando Próximas Partidas</h3>
            <p>As informações dos próximos jogos da Copa do Brasil serão atualizadas em breve.</p>
          </div>
        </div>
      </div>`;
  }
};

// ============================================
// RENDER: Agenda (widget de próximos jogos)
// ============================================
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

  container.innerHTML = filtrados.slice(0, 5).map(jogo => `
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
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
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
    widgetToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = widget.classList.contains("active");
      if (isOpen) {
        widget.classList.remove("active");
        widgetToggle.setAttribute("aria-expanded", "false");
      } else {
        widget.classList.add("active");
        widgetToggle.setAttribute("aria-expanded", "true");
      }
    });
  }

  if (widgetClose && widget) {
    widgetClose.addEventListener("click", () => {
      widget.classList.remove("active");
      if (widgetToggle) widgetToggle.setAttribute("aria-expanded", "false");
    });
  }

  document.addEventListener("click", (e) => {
    if (!widget || !widgetToggle) return;
    if (!widget.contains(e.target) && !widgetToggle.contains(e.target)) {
      widget.classList.remove("active");
      widgetToggle.setAttribute("aria-expanded", "false");
    }
  });
};

const updateLegend = (campeonato) => {
  const lBr = document.getElementById("legend-brasileirao");
  const lMin = document.getElementById("legend-mineiro"); // Ajustado para lMin
  const lLibertadores = document.getElementById("legend-libertadores");
  const lContainer = document.getElementById("legend-container");

  if (!lContainer) return;

  // Resetamos todas primeiro para facilitar
  if (lBr) lBr.style.display = "none";
  if (lMin) lMin.style.display = "none";
  if (lLibertadores) lLibertadores.style.display = "none";

  if (campeonato === "brasileirao") {
    if (lBr) lBr.style.display = "flex";
    lContainer.style.display = "block";
  } else if (campeonato === "libertadores") {
    if (lLibertadores) lLibertadores.style.display = "flex";
    lContainer.style.display = "block";
  } else if (campeonato === "mineiro") {
    if (lMin) lMin.style.display = "flex"; // Agora o nome da variável bate!
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
// MENU MOBILE
// ============================================
const initMobileMenu = () => {
  const menuToggle = document.getElementById("menuToggle");
  const navMenu = document.getElementById("navMenu");
  
  if (!menuToggle || !navMenu) return;
  
  menuToggle.addEventListener("click", () => {
    const isActive = navMenu.classList.contains("active");
    navMenu.classList.toggle("active");
    menuToggle.classList.toggle("active");
    menuToggle.setAttribute("aria-expanded", !isActive);
  });
  
  const navLinks = navMenu.querySelectorAll(".nav-link");
  navLinks.forEach(link => {
    link.addEventListener("click", () => {
      navMenu.classList.remove("active");
      menuToggle.classList.remove("active");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
};

// ============================================
// EXPOR FUNÇÕES GLOBAIS (usadas via onclick no HTML)
// ============================================
window.filtrarFaseMineiro = filtrarFaseMineiro;

// ============================================
// INICIALIZAÇÃO
// ============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initBrasileirao();
  });
} else {
  initMobileMenu();
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
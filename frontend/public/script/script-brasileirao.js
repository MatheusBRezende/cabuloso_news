/*====CONST UNIVERSAIS====*/
const CONFIG = {
  apiKey: null,
  intervaloAtualizacao: 30000,
  planilhaJogos: "1i3KjyXbLnyC-zt6ByPuuZFRe96PfhiXJRFGCPYG7l1c",
  intervaloJogos: "A2:F9",
  campeonatos: {
    brasileirao: {
      nome: "Brasileirão Série A 2025",
      sheetId: "1ubZ_5cXZYLLcFQnHGAqsWMDn59arVI8JynTpf4-kOa0",
      intervaloDados: "A1:M21",
      cor: "#0033A0",
    },
    "copa-do-brasil": {
      nome: "Copa do Brasil 2025",
      sheetId: "1nZdq87d-ZDpkosyYpFw1in2Q3KgI8V9_qlvnmhQcNG",
      intervaloDados: "A1:F10",
      cor: "#0033A0",
    },
  },
}

const escudos = {
  Flamengo:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Flamengo-RJ_%28BRA%29.png/50px-Flamengo-RJ_%28BRA%29.png",
  Palmeiras: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Palmeiras_logo.svg/50px-Palmeiras_logo.svg.png",
  "Red Bull Bragantino": "https://upload.wikimedia.org/wikipedia/pt/9/9e/RedBullBragantino.png",
  Cruzeiro:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/50px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png",
  Fluminense: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/FFC_crest.svg/50px-FFC_crest.svg.png",
  Internacional:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/SC_Internacional_Brazil_Logo.svg/50px-SC_Internacional_Brazil_Logo.svg.png",
  Bahia: "https://upload.wikimedia.org/wikipedia/pt/9/90/ECBahia.png",
  "São Paulo":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Brasao_do_Sao_Paulo_Futebol_Clube.svg/50px-Brasao_do_Sao_Paulo_Futebol_Clube.svg.png",
  Botafogo:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Botafogo_de_Futebol_e_Regatas_logo.svg/50px-Botafogo_de_Futebol_e_Regatas_logo.svg.png",
  Ceará:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Cear%C3%A1_Sporting_Club_logo.svg/50px-Cear%C3%A1_Sporting_Club_logo.svg.png",
  Vasco: "https://upload.wikimedia.org/wikipedia/pt/a/ac/CRVascodaGama.png",
  Corinthians: "https://upload.wikimedia.org/wikipedia/commons/c/c9/Escudo_sc_corinthians.png",
  Juventude: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/EC_Juventude.svg/50px-EC_Juventude.svg.png",
  Mirassol: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Mirassol_FC_logo.png",
  Fortaleza:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Fortaleza_EC_2018.png/50px-Fortaleza_EC_2018.png",
  Vitória: "https://upload.wikimedia.org/wikipedia/pt/3/34/Esporte_Clube_Vit%C3%B3ria_logo.png",
  "Atlético-MG":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Atletico_mineiro_galo.png/50px-Atletico_mineiro_galo.png",
  Grêmio: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Gremio_logo.svg/50px-Gremio_logo.svg.png",
  Santos: "https://upload.wikimedia.org/wikipedia/commons/1/15/Santos_Logo.png",
  Sport: "https://upload.wikimedia.org/wikipedia/pt/1/17/Sport_Club_do_Recife.png",
  "Vila Nova":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Vila_Nova_Logo_Oficial.svg/50px-Vila_Nova_Logo_Oficial.svg.png",
  "Mushuc Runa": "https://upload.wikimedia.org/wikipedia/pt/3/39/Mushuc_Runa_SC.png",
  Palestino: "https://upload.wikimedia.org/wikipedia/pt/7/72/CDPalestino.png",
  "Unión (Santa Fe)":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg/50px-Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg.png",
  "Unión Santa Fe":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg/50px-Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg.png",
  CRB: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/CRB_logo.svg/1024px-CRB_logo.svg.png",
}

// Estado global
let competicaoAtual = null
let dadosCarregados = {}

/*====API KEY====*/
async function fetchAPIKey() {
  try {
    const response = await fetch("/api/chave-google")
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`)
    const data = await response.json()
    if (!data.apiKey) throw new Error("Chave da API não encontrada na resposta")
    CONFIG.apiKey = data.apiKey
    return true
  } catch (error) {
    console.error("Falha ao carregar chave:", error)
    return false
  }
}

/*====INICIALIZAÇÃO====*/
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Inicializando aplicação...")
  const apiKeyLoaded = await fetchAPIKey()
  if (apiKeyLoaded) {
    await initApp()
  } else {
    mostrarErroGeral("Falha ao conectar com o servidor. Recarregue a página.")
    setTimeout(() => window.location.reload(), 30000)
  }
})

/*====FUNÇÃO PRINCIPAL====*/
async function initApp() {
  try {
    setupWidgetJogos()   
    await carregarProximosJogos()
    setupScrollEffects()

    const campeonatoSelecionado = localStorage.getItem("campeonatoSelecionado") || "brasileirao"
    const campeonatoSelect = document.getElementById("campeonato-select")
    if (campeonatoSelect) campeonatoSelect.value = campeonatoSelecionado

    await carregarTabela(campeonatoSelecionado)
    setupEventListeners()
    iniciarAtualizacaoPeriodica()
    
    // Verifica imediatamente ao carregar a página
    verificarEAjustarBotaoMinutoAMinuto()
    verificarJogosAoVivo() // Verifica também aqui para garantir

    // Intervalos de verificação
    setInterval(verificarEAjustarBotaoMinutoAMinuto, 60000)
    setInterval(verificarJogosAoVivo, 300000)
    verificarWidgetAutoAtivacao()

    console.log("Aplicação inicializada com sucesso!")
  } catch (error) {
    console.error("Erro na inicialização:", error)
    mostrarErroGeral("Erro ao carregar a aplicação. Por favor, recarregue a página.")
  }
}

/*====FUNÇÕES DE UTILIDADE GERAL====*/
function mostrarErroGeral(mensagem) {
  const container = document.createElement("div")
  container.className = "erro-geral"
  container.innerHTML = `
    <button class="fechar" onclick="this.parentElement.remove()">×</button>
    <div class="alert alert-danger">
      <i class="fas fa-exclamation-triangle"></i>
      <p>${mensagem}</p>
      <button onclick="window.location.reload()">Recarregar</button>
    </div>
  `
  document.body.prepend(container)
}

function formatarData() {
  return new Date()
    .toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    .replace(",", " -")
}

function setupEventListeners() {
  const campeonatoSelect = document.getElementById("campeonato-select")
  if (campeonatoSelect) {
    campeonatoSelect.addEventListener("change", async function () {
      const campeonato = this.value

      // Limpa dados anteriores
      limparDadosAnteriores()
      localStorage.setItem("campeonatoSelecionado", campeonato)

      const tabelaContainer = document.getElementById("tabela-container")
      if (tabelaContainer) {
        // Mostra loading com animação
        tabelaContainer.innerHTML = `
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Carregando ${CONFIG.campeonatos[campeonato]?.nome || "competição"}...</p>
          </div>
        `

        // Atualiza legendas
        atualizarLegendas(campeonato)

        // Carrega nova tabela
        await carregarTabela(campeonato)
      }
    })
  }
    // Mobile menu toggle
  const menuToggle = document.getElementById("menuToggle")
  const navMenu = document.getElementById("nav-menu")

  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => {
      menuToggle.classList.toggle("active")
      navMenu.classList.toggle("active")
    })

    // Close menu when clicking on links
    navMenu.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        menuToggle.classList.remove("active")
        navMenu.classList.remove("active")
      })
    })
  }
}

function limparDadosAnteriores() {
  dadosCarregados = {}
  const tabelaContainer = document.getElementById("tabela-container")
  if (tabelaContainer) {
    // Oculta jogos estáticos da Copa
    const staticGames = document.getElementById("copa-static-games")
    if (staticGames) staticGames.style.display = "none"
    tabelaContainer.innerHTML = ""
  }
  competicaoAtual = null
}

function setupScrollEffects() {
  const navbar = document.querySelector(".navbar")
  if (!navbar) return
  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      navbar.classList.add("scrolled")
    } else {
      navbar.classList.remove("scrolled")
    }
  })
}

/*====FUNÇÕES DE JOGOS====*/
async function carregarProximosJogos() {
  const container = document.querySelector(".games-list")
  if (!container) return

  container.innerHTML = `
    <div class="loading-jogos">
      <div class="spinner"></div>
      <p>Carregando próximos jogos...</p>
    </div>
  `

  try {
    // Tenta carregar da planilha primeiro
    if (CONFIG.apiKey) {
      try {
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.planilhaJogos}/values/PARTIDAS?key=${CONFIG.apiKey}`,
        )

        if (response.ok) {
          const data = await response.json()
          if (data.values && data.values.length > 0) {
            const jogos = processarDadosJogos(data.values)
            exibirJogosWidget(jogos)
            setupFiltrosJogos(jogos)
            verificarEAjustarBotaoMinutoAMinuto() // Adicione esta linha
            return
          }
        }
      } catch (error) {
        console.warn("Erro ao carregar jogos da planilha:", error)
      }
    }

    // Fallback para dados demo
    const jogosDemo = gerarJogosDemo()
    exibirJogosWidget(jogosDemo)
    setupFiltrosJogos(jogosDemo)
    verificarEAjustarBotaoMinutoAMinuto() // Adicione esta linha
  } catch (error) {
    console.error("Erro ao carregar jogos:", error)
    container.innerHTML = `
      <div class="error-jogos">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Erro ao carregar jogos. Tente novamente.</p>
      </div>
    `
  }
}

function gerarJogosDemo() {
  return [
    {
      data: "15/01",
      hora: "16:00",
      campeonato: "Campeonato Brasileiro",
      timeCasa: "Cruzeiro",
      escudoCasa: escudos.Cruzeiro,
      timeVisitante: "Flamengo",
      escudoVisitante: escudos.Flamengo,
      isCruzeiro: true,
      isMandante: true,
      aoVivo: false,
    },
    {
      data: "18/01",
      hora: "19:00",
      campeonato: "Copa do Brasil",
      timeCasa: "Palmeiras",
      escudoCasa: escudos.Palmeiras,
      timeVisitante: "Cruzeiro",
      escudoVisitante: escudos.Cruzeiro,
      isCruzeiro: true,
      isMandante: false,
      aoVivo: false,
    },
    {
      data: "22/01",
      hora: "20:30",
      campeonato: "Copa do Brasil",
      timeCasa: "Cruzeiro",
      escudoCasa: escudos.Cruzeiro,
      timeVisitante: "CRB",
      escudoVisitante: escudos.CRB,
      isCruzeiro: true,
      isMandante: true,
      aoVivo: false,
    },
  ]
}

function processarDadosJogos(dados) {
  let headerIndex = -1
  for (let i = 0; i < dados.length; i++) {
    const row = dados[i].map((cell) => (cell || "").toString().toUpperCase())
    if (row.includes("DATA") && (row.includes("JOGO") || row.includes("TIME") || row.includes("CAMPEONATO"))) {
      headerIndex = i
      break
    }
  }

  const linhas = dados.slice(headerIndex + 1).filter((row) => {
    return row && row.length >= 4 && row.some((cell) => !!cell && cell.toString().trim() !== "")
  })

  return linhas
    .map((jogo) => {
      // Data
      let dataFormatada = "--/--"
      if (typeof jogo[0] === "number") {
        const data = new Date((jogo[0] - 25569) * 86400 * 1000)
        dataFormatada = data.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
        })
      } else if (typeof jogo[0] === "string" && jogo[0].match(/\d{1,2}[/.]\d{1,2}/)) {
        dataFormatada = jogo[0].replace(/\./g, "/")
      } else if (typeof jogo[0] === "string") {
        dataFormatada = jogo[0]
      }

      // Times
      const timeCasa = (jogo[1] || "").trim()
      const timeVisitante = (jogo[3] || "").trim()

      // Hora
      let horaFormatada = "--:--"
      let aoVivo = false
      if (jogo[7] === "LIVE" || jogo[7] === "AO VIVO") {
        horaFormatada = "AO VIVO"
        aoVivo = true
      } else if (typeof jogo[7] === "string" && jogo[7].match(/^\d{2}:\d{2}$/)) {
        horaFormatada = jogo[7]
      } else if (typeof jogo[7] === "number") {
        const horaDecimal = Number.parseFloat(jogo[7])
        const horas = Math.floor(horaDecimal * 24)
        const minutos = Math.round((horaDecimal * 24 - horas) * 60)
        horaFormatada = `${horas.toString().padStart(2, "0")}:${minutos.toString().padStart(2, "0")}`
      } else if (jogo[4] && typeof jogo[4] === "string" && jogo[4].match(/^\d{2}:\d{2}$/)) {
        horaFormatada = jogo[4]
      } else {
        horaFormatada = jogo[7] || jogo[4] || "--:--"
      }

      // Campeonato
      const campeonato = formatarNomeCampeonato(jogo[6] || jogo[5] || "Campeonato Desconhecido")

      const isCruzeiro = timeCasa.toLowerCase().includes("cruzeiro") || timeVisitante.toLowerCase().includes("cruzeiro")
      const isMandante = timeCasa.toLowerCase().includes("cruzeiro")

      return {
        data: dataFormatada,
        hora: horaFormatada,
        campeonato: campeonato,
        timeCasa: timeCasa || "Time Desconhecido",
        escudoCasa: obterEscudoTime(timeCasa),
        timeVisitante: timeVisitante || "Time Desconhecido",
        escudoVisitante: obterEscudoTime(timeVisitante),
        isCruzeiro,
        isMandante,
        aoVivo,
      }
    })
    .filter(
      (jogo) =>
        jogo.timeCasa !== "DATA" &&
        jogo.timeCasa !== "Jogo" &&
        jogo.timeCasa !== "" &&
        jogo.timeCasa !== "Time" &&
        jogo.timeCasa !== "CAMPEONATO",
    )
    .sort((a, b) => {
      try {
        const dateA = new Date(a.data.split("/").reverse().join("-"))
        const dateB = new Date(b.data.split("/").reverse().join("-"))
        return dateA - dateB
      } catch {
        return 0
      }
    })
}

function formatarNomeCampeonato(nome) {
  const mapeamento = {
    "Campeonato Brasileiro": "Campeonato Brasileiro",
    "Copa do Brasil": "Copa do Brasil",
  }
  return mapeamento[nome] || nome
}

function obterEscudoTime(nomeTime) {
  if (!nomeTime || nomeTime.trim() === "") {
    return "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";
  }

  // Normaliza o nome do time
  const nomeNormalizado = nomeTime
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(ec|esporte clube|clube de regatas|sc)\s+/i, '')
    .replace(/\s+(fc|cf)$/i, '');

  // Verifica correspondência exata primeiro
  for (const [key, value] of Object.entries(escudos)) {
    const keyNormalizado = key
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(ec|esporte clube|clube de regatas|sc)\s+/i, '')
      .replace(/\s+(fc|cf)$/i, '');

    if (keyNormalizado === nomeNormalizado) {
      return value;
    }
  }

  // Verifica correspondência parcial
  for (const [key, value] of Object.entries(escudos)) {
    const keyNormalizado = key.toLowerCase();
    if (nomeNormalizado.includes(keyNormalizado) || keyNormalizado.includes(nomeNormalizado)) {
      return value;
    }
  }

  // Fallback para placeholder
  return "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png";
}

function exibirJogosWidget(jogos, filtro = "todos") {
  const container = document.querySelector(".games-list")
  if (!container) return

  let jogosFiltrados = jogos
  if (filtro !== "todos") {
    jogosFiltrados = jogos.filter(
      (jogo) => jogo.campeonato.includes(filtro) || (filtro === "Cruzeiro" && jogo.isCruzeiro),
    )
  }

  if (jogosFiltrados.length === 0) {
    container.innerHTML = `
      <div class="sem-jogos">
        <i class="far fa-calendar-times"></i>
        <p>Nenhum jogo ${
          filtro === "todos" ? "agendado" : filtro === "Cruzeiro" ? "do Cruzeiro" : `do(a) ${filtro}`
        }</p>
      </div>
    `
    return
  }

  container.innerHTML = jogosFiltrados
    .map(
      (jogo) => `
    <div class="jogo-widget ${jogo.isCruzeiro ? "cruzeiro" : ""} ${jogo.aoVivo ? "ao-vivo" : ""}">
      <div class="jogo-data">${jogo.data} - ${jogo.hora}</div>
      <div class="jogo-times">
        <div class="time ${jogo.isCruzeiro && jogo.isMandante ? "destaque" : ""}">
          <img src="${jogo.escudoCasa}" alt="${jogo.timeCasa}">
          <span>${jogo.timeCasa}</span>
        </div>
        <span class="vs">vs</span>
        <div class="time ${jogo.isCruzeiro && !jogo.isMandante ? "destaque" : ""}">
          <img src="${jogo.escudoVisitante}" alt="${jogo.timeVisitante}">
          <span>${jogo.timeVisitante}</span>
        </div>
      </div>
      <div class="jogo-campeonato">${jogo.campeonato}</div>
    </div>
  `,
    )
    .join("")
}

function setupFiltrosJogos(jogos) {
  const filtrosContainer = document.querySelector(".widget-filters")
  if (!filtrosContainer) return

  filtrosContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("filter-btn")) {
      document.querySelector(".filter-btn.active")?.classList.remove("active")
      e.target.classList.add("active")
      const filtro = e.target.dataset.filter
      exibirJogosWidget(jogos, filtro)
    }
  })
}

function verificarEAjustarBotaoMinutoAMinuto() {
  const btnContainer = document.getElementById("btn-minuto-a-minuto-container");
  if (!btnContainer) return;

  // Verifica se há algum jogo ao vivo do Cruzeiro
  const jogosAoVivo = document.querySelectorAll('.jogo-widget.ao-vivo.cruzeiro');
  
  if (jogosAoVivo.length > 0) {
    btnContainer.style.display = "block";
    const primeiroJogo = jogosAoVivo[0];
    
    // Extrai os dados do jogo
    const timeCasa = primeiroJogo.querySelector('.time.destaque span')?.textContent || '';
    const timeVisitante = primeiroJogo.querySelector('.time:not(.destaque) span')?.textContent || '';
    const escudoCasa = primeiroJogo.querySelector('.time.destaque img')?.src || obterEscudoTime(timeCasa);
    const escudoVisitante = primeiroJogo.querySelector('.time:not(.destaque) img')?.src || obterEscudoTime(timeVisitante);
    const campeonato = primeiroJogo.querySelector('.jogo-campeonato')?.textContent || 'Campeonato Desconhecido';
    
    // Atualiza o texto do botão
    document.getElementById("btn-ao-vivo-times").textContent = `${timeCasa} vs ${timeVisitante}`;
    
    // Atualiza o link do botão
    const link = btnContainer.querySelector('a');
    if (link) {
      link.href = `minuto-a-minuto.html?timeCasa=${encodeURIComponent(timeCasa)}` +
                  `&timeVisitante=${encodeURIComponent(timeVisitante)}` +
                  `&escudoCasa=${encodeURIComponent(escudoCasa)}` +
                  `&escudoVisitante=${encodeURIComponent(escudoVisitante)}` +
                  `&campeonato=${encodeURIComponent(campeonato)}`;
    }
  } else {
    btnContainer.style.display = "none";
  }
}

async function verificarJogosAoVivo() {
  console.log("Verificando jogos ao vivo...")
  
  try {
    // Atualiza a lista de jogos primeiro
    await carregarProximosJogos()
    
    // Depois verifica se há jogos ao vivo
    verificarEAjustarBotaoMinutoAMinuto()
  } catch (error) {
    console.error("Erro ao verificar jogos ao vivo:", error)
  }
}

/*====FUNÇÕES DE WIDGET====*/
function setupWidgetJogos() {
  const widgetToggleBtn = document.getElementById("widget-toggle");
  const widgetClose = document.getElementById("widget-close");
  const widget = document.getElementById("games-widget");

  if (!widgetToggleBtn || !widgetClose || !widget) return;

  // Inicialmente esconde o widget
  widget.classList.remove("visible");

  const toggleWidget = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    widget.classList.toggle("visible");
  };

  widgetToggleBtn.addEventListener("click", toggleWidget);
  widgetClose.addEventListener("click", toggleWidget);

  // Fecha ao clicar fora
  document.addEventListener("click", (e) => {
    if (!widget.contains(e.target) && !widgetToggleBtn.contains(e.target)) {
      widget.classList.remove("visible");
    }
  });

  widget.addEventListener("click", (e) => e.stopPropagation());
}

/*====FUNÇÕES DE TABELA====*/
async function carregarTabela(campeonato = "brasileirao") {
  const config = CONFIG.campeonatos[campeonato]
  const tabelaContainer = document.getElementById("tabela-container")

  if (!config || !tabelaContainer) {
    console.error("Configuração do campeonato ou container não encontrado")
    return
  }

  // Evita recarregar a mesma competição
  if (competicaoAtual === campeonato && dadosCarregados[campeonato]) {
    return
  }

  competicaoAtual = campeonato

  const campeonatoNome = document.getElementById("campeonato-nome")
  if (campeonatoNome) campeonatoNome.textContent = config.nome

  if (campeonato === "copa-do-brasil") {
    console.log("Carregando Copa do Brasil...")

    try {
      let jogosCopa = []

      // Tenta carregar dados da planilha primeiro
      if (CONFIG.apiKey) {
        try {
          console.log("Tentando carregar dados da Copa do Brasil da planilha...")
          const timestamp = new Date().getTime()
          const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.planilhaJogos}/values/PARTIDAS?key=${CONFIG.apiKey}&t=${timestamp}`,
          )

          if (response.ok) {
            const data = await response.json()
            if (data.values && data.values.length > 0) {
              const jogos = processarDadosJogos(data.values)
              jogosCopa = jogos.filter((jogo) => jogo.campeonato.includes("Copa do Brasil") && jogo.isCruzeiro)
              console.log("Dados da Copa carregados:", jogosCopa)
            }
          }
        } catch (error) {
          console.warn("Erro ao carregar Copa da planilha, usando dados estáticos:", error)
        }
      }

      // Se não conseguiu carregar ou não há dados, usa fallback
      if (jogosCopa.length === 0) {
        jogosCopa = gerarJogosCopaDemonstração()
      }

      // Gera HTML da Copa do Brasil
      if (jogosCopa.length > 0) {
        tabelaContainer.innerHTML = gerarHTMLCopaDoBrasil(jogosCopa)
      } else {
        // Fallback para jogos estáticos do HTML
        const loading = tabelaContainer.querySelector(".loading-state")
        const staticGames = document.getElementById("copa-static-games")

        if (loading) loading.style.display = "none"
        if (staticGames) staticGames.style.display = "block"
      }

      dadosCarregados[campeonato] = true
      console.log("Copa do Brasil carregada com sucesso!")
    } catch (error) {
      console.error("Erro ao carregar Copa do Brasil:", error)

      // Fallback para jogos estáticos
      const loading = tabelaContainer.querySelector(".loading-state")
      const staticGames = document.getElementById("copa-static-games")

      if (loading) loading.style.display = "none"
      if (staticGames) staticGames.style.display = "block"

      dadosCarregados[campeonato] = true
    }

    return
  }

  // Para o Brasileirão, tenta carregar dados reais
  try {
    let dados = null

    if (CONFIG.apiKey) {
      try {
        const timestamp = new Date().getTime()
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/${config.intervaloDados}?key=${CONFIG.apiKey}&t=${timestamp}`
        const response = await fetch(url)

        if (response.ok) {
          const data = await response.json()
          if (data.values) {
            dados = data.values
            console.log("Dados carregados da planilha:", dados.length, "linhas")
          }
        }
      } catch (error) {
        console.warn("Erro ao carregar da planilha, usando dados demo:", error)
      }
    }

    // Se não conseguiu carregar, usa dados demo
    if (!dados) {
      dados = gerarDadosBrasileiraoDemonstração()
    }

    tabelaContainer.innerHTML = gerarHTMLTabela(dados)
    dadosCarregados[campeonato] = true
  } catch (error) {
    console.error(`Erro ao carregar tabela do ${campeonato}:`, error)
    tabelaContainer.innerHTML = `
      <div class="error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Erro ao carregar dados. Tentando novamente...</p>
      </div>
    `
  }
}

function gerarDadosBrasileiraoDemonstração() {
  return [
    ["Pos", "Time", "Pts", "J", "V", "E", "D", "GC", "GP", "SG", "Apr%"],
    ["1º", "Flamengo", "24", "11", "7", "3", "1", "4", "24", "20", "73%"],
    ["2º", "Cruzeiro", "24", "12", "7", "3", "2", "8", "17", "9", "67%"],
    ["3º", "Red Bull Bragantino", "23", "12", "7", "2", "3", "11", "14", "3", "64%"],
    ["4º", "Palmeiras", "22", "11", "7", "1", "3", "8", "12", "4", "67%"],
    ["5º", "Bahia", "21", "12", "6", "3", "3", "11", "14", "3", "58%"],
    ["6º", "Fluminense", "20", "11", "6", "2", "3", "12", "15", "3", "61%"],
  ]
}

function gerarJogosCopaDemonstração() {
  return [
    {
      data: "20/01",
      hora: "16:00",
      timeCasa: "Cruzeiro",
      timeVisitante: "CRB",
      fase: "3ª Fase - Ida",
      placar: "2 x 0",
      escudoCasa: escudos.Cruzeiro,
      escudoVisitante: escudos.CRB,
      isCruzeiro: true,
      isMandante: true,
      campeonato: "Copa do Brasil",
    },
    {
      data: "27/01",
      hora: "19:30",
      timeCasa: "CRB",
      timeVisitante: "Cruzeiro",
      fase: "3ª Fase - Volta",
      placar: "",
      escudoCasa: escudos.CRB,
      escudoVisitante: escudos.Cruzeiro,
      isCruzeiro: true,
      isMandante: false,
      campeonato: "Copa do Brasil",
    },
  ]
}

function gerarHTMLTabela(dados) {
  if (!dados || dados.length === 0) {
    return '<div class="error">Nenhum dado disponível</div>'
  }

  const hasHeader = dados[0] && dados[0].length > 0
  const startRow = hasHeader ? 1 : 0

  let html = `
    <table id="tabela-brasileirao">
      <thead>
        <tr>
          <th>Pos</th>
          <th class="time-header">Time</th>
          <th>Pts</th>
          <th>J</th>
          <th>V</th>
          <th>E</th>
          <th>D</th>
          <th>GC</th>
          <th>GP</th>
          <th>SG</th>
          <th>apr%</th>
        </tr>
      </thead>
      <tbody>
  `

  for (let i = startRow; i < dados.length; i++) {
    const row = dados[i]
    const nomeTime = row[1]
      .replace(/^\d+°\s*/, "")
      .replace(/\s[A-Z]{2,4}$/, "")
      .trim()

    const posicaoClass = getPositionClass(i)
    const cruzeiroClass = isCruzeiro(nomeTime) ? "cruzeiro" : ""
    const escudoTime = escudos[nomeTime] || "/placeholder.svg?height=30&width=30"

    html += `
      <tr class="${posicaoClass} ${cruzeiroClass}">
        <td class="posicao">${i}º</td>
        <td class="time">
          <img src="${escudoTime}" alt="${nomeTime}" class="escudo" loading="lazy">
          <span>${nomeTime}</span>
        </td>
        <td>${row[2] || 0}</td>
        <td>${row[3] || 0}</td>
        <td>${row[4] || 0}</td>
        <td>${row[5] || 0}</td>
        <td>${row[6] || 0}</td>
        <td>${row[7] || 0}</td>
        <td>${row[8] || 0}</td>
        <td>${row[9] || 0}</td>
        <td>${row[10] || 0}</td>
      </tr>
    `
  }

  return html + "</tbody></table>"
}

function gerarHTMLCopaDoBrasil(jogos) {
  if (!jogos || jogos.length === 0) {
    return `
      <div class="aviso-sem-jogos-copa">
        <div class="aviso-icon">
          <i class="fas fa-info-circle"></i>
        </div>
        <div class="aviso-content">
          <h3>Nenhuma partida agendada</h3>
          <p>Até o momento não há jogos confirmados para o Cruzeiro na Copa do Brasil 2025.</p>
          <p>Fique atento às atualizações!</p>
        </div>
      </div>
    `
  }

  // Agrupa jogos por fase
  const jogosPorFase = jogos.reduce((acc, jogo) => {
    const fase = jogo.fase || "Fase não definida"
    if (!acc[fase]) {
      acc[fase] = []
    }
    acc[fase].push(jogo)
    return acc
  }, {})

  let html = ""

  // Cria uma seção para cada fase
  for (const [fase, jogosFase] of Object.entries(jogosPorFase)) {
    html += `
      <div class="fase-copa fade-in-up">
        <h3><i class="fas fa-trophy"></i> ${fase} - Copa do Brasil 2025</h3>
        ${jogosFase.map((jogo) => gerarHTMLJogoCopa(jogo)).join("")}
      </div>
    `
  }

  return html
}

function gerarHTMLJogoCopa(jogo) {
  const isResultado = jogo.placar && jogo.placar.trim() !== ""

  return `
    <div class="jogo-copa ${jogo.isCruzeiro ? "destaque-cruzeiro" : ""}">
      <div class="cabecalho-jogo-copa">
        <span class="fase-jogo">
          <i class="fas fa-${isResultado ? "check-circle" : "calendar-alt"}"></i>
          ${jogo.fase || "Fase não definida"}
        </span>
        <span class="data-jogo-copa">
          <i class="far fa-clock"></i>
          ${jogo.data} - ${jogo.hora}
        </span>
        ${
          isResultado
            ? `
          <span class="placar-jogo">
            <i class="fas fa-futbol"></i>
            ${jogo.placar}
          </span>
        `
            : ""
        }
      </div>
      <div class="times-jogo-copa">
        <div class="time-casa ${jogo.isCruzeiro && jogo.isMandante ? "destaque" : ""}">
          <span>${jogo.timeCasa}</span>
          <img src="${jogo.escudoCasa}" alt="${jogo.timeCasa}" loading="lazy">
        </div>
        <span class="vs">VS</span>
        <div class="time-visitante ${jogo.isCruzeiro && !jogo.isMandante ? "destaque" : ""}">
          <img src="${jogo.escudoVisitante}" alt="${jogo.timeVisitante}" loading="lazy">
          <span>${jogo.timeVisitante}</span>
        </div>
      </div>
    </div>
  `
}

function getPositionClass(position) {
  const posNum = typeof position === "string" ? Number.parseInt(position.replace("º", "")) : position

  if (posNum <= 4) return "pos1-4"
  if (posNum <= 6) return "pos5-6"
  if (posNum <= 12) return "pos7-12"
  if (posNum <= 16) return "pos13-16"
  return "pos17-20"
}

function isCruzeiro(nomeTime) {
  return nomeTime && nomeTime.toLowerCase().includes("cruzeiro")
}

function atualizarLegendas(campeonato) {
  const legendGroups = document.querySelectorAll(".legend-group");
  const legendDescription = document.querySelector(".legend-description");
  
  // Atualiza o texto explicativo
  if (legendDescription) {
    const textos = {
      "brasileirao": "As cores na tabela representam as classificações para Libertadores, Pré-Libertadores , Sul-Americana e rebaixamento:",
    };
    
    legendDescription.innerHTML = `<p>${textos[campeonato] || "As cores na tabela representam as diferentes classificações:"}</p>`;
  }
  
  // Mostra/oculta os grupos de legenda
  legendGroups.forEach(group => {
    if (group.dataset.campeonato === campeonato) {
      group.style.display = "flex";
    } else {
      group.style.display = "none";
    }
  });
}

function iniciarAtualizacaoPeriodica() {
  // Inicializa dados se não existirem
  if (!localStorage.getItem("dadosTimes")) {
    localStorage.setItem("dadosTimes", JSON.stringify({}))
  }

  // Atualiza a cada 30 segundos
  setInterval(() => {
    const campeonatoSelect = document.getElementById("campeonato-select")
    const campeonato = campeonatoSelect?.value || "brasileirao"

    // Só atualiza se não mudou de competição recentemente
    if (competicaoAtual === campeonato) {
      carregarTabela(campeonato)
    }
  }, CONFIG.intervaloAtualizacao)
}

function verificarWidgetAutoAtivacao() {
  const urlParams = new URLSearchParams(window.location.search);
  const widgetParam = urlParams.get("widget");

  if (widgetParam === "jogos") {
    const widgetToggle = document.getElementById("widget-toggle");
    const widget = document.getElementById("games-widget");

    if (widgetToggle && widget) {
      // Abre o widget automaticamente
      widget.classList.add("visible");
      
      // Rola a página até o widget (opcional)
      setTimeout(() => {
        widget.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 300);
    }
  }
}

// Inicializa legendas no carregamento
window.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("campeonato-select")
  if (select) {
    atualizarLegendas(select.value)
  }
})

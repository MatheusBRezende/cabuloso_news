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
  Corinthians:
    "https://upload.wikimedia.org/wikipedia/en/thumb/5/5a/Sport_Club_Corinthians_Paulista_crest.svg/800px-Sport_Club_Corinthians_Paulista_crest.svg.png",
  Juventude: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/EC_Juventude.svg/50px-EC_Juventude.svg.png",
  Mirassol: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Mirassol_FC_logo.png",
  Fortaleza:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Fortaleza_EC_2018.png/50px-Fortaleza_EC_2018.png",
  Vitória: "https://upload.wikimedia.org/wikipedia/pt/3/34/Esporte_Clube_Vit%C3%B4ria_logo.png",
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

  // Mobile menu toggle - CORREÇÃO PRINCIPAL AQUI
  const menuToggle = document.getElementById("menuToggle")
  const navMenu = document.getElementById("nav-menu")

  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()

      menuToggle.classList.toggle("active")
      navMenu.classList.toggle("active")

      // Prevent body scroll when menu is open
      if (navMenu.classList.contains("active")) {
        document.body.classList.add("menu-open")
      } else {
        document.body.classList.remove("menu-open")
      }
    })

    // Close menu when clicking on links
    navMenu.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        menuToggle.classList.remove("active")
        navMenu.classList.remove("active")
        document.body.classList.remove("menu-open")
      })
    })

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!menuToggle.contains(e.target) && !navMenu.contains(e.target)) {
        menuToggle.classList.remove("active")
        navMenu.classList.remove("active")
        document.body.classList.remove("menu-open")
      }
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
            return
          }
        }
      } catch (error) {
        console.warn("Erro ao carregar jogos da planilha:", error)
      }
    }

    container.innerHTML = `
      <div class="aviso-sem-jogos-copa">
        <div class="aviso-icon">
          <i class="fas fa-clock"></i>
        </div>
        <div class="aviso-content">
          <h3>AGUARDE ATÉ A INFORMAÇÃO DE PRÓXIMOS JOGOS DA COPA DO BRASIL</h3>
          <p>As informações dos próximos jogos serão atualizadas em breve.</p>
          <p>Acompanhe o Cruzeiro em todas as competições!</p>
        </div>
      </div>
    `
  } catch (error) {
    console.error("Erro ao carregar jogos:", error)
    container.innerHTML = `
      <div class="aviso-sem-jogos-copa">
        <div class="aviso-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div class="aviso-content">
          <h3>AGUARDE ATÉ A INFORMAÇÃO DE PRÓXIMOS JOGOS DA COPA DO BRASIL</h3>
          <p>Erro ao carregar dados. As informações serão atualizadas em breve.</p>
          <p>Tente novamente mais tarde.</p>
        </div>
      </div>
    `
  }
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
      const colunaC = (jogo[2] || "").trim()
      const timeVisitante = (jogo[3] || "").trim()

      // Hora - CORREÇÃO PRINCIPAL AQUI
      let horaFormatada = "--:--"
      let aoVivo = false
      if (jogo[4] === "LIVE" || jogo[4] === "AO VIVO") {
        horaFormatada = "AO VIVO"
        aoVivo = true
      } else if (typeof jogo[4] === "string" && jogo[4].match(/^\d{2}:\d{2}$/)) {
        horaFormatada = jogo[4]
      } else if (typeof jogo[4] === "number") {
        const horaDecimal = Number.parseFloat(jogo[4])
        const horas = Math.floor(horaDecimal * 24)
        const minutos = Math.round((horaDecimal * 24 - horas) * 60)
        horaFormatada = `${horas.toString().padStart(2, "0")}:${minutos.toString().padStart(2, "0")}`
      } else {
        horaFormatada = jogo[4] || "--:--"
      }

      // Campeonato
      const campeonato = formatarNomeCampeonato(jogo[5] || "Campeonato Desconhecido")

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
        colunaC: colunaC,
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
    return "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
  }

  // Normaliza o nome do time
  const nomeNormalizado = nomeTime
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(ec|esporte clube|clube de regatas|sc)\s+/i, "")
    .replace(/\s+(fc|cf)$/i, "")

  // Verifica correspondência exata primeiro
  for (const [key, value] of Object.entries(escudos)) {
    const keyNormalizado = key
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^(ec|esporte clube|clube de regatas|sc)\s+/i, "")
      .replace(/\s+(fc|cf)$/i, "")

    if (keyNormalizado === nomeNormalizado) {
      return value
    }
  }

  // Verifica correspondência parcial
  for (const [key, value] of Object.entries(escudos)) {
    const keyNormalizado = key.toLowerCase()
    if (nomeNormalizado.includes(keyNormalizado) || keyNormalizado.includes(nomeNormalizado)) {
      return value
    }
  }

  // Fallback para placeholder
  return "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
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
    .map((jogo) => {
      let faseInfo = ""
      const colunaC = jogo.colunaC || ""

      if (colunaC.toLowerCase().includes("ida")) {
        faseInfo = `
            <div class="match-phase">
              <i class="fas fa-arrow-right"></i>
              <span>Jogo de Ida</span>
            </div>
          `
      } else if (colunaC.toLowerCase().includes("volta")) {
        faseInfo = `
            <div class="match-phase">
              <i class="fas fa-arrow-left"></i>
              <span>Jogo de Volta</span>
            </div>
          `
      }
      return `
          <div class="jogo-widget ${jogo.isCruzeiro ? "cruzeiro" : ""} ${jogo.aoVivo ? "ao-vivo" : ""}">
            <div class="jogo-data">${jogo.data} - ${jogo.hora}</div>
            ${faseInfo}
            <div class="jogo-times">
              <div class="time ${jogo.isCruzeiro && jogo.isMandante ? "destaque" : ""}">
                <img src="${jogo.escudoCasa}" alt="${jogo.timeCasa}">
                <span>${jogo.timeCasa}</span>
              </div>
              <div class="match-separator">
                <div class="separator-dots">
                  <div class="dot"></div>
                  <div class="separator-line"></div>
                  <div class="dot"></div>
                </div>
              </div>
              <div class="time ${jogo.isCruzeiro && !jogo.isMandante ? "destaque" : ""}">
                <img src="${jogo.escudoVisitante}" alt="${jogo.timeVisitante}">
                <span>${jogo.timeVisitante}</span>
              </div>
            </div>
            <div class="jogo-campeonato">${jogo.campeonato}</div>
          </div>
        `
    })
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
  const btnContainer = document.getElementById("btn-minuto-a-minuto-container")
  if (!btnContainer) return

  const jogosAoVivo = document.querySelectorAll(".jogo-widget.ao-vivo.cruzeiro")

  if (jogosAoVivo.length > 0) {
    btnContainer.style.display = "block"
    const primeiroJogo = jogosAoVivo[0]

    // Obter todos os dados necessários
    const timeCasa = primeiroJogo.querySelector(".time.destaque span")?.textContent || ""
    const timeVisitante = primeiroJogo.querySelector(".time:not(.destaque) span")?.textContent || ""
    const escudoCasa = primeiroJogo.querySelector(".time.destaque img")?.src || obterEscudoTime(timeCasa)
    const escudoVisitante =
      primeiroJogo.querySelector(".time:not(.destaque) img")?.src || obterEscudoTime(timeVisitante)
    const campeonato = primeiroJogo.querySelector(".jogo-campeonato")?.textContent || "Campeonato Desconhecido"

    document.getElementById("btn-ao-vivo-times").textContent = `${timeCasa} vs ${timeVisitante}`

    const link = btnContainer.querySelector("a")
    if (link) {
      link.href =
        `minuto-a-minuto.html?timeCasa=${encodeURIComponent(timeCasa)}` +
        `&timeVisitante=${encodeURIComponent(timeVisitante)}` +
        `&escudoCasa=${encodeURIComponent(escudoCasa)}` +
        `&escudoVisitante=${encodeURIComponent(escudoVisitante)}` +
        `&campeonato=${encodeURIComponent(campeonato)}`
    }
  } else {
    btnContainer.style.display = "none"
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
  const widgetToggle = document.getElementById("widget-toggle")
  const widgetClose = document.getElementById("widget-close")
  const widget = document.getElementById("games-widget")

  if (!widgetToggle || !widgetClose || !widget) return

  // Mostra o widget por padrão
  widget.classList.add("visible")
  widgetToggle.classList.add("active")

  const toggleWidget = (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    widget.classList.toggle("visible")
    widgetToggle.classList.toggle("active")
  }

  widgetToggle.addEventListener("click", toggleWidget)
  widgetClose.addEventListener("click", toggleWidget)

  // Fecha ao clicar fora
  document.addEventListener("click", (e) => {
    if (!widget.contains(e.target) && !widgetToggle.contains(e.target)) {
      widget.classList.remove("visible")
      widgetToggle.classList.remove("active")
    }
  })

  widget.addEventListener("click", (e) => e.stopPropagation())
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

  atualizarLegendas(campeonato)

  if (campeonato === "copa-do-brasil") {
    console.log("Carregando Copa do Brasil...")

    try {
      const dadosCopa = gerarDadosCopaDoBrasil()
      tabelaContainer.innerHTML = gerarTabelaCopaDoBrasil(dadosCopa)

      dadosCarregados[campeonato] = true
      console.log("Copa do Brasil carregada com sucesso!")
    } catch (error) {
      console.error("Erro ao carregar Copa do Brasil:", error)
      tabelaContainer.innerHTML = `
        <div class="error-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Erro ao carregar dados da Copa do Brasil</p>
        </div>
      `
    }
  } else {
    // Código original para Brasileirão
    try {
      console.log(`Carregando ${config.nome}...`)

      if (!CONFIG.apiKey) {
        console.warn("API Key não configurada, usando dados de demonstração")
        const dadosDemo = gerarDadosDemonstracao(campeonato)
        tabelaContainer.innerHTML = gerarTabelaHTML(dadosDemo, campeonato)
        dadosCarregados[campeonato] = true
        return
      }

      const timestamp = new Date().getTime()
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${config.planilhaId}/values/${config.aba}?key=${CONFIG.apiKey}&t=${timestamp}`,
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (!data.values || data.values.length === 0) {
        throw new Error("Nenhum dado encontrado na planilha")
      }

      const dadosProcessados = processarDados(data.values, campeonato)
      tabelaContainer.innerHTML = gerarTabelaHTML(dadosProcessados, campeonato)

      dadosCarregados[campeonato] = true
      console.log(`${config.nome} carregado com sucesso!`)
    } catch (error) {
      console.error(`Erro ao carregar ${config.nome}:`, error)

      const dadosDemo = gerarDadosDemonstracao(campeonato)
      tabelaContainer.innerHTML = gerarTabelaHTML(dadosDemo, campeonato)
      dadosCarregados[campeonato] = true

      console.log(`Usando dados de demonstração para ${config.nome}`)
    }
  }
}

function gerarDadosCopaDoBrasil() {
  return [
    {
      time: "Cruzeiro",
      escudo:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/50px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png",
      situacao: "Ativo",
      fase: "Oitavas de Final",
      proximoJogo: "vs Flamengo - 15/02",
      resultado: "2x0 vs CRB",
      isCruzeiro: true,
    },
    {
      time: "Flamengo",
      escudo: "https://logoeps.com/wp-content/uploads/2013/03/flamengo-vector-logo.png",
      situacao: "Ativo",
      fase: "Oitavas de Final",
      proximoJogo: "vs Cruzeiro - 15/02",
      resultado: "3x1 vs Vasco",
      isCruzeiro: false,
    },
    {
      time: "Palmeiras",
      escudo: "https://logoeps.com/wp-content/uploads/2013/03/palmeiras-vector-logo.png",
      situacao: "Ativo",
      fase: "Oitavas de Final",
      proximoJogo: "vs São Paulo - 16/02",
      resultado: "1x0 vs Santos",
      isCruzeiro: false,
    },
    {
      time: "Corinthians",
      escudo: "https://logoeps.com/wp-content/uploads/2013/03/corinthians-vector-logo.png",
      situacao: "Eliminado",
      fase: "3ª Fase",
      proximoJogo: "-",
      resultado: "0x2 vs Grêmio",
      isCruzeiro: false,
    },
  ]
}

function gerarTabelaCopaDoBrasil(dados) {
  let html = `
    <div class="copa-brasil-table-container">
      <table id="tabela-copa-brasil">
        <thead>
          <tr>
            <th>Time</th>
            <th>Situação</th>
            <th>Fase</th>
            <th>Próximo Jogo</th>
            <th>Último Resultado</th>
          </tr>
        </thead>
        <tbody>
  `

  dados.forEach((time) => {
    const rowClass = time.isCruzeiro
      ? "cruzeiro-row"
      : time.situacao === "Ativo"
        ? "copa-status-ativo"
        : time.situacao === "Eliminado"
          ? "copa-status-eliminado"
          : "copa-status-classificado"

    html += `
      <tr class="${rowClass}">
        <td>
          <div class="time">
            <img src="${time.escudo}" alt="${time.time}" class="escudo" loading="lazy">
            <span>${time.time}</span>
          </div>
        </td>
        <td><strong>${time.situacao}</strong></td>
        <td>${time.fase}</td>
        <td>${time.proximoJogo}</td>
        <td>${time.resultado}</td>
      </tr>
    `
  })

  html += `
        </tbody>
      </table>
    </div>
  `

  return html
}

function gerarDadosDemonstracao(campeonato) {
  if (campeonato === "brasileirao") {
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
  return []
}

function gerarTabelaHTML(dados, campeonato) {
  if (!dados || dados.length === 0) {
    return '<div class="error">Nenhum dado disponível</div>'
  }

  const hasHeader = dados[0] && dados[0].length > 0
  const startRow = hasHeader ? 1 : 0

  let html = ``
  if (campeonato === "brasileirao") {
    html = `
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
  }

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

  if (campeonato === "brasileirao") {
    html += `
        </tbody>
      </table>
    `
  }

  return html
}

function atualizarLegendas(campeonato) {
  const legendGroups = document.querySelectorAll(".legend-group")

  legendGroups.forEach((group) => {
    group.style.display = "none"
  })

  const activeGroup = document.querySelector(`[data-campeonato="${campeonato}"]`)
  if (activeGroup) {
    activeGroup.style.display = "grid"
  }

  if (campeonato === "copa-do-brasil") {
    const legendContainer = document.querySelector(".legend")
    if (legendContainer) {
      // Remove legenda existente da Copa do Brasil se houver
      const existingCopaLegend = legendContainer.querySelector('[data-campeonato="copa-do-brasil"]')
      if (existingCopaLegend) {
        existingCopaLegend.remove()
      }

      // Cria nova legenda para Copa do Brasil
      const copaLegendHTML = `
        <div class="legend-group" data-campeonato="copa-do-brasil" style="display: grid;">
          <div class="legend-item">
            <span class="legend-color copa-ativo"></span>
            <span class="legend-text">
              <strong>Ativo na Competição</strong>
              <small>Time ainda disputando</small>
            </span>
          </div>
          <div class="legend-item">
            <span class="legend-color copa-eliminado"></span>
            <span class="legend-text">
              <strong>Eliminado</strong>
              <small>Fora da competição</small>
            </span>
          </div>
          <div class="legend-item">
            <span class="legend-color copa-classificado"></span>
            <span class="legend-text">
              <strong>Classificado</strong>
              <small>Avançou de fase</small>
            </span>
          </div>
          <div class="legend-item special">
            <span class="legend-color cruzeiro"></span>
            <span class="legend-text">
              <strong>Cruzeiro</strong>
              <small>Maior de Minas</small>
            </span>
          </div>
        </div>
      `

      legendContainer.insertAdjacentHTML("beforeend", copaLegendHTML)
    }
  }
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
  const urlParams = new URLSearchParams(window.location.search)
  const widgetParam = urlParams.get("widget")

  if (widgetParam === "jogos") {
    const widgetToggle = document.getElementById("widget-toggle")
    const widget = document.getElementById("games-widget")

    if (widgetToggle && widget) {
      // Simula o clique para abrir o widget
      widgetToggle.click()

      // Rola a página até o widget (opcional)
      setTimeout(() => {
        widget.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }, 300)
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

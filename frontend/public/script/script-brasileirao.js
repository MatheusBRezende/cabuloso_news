/*====CONST UNIVERSAIS====*/
const CONFIG = {
<<<<<<< HEAD
  apiKey: null,
=======
  apiKey: "AIzaSyDummyKeyForDemo", // Substitua pela sua chave real
>>>>>>> 59feaf8 (.)
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
      sheetId: "1i3KjyXbLnyC-zt6ByPuuZFRe96PfhiXJRFGCPYG7l1c",
      intervaloDados: "A1:F10",
      cor: "#0033A0",
    },
  },
<<<<<<< HEAD
};
=======
}
>>>>>>> 59feaf8 (.)

const escudos = {
  Flamengo:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Flamengo-RJ_%28BRA%29.png/50px-Flamengo-RJ_%28BRA%29.png",
<<<<<<< HEAD
  Palmeiras:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Palmeiras_logo.svg/50px-Palmeiras_logo.svg.png",
  "Red Bull Bragantino":
    "https://upload.wikimedia.org/wikipedia/pt/9/9e/RedBullBragantino.png",
  Cruzeiro:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/50px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png",
  Fluminense:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/FFC_crest.svg/50px-FFC_crest.svg.png",
=======
  Palmeiras: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Palmeiras_logo.svg/50px-Palmeiras_logo.svg.png",
  "Red Bull Bragantino": "https://upload.wikimedia.org/wikipedia/pt/9/9e/RedBullBragantino.png",
  Cruzeiro:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/50px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png",
  Fluminense: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/FFC_crest.svg/50px-FFC_crest.svg.png",
>>>>>>> 59feaf8 (.)
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
<<<<<<< HEAD
  Corinthians:
    "https://upload.wikimedia.org/wikipedia/commons/c/c9/Escudo_sc_corinthians.png",
  Juventude:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/EC_Juventude.svg/50px-EC_Juventude.svg.png",
  Mirassol:
    "https://upload.wikimedia.org/wikipedia/commons/5/5b/Mirassol_FC_logo.png",
  Fortaleza:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Fortaleza_EC_2018.png/50px-Fortaleza_EC_2018.png",
  Vitória:
    "https://upload.wikimedia.org/wikipedia/pt/3/34/Esporte_Clube_Vit%C3%B3ria_logo.png",
  "Atlético-MG":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Atletico_mineiro_galo.png/50px-Atletico_mineiro_galo.png",
  Grêmio:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Gremio_logo.svg/50px-Gremio_logo.svg.png",
  Santos: "https://upload.wikimedia.org/wikipedia/commons/1/15/Santos_Logo.png",
  Sport:
    "https://upload.wikimedia.org/wikipedia/pt/1/17/Sport_Club_do_Recife.png",
  "Vila Nova":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Vila_Nova_Logo_Oficial.svg/50px-Vila_Nova_Logo_Oficial.svg.png",
  "Mushuc Runa":
    "https://upload.wikimedia.org/wikipedia/pt/3/39/Mushuc_Runa_SC.png",
  Palestino: "https://upload.wikimedia.org/wikipedia/pt/7/72/CDPalestino.png",
  "Unión (Santa Fe)":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg/50px-Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg.png",
  "Unión Santa Fe":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg/50px-Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg.png",
};

/*====API KEY====*/
async function fetchAPIKey() {
  try {
    const response = await fetch("/api/chave-google");
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const data = await response.json();
    if (!data.apiKey)
      throw new Error("Chave da API não encontrada na resposta");
    CONFIG.apiKey = data.apiKey;
    return true;
  } catch (error) {
    console.error("Falha ao carregar chave:", error);
    return false;
  }
}

/*====INICIALIZAÇÃO====*/
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Inicializando aplicação...");
  const apiKeyLoaded = await fetchAPIKey();
  if (apiKeyLoaded) {
    await initApp();
  } else {
    mostrarErroGeral("Falha ao conectar com o servidor. Recarregue a página.");
    setTimeout(() => window.location.reload(), 30000);
  }
});
=======
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
    CRB:"https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/CRB_logo.svg/1024px-CRB_logo.svg.png",
}

// Estado global para controlar a competição atual
let competicaoAtual = null
let dadosCarregados = {}

/*====INICIALIZAÇÃO====*/
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Inicializando aplicação...")
  await initApp()
})
>>>>>>> 59feaf8 (.)

/*====FUNÇÃO PRINCIPAL====*/
async function initApp() {
  try {
<<<<<<< HEAD
    setupWidgetJogos();
    setupMobileNavigation();
    await carregarProximosJogos();

    setupScrollEffects();
    const campeonatoSelecionado =
      localStorage.getItem("campeonatoSelecionado") || "brasileirao";
    const campeonatoSelect = document.getElementById("campeonato-select");
    if (campeonatoSelect) campeonatoSelect.value = campeonatoSelecionado;
    await carregarTabela(campeonatoSelecionado);
    setupEventListeners();
    setupBackToTop();
    iniciarAtualizacaoPeriodica();

    verificarEAjustarBotaoMinutoAMinuto();
    setInterval(verificarEAjustarBotaoMinutoAMinuto, 60000);
    setInterval(verificarJogosAoVivo, 300000);

  
    verificarWidgetAutoAtivacao();

    console.log("Aplicação inicializada com sucesso!");
  } catch (error) {
    console.error("Erro na inicialização:", error);
    mostrarErroGeral(
      "Erro ao carregar a aplicação. Por favor, recarregue a página."
    );
=======
    setupWidgetJogos()
    setupMobileNavigation()
    await carregarProximosJogos()
    setupScrollEffects()

    // Carrega competição salva ou padrão
    const campeonatoSelecionado = localStorage.getItem("campeonatoSelecionado") || "brasileirao"
    const campeonatoSelect = document.getElementById("campeonato-select")
    if (campeonatoSelect) campeonatoSelect.value = campeonatoSelecionado

    await carregarTabela(campeonatoSelecionado)
    setupEventListeners()
    iniciarAtualizacaoPeriodica()
    verificarEAjustarBotaoMinutoAMinuto()

    setInterval(verificarEAjustarBotaoMinutoAMinuto, 60000)
    setInterval(verificarJogosAoVivo, 300000)
    verificarWidgetAutoAtivacao()

    console.log("Aplicação inicializada com sucesso!")
  } catch (error) {
    console.error("Erro na inicialização:", error)
    mostrarErroGeral("Erro ao carregar a aplicação. Por favor, recarregue a página.")
>>>>>>> 59feaf8 (.)
  }
}

/*====FUNÇÕES DE UTILIDADE GERAL====*/
function mostrarErroGeral(mensagem) {
<<<<<<< HEAD
  const container = document.createElement("div");
  container.className = "erro-geral";
=======
  const container = document.createElement("div")
  container.className = "erro-geral"
>>>>>>> 59feaf8 (.)
  container.innerHTML = `
    <button class="fechar" onclick="this.parentElement.remove()">×</button>
    <div class="alert alert-danger">
      <i class="fas fa-exclamation-triangle"></i>
      <p>${mensagem}</p>
      <button onclick="window.location.reload()">Recarregar</button>
    </div>
<<<<<<< HEAD
  `;
  document.body.prepend(container);
}



=======
  `
  document.body.prepend(container)
}

>>>>>>> 59feaf8 (.)
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
<<<<<<< HEAD
    .replace(",", " -");
}

function setupEventListeners() {
  const campeonatoSelect = document.getElementById("campeonato-select");
  if (campeonatoSelect) {
    campeonatoSelect.addEventListener("change", function () {
      const campeonato = this.value;
      localStorage.setItem("campeonatoSelecionado", campeonato);
      const tabelaContainer = document.getElementById("tabela-container");
      if (tabelaContainer) {
        tabelaContainer.style.opacity = "0";
        tabelaContainer.style.transform = "translateY(20px)";
        tabelaContainer.style.transition = "all 0.3s ease";
        setTimeout(() => {
          carregarTabela(campeonato);
          tabelaContainer.style.opacity = "1";
          tabelaContainer.style.transform = "translateY(0)";
        }, 300);
      } else {
        carregarTabela(campeonato);
      }
    });
  }
}

function setupMobileWidget() {
  const btnAbrir = document.getElementById("widget-toggle");
  const btnFechar = document.getElementById("widget-close");
  const widget = document.getElementById("games-widget");

  if (btnAbrir && btnFechar && widget) {
    btnAbrir.addEventListener("click", () => {
      widget.classList.add("visible");
    });

    btnFechar.addEventListener("click", () => {
      widget.classList.remove("visible");
    });

    // Fechar ao clicar fora
    document.addEventListener("click", (e) => {
      if (!widget.contains(e.target) && e.target !== btnAbrir) {
        widget.classList.remove("visible");
      }
    });
  }
}

function setupScrollEffects() {
  const navbar = document.querySelector(".navbar");
  if (!navbar) return;
  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  });
}


function setupBackToTop() {
  const backToTopBtn = document.querySelector(".back-to-top");
  if (!backToTopBtn) return;
  window.addEventListener("scroll", () => {
    backToTopBtn.classList.toggle("active", window.pageYOffset > 300);
  });
  backToTopBtn.addEventListener("click", (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
=======
    .replace(",", " -")
}

function setupEventListeners() {
  const campeonatoSelect = document.getElementById("campeonato-select")
  if (campeonatoSelect) {
    campeonatoSelect.addEventListener("change", async function () {
      const campeonato = this.value

      // Limpa dados anteriores antes de carregar nova competição
      limparDadosAnteriores()

      localStorage.setItem("campeonatoSelecionado", campeonato)
      const tabelaContainer = document.getElementById("tabela-container")

      if (tabelaContainer) {
        // Mostra loading
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
}

function limparDadosAnteriores() {
  // Limpa cache de dados
  dadosCarregados = {}

  // Limpa container da tabela
  const tabelaContainer = document.getElementById("tabela-container")
  if (tabelaContainer) {
    tabelaContainer.innerHTML = ""
  }

  // Reseta competição atual
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
>>>>>>> 59feaf8 (.)
}

/*====FUNÇÕES DE JOGOS====*/
async function carregarProximosJogos() {
<<<<<<< HEAD
  const container = document.querySelector(".games-list");
  if (!container) return;
=======
  const container = document.querySelector(".games-list")
  if (!container) return
>>>>>>> 59feaf8 (.)

  container.innerHTML = `
    <div class="loading-jogos">
      <div class="spinner"></div>
      <p>Carregando próximos jogos...</p>
    </div>
<<<<<<< HEAD
  `;

  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.planilhaJogos}/values/PARTIDAS?key=${CONFIG.apiKey}`
    );

    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

    const data = await response.json();
    if (!data.values || data.values.length === 0)
      throw new Error("Planilha de jogos vazia");

    const jogos = processarDadosJogos(data.values);
    exibirJogosWidget(jogos);
    setupFiltrosJogos(jogos);
  } catch (error) {
    console.error("Erro ao carregar jogos:", error);
=======
  `

  try {
    // Simula dados de jogos para demonstração
    const jogosDemo = [
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
    ]

    exibirJogosWidget(jogosDemo)
    setupFiltrosJogos(jogosDemo)
  } catch (error) {
    console.error("Erro ao carregar jogos:", error)
>>>>>>> 59feaf8 (.)
    container.innerHTML = `
      <div class="error-jogos">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Erro ao carregar jogos. Tente novamente.</p>
      </div>
<<<<<<< HEAD
    `;
=======
    `
>>>>>>> 59feaf8 (.)
  }
}

function exibirJogosWidget(jogos, filtro = "todos") {
<<<<<<< HEAD
  const container = document.querySelector(".games-list");
  if (!container) return;

  let jogosFiltrados = jogos;
  if (filtro !== "todos") {
    jogosFiltrados = jogos.filter(
      (jogo) =>
        jogo.campeonato.includes(filtro) ||
        (filtro === "Cruzeiro" && jogo.isCruzeiro)
    );
=======
  const container = document.querySelector(".games-list")
  if (!container) return

  let jogosFiltrados = jogos
  if (filtro !== "todos") {
    jogosFiltrados = jogos.filter(
      (jogo) => jogo.campeonato.includes(filtro) || (filtro === "Cruzeiro" && jogo.isCruzeiro),
    )
>>>>>>> 59feaf8 (.)
  }

  if (jogosFiltrados.length === 0) {
    container.innerHTML = `
      <div class="sem-jogos">
        <i class="far fa-calendar-times"></i>
        <p>Nenhum jogo ${
<<<<<<< HEAD
          filtro === "todos"
            ? "agendado"
            : filtro === "Cruzeiro"
            ? "do Cruzeiro"
            : `do(a) ${filtro}`
        }</p>
      </div>
    `;
    return;
=======
          filtro === "todos" ? "agendado" : filtro === "Cruzeiro" ? "do Cruzeiro" : `do(a) ${filtro}`
        }</p>
      </div>
    `
    return
>>>>>>> 59feaf8 (.)
  }

  container.innerHTML = jogosFiltrados
    .map(
      (jogo) => `
<<<<<<< HEAD
    <div class="jogo-widget ${jogo.isCruzeiro ? "cruzeiro" : ""} ${
        jogo.aoVivo ? "ao-vivo" : ""
      }">
      <div class="jogo-data">${jogo.data} - ${jogo.hora}</div>
      <div class="jogo-times">
        <div class="time ${
          jogo.isCruzeiro && jogo.isMandante ? "destaque" : ""
        }">
=======
    <div class="jogo-widget ${jogo.isCruzeiro ? "cruzeiro" : ""} ${jogo.aoVivo ? "ao-vivo" : ""}">
      <div class="jogo-data">${jogo.data} - ${jogo.hora}</div>
      <div class="jogo-times">
        <div class="time ${jogo.isCruzeiro && jogo.isMandante ? "destaque" : ""}">
>>>>>>> 59feaf8 (.)
          <img src="${jogo.escudoCasa}" alt="${jogo.timeCasa}">
          <span>${jogo.timeCasa}</span>
        </div>
        <span class="vs">vs</span>
<<<<<<< HEAD
        <div class="time ${
          jogo.isCruzeiro && !jogo.isMandante ? "destaque" : ""
        }">
=======
        <div class="time ${jogo.isCruzeiro && !jogo.isMandante ? "destaque" : ""}">
>>>>>>> 59feaf8 (.)
          <img src="${jogo.escudoVisitante}" alt="${jogo.timeVisitante}">
          <span>${jogo.timeVisitante}</span>
        </div>
      </div>
      <div class="jogo-campeonato">${jogo.campeonato}</div>
    </div>
<<<<<<< HEAD
  `
    )
    .join("");
}

function processarDadosJogos(dados) {
  let headerIndex = -1;
  for (let i = 0; i < dados.length; i++) {
    const row = dados[i].map((cell) => (cell || "").toString().toUpperCase());
    if (
      row.includes("DATA") &&
      (row.includes("JOGO") ||
        row.includes("TIME") ||
        row.includes("CAMPEONATO"))
    ) {
      headerIndex = i;
      break;
    }
  }
  const linhas = dados.slice(headerIndex + 1).filter((row) => {
    return (
      row &&
      row.length >= 4 &&
      row.some((cell) => !!cell && cell.toString().trim() !== "")
    );
  });
  return linhas
    .map((jogo) => {
      // Data
      let dataFormatada = "--/--";
      if (typeof jogo[0] === "number") {
        const data = new Date((jogo[0] - 25569) * 86400 * 1000);
        dataFormatada = data.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
        });
      } else if (
        typeof jogo[0] === "string" &&
        jogo[0].match(/\d{1,2}[/\.]\d{1,2}/)
      ) {
        dataFormatada = jogo[0].replace(/\./g, "/");
      } else if (typeof jogo[0] === "string") {
        dataFormatada = jogo[0];
      }
      // Times
      const timeCasa = (jogo[1] || "").trim();
      const timeVisitante = (jogo[3] || "").trim();
      // Fase
      let fase = "";
      if (jogo[2] && typeof jogo[2] === "string") {
        if (jogo[2].toLowerCase().includes("ida")) fase = "Ida";
        else if (jogo[2].toLowerCase().includes("volta")) fase = "Volta";
        else fase = jogo[2];
      }
      // Placar
      const placar = jogo[5] || "";
      // Hora
      let horaFormatada = "--:--";
      let aoVivo = false;
      if (jogo[7] === "LIVE" || jogo[7] === "AO VIVO") {
        horaFormatada = "AO VIVO";
        aoVivo = true;
      } else if (
        typeof jogo[7] === "string" &&
        jogo[7].match(/^\d{2}:\d{2}$/)
      ) {
        horaFormatada = jogo[7];
      } else if (typeof jogo[7] === "number") {
        const horaDecimal = Number.parseFloat(jogo[7]);
        const horas = Math.floor(horaDecimal * 24);
        const minutos = Math.round((horaDecimal * 24 - horas) * 60);
        horaFormatada = `${horas.toString().padStart(2, "0")}:${minutos
          .toString()
          .padStart(2, "0")}`;
      } else if (
        jogo[4] &&
        typeof jogo[4] === "string" &&
        jogo[4].match(/^\d{2}:\d{2}$/)
      ) {
        horaFormatada = jogo[4];
      } else {
        horaFormatada = jogo[7] || jogo[4] || "--:--";
      }
      // Campeonato
      const campeonato = formatarNomeCampeonato(
        jogo[6] || jogo[5] || "Campeonato Desconhecido"
      );
      // Resultados
      let resultadoCasa = "";
      let resultadoVisitante = "";
      if (placar && placar.includes("-")) {
        const [golsCasa, golsVisitante] = placar.split("-").map(Number);
        resultadoCasa =
          golsCasa > golsVisitante
            ? "vitoria"
            : golsCasa < golsVisitante
            ? "derrota"
            : "empate";
        resultadoVisitante =
          golsVisitante > golsCasa
            ? "vitoria"
            : golsVisitante < golsCasa
            ? "derrota"
            : "empate";
      }
      const isCruzeiro =
        timeCasa.toLowerCase().includes("cruzeiro") ||
        timeVisitante.toLowerCase().includes("cruzeiro");
      const isMandante = timeCasa.toLowerCase().includes("cruzeiro");
      return {
        data: dataFormatada,
        hora: horaFormatada,
        campeonato: campeonato,
        timeCasa: timeCasa || "Time Desconhecido",
        escudoCasa: obterEscudoTime(timeCasa),
        timeVisitante: timeVisitante || "Time Desconhecido",
        escudoVisitante: obterEscudoTime(timeVisitante),
        local: jogo[6] || "Local a definir",
        transmissao: jogo[7] || "A definir",
        isCruzeiro,
        isMandante,
        fase,
        placar,
        resultadoCasa,
        resultadoVisitante,
        aoVivo,
      };
    })
    .filter(
      (jogo) =>
        jogo.timeCasa !== "DATA" &&
        jogo.timeCasa !== "Jogo" &&
        jogo.timeCasa !== "" &&
        jogo.timeCasa !== "Time" &&
        jogo.timeCasa !== "CAMPEONATO"
    )
    .sort((a, b) => {
      try {
        const dateA = new Date(a.data.split("/").reverse().join("-"));
        const dateB = new Date(b.data.split("/").reverse().join("-"));
        return dateA - dateB;
      } catch {
        return 0;
      }
    });
}

function verificarJogoAoVivo(jogos) {
  const agora = new Date();
  return jogos.some((jogo) => {
    if (!jogo.data || !jogo.hora || jogo.placar) return false;

    try {
      const [dia, mes] = jogo.data.split("/");
      const dataJogo = new Date();
      dataJogo.setFullYear(new Date().getFullYear());
      dataJogo.setMonth(parseInt(mes) - 1);
      dataJogo.setDate(parseInt(dia));

      const hoje = new Date();
      const mesmoDia =
        dataJogo.getDate() === hoje.getDate() &&
        dataJogo.getMonth() === hoje.getMonth();

      if (!mesmoDia) return false;

      if (jogo.hora === "AO VIVO" || jogo.hora === "LIVE") return true;

      const [hora, minuto] = jogo.hora.split(":");
      const inicioJogo = new Date(dataJogo);
      inicioJogo.setHours(parseInt(hora), parseInt(minuto), 0, 0);
      const fimJogo = new Date(inicioJogo.getTime() + 2.5 * 60 * 60 * 1000);

      return agora >= inicioJogo && agora <= fimJogo;
    } catch (e) {
      console.error("Erro ao verificar jogo ao vivo:", e);
      return false;
    }
  });
}

function formatarNomeCampeonato(nome) {
  const mapeamento = {
    "Campeonato Brasileiro": "Campeonato Brasileiro",
    "Copa do Brasil": "Copa do Brasil",
  };
  return mapeamento[nome] || nome;
}

function obterEscudoTime(nomeTime) {
  if (!nomeTime || nomeTime.trim() === "") {
    return "https://via.placeholder.com/70";
  }

  const nomeLower = nomeTime.toLowerCase().trim();
  const timeEncontrado = Object.keys(escudos).find(
    (key) =>
      key.toLowerCase() === nomeLower ||
      nomeLower.includes(key.toLowerCase()) ||
      key.toLowerCase().includes(nomeLower)
  );

  return timeEncontrado
    ? escudos[timeEncontrado]
    : "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/1024px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png";
}

function exibirJogos(jogos, termosFiltro = ["todos"]) {
  const container = document.querySelector(".lista-jogos");
  if (!container) return;
  let jogosFiltrados = jogos;
  if (!termosFiltro.includes("todos")) {
    if (termosFiltro.includes("Cruzeiro")) {
      jogosFiltrados = jogos.filter((jogo) => jogo.isCruzeiro);
    } else {
      jogosFiltrados = jogos.filter((jogo) =>
        termosFiltro.some((termo) => jogo.campeonato.includes(termo))
      );
    }
  }
  let jogosHTML = "";
  if (jogosFiltrados.length === 0) {
    jogosHTML = `
      <div class="sem-jogos">
        <i class="far fa-calendar-times"></i>
        <p>Nenhum jogo ${
          termosFiltro.includes("todos")
            ? "agendado"
            : termosFiltro.includes("Cruzeiro")
            ? "do Cruzeiro"
            : `do ${termosFiltro[0]}`
        }</p>
      </div>
    `;
  } else {
    jogosHTML = jogosFiltrados
      .map((jogo) => {
        const estaAoVivo = jogo.aoVivo && verificarJogoAoVivo([jogo]);
        const cruzeiroCasa = jogo.isCruzeiro && jogo.isMandante;
        const cruzeiroVisitante = jogo.isCruzeiro && !jogo.isMandante;
        return `
          <div class="jogo-container ${estaAoVivo ? "jogo-ao-vivo" : ""} ${
          cruzeiroCasa ? "cruzeiro-mandante" : ""
        } ${cruzeiroVisitante ? "cruzeiro-visitante" : ""}" 
               ${
                 estaAoVivo
                   ? `onclick="abrirMinutoAMinuto('${jogo.timeCasa}', '${jogo.timeVisitante}', '${jogo.campeonato}')"`
                   : ""
               }>
            <div class="info-jogo">
              <span class="data-jogo">${jogo.data}</span>
              <span class="hora-jogo ${estaAoVivo ? "ao-vivo" : ""}">${
          jogo.hora
        }</span>
              ${estaAoVivo ? '<span class="badge-live">LIVE</span>' : ""}
            </div>
            <div class="detalhes-jogo">
              <div class="time-jogo ${cruzeiroCasa ? "destaque" : ""} ${
          jogo.resultadoCasa
        }">
                <img src="${jogo.escudoCasa}" alt="${
          jogo.timeCasa
        }" loading="lazy" width="30" height="30">
                <span class="nome">${jogo.timeCasa}</span>
                ${
                  jogo.resultadoCasa
                    ? `<span class="resultado-icon ${jogo.resultadoCasa}"></span>`
                    : ""
                }
              </div>
              <span class="vs">vs</span>
              <div class="time-jogo ${cruzeiroVisitante ? "destaque" : ""} ${
          jogo.resultadoVisitante
        }">
                <img src="${jogo.escudoVisitante}" alt="${
          jogo.timeVisitante
        }" loading="lazy" width="30" height="30">
                <span class="nome">${jogo.timeVisitante}</span>
                ${
                  jogo.resultadoVisitante
                    ? `<span class="resultado-icon ${jogo.resultadoVisitante}"></span>`
                    : ""
                }
              </div>
            </div>
            <div class="info-adicional">
              <span class="campeonato-jogo">${formatarNomeCampeonato(
                jogo.campeonato
              )}</span>
            </div>
          </div>
        `;
      })
      .join("");
  }
  // Só atualiza o DOM se mudou
  if (container._ultimoHTML === jogosHTML) return;
  container._ultimoHTML = jogosHTML;
  container.innerHTML = jogosHTML;
}

function abrirMinutoAMinuto(timeCasa, timeVisitante, campeonato) {
  timeCasa = timeCasa.trim();
  timeVisitante = timeVisitante.trim();

  const escudoCasa = obterEscudoTime(timeCasa);
  const escudoVisitante = obterEscudoTime(timeVisitante);

  const idJogo = `${timeCasa.replace(/\s+/g, "-")}-vs-${timeVisitante.replace(
    /\s+/g,
    "-"
  )}-${new Date().toISOString().split("T")[0]}`;

  localStorage.setItem(
    "jogoAoVivo",
    JSON.stringify({
      timeCasa,
      timeVisitante,
      escudoCasa,
      escudoVisitante,
      campeonato,
      idJogo,
      horaInicio: new Date().toISOString(),
      planilhaId: "1Gb4nJXfxEDPFhseyZtKs1X3--lTsti1_ZTwPLk9MnBs",
    })
  );

  // Redireciona para a página de minuto a minuto
  window.location.href = `minuto-a-minuto.html?id=${idJogo}`;
}

function verificarEAjustarBotaoMinutoAMinuto() {
  const btnContainer = document.getElementById("btn-minuto-a-minuto-container");
  const btnTimes = document.getElementById("btn-ao-vivo-times");
  const jogoSalvo = localStorage.getItem("jogoAoVivo");

  if (!btnContainer) return;

  if (jogoSalvo) {
    try {
      const jogo = JSON.parse(jogoSalvo);
      const agora = new Date();
      const inicioJogo = new Date(jogo.horaInicio);
      const fimJogo = new Date(inicioJogo.getTime() + 3 * 60 * 60 * 1000); // 3 horas depois

      // Mostra o botão apenas se o jogo está em andamento
      if (agora >= inicioJogo && agora <= fimJogo) {
        // Atualiza o texto com os times que estão jogando
        if (btnTimes) {
          btnTimes.textContent = `${jogo.timeCasa} x ${jogo.timeVisitante}`;
        }

        // Atualiza o link para incluir o ID do jogo
        const btnLink = btnContainer.querySelector("a");
        if (btnLink) {
          btnLink.href = `minuto-a-minuto.html?id=${jogo.idJogo}`;
        }

        // Exibe o botão com animação
        btnContainer.style.display = "block";

        // Adiciona classe para destacar o botão se for um jogo do Cruzeiro
        if (
          jogo.timeCasa.includes("Cruzeiro") ||
          jogo.timeVisitante.includes("Cruzeiro")
        ) {
          btnContainer.classList.add("jogo-cruzeiro");
        } else {
          btnContainer.classList.remove("jogo-cruzeiro");
        }
      } else {
        // Remove o jogo do localStorage se já terminou
        localStorage.removeItem("jogoAoVivo");
        btnContainer.style.display = "none";
      }
    } catch (error) {
      console.error("Erro ao processar jogo ao vivo:", error);
      localStorage.removeItem("jogoAoVivo");
      btnContainer.style.display = "none";
    }
  } else {
    // Verifica se há algum jogo ao vivo agora
    verificarJogosAoVivo();
  }
}

async function verificarJogosAoVivo() {
  try {
    const timestamp = new Date().getTime();
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.planilhaJogos}/values/PARTIDAS?key=${CONFIG.apiKey}&t=${timestamp}`
    );

    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

    const data = await response.json();
    if (!data.values || data.values.length === 0) {
      return;
    }

    const jogos = processarDadosJogos(data.values);
    const jogosAoVivo = jogos.filter((jogo) => {
      return jogo.aoVivo;
    });

    if (jogosAoVivo.length > 0) {
      // Prioriza jogos do Cruzeiro
      const jogoCruzeiro = jogosAoVivo.find((jogo) => jogo.isCruzeiro);
      const jogoSelecionado = jogoCruzeiro || jogosAoVivo[0];

      // Salva o jogo no localStorage
      const idJogo = `${jogoSelecionado.timeCasa.replace(
        /\s+/g,
        "-"
      )}-vs-${jogoSelecionado.timeVisitante.replace(/\s+/g, "-")}-${
        new Date().toISOString().split("T")[0]
      }`;

      localStorage.setItem(
        "jogoAoVivo",
        JSON.stringify({
          timeCasa: jogoSelecionado.timeCasa,
          timeVisitante: jogoSelecionado.timeVisitante,
          escudoCasa: jogoSelecionado.escudoCasa,
          escudoVisitante: jogoSelecionado.escudoVisitante,
          campeonato: jogoSelecionado.campeonato,
          idJogo: idJogo,
          horaInicio: new Date().toISOString(),
          planilhaId: "1Gb4nJXfxEDPFhseyZtKs1X3--lTsti1_ZTwPLk9MnBs",
        })
      );

      // Atualiza o botão
      verificarEAjustarBotaoMinutoAMinuto();
    }
  } catch (error) {
    console.error("Erro ao verificar jogos ao vivo:", error);
  }
}

// Adicione um evento de clique para o botão ao vivo
document.addEventListener("DOMContentLoaded", () => {
  const btnAoVivo = document.querySelector(".btn-ao-vivo");
  if (btnAoVivo) {
    btnAoVivo.addEventListener("click", (e) => {
      // Adiciona um efeito de clique
      btnAoVivo.classList.add("btn-clicked");
      setTimeout(() => {
        btnAoVivo.classList.remove("btn-clicked");
      }, 200);
    });
  }
});

async function carregarDadosMinutoAMinuto() {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/1Gb4nJXfxEDPFhseyZtKs1X3--lTsti1_ZTwPLk9MnBs/values/MINUTO_A_MINUTO?key=${CONFIG.apiKey}`
    );

    if (!response.ok) throw new Error("Erro ao carregar minuto a minuto");

    const data = await response.json();
    if (!data.values || data.values.length === 0) {
      throw new Error("Nenhum dado de minuto a minuto encontrado");
    }

    const eventos = data.values.slice(1);
    exibirEventosMinutoAMinuto(eventos);
  } catch (error) {
    console.error("Erro ao carregar minuto a minuto:", error);
  }
}

function exibirEventosMinutoAMinuto(eventos) {
  const container = document.getElementById("narrativa-jogo");
  if (!container) return;

  container.innerHTML = eventos
    .map(
      (evento) => `
    <div class="evento-jogo">
      <span class="tempo-evento">${evento[0] || ""}</span>
      <p>${evento[1] || ""} <strong>${evento[2] || ""}</strong></p>
    </div>
  `
    )
    .join("");
}

function exibirErroJogos() {
  const container = document.querySelector(".lista-jogos");
  if (!container) return;

  container.innerHTML = `
    <div class="sem-jogos">
      <i class="fas fa-exclamation-triangle"></i>
      <p>Erro ao carregar jogos</p>
    </div>
  `;
}

function setupFiltrosJogos(jogos) {
  const filtrosContainer = document.querySelector(".widget-filters");
  if (!filtrosContainer) return;

  filtrosContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("filter-btn")) {
      document.querySelector(".filter-btn.active")?.classList.remove("active");
      e.target.classList.add("active");
      const filtro = e.target.dataset.filter;
      exibirJogosWidget(jogos, filtro);
    }
  });
=======
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
  const btnContainer = document.getElementById("btn-minuto-a-minuto-container")
  const btnTimes = document.getElementById("btn-ao-vivo-times")

  if (!btnContainer) return

  // Por enquanto, mantém oculto (pode ser implementado conforme necessário)
  btnContainer.style.display = "none"
}

async function verificarJogosAoVivo() {
  // Implementação futura para verificar jogos ao vivo
  console.log("Verificando jogos ao vivo...")
>>>>>>> 59feaf8 (.)
}

/*====FUNÇÕES DE WIDGET====*/
function setupWidgetJogos() {
<<<<<<< HEAD
  const widgetToggle = document.getElementById("widget-toggle");
  const widgetClose = document.getElementById("widget-close");
  const widget = document.getElementById("games-widget");
  const widgetSpan = widgetToggle ? widgetToggle.querySelector("span") : null;

  if (!widgetToggle || !widgetClose || !widget) return;

  const toggleWidget = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    widget.classList.toggle("visible");
    
    // Atualiza o texto do botão
    if (widgetSpan) {
      widgetSpan.textContent = widget.classList.contains("visible") ? "Fechar" : "Jogos";
    }
  };

  // Adiciona eventos
  widgetToggle.addEventListener("click", toggleWidget);
  widgetClose.addEventListener("click", toggleWidget);

  // Fecha ao clicar fora
  document.addEventListener("click", (e) => {
    if (!widget.contains(e.target) ){
      widget.classList.remove("visible");
      if (widgetSpan) {
        widgetSpan.textContent = "Jogos";
      }
    }
  });

  // Impede que cliques dentro do widget fechem ele
  widget.addEventListener("click", (e) => e.stopPropagation());
}


function setupMobileNavigation() {
  const menuToggle = document.getElementById("menuToggle");
  const navMenu = document.getElementById("nav-menu");

  if (!menuToggle || !navMenu) return;

  menuToggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    menuToggle.classList.toggle("active");
    navMenu.classList.toggle("active");
    
    // Atualiza o ícone
    const icon = menuToggle.querySelector("i");
    if (menuToggle.classList.contains("active")) {
      icon.classList.remove("fa-cog");
      icon.classList.add("fa-times");
    } else {
      icon.classList.remove("fa-times");
      icon.classList.add("fa-cog");
    }
  });

  // Fecha o menu ao clicar em um link
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      if (navMenu.classList.contains("active")) {
        navMenu.classList.remove("active");
        menuToggle.classList.remove("active");
        const icon = menuToggle.querySelector("i");
        icon.classList.remove("fa-times");
        icon.classList.add("fa-cog");
      }
    });
  });

  // Fecha o menu ao clicar fora
  document.addEventListener("click", (e) => {
    if (!navMenu.contains(e.target)) {
      navMenu.classList.remove("active");
      menuToggle.classList.remove("active");
      const icon = menuToggle.querySelector("i");
      icon.classList.remove("fa-times");
      icon.classList.add("fa-cog");
    }
  });
}

// Funções relacionadas à tabela de classificação
async function carregarTabela(campeonato = "brasileirao") {
  const config = CONFIG.campeonatos[campeonato];
  const tabelaContainer = document.getElementById("tabela-container");

  if (!config || !tabelaContainer) {
    console.error("Configuração do campeonato ou container não encontrado");
    return;
  }

  const campeonatoNome = document.getElementById("campeonato-nome");
  const headerH1 = document.querySelector("header h1");
  const horaAtualizacao = document.getElementById("hora-atualizacao");
  const minutoAMinuto = document.getElementById("minuto-a-minuto");

  if (campeonatoNome) campeonatoNome.textContent = config.nome;
  if (headerH1) headerH1.style.color = config.cor;
  if (horaAtualizacao) horaAtualizacao.textContent = formatarData();
  if (minutoAMinuto) minutoAMinuto.style.display = "none";

  if (campeonato === "copa-do-brasil") {
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.planilhaJogos}/values/PARTIDAS?key=${CONFIG.apiKey}&t=${timestamp}`
      );

      if (!response.ok) throw new Error("Erro na resposta da API");

      const data = await response.json();
      if (!data.values || data.values.length === 0) {
        throw new Error("Nenhum jogo encontrado");
      }

      const jogos = processarDadosJogos(data.values);

      if (verificarJogoAoVivo(jogos)) {
        tabelaContainer.innerHTML = `
          <div class="jogos-copa-container">
            ${gerarHTMLCopaDoBrasil(jogos)}
          </div>
        `;
        carregarDadosMinutoAMinuto();
      } else {
        tabelaContainer.innerHTML = gerarHTMLCopaDoBrasil(jogos);
      }
    } catch (error) {
      console.error("Erro ao carregar jogos:", error);
=======
  const widgetToggle = document.getElementById("widget-toggle")
  const widgetClose = document.getElementById("widget-close")
  const widget = document.getElementById("games-widget")
  const widgetSpan = widgetToggle ? widgetToggle.querySelector("span") : null

  if (!widgetToggle || !widgetClose || !widget) return

  const toggleWidget = (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    widget.classList.toggle("visible")

    if (widgetSpan) {
      widgetSpan.textContent = widget.classList.contains("visible") ? "Fechar" : "Jogos"
    }
  }

  widgetToggle.addEventListener("click", toggleWidget)
  widgetClose.addEventListener("click", toggleWidget)

  document.addEventListener("click", (e) => {
    if (!widget.contains(e.target) && !widgetToggle.contains(e.target)) {
      widget.classList.remove("visible")
      if (widgetSpan) {
        widgetSpan.textContent = "Jogos"
      }
    }
  })

  widget.addEventListener("click", (e) => e.stopPropagation())
}

function setupMobileNavigation() {
  const menuToggle = document.getElementById("menuToggle")
  const navMenu = document.getElementById("nav-menu")

  if (!menuToggle || !navMenu) return

  menuToggle.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()

    menuToggle.classList.toggle("active")
    navMenu.classList.toggle("active")

    const icon = menuToggle.querySelector("i")
    if (menuToggle.classList.contains("active")) {
      icon.classList.remove("fa-cog")
      icon.classList.add("fa-times")
    } else {
      icon.classList.remove("fa-times")
      icon.classList.add("fa-cog")
    }
  })

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (navMenu.classList.contains("active")) {
        navMenu.classList.remove("active")
        menuToggle.classList.remove("active")
        const icon = menuToggle.querySelector("i")
        icon.classList.remove("fa-times")
        icon.classList.add("fa-cog")
      }
    })
  })

  document.addEventListener("click", (e) => {
    if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
      navMenu.classList.remove("active")
      menuToggle.classList.remove("active")
      const icon = menuToggle.querySelector("i")
      icon.classList.remove("fa-times")
      icon.classList.add("fa-cog")
    }
  })
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
    try {
      const jogosDemo = gerarJogosCopaDemonstração()
      tabelaContainer.innerHTML = gerarHTMLCopaDoBrasil(jogosDemo)
      dadosCarregados[campeonato] = true
    } catch (error) {
      console.error("Erro ao carregar Copa do Brasil:", error)
>>>>>>> 59feaf8 (.)
      tabelaContainer.innerHTML = `
        <div class="error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Erro ao carregar dados. Tentando novamente...</p>
        </div>
<<<<<<< HEAD
      `;
      setTimeout(() => carregarTabela(campeonato), 30000);
    }
    return;
  }

  tabelaContainer.innerHTML = `
    <div class="loading">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Atualizando dados do ${config.nome}...</p>
    </div>
  `;

  try {
    const timestamp = new Date().getTime();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/${config.intervaloDados}?key=${CONFIG.apiKey}&t=${timestamp}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

    const data = await response.json();
    if (!data.values) throw new Error("Dados vazios");

    tabelaContainer.innerHTML = gerarHTMLTabela(data.values);
    processarTabelaBrasileirao(data.values); // Processa para armazenar variações
  } catch (error) {
    console.error(`Erro ao carregar tabela do ${campeonato}:`, error);
=======
      `
    }
    return
  }

  // Para o Brasileirão, gera dados de demonstração
  try {
    const dadosDemo = gerarDadosBrasileiraoDemonstração()
    tabelaContainer.innerHTML = gerarHTMLTabela(dadosDemo)
    dadosCarregados[campeonato] = true
  } catch (error) {
    console.error(`Erro ao carregar tabela do ${campeonato}:`, error)
>>>>>>> 59feaf8 (.)
    tabelaContainer.innerHTML = `
      <div class="error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Erro ao carregar dados. Tentando novamente...</p>
      </div>
<<<<<<< HEAD
    `;
    setTimeout(() => carregarTabela(campeonato), 30000);
  }
}

function gerarHTMLTabela(dados) {
  if (!dados || dados.length === 0) {
    return '<div class="error">Nenhum dado disponível</div>';
  }

  const hasHeader = dados[0] && dados[0].length > 0;
  const startRow = hasHeader ? 1 : 0;
=======
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
    ["6º", "Fluminense", "20", "11", "6", "2", "3", "12", "15", "3", "61%"]
  ]
}

function gerarJogosCopaDemonstração() {
  return [
    {
      data: "20/01",
      hora: "16:00",
      campeonato: "Copa do Brasil",
      timeCasa: "Cruzeiro",
      escudoCasa: escudos.Cruzeiro,
      timeVisitante: "CRB",
      escudoVisitante: escudos.CRB,
      fase: "Ida",
      isCruzeiro: true,
      isMandante: true,
      placar: "",
      aoVivo: false,
    },
  ]
}

function gerarHTMLTabela(dados) {
  if (!dados || dados.length === 0) {
    return '<div class="error">Nenhum dado disponível</div>'
  }

  const hasHeader = dados[0] && dados[0].length > 0
  const startRow = hasHeader ? 1 : 0
>>>>>>> 59feaf8 (.)

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
<<<<<<< HEAD
  `;

  for (let i = startRow; i < dados.length; i++) {
    const row = dados[i];
    const nomeTime = row[1]
      .replace(/^\d+°\s*/, "")
      .replace(/\s[A-Z]{2,4}$/, "")
      .trim();
    parseInt(row[2] || 0);

    const posicaoClass = getPositionClass(i);
    const cruzeiroClass = isCruzeiro(nomeTime) ? "cruzeiro" : "";
    const escudoTime = escudos[nomeTime] || "https://via.placeholder.com/30";
=======
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
>>>>>>> 59feaf8 (.)

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
<<<<<<< HEAD
    `;
  }

  return html + "</tbody></table>";
}

function processarTabelaBrasileirao(dados) {
  const linhas = dados.slice(1); // Remove cabeçalho
  const dadosAtuais = {};

  linhas.forEach((linha, index) => {
    const nomeTime = linha[1].replace(/^\d+°\s*/, "").trim();

    if (!nomeTime) return;

    dadosAtuais[nomeTime] = {
      posicao: index + 1,
      pontos: parseInt(linha[2] || 0),
      jogos: parseInt(linha[3] || 0),
      vitorias: parseInt(linha[4] || 0),
      empates: parseInt(linha[5] || 0),
      derrotas: parseInt(linha[6] || 0),
      ultimaAtualizacao: new Date().getTime(), // Adiciona timestamp
    };
  });

  localStorage.setItem("dadosTimes", JSON.stringify(dadosAtuais));
}

function getPositionClass(position) {
  const posNum =
    typeof position === "string"
      ? Number.parseInt(position.replace("º", ""))
      : position;

  const campeonatoSelect = document.getElementById("campeonato-select");
  const campeonato = campeonatoSelect?.value || "brasileirao";


  if (posNum <= 4) return "pos1-4";
  if (posNum <= 6) return "pos5-6";
  if (posNum <= 12) return "pos7-12";
  if (posNum <= 16) return "pos13-16";
  return "pos17-20";
}

function isCruzeiro(nomeTime) {
  return nomeTime && nomeTime.toLowerCase().includes("cruzeiro");
}

function iniciarAtualizacaoPeriodica() {
  // Inicializa dados se não existirem
  if (!localStorage.getItem("dadosTimes")) {
    localStorage.setItem("dadosTimes", JSON.stringify({}));
  }

  // Atualiza a cada 30 segundos
  setInterval(() => {
    const campeonatoSelect = document.getElementById("campeonato-select");
    const campeonato = campeonatoSelect?.value || "brasileirao";
    carregarTabela(campeonato);
  }, 30000);
}

// No arquivo script-brasileirao.js, substitua a função atualizarLegendas por:
function atualizarLegendas(campeonato) {
  const legendGroups = document.querySelectorAll(".legend-group");

  legendGroups.forEach((group) => {
    if (group.dataset.campeonato === campeonato) {
      group.style.display = "flex";
    } else {
      group.style.display = "none";
    }
  });
}

// Event listeners para legendas
const select = document.getElementById("campeonato-select");
if (select) {
  select.addEventListener("change", () => {
    atualizarLegendas(select.value);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  if (select) {
    atualizarLegendas(select.value);
  }
});

// Funções para a Copa do Brasil
function gerarHTMLCopaDoBrasil(jogos) {
  let html = "";
  const jogosCopa = jogos.filter((jogo) =>
    jogo.campeonato.includes("Copa do Brasil")
  );

  const jogosCruzeiroCopa = jogosCopa.filter((jogo) => jogo.isCruzeiro);

  if (jogosCruzeiroCopa.length === 0) {
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
`;
  }

  const jogosIda = jogosCopa.filter((jogo) => jogo.fase === "Ida");
  const jogosVolta = jogosCopa.filter((jogo) => jogo.fase === "Volta");

  if (jogosIda.length > 0) {
    html += '<div class="fase-copa">';
    html += '<h3><i class="fas fa-arrow-right"></i> Jogos de Ida</h3>';
    html += jogosIda.map((jogo) => gerarHTMLJogoCopa(jogo)).join("");
    html += "</div>";
  }

  if (jogosVolta.length > 0) {
    html += '<div class="fase-copa">';
    html += '<h3><i class="fas fa-arrow-left"></i> Jogos de Volta</h3>';
    html += jogosVolta.map((jogo) => gerarHTMLJogoCopa(jogo)).join("");
    html += "</div>";
  }

  return html;
=======
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

  let html = '<div class="fase-copa">'
  html += '<h3><i class="fas fa-trophy"></i> Copa do Brasil 2025</h3>'
  html += jogos.map((jogo) => gerarHTMLJogoCopa(jogo)).join("")
  html += "</div>"

  return html
>>>>>>> 59feaf8 (.)
}

function gerarHTMLJogoCopa(jogo) {
  return `
    <div class="jogo-copa ${jogo.isCruzeiro ? "destaque-cruzeiro" : ""}">
      <div class="cabecalho-jogo-copa">
        <span class="fase-jogo">${jogo.fase} - ${jogo.campeonato}</span>
        <span class="data-jogo-copa">${jogo.data} - ${jogo.hora}</span>
        ${jogo.placar ? `<span class="placar-jogo">${jogo.placar}</span>` : ""}
      </div>
      <div class="times-jogo-copa">
<<<<<<< HEAD
        <div class="time-casa ${jogo.isMandante ? "destaque" : ""} ${
    jogo.resultadoCasa
  }">
          <span>${jogo.timeCasa}</span>
          <img src="${jogo.escudoCasa}" alt="${
    jogo.timeCasa
  }" width="40" height="40">
          ${
            jogo.resultadoCasa
              ? `<span class="resultado-icon ${jogo.resultadoCasa}"></span>`
              : ""
          }
        </div>
        <span class="vs">vs</span>
        <div class="time-visitante ${!jogo.isMandante ? "destaque" : ""} ${
    jogo.resultadoVisitante
  }">
          <img src="${jogo.escudoVisitante}" alt="${
    jogo.timeVisitante
  }" width="40" height="40">
          <span>${jogo.timeVisitante}</span>
          ${
            jogo.resultadoVisitante
              ? `<span class="resultado-icon ${jogo.resultadoVisitante}"></span>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

function verificarJogoEncerrado(jogo) {
  if (!jogo.data || !jogo.hora || !jogo.placar) return false;

  // Verifica se é hoje ou no passado
  const [dia, mes] = jogo.data.split("/");
  const dataJogo = new Date();
  dataJogo.setDate(parseInt(dia));
  dataJogo.setMonth(parseInt(mes) - 1);

  const agora = new Date();

  // Se a data do jogo é anterior a hoje, certamente terminou
  if (
    dataJogo < new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  ) {
    return true;
  }

  // Se for hoje, verifica o horário
  if (
    dataJogo.getDate() === agora.getDate() &&
    dataJogo.getMonth() === agora.getMonth()
  ) {
    const [hora, minuto] = jogo.hora.split(":");
    const inicioJogo = new Date();
    inicioJogo.setHours(parseInt(hora), parseInt(minuto), 0, 0);
    const fimJogo = new Date(inicioJogo.getTime() + 2.5 * 60 * 60 * 1000);

    return agora > fimJogo;
  }

  return false;
}

/*====ATIVAÇÃO AUTOMÁTICA DO WIDGET====*/
function verificarWidgetAutoAtivacao() {
  const urlParams = new URLSearchParams(window.location.search);
  const widgetParam = urlParams.get('widget');
  
  if (widgetParam === 'jogos') {
    const widgetToggle = document.getElementById('widget-toggle');
    const widget = document.getElementById('games-widget');
    
    if (widgetToggle && widget) {
      // Simula o clique para abrir o widget
      widgetToggle.click();
      
      // Rola a página até o widget (opcional)
      setTimeout(() => {
        widget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 300);
    }
  }
}
=======
        <div class="time-casa ${jogo.isMandante ? "destaque" : ""}">
          <span>${jogo.timeCasa}</span>
          <img src="${jogo.escudoCasa}" alt="${jogo.timeCasa}" width="40" height="40">
        </div>
        <span class="vs">vs</span>
        <div class="time-visitante ${!jogo.isMandante ? "destaque" : ""}">
          <img src="${jogo.escudoVisitante}" alt="${jogo.timeVisitante}" width="40" height="40">
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
  const legendGroups = document.querySelectorAll(".legend-group")

  legendGroups.forEach((group) => {
    if (group.dataset.campeonato === campeonato) {
      group.style.display = "flex"
    } else {
      group.style.display = "none"
    }
  })
}

function iniciarAtualizacaoPeriodica() {
  if (!localStorage.getItem("dadosTimes")) {
    localStorage.setItem("dadosTimes", JSON.stringify({}))
  }

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
      widgetToggle.click()

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
>>>>>>> 59feaf8 (.)

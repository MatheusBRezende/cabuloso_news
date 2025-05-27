// Configurações da API do Google Sheets
 const config = {
    apiKey: null, 
    spreadsheetId : "12LrzrOnzSwScp-9PzKrtq13ElgTUpWxo3BDp4Y82Dm0",
    range : "A:F"
 }

   async function fetchAPIKey() {
  try {
    const response = await fetch('/api/chave-google');
    
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.apiKey) {
      throw new Error("Chave da API não encontrada na resposta");
    }

    console.log('Chave recebida:', data.apiKey);
    config.apiKey = data.apiKey;
    return true;
  } catch (error) {
    console.error("Falha ao carregar chave:", error);
    return false;
  }
}
// Variáveis globais
let allResults = []
let performanceStats = {}

// Função para criar estrelas no fundo
function createStars() {
  const starsContainer = document.querySelector(".stars-background")
  if (!starsContainer) return

  starsContainer.innerHTML = ""
  const starCount = window.innerWidth < 768 ? 50 : 100

  for (let i = 0; i < starCount; i++) {
    const star = document.createElement("i")
    star.className = "star bi bi-star-fill"
    star.setAttribute("aria-hidden", "true")

    // Tamanho variado para as estrelas
    star.style.fontSize = `${Math.random() * 0.8 + 0.4}rem`
    star.style.left = `${Math.random() * 100}%`
    star.style.top = `${Math.random() * 100}%`

    // Duração variada da animação
    const duration = Math.random() * 5 + 3
    star.style.setProperty("--duration", `${duration}s`)
    star.style.animationDelay = `${Math.random() * 10}s`
    star.style.transform = `rotate(${Math.random() * 360}deg)`

    starsContainer.appendChild(star)
  }
}

// Formatar data atual
function getFormattedDate() {
  const now = new Date()
  const options = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
  return now.toLocaleDateString("pt-BR", options).replace(",", " às")
}

// Carregar dados da planilha
async function loadData() {
  const resultadosDiv = document.getElementById("resultados")
  const btnAtualizar = document.getElementById("btn-atualizar")

  // Mostrar loading
  resultadosDiv.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      <p>Carregando resultados...</p>
    </div>
  `

  if (btnAtualizar) {
    btnAtualizar.classList.add("loading")
    btnAtualizar.disabled = true
  }

  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`,
    )

    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`)

    const data = await response.json()
    if (!data.values || data.values.length === 0) throw new Error("Planilha vazia")

    // Processar dados
    allResults = data.values.slice(1).map((row) => ({
      date: row[0] || "",
      team1: row[1] || "",
      score: row[2]?.split(/(?=[A-Za-z])/)[0]?.trim() || "",
      team2: row[3] || "",
      status: row[4] || "",
      competition: row[5] || "",
    }))

    // Calcular estatísticas
    calculatePerformanceStats()

    // Extrair competições únicas
    const competitions = [...new Set(allResults.map((r) => r.competition))].filter(Boolean)

    // Exibir resultados
    displayResults(allResults, "", competitions)

    // Atualizar timestamp
    document.getElementById("data-atualizacao").textContent = getFormattedDate()
    resultadosDiv.classList.add("updated")
    setTimeout(() => resultadosDiv.classList.remove("updated"), 1000)
  } catch (error) {
    console.error("Erro ao carregar dados:", error)
    resultadosDiv.innerHTML = `
      <div class="error-message">
        <h3><i class="bi bi-exclamation-triangle"></i> Erro ao carregar os resultados</h3>
        <p>${error.message}</p>
        <button id="btn-retry" class="btn-update">
          <i class="bi bi-arrow-repeat"></i> Tentar novamente
        </button>
      </div>
    `

    // Adicionar evento para tentar novamente
    document.getElementById("btn-retry")?.addEventListener("click", loadData)
  } finally {
    if (btnAtualizar) {
      btnAtualizar.classList.remove("loading")
      btnAtualizar.disabled = false
    }
  }
}

// Calcular estatísticas de desempenho
function calculatePerformanceStats() {
  performanceStats = {}

  allResults.forEach((result) => {
    if (!result.score.includes("-")) return

    const [goals1, goals2] = result.score.split("-").map(Number)
    const isHome = result.team1.includes("Cruzeiro")
    const matchResult = isHome
      ? goals1 > goals2
        ? "win"
        : goals1 < goals2
          ? "loss"
          : "draw"
      : goals2 > goals1
        ? "win"
        : goals2 < goals1
          ? "loss"
          : "draw"

    if (!performanceStats[result.competition]) {
      performanceStats[result.competition] = { wins: 0, draws: 0, losses: 0, games: 0, points: 0, performance: 0 }
    }

    performanceStats[result.competition].games++
    if (matchResult === "win") {
      performanceStats[result.competition].wins++
      performanceStats[result.competition].points += 3
    } else if (matchResult === "draw") {
      performanceStats[result.competition].draws++
      performanceStats[result.competition].points += 1
    } else {
      performanceStats[result.competition].losses++
    }
  })

  // Calcular aproveitamento
  for (const competition in performanceStats) {
    const stat = performanceStats[competition]
    stat.performance = stat.games > 0 ? Math.round((stat.points / (stat.games * 3)) * 100) : 0
  }
}

// Exibir resultados
function displayResults(results, selectedCompetition = "", competitions = []) {
  const resultadosDiv = document.getElementById("resultados")

  // Filtrar resultados por competição
  const filteredResults = selectedCompetition ? results.filter((r) => r.competition === selectedCompetition) : results

  // Calcular estatísticas gerais
  const overallStats = calculateOverallStats()

  // Gerar HTML
  let html = `
    <div class="results-content">
      <div class="filters-container">
        <div class="filter-group">
          <label for="competition-filter"><i class="bi bi-filter"></i> Filtrar por Competição:</label>
          <select id="competition-filter" class="filter-select" aria-label="Filtrar resultados por competição">
            <option value="">Todas as Competições</option>
  `

  // Opções de filtro
  competitions.forEach((comp) => {
    html += `<option value="${comp}" ${selectedCompetition === comp ? "selected" : ""}>${comp}</option>`
  })

  html += `
          </select>
        </div>
      </div>
      
      <div class="results-table-container">
        <table>
          <thead>
            <tr>
              <th><i class="bi bi-calendar-event"></i> Data</th>
              <th><i class="bi bi-people"></i> Jogo</th>
              <th><i class="bi bi-check2-square"></i> Resultado</th>
              <th><i class="bi bi-trophy"></i> Competição</th>
            </tr>
          </thead>
          <tbody>
  `

  if (filteredResults.length === 0) {
    html += `
      <tr>
        <td colspan="4" style="text-align: center; padding: 2rem;">
          <i class="bi bi-search" style="font-size: 2rem; color: var(--gray-dark); display: block; margin-bottom: 1rem;"></i>
          Nenhum resultado encontrado
        </td>
      </tr>
    `
  } else {
    filteredResults.forEach((result) => {
      const matchResult = getMatchResult(result)
      const scoreParts = result.score.split(/(?=[A-Za-z])/)
      const score = scoreParts[0].trim()
      const gameType = scoreParts.length > 1 ? scoreParts.slice(1).join("") : ""
      const isHome = result.team1.includes("Cruzeiro")

      let resultIcon = ""
      if (matchResult === "vitoria") {
        resultIcon = '<i class="bi bi-emoji-smile"></i>'
      } else if (matchResult === "empate") {
        resultIcon = '<i class="bi bi-emoji-neutral"></i>'
      } else if (matchResult === "derrota") {
        resultIcon = '<i class="bi bi-emoji-frown"></i>'
      }

      html += `
        <tr class="result-row">
          <td class="data"><i class="bi bi-calendar3"></i> ${formatDate(result.date)}</td>
          <td>
            <div class="jogo">
              <div class="team-container">
                <img src="${getTeamBadge(result.team1)}" alt="${result.team1}" class="team-badge">
                <span class="${isHome ? "time-casa" : ""}">${result.team1}</span>
              </div>
              <span class="versus"><i class="bi bi-x-lg"></i></span>
              <div class="team-container">
                <img src="${getTeamBadge(result.team2)}" alt="${result.team2}" class="team-badge">
                <span class="${!isHome ? "time-casa" : ""}">${result.team2}</span>
              </div>
            </div>
          </td>
          <td>
            <span class="resultado ${matchResult}">${resultIcon} ${score}</span>
          </td>
          <td class="campeonato">
            <i class="bi bi-trophy"></i> ${result.competition}
            ${gameType ? `<span class="tipo-jogo"><i class="bi bi-info-circle"></i> ${gameType}</span>` : ""}
          </td>
        </tr>
      `
    })
  }

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `

  resultadosDiv.innerHTML = html

  // Evento de filtro
  document.getElementById("competition-filter").addEventListener("change", (e) => {
    displayResults(allResults, e.target.value, competitions)
  })
}

// Calcular estatísticas gerais
function calculateOverallStats() {
  let totalGames = 0,
    totalWins = 0,
    totalDraws = 0,
    totalLosses = 0,
    totalPoints = 0

  for (const competition in performanceStats) {
    totalGames += performanceStats[competition].games
    totalWins += performanceStats[competition].wins
    totalDraws += performanceStats[competition].draws
    totalLosses += performanceStats[competition].losses
    totalPoints += performanceStats[competition].points
  }

  const overallPerformance = totalGames > 0 ? Math.round((totalPoints / (totalGames * 3)) * 100) : 0

  return {
    games: totalGames,
    wins: totalWins,
    draws: totalDraws,
    losses: totalLosses,
    performance: overallPerformance,
  }
}

// Funções auxiliares
function getColorByCompetition(competition) {
  const competitionLower = competition.toLowerCase()
  if (competitionLower.includes("campeonato brasileiro")) return "rgb(46, 125, 50)"
  if (competitionLower.includes("copa do brasil")) return "rgb(255, 215, 0)"
  if (competitionLower.includes("conmebol sudamericana")) return "rgb(0, 51, 160)"
  if (competitionLower.includes("libertadores")) return "rgb(25, 118, 210)"
  if (competitionLower.includes("mineiro")) return "rgb(156, 39, 176)"
  return "rgb(96, 125, 139)"
}

function formatDate(dateStr) {
  const parts = dateStr.split(" ")
  return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : dateStr
}

function getTeamBadge(teamName) {
  const badges = {
    Flamengo:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Flamengo-RJ_%28BRA%29.png/500px-Flamengo-RJ_%28BRA%29.png",
    Palmeiras:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Palmeiras_logo.svg/1280px-Palmeiras_logo.svg.png",
    "Red Bull Bragantino": "https://upload.wikimedia.org/wikipedia/pt/9/9e/RedBullBragantino.png",
    Cruzeiro:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/1280px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png",
    Fluminense: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/FFC_crest.svg/1106px-FFC_crest.svg.png",
    Internacional:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/SC_Internacional_Brazil_Logo.svg/1280px-SC_Internacional_Brazil_Logo.svg.png",
    Bahia: "https://upload.wikimedia.org/wikipedia/pt/9/90/ECBahia.png",
    "São Paulo":
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Brasao_do_Sao_Paulo_Futebol_Clube.svg/1284px-Brasao_do_Sao_Paulo_Futebol_Clube.svg.png",
    Botafogo:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Botafogo_de_Futebol_e_Regatas_logo.svg/1135px-Botafogo_de_Futebol_e_Regatas_logo.svg.png",
    Ceará:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Cear%C3%A1_Sporting_Club_logo.svg/1153px-Cear%C3%A1_Sporting_Club_logo.svg.png",
    "Vasco da Gama": "https://upload.wikimedia.org/wikipedia/pt/a/ac/CRVascodaGama.png",
    Corinthians: "https://upload.wikimedia.org/wikipedia/commons/c/c9/Escudo_sc_corinthians.png",
    Juventude: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/EC_Juventude.svg/1280px-EC_Juventude.svg.png",
    Mirassol: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Mirassol_FC_logo.png",
    Fortaleza:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Fortaleza_EC_2018.png/978px-Fortaleza_EC_2018.png",
    Vitória: "https://upload.wikimedia.org/wikipedia/pt/3/34/Esporte_Clube_Vit%C3%B3ria_logo.png",
    "Atlético-MG":
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Atletico_mineiro_galo.png/960px-Atletico_mineiro_galo.png",
    Grêmio: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Gremio_logo.svg/1074px-Gremio_logo.svg.png",
    Santos: "https://upload.wikimedia.org/wikipedia/commons/1/15/Santos_Logo.png",
    Sport: "https://upload.wikimedia.org/wikipedia/pt/1/17/Sport_Club_do_Recife.png",
    "Vila Nova":
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Vila_Nova_Logo_Oficial.svg/1024px-Vila_Nova_Logo_Oficial.svg.png",
    "Mushuc Runa": "https://upload.wikimedia.org/wikipedia/pt/3/39/Mushuc_Runa_SC.png",
    Palestino: "https://upload.wikimedia.org/wikipedia/pt/7/72/CDPalestino.png",
    "Unión (Santa Fe)":
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg/1024px-Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg.png",
  }
  return badges[teamName] || "https://via.placeholder.com/40/0033a0/ffffff?text=Time"
}

function getMatchResult(result) {
  if (!result.score.includes("-")) return ""

  const [goals1, goals2] = result.score.split("-").map(Number)
  const isHome = result.team1.includes("Cruzeiro")

  return isHome
    ? goals1 > goals2
      ? "vitoria"
      : goals1 < goals2
        ? "derrota"
        : "empate"
    : goals2 > goals1
      ? "vitoria"
      : goals2 < goals1
        ? "derrota"
        : "empate"
}


document.addEventListener("DOMContentLoaded", () => {
  createStars();
  loadData();

  // MENU RESPONSIVO igual ao index
  const menuToggle = document.querySelector(".menu-toggle");
  const navMenu = document.querySelector(".nav-menu");
  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => {
      menuToggle.classList.toggle("active");
      navMenu.classList.toggle("active");
      // Bloqueia scroll quando menu aberto
      document.body.classList.toggle("menu-open", navMenu.classList.contains("active"));
    });

    // Fecha menu ao clicar em um link
    navMenu.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", () => {
        menuToggle.classList.remove("active");
        navMenu.classList.remove("active");
        document.body.classList.remove("menu-open");
      });
    });
  }

  // BOTÃO ATUALIZAR
  const btnAtualizar = document.getElementById("btn-atualizar");
  if (btnAtualizar) {
    btnAtualizar.addEventListener("click", loadData);
  }

  // Redimensiona estrelas ao mudar tamanho da tela
  window.addEventListener("resize", createStars);
});

// Redimensionar estrelas ao redimensionar a janela
function handleResize() {
  createStars()
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  createStars()
  loadData()

  // Adicionar evento ao botão de menu mobile
  

  // Configurar links de navegação
  setupNavLinks()

  // Adicionar evento ao botão de atualizar
  document.getElementById("btn-atualizar").addEventListener("click", loadData)

  // Adicionar evento de redimensionamento
  window.addEventListener("resize", handleResize)
})

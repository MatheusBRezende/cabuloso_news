// Configurações da API do Google Sheets
const CONFIG = {
  spreadsheetId: "14r46LGxmQVUilSvimrcbBcUvUmIPaEtp89wblh_8ZU0",
  apiKey: "", 
  range: "A:F",
  updateInterval: 30000, 
  itemsPerPage: 10,
  maxRetries: 3,
  retryDelay: 2000,
}

// Escudos dos times
const TEAM_LOGOS = {
  Flamengo:"https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Flamengo-RJ_%28BRA%29.png/50px-Flamengo-RJ_%28BRA%29.png",
  Palmeiras:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Palmeiras_logo.svg/50px-Palmeiras_logo.svg.png",
  "Red Bull Bragantino":"https://upload.wikimedia.org/wikipedia/pt/9/9e/RedBullBragantino.png",
  Cruzeiro:"https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/50px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png",
  Fluminense:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/FFC_crest.svg/50px-FFC_crest.svg.png",
  Internacional:"https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/SC_Internacional_Brazil_Logo.svg/50px-SC_Internacional_Brazil_Logo.svg.png",
  Bahia: "https://upload.wikimedia.org/wikipedia/pt/9/90/ECBahia.png",
  "São Paulo":"https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Brasao_do_Sao_Paulo_Futebol_Clube.svg/50px-Brasao_do_Sao_Paulo_Futebol_Clube.svg.png",
  Botafogo:"https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Botafogo_de_Futebol_e_Regatas_logo.svg/50px-Botafogo_de_Futebol_e_Regatas_logo.svg.png",
  Ceará:"https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Cear%C3%A1_Sporting_Club_logo.svg/50px-Cear%C3%A1_Sporting_Club_logo.svg.png",
  Vasco:"https://upload.wikimedia.org/wikipedia/pt/a/ac/CRVascodaGama.png",
  Corinthians:"https://upload.wikimedia.org/wikipedia/commons/c/c9/Escudo_sc_corinthians.png",
  Juventude:"https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/EC_Juventude.svg/50px-EC_Juventude.svg.png",
  Mirassol:"https://upload.wikimedia.org/wikipedia/commons/5/5b/Mirassol_FC_logo.png",
  Fortaleza:"https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Fortaleza_EC_2018.png/50px-Fortaleza_EC_2018.png",
  Vitória:"https://upload.wikimedia.org/wikipedia/pt/3/34/Esporte_Clube_Vit%C3%B3ria_logo.png",
  "Atlético-MG":"https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Atletico_mineiro_galo.png/50px-Atletico_mineiro_galo.png",
  Grêmio:"https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Gremio_logo.svg/50px-Gremio_logo.svg.png",
  Santos: "https://upload.wikimedia.org/wikipedia/commons/1/15/Santos_Logo.png",
  Sport:"https://upload.wikimedia.org/wikipedia/pt/1/17/Sport_Club_do_Recife.png",
  "Vila Nova":"https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Vila_Nova_Logo_Oficial.svg/50px-Vila_Nova_Logo_Oficial.svg.png",
  "Mushuc Runa":"https://upload.wikimedia.org/wikipedia/pt/3/39/Mushuc_Runa_SC.png",
  Palestino: "https://upload.wikimedia.org/wikipedia/pt/7/72/CDPalestino.png",
  "Unión (Santa Fe)":"https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg/50px-Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg.png",
  "Unión Santa Fe":"https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg/50px-Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg.png",
  CRB:"https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/CRB_logo.svg/1024px-CRB_logo.svg.png",
}

// Global state
let allResults = []
let filteredResults = []
let currentPage = 1
let currentView = "table"
let sortColumn = ""
let sortDirection = "asc"
let retryCount = 0

// Utility functions
function getTeamLogo(teamName) {
  return TEAM_LOGOS[teamName] || "/placeholder.svg?height=24&width=24"
}

function isCruzeiro(teamName) {
  return teamName && teamName.toLowerCase().includes("cruzeiro")
}

function formatDate(dateStr) {
  if (!dateStr) return "Data não disponível"

  try {
    const parts = dateStr.split(" ")
    return parts.slice(0, 2).join(" ")
  } catch (error) {
    return dateStr
  }
}

function getFormattedDateTime() {
  const now = new Date()
  return now
    .toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", " às")
}

function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// API functions
async function fetchAPIKey() {
  try {
    const response = await fetch("/api/chave-google")
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    const data = await response.json()
    if (!data.apiKey) throw new Error("API key not found in response")

    CONFIG.apiKey = data.apiKey
    return true
  } catch (error) {
    console.error("Error fetching API key:", error)
    showToast("Erro ao conectar com o servidor", "error")
    return false
  }
}

async function fetchResultsData() {
  if (!CONFIG.apiKey) {
    throw new Error("API key not available")
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.spreadsheetId}/values/${CONFIG.range}?key=${CONFIG.apiKey}&majorDimension=ROWS`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  if (!data.values || data.values.length === 0) {
    throw new Error("No data found in spreadsheet")
  }

  return data.values
}

// Data processing
function processResultsData(rawData) {
  const results = []

  // Skip header row
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i]
    if (!row || row.length < 4) continue

    const scoreParts = row[2] ? row[2].split(/(?=[A-Za-z])/) : [""]

    results.push({
      id: i,
      date: row[0] || "",
      team1: row[1] || "",
      score: scoreParts[0].trim(),
      team2: row[3] || "",
      status: row[4] || "",
      competition: row[5] || "",
      gameType: scoreParts.length > 1 ? scoreParts.slice(1).join("").trim() : "",
      timestamp: new Date(row[0] || Date.now()).getTime(),
    })
  }

  return results.sort((a, b) => b.timestamp - a.timestamp)
}

function getMatchResult(result) {
  // 1. Verifica se existe uma observação manual no gameType (texto após o placar)
  // Se você escreveu "Derrota", "Eliminado" ou "Perdeu" na planilha, conta como derrota
  if (result.gameType) {
    const typeLower = result.gameType.toLowerCase();
    if (typeLower.includes("derrota") || typeLower.includes("eliminado") || typeLower.includes("perdeu")) {
      return "derrota";
    }
    // Se quiser forçar vitória (ex: passou nos penaltis mesmo empatando o jogo)
    if (typeLower.includes("vitoria") || typeLower.includes("classificado") || typeLower.includes("ganhou") || typeLower.includes("venceu")) {
      return "vitoria";
    }
  }

  if (!result.score || !result.score.includes("-")) return ""

  const [goals1, goals2] = result.score.split("-").map(Number)
  const isHome = isCruzeiro(result.team1)

  if (isHome) {
    return goals1 > goals2 ? "vitoria" : goals1 < goals2 ? "derrota" : "empate"
  } else {
    return goals2 > goals1 ? "vitoria" : goals2 < goals1 ? "derrota" : "empate"
  }
}

function calculateStatistics(results, competition = null) {
  const filtered = competition
    ? results.filter((r) => r.competition === competition)
    : results.filter((r) => isCruzeiro(r.team1) || isCruzeiro(r.team2))

  const stats = {
    totalJogos: 0,
    vitorias: 0,
    empates: 0,
    derrotas: 0,
    golsMarcados: 0,
    golsSofridos: 0,
    saldo: 0,
    aproveitamento: 0,
    sequenciaAtual: "",
    maiorSequenciaDerrotas: 0,
  }

  let currentStreak = 0
  let currentStreakType = ""
  let maxWinStreak = 0
  let maxLossStreak = 0
  let tempWinStreak = 0
  let tempLossStreak = 0

  filtered.forEach((result, index) => {
    const isCruzeiroHome = isCruzeiro(result.team1)
    const isCruzeiroAway = isCruzeiro(result.team2)

    if (!isCruzeiroHome && !isCruzeiroAway) return

    stats.totalJogos++

    const [gols1, gols2] = result.score.split("-").map(Number)

    if (isCruzeiroHome) {
      stats.golsMarcados += gols1
      stats.golsSofridos += gols2
      stats.saldo += gols1 - gols2
    } else {
      stats.golsMarcados += gols2
      stats.golsSofridos += gols1
      stats.saldo += gols2 - gols1
    }

    const matchResult = getMatchResult(result)

    // Count results
    if (matchResult === "vitoria") {
      stats.vitorias++
      tempWinStreak++
      tempLossStreak = 0
      if (index === 0) currentStreakType = "V"
    } else if (matchResult === "empate") {
      stats.empates++
      tempWinStreak = 0
      tempLossStreak = 0
      if (index === 0) currentStreakType = "E"
    } else {
      stats.derrotas++
      tempLossStreak++
      tempWinStreak = 0
      if (index === 0) currentStreakType = "D"
    }

    // Track streaks
    maxWinStreak = Math.max(maxWinStreak, tempWinStreak)
    maxLossStreak = Math.max(maxLossStreak, tempLossStreak)

    if (index === 0) {
      currentStreak = 1
    } else if (matchResult === currentStreakType.toLowerCase()) {
      currentStreak++
    }
  })


  stats.maiorSequenciaDerrotas = maxLossStreak
  stats.sequenciaAtual = `${currentStreak}${currentStreakType}`

  if (stats.totalJogos > 0) {
    stats.aproveitamento = (((stats.vitorias * 3 + stats.empates) / (stats.totalJogos * 3)) * 100).toFixed(1)
  }

  return stats
}

// Adicione após a função calculateStatistics existente:

function updateHeaderPreview(stats) {
  const gamesEl = document.getElementById("preview-games")
  const winsEl = document.getElementById("preview-wins")
  const goalsEl = document.getElementById("preview-goals")
  const perfEl = document.getElementById("preview-performance")

  // Mostra os valores dinâmicos quando disponíveis
  if (stats) {
    gamesEl.textContent = stats.totalJogos || gamesEl.dataset.fallback
    winsEl.textContent = stats.vitorias || winsEl.dataset.fallback
    goalsEl.textContent = stats.golsMarcados || goalsEl.dataset.fallback
    perfEl.textContent = `${stats.aproveitamento || perfEl.dataset.fallback}%`
  } else {
    // Fallback para valores estáticos
    gamesEl.textContent = gamesEl.dataset.fallback
    winsEl.textContent = winsEl.dataset.fallback
    goalsEl.textContent = goalsEl.dataset.fallback
    perfEl.textContent = `${perfEl.dataset.fallback}%`
  }
}

function displayCompetitionStatistics(competition = "") {
  const statsContent = document.getElementById("stats-content")
  if (!statsContent) return

  // Filter results by competition
  let competitionResults = allResults.filter((r) => isCruzeiro(r.team1) || isCruzeiro(r.team2))

  if (competition) {
    competitionResults = competitionResults.filter((r) => r.competition === competition)
  }

  if (competitionResults.length === 0) {
    statsContent.innerHTML = `
      <div class="no-data-message">
        <i class="fas fa-chart-line"></i>
        <h3>Nenhum dado encontrado</h3>
        <p>Não há jogos registrados para ${competition || "esta seleção"}.</p>
      </div>
    `
    return
  }

  const stats = calculateStatistics(competitionResults)
  const competitionName = competition || "Todas as Competições"

  statsContent.innerHTML = `
    <div class="competition-stats active">
      <div class="stats-header">
        <h3 class="stats-title">${competitionName}</h3>
        <p class="stats-subtitle">${stats.totalJogos} jogos disputados</p>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Jogos Disputados</span>
            <div class="stat-icon games">
              <i class="fas fa-futbol"></i>
            </div>
          </div>
          <div class="stat-value">${stats.totalJogos}</div>
          <div class="stat-description">
            Total de partidas na ${competitionName.toLowerCase()}
          </div>
          <div class="stat-breakdown">
            <div class="breakdown-item wins">
              <div class="breakdown-value">${stats.vitorias}</div>
              <div class="breakdown-label">Vitórias</div>
            </div>
            <div class="breakdown-item draws">
              <div class="breakdown-value">${stats.empates}</div>
              <div class="breakdown-label">Empates</div>
            </div>
            <div class="breakdown-item losses">
              <div class="breakdown-value">${stats.derrotas}</div>
              <div class="breakdown-label">Derrotas</div>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Gols Marcados</span>
            <div class="stat-icon goals">
              <i class="fas fa-bullseye"></i>
            </div>
          </div>
          <div class="stat-value">${stats.golsMarcados}</div>
          <div class="stat-description">
            Média de ${stats.totalJogos > 0 ? (stats.golsMarcados / stats.totalJogos).toFixed(1) : 0} gols por jogo
          </div>
          <div class="stat-breakdown">
            <div class="breakdown-item">
              <div class="breakdown-value">${stats.golsSofridos}</div>
              <div class="breakdown-label">Sofridos</div>
            </div>
            <div class="breakdown-item">
              <div class="breakdown-value">${stats.totalJogos > 0 ? (stats.golsSofridos / stats.totalJogos).toFixed(1) : 0}</div>
              <div class="breakdown-label">Média/Jogo</div>
            </div>
            <div class="breakdown-item">
              <div class="breakdown-value">${stats.saldo >= 0 ? "+" : ""}${stats.saldo}</div>
              <div class="breakdown-label">Saldo</div>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Saldo de Gols</span>
            <div class="stat-icon balance">
              <i class="fas fa-calculator"></i>
            </div>
          </div>
          <div class="stat-value ${stats.saldo >= 0 ? "positive" : "negative"}">
            ${stats.saldo >= 0 ? "+" : ""}${stats.saldo}
          </div>
          <div class="stat-description">
            Diferença entre gols marcados e sofridos
          </div>
          <div class="stat-breakdown">
            <div class="breakdown-item">
              <div class="breakdown-value">${stats.golsMarcados}</div>
              <div class="breakdown-label">Marcados</div>
            </div>
            <div class="breakdown-item">
              <div class="breakdown-value">${stats.golsSofridos}</div>
              <div class="breakdown-label">Sofridos</div>
            </div>
            <div class="breakdown-item">
              <div class="breakdown-value">${stats.totalJogos > 0 ? (stats.golsMarcados / stats.golsSofridos || 0).toFixed(2) : 0}</div>
              <div class="breakdown-label">Razão</div>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Aproveitamento</span>
            <div class="stat-icon performance">
              <i class="fas fa-chart-line"></i>
            </div>
          </div>
          <div class="stat-value">${stats.aproveitamento}%</div>
          <div class="stat-description">
            Sequência atual: ${stats.sequenciaAtual || "N/A"}
          </div>
          <div class="stat-breakdown">
            <div class="breakdown-item">
              <div class="breakdown-value">${stats.totalJogos > 0 ? ((stats.vitorias / stats.totalJogos) * 100).toFixed(1) : 0}%</div>
              <div class="breakdown-label">% Vitórias</div>
            </div>
            <div class="breakdown-item">
              <div class="breakdown-value">${stats.totalJogos > 0 ? stats.vitorias * 3 + stats.empates : 0}</div>
              <div class="breakdown-label">Pontos</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

function setupCompetitionTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn")

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Remove active class from all tabs
      tabButtons.forEach((btn) => btn.classList.remove("active"))

      // Add active class to clicked tab
      button.classList.add("active")

      // Get competition and display stats
      const competition = button.dataset.competition
      displayCompetitionStatistics(competition)
    })
  })
}

// UI functions
function showLoadingOverlay() {
  const overlay = document.getElementById("loading-overlay")
  if (overlay) {
    overlay.classList.remove("hidden")
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById("loading-overlay")
  if (overlay) {
    overlay.classList.add("hidden")
  }
}

function showToast(message, type = "success", duration = 5000) {
  const container = document.getElementById("toast-container")
  if (!container) return

  const toast = document.createElement("div")
  toast.className = `toast ${type}`

  const iconMap = {
    success: "fas fa-check-circle",
    error: "fas fa-exclamation-circle",
    warning: "fas fa-exclamation-triangle",
    info: "fas fa-info-circle",
  }

  toast.innerHTML = `
    <i class="toast-icon ${iconMap[type]}"></i>
    <span class="toast-message">${message}</span>
    <i class="toast-close fas fa-times"></i>
  `

  container.appendChild(toast)

  // Add close functionality
  const closeBtn = toast.querySelector(".toast-close")
  closeBtn.addEventListener("click", () => {
    toast.remove()
  })

  // Auto remove after duration
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove()
    }
  }, duration)
}

function updateLastUpdateTime() {
  const element = document.getElementById("data-atualizacao")
  if (element) {
    element.textContent = getFormattedDateTime()
  }
}

function displayStatistics(stats) {
  const dashboard = document.getElementById("statistics-dashboard")
  if (!dashboard) return

  dashboard.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">Total de Jogos</span>
          <div class="stat-icon games">
            <i class="fas fa-futbol"></i>
          </div>
        </div>
        <div class="stat-value">${stats.totalJogos}</div>
        <div class="stat-breakdown">
          <div class="breakdown-item wins">
            <div class="breakdown-value">${stats.vitorias}</div>
            <div class="breakdown-label">Vitórias</div>
          </div>
          <div class="breakdown-item draws">
            <div class="breakdown-value">${stats.empates}</div>
            <div class="breakdown-label">Empates</div>
          </div>
          <div class="breakdown-item losses">
            <div class="breakdown-value">${stats.derrotas}</div>
            <div class="breakdown-label">Derrotas</div>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">Gols</span>
          <div class="stat-icon goals">
            <i class="fas fa-bullseye"></i>
          </div>
        </div>
        <div class="stat-value">${stats.golsMarcados}</div>
        <div class="stat-description">
          ${stats.golsMarcados} marcados • ${stats.golsSofridos} sofridos
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">Saldo de Gols</span>
          <div class="stat-icon balance">
            <i class="fas fa-calculator"></i>
          </div>
        </div>
        <div class="stat-value ${stats.saldo >= 0 ? "positive" : "negative"}">
          ${stats.saldo >= 0 ? "+" : ""}${stats.saldo}
        </div>
        <div class="stat-description">
          Diferença entre gols marcados e sofridos
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">Aproveitamento</span>
          <div class="stat-icon performance">
            <i class="fas fa-chart-line"></i>
          </div>
        </div>
        <div class="stat-value">${stats.aproveitamento}%</div>
        <div class="stat-description">
          Sequência atual: ${stats.sequenciaAtual}
        </div>
      </div>
    </div>
  `
}

function displayResults() {
  const startIndex = (currentPage - 1) * CONFIG.itemsPerPage
  const endIndex = startIndex + CONFIG.itemsPerPage
  const pageResults = filteredResults.slice(startIndex, endIndex)

  if (currentView === "table") {
    displayTableView(pageResults)
  } else {
    displayCardsView(pageResults)
  }

  updatePagination()
  showResultsContainer()
}

function displayTableView(results) {
  const tbody = document.getElementById("results-tbody")
  if (!tbody) return

  if (results.length === 0) {
    showEmptyState()
    return
  }

  tbody.innerHTML = results
    .map((result) => {
      const matchResult = getMatchResult(result)
      const isHome = isCruzeiro(result.team1)

      return `
      <tr class="result-row">
        <td>${formatDate(result.date)}</td>
        <td>
          <div class="match-teams">
            <img src="${getTeamLogo(result.team1)}" alt="${result.team1}" class="team-logo">
            <span class="team-name ${isHome ? "home" : ""}">${result.team1}</span>
            <span class="vs">x</span>
            <img src="${getTeamLogo(result.team2)}" alt="${result.team2}" class="team-logo">
            <span class="team-name ${!isHome ? "home" : ""}">${result.team2}</span>
          </div>
        </td>
        <td>
          <span class="result ${matchResult}">
            <i class="fas fa-${matchResult === "vitoria" ? "check-circle" : matchResult === "empate" ? "equals" : "times-circle"}"></i>
            ${result.score}
          </span>
        </td>
        <td>
          ${result.competition}
          ${result.gameType ? `<br><small class="game-type">${result.gameType}</small>` : ""}
        </td>
      </tr>
    `
    })
    .join("")
}

function displayCardsView(results) {
  const container = document.getElementById("results-cards")
  if (!container) return

  if (results.length === 0) {
    showEmptyState()
    return
  }

  container.innerHTML = results
    .map((result) => {
      const matchResult = getMatchResult(result)
      const isHome = isCruzeiro(result.team1)
      const [goals1, goals2] = result.score.split("-").map((g) => g.trim())

      return `
      <div class="result-card ${matchResult}">
        <div class="card-header">
          <span class="card-date">${formatDate(result.date)}</span>
          <span class="card-competition">${result.competition}</span>
        </div>
        <div class="card-match">
          <div class="card-team home ${isHome ? "cruzeiro" : ""}">
            <img src="${getTeamLogo(result.team1)}" alt="${result.team1}">
            <span class="card-team-name">${result.team1}</span>
          </div>
          <div class="card-score">${goals1} - ${goals2}</div>
          <div class="card-team away ${!isHome ? "cruzeiro" : ""}">
            <img src="${getTeamLogo(result.team2)}" alt="${result.team2}">
            <span class="card-team-name">${result.team2}</span>
          </div>
        </div>
        ${result.gameType ? `<div class="card-game-type">${result.gameType}</div>` : ""}
      </div>
    `
    })
    .join("")
}

function updatePagination() {
  const totalPages = Math.ceil(filteredResults.length / CONFIG.itemsPerPage)
  const pagination = document.getElementById("pagination")
  const currentPageSpan = document.getElementById("current-page")
  const totalPagesSpan = document.getElementById("total-pages")
  const prevBtn = document.getElementById("prev-page")
  const nextBtn = document.getElementById("next-page")

  if (totalPages <= 1) {
    pagination.style.display = "none"
    return
  }

  pagination.style.display = "flex"
  currentPageSpan.textContent = currentPage
  totalPagesSpan.textContent = totalPages

  prevBtn.disabled = currentPage === 1
  nextBtn.disabled = currentPage === totalPages
}

function showResultsContainer() {
  document.getElementById("results-loading").style.display = "none"
  document.getElementById("results-error").style.display = "none"
  document.getElementById("results-empty").style.display = "none"
  document.getElementById("fallback-table").style.display = "none"

  document.getElementById("table-view").style.display = currentView === "table" ? "block" : "none"
  document.getElementById("cards-view").style.display = currentView === "cards" ? "block" : "none"
}

function showLoadingState() {
  document.getElementById("results-loading").style.display = "flex"
  document.getElementById("results-error").style.display = "none"
  document.getElementById("results-empty").style.display = "none"
  document.getElementById("table-view").style.display = "none"
  document.getElementById("cards-view").style.display = "none"
  document.getElementById("fallback-table").style.display = "none"
}

function showErrorState() {
  document.getElementById("results-loading").style.display = "none"
  document.getElementById("results-error").style.display = "flex"
  document.getElementById("results-empty").style.display = "none"
  document.getElementById("table-view").style.display = "none"
  document.getElementById("cards-view").style.display = "none"
  document.getElementById("fallback-table").style.display = "block"
}

function showEmptyState() {
  document.getElementById("results-loading").style.display = "none"
  document.getElementById("results-error").style.display = "none"
  document.getElementById("results-empty").style.display = "flex"
  document.getElementById("table-view").style.display = "none"
  document.getElementById("cards-view").style.display = "none"
  document.getElementById("fallback-table").style.display = "none"
}

// Filter functions
function applyFilters() {
  const competitionFilter = document.getElementById("competition-filter").value
  const periodFilter = document.getElementById("period-filter").value
  const resultFilter = document.getElementById("result-filter").value

  filteredResults = allResults.filter((result) => {
    // Competition filter
    if (competitionFilter && result.competition !== competitionFilter) {
      return false
    }

    // Result filter
    if (resultFilter) {
      const matchResult = getMatchResult(result)
      if (matchResult !== resultFilter) {
        return false
      }
    }

    // Period filter
    if (periodFilter) {
      const resultDate = new Date(result.date)
      const now = new Date()

      switch (periodFilter) {
        case "last-10":
          return allResults.indexOf(result) < 10
        case "last-month":
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
          return resultDate >= lastMonth
        case "current-season":
          const seasonStart = new Date(now.getFullYear(), 0, 1)
          return resultDate >= seasonStart
      }
    }

    return true
  })

  currentPage = 1
  displayResults()

  // Update statistics based on filtered results
  const stats = calculateStatistics(filteredResults)
  displayStatistics(stats)
}

function populateCompetitionFilter() {
  const select = document.getElementById("competition-filter")
  if (!select) return

  const competitions = [...new Set(allResults.map((r) => r.competition).filter(Boolean))]

  // Clear existing options except the first one
  select.innerHTML = '<option value="">Todas as Competições</option>'

  competitions.forEach((competition) => {
    const option = document.createElement("option")
    option.value = competition
    option.textContent = competition
    select.appendChild(option)
  })
}

// Sort functions
function sortResults(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === "asc" ? "desc" : "asc"
  } else {
    sortColumn = column
    sortDirection = "asc"
  }

  filteredResults.sort((a, b) => {
    let valueA, valueB

    switch (column) {
      case "date":
        valueA = new Date(a.date).getTime()
        valueB = new Date(b.date).getTime()
        break
      case "result":
        const resultOrder = { vitoria: 3, empate: 2, derrota: 1 }
        valueA = resultOrder[getMatchResult(a)] || 0
        valueB = resultOrder[getMatchResult(b)] || 0
        break
      case "competition":
        valueA = a.competition.toLowerCase()
        valueB = b.competition.toLowerCase()
        break
      default:
        return 0
    }

    if (valueA < valueB) return sortDirection === "asc" ? -1 : 1
    if (valueA > valueB) return sortDirection === "asc" ? 1 : -1
    return 0
  })

  updateSortIcons()
  displayResults()
}

function updateSortIcons() {
  document.querySelectorAll(".sortable").forEach((th) => {
    const icon = th.querySelector(".sort-icon")
    th.classList.remove("sorted")
    icon.className = "fas fa-sort sort-icon"
  })

  if (sortColumn) {
    const activeTh = document.querySelector(`[data-sort="${sortColumn}"]`)
    if (activeTh) {
      activeTh.classList.add("sorted")
      const icon = activeTh.querySelector(".sort-icon")
      icon.className = `fas fa-sort-${sortDirection === "asc" ? "up" : "down"} sort-icon`
    }
  }
}

function generateCSV() {
  const headers = ["Data", "Time Casa", "Placar", "Time Visitante", "Competição", "Tipo"]
  const rows = filteredResults.map((result) => [
    result.date,
    result.team1,
    result.score,
    result.team2,
    result.competition,
    result.gameType || "",
  ])

  return [headers, ...rows].map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")
}

// Main data loading
async function loadResults() {
  showLoadingState()

  const updateBtn = document.getElementById("btn-atualizar")
  if (updateBtn) {
    updateBtn.classList.add("loading")
    updateBtn.disabled = true
  }

  try {
    // Fetch API key if not available
    if (!CONFIG.apiKey) {
      const keyFetched = await fetchAPIKey()
      if (!keyFetched) {
        throw new Error("Failed to fetch API key")
      }
    }

    // Fetch results data
    const rawData = await fetchResultsData()
    allResults = processResultsData(rawData)

    if (allResults.length === 0) {
      throw new Error("No results found")
    }

    // Apply initial filters
    filteredResults = allResults.filter((r) => isCruzeiro(r.team1) || isCruzeiro(r.team2))

    // Update UI
    populateCompetitionFilter()
    displayResults()

    // Calculate and display statistics
    const generalStats = calculateStatistics(filteredResults)
    updateHeaderPreview(generalStats)
    displayCompetitionStatistics() // Show general stats by default

    updateLastUpdateTime()
    showToast("Resultados atualizados com sucesso!", "success")

    retryCount = 0 // Reset retry count on success
  } catch (error) {
    console.error("Error loading results:", error)

    if (retryCount < CONFIG.maxRetries) {
      retryCount++
      showToast(`Erro ao carregar dados. Tentativa ${retryCount}/${CONFIG.maxRetries}...`, "warning")

      setTimeout(() => {
        loadResults()
      }, CONFIG.retryDelay)
    } else {
      showErrorState()
      showToast("Erro ao carregar resultados. Usando dados estáticos.", "error")
      retryCount = 0
    }
  } finally {
    if (updateBtn) {
      updateBtn.classList.remove("loading")
      updateBtn.disabled = false
    }
    hideLoadingOverlay()
  }
}

// Event listeners
function setupEventListeners() {
  // Update button
  const updateBtn = document.getElementById("btn-atualizar")
  if (updateBtn) {
    updateBtn.addEventListener("click", loadResults)
  }

  // Retry button
  const retryBtn = document.getElementById("btn-retry")
  if (retryBtn) {
    retryBtn.addEventListener("click", loadResults)
  }

  // View toggle buttons
  const tableViewBtn = document.getElementById("view-table")
  const cardsViewBtn = document.getElementById("view-cards")

  if (tableViewBtn && cardsViewBtn) {
    tableViewBtn.addEventListener("click", () => {
      currentView = "table"
      tableViewBtn.classList.add("active")
      cardsViewBtn.classList.remove("active")
      displayResults()
    })

    cardsViewBtn.addEventListener("click", () => {
      currentView = "cards"
      cardsViewBtn.classList.add("active")
      tableViewBtn.classList.remove("active")
      displayResults()
    })
  }

  // Filter listeners
  const competitionFilter = document.getElementById("competition-filter")
  const periodFilter = document.getElementById("period-filter")
  const resultFilter = document.getElementById("result-filter")

  if (competitionFilter) {
    competitionFilter.addEventListener("change", debounce(applyFilters, 300))
  }
  if (periodFilter) {
    periodFilter.addEventListener("change", debounce(applyFilters, 300))
  }
  if (resultFilter) {
    resultFilter.addEventListener("change", debounce(applyFilters, 300))
  }

  // Pagination listeners
  const prevBtn = document.getElementById("prev-page")
  const nextBtn = document.getElementById("next-page")

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--
        displayResults()
      }
    })
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const totalPages = Math.ceil(filteredResults.length / CONFIG.itemsPerPage)
      if (currentPage < totalPages) {
        currentPage++
        displayResults()
      }
    })
  }

  // Sort listeners
  document.addEventListener("click", (e) => {
    if (e.target.closest(".sortable")) {
      const sortColumn = e.target.closest(".sortable").dataset.sort
      if (sortColumn) {
        sortResults(sortColumn)
      }
    }
  })

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

  // Competition tabs
  setupCompetitionTabs()
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  console.log("Initializing Cabuloso Results...")

  setupEventListeners()
  loadResults()

  // Set up periodic updates
  setInterval(() => {
    if (document.visibilityState === "visible") {
      loadResults()
    }
  }, CONFIG.updateInterval)

  console.log("Cabuloso Results initialized successfully!")
})

// Error handling
window.addEventListener("error", (e) => {
  console.error("Global error:", e.error)
  showToast("Ocorreu um erro inesperado", "error")
})

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason)
  showToast("Erro de conexão", "error")
})

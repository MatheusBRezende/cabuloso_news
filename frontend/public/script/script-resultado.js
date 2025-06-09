// Configurações da API do Google Sheets
const spreadsheetId = "14r46LGxmQVUilSvimrcbBcUvUmIPaEtp89wblh_8ZU0";
let apiKey = "";
const range = "A:F";

// Escudos dos times
var escudos = {
  Cruzeiro:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/1280px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png",
  Flamengo:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Flamengo-RJ_%28BRA%29.png/500px-Flamengo-RJ_%28BRA%29.png",
  Palmeiras:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Palmeiras_logo.svg/1280px-Palmeiras_logo.svg.png",
  "Red Bull Bragantino":
    "https://upload.wikimedia.org/wikipedia/pt/9/9e/RedBullBragantino.png",
  Fluminense:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/FFC_crest.svg/1106px-FFC_crest.svg.png",
  Internacional:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/SC_Internacional_Brazil_Logo.svg/1280px-SC_Internacional_Brazil_Logo.svg.png",
  Bahia: "https://upload.wikimedia.org/wikipedia/pt/9/90/ECBahia.png",
  "São Paulo":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Brasao_do_Sao_Paulo_Futebol_Clube.svg/1284px-Brasao_do_Sao_Paulo_Futebol_Clube.svg.png",
  Botafogo:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Botafogo_de_Futebol_e_Regatas_logo.svg/1135px-Botafogo_de_Futebol_e_Regatas_logo.svg.png",
  Ceará:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Cear%C3%A1_Sporting_Club_logo.svg/1153px-Cear%C3%A1_Sporting_Club_logo.svg.png",
  "Vasco da Gama":
    "https://upload.wikimedia.org/wikipedia/pt/a/ac/CRVascodaGama.png",
  Corinthians:
    "https://upload.wikimedia.org/wikipedia/commons/c/c9/Escudo_sc_corinthians.png",
  Juventude:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/EC_Juventude.svg/1280px-EC_Juventude.svg.png",
  Mirassol:
    "https://upload.wikimedia.org/wikipedia/commons/5/5b/Mirassol_FC_logo.png",
  Fortaleza:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Fortaleza_EC_2018.png/978px-Fortaleza_EC_2018.png",
  Vitória:
    "https://upload.wikimedia.org/wikipedia/pt/3/34/Esporte_Clube_Vit%C3%B3ria_logo.png",
  "Atlético-MG":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Atletico_mineiro_galo.png/960px-Atletico_mineiro_galo.png",
  Grêmio:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Gremio_logo.svg/1074px-Gremio_logo.svg.png",
  Santos: "https://upload.wikimedia.org/wikipedia/commons/1/15/Santos_Logo.png",
  Sport:
    "https://upload.wikimedia.org/wikipedia/pt/1/17/Sport_Club_do_Recife.png",
  "Vila Nova":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Vila_Nova_Logo_Oficial.svg/1024px-Vila_Nova_Logo_Oficial.svg.png",
  "Mushuc Runa":
    "https://upload.wikimedia.org/wikipedia/pt/3/39/Mushuc_Runa_SC.png",
  Palestino: "https://upload.wikimedia.org/wikipedia/pt/7/72/CDPalestino.png",
  "Unión (Santa Fe)":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg/1024px-Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg.png",
};

function getEscudo(time) {
  return (
    escudos[time] || "https://via.placeholder.com/40/0033a0/ffffff?text=Time"
  );
}

async function fetchAPIKey() {
  try {
    var response = await fetch("/api/chave-google");
    var data = await response.json();
    apiKey = data.apiKey;
  } catch (error) {
    console.error("Erro ao obter API Key:", error);
  }
}

function getFormattedDate() {
  var now = new Date();
  var options = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return now.toLocaleDateString("pt-BR", options).replace(",", " às");
}

async function loadData() {
  var resultadosDiv = document.querySelector(".espn-style-results");
  var loadingDiv = document.querySelector(".loading");
  var btnAtualizar = document.getElementById("btn-atualizar");
  var staticTable = document.querySelector(".tabela-estatica.fallback-table");

  if (loadingDiv) loadingDiv.style.display = "flex";
  if (btnAtualizar) {
    btnAtualizar.classList.add("loading");
    btnAtualizar.disabled = true;
  }

  try {
    if (staticTable) staticTable.style.display = "none";

    var response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}&majorDimension=ROWS`
    );

    if (!response.ok) throw new Error("Erro HTTP: " + response.status);

    var data = await response.json();

    if (!data.values || data.values.length === 0)
      throw new Error("Planilha vazia");

    allResults = [];
    for (var i = 1; i < data.values.length; i++) {
      var row = data.values[i];
      if (!row || row.length < 4) continue;

      var scoreParts = row[2] ? row[2].split(/(?=[A-Za-z])/) : [""];
      allResults.push({
        date: row[0] || "",
        team1: row[1] || "",
        score: scoreParts[0].trim(),
        team2: row[3] || "",
        status: row[4] || "",
        competition: row[5] || "",
        gameType:
          scoreParts.length > 1 ? scoreParts.slice(1).join("").trim() : "",
      });
    }

    console.log("Total de jogos carregados:", allResults.length);
    var competitions = [
      ...new Set(allResults.map((r) => r.competition).filter(Boolean)),
    ];

     displayResults(allResults, "", competitions);
    if (resultadosDiv) resultadosDiv.style.display = "block";
    var dataAtualizacao = document.getElementById("data-atualizacao");
    if (dataAtualizacao) dataAtualizacao.textContent = getFormattedDate();

  } catch (error) {
    console.error("Erro ao carregar dados:", error);

    if (resultadosDiv) {
      resultadosDiv.innerHTML = `
        <div class="error-message">
          <h3>Erro ao carregar os resultados</h3>
          <p>${error.message}</p>
          <button id="btn-retry" class="btn-update">Tentar novamente</button>
        </div>
      `;

      document.getElementById("btn-retry")?.addEventListener("click", loadData);
    }
     if (staticTable) staticTable.style.display = "block";
  } finally {
    // Esconde o loader e reativa o botão
    if (loadingDiv) loadingDiv.style.display = "none";
    if (btnAtualizar) {
      btnAtualizar.classList.remove("loading");
      btnAtualizar.disabled = false;
    }

    
    if (resultadosDiv) resultadosDiv.style.display = "block";
  }
}

function isCruzeiro(teamName) {
  return teamName && teamName.toLowerCase().includes("cruzeiro");
}

function calculateStatistics(results, competition = null) {
  const filtered = competition 
    ? results.filter(r => r.competition === competition)
    : results.filter(r => isCruzeiro(r.team1) || isCruzeiro(r.team2));
    
  const stats = {
    totalJogos: 0,
    vitorias: 0,
    empates: 0,
    derrotas: 0,
    golsMarcados: 0,
    golsSofridos: 0,
    saldo: 0,
    aproveitamento: 0,
  };

  filtered.forEach((result) => {
    const isCruzeiroHome = isCruzeiro(result.team1);
    const isCruzeiroAway = isCruzeiro(result.team2);

    // Só processa se o Cruzeiro estiver em um dos times
    if (!isCruzeiroHome && !isCruzeiroAway) return;

    stats.totalJogos++;

    const [gols1, gols2] = result.score.split("-").map(Number);

    if (isCruzeiroHome) {
      stats.golsMarcados += gols1;
      stats.golsSofridos += gols2;
      stats.saldo += gols1 - gols2;
    } else {
      stats.golsMarcados += gols2;
      stats.golsSofridos += gols1;
      stats.saldo += gols2 - gols1;
    }

    const matchResult = getMatchResult(result);
    if (matchResult === "vitoria") stats.vitorias++;
    else if (matchResult === "empate") stats.empates++;
    else stats.derrotas++;
  });

  if (stats.totalJogos > 0) {
    stats.aproveitamento = (
      ((stats.vitorias * 3 + stats.empates) / (stats.totalJogos * 3)) *
      100
    ).toFixed(1);
  }

  return stats;
}


function displayResults(results, selectedCompetition, competitions) {
  const stats = calculateStatistics(
    results.filter((r) => isCruzeiro(r.team1) || isCruzeiro(r.team2)),
    selectedCompetition
  );
  
  var resultadosDiv = document.querySelector(".espn-style-results .month-group tbody");
  selectedCompetition = selectedCompetition || "";

  var filteredResults = selectedCompetition
    ? results.filter((r) => r.competition === selectedCompetition)
    : results.filter((r) => isCruzeiro(r.team1) || isCruzeiro(r.team2));

  if (!resultadosDiv) return;

  resultadosDiv.innerHTML = "";

  // Adiciona linha de estatísticas
  var statsRow = document.createElement("tr");
  statsRow.className = "stats-row";
  statsRow.innerHTML = `
    <td colspan="4">
      <h3 class="stats-title">${selectedCompetition || "Estatísticas Gerais"}</h3>
      <div class="stats-summary">
        <div class="stat-card">
          <i class="fas fa-futbol"></i>
          <h3>Jogos</h3>
          <p>${stats.totalJogos} (${stats.vitorias}V ${stats.empates}E ${stats.derrotas}D)</p>
        </div>
        <div class="stat-card">
          <i class="fas fa-bullseye"></i>
          <h3>Gols</h3>
          <p>${stats.golsMarcados} (Pró) / ${stats.golsSofridos} (Contra)</p>
        </div>
        <div class="stat-card">
          <i class="fas fa-calculator"></i>
          <h3>Saldo</h3>
          <p class="${stats.saldo >= 0 ? "positive" : "negative"}">${
    stats.saldo >= 0 ? "+" : ""
  }${stats.saldo}</p>
        </div>
        <div class="stat-card">
          <i class="fas fa-chart-line"></i>
          <h3>Aproveitamento</h3>
          <p>${stats.aproveitamento}%</p>
        </div>
      </div>
    </td>
  `;
  resultadosDiv.appendChild(statsRow);

   var headerRow = document.createElement("tr");
  headerRow.className = "table-header";
  headerRow.innerHTML = `
    <th class="col-data"><i class="bi bi-calendar-event"></i> DATA</th>
    <th class="col-jogo"><i class="bi bi-people"></i> JOGO</th>
    <th class="col-resultado"><i class="bi bi-check2-square"></i> RESULTADO</th>
    <th class="col-campeonato"><i class="bi bi-trophy"></i> CAMPEONATO</th>
  `;
  resultadosDiv.appendChild(headerRow);

  if (filteredResults.length === 0) {
    var emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
      <td colspan="4" style="text-align: center; padding: 2rem;">
        Nenhum resultado encontrado
      </td>
    `;
    resultadosDiv.appendChild(emptyRow);
  } else {
    filteredResults.forEach((result) => {
      var matchResult = getMatchResult(result);
      var isHome = isCruzeiro(result.team1);
      var resultIcon = "";

      if (matchResult === "vitoria")
        resultIcon = '<i class="fas fa-check-circle" style="color:green"></i>';
      else if (matchResult === "empate")
        resultIcon = '<i class="fas fa-equals" style="color:orange"></i>';
      else if (matchResult === "derrota")
        resultIcon = '<i class="fas fa-times-circle" style="color:red"></i>';

      var row = document.createElement("tr");
      row.className = "result-row";
      row.innerHTML = `
        <td class="data">${formatDate(result.date)}</td>
        <td>
          <div class="jogo">
            <img src="${getEscudo(result.team1)}" alt="${
        result.team1
      }" class="escudo-time">
            <span class="${isHome ? "time-casa" : ""}">${result.team1}</span>
            x
            <img src="${getEscudo(result.team2)}" alt="${
        result.team2
      }" class="escudo-time">
            <span class="${!isHome ? "time-casa" : ""}">${result.team2}</span>
          </div>
        </td>
        <td>
          <span class="resultado ${matchResult}">
            ${resultIcon} ${result.score}
          </span>
        </td>
        <td class="campeonato">
          ${result.competition}
          ${
            result.gameType
              ? `<span class="tipo-jogo">${result.gameType}</span>`
              : ""
          }
        </td>
      `;
      resultadosDiv.appendChild(row);
    });
  }

  // Adiciona o seletor de competição
  var filterContainer = document.querySelector(".filters-container");
  if (!filterContainer) {
    filterContainer = document.createElement("div");
    filterContainer.className = "filters-container";
    filterContainer.innerHTML = `
      <div class="filter-group">
        <label for="competition-filter">Filtrar por Competição:</label>
        <select id="competition-filter" class="filter-select">
          <option value="">Todas as Competições</option>
          ${competitions
            .map((comp) => `<option value="${comp}">${comp}</option>`)
            .join("")}
        </select>
      </div>
    `;
    document.querySelector(".espn-style-results")?.prepend(filterContainer);
  }

  document
    .getElementById("competition-filter")
    ?.addEventListener("change", function (e) {
      displayResults(allResults, e.target.value, competitions);
    });
}

function formatDate(dateStr) {
  return dateStr.split(" ").slice(0, 2).join(" ");
}

function getMatchResult(result) {
  if (!result.score || !result.score.includes("-")) return "";

  var [goals1, goals2] = result.score.split("-").map(Number);
  var isHome = isCruzeiro(result.team1);

  if (isHome) {
    return goals1 > goals2 ? "vitoria" : goals1 < goals2 ? "derrota" : "empate";
  } else {
    return goals2 > goals1 ? "vitoria" : goals2 < goals1 ? "derrota" : "empate";
  }
}

// Evento principal
document.addEventListener("DOMContentLoaded", function () {
  // Carrega os dados
  fetchAPIKey().then(loadData);

  // Configura o menu toggle (mantido igual)
  var menuToggle = document.querySelector(".menu-toggle");
  var navMenu = document.querySelector(".nav-menu");
  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", function () {
      menuToggle.classList.toggle("active");
      navMenu.classList.toggle("active");
      document.body.classList.toggle(
        "menu-open",
        navMenu.classList.contains("active")
      );
    });

    var navLinks = navMenu.querySelectorAll(".nav-link");
    for (var i = 0; i < navLinks.length; i++) {
      navLinks[i].addEventListener("click", function () {
        menuToggle.classList.remove("active");
        navMenu.classList.remove("active");
        document.body.classList.remove("menu-open");
      });
    }
  }

  // Configura o botão de atualizar
  var btnAtualizar = document.getElementById("btn-atualizar");
  if (btnAtualizar) {
    btnAtualizar.addEventListener("click", loadData);
  }
});
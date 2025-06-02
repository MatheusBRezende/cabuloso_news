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
  var resultadosDiv = document.getElementById("resultados");
  var btnAtualizar = document.getElementById("btn-atualizar");
  resultadosDiv.innerHTML =
    '<div class="loading"><div class="loading-spinner"></div><p>Carregando resultados...</p></div>';

  if (btnAtualizar) {
    btnAtualizar.classList.add("loading");
    btnAtualizar.disabled = true;
  }

  try {
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

    var dataAtualizacao = document.getElementById("data-atualizacao");
    if (dataAtualizacao) dataAtualizacao.textContent = getFormattedDate();

    resultadosDiv.classList.add("updated");
    setTimeout(function () {
      resultadosDiv.classList.remove("updated");
    }, 1000);
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    resultadosDiv.innerHTML =
      '<div class="error-message">' +
      "<h3>Erro ao carregar os resultados</h3>" +
      "<p>" +
      error.message +
      "</p>" +
      '<button id="btn-retry" class="btn-update">Tentar novamente</button>' +
      "</div>";
    var btnRetry = document.getElementById("btn-retry");
    if (btnRetry) btnRetry.addEventListener("click", loadData);
  } finally {
    if (btnAtualizar) {
      btnAtualizar.classList.remove("loading");
      btnAtualizar.disabled = false;
    }
  }
}

function isCruzeiro(teamName) {
  return teamName && teamName.toLowerCase().includes("cruzeiro");
}

function displayResults(results, selectedCompetition, competitions) {
  var resultadosDiv = document.getElementById("resultados");
  selectedCompetition = selectedCompetition || "";

  var filteredResults = selectedCompetition
    ? results.filter((r) => r.competition === selectedCompetition)
    : results.filter((r) => isCruzeiro(r.team1) || isCruzeiro(r.team2));

  var html = `
    <div class="results-content">
      <div class="filters-container">
        <div class="filter-group">
          <label for="competition-filter">Filtrar por Competição:</label>
          <select id="competition-filter" class="filter-select">
            <option value="">Todas as Competições</option>
            ${competitions
              .map(
                (comp) =>
                  `<option value="${comp}" ${
                    selectedCompetition === comp ? "selected" : ""
                  }>${comp}</option>`
              )
              .join("")}
          </select>
        </div>
      </div>
      <div class="results-table-container">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Jogo</th>
              <th>Resultado</th>
              <th>Competição</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredResults.length === 0
                ? `
              <tr>
                <td colspan="4" style="text-align: center; padding: 2rem;">
                  Nenhum resultado encontrado
                </td>
              </tr>
            `
                : filteredResults
                    .map((result) => {
                      var matchResult = getMatchResult(result);
                      var isHome = isCruzeiro(result.team1);
                      var resultIcon = "";

                      if (matchResult === "vitoria")
                        resultIcon =
                          '<i class="fas fa-check-circle" style="color:green"></i>';
                      else if (matchResult === "empate")
                        resultIcon =
                          '<i class="fas fa-equals" style="color:orange"></i>';
                      else if (matchResult === "derrota")
                        resultIcon =
                          '<i class="fas fa-times-circle" style="color:red"></i>';

                      return `
                <tr class="result-row">
                  <td class="data">${formatDate(result.date)}</td>
                  <td>
                    <div class="jogo">
                      <img src="${getEscudo(result.team1)}" alt="${
                        result.team1
                      }" class="escudo-time">
                      <span class="${isHome ? "time-casa" : ""}">${
                        result.team1
                      }</span>
                      x
                      <img src="${getEscudo(result.team2)}" alt="${
                        result.team2
                      }" class="escudo-time">
                      <span class="${!isHome ? "time-casa" : ""}">${
                        result.team2
                      }</span>
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
                </tr>
              `;
                    })
                    .join("")
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  resultadosDiv.innerHTML = html;

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
  fetchAPIKey().then(loadData);
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
  var btnAtualizar = document.getElementById("btn-atualizar");
  if (btnAtualizar) {
    btnAtualizar.addEventListener("click", loadData);
  }
});

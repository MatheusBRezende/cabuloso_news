/*====CONST UNIVERSAIS====*/
const CONFIG = {
  apiKey: null,
};

// Função para buscar a API key do Google Sheets
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

// Função para inicializar os widgets após carregar a API key
async function initWidgets() {
  const apiKeyLoaded = await fetchAPIKey();
  if (apiKeyLoaded) {
    loadMiniTable();
    loadMiniResults();
    loadNextMatches();
    // Atualiza a cada 30 segundos
    setInterval(() => {
      loadMiniTable();
      loadMiniResults();
      loadNextMatches();
    }, 30000);
  } else {
    console.error("Não foi possível carregar a API key");
    showWidgetError();
  }
}

// Função para mostrar erro nos widgets
function showWidgetError() {
  document.getElementById("mini-tabela").innerHTML = `
    <tr>
      <td colspan="3" style="text-align: center; padding: 20px 0; color: #666;">
        <i class="fas fa-exclamation-triangle"></i> Falha ao conectar com o servidor
      </td>
    </tr>
  `;
  document.getElementById("mini-resultados").innerHTML = `
    <div class="mini-result" style="color: #666; text-align: center;">
      <i class="fas fa-exclamation-triangle"></i> Falha ao conectar com o servidor
    </div>
  `;
  document.getElementById("proximos-jogos").innerHTML = `
    <div class="next-match" style="color: #666; text-align: center;">
      <i class="fas fa-exclamation-triangle"></i> Falha ao conectar com o servidor
    </div>
  `;
}

// =================== SCRAPING TERRA ===================
// Função para converter datas relativas e absolutas em minutos atrás
function parseRelativeDate(str) {
  if (!str) return Infinity;
  str = str.toLowerCase().trim();

  // UOL: "28/05/2025 05h30" ou "28/05/2025"
  const dataUOL = str.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2})h(\d{2}))?$/
  );
  if (dataUOL) {
    const dia = parseInt(dataUOL[1]);
    const mes = parseInt(dataUOL[2]) - 1;
    const ano = parseInt(dataUOL[3]);
    const hora = dataUOL[4] ? parseInt(dataUOL[4]) : 0;
    const min = dataUOL[5] ? parseInt(dataUOL[5]) : 0;
    const dataNoticia = new Date(ano, mes, dia, hora, min);
    const agora = new Date();
    const diffMs = agora - dataNoticia;
    return Math.floor(diffMs / 60000); // minutos atrás
  }

  // Zeiro: "28 de maio de 2025"
  const dataAbs = str.match(/^(\d{1,2}) de (\w+) de (\d{4})$/);
  if (dataAbs) {
    const meses = [
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro",
    ];
    const dia = parseInt(dataAbs[1]);
    const mes = meses.indexOf(dataAbs[2]);
    const ano = parseInt(dataAbs[3]);
    if (mes >= 0) {
      const dataNoticia = new Date(ano, mes, dia);
      const agora = new Date();
      const diffMs = agora - dataNoticia;
      return Math.floor(diffMs / 60000); // minutos atrás
    }
  }

  // Relativo: "há X minutos/horas/dias"
  if (str.includes("minuto")) {
    const n = parseInt(str);
    return isNaN(n) ? Infinity : n;
  }
  if (str.includes("hora")) {
    const n = parseInt(str);
    return isNaN(n) ? Infinity : n * 60;
  }
  if (str.includes("dia")) {
    const n = parseInt(str);
    return isNaN(n) ? Infinity : n * 24 * 60;
  }
  return Infinity;
}

// Função para buscar notícias do Cruzeiro usando o scraper do backend
async function fetchTerraNews() {
  // mensagem de carregamento
  document.querySelector(".featured-article").innerHTML = `
    <div style="width:100%;text-align:center;padding:40px 0;color:#0033a0;font-size:1.2rem;">
      <i class="fas fa-spinner fa-spin"></i> Aguarde, estamos pegando as melhores notícias para você...
    </div>
  `;
  document.querySelector(".news-grid").innerHTML = `
    <div style="width:100%;text-align:center;padding:30px 0;color:#0033a0;">
      <i class="fas fa-spinner fa-spin"></i> Carregando notícias...
    </div>
  `;
  try {
    const response = await fetch("api/noticias-espn");
    let noticias = await response.json();
    console.log("Resposta do backend:", noticias);

    if (!Array.isArray(noticias)) {
      console.error("A resposta não é um array!", noticias);
      throw new Error("Resposta inesperada do backend");
    }
    if (noticias.length === 0) throw new Error("Nenhuma notícia encontrada");

    noticias = noticias.filter((n) => !/gol/i.test(n.title));

    // Ordena as notícias da mais recente para a mais antiga
    noticias.sort(
      (a, b) =>
        parseRelativeDate(a.description) - parseRelativeDate(b.description)
    );

    // Mostra a mais recente como destaque
    renderFeaturedNews(noticias[0]);

    // O restante em ordem crescente (mais antiga para mais recente)
    const restantes = noticias
      .slice(1)
      .sort(
        (a, b) =>
          parseRelativeDate(a.description) - parseRelativeDate(b.description)
      );
    renderNews(restantes.slice(0, 6));

    // Mostra botão se houver mais de 7 notícias
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    if (noticias.length > 7 && loadMoreBtn) {
      loadMoreBtn.style.display = "block";
      loadMoreBtn.onclick = () => renderNews(restantes);
    } else if (loadMoreBtn) {
      loadMoreBtn.style.display = "none";
    }
    window._todasNoticias = noticias;
  } catch (error) {
    console.error("Erro ao buscar notícias:", error);
    document.querySelector(".news-grid").innerHTML = `
      <div style="text-align:center; color:#666; padding:20px;">
        <i class="fas fa-exclamation-triangle"></i> Não foi possível carregar as notícias.
      </div>
    `;
    document.querySelector(".featured-article").innerHTML = `
      <div style="text-align:center; color:#666; padding:20px;">
        <i class="fas fa-exclamation-triangle"></i> Não foi possível carregar a notícia em destaque.
      </div>
    `;
  }
}

// Função para renderizar a notícia em destaque
function renderFeaturedNews(article) {
  const featured = document.querySelector(".featured-article");
  if (!article) {
    featured.innerHTML = `<div style="text-align:center; color:#666; padding:20px;">
      <i class="fas fa-exclamation-triangle"></i> Nenhuma notícia em destaque encontrada.
    </div>`;
    return;
  }
  featured.innerHTML = `
    <div class="featured-image">
      <img src="${
        article.image
          ? article.image
          : "https://via.placeholder.com/600x350/003399/ffffff?text=Noticia+Cruzeiro"
      }" alt="Notícia em destaque do Cruzeiro">
    </div>
    <div class="featured-content">
      <span class="category">Noticia retirada de: ${
        article.fonte || ""
      }.com.br</span>
      <h3>${article.title}</h3>
      <p>${article.description || "Sem descrição disponível."}</p>
      <a href="${
        article.url
      }" class="read-more" target="_blank" rel="noopener"><i class="bi bi-arrow-right-circle"></i> Ler mais</a>
    </div>
  `;
}

// Função para renderizar as notícias na grid
function renderNews(articles) {
  const newsGrid = document.querySelector(".news-grid");
  newsGrid.innerHTML = "";
  if (!articles || articles.length === 0) {
    newsGrid.innerHTML = `<div style="text-align:center; color:#666; padding:20px;">
      <i class="fas fa-exclamation-triangle"></i> Nenhuma notícia encontrada.
    </div>`;
    return;
  }
  articles.forEach((article) => {
    const newsCard = document.createElement("article");
    newsCard.className = "news-card";
    newsCard.innerHTML = `
      <div class="news-image">
        <img src="${
          article.image
            ? article.image
            : "https://via.placeholder.com/400x250/003399/ffffff?text=Noticia"
        }" alt="Notícia do Cruzeiro">
      </div>
      <div class="news-content">
        <span class="category">Noticia retirada de: ${
          article.fonte || ""
        }.com.br</span>
        <h3>${article.title}</h3>
        <p>${article.description || "Sem descrição disponível."}</p>
        <a href="${
          article.url
        }" class="read-more" target="_blank" rel="noopener">Ler mais</a>
      </div>
    `;
    newsGrid.appendChild(newsCard);
  });
}

// Função para carregar mais notícias (opcional, pode buscar mais do scraper)
function loadMoreNews() {
  if (window._todasNoticias) {
    // Remove a featured e mostra o restante em ordem crescente
    const restantes = window._todasNoticias
      .slice(1)
      .sort(
        (a, b) =>
          parseRelativeDate(b.description) - parseRelativeDate(a.description)
      );
    renderNews(restantes);
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    if (loadMoreBtn) {
      loadMoreBtn.textContent = "Todas as notícias carregadas";
      loadMoreBtn.disabled = true;
      loadMoreBtn.style.opacity = "0.5";
    }
  }
}

// =================== WIDGETS GOOGLE SHEETS ===================

// Função auxiliar para obter logos
function getTeamLogo(teamName) {
  const logos = {
    Flamengo:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Flamengo-RJ_%28BRA%29.png/500px-Flamengo-RJ_%28BRA%29.png",
    Palmeiras:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Palmeiras_logo.svg/1280px-Palmeiras_logo.svg.png",
    "Red Bull Bragantino":
      "https://upload.wikimedia.org/wikipedia/pt/9/9e/RedBullBragantino.png",
    Cruzeiro:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/1280px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png",
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
    Vasco: "https://upload.wikimedia.org/wikipedia/pt/a/ac/CRVascodaGama.png",
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
    Santos:
      "https://upload.wikimedia.org/wikipedia/commons/1/15/Santos_Logo.png",
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
  for (const [key, value] of Object.entries(logos)) {
    if (teamName.includes(key)) return value;
  }
  return "https://via.placeholder.com/40/0033a0/ffffff?text=CRU";
}

// Função para carregar a mini tabela
async function loadMiniTable() {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/1ubZ_5cXZYLLcFQnHGAqsWMDn59arVI8JynTpf4-kOa0/values/A1:M6?key=${CONFIG.apiKey}`
    );
    const data = await response.json();
    let html = "";
    data.values.slice(1, 6).forEach((row, index) => {
      const isCruzeiro = row[1].includes("Cruzeiro");
      html += `
        <tr class="${isCruzeiro ? "cruzeiro-row" : ""}">
          <td>${index + 1}º</td>
          <td class="team-cell">
            <img src="${getTeamLogo(row[1])}" class="team-logo" alt="${row[1]}">
            ${row[1].replace(/^\d+°\s*/, "").replace(/\s[A-Z]{2,4}$/, "")}
          </td>
          <td>${row[2] || 0}</td>
        </tr>
      `;
    });
    // Adiciona link para o Cruzeiro se não estiver no top 5
    if (!html.includes("cruzeiro-row")) {
      const cruzeiroRow = data.values.find((row) =>
        row[1].includes("Cruzeiro")
      );
      if (cruzeiroRow) {
        const pos = parseInt(cruzeiroRow[0]);
        html += `
          <tr class="cruzeiro-row">
            <td>${pos}º</td>
            <td class="team-cell">
              <img src="${getTeamLogo(
                cruzeiroRow[1]
              )}" class="team-logo" alt="${cruzeiroRow[1]}">
              ${cruzeiroRow[1]
                .replace(/^\d+°\s*/, "")
                .replace(/\s[A-Z]{2,4}$/, "")}
            </td>
            <td>${cruzeiroRow[2] || 0}</td>
          </tr>
        `;
      }
    }
    document.getElementById("mini-tabela").innerHTML = html;
  } catch (error) {
    document.getElementById("mini-tabela").innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; padding: 20px 0; color: #666;">
          <i class="fas fa-exclamation-triangle"></i> Dados não disponíveis
        </td>
      </tr>
    `;
  }
}

// Função para carregar mini resultados
async function loadMiniResults() {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/12LrzrOnzSwScp-9PzKrtq13ElgTUpWxo3BDp4Y82Dm0/values/A1:F6?key=${CONFIG.apiKey}`
    );
    const data = await response.json();
    let html = "";
    data.values.slice(1, 4).forEach((row) => {
      const isCruzeiro =
        row[1].includes("Cruzeiro") || row[3].includes("Cruzeiro");
      const scoreParts = row[2]?.split(/(?=[A-Za-z])/) || ["-"];
      html += `
        <div class="mini-result">
          <div class="mini-teams">
            <div class="mini-team ${
              row[1].includes("Cruzeiro") ? "cruzeiro" : ""
            }">
              <img src="${getTeamLogo(row[1])}" class="mini-team-logo">
              <span>${cleanTeamName(row[1])}</span>
            </div>
            <div class="mini-score">${scoreParts[0].trim()}</div>
            <div class="mini-team ${
              row[3].includes("Cruzeiro") ? "cruzeiro" : ""
            }">
              <span>${cleanTeamName(row[3])}</span>
              <img src="${getTeamLogo(row[3])}" class="mini-team-logo">
            </div>
          </div>
          <div class="mini-competition">
            ${row[0]} • ${row[5] || "Amistoso"}
          </div>
        </div>
      `;
    });
    document.getElementById("mini-resultados").innerHTML = html;
  } catch (error) {
    document.getElementById("mini-resultados").innerHTML = `
      <div class="mini-result" style="color: #666; text-align: center;">
        <i class="fas fa-exclamation-triangle"></i> Dados não disponíveis
      </div>
    `;
  }
}

// Função para carregar próximos jogos
async function loadNextMatches() {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/1i3KjyXbLnyC-zt6ByPuuZFRe96PfhiXJRFGCPYG7l1c/values/PARTIDAS?key=${CONFIG.apiKey}`
    );
    const data = await response.json();
    let html = "";
    let count = 0;
    for (let i = 1; i < data.values.length && count < 3; i++) {
      const row = data.values[i];
      if (!row[0] || !row[1] || !row[3]) continue;
      const isCruzeiro =
        row[1].includes("Cruzeiro") || row[3].includes("Cruzeiro");
      if (!isCruzeiro && count > 0) continue;
      const hoje = new Date();
      const [dia, mes] = row[0].split("/");
      const dataJogo = new Date(
        hoje.getFullYear(),
        parseInt(mes) - 1,
        parseInt(dia)
      );
      if (dataJogo < hoje) continue;
      const isLive = row[7] === "LIVE" || row[7] === "AO VIVO";
      html += `
        <div class="next-match">
          <div class="match-date">
            ${row[0]} • ${
        row[7] === "LIVE" ? '<span class="live-badge">AO VIVO</span>' : row[7]
      }
          </div>
          <div class="match-teams">
            <div class="match-team ${
              row[1].includes("Cruzeiro") ? "cruzeiro" : ""
            }">
              <img src="${getTeamLogo(row[1])}" class="match-team-logo">
              <span>${cleanTeamName(row[1])}</span>
            </div>
            <span class="match-vs">vs</span>
            <div class="match-team ${
              row[3].includes("Cruzeiro") ? "cruzeiro" : ""
            }">
              <span>${cleanTeamName(row[3])}</span>
              <img src="${getTeamLogo(row[3])}" class="match-team-logo">
            </div>
          </div>
          <div class="match-info">
            <span>${row[5] || "Amistoso"}</span>
            <span>${row[6] || "Local a definir"}</span>
          </div>
        </div>
      `;
      count++;
    }
    document.getElementById("proximos-jogos").innerHTML =
      html ||
      `
      <div class="next-match" style="color: #666; text-align: center;">
        <i class="fas fa-calendar-times"></i> Nenhum jogo agendado
      </div>
    `;
  } catch (error) {
    document.getElementById("proximos-jogos").innerHTML = `
      <div class="next-match" style="color: #666; text-align: center;">
        <i class="fas fa-exclamation-triangle"></i> Dados não disponíveis
      </div>
    `;
  }
}

function cleanTeamName(teamName) {
  if (!teamName) return '';
  // Remove números no início (como "1° ") e siglas de estado no final (como " MG")
  return teamName
    .replace(/^\d+°\s*/, '')
    .replace(/\s[A-Z]{2,4}$/, '');
}

// ========== INICIALIZAÇÃO ÚNICA ==========
document.addEventListener("DOMContentLoaded", function () {


  // Formulário de Newsletter
  const newsletterForm = document.getElementById("newsletterForm");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const email = this.querySelector('input[type="email"]').value;
      alert(
        `Obrigado por se inscrever! Você receberá as notícias no email: ${email}`
      );
      this.reset();
    });
  }

  // Botão "Carregar mais notícias"
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", function () {
      loadMoreNews();
    });
  }

  // Efeito de scroll suave para links internos
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href");
      if (targetId === "#") return;
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 80,
          behavior: "smooth",
        });
      }
    });
  });

  // Inicializa widgets Google Sheets
  initWidgets();

  // Script para menu hambúrguer (caso use nav diferente)
  const menuToggle2 = document.querySelector(".menu-toggle");
  const navMenu = document.querySelector(".nav-menu");
  if (menuToggle2 && navMenu) {
    menuToggle2.addEventListener("click", () => {
      menuToggle2.classList.toggle("active");
      navMenu.classList.toggle("active");
      document.body.classList.toggle("menu-open");
    });
    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        menuToggle2.classList.remove("active");
        navMenu.classList.remove("active");
        document.body.classList.remove("menu-open");
      });
    });
  }

  // Carrega notícias do Terra automaticamente (scraping)
  fetchTerraNews();
});


/*====CONFIGURAÇÕES GLOBAIS====*/
const CONFIG = {
  apiKey: null,
  updateInterval: 30000, // 30 segundos
  retryAttempts: 3,
  retryDelay: 2000
};

// Estado global da aplicação
const AppState = {
  isLoading: true,
  lastUpdate: null,
  newsData: [],
  widgetsLoaded: false
};

/*====UTILITÁRIOS====*/
// Função para mostrar toast notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const iconMap = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  };
  
  toast.innerHTML = `
    <i class="toast-icon ${iconMap[type]}"></i>
    <span class="toast-message">${message}</span>
    <i class="toast-close fas fa-times"></i>
  `;
  
  container.appendChild(toast);
  
  // Auto remove após 5 segundos
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 5000);
  
  // Remove ao clicar no X
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  });
}

// Função para scroll suave
function scrollToSection(sectionId) {
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}

// Função para atualizar indicadores de status
function updateStatusIndicator(elementId, status = 'online') {
  const indicator = document.getElementById(elementId);
  if (indicator) {
    const icon = indicator.querySelector('i');
    if (status === 'online') {
      icon.style.color = 'var(--success)';
    } else if (status === 'loading') {
      icon.style.color = 'var(--warning)';
      icon.classList.add('fa-spin');
    } else {
      icon.style.color = 'var(--error)';
      icon.classList.remove('fa-spin');
    }
  }
}

/*====GERENCIAMENTO DE API====*/
// Função para buscar a API key do Google Sheets
async function fetchAPIKey() {
  try {
    const response = await fetch("/api/chave-google");
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const data = await response.json();
    if (!data.apiKey) throw new Error("Chave da API não encontrada na resposta");
    CONFIG.apiKey = data.apiKey;
    return true;
  } catch (error) {
    console.error("Falha ao carregar chave:", error);
    showToast("Erro ao conectar com o servidor", "error");
    return false;
  }
}

// Função para retry com backoff exponencial
async function retryWithBackoff(fn, attempts = CONFIG.retryAttempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay * Math.pow(2, i)));
    }
  }
}

/*====GERENCIAMENTO DE NOTÍCIAS====*/
// Função para converter datas relativas e absolutas em minutos atrás
function parseRelativeDate(str) {
  if (!str) return Infinity;
  str = str.toLowerCase().trim();

  // UOL: "28/05/2025 05h30" ou "28/05/2025"
  const dataUOL = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2})h(\d{2}))?$/);
  if (dataUOL) {
    const dia = parseInt(dataUOL[1]);
    const mes = parseInt(dataUOL[2]) - 1;
    const ano = parseInt(dataUOL[3]);
    const hora = dataUOL[4] ? parseInt(dataUOL[4]) : 0;
    const min = dataUOL[5] ? parseInt(dataUOL[5]) : 0;
    const dataNoticia = new Date(ano, mes, dia, hora, min);
    const agora = new Date();
    const diffMs = agora - dataNoticia;
    return Math.floor(diffMs / 60000);
  }

  // Zeiro: "28 de maio de 2025"
  const dataAbs = str.match(/^(\d{1,2}) de (\w+) de (\d{4})$/);
  if (dataAbs) {
    const meses = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];
    const dia = parseInt(dataAbs[1]);
    const mes = meses.indexOf(dataAbs[2]);
    const ano = parseInt(dataAbs[3]);
    if (mes >= 0) {
      const dataNoticia = new Date(ano, mes, dia);
      const agora = new Date();
      const diffMs = agora - dataNoticia;
      return Math.floor(diffMs / 60000);
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

// Função para buscar notícias
async function fetchNews() {
  const featuredElement = document.getElementById("featured-article");
  const newsGridElement = document.getElementById("news-grid");
  
  // Mostra loading
  featuredElement.innerHTML = `
    <div class="featured-loading">
      <div class="loading-spinner"></div>
      <p>Carregando notícia em destaque...</p>
    </div>
  `;
  
  newsGridElement.innerHTML = `
    <div class="news-loading">
      <div class="loading-spinner"></div>
      <p>Carregando notícias...</p>
    </div>
  `;

  try {
    const response = await retryWithBackoff(async () => {
      const res = await fetch("/api/noticias-espn");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    });
    
    let noticias = await response.json();

    if (!Array.isArray(noticias)) {
      console.error("A resposta não é um array!", noticias);
      throw new Error("Resposta inesperada do backend");
    }
    
    if (noticias.length === 0) throw new Error("Nenhuma notícia encontrada");

    // Filtra notícias irrelevantes
    noticias = noticias.filter((n) => !/gol/i.test(n.title));

    // Ordena as notícias da mais recente para a mais antiga
    noticias.sort((a, b) => parseRelativeDate(a.description) - parseRelativeDate(b.description));

    // Armazena no estado global
    AppState.newsData = noticias;
    AppState.lastUpdate = new Date();

    // Renderiza notícia em destaque
    renderFeaturedNews(noticias[0]);

    // Renderiza grid de notícias
    const restantes = noticias.slice(1).sort((a, b) => 
      parseRelativeDate(a.description) - parseRelativeDate(b.description)
    );
    renderNewsGrid(restantes.slice(0, 6));

    // Gerencia botão "Carregar mais"
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    if (noticias.length > 7 && loadMoreBtn) {
      loadMoreBtn.style.display = "block";
      loadMoreBtn.onclick = () => renderNewsGrid(restantes);
    } else if (loadMoreBtn) {
      loadMoreBtn.style.display = "none";
    }

    showToast("Notícias atualizadas com sucesso!", "success");

  } catch (error) {
    console.error("Erro ao buscar notícias:", error);
    showToast("Erro ao carregar notícias", "error");
    
    featuredElement.innerHTML = `
      <div class="featured-loading">
        <i class="fas fa-exclamation-triangle" style="color: var(--error); font-size: 2rem; margin-bottom: 1rem;"></i>
        <p>Não foi possível carregar a notícia em destaque.</p>
        <button class="btn btn-outline" onclick="fetchNews()" style="margin-top: 1rem;">
          <i class="fas fa-sync-alt"></i>
          Tentar novamente
        </button>
      </div>
    `;
    
    newsGridElement.innerHTML = `
      <div class="news-loading">
        <i class="fas fa-exclamation-triangle" style="color: var(--error); font-size: 2rem; margin-bottom: 1rem;"></i>
        <p>Não foi possível carregar as notícias.</p>
        <button class="btn btn-outline" onclick="fetchNews()" style="margin-top: 1rem;">
          <i class="fas fa-sync-alt"></i>
          Tentar novamente
        </button>
      </div>
    `;
  }
}

// Função para renderizar notícia em destaque
function renderFeaturedNews(article) {
  const featured = document.getElementById("featured-article");
  if (!article) {
    featured.innerHTML = `
      <div class="featured-loading">
        <i class="fas fa-exclamation-triangle" style="color: var(--warning);"></i>
        <p>Nenhuma notícia em destaque encontrada.</p>
      </div>
    `;
    return;
  }

  const imageUrl = article.image || "https://via.placeholder.com/600x350/0033a0/ffffff?text=Noticia+Cruzeiro";
  
  featured.innerHTML = `
    <div class="featured-image">
      <img src="${imageUrl}" alt="Notícia em destaque do Cruzeiro" loading="lazy">
    </div>
    <div class="featured-content">
      <h3>${article.title}</h3>
      <p>${article.description || "Sem descrição disponível."}</p>
      <a href="${article.url}" class="read-more" target="_blank" rel="noopener">
        <i class="fas fa-external-link-alt"></i>
        Ler mais
      </a>
      <span class="category">Fonte: ${article.fonte || "Desconhecida"}</span>
    </div>
  `;
}

// Função para renderizar grid de notícias
function renderNewsGrid(articles) {
  const newsGrid = document.getElementById("news-grid");
  newsGrid.innerHTML = "";
  
  if (!articles || articles.length === 0) {
    newsGrid.innerHTML = `
      <div class="news-loading">
        <i class="fas fa-exclamation-triangle" style="color: var(--warning);"></i>
        <p>Nenhuma notícia encontrada.</p>
      </div>
    `;
    return;
  }

  articles.forEach((article) => {
    const newsCard = document.createElement("article");
    newsCard.className = "news-card";
    
    const imageUrl = article.image || "https://via.placeholder.com/400x250/0033a0/ffffff?text=Noticia";
    
    newsCard.innerHTML = `
      <div class="news-image">
        <img src="${imageUrl}" alt="Notícia do Cruzeiro" loading="lazy">
      </div>
      <div class="news-content">
        <span class="category">Fonte: ${article.fonte || "Desconhecida"}</span>
        <h3>${article.title}</h3>
        <p>${article.description || "Sem descrição disponível."}</p>
        <a href="${article.url}" class="read-more" target="_blank" rel="noopener">
          <i class="fas fa-external-link-alt"></i>
          Ler mais
        </a>
      </div>
    `;
    
    newsGrid.appendChild(newsCard);
  });

  // Atualiza botão "Carregar mais"
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  if (loadMoreBtn && articles.length === AppState.newsData.length - 1) {
    loadMoreBtn.textContent = "Todas as notícias carregadas";
    loadMoreBtn.disabled = true;
    loadMoreBtn.style.opacity = "0.5";
  }
}

/*====WIDGETS DO GOOGLE SHEETS====*/
// Função auxiliar para obter logos dos times
function getTeamLogo(teamName) {
  const logos = {
    Flamengo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Flamengo-RJ_%28BRA%29.png/500px-Flamengo-RJ_%28BRA%29.png",
    Palmeiras: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Palmeiras_logo.svg/1280px-Palmeiras_logo.svg.png",
    "Red Bull Bragantino": "https://upload.wikimedia.org/wikipedia/pt/9/9e/RedBullBragantino.png",
    Cruzeiro: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/1280px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png",
    Fluminense: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/FFC_crest.svg/1106px-FFC_crest.svg.png",
    Internacional: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/SC_Internacional_Brazil_Logo.svg/1280px-SC_Internacional_Brazil_Logo.svg.png",
    Bahia: "https://upload.wikimedia.org/wikipedia/pt/9/90/ECBahia.png",
    "São Paulo": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Brasao_do_Sao_Paulo_Futebol_Clube.svg/1284px-Brasao_do_Sao_Paulo_Futebol_Clube.svg.png",
    Botafogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Botafogo_de_Futebol_e_Regatas_logo.svg/1135px-Botafogo_de_Futebol_e_Regatas_logo.svg.png",
    Ceará: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Cear%C3%A1_Sporting_Club_logo.svg/1153px-Cear%C3%A1_Sporting_Club_logo.svg.png",
    Vasco: "https://upload.wikimedia.org/wikipedia/pt/a/ac/CRVascodaGama.png",
    Corinthians: "https://upload.wikimedia.org/wikipedia/commons/c/c9/Escudo_sc_corinthians.png",
    Juventude: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/EC_Juventude.svg/1280px-EC_Juventude.svg.png",
    Mirassol: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Mirassol_FC_logo.png",
    Fortaleza: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Fortaleza_EC_2018.png/978px-Fortaleza_EC_2018.png",
    Vitória: "https://upload.wikimedia.org/wikipedia/pt/3/34/Esporte_Clube_Vit%C3%B3ria_logo.png",
    "Atlético-MG": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Atletico_mineiro_galo.png/960px-Atletico_mineiro_galo.png",
    Grêmio: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Gremio_logo.svg/1074px-Gremio_logo.svg.png",
    Santos: "https://upload.wikimedia.org/wikipedia/commons/1/15/Santos_Logo.png",
    Sport: "https://upload.wikimedia.org/wikipedia/pt/1/17/Sport_Club_do_Recife.png",
    "Vila Nova": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Vila_Nova_Logo_Oficial.svg/1024px-Vila_Nova_Logo_Oficial.svg.png",
    "Mushuc Runa": "https://upload.wikimedia.org/wikipedia/pt/3/39/Mushuc_Runa_SC.png",
    Palestino: "https://upload.wikimedia.org/wikipedia/pt/7/72/CDPalestino.png",
    "Unión (Santa Fe)": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg/1024px-Escudo_club_Atl%C3%A9tico_Uni%C3%B3n_de_santa_fe.svg.png"
  };
  
  for (const [key, value] of Object.entries(logos)) {
    if (teamName.includes(key)) return value;
  }
  return "https://via.placeholder.com/40/0033a0/ffffff?text=TIME";
}

// Função para limpar nome do time
function cleanTeamName(teamName) {
  if (!teamName) return '';
  return teamName
    .replace(/^\d+°\s*/, '')
    .replace(/\s[A-Z]{2,4}$/, '');
}

// Função para carregar mini tabela
async function loadMiniTable() {
  updateStatusIndicator('table-update', 'loading');
  
  try {
    const response = await retryWithBackoff(async () => {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/1ubZ_5cXZYLLcFQnHGAqsWMDn59arVI8JynTpf4-kOa0/values/A1:M6?key=${CONFIG.apiKey}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    });
    
    const data = await response.json();
    let html = "";
    
    data.values.slice(1, 6).forEach((row, index) => {
      const isCruzeiro = row[1].includes("Cruzeiro");
      html += `
        <tr class="${isCruzeiro ? "cruzeiro-row" : ""}">
          <td>${index + 1}º</td>
          <td class="team-cell">
            <img src="${getTeamLogo(row[1])}" class="team-logo" alt="${row[1]}" loading="lazy">
            ${cleanTeamName(row[1])}
          </td>
          <td>${row[2] || 0}</td>
        </tr>
      `;
    });
    
    // Adiciona Cruzeiro se não estiver no top 5
    if (!html.includes("cruzeiro-row")) {
      const cruzeiroRow = data.values.find((row) => row[1].includes("Cruzeiro"));
      if (cruzeiroRow) {
        const pos = parseInt(cruzeiroRow[0].replace('º', '')); // Extrai o número da posição
        html += `
          <tr class="cruzeiro-row">
            <td>${pos}º</td>
            <td class="team-cell">
              <img src="${getTeamLogo(cruzeiroRow[1])}" class="team-logo" alt="${cruzeiroRow[1]}" loading="lazy">
              ${cleanTeamName(cruzeiroRow[1])}
            </td>
            <td>${cruzeiroRow[2] || 0}</td>
          </tr>
        `;
        
        // Atualiza stat card com a posição correta
        const positionStat = document.getElementById('position-stat');
        if (positionStat) {
          positionStat.textContent = `${pos}º lugar`;
        }
      }
    }
    
    document.getElementById("mini-tabela").innerHTML = html;
    updateStatusIndicator('table-update', 'online');
    
  } catch (error) {
    console.error("Erro ao carregar tabela:", error);
    updateStatusIndicator('table-update', 'error');
    document.getElementById("mini-tabela").innerHTML = `
      <tr>
        <td colspan="3" class="loading-cell">
          <i class="fas fa-exclamation-triangle" style="color: var(--error);"></i>
          <span>Dados não disponíveis</span>
        </td>
      </tr>
    `;
  }
}

// Função para carregar mini resultados
async function loadMiniResults() {
  updateStatusIndicator('results-update', 'loading');
  
  try {
    const response = await retryWithBackoff(async () => {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/14r46LGxmQVUilSvimrcbBcUvUmIPaEtp89wblh_8ZU0/values/A1:F6?key=${CONFIG.apiKey}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    });
    
    const data = await response.json();
    let html = "";
    
    data.values.slice(1, 4).forEach((row) => {
      const isCruzeiro = row[1].includes("Cruzeiro") || row[3].includes("Cruzeiro");
      const scoreParts = row[2]?.split(/(?=[A-Za-z])/) || ["-"];
      
      html += `
        <div class="mini-result">
          <div class="mini-teams">
            <div class="mini-team ${row[1].includes("Cruzeiro") ? "cruzeiro" : ""}">
              <img src="${getTeamLogo(row[1])}" class="mini-team-logo" loading="lazy">
              <span>${cleanTeamName(row[1])}</span>
            </div>
            <div class="mini-score">${scoreParts[0].trim()}</div>
            <div class="mini-team ${row[3].includes("Cruzeiro") ? "cruzeiro" : ""}">
              <span>${cleanTeamName(row[3])}</span>
              <img src="${getTeamLogo(row[3])}" class="mini-team-logo" loading="lazy">
            </div>
          </div>
          <div class="mini-competition">
            ${row[0]} • ${row[5] || "Amistoso"}
          </div>
        </div>
      `;
    });
    
    document.getElementById("mini-resultados").innerHTML = html;
    updateStatusIndicator('results-update', 'online');
    
    // Atualiza stat card com último resultado
    const lastResult = data.values[1];
    if (lastResult) {
      const lastResultStat = document.getElementById('last-result-stat');
      if (lastResultStat) {
        const scoreParts = lastResult[2]?.split(/(?=[A-Za-z])/) || ["-"];
        lastResultStat.textContent = `${cleanTeamName(lastResult[1])} ${scoreParts[0].trim()} ${cleanTeamName(lastResult[3])}`;
      }
    }
    
  } catch (error) {
    console.error("Erro ao carregar resultados:", error);
    updateStatusIndicator('results-update', 'error');
    document.getElementById("mini-resultados").innerHTML = `
      <div class="mini-result loading">
        <i class="fas fa-exclamation-triangle" style="color: var(--error);"></i>
        <span>Dados não disponíveis</span>
      </div>
    `;
  }
}

// Função para carregar próximos jogos
async function loadNextMatches() {
  updateStatusIndicator('matches-update', 'loading');
  
  try {
    const response = await retryWithBackoff(async () => {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/1i3KjyXbLnyC-zt6ByPuuZFRe96PfhiXJRFGCPYG7l1c/values/PARTIDAS?key=${CONFIG.apiKey}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    });
    
    const data = await response.json();
    let html = "";
    let count = 0;
    
    for (let i = 1; i < data.values.length && count < 3; i++) {
      const row = data.values[i];
      if (!row[0] || !row[1] || !row[3]) continue;
      
      const isCruzeiro = row[1].includes("Cruzeiro") || row[3].includes("Cruzeiro");
      if (!isCruzeiro && count > 0) continue;
      
      const hoje = new Date();
      const [dia, mes] = row[0].split("/");
      const dataJogo = new Date(hoje.getFullYear(), parseInt(mes) - 1, parseInt(dia));
      if (dataJogo < hoje) continue;
      
      const isLive = row[7] === "LIVE" || row[7] === "AO VIVO";
      
      html += `
        <div class="next-match">
          <div class="match-date">
            ${row[0]} • ${isLive ? '<span class="live-badge">AO VIVO</span>' : row[7]}
          </div>
          <div class="match-teams">
            <div class="match-team ${row[1].includes("Cruzeiro") ? "cruzeiro" : ""}">
              <img src="${getTeamLogo(row[1])}" class="match-team-logo" loading="lazy">
              <span>${cleanTeamName(row[1])}</span>
            </div>
            <span class="match-vs">vs</span>
            <div class="match-team ${row[3].includes("Cruzeiro") ? "cruzeiro" : ""}">
              <span>${cleanTeamName(row[3])}</span>
              <img src="${getTeamLogo(row[3])}" class="match-team-logo" loading="lazy">
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
    
    document.getElementById("proximos-jogos").innerHTML = html || `
      <div class="next-match loading">
        <i class="fas fa-calendar-times" style="color: var(--warning);"></i>
        <span>Nenhum jogo agendado</span>
      </div>
    `;
    
    updateStatusIndicator('matches-update', 'online');
    
    // Atualiza stat card com próximo jogo
    if (html) {
      const nextGameStat = document.getElementById('next-game-stat');
      if (nextGameStat && data.values[1]) {
        const nextGame = data.values[1];
        const opponent = nextGame[1].includes("Cruzeiro") ? cleanTeamName(nextGame[3]) : cleanTeamName(nextGame[1]);
        nextGameStat.textContent = `${nextGame[0]} vs ${opponent}`;
      }
    }
    
  } catch (error) {
    console.error("Erro ao carregar próximos jogos:", error);
    updateStatusIndicator('matches-update', 'error');
    document.getElementById("proximos-jogos").innerHTML = `
      <div class="next-match loading">
        <i class="fas fa-exclamation-triangle" style="color: var(--error);"></i>
        <span>Dados não disponíveis</span>
      </div>
    `;
  }
}

// Função para mostrar erro nos widgets
function showWidgetError() {
  document.getElementById("mini-tabela").innerHTML = `
    <tr>
      <td colspan="3" class="loading-cell">
        <i class="fas fa-exclamation-triangle" style="color: var(--error);"></i>
        <span>Falha ao conectar com o servidor</span>
      </td>
    </tr>
  `;
  
  document.getElementById("mini-resultados").innerHTML = `
    <div class="mini-result loading">
      <i class="fas fa-exclamation-triangle" style="color: var(--error);"></i>
      <span>Falha ao conectar com o servidor</span>
    </div>
  `;
  
  document.getElementById("proximos-jogos").innerHTML = `
    <div class="next-match loading">
      <i class="fas fa-exclamation-triangle" style="color: var(--error);"></i>
      <span>Falha ao conectar com o servidor</span>
    </div>
  `;
}

// Função para inicializar widgets
async function initWidgets() {
  const apiKeyLoaded = await fetchAPIKey();
  if (apiKeyLoaded) {
    try {
      await Promise.all([
        loadMiniTable(),
        loadMiniResults(),
        loadNextMatches()
      ]);
      
      AppState.widgetsLoaded = true;
      
      // Configura atualização automática
      setInterval(async () => {
        if (document.visibilityState === 'visible') {
          await Promise.all([
            loadMiniTable(),
            loadMiniResults(),
            loadNextMatches()
          ]);
        }
      }, CONFIG.updateInterval);
      
    } catch (error) {
      console.error("Erro ao inicializar widgets:", error);
      showWidgetError();
    }
  } else {
    console.error("Não foi possível carregar a API key");
    showWidgetError();
  }
}

/*====INICIALIZAÇÃO DA APLICAÇÃO====*/
document.addEventListener("DOMContentLoaded", function () {
  // Remove loading overlay após um delay
  setTimeout(() => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      AppState.isLoading = false;
    }
  }, 1500);

  // Configuração do menu mobile
  const menuToggle = document.getElementById("menuToggle");
  const navMenu = document.getElementById("nav-menu");

  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      menuToggle.classList.toggle("active");
      navMenu.classList.toggle("active");
      
      // Previne scroll quando menu está aberto
      document.body.style.overflow = navMenu.classList.contains("active") ? "hidden" : "";
    });

    // Fecha menu ao clicar em links
    document.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", () => {
        if (navMenu.classList.contains("active")) {
          navMenu.classList.remove("active");
          menuToggle.classList.remove("active");
          document.body.style.overflow = "";
        }
      });
    });

    // Fecha menu ao clicar fora
    document.addEventListener("click", (e) => {
      if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
        navMenu.classList.remove("active");
        menuToggle.classList.remove("active");
        document.body.style.overflow = "";
      }
    });
  }

  // Configuração do formulário de newsletter
  const newsletterForm = document.getElementById("newsletterForm");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const email = this.querySelector('input[type="email"]').value;
      
      // Simula envio
      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
      submitBtn.disabled = true;
      
      setTimeout(() => {
        showToast(`Obrigado por se inscrever! Você receberá as notícias no email: ${email}`, "success");
        this.reset();
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }, 2000);
    });
  }

  // Configuração do botão de atualizar notícias
  const refreshNewsBtn = document.getElementById("refreshNews");
  if (refreshNewsBtn) {
    refreshNewsBtn.addEventListener("click", function() {
      const icon = this.querySelector('i');
      icon.classList.add('fa-spin');
      
      fetchNews().finally(() => {
        icon.classList.remove('fa-spin');
      });
    });
  }

  // Configuração do botão "Carregar mais notícias"
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", function () {
      if (AppState.newsData.length > 1) {
        const restantes = AppState.newsData.slice(1);
        renderNewsGrid(restantes);
      }
    });
  }

  // Scroll suave para links internos
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href");
      if (targetId === "#") return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    });
  });

  // Lazy loading para imagens
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src || img.src;
          img.classList.remove('lazy');
          observer.unobserve(img);
        }
      });
    });

    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
      imageObserver.observe(img);
    });
  }

  // Inicialização dos componentes principais
  Promise.all([
    initWidgets(),
    fetchNews()
  ]).then(() => {
    console.log("Aplicação inicializada com sucesso!");
  }).catch(error => {
    console.error("Erro na inicialização:", error);
    showToast("Erro ao inicializar a aplicação", "error");
  });

  // Detecta mudanças de visibilidade para pausar/retomar atualizações
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && AppState.widgetsLoaded) {
      // Atualiza dados quando a página volta a ficar visível
      setTimeout(() => {
        Promise.all([
          loadMiniTable(),
          loadMiniResults(),
          loadNextMatches()
        ]);
      }, 1000);
    }
  });

  // Service Worker para cache (opcional)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW registrado com sucesso:', registration);
        })
        .catch(registrationError => {
          console.log('Falha no registro do SW:', registrationError);
        });
    });
  }
});

// Funções globais para uso em onclick
window.scrollToSection = scrollToSection;
window.fetchNews = fetchNews;
window.loadMiniTable = loadMiniTable;
window.loadMiniResults = loadMiniResults;
window.loadNextMatches = loadNextMatches;
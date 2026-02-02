/**
 * Cabuloso News - Script Principal (Design Original + Worker Fix)
 * COM CACHE LOCAL PARA REDUZIR REQUESTS
 */

const CONFIG = {
  newsApiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/",
  tabelaApiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/",
  agendaApiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/",
  resultadosApiUrl: "https://cabuloso-api.cabulosonews92.workers.dev/",
  defaultImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/200px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png',
  
  // Configurações de cache local (em milissegundos)
  CACHE_TTL: {
    NEWS: 10 * 60 * 1000,     // 10 minutos
    TABLE: 30 * 60 * 1000,    // 30 minutos
    MATCHES: 60 * 60 * 1000,  // 1 hora
    RESULTS: 30 * 60 * 1000   // 30 minutos
  }
};

// ============================================
// SISTEMA DE CACHE LOCAL
// ============================================
const LocalCache = {
  set(key, data, ttl) {
    const item = {
      data,
      timestamp: Date.now(),
      ttl
    };
    localStorage.setItem(`cache_${key}`, JSON.stringify(item));
  },

  get(key) {
    const raw = localStorage.getItem(`cache_${key}`);
    if (!raw) return null;
    
    const item = JSON.parse(raw);
    const now = Date.now();
    
    // Verifica se o cache expirou
    if (now - item.timestamp > item.ttl) {
      localStorage.removeItem(`cache_${key}`);
      return null;
    }
    
    return item.data;
  },

  clear(key) {
    if (key) {
      localStorage.removeItem(`cache_${key}`);
    } else {
      // Remove todos os caches
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('cache_')) {
          localStorage.removeItem(k);
        }
      });
    }
  }
};

// ============================================
// FUNÇÕES COM CACHE
// ============================================
const fetchWithCache = async (url, cacheKey, ttl) => {
  // 1. Tenta pegar do cache local primeiro
  const cached = LocalCache.get(cacheKey);
  if (cached) {
    console.log(`✅ Usando cache local: ${cacheKey}`);
    return cached;
  }

  // 2. Se não tiver cache, faz request
  try {
    const response = await fetch(url);
    let data = await response.json();
    
    // Worker retorna array, pega primeiro item
    if (Array.isArray(data)) {
      data = data[0];
    }
    
    // 3. Salva no cache local
    LocalCache.set(cacheKey, data, ttl);
    
    return data;
  } catch (error) {
    console.error(`Erro ao buscar ${cacheKey}:`, error);
    
    // 4. Em caso de erro, tenta retornar cache expirado como fallback
    const expiredCache = localStorage.getItem(`cache_${cacheKey}`);
    if (expiredCache) {
      const item = JSON.parse(expiredCache);
      console.log(`⚠️ Usando cache expirado como fallback: ${cacheKey}`);
      return item.data;
    }
    
    throw error;
  }
};

// ============================================
// FUNÇÕES ATUALIZADAS COM CACHE
// ============================================
const fetchNews = async () => {
  const container = document.getElementById("newsContainer");
  if (!container) return;

  try {
    const data = await fetchWithCache(
      CONFIG.newsApiUrl,
      'news',
      CONFIG.CACHE_TTL.NEWS
    );

    if (!data || !data.noticias) {
      throw new Error("Dados de notícias não encontrados");
    }

    // Resto do seu código permanece igual...
    data.noticias.sort((a, b) => parseNewsDate(b.date) - parseNewsDate(a.date));
    allNews = data.noticias;
    displayedNewsCount = 0;
    container.innerHTML = '';
    renderMoreNews();

    const loadMoreContainer = document.getElementById("loadMoreContainer");
    if (loadMoreContainer) {
      if (allNews.length > NEWS_PER_PAGE) {
        loadMoreContainer.style.display = "block";
        const btnLoadMore = document.getElementById("btnLoadMore");
        if (btnLoadMore) {
          btnLoadMore.onclick = renderMoreNews;
        }
      } else {
        loadMoreContainer.style.display = "none";
      }
    }

  } catch (error) {
    console.error("Erro detalhado:", error);
    // Mostra mensagem de erro
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: white;">
        <i class="fas fa-exclamation-circle" style="font-size: 2rem; color: #ff4444;"></i>
        <p>Não foi possível carregar as notícias.</p>
        <button onclick="fetchNews()" style="margin-top: 10px; padding: 8px 16px; background: #2E8B57; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Tentar novamente
        </button>
      </div>`;
  }
};

const fetchMiniTable = async () => {
  const tbody = document.getElementById("miniTableBody");
  if (!tbody) return;

  try {
    const data = await fetchWithCache(
      CONFIG.tabelaApiUrl,
      'table',
      CONFIG.CACHE_TTL.TABLE
    );

    if (!data || !data.tabela_brasileiro || !data.tabela_brasileiro.classificacao) {
      throw new Error("Dados de tabela não encontrados");
    }

    // Resto do seu código permanece igual...
    const top5 = data.tabela_brasileiro.classificacao.slice(0, 5);

    tbody.innerHTML = top5
      .map((time, index) => {
        const isCruzeiro = time.nome?.toLowerCase().includes("cruzeiro");
        return `
        <tr class="${isCruzeiro ? "cruzeiro-row" : ""}">
          <td>${index + 1}º</td>
          <td>
            <div class="team-cell">
              <img src="${time.escudo || CONFIG.defaultImage}" alt="" class="team-logo" loading="lazy">
              <span>${escapeHtml(time.nome)}</span>
            </div>
          </td>
          <td><strong>${time.pontos}</strong></td>
        </tr>
      `;
      })
      .join("");

    const cruzeiro = data.tabela_brasileiro.classificacao.find((t) =>
      t.nome?.toLowerCase().includes("cruzeiro"),
    );

    const statPosition = document.getElementById("statPosition");
    if (statPosition && cruzeiro) {
      statPosition.textContent = `${cruzeiro.posicao || "?"}º lugar`;
    }

  } catch (error) {
    console.error("Erro ao buscar mini tabela:", error);
    tbody.innerHTML =
      '<tr><td colspan="3" class="loading-cell">Erro ao carregar</td></tr>';
  }
};

const fetchNextMatches = async () => {
  const container = document.getElementById("nextMatchesWidget");
  if (!container) return;

  try {
    const data = await fetchWithCache(
      CONFIG.agendaApiUrl,
      'matches',
      CONFIG.CACHE_TTL.MATCHES
    );

    if (!data || !data.agenda) {
      throw new Error("Dados de agenda não encontrados");
    }

    // Resto do seu código permanece igual...
    const proximos = data.agenda.slice(0, 3);

    container.innerHTML = proximos
      .map(
        (jogo) => `
      <div class="match-item">
        <div class="match-item-date">
          <i class="far fa-calendar"></i>
          ${escapeHtml(jogo.data)} - ${escapeHtml(jogo.hora)}
        </div>
        <div class="match-item-teams">
          <div class="match-team-widget">
            <img src="${jogo.escudo_mandante || CONFIG.defaultImage}" alt="" loading="lazy">
            <span>${escapeHtml(jogo.mandante)}</span>
          </div>
          <span class="match-score-widget">X</span>
          <div class="match-team-widget">
            <span>${escapeHtml(jogo.visitante)}</span>
            <img src="${jogo.escudo_visitante || CONFIG.defaultImage}" alt="" loading="lazy">
          </div>
        </div>
        <div class="match-item-competition">${escapeHtml(jogo.campeonato)}</div>
      </div>
    `
      )
      .join("");

    const statNextGame = document.getElementById("statNextGame");
    if (statNextGame && proximos.length > 0) {
      const prox = proximos[0];
      const opponent = prox.mandante?.toLowerCase().includes("cruzeiro")
        ? prox.visitante
        : prox.mandante;
      statNextGame.textContent = `${prox.data?.split(" ")[0] || ""} vs ${opponent || "Adversário"}`;
    }

  } catch (error) {
    console.error("Erro ao buscar próximos jogos:", error);
    container.innerHTML =
      '<div class="loading-cell">Erro ao carregar jogos.</div>';
  }
};

const fetchRecentResults = async () => {
  const container = document.getElementById("recentResultsWidget");
  if (!container) {
    console.error("ERRO: Elemento 'recentResultsWidget' não encontrado no HTML.");
    return;
  }

  try {
    const data = await fetchWithCache(
      CONFIG.resultadosApiUrl,
      'results',
      CONFIG.CACHE_TTL.RESULTS
    );

    console.log("📊 Dados de resultados recebidos:", data); // DEBUG

    // Verifica diferentes estruturas possíveis
    let resultados = [];
    
    if (data && data.resultados) {
      resultados = data.resultados;
      console.log("✅ Usando data.resultados");
    } else if (data && data.dados_completos) {
      resultados = data.dados_completos;
      console.log("✅ Usando data.dados_completos");
    } else if (Array.isArray(data)) {
      resultados = data;
      console.log("✅ Usando array direto");
    } else {
      throw new Error("Estrutura de dados desconhecida");
    }

    if (!Array.isArray(resultados) || resultados.length === 0) {
      console.warn("⚠️ Nenhum resultado encontrado");
      container.innerHTML = '<div class="loading-cell">Nenhum resultado recente</div>';
      return;
    }

    console.log(`📋 Total de resultados: ${resultados.length}`);

    // Pega apenas os 5 últimos (como no antigo)
    const ultimosResultados = resultados.slice(0, 5);

    container.innerHTML = ultimosResultados.map((res, index) => {
        console.log(`🏁 Resultado ${index + 1}:`, res); // DEBUG
        
        // Tenta diferentes formatos de placar
        let score1 = "0";
        let score2 = "0";
        
        if (res.score1 !== undefined && res.score2 !== undefined) {
          // Formato: score1 e score2 separados
          score1 = res.score1.toString();
          score2 = res.score2.toString();
        } else if (res.score) {
          // Formato: "2 x 1" ou "2-1"
          const scoreParts = res.score.split(/[x\-]/).map(s => s.trim());
          if (scoreParts.length >= 2) {
            score1 = scoreParts[0];
            score2 = scoreParts[1];
          }
        } else if (res.placar) {
          // Formato: placar objeto
          const scoreParts = res.placar.split(/[x\-]/).map(s => s.trim());
          if (scoreParts.length >= 2) {
            score1 = scoreParts[0];
            score2 = scoreParts[1];
          }
        }
        
        // Determina qual time é o Cruzeiro
        const team1 = res.team1 || res.mandante || "Time 1";
        const team2 = res.team2 || res.visitante || "Time 2";
        const logo1 = res.logo1 || res.escudo_mandante || CONFIG.defaultImage;
        const logo2 = res.logo2 || res.escudo_visitante || CONFIG.defaultImage;
        
        const isCruzeiroMandante = team1.toLowerCase().includes("cruzeiro");
        const isCruzeiroVisitante = team2.toLowerCase().includes("cruzeiro");
        const isCruzeiro = isCruzeiroMandante || isCruzeiroVisitante;
        
        let statusClass = "draw";
        const s1 = parseInt(score1) || 0;
        const s2 = parseInt(score2) || 0;
        
        if (!isNaN(s1) && !isNaN(s2)) {
          if (s1 === s2) {
            statusClass = "draw";
          } else if (isCruzeiroMandante) {
            statusClass = s1 > s2 ? "win" : "loss";
          } else if (isCruzeiroVisitante) {
            statusClass = s2 > s1 ? "win" : "loss";
          } else {
            // Se Cruzeiro não está jogando (dados de outros times)
            statusClass = "neutral";
          }
        }

        // Determina competição
        const competition = res.competition || res.campeonato || res.torneio || "Amistoso";

        return `
        <div class="result-mini">
          <div class="result-mini-teams">
            <div class="result-mini-team">
              <img src="${escapeHtml(logo1)}" alt="${escapeHtml(team1)}" loading="lazy" 
                   onerror="this.src='${CONFIG.defaultImage}'">
              <span>${escapeHtml(team1)}</span>
            </div>
            <span class="result-mini-score ${statusClass}">${escapeHtml(score1)} x ${escapeHtml(score2)}</span>
            <div class="result-mini-team">
              <img src="${escapeHtml(logo2)}" alt="${escapeHtml(team2)}" loading="lazy"
                   onerror="this.src='${CONFIG.defaultImage}'">
              <span>${escapeHtml(team2)}</span>
            </div>
          </div>
          <div class="result-mini-info">${escapeHtml(competition)}</div>
          ${res.data ? `<div class="result-mini-date"><i class="far fa-calendar"></i> ${escapeHtml(res.data)}</div>` : ''}
        </div>`;
    }).join("");

    // Se ainda estiver vazio após tentar renderizar
    if (container.innerHTML.trim() === "") {
      container.innerHTML = `
        <div class="loading-cell" style="text-align: center; padding: 20px;">
          <i class="fas fa-futbol" style="font-size: 2rem; color: #666; margin-bottom: 10px;"></i>
          <p>Resultados em breve</p>
        </div>`;
    }

  } catch (error) {
    console.error("❌ Erro em fetchRecentResults:", error);
    
    // Tenta mostrar dados de fallback do cache expirado
    const expiredCache = localStorage.getItem('cache_results');
    if (expiredCache) {
      try {
        const oldData = JSON.parse(expiredCache);
        if (oldData.data && oldData.data.resultados) {
          console.log("⚠️ Tentando usar cache expirado...");
          
          const resultados = oldData.data.resultados.slice(0, 3);
          container.innerHTML = resultados.map(res => `
            <div class="result-mini">
              <div class="result-mini-teams">
                <div class="result-mini-team">
                  <img src="${escapeHtml(res.logo1 || CONFIG.defaultImage)}" alt="${escapeHtml(res.team1)}">
                  <span>${escapeHtml(res.team1)}</span>
                </div>
                <span class="result-mini-score">${escapeHtml(res.score1 || '0')} x ${escapeHtml(res.score2 || '0')}</span>
                <div class="result-mini-team">
                  <img src="${escapeHtml(res.logo2 || CONFIG.defaultImage)}" alt="${escapeHtml(res.team2)}">
                  <span>${escapeHtml(res.team2)}</span>
                </div>
              </div>
              <div class="result-mini-info">${escapeHtml(res.competition || '')}</div>
              <div class="result-mini-date" style="color: #888; font-size: 0.8rem; margin-top: 5px;">
                <i class="fas fa-exclamation-triangle"></i> Dados podem estar desatualizados
              </div>
            </div>
          `).join('');
          return;
        }
      } catch (cacheError) {
        console.error("Erro ao usar cache expirado:", cacheError);
      }
    }
    
    container.innerHTML = `
      <div class="loading-cell" style="text-align: center; padding: 20px;">
        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #ffcc00; margin-bottom: 10px;"></i>
        <p>Não foi possível carregar os resultados</p>
        <button onclick="fetchRecentResults()" 
                style="margin-top: 10px; padding: 8px 16px; background: #2E8B57; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Tentar novamente
        </button>
      </div>`;
  }
};

// ============================================
// FUNÇÃO PARA FORÇAR ATUALIZAÇÃO MANUAL
// ============================================
const forceRefreshAll = () => {
  // Limpa todos os caches
  LocalCache.clear();
  
  // Recarrega os dados
  fetchNews();
  fetchMiniTable();
  fetchNextMatches();
  fetchRecentResults();
  
  // Feedback visual
  alert("Dados atualizados com sucesso!");
  
  // Pode adicionar um toast/notificação no seu site
  // showToast("Dados atualizados!", "success");
};

// Adiciona botão de refresh no console para debug
console.log("%c🔧 Cabuloso News Debug", "color: #2E8B57; font-weight: bold;");
console.log("%cDigite forceRefreshAll() para atualizar manualmente", "color: #666;");
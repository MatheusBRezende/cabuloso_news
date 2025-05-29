// =================== CONFIGURAÇÃO OTIMIZADA ===================
const CONFIG = {
  apiKey: null,
  cache: new Map(),
  cacheTimeout: 30000, // 30 segundos
  debounceTimeout: 300,
  isMobile: window.innerWidth <= 768,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
};

// =================== UTILITÁRIOS DE PERFORMANCE ===================
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
};

// Cache inteligente
const getCachedData = (key) => {
  const cached = CONFIG.cache.get(key);
  if (cached && Date.now() - cached.timestamp < CONFIG.cacheTimeout) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key, data) => {
  CONFIG.cache.set(key, {
    data,
    timestamp: Date.now()
  });
};

// =================== API OTIMIZADA ===================
async function fetchAPIKey() {
  try {
    const cached = getCachedData('apiKey');
    if (cached) {
      CONFIG.apiKey = cached;
      return true;
    }

    const response = await fetch('/api/chave-google');
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    
    const data = await response.json();
    if (!data.apiKey) throw new Error("API key não encontrada");
    
    CONFIG.apiKey = data.apiKey;
    setCachedData('apiKey', data.apiKey);
    return true;
  } catch (error) {
    console.error("Erro ao carregar API key:", error);
    return false;
  }
}

// Fetch otimizado com cache
async function fetchSheetData(sheetId, range, cacheKey) {
  try {
    const cached = getCachedData(cacheKey);
    if (cached) return cached;

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${CONFIG.apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    
    const data = await response.json();
    setCachedData(cacheKey, data);
    return data;
  } catch (error) {
    console.error(`Erro ao buscar dados da planilha:`, error);
    throw error;
  }
}

// =================== MANIPULAÇÃO DOM OTIMIZADA ===================
const DOMUtils = {
  // Batch DOM updates
  batchUpdate: (element, updates) => {
    const fragment = document.createDocumentFragment();
    const temp = element.cloneNode(false);
    
    updates.forEach(update => update(temp));
    
    fragment.appendChild(temp);
    element.parentNode.replaceChild(fragment.firstChild, element);
  },

  // Lazy loading de imagens
  lazyLoadImages: () => {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            observer.unobserve(img);
          }
        });
      });

      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  },

  // Animações condicionais
  animate: (element, animation) => {
    if (CONFIG.reducedMotion || CONFIG.isMobile) return;
    element.style.animation = animation;
  }
};

// =================== WIDGETS OTIMIZADOS ===================
class WidgetManager {
  constructor() {
    this.widgets = new Map();
    this.updateQueue = [];
    this.isUpdating = false;
  }

  register(name, updateFunction) {
    this.widgets.set(name, {
      update: updateFunction,
      lastUpdate: 0,
      interval: 30000 // 30 segundos
    });
  }

  async updateWidget(name) {
    const widget = this.widgets.get(name);
    if (!widget) return;

    const now = Date.now();
    if (now - widget.lastUpdate < widget.interval) return;

    try {
      await widget.update();
      widget.lastUpdate = now;
    } catch (error) {
      console.error(`Erro ao atualizar widget ${name}:`, error);
    }
  }

  async updateAll() {
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      const promises = Array.from(this.widgets.keys()).map(name => 
        this.updateWidget(name)
      );
      await Promise.allSettled(promises);
    } finally {
      this.isUpdating = false;
    }
  }
}

const widgetManager = new WidgetManager();

// =================== WIDGETS ESPECÍFICOS ===================
async function loadMiniTable() {
  try {
    const data = await fetchSheetData(
      '1ubZ_5cXZYLLcFQnHGAqsWMDn59arVI8JynTpf4-kOa0',
      'A1:M6',
      'miniTable'
    );

    const container = document.getElementById('mini-tabela');
    if (!container) return;

    const html = data.values.slice(1, 6).map((row, index) => {
      const isCruzeiro = row[1]?.includes('Cruzeiro');
      return `
        <tr class="${isCruzeiro ? 'cruzeiro-row' : ''}">
          <td>${index + 1}º</td>
          <td class="team-cell">
            <img data-src="${getTeamLogo(row[1])}" class="team-logo lazy" alt="${row[1]}">
            ${row[1]?.replace(/^\d+°\s*/, '').replace(/\s[A-Z]{2,4}$/, '') || ''}
          </td>
          <td>${row[2] || 0}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = html;
    DOMUtils.lazyLoadImages();
  } catch (error) {
    console.error('Erro ao carregar mini tabela:', error);
  }
}

async function loadMiniResults() {
  try {
    const data = await fetchSheetData(
      '12LrzrOnzSwScp-9PzKrtq13ElgTUpWxo3BDp4Y82Dm0',
      'A1:F6',
      'miniResults'
    );

    const container = document.getElementById('mini-resultados');
    if (!container) return;

    const html = data.values.slice(1, 4).map(row => {
      const scoreParts = row[2]?.split(/(?=[A-Za-z])/) || ['-'];
      return `
        <div class="mini-result">
          <div class="mini-teams">
            <div class="mini-team ${row[1]?.includes('Cruzeiro') ? 'cruzeiro' : ''}">
              <img data-src="${getTeamLogo(row[1])}" class="mini-team-logo lazy">
              <span>${row[1]?.includes('Cruzeiro') ? 'Cruzeiro' : row[1]?.split(' ').slice(-1)[0] || ''}</span>
            </div>
            <div class="mini-score">${scoreParts[0]?.trim() || '-'}</div>
            <div class="mini-team ${row[3]?.includes('Cruzeiro') ? 'cruzeiro' : ''}">
              <span>${row[3]?.includes('Cruzeiro') ? 'Cruzeiro' : row[3]?.split(' ').slice(-1)[0] || ''}</span>
              <img data-src="${getTeamLogo(row[3])}" class="mini-team-logo lazy">
            </div>
          </div>
          <div class="mini-competition">${row[0]} • ${row[5] || 'Amistoso'}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
    DOMUtils.lazyLoadImages();
  } catch (error) {
    console.error('Erro ao carregar mini resultados:', error);
  }
}

async function loadNextMatches() {
  try {
    const data = await fetchSheetData(
      '1i3KjyXbLnyC-zt6ByPuuZFRe96PfhiXJRFGCPYG7l1c',
      'PARTIDAS',
      'nextMatches'
    );

    const container = document.getElementById('proximos-jogos');
    if (!container) return;

    let html = '';
    let count = 0;
    const hoje = new Date();

    for (let i = 1; i < data.values.length && count < 3; i++) {
      const row = data.values[i];
      if (!row[0] || !row[1] || !row[3]) continue;

      const isCruzeiro = row[1]?.includes('Cruzeiro') || row[3]?.includes('Cruzeiro');
      if (!isCruzeiro && count > 0) continue;

      const [dia, mes] = row[0].split('/');
      const dataJogo = new Date(hoje.getFullYear(), parseInt(mes) - 1, parseInt(dia));
      if (dataJogo < hoje) continue;

      const isLive = row[7] === 'LIVE' || row[7] === 'AO VIVO';

      html += `
        <div class="next-match">
          <div class="match-date">
            ${row[0]} • ${isLive ? '<span class="live-badge">AO VIVO</span>' : row[7]}
          </div>
          <div class="match-teams">
            <div class="match-team ${row[1]?.includes('Cruzeiro') ? 'cruzeiro' : ''}">
              <img data-src="${getTeamLogo(row[1])}" class="match-team-logo lazy">
              <span>${row[1]?.includes('Cruzeiro') ? 'Cruzeiro' : row[1]?.split(' ').slice(-1)[0] || ''}</span>
            </div>
            <span class="match-vs">vs</span>
            <div class="match-team ${row[3]?.includes('Cruzeiro') ? 'cruzeiro' : ''}">
              <span>${row[3]?.includes('Cruzeiro') ? 'Cruzeiro' : row[3]?.split(' ').slice(-1)[0] || ''}</span>
              <img data-src="${getTeamLogo(row[3])}" class="match-team-logo lazy">
            </div>
          </div>
          <div class="match-info">
            <span>${row[5] || 'Amistoso'}</span>
            <span>${row[6] || 'Local a definir'}</span>
          </div>
        </div>
      `;
      count++;
    }

    container.innerHTML = html || `
      <div class="next-match" style="color: #666; text-align: center;">
        <i class="fas fa-calendar-times"></i> Nenhum jogo agendado
      </div>
    `;

    DOMUtils.lazyLoadImages();
  } catch (error) {
    console.error('Erro ao carregar próximos jogos:', error);
  }
}

// =================== NOTÍCIAS OTIMIZADAS ===================
async function fetchNews() {
  try {
    const cached = getCachedData('news');
    if (cached) {
      renderNews(cached);
      return;
    }

    const response = await fetch('api/noticias-espn');
    let noticias = await response.json();

    if (!Array.isArray(noticias) || noticias.length === 0) {
      throw new Error('Nenhuma notícia encontrada');
    }

    // Filtra e ordena
    noticias = noticias
      .filter(n => !/gol/i.test(n.title))
      .sort((a, b) => parseRelativeDate(a.description) - parseRelativeDate(b.description));

    setCachedData('news', noticias);
    renderNews(noticias);
  } catch (error) {
    console.error('Erro ao buscar notícias:', error);
    showNewsError();
  }
}

function renderNews(noticias) {
  // Featured news
  const featured = document.querySelector('.featured-article');
  if (featured && noticias[0]) {
    featured.innerHTML = `
      <div class="featured-image">
        <img data-src="${noticias[0].image || 'https://via.placeholder.com/600x350/003399/ffffff?text=Noticia+Cruzeiro'}" 
             class="lazy" alt="Notícia em destaque">
      </div>
      <div class="featured-content">
        <span class="category">Notícia retirada de: ${noticias[0].fonte || ''}.com.br</span>
        <h3>${noticias[0].title}</h3>
        <p>${noticias[0].description || 'Sem descrição disponível.'}</p>
        <a href="${noticias[0].url}" class="read-more" target="_blank" rel="noopener">
          <i class="bi bi-arrow-right-circle"></i> Ler mais
        </a>
      </div>
    `;
  }

  // News grid
  const newsGrid = document.querySelector('.news-grid');
  if (newsGrid) {
    const fragment = document.createDocumentFragment();
    
    noticias.slice(1, 7).forEach(noticia => {
      const article = document.createElement('article');
      article.className = 'news-card';
      article.innerHTML = `
        <div class="news-image">
          <img data-src="${noticia.image || 'https://via.placeholder.com/400x250/003399/ffffff?text=Noticia'}" 
               class="lazy" alt="Notícia">
        </div>
        <div class="news-content">
          <span class="category">Notícia retirada de: ${noticia.fonte || ''}.com.br</span>
          <h3>${noticia.title}</h3>
          <p>${noticia.description || 'Sem descrição disponível.'}</p>
          <a href="${noticia.url}" class="read-more" target="_blank" rel="noopener">Ler mais</a>
        </div>
      `;
      fragment.appendChild(article);
    });

    newsGrid.innerHTML = '';
    newsGrid.appendChild(fragment);
  }

  DOMUtils.lazyLoadImages();
}

function showNewsError() {
  const featured = document.querySelector('.featured-article');
  const newsGrid = document.querySelector('.news-grid');
  
  const errorMsg = `
    <div style="text-align:center; color:#666; padding:20px;">
      <i class="fas fa-exclamation-triangle"></i> Não foi possível carregar as notícias.
    </div>
  `;
  
  if (featured) featured.innerHTML = errorMsg;
  if (newsGrid) newsGrid.innerHTML = errorMsg;
}
//teste//
// =================== UTILITÁRIOS ===================
function getTeamLogo(teamName) {
  const logos = {
    'Cruzeiro': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/50px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png',
    'Flamengo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Flamengo-RJ_%28BRA%29.png/50px-Flamengo-RJ_%28BRA%29.png',
    'Palmeiras': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Palmeiras_logo.svg/50px-Palmeiras_logo.svg.png',
    // ... outros logos
  };
  
  for (const [key, value] of Object.entries(logos)) {
    if (teamName?.includes(key)) return value;
  }
  return 'https://via.placeholder.com/40/0033a0/ffffff?text=CRU';
}

function parseRelativeDate(str) {
  if (!str) return Infinity;
  str = str.toLowerCase().trim();
  
  if (str.includes('minuto')) {
    const n = parseInt(str);
    return isNaN(n) ? Infinity : n;
  }
  if (str.includes('hora')) {
    const n = parseInt(str);
    return isNaN(n) ? Infinity : n * 60;
  }
  if (str.includes('dia')) {
    const n = parseInt(str);
    return isNaN(n) ? Infinity : n * 24 * 60;
  }
  return Infinity;
}

// =================== INICIALIZAÇÃO ===================
document.addEventListener('DOMContentLoaded', async function() {
  // Detecta preferências do usuário
  CONFIG.isMobile = window.innerWidth <= 768;
  CONFIG.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Carrega API key
  const apiKeyLoaded = await fetchAPIKey();
  if (!apiKeyLoaded) {
    console.error('Falha ao carregar API key');
    return;
  }

  // Registra widgets
  widgetManager.register('miniTable', loadMiniTable);
  widgetManager.register('miniResults', loadMiniResults);
  widgetManager.register('nextMatches', loadNextMatches);

  // Carregamento inicial
  await Promise.allSettled([
    fetchNews(),
    widgetManager.updateAll()
  ]);

  // Setup de eventos
  setupEventListeners();

  // Atualização periódica (menos frequente em mobile)
  const updateInterval = CONFIG.isMobile ? 60000 : 30000;
  setInterval(() => {
    if (!document.hidden) {
      widgetManager.updateAll();
    }
  }, updateInterval);

  // Pausa atualizações quando a aba não está visível
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Limpa cache quando a aba fica inativa por muito tempo
      setTimeout(() => {
        if (document.hidden) {
          CONFIG.cache.clear();
        }
      }, 300000); // 5 minutos
    }
  });
});

function setupEventListeners() {
  // Menu mobile
  const menuToggle = document.querySelector('.menu-toggle');
  const navMenu = document.querySelector('.nav-menu');
  
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      navMenu.classList.toggle('active');
    });
  }

  // Newsletter
  const newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const email = this.querySelector('input[type="email"]').value;
      alert(`Obrigado por se inscrever! Você receberá as notícias no email: ${email}`);
      this.reset();
    });
  }

  // Scroll suave otimizado
  document.addEventListener('click', function(e) {
    if (e.target.matches('a[href^="#"]')) {
      e.preventDefault();
      const targetId = e.target.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ 
          behavior: CONFIG.reducedMotion ? 'auto' : 'smooth',
          block: 'start'
        });
      }
    }
  });

  // Resize otimizado
  window.addEventListener('resize', throttle(() => {
    CONFIG.isMobile = window.innerWidth <= 768;
  }, 250));
}
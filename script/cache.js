// cache.js - VERSÃO OTIMIZADA
// Usa sessionStorage (mais rápido que localStorage) + Cache API

const CACHE_NAME = 'cabuloso-v1';
const STORAGE_TYPE = sessionStorage; // Mais rápido e limpa ao fechar navegador

/**
 * Salva no sessionStorage (memória da sessão)
 * @param {string} key - Chave do cache
 * @param {any} data - Dados a serem salvos
 * @param {number} ttl - Tempo de vida em milissegundos
 */
export const saveToCache = (key, data, ttl) => {
  try {
    const item = { 
      data, 
      timestamp: Date.now(), 
      ttl 
    };
    STORAGE_TYPE.setItem(`cache_${key}`, JSON.stringify(item));
  } catch (e) {
    console.warn("⚠️ Storage cheio, limpando cache antigo...", e);
    clearExpiredCache();
    
    // Tenta novamente após limpar
    try {
      const item = { data, timestamp: Date.now(), ttl };
      STORAGE_TYPE.setItem(`cache_${key}`, JSON.stringify(item));
    } catch (e2) {
      console.error("❌ Falha ao salvar no cache:", e2);
    }
  }
};

/**
 * Recupera do sessionStorage
 * @param {string} key - Chave do cache
 * @returns {any|null} Dados armazenados ou null se expirado/inexistente
 */
export const getFromCache = (key) => {
  const raw = STORAGE_TYPE.getItem(`cache_${key}`);
  if (!raw) return null;

  try {
    const item = JSON.parse(raw);
    const isExpired = Date.now() - item.timestamp > item.ttl;

    if (isExpired) {
      STORAGE_TYPE.removeItem(`cache_${key}`);
      return null;
    }
    
    return item.data;
  } catch (e) {
    console.warn("⚠️ Erro ao parsear cache, removendo:", e);
    STORAGE_TYPE.removeItem(`cache_${key}`);
    return null;
  }
};

/**
 * Cache API - Para respostas HTTP (mais moderno e eficiente)
 * @param {string} url - URL da requisição
 * @param {Response} response - Resposta da API
 */
export const saveToCacheAPI = async (url, response) => {
  if (!('caches' in window)) return; // Navegador não suporta
  
  try {
    const cache = await caches.open(CACHE_NAME);
    // Clone para poder ler o body múltiplas vezes
    await cache.put(url, response.clone());
    console.log("✅ Salvo no Cache API:", url);
  } catch (e) {
    console.warn("⚠️ Cache API falhou:", e);
  }
};

/**
 * Recupera do Cache API
 * @param {string} url - URL da requisição
 * @returns {Response|null} Resposta em cache ou null
 */
export const getFromCacheAPI = async (url) => {
  if (!('caches' in window)) return null;
  
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(url);
    
    if (response) {
      // Verifica idade do cache via header Date
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        const cacheDate = new Date(dateHeader);
        const ageInSeconds = (Date.now() - cacheDate.getTime()) / 1000;
        
        // Considera válido se < 5 minutos
        if (ageInSeconds < 300) {
          console.log("✅ Cache API HIT:", url, `(${Math.round(ageInSeconds)}s atrás)`);
          return response;
        } else {
          console.log("⏰ Cache API expirado:", url);
          await cache.delete(url);
        }
      }
    }
    
    return null;
  } catch (e) {
    console.warn("⚠️ Erro ao ler Cache API:", e);
    return null;
  }
};

/**
 * Limpa entradas expiradas do sessionStorage
 */
export const clearExpiredCache = () => {
  const keysToRemove = [];
  
  for (let i = 0; i < STORAGE_TYPE.length; i++) {
    const key = STORAGE_TYPE.key(i);
    if (key && key.startsWith('cache_')) {
      const actualKey = key.replace('cache_', '');
      const data = getFromCache(actualKey); // Já remove se expirado
      if (!data) {
        keysToRemove.push(key);
      }
    }
  }
  
  keysToRemove.forEach(key => STORAGE_TYPE.removeItem(key));
  console.log(`🧹 Limpou ${keysToRemove.length} entradas expiradas`);
};

/**
 * Limpa TODO o cache do Cabuloso
 */
export const clearAllCabulosoCache = async () => {
  // Limpa sessionStorage
  Object.keys(STORAGE_TYPE).forEach(key => {
    if (key.startsWith('cache_')) {
      STORAGE_TYPE.removeItem(key);
    }
  });
  
  // Limpa Cache API
  if ('caches' in window) {
    try {
      await caches.delete(CACHE_NAME);
      console.log("🧹 Cache API limpo");
    } catch (e) {
      console.warn("⚠️ Erro ao limpar Cache API:", e);
    }
  }
  
  console.log("✅ Todo cache do Cabuloso foi limpo");
};

/**
 * Retorna estatísticas do cache (útil para debug)
 */
export const getCacheStats = () => {
  const keys = [];
  const stats = {
    totalItems: 0,
    totalSize: 0,
    items: []
  };
  
  for (let i = 0; i < STORAGE_TYPE.length; i++) {
    const key = STORAGE_TYPE.key(i);
    if (key && key.startsWith('cache_')) {
      const raw = STORAGE_TYPE.getItem(key);
      if (raw) {
        const size = new Blob([raw]).size;
        const actualKey = key.replace('cache_', '');
        
        try {
          const item = JSON.parse(raw);
          const age = Date.now() - item.timestamp;
          const isExpired = age > item.ttl;
          
          stats.items.push({
            key: actualKey,
            size: size,
            age: Math.round(age / 1000) + 's',
            ttl: Math.round(item.ttl / 1000) + 's',
            expired: isExpired
          });
          
          stats.totalSize += size;
          stats.totalItems++;
        } catch (e) {
          // Ignora itens corrompidos
        }
      }
    }
  }
  
  return stats;
};

// Expõe para debug no console
if (typeof window !== 'undefined') {
  window.cabulosoCache = {
    stats: getCacheStats,
    clear: clearAllCabulosoCache,
    clearExpired: clearExpiredCache
  };
}
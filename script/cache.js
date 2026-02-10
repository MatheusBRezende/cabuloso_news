// cache.js - VERSÃO OTIMIZADA E COMPATÍVEL
// Usa sessionStorage (mais rápido que localStorage) + Cache API

const CACHE_NAME = 'cabuloso-v1';
const STORAGE_TYPE = sessionStorage;

/**
 * Salva no sessionStorage (memória da sessão)
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
 * Cache API - Salva a Response original
 */
export const saveToCacheAPI = async (url, response) => {
  if (!('caches' in window) || !response) return;
  
  try {
    const cache = await caches.open(CACHE_NAME);
    // IMPORTANTE: Clonamos a resposta para não travar o uso dela no script principal
    await cache.put(url, response.clone());
    console.log("✅ Salvo no Cache API:", url);
  } catch (e) {
    console.warn("⚠️ Cache API falhou ao salvar:", e);
  }
};

/**
 * Recupera do Cache API
 */
export const getFromCacheAPI = async (url) => {
  if (!('caches' in window)) return null;
  
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(url);
    
    if (response) {
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        const cacheDate = new Date(dateHeader);
        const ageInSeconds = (Date.now() - cacheDate.getTime()) / 1000;
        
        if (ageInSeconds < 300) { // 5 minutos
          console.log("✅ Cache API HIT:", url);
          return response;
        } else {
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
 * Limpa entradas expiradas
 */
export const clearExpiredCache = () => {
  for (let i = 0; i < STORAGE_TYPE.length; i++) {
    const key = STORAGE_TYPE.key(i);
    if (key && key.startsWith('cache_')) {
      const actualKey = key.replace('cache_', '');
      getFromCache(actualKey); // O getFromCache já limpa se estiver expirado
    }
  }
};

/**
 * Limpa TODO o cache
 */
export const clearAllCabulosoCache = async () => {
  Object.keys(STORAGE_TYPE).forEach(key => {
    if (key.startsWith('cache_')) STORAGE_TYPE.removeItem(key);
  });
  
  if ('caches' in window) {
    await caches.delete(CACHE_NAME);
  }
  console.log("✅ Todo cache do Cabuloso foi limpo");
};

/**
 * Retorna estatísticas
 */
export const getCacheStats = () => {
  const stats = { totalItems: 0, totalSize: 0, items: [] };
  for (let i = 0; i < STORAGE_TYPE.length; i++) {
    const key = STORAGE_TYPE.key(i);
    if (key && key.startsWith('cache_')) {
      const raw = STORAGE_TYPE.getItem(key);
      if (raw) {
        const size = new Blob([raw]).size;
        try {
          const item = JSON.parse(raw);
          stats.items.push({
            key: key.replace('cache_', ''),
            size: size,
            expired: (Date.now() - item.timestamp > item.ttl)
          });
          stats.totalSize += size;
          stats.totalItems++;
        } catch (e) {}
      }
    }
  }
  return stats;
};

// EXPOSIÇÃO GLOBAL (Para scripts que não usam import e console)
if (typeof window !== 'undefined') {
  window.cabulosoCache = {
    saveToCache,
    getFromCache,
    saveToCacheAPI,
    getFromCacheAPI,
    clearExpiredCache,
    clear: clearAllCabulosoCache,
    stats: getCacheStats
  };
}
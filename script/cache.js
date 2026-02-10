// cache.js - VERSÃO OTIMIZADA E COMPATÍVEL (COM EXPORTS)
const CACHE_NAME = 'cabuloso-v1';
const STORAGE_TYPE = sessionStorage;

/**
 * Salva no sessionStorage
 */
export const saveToCache = (key, data, ttl) => {
  try {
    const item = { data, timestamp: Date.now(), ttl };
    STORAGE_TYPE.setItem(`cache_${key}`, JSON.stringify(item));
  } catch (e) {
    console.warn("⚠️ Storage cheio, limpando...", e);
    clearExpiredCache();
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
    if (Date.now() - item.timestamp > item.ttl) {
      STORAGE_TYPE.removeItem(`cache_${key}`);
      return null;
    }
    return item.data;
  } catch (e) {
    return null;
  }
};

/**
 * Cache API - Salva a Response
 */
export const saveToCacheAPI = async (url, response) => {
  if (!('caches' in window) || !response) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(url, response.clone());
    console.log("✅ Salvo no Cache API:", url);
  } catch (e) {
    console.warn("⚠️ Cache API falhou:", e);
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
        const age = (Date.now() - new Date(dateHeader).getTime()) / 1000;
        if (age < 300) return response;
      }
    }
    return null;
  } catch (e) {
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
      getFromCache(key.replace('cache_', ''));
    }
  }
};

/**
 * Limpa TODO o cache
 */
export const clearAllCabulosoCache = async () => {
  Object.keys(STORAGE_TYPE).forEach(k => k.startsWith('cache_') && STORAGE_TYPE.removeItem(k));
  if ('caches' in window) await caches.delete(CACHE_NAME);
  console.log("✅ Cache limpo");
};

/**
 * Estatísticas
 */
export const getCacheStats = () => {
  const stats = { totalItems: 0, items: [] };
  for (let i = 0; i < STORAGE_TYPE.length; i++) {
    const key = STORAGE_TYPE.key(i);
    if (key && key.startsWith('cache_')) {
      stats.totalItems++;
      stats.items.push(key);
    }
  }
  return stats;
};

// --- EXPOSIÇÃO GLOBAL PARA O CONSOLE ---
window.cabulosoCache = {
  saveToCache,
  getFromCache,
  saveToCacheAPI,
  getFromCacheAPI,
  clear: clearAllCabulosoCache,
  stats: getCacheStats
};

console.log("✅ Cache API carregada globalmente como window.cabulosoCache");
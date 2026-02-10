// cache.js - VERSÃO OTIMIZADA E COMPATÍVEL (SEM ERROS DE SYNTAX)
const CACHE_NAME = 'cabuloso-v1';
const STORAGE_TYPE = sessionStorage;

/**
 * Salva no sessionStorage
 */
const saveToCache = (key, data, ttl) => {
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
const getFromCache = (key) => {
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
const saveToCacheAPI = async (url, response) => {
  if (!('caches' in window) || !response) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    // IMPORTANTE: O clone garante que não dê erro de "body already used"
    await cache.put(url, response.clone());
    console.log("✅ Salvo no Cache API:", url);
  } catch (e) {
    console.warn("⚠️ Cache API falhou:", e);
  }
};

/**
 * Recupera do Cache API
 */
const getFromCacheAPI = async (url) => {
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
const clearExpiredCache = () => {
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
const clearAllCabulosoCache = async () => {
  Object.keys(STORAGE_TYPE).forEach(k => k.startsWith('cache_') && STORAGE_TYPE.removeItem(k));
  if ('caches' in window) await caches.delete(CACHE_NAME);
  console.log("✅ Cache limpo");
};

/**
 * Estatísticas
 */
const getCacheStats = () => {
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

// --- COMPATIBILIDADE GLOBAL (CONSOLE) ---
window.cabulosoCache = {
  saveToCache,
  getFromCache,
  saveToCacheAPI,
  getFromCacheAPI,
  clear: clearAllCabulosoCache,
  stats: getCacheStats
};

// --- COMPATIBILIDADE COM MÓDULOS (SCRIPT.JS) ---
// Isso permite que o 'import' funcione sem quebrar o script comum
export { saveToCache, getFromCache, saveToCacheAPI, getFromCacheAPI, clearExpiredCache, getCacheStats };

console.log("✅ Cache API carregada globalmente como window.cabulosoCache");
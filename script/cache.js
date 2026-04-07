// cache.js - Gerenciamento de cache para Cabuloso News

(function () {
  'use strict';

  const CACHE_NAME = 'cabuloso-v1';
  const STORAGE = sessionStorage;

  /** Salva dado no sessionStorage com TTL */
  function saveToCache(key, data, ttl) {
    try {
      STORAGE.setItem(`cache_${key}`, JSON.stringify({ data, timestamp: Date.now(), ttl }));
    } catch (e) {
      console.warn('⚠️ Storage cheio, limpando cache expirado...', e);
      clearExpiredCache();
    }
  }

  /** Recupera dado do sessionStorage (retorna null se expirado) */
  function getFromCache(key) {
    const raw = STORAGE.getItem(`cache_${key}`);
    if (!raw) return null;
    try {
      const item = JSON.parse(raw);
      if (Date.now() - item.timestamp > item.ttl) {
        STORAGE.removeItem(`cache_${key}`);
        return null;
      }
      return item.data;
    } catch {
      return null;
    }
  }

  /** Salva Response no Cache API (evita erro "body already used") */
  async function saveToCacheAPI(url, response) {
    if (!('caches' in window)) return;
    if (response.bodyUsed) {
      console.warn('⚠️ Não foi possível salvar no Cache API: corpo já lido.');
      return;
    }
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(url, response.clone());
    } catch (e) {
      console.warn('⚠️ Cache API falhou ao salvar:', e);
    }
  }

  /** Recupera Response do Cache API (válida por 5 minutos) */
  async function getFromCacheAPI(url) {
    if (!('caches' in window)) return null;
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match(url);
      if (!response) return null;
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        const ageSeconds = (Date.now() - new Date(dateHeader).getTime()) / 1000;
        if (ageSeconds < 300) return response;
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Remove entradas expiradas do sessionStorage */
  function clearExpiredCache() {
    const keysToCheck = [];
    for (let i = 0; i < STORAGE.length; i++) {
      const key = STORAGE.key(i);
      if (key && key.startsWith('cache_')) keysToCheck.push(key);
    }
    keysToCheck.forEach(key => getFromCache(key.slice(6))); // remove prefixo 'cache_'
  }

  /** Apaga todo o cache (sessionStorage + Cache API) */
  async function clearAllCache() {
    Object.keys(STORAGE).forEach(k => k.startsWith('cache_') && STORAGE.removeItem(k));
    if ('caches' in window) await caches.delete(CACHE_NAME);
    console.log('✅ Cache limpo com sucesso');
  }

  /** Estatísticas de cache */
  function getCacheStats() {
    const keys = [];
    for (let i = 0; i < STORAGE.length; i++) {
      const k = STORAGE.key(i);
      if (k && k.startsWith('cache_')) keys.push(k);
    }
    return { totalItems: keys.length, items: keys };
  }

  // Expõe a API globalmente
  window.cabulosoCache = {
    saveToCache,
    getFromCache,
    saveToCacheAPI,
    getFromCacheAPI,
    clearExpiredCache,
    clear: clearAllCache,
    stats: getCacheStats,
  };

  // Atalho para compatibilidade com script.js
  window.cabulosoCacheModule = window.cabulosoCache;

  console.log('✅ Cache inicializado (window.cabulosoCache disponível)');
})();
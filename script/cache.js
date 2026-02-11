// cache.js - VERSÃO FINAL COMPATÍVEL
// Funciona tanto como <script> normal quanto <script type="module">

(function(global) {
  'use strict';
  
  const CACHE_NAME = 'cabuloso-v1';
  const STORAGE_TYPE = sessionStorage;

  /**
   * Salva no sessionStorage
   */
  function saveToCache(key, data, ttl) {
    try {
      const item = { data, timestamp: Date.now(), ttl };
      STORAGE_TYPE.setItem(`cache_${key}`, JSON.stringify(item));
    } catch (e) {
      console.warn("⚠️ Storage cheio, limpando...", e);
      clearExpiredCache();
    }
  }

  /**
   * Recupera do sessionStorage
   */
  function getFromCache(key) {
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
  }

  /**
   * Cache API - Salva a Response (CORRIGIDO: usa clone())
   */
/**
   * Cache API - Salva a Response (CORRIGIDO)
   */
async function saveToCacheAPI(url, response) {
  if (!('caches' in window)) return;
  
  try {
    // VERIFICAÇÃO CRÍTICA: Se o corpo já foi lido por um .json(), não podemos clonar
    if (response.bodyUsed) {
      console.warn("⚠️ Não foi possível salvar no Cache API: O corpo já foi lido.");
      return;
    }

    const cache = await caches.open(CACHE_NAME);
    // Clonamos aqui para que a resposta original continue disponível para o script.js
    await cache.put(url, response.clone());
  } catch (e) {
    console.error("⚠️ Cache API falhou ao salvar:", e);
  }
}

  /**
   * Recupera do Cache API
   */
  async function getFromCacheAPI(url) {
    if (!('caches' in global)) return null;
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
  }

  /**
   * Limpa entradas expiradas
   */
  function clearExpiredCache() {
    for (let i = 0; i < STORAGE_TYPE.length; i++) {
      const key = STORAGE_TYPE.key(i);
      if (key && key.startsWith('cache_')) {
        getFromCache(key.replace('cache_', ''));
      }
    }
  }

  /**
   * Limpa TODO o cache
   */
  async function clearAllCabulosoCache() {
    Object.keys(STORAGE_TYPE).forEach(k => k.startsWith('cache_') && STORAGE_TYPE.removeItem(k));
    if ('caches' in global) await caches.delete(CACHE_NAME);
    console.log("✅ Cache limpo");
  }

  /**
   * Estatísticas
   */
  function getCacheStats() {
    const stats = { totalItems: 0, items: [] };
    for (let i = 0; i < STORAGE_TYPE.length; i++) {
      const key = STORAGE_TYPE.key(i);
      if (key && key.startsWith('cache_')) {
        stats.totalItems++;
        stats.items.push(key);
      }
    }
    return stats;
  }

  // API Object
  const cacheAPI = {
    saveToCache,
    getFromCache,
    saveToCacheAPI,
    getFromCacheAPI,
    clearExpiredCache,
    getCacheStats,
    clear: clearAllCabulosoCache,
    stats: getCacheStats
  };

  // ====================================================================
  // EXPORTAÇÃO UNIVERSAL - Funciona em todos os ambientes
  // ====================================================================

  // 1. GLOBAL (window) - Para uso com <script> tag
  if (typeof global !== 'undefined') {
    global.cabulosoCache = cacheAPI;
    
    // Também expõe funções individuais para imports
    global.cabulosoCacheModule = {
      saveToCache,
      getFromCache,
      saveToCacheAPI,
      getFromCacheAPI,
      clearExpiredCache,
      getCacheStats
    };
  }

  // 2. CommonJS (Node.js)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = cacheAPI;
  }

  // 3. AMD
  if (typeof define === 'function' && define.amd) {
    define([], function() { return cacheAPI; });
  }

  console.log("✅ Cache API carregada (window.cabulosoCache disponível)");

})(typeof window !== 'undefined' ? window : this);
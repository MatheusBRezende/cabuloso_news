export const saveToCache = (key, data, ttl) => {
    try {
        const item = { data, timestamp: Date.now(), ttl };
        localStorage.setItem(`cache_${key}`, JSON.stringify(item));
    } catch (e) {
        console.warn("LocalStorage cheio, limpando cache antigo...");
        clearAllCabulosoCache();
    }
}

export const getFromCache = (key) => {
    const raw = localStorage.getItem(`cache_${key}`);
    if (!raw) return null;

    try {
        const item = JSON.parse(raw);
        const isExpired = Date.now() - item.timestamp > item.ttl;

        if (isExpired) {
            localStorage.removeItem(`cache_${key}`);
            return null;
        }
        return item.data;
    } catch (e) {
        localStorage.removeItem(`cache_${key}`); 
        return null;
    }
}

export const clearExpiredCache = () => {
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('cache_')) {
            getFromCache(key.replace('cache_', ''));
        }
    });
}

export const clearAllCabulosoCache = () => {
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('cache_')) {
            localStorage.removeItem(key);
        }
    });
}
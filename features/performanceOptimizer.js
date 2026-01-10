/**
 * Simple cache manager for API responses
 * Implements TTL-based cache invalidation
 */
class CacheManager {
    constructor(ttl = 300000) { // 5 minutes default
        this.cache = new Map();
        this.ttl = ttl;
    }

    /**
     * Get cached value if valid
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        // Check if cache has expired
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    /**
     * Set cache value
     */
    set(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    /**
     * Clear specific key or all cache
     */
    clear(key = null) {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
    }

    /**
     * Clear expired items
     */
    prune() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > this.ttl) {
                this.cache.delete(key);
            }
        }
    }
}

/**
 * Debounce utility for throttling frequent calls
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle utility for rate-limiting operations
 */
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

module.exports = {
    CacheManager,
    debounce,
    throttle
};

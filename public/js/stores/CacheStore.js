/**
 * CacheStore.js - Unified caching layer
 * Phase 3: Data Layer Modularization
 */

import { logger } from '../Logger.js';

export class CacheStore {
    constructor(config = {}) {
        this.config = config;
        
        // Memory cache (fastest)
        this.memoryCache = new Map();
        
        // Cache metadata
        this.cacheMetadata = new Map();
        
        // Max memory cache size
        this.maxMemorySize = config.maxMemorySize || 100; // entries
        
        logger.info('CacheStore initialized', { maxMemorySize: this.maxMemorySize });
    }

    /**
     * Store value with TTL
     */
    set(key, value, ttlMs = 60000) {
        logger.debug('CacheStore.set', { key, ttlMs });
        
        const entry = {
            value,
            timestamp: Date.now(),
            expiresAt: Date.now() + ttlMs
        };
        
        // Evict if at capacity
        if (this.memoryCache.size >= this.maxMemorySize) {
            this.evictOldest();
        }
        
        this.memoryCache.set(key, entry);
        this.cacheMetadata.set(key, {
            hits: 0,
            misses: 0,
            lastAccess: Date.now()
        });
        
        // Try localStorage for persistence
        try {
            localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
        } catch (e) {
            logger.warn('localStorage cache failed', { key });
        }
    }

    /**
     * Retrieve cached value
     */
    get(key) {
        const metadata = this.cacheMetadata.get(key);
        
        // Check memory first
        const memEntry = this.memoryCache.get(key);
        if (memEntry) {
            if (Date.now() < memEntry.expiresAt) {
                if (metadata) {
                    metadata.hits++;
                    metadata.lastAccess = Date.now();
                }
                logger.debug('CacheStore cache HIT (memory)', { key });
                return memEntry.value;
            } else {
                this.memoryCache.delete(key);
            }
        }
        
        // Check localStorage
        try {
            const stored = localStorage.getItem(`cache_${key}`);
            if (stored) {
                const entry = JSON.parse(stored);
                if (Date.now() < entry.expiresAt) {
                    // Restore to memory
                    this.memoryCache.set(key, entry);
                    if (metadata) {
                        metadata.hits++;
                        metadata.lastAccess = Date.now();
                    }
                    logger.debug('CacheStore cache HIT (localStorage)', { key });
                    return entry.value;
                } else {
                    localStorage.removeItem(`cache_${key}`);
                }
            }
        } catch (e) {
            logger.warn('localStorage read failed', { key });
        }
        
        if (metadata) metadata.misses++;
        logger.debug('CacheStore cache MISS', { key });
        return null;
    }

    /**
     * Check if key exists (and valid)
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Delete cache entry
     */
    delete(key) {
        logger.debug('CacheStore.delete', { key });
        this.memoryCache.delete(key);
        this.cacheMetadata.delete(key);
        localStorage.removeItem(`cache_${key}`);
    }

    /**
     * Clear entire cache
     */
    clear() {
        logger.info('CacheStore.clear');
        this.memoryCache.clear();
        this.cacheMetadata.clear();
        
        // Clear localStorage cache entries
        const keys = Object.keys(localStorage);
        keys.forEach(k => {
            if (k.startsWith('cache_')) {
                localStorage.removeItem(k);
            }
        });
    }

    /**
     * Prune expired entries
     */
    prune() {
        const now = Date.now();
        let pruned = 0;
        
        for (const [key, entry] of this.memoryCache.entries()) {
            if (entry.expiresAt < now) {
                this.memoryCache.delete(key);
                this.cacheMetadata.delete(key);
                localStorage.removeItem(`cache_${key}`);
                pruned++;
            }
        }
        
        if (pruned > 0) {
            logger.info('CacheStore pruned expired entries', { count: pruned });
        }
    }

    /**
     * Evict oldest entry (LRU)
     */
    evictOldest() {
        let oldestKey = null;
        let oldestAccess = Infinity;
        
        for (const [key, metadata] of this.cacheMetadata.entries()) {
            if (metadata.lastAccess < oldestAccess) {
                oldestAccess = metadata.lastAccess;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            logger.debug('CacheStore evicting oldest', { key: oldestKey });
            this.delete(oldestKey);
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        let totalHits = 0;
        let totalMisses = 0;
        
        for (const metadata of this.cacheMetadata.values()) {
            totalHits += metadata.hits;
            totalMisses += metadata.misses;
        }
        
        const hitRate = totalHits + totalMisses > 0 
            ? (totalHits / (totalHits + totalMisses) * 100).toFixed(1)
            : 0;
        
        return {
            memorySize: this.memoryCache.size,
            maxMemorySize: this.maxMemorySize,
            totalHits,
            totalMisses,
            hitRate: `${hitRate}%`
        };
    }
}

// Singleton
let cacheStoreInstance = null;

export function getCacheStore(config = {}) {
    if (!cacheStoreInstance) {
        cacheStoreInstance = new CacheStore(config);
    }
    return cacheStoreInstance;
}

export function setCacheStore(instance) {
    cacheStoreInstance = instance;
}

const WORKER_MODULE_PATH = './workers/routerWorker.js';

export class RouterWorkerClient {
    constructor({ dataManager, icons, googleApiKey }) {
        this.worker = null;
        this.isSupported = typeof Worker !== 'undefined';
        this.requestId = 0;
        this.pending = new Map();
        this.readyPromise = null;
        this.icons = icons;
        this.googleApiKey = googleApiKey;
        if (this.isSupported && dataManager) {
            this.readyPromise = this.initializeWorker(dataManager);
        }
    }

    async initializeWorker(dataManager) {
        try {
            this.worker = new Worker(new URL(WORKER_MODULE_PATH, import.meta.url), { type: 'module' });
        } catch (error) {
            console.warn('RouterWorkerClient: impossible de créer le worker', error);
            this.isSupported = false;
            return Promise.reject(error);
        }

        this.worker.onmessage = (event) => {
            const { type, requestId, payload, error } = event.data || {};
            if (type === 'ready') {
                const resolver = this.pending.get('init');
                if (resolver) {
                    resolver.resolve(true);
                    this.pending.delete('init');
                }
                return;
            }
            if (type === 'init-error') {
                const resolver = this.pending.get('init');
                if (resolver) {
                    resolver.reject(new Error(error || 'router worker init error'));
                    this.pending.delete('init');
                }
                return;
            }
            if (!requestId) {
                return;
            }
            const pendingEntry = this.pending.get(requestId);
            if (!pendingEntry) return;
            if (error) {
                pendingEntry.reject(new Error(error));
            } else {
                pendingEntry.resolve(payload);
            }
            this.pending.delete(requestId);
        };

        this.worker.onerror = (event) => {
            const resolver = this.pending.get('init');
            if (resolver) {
                resolver.reject(event.error || new Error('router worker crashed during init'));
                this.pending.delete('init');
            }
            this.rejectAll(event.error || new Error('router worker crashed'));
        };

        const initPromise = new Promise((resolve, reject) => {
            this.pending.set('init', { resolve, reject });
        });

        const snapshot = dataManager.createRoutingSnapshot();
        const workerIcons = serializeWorkerIcons(this.icons);
        
        const payload = {
            snapshot,
            icons: workerIcons,
            googleApiKey: this.googleApiKey
        };
        
        if (!validateSerializable(payload)) {
            throw new Error('Payload contains non-serializable data');
        }
        
        this.worker.postMessage({
            type: 'init',
            payload
        });

        return initPromise;
    }

    rejectAll(error) {
        this.pending.forEach(({ reject }) => reject(error));
        this.pending.clear();
    }

    async computeHybridItinerary(params) {
        if (!this.isSupported || !this.worker) {
            throw new Error('RouterWorkerClient indisponible');
        }
        await this.readyPromise;
        return this.enqueueRequest('computeItinerary', params);
    }

    enqueueRequest(type, payload) {
        const requestId = `req_${++this.requestId}`;
        const promise = new Promise((resolve, reject) => {
            this.pending.set(requestId, { resolve, reject });
        });
        
        // Validate payload is serializable before posting
        if (!validateSerializable(payload, 'payload')) {
            this.pending.delete(requestId);
            return Promise.reject(new Error('Payload contains non-serializable data'));
        }
        
        this.worker.postMessage({ type, requestId, payload });
        return promise;
    }

    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.rejectAll(new Error('Router worker terminated'));
    }
}

function serializeWorkerIcons(icons) {
    if (!icons || typeof icons !== 'object') {
        return {}; // Return empty object for consistency with worker expectations
    }
    const allowedKeys = ['BUS', 'WALK', 'statusWarning'];
    const safeIcons = {};
    allowedKeys.forEach((key) => {
        const value = icons[key];
        // Only copy string values (SVG markup) - filter out nested objects, functions, etc.
        if (typeof value === 'string') {
            safeIcons[key] = value;
        }
    });
    return safeIcons;
}

/**
 * Validates that an object can be safely cloned for postMessage to a Web Worker.
 * Recursively checks for functions or other non-serializable data.
 * @param {*} obj - The object to validate
 * @param {string} path - The current path in the object (for error reporting)
 * @returns {boolean} - True if serializable, false otherwise
 */
function validateSerializable(obj, path = 'root') {
    // Primitives and null/undefined are always serializable
    if (obj === null || obj === undefined) return true;
    const type = typeof obj;
    if (type === 'string' || type === 'number' || type === 'boolean') return true;
    
    // Functions are not serializable
    if (type === 'function') {
        console.error(`Found function at ${path}`);
        return false;
    }
    
    // Recursively validate objects and arrays
    if (type === 'object') {
        // Handle arrays separately for better path reporting
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                if (!validateSerializable(obj[i], `${path}[${i}]`)) {
                    return false;
                }
            }
        } else {
            // Use Object.keys to avoid inherited properties
            for (const key of Object.keys(obj)) {
                if (!validateSerializable(obj[key], `${path}.${key}`)) {
                    return false;
                }
            }
        }
    }
    
    return true;
}

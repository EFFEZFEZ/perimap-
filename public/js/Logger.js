/**
 * Logger.js - Système de logging centralisé
 * Facilite le debugging et le suivi en production
 * 
 * Utilisation:
 * Logger.info('Message')
 * Logger.error('Erreur', error)
 * Logger.debug('Debug info', data)
 */

export class Logger {
  constructor(options = {}) {
    this.isDev = options.isDev ?? !window.location.hostname.includes('xn--primap');
    this.isProduction = !this.isDev;
    this.logLevel = options.logLevel ?? (this.isDev ? 'debug' : 'warn');
    this.logs = [];
    this.maxLogs = options.maxLogs ?? 1000;
    this.enableRemote = options.enableRemote ?? false;
    this.remoteUrl = options.remoteUrl ?? '/api/logs';
    this.namespace = options.namespace ?? 'APP';
  }

  /**
   * Niveaux de log
   */
  static LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4
  };

  /**
   * Log debug (développement)
   */
  debug(message, data = null, meta = {}) {
    this._log('DEBUG', message, data, meta);
  }

  /**
   * Log info
   */
  info(message, data = null, meta = {}) {
    this._log('INFO', message, data, meta);
  }

  /**
   * Log warn
   */
  warn(message, data = null, meta = {}) {
    this._log('WARN', message, data, meta);
  }

  /**
   * Log error
   */
  error(message, error = null, meta = {}) {
    const errorData = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error;

    this._log('ERROR', message, errorData, meta);
  }

  /**
   * Log critique
   */
  critical(message, error = null, meta = {}) {
    this._log('CRITICAL', message, error, meta);
  }

  /**
   * Grouper les logs
   */
  group(name) {
    if (this.isDev) console.group(name);
  }

  /**
   * Fin de groupe
   */
  groupEnd() {
    if (this.isDev) console.groupEnd();
  }

  /**
   * Timer pour performance
   */
  time(label) {
    if (this.isDev) console.time(label);
  }

  /**
   * Fin du timer
   */
  timeEnd(label) {
    if (this.isDev) console.timeEnd(label);
  }

  /**
   * Obtenir tous les logs
   */
  getLogs(level = null, limit = 100) {
    let filtered = this.logs;

    if (level) {
      const levelValue = typeof level === 'string' ? Logger.LEVELS[level] : level;
      filtered = filtered.filter(log => Logger.LEVELS[log.level] >= levelValue);
    }

    return filtered.slice(-limit);
  }

  /**
   * Exporter les logs (pour envoi au serveur)
   */
  export() {
    return JSON.stringify(this.logs);
  }

  /**
   * Effacer l'historique
   */
  clear() {
    this.logs = [];
  }

  /**
   * Envoyer les logs au serveur
   */
  async sendToServer() {
    if (!this.enableRemote || this.logs.length === 0) {
      return;
    }

    try {
      await fetch(this.remoteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: this.logs,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('[Logger] Failed to send logs:', error);
    }
  }

  // === Helpers privés ===

  _log(level, message, data, meta) {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      namespace: this.namespace,
      message,
      data,
      meta: {
        ...meta,
        url: window.location.href,
        userAgent: navigator.userAgent
      }
    };

    // Ajouter à l'historique
    this.logs.push(log);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Afficher en développement
    if (this.isDev) {
      this._consoleLog(log);
    }

    // Envoyer en production si configuré
    if (this.isProduction && this.enableRemote && level === 'ERROR' || level === 'CRITICAL') {
      this.sendToServer().catch(() => {});
    }
  }

  _consoleLog(log) {
    const style = this._getStyle(log.level);
    const prefix = `[${log.namespace}] ${log.timestamp}`;

    if (log.data) {
      console.log(`%c${prefix} ${log.message}`, style, log.data);
    } else {
      console.log(`%c${prefix} ${log.message}`, style);
    }

    if (log.meta && Object.keys(log.meta).length > 0) {
      console.log('Meta:', log.meta);
    }
  }

  _getStyle(level) {
    const styles = {
      DEBUG: 'color: #7c3aed; font-weight: bold;',
      INFO: 'color: #0ea5e9; font-weight: bold;',
      WARN: 'color: #f59e0b; font-weight: bold;',
      ERROR: 'color: #ef4444; font-weight: bold;',
      CRITICAL: 'color: #7f1d1d; background: #fee2e2; font-weight: bold;'
    };
    return styles[level] || 'color: #6b7280;';
  }
}

// Instance globale du Logger
export const logger = new Logger({
  isDev: !window.location.hostname.includes('xn--primap'),
  logLevel: 'info',
  namespace: 'PériMap'
});

// Exporter aussi une fonction de log globale pour compatibilité
export function log(message, data = null) {
  logger.info(message, data);
}

// Intercepter les erreurs globales
window.addEventListener('error', (event) => {
  logger.error('Uncaught Error', event.error, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled Promise Rejection', event.reason, {
    promise: event.promise
  });
});

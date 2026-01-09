/**
 * Vitest Configuration - Tests Périmap
 * 
 * Framework de tests moderne et rapide
 * Compatible avec l'écosystème Vite
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Environnement de test (jsdom pour simuler le navigateur)
    environment: 'jsdom',
    
    // Dossier des tests
    include: ['tests/**/*.test.js', 'tests/**/*.spec.js'],
    
    // Fichiers à exclure
    exclude: ['node_modules', 'dist', 'public/data'],
    
    // Timeout par test
    testTimeout: 10000,
    
    // Reporter
    reporters: ['verbose'],
    
    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['public/js/**/*.js'],
      exclude: [
        'public/js/workers/**',
        'public/js/**/*.min.js',
        'node_modules/**'
      ],
      // Seuils minimums
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50
      }
    },
    
    // Setup global avant les tests
    setupFiles: ['./tests/setup.js'],
    
    // Globals (describe, it, expect disponibles sans import)
    globals: true,
    
    // Mode watch par défaut en dev
    watch: false
  }
});

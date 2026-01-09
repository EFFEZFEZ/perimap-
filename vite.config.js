/**
 * Vite Configuration - Périmap
 * 
 * Optimisations activées:
 * - Minification CSS/JS avec Terser
 * - Code splitting automatique
 * - Compression des assets
 * - Cache busting
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Dossier source = public (pour garder la compatibilité)
  root: 'public',
  
  // Dossier de sortie pour le build
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    
    // Minification aggressive
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Garder console.log en dev
        drop_debugger: true,
        pure_funcs: ['console.debug']
      },
      format: {
        comments: false
      }
    },
    
    // Code splitting pour optimiser le chargement
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html'),
        horaires: resolve(__dirname, 'public/horaires.html'),
        horaireA: resolve(__dirname, 'public/horaires-ligne-a.html'),
        horaireB: resolve(__dirname, 'public/horaires-ligne-b.html'),
        horaireC: resolve(__dirname, 'public/horaires-ligne-c.html'),
        horaireD: resolve(__dirname, 'public/horaires-ligne-d.html'),
        carte: resolve(__dirname, 'public/carte.html'),
        itineraire: resolve(__dirname, 'public/itineraire.html'),
        trafic: resolve(__dirname, 'public/trafic.html'),
        about: resolve(__dirname, 'public/about.html'),
        mentions: resolve(__dirname, 'public/mentions-legales.html')
      },
      output: {
        // Nommage avec hash pour cache busting
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const ext = assetInfo.name.split('.').pop();
          if (ext === 'css') return 'css/[name]-[hash].css';
          if (/png|jpe?g|svg|gif|webp|ico/.test(ext)) return 'icons/[name]-[hash].[ext]';
          return 'assets/[name]-[hash].[ext]';
        },
        
        // Code splitting automatique par Vite (manualChunks désactivé pour compatibilité)
        // Les fichiers JS actuels utilisent des scripts non-modules
        // Vite va optimiser automatiquement quand on passera aux ES modules
        manualChunks: undefined
      }
    },
    
    // Seuil d'alerte pour les gros fichiers
    chunkSizeWarningLimit: 500,
    
    // Génère un rapport de build
    reportCompressedSize: true,
    
    // Source maps pour debug en prod
    sourcemap: false
  },
  
  // Server de développement
  server: {
    port: 3000,
    open: true,
    // Proxy vers les API Vercel en dev
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  
  // Optimisations
  optimizeDeps: {
    include: [],
    exclude: ['leaflet', 'leaflet.markercluster']
  },
  
  // CSS
  css: {
    devSourcemap: true
  },
  
  // Variables d'environnement
  define: {
    __APP_VERSION__: JSON.stringify('2.1.0'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString())
  }
});

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
import { cpSync, existsSync, copyFileSync, readdirSync } from 'fs';

// Plugin pour copier les dossiers et fichiers statiques après le build
function copyStaticFolders() {
  return {
    name: 'copy-static-folders',
    closeBundle() {
      // Copier les dossiers
      const folders = ['views', 'data', 'icons', 'css', 'js'];
      folders.forEach(folder => {
        const src = resolve(__dirname, 'public', folder);
        const dest = resolve(__dirname, 'dist', folder);
        if (existsSync(src)) {
          cpSync(src, dest, { recursive: true });
          console.log(`✓ Copié: ${folder}/`);
        }
      });
      
      // Copier les fichiers individuels à la racine
      // Ajouter ici tous les fichiers racine nécessaires à la prod
      const rootFiles = [
        'service-worker.js',
        'manifest.json',
        'robots.txt',
        'sitemap.xml',
        'google66fb00a1cc526ca0.html',
        'style.modules.css',
        'og-generator.html',
        'browserconfig.xml'
      ];
      rootFiles.forEach(file => {
        const src = resolve(__dirname, 'public', file);
        const dest = resolve(__dirname, 'dist', file);
        if (existsSync(src)) {
          copyFileSync(src, dest);
          console.log(`✓ Copié: ${file}`);
        }
      });
    }
  };
}

export default defineConfig({
  // Plugin pour copier views/, data/, icons/, css/ et fichiers racine après le build
  plugins: [copyStaticFolders()],
  
  // Dossier source = public (pour garder la compatibilité)
  root: 'public',
  
  // Copier les assets statiques (views, data, icons, etc.)
  publicDir: false, // Désactivé car root = public déjà
  
  // Dossier de sortie pour le build
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    
    // IMPORTANT: Copier tous les fichiers statiques non-traités par Vite
    copyPublicDir: true,
    assetsInlineLimit: 0, // Ne pas inliner les assets
    
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
        carte: resolve(__dirname, 'public/carte.html'),
        itineraire: resolve(__dirname, 'public/itineraire.html'),
        trafic: resolve(__dirname, 'public/trafic.html'),
        about: resolve(__dirname, 'public/about.html'),
        mentions: resolve(__dirname, 'public/mentions-legales.html'),
        ...Object.fromEntries(
          readdirSync(resolve(__dirname, 'public'))
            .filter((name) => name.startsWith('horaires-ligne-') && name.endsWith('.html'))
            .map((name) => [
              name.replace(/\.html$/i, ''),
              resolve(__dirname, 'public', name)
            ])
        )
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
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __NEON_API_KEY__: JSON.stringify(process.env.NEON_API_KEY || '')
  }
});

/**
 * Script de Reset Complet - Cache, LocalStorage, IndexedDB, Service Worker
 * À exécuter dans la console du navigateur pour nettoyer complètement
 */

(async function resetEverything() {
  console.log('🔄 Début du reset complet...');

  // 1. Effacer tout le localStorage
  console.log('🗑️ Suppression du localStorage...');
  localStorage.clear();
  sessionStorage.clear();

  // 2. Effacer tous les caches (Service Worker)
  console.log('🗑️ Suppression des caches Service Worker...');
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      await caches.delete(cacheName);
      console.log(`   ✓ Cache supprimé: ${cacheName}`);
    }
  }

  // 3. Effacer IndexedDB
  console.log('🗑️ Suppression d\'IndexedDB...');
  const dbs = await indexedDB.databases?.() || [];
  for (const db of dbs) {
    indexedDB.deleteDatabase(db.name);
    console.log(`   ✓ IndexedDB supprimée: ${db.name}`);
  }

  // 4. Désenregistrer tous les Service Workers
  console.log('🗑️ Désenregistrement des Service Workers...');
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      console.log('   ✓ Service Worker désenregistré');
    }
  }

  // 5. Nettoyer les cookies (note: limité par le navigateur)
  console.log('🗑️ Nettoyage des cookies...');
  document.cookie.split(';').forEach(c => {
    const eqPos = c.indexOf('=');
    const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
    if (name) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
    }
  });

  console.log('✅ Reset complet terminé!');
  console.log('🔄 Rechargement de la page dans 3 secondes...');
  setTimeout(() => window.location.reload(), 3000);
})();

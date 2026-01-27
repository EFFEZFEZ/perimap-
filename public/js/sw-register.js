// Enregistrement minimal du Service Worker pour toutes les pages statiques
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/service-worker.js')
      .then(function(reg) {
        console.log('[SW] Enregistré globalement', reg.scope);
      })
      .catch(function(err) {
        console.warn('[SW] Échec enregistrement', err);
      });
  });
}

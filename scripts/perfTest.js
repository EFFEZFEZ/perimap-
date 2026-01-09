/**
 * perfTest.js - Test rapide d'impact perf du système analytics
 * À exécuter en console (F12) sur le site public
 * 
 * Résultat:
 * - < 100ms: Ok garder version 1
 * - > 500ms: Basculer à version 2 (API externe)
 */

window.analyticsPerfTest = async function() {
    console.clear();
    console.log('🔍 Test d\'impact perf Analytics...\n');

    const results = {};

    // 1. Test initialisation DataExporter
    console.time('DataExporter init');
    try {
        if (window.dataExporterUI) {
            // Vérifier si déjà initialisé
            results.dataExporterReady = true;
        } else {
            results.dataExporterReady = false;
        }
    } catch(e) {
        results.dataExporterError = e.message;
    }
    console.timeEnd('DataExporter init');

    // 2. Test accès au localStorage
    console.time('localStorage access');
    try {
        const stats = JSON.parse(localStorage.getItem('delayStats') || '{}');
        results.storageSize = new Blob([JSON.stringify(stats)]).size;
    } catch(e) {
        results.storageError = e.message;
    }
    console.timeEnd('localStorage access');

    // 3. Test calcul stats
    console.time('Stats compilation');
    try {
        if (window.DataExporter) {
            const delays = window.DataExporter.getDelayStats();
            const stops = window.DataExporter.getStopStats();
            results.statsReady = true;
            results.delayObservations = delays?.totalObservations || 0;
            results.topStops = stops?.length || 0;
        }
    } catch(e) {
        results.statsError = e.message;
    }
    console.timeEnd('Stats compilation');

    // 4. Test export JSON
    console.time('JSON export');
    try {
        const data = window.DataExporter?.exportAllJSON?.toString();
        results.exportReady = !!data;
    } catch(e) {
        results.exportError = e.message;
    }
    console.timeEnd('JSON export');

    // 5. Mesure globale (depuis navigation)
    const perfData = performance.getEntriesByType('navigation')[0];
    if (perfData) {
        results.pageLoadTime = perfData.loadEventEnd - perfData.fetchStart;
        results.contentfulPaint = performance.getEntriesByName('first-contentful-paint')[0];
    }

    // Rapport
    console.log('\n✅ RÉSULTATS:\n');
    console.table(results);

    // Analyse
    console.log('\n📊 ANALYSE:');
    if (results.pageLoadTime) {
        if (results.pageLoadTime < 3000) {
            console.log('✅ Page charge rapidement (< 3s)');
        } else {
            console.warn('⚠️ Page charge lentement (> 3s)');
        }
    }

    if (results.storageSize > 5242880) { // 5MB
        console.warn('⚠️ localStorage trop volumineux (> 5MB)');
    } else {
        console.log(`✅ Storage ok (${(results.storageSize/1024).toFixed(0)}KB)`);
    }

    // Verdict
    console.log('\n🎯 VERDICT:\n');
    const hasIssues = results.pageLoadTime > 4000 || results.storageSize > 5242880;
    
    if (hasIssues) {
        console.error('❌ VERSION 2 RECOMMANDÉE (API externe)');
        console.log('   → Réduire le site principal');
        console.log('   → Créer dashboard séparé');
    } else {
        console.log('✅ VERSION 1 OK (garder système intégré)');
        console.log('   → Admin-only');
        console.log('   → Impact minimal');
    }

    return results;
};

// À exécuter:
console.log('Exécutez: analyticsPerfTest()');

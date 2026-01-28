/**
 * 🧪 SCRIPT D'INJECTION DE TRAJETS DE TEST
 * 
 * Copiez-collez ce script dans la console du navigateur (F12)
 * sur http://localhost:3000
 * 
 * Il injectera 3 trajets de test dans le localStorage
 */

(function() {
    const STORAGE_KEY = 'perimap_journeys_v3';
    const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours
    const now = Date.now();

    const testJourneys = [
        {
            key: 'gare de perpignan|aéroport perpignan rivesaltes',
            fromName: 'Gare de Perpignan',
            toName: 'Aéroport Perpignan Rivesaltes',
            departureTime: 'Maintenant',
            summary: {
                type: 'BUS',
                duration: '45 min',
                segments: [
                    { name: 'R4', color: '#FF6B35', textColor: '#FFFFFF' },
                    { name: 'A', color: '#0066CC', textColor: '#FFFFFF' }
                ],
                hasWalk: true
            },
            fullItinerary: null,
            searchTime: null,
            savedAt: now,
            expiresAt: now + TTL_MS,
            accessCount: 1
        },
        {
            key: 'république|clinique saint pierre',
            fromName: 'République',
            toName: 'Clinique Saint Pierre',
            departureTime: 'Maintenant',
            summary: {
                type: 'BUS',
                duration: '22 min',
                segments: [
                    { name: 'B', color: '#E91E63', textColor: '#FFFFFF' }
                ],
                hasWalk: false
            },
            fullItinerary: null,
            searchTime: null,
            savedAt: now - 3600000, // 1h avant
            expiresAt: now + TTL_MS,
            accessCount: 3
        },
        {
            key: 'castillet|université',
            fromName: 'Castillet',
            toName: 'Université',
            departureTime: 'Maintenant',
            summary: {
                type: 'BUS',
                duration: '18 min',
                segments: [
                    { name: 'C', color: '#4CAF50', textColor: '#FFFFFF' }
                ],
                hasWalk: true
            },
            fullItinerary: null,
            searchTime: null,
            savedAt: now - 7200000, // 2h avant
            expiresAt: now + TTL_MS,
            accessCount: 5
        }
    ];

    // Injection dans le localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(testJourneys));
    
    console.log('%c✅ 3 TRAJETS DE TEST INJECTÉS !', 'background: #10b981; color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold; font-size: 14px;');
    console.log('📦 Trajets sauvegardés:', testJourneys);
    console.log('');
    console.log('📍 Maintenant, allez dans l\'onglet TRAJETS pour les voir s\'afficher !');
    console.log('');
    console.log('🔄 Pour forcer le rendu, tapez: renderRecentJourneys()');
    
    return testJourneys;
})();

/**
 * 🧪 SCRIPT D'INJECTION DE TRAJETS COMPLETS (CLIQUABLES)
 * 
 * Copiez-collez ce script dans la console pour tester les trajets récents
 * avec des itinéraires complets et cliquables
 */

(function() {
    const STORAGE_KEY = 'perimap_journeys_v3';
    const TTL_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Créer des itinéraires complets et réalistes
    const mockItinerary1 = {
        type: 'BUS',
        departureTime: '14:30',
        arrivalTime: '15:15',
        duration: '45 min',
        durationRaw: 2700,
        steps: [
            {
                type: 'BUS',
                routeShortName: 'R4',
                routeColor: '#FF6B35',
                routeTextColor: '#FFFFFF',
                departureStop: 'Gare de Perpignan',
                arrivalStop: 'Place République',
                departureTime: '14:30',
                arrivalTime: '14:50',
                duration: '20 min',
                numStops: 8
            },
            {
                type: 'WAIT',
                duration: '5 min',
                departureTime: '14:50',
                arrivalTime: '14:55'
            },
            {
                type: 'BUS',
                routeShortName: 'A',
                routeColor: '#0066CC',
                routeTextColor: '#FFFFFF',
                departureStop: 'Place République',
                arrivalStop: 'Aéroport Perpignan',
                departureTime: '14:55',
                arrivalTime: '15:15',
                duration: '20 min',
                numStops: 5
            }
        ],
        summarySegments: [
            { name: 'R4', color: '#FF6B35', textColor: '#FFFFFF' },
            { name: 'A', color: '#0066CC', textColor: '#FFFFFF' }
        ]
    };

    const mockItinerary2 = {
        type: 'BUS',
        departureTime: '10:15',
        arrivalTime: '10:37',
        duration: '22 min',
        durationRaw: 1320,
        steps: [
            {
                type: 'BUS',
                routeShortName: 'B',
                routeColor: '#E91E63',
                routeTextColor: '#FFFFFF',
                departureStop: 'République',
                arrivalStop: 'Clinique Saint Pierre',
                departureTime: '10:15',
                arrivalTime: '10:37',
                duration: '22 min',
                numStops: 12
            }
        ],
        summarySegments: [
            { name: 'B', color: '#E91E63', textColor: '#FFFFFF' }
        ]
    };

    const mockItinerary3 = {
        type: 'BUS',
        departureTime: '16:00',
        arrivalTime: '16:18',
        duration: '18 min',
        durationRaw: 1080,
        steps: [
            {
                type: 'BUS',
                routeShortName: 'C',
                routeColor: '#4CAF50',
                routeTextColor: '#FFFFFF',
                departureStop: 'Castillet',
                arrivalStop: 'Université',
                departureTime: '16:00',
                arrivalTime: '16:18',
                duration: '18 min',
                numStops: 10
            }
        ],
        summarySegments: [
            { name: 'C', color: '#4CAF50', textColor: '#FFFFFF' }
        ]
    };

    const testJourneys = [
        {
            key: 'gare de perpignan|aéroport perpignan rivesaltes',
            fromName: 'Gare de Perpignan',
            toName: 'Aéroport Perpignan Rivesaltes',
            departureTime: '14:30',
            summary: {
                type: 'BUS',
                duration: '45 min',
                segments: [
                    { name: 'R4', color: '#FF6B35', textColor: '#FFFFFF' },
                    { name: 'A', color: '#0066CC', textColor: '#FFFFFF' }
                ],
                hasWalk: true
            },
            fullItinerary: [mockItinerary1], // ✅ Itinéraire complet
            searchTime: {
                type: 'partir',
                date: new Date().toISOString().split('T')[0],
                hour: '14',
                minute: '30'
            },
            savedAt: now,
            expiresAt: now + TTL_MS,
            accessCount: 1
        },
        {
            key: 'république|clinique saint pierre',
            fromName: 'République',
            toName: 'Clinique Saint Pierre',
            departureTime: '10:15',
            summary: {
                type: 'BUS',
                duration: '22 min',
                segments: [{ name: 'B', color: '#E91E63', textColor: '#FFFFFF' }],
                hasWalk: false
            },
            fullItinerary: [mockItinerary2], // ✅ Itinéraire complet
            searchTime: {
                type: 'partir',
                date: new Date().toISOString().split('T')[0],
                hour: '10',
                minute: '15'
            },
            savedAt: now - 3600000,
            expiresAt: now + TTL_MS,
            accessCount: 3
        },
        {
            key: 'castillet|université',
            fromName: 'Castillet',
            toName: 'Université',
            departureTime: '16:00',
            summary: {
                type: 'BUS',
                duration: '18 min',
                segments: [{ name: 'C', color: '#4CAF50', textColor: '#FFFFFF' }],
                hasWalk: true
            },
            fullItinerary: [mockItinerary3], // ✅ Itinéraire complet
            searchTime: {
                type: 'partir',
                date: new Date().toISOString().split('T')[0],
                hour: '16',
                minute: '00'
            },
            savedAt: now - 7200000,
            expiresAt: now + TTL_MS,
            accessCount: 5
        }
    ];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(testJourneys));
    
    console.log('%c✅ 3 TRAJETS COMPLETS INJECTÉS !', 'background: #10b981; color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold;');
    console.log('%c🎯 Ces trajets sont maintenant CLIQUABLES', 'background: #0066cc; color: white; padding: 4px 8px; border-radius: 4px;');
    console.log('📦 Trajets avec itinéraires complets:', testJourneys);
    
    // Forcer le rendu
    if (typeof renderRecentJourneys === 'function') {
        renderRecentJourneys();
        console.log('✅ Rendu appelé - Allez dans l\'onglet TRAJETS !');
    }
    
    return testJourneys;
})();

/**
 * mockRoutes.js - Données fictives d'itinéraires pour tester le rendu
 * 
 * Utilisation:
 * import { getMockRoute, injectMockRoute } from './mocks/mockRoutes.js';
 * 
 * // Dans la console du navigateur:
 * window.testRoute()    // Affiche un itinéraire de test
 */

/**
 * Itinéraire de test 1: Gare SNCF → Centre-Ville (Bus A)
 */
export const MOCK_ROUTE_1 = {
  mode: 'bus',
  result: {
    routes: [
      {
        summary: 'Gare SNCF → Centre-Ville',
        legs: [
          {
            start_location: { lat: 45.1892, lng: 0.7234 },
            end_location: { lat: 45.1856, lng: 0.7265 },
            distance: { value: 1245, text: '1,2 km' },
            duration: { value: 420, text: '7 min' },
            steps: [
              {
                travel_mode: 'WALKING',
                distance: { value: 85, text: '85 m' },
                duration: { value: 60, text: '1 min' },
                instructions: 'Marche vers l\'arrêt Gare',
                polyline: { points: 'o_|gHwzh@Bv@?L' },
                start_location: { lat: 45.1892, lng: 0.7234 },
                end_location: { lat: 45.1898, lng: 0.7240 }
              },
              {
                travel_mode: 'TRANSIT',
                distance: { value: 1160, text: '1,2 km' },
                duration: { value: 300, text: '5 min' },
                instructions: 'Prendre le bus A vers Centre-Ville',
                transit_details: {
                  arrival_stop: { name: 'Centre-Ville' },
                  departure_stop: { name: 'Gare' },
                  arrival_time: { text: '14:35', value: 1475 },
                  departure_time: { text: '14:30', value: 1470 },
                  headsign: 'Centre-Ville',
                  headway: 900,
                  line: {
                    agencies: [{ name: 'Péribus' }],
                    name: 'Ligne A',
                    short_name: 'A',
                    color: '#2563eb',
                    text_color: '#ffffff',
                    url: 'https://perimouv.fr'
                  },
                  num_stops: 12
                },
                polyline: { points: 'o_|gHwzh@BpANtB\\nCh@pDv@rEj@xCl@zCTv@' },
                start_location: { lat: 45.1898, lng: 0.7240 },
                end_location: { lat: 45.1856, lng: 0.7265 }
              },
              {
                travel_mode: 'WALKING',
                distance: { value: 0, text: '0 m' },
                duration: { value: 0, text: '0 min' },
                instructions: 'Vous êtes arrivé',
                polyline: { points: 'o_|gHwzh@' },
                start_location: { lat: 45.1856, lng: 0.7265 },
                end_location: { lat: 45.1856, lng: 0.7265 }
              }
            ]
          }
        ],
        overview_polyline: { points: 'o_|gHwzh@BpANtB\\nCh@pDv@rEj@xCl@zCTv@' },
        warnings: [],
        fare: { currency: 'EUR', value: 2.5, text: '2,50 €' }
      }
    ],
    status: 'OK'
  }
};

/**
 * Itinéraire de test 2: Taillefer → Boulazac (Correspondance bus + marche)
 */
export const MOCK_ROUTE_2 = {
  mode: 'bus',
  result: {
    routes: [
      {
        summary: 'Taillefer → Boulazac',
        legs: [
          {
            start_location: { lat: 45.1756, lng: 0.7234 },
            end_location: { lat: 45.1650, lng: 0.7389 },
            distance: { value: 2840, text: '2,8 km' },
            duration: { value: 1260, text: '21 min' },
            steps: [
              {
                travel_mode: 'WALKING',
                distance: { value: 150, text: '150 m' },
                duration: { value: 120, text: '2 min' },
                instructions: 'Marche vers Arrêt Taillefer',
                polyline: { points: '_k|gH{rh@Rj@Nf@' },
                start_location: { lat: 45.1756, lng: 0.7234 },
                end_location: { lat: 45.1745, lng: 0.7250 }
              },
              {
                travel_mode: 'TRANSIT',
                distance: { value: 1200, text: '1,2 km' },
                duration: { value: 480, text: '8 min' },
                instructions: 'Prendre le bus E5 vers PEM',
                transit_details: {
                  arrival_stop: { name: 'PEM' },
                  departure_stop: { name: 'Taillefer' },
                  arrival_time: { text: '14:45', value: 1485 },
                  departure_time: { text: '14:37', value: 1477 },
                  headsign: 'PEM',
                  headway: 600,
                  line: {
                    agencies: [{ name: 'Péribus' }],
                    name: 'Ligne E5',
                    short_name: 'E5',
                    color: '#dc2626',
                    text_color: '#ffffff',
                    url: 'https://perimouv.fr'
                  },
                  num_stops: 8
                },
                polyline: { points: '_k|gHwrh@f@xA\\r@Rj@l@tB' },
                start_location: { lat: 45.1745, lng: 0.7250 },
                end_location: { lat: 45.1720, lng: 0.7310 }
              },
              {
                travel_mode: 'WALKING',
                distance: { value: 300, text: '300 m' },
                duration: { value: 240, text: '4 min' },
                instructions: 'Marche vers Arrêt Boulazac',
                polyline: { points: 'im|gH}sh@NXRZPVRZTb@Zf@' },
                start_location: { lat: 45.1720, lng: 0.7310 },
                end_location: { lat: 45.1700, lng: 0.7330 }
              },
              {
                travel_mode: 'TRANSIT',
                distance: { value: 1400, text: '1,4 km' },
                duration: { value: 420, text: '7 min' },
                instructions: 'Prendre le bus K4A vers Boulazac',
                transit_details: {
                  arrival_stop: { name: 'Boulazac CC' },
                  departure_stop: { name: 'Boulazac' },
                  arrival_time: { text: '14:57', value: 1497 },
                  departure_time: { text: '14:50', value: 1490 },
                  headsign: 'Boulazac',
                  headway: 1200,
                  line: {
                    agencies: [{ name: 'Péribus' }],
                    name: 'Ligne K4A',
                    short_name: 'K4A',
                    color: '#059669',
                    text_color: '#ffffff',
                    url: 'https://perimouv.fr'
                  },
                  num_stops: 6
                },
                polyline: { points: 'gk|gH}uh@^|@j@xB\\|@' },
                start_location: { lat: 45.1700, lng: 0.7330 },
                end_location: { lat: 45.1650, lng: 0.7389 }
              }
            ]
          }
        ],
        overview_polyline: { points: '_k|gH{rh@Rj@Nf@f@xA\\r@Rj@l@tB' },
        warnings: [],
        fare: { currency: 'EUR', value: 3.5, text: '3,50 €' }
      }
    ],
    status: 'OK'
  }
};

/**
 * Itinéraire de test 3: Maurois → Gare (Marche seule)
 */
export const MOCK_ROUTE_3 = {
  mode: 'bus',
  result: {
    routes: [
      {
        summary: 'Maurois → Gare',
        legs: [
          {
            start_location: { lat: 45.1820, lng: 0.7180 },
            end_location: { lat: 45.1892, lng: 0.7234 },
            distance: { value: 950, text: '950 m' },
            duration: { value: 720, text: '12 min' },
            steps: [
              {
                travel_mode: 'WALKING',
                distance: { value: 950, text: '950 m' },
                duration: { value: 720, text: '12 min' },
                instructions: 'Marche vers Gare SNCF',
                polyline: { points: 'ok|gHwoh@Vb@Nd@Jf@HZv@xBl@hB' },
                start_location: { lat: 45.1820, lng: 0.7180 },
                end_location: { lat: 45.1892, lng: 0.7234 }
              }
            ]
          }
        ],
        overview_polyline: { points: 'ok|gHwoh@Vb@Nd@Jf@HZv@xBl@hB' },
        warnings: ['This route does not have any transit segments'],
        fare: null
      }
    ],
    status: 'OK'
  }
};

/**
 * Retourne un itinéraire fictif
 */
export function getMockRoute(index = 1) {
  const routes = {
    1: MOCK_ROUTE_1,
    2: MOCK_ROUTE_2,
    3: MOCK_ROUTE_3
  };
  return routes[index] || MOCK_ROUTE_1;
}

/**
 * Injecte un itinéraire de test dans l'état et émet l'événement
 */
export function injectMockRoute(eventBus, index = 1) {
  const mockRoute = getMockRoute(index);
  
  if (!eventBus) {
    console.error('[Mock] EventBus non disponible');
    return;
  }

  console.log(`[Mock] Injection itinéraire ${index}...`);
  
  // Émettre l'événement ROUTE_CALCULATED pour déclencher le rendu
  eventBus.emit('route:calculated', {
    mode: mockRoute.mode,
    result: mockRoute.result
  });

  console.log(`[Mock] ✅ Itinéraire ${index} injecté et affiché`);
  return mockRoute;
}

/**
 * Raccourci console pour tester rapidement
 */
export function setupConsoleHelpers(eventBus) {
  window.testRoute = (index = 1) => {
    console.log(`\n🚌 Affichage itinéraire de test ${index}...\n`);
    const mockRoute = getMockRoute(index);
    
    // Remplir la liste des itinéraires (comme le ferait une vraie recherche)
    if (window.allFetchedItineraries !== undefined) {
      window.allFetchedItineraries = [mockRoute.result.itineraries?.[0] || mockRoute.result].filter(Boolean);
      console.log('[Mock] ✅ allFetchedItineraries remplie avec', window.allFetchedItineraries.length, 'itinéraire(s)');
    }
    
    // Émettre l'événement pour déclencher les listeners
    injectMockRoute(eventBus, index);
    
    // Appeler le renderer si disponible
    if (window.resultsRenderer) {
      console.log('[Mock] 🎨 Rendu des résultats...');
      window.resultsRenderer.render('ALL');
    } else {
      console.warn('[Mock] ⚠️ resultsRenderer non disponible');
    }
    
    return mockRoute;
  };

  window.testAllRoutes = () => {
    console.log('\n🚌 Test des 3 itinéraires...\n');
    for (let i = 1; i <= 3; i++) {
      setTimeout(() => {
        console.log(`--- Itinéraire ${i} ---`);
        window.testRoute(i);
      }, i * 2000);
    }
  };

  console.log(`
╔═══════════════════════════════════════════╗
║      🚌 HELPERS MOCK ITINÉRAIRES          ║
╚═══════════════════════════════════════════╝

Utilisez dans la console du navigateur:

  window.testRoute(1)      // Test itinéraire 1 (Gare → Centre-Ville)
  window.testRoute(2)      // Test itinéraire 2 (Taillefer → Boulazac)
  window.testRoute(3)      // Test itinéraire 3 (Maurois → Gare)
  window.testAllRoutes()   // Test les 3 itinéraires (2s d'intervalle)

`);
}

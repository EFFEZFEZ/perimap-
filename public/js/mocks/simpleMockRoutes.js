/**
 * simpleMockRoutes.js - Trajets ultra-simples juste pour voir l'affichage
 */

function createItinerary(name, departure, arrival, duration, type = 'BUS') {
  const upperType = type.toUpperCase();
  const isWalk = upperType === 'WALK';

  return {
    id: `mock-${Date.now()}`,
    name: name,
    type: upperType,
    departureTime: departure,
    arrivalTime: arrival,
    duration: `${duration} min`,
    _durationSeconds: duration * 60,
    _departureSeconds: parseInt(departure.split(':')[0]) * 3600 + parseInt(departure.split(':')[1]) * 60,
    _arrivalSeconds: parseInt(arrival.split(':')[0]) * 3600 + parseInt(arrival.split(':')[1]) * 60,
    distance: `${Math.random() * 5 + 0.5} km`,
    legs: [],
    steps: isWalk ? [{ type: 'WALK', _isWalk: true, distance: '800 m', duration: `${duration} min` }] : [],
    summarySegments: isWalk ? [] : [{ name: 'Bus', color: '#2d7bff', textColor: '#ffffff' }],
    _isWalk: isWalk,
    polyline: { points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' }
  };
}

export function getSimpleMockRoute(index = 1) {
  const mocks = [
    {
      mode: 'bus',
      result: {
        itineraries: [
          createItinerary('Trajet 1 - Bus', '10:30', '10:37', 7, 'BUS')
        ]
      }
    },
    {
      mode: 'bus',
      result: {
        itineraries: [
          createItinerary('Trajet 2 - Bus Express', '11:00', '11:15', 15, 'BUS')
        ]
      }
    },
    {
      mode: 'walking',
      result: {
        itineraries: [
          createItinerary('Trajet 3 - À pied', '14:45', '14:57', 12, 'WALK')
        ]
      }
    }
  ];

  return mocks[Math.max(0, Math.min(index - 1, mocks.length - 1))];
}

function getAllSimpleMockItineraries() {
  const all = [1, 2, 3].map(getSimpleMockRoute).flatMap(r => r.result.itineraries);
  return all;
}

/**
 * Injecte et affiche un trajet
 */
export function injectSimpleMockRoute(eventBus, index = 1) {
  const mockRoute = getSimpleMockRoute(index);
  
  if (!eventBus) {
    console.error('[SimpleMock] EventBus non disponible');
    return;
  }

  console.log(`[SimpleMock] Injection trajet ${index}...`);
  
  try {
    // Remplir la liste (muter le tableau existant pour garder la référence)
    if (Array.isArray(window.allFetchedItineraries)) {
      window.allFetchedItineraries.splice(0, window.allFetchedItineraries.length, ...mockRoute.result.itineraries);
      console.log('[SimpleMock] ✅ allFetchedItineraries remplie:', window.allFetchedItineraries.length, 'itinéraire(s)');
    } else {
      window.allFetchedItineraries = mockRoute.result.itineraries;
      console.warn('[SimpleMock] ⚠️ allFetchedItineraries recréé (référence manquante)');
    }
    
    // Afficher la vue résultats
    if (window.showResultsView) {
      console.log('[SimpleMock] 📍 Navigation vers vue résultats...');
      window.showResultsView();
    }
    
    // Configurer les onglets si disponible
    if (window.setupResultTabs) {
      window.setupResultTabs(mockRoute.result.itineraries);
    }
    
    // Appeler le renderer
    setTimeout(() => {
      if (window.resultsRenderer) {
        console.log('[SimpleMock] 🎨 Appel renderer...');
        window.resultsRenderer.render('ALL');
        console.log('[SimpleMock] ✅ Rendu complété');
      } else {
        console.warn('[SimpleMock] ⚠️ resultsRenderer pas disponible');
      }
    }, 100);
    
    // Émettre l'événement aussi
    eventBus.emit('route:calculated', {
      mode: mockRoute.mode,
      result: mockRoute.result
    });

  } catch (error) {
    console.error('[SimpleMock] ❌ Erreur:', error);
  }

  return mockRoute;
}

export function injectAllSimpleMockRoutes(eventBus) {
  if (!eventBus) {
    console.error('[SimpleMock] EventBus non disponible');
    return;
  }

  console.log('[SimpleMock] Injection des 3 trajets en une fois...');
  const itineraries = getAllSimpleMockItineraries();

  try {
    if (Array.isArray(window.allFetchedItineraries)) {
      window.allFetchedItineraries.splice(0, window.allFetchedItineraries.length, ...itineraries);
      console.log('[SimpleMock] ✅ allFetchedItineraries remplie:', window.allFetchedItineraries.length, 'itinéraires');
    } else {
      window.allFetchedItineraries = itineraries;
      console.warn('[SimpleMock] ⚠️ allFetchedItineraries recréé (référence manquante)');
    }

    if (window.showResultsView) {
      console.log('[SimpleMock] 📍 Navigation vers vue résultats...');
      window.showResultsView();
    }

    if (window.setupResultTabs) {
      window.setupResultTabs(window.allFetchedItineraries);
    }

    setTimeout(() => {
      if (window.resultsRenderer) {
        console.log('[SimpleMock] 🎨 Appel renderer (3 trajets)...');
        window.resultsRenderer.render('ALL');
        console.log('[SimpleMock] ✅ Rendu complété (3 trajets)');
      }
    }, 80);

    eventBus.emit('route:calculated', {
      mode: 'bus',
      result: { itineraries }
    });
  } catch (error) {
    console.error('[SimpleMock] ❌ Erreur:', error);
  }
}

/**
 * Helpers console
 */
export function setupSimpleConsoleHelpers(eventBus) {
  window.simpleTest = (index = 1) => {
    console.log(`\n🚗 Test trajet simple ${index}\n`);
    injectSimpleMockRoute(eventBus, index);
  };
  
  window.simpleTestAll = () => {
    console.log('\n🚗 Test les 3 trajets (ensemble)\n');
    injectAllSimpleMockRoutes(eventBus);
  };

  console.log(`
╔═══════════════════════════════════════════╗
║   🚗 SIMPLE MOCK TRAJETS - TEST RENDU     ║
╚═══════════════════════════════════════════╝

Utilisez:
  window.simpleTest(1)    // Trajet 1
  window.simpleTest(2)    // Trajet 2
  window.simpleTest(3)    // Trajet 3
  window.simpleTestAll()  // Les 3 trajets
`);
}

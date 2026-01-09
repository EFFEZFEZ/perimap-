/**
 * Setup global pour les tests Vitest
 * Configure l'environnement de test
 */

import { vi, beforeEach, afterEach } from 'vitest';

// Mock du localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
global.localStorage = localStorageMock;

// Mock du sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
global.sessionStorage = sessionStorageMock;

// Mock de fetch
global.fetch = vi.fn();

// Mock de console.debug (pour éviter le bruit)
console.debug = vi.fn();

// Mock de Leaflet (bibliothèque externe)
global.L = {
  map: vi.fn(() => ({
    setView: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    addLayer: vi.fn().mockReturnThis(),
    removeLayer: vi.fn().mockReturnThis(),
    fitBounds: vi.fn().mockReturnThis(),
    getZoom: vi.fn(() => 15),
    getCenter: vi.fn(() => ({ lat: 45.1833, lng: 0.7167 }))
  })),
  tileLayer: vi.fn(() => ({
    addTo: vi.fn().mockReturnThis()
  })),
  marker: vi.fn(() => ({
    addTo: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    setLatLng: vi.fn().mockReturnThis(),
    setIcon: vi.fn().mockReturnThis(),
    remove: vi.fn()
  })),
  popup: vi.fn(() => ({
    setLatLng: vi.fn().mockReturnThis(),
    setContent: vi.fn().mockReturnThis(),
    openOn: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis()
  })),
  layerGroup: vi.fn(() => ({
    addTo: vi.fn().mockReturnThis(),
    addLayer: vi.fn().mockReturnThis(),
    removeLayer: vi.fn().mockReturnThis(),
    clearLayers: vi.fn().mockReturnThis()
  })),
  polyline: vi.fn(() => ({
    addTo: vi.fn().mockReturnThis()
  })),
  divIcon: vi.fn(() => ({})),
  icon: vi.fn(() => ({})),
  markerClusterGroup: vi.fn(() => ({
    addLayer: vi.fn().mockReturnThis(),
    removeLayer: vi.fn().mockReturnThis(),
    clearLayers: vi.fn().mockReturnThis()
  })),
  control: {
    zoom: vi.fn(() => ({
      addTo: vi.fn()
    }))
  },
  DomEvent: {
    stopPropagation: vi.fn()
  },
  latLngBounds: vi.fn(() => ({
    extend: vi.fn().mockReturnThis(),
    isValid: vi.fn(() => true)
  }))
};

// Reset des mocks avant chaque test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.getItem.mockReturnValue(null);
});

// Cleanup après chaque test
afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Tests unitaires - Utilitaires géographiques
 * 
 * Teste les calculs de distance et coordonnées
 */

import { describe, it, expect } from 'vitest';

describe('Geo - Calculs de distance', () => {
  describe('haversineDistance', () => {
    it('devrait calculer la distance entre deux points proches (~1km)', () => {
      // Périgueux centre vers Gare
      const lat1 = 45.1833, lng1 = 0.7167;
      const lat2 = 45.1871, lng2 = 0.7203;
      
      const distance = haversineDistance(lat1, lng1, lat2, lng2);
      
      // Distance attendue ~500m
      expect(distance).toBeGreaterThan(400);
      expect(distance).toBeLessThan(600);
    });

    it('devrait retourner 0 pour le même point', () => {
      const lat = 45.1833, lng = 0.7167;
      const distance = haversineDistance(lat, lng, lat, lng);
      expect(distance).toBe(0);
    });

    it('devrait gérer les coordonnées négatives', () => {
      // Test avec coordonnées ouest
      const distance = haversineDistance(45.0, -0.5, 45.0, 0.5);
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('isPointInRadius', () => {
    it('devrait retourner true si le point est dans le rayon', () => {
      const center = { lat: 45.1833, lng: 0.7167 };
      const point = { lat: 45.1840, lng: 0.7170 };
      const radius = 500; // 500m
      
      expect(isPointInRadius(point, center, radius)).toBe(true);
    });

    it('devrait retourner false si le point est hors du rayon', () => {
      const center = { lat: 45.1833, lng: 0.7167 };
      const point = { lat: 45.2000, lng: 0.7500 }; // ~3km
      const radius = 500;
      
      expect(isPointInRadius(point, center, radius)).toBe(false);
    });
  });

  describe('findNearestStop', () => {
    const stops = [
      { id: '1', name: 'Arrêt A', lat: 45.1835, lng: 0.7170 },
      { id: '2', name: 'Arrêt B', lat: 45.1850, lng: 0.7180 },
      { id: '3', name: 'Arrêt C', lat: 45.1900, lng: 0.7200 }
    ];

    it('devrait trouver l\'arrêt le plus proche', () => {
      const userPos = { lat: 45.1833, lng: 0.7167 };
      const nearest = findNearestStop(userPos, stops);
      
      expect(nearest).not.toBeNull();
      expect(nearest.id).toBe('1'); // Arrêt A est le plus proche
    });

    it('devrait retourner null si pas d\'arrêts', () => {
      const userPos = { lat: 45.1833, lng: 0.7167 };
      const nearest = findNearestStop(userPos, []);
      
      expect(nearest).toBeNull();
    });
  });
});

describe('Geo - Coordonnées', () => {
  describe('parseCoordinates', () => {
    it('devrait parser un objet {lat, lng}', () => {
      const input = { lat: 45.1833, lng: 0.7167 };
      const result = parseCoordinates(input);
      
      expect(result).toEqual({ lat: 45.1833, lng: 0.7167 });
    });

    it('devrait parser un tableau [lat, lng]', () => {
      const input = [45.1833, 0.7167];
      const result = parseCoordinates(input);
      
      expect(result).toEqual({ lat: 45.1833, lng: 0.7167 });
    });

    it('devrait parser une chaîne "lat,lng"', () => {
      const input = '45.1833,0.7167';
      const result = parseCoordinates(input);
      
      expect(result).toEqual({ lat: 45.1833, lng: 0.7167 });
    });

    it('devrait retourner null pour une entrée invalide', () => {
      expect(parseCoordinates(null)).toBeNull();
      expect(parseCoordinates('invalid')).toBeNull();
      expect(parseCoordinates({})).toBeNull();
    });
  });

  describe('isValidCoordinate', () => {
    it('devrait valider des coordonnées correctes', () => {
      expect(isValidCoordinate(45.1833, 0.7167)).toBe(true);
      expect(isValidCoordinate(-45.0, -122.0)).toBe(true);
    });

    it('devrait rejeter des latitudes hors limites', () => {
      expect(isValidCoordinate(91, 0)).toBe(false);
      expect(isValidCoordinate(-91, 0)).toBe(false);
    });

    it('devrait rejeter des longitudes hors limites', () => {
      expect(isValidCoordinate(0, 181)).toBe(false);
      expect(isValidCoordinate(0, -181)).toBe(false);
    });
  });
});

// ============================================
// Fonctions helper (à remplacer par les vraies)
// ============================================

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Rayon Terre en mètres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function isPointInRadius(point, center, radius) {
  const distance = haversineDistance(point.lat, point.lng, center.lat, center.lng);
  return distance <= radius;
}

function findNearestStop(userPos, stops) {
  if (!stops || stops.length === 0) return null;
  
  let nearest = null;
  let minDistance = Infinity;
  
  for (const stop of stops) {
    const dist = haversineDistance(userPos.lat, userPos.lng, stop.lat, stop.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = stop;
    }
  }
  
  return nearest;
}

function parseCoordinates(input) {
  if (!input) return null;
  
  // Objet {lat, lng}
  if (typeof input === 'object' && 'lat' in input && 'lng' in input) {
    return { lat: input.lat, lng: input.lng };
  }
  
  // Tableau [lat, lng]
  if (Array.isArray(input) && input.length >= 2) {
    return { lat: input[0], lng: input[1] };
  }
  
  // Chaîne "lat,lng"
  if (typeof input === 'string') {
    const parts = input.split(',');
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
  }
  
  return null;
}

function isValidCoordinate(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

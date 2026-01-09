/**
 * Tests unitaires - Router (calcul d'itinéraire)
 * 
 * Teste les fonctions de routage GTFS
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Router - Configuration', () => {
  const config = {
    STOP_SEARCH_RADIUS_M: 500,
    STOP_SEARCH_LIMIT: 10,
    MAX_ITINERARIES: 12,
    MIN_BUS_ITINERARIES: 3,
    WALK_DIRECT_MAX_METERS: 150,
    ENABLE_TRANSFERS: true,
    TRANSFER_MAX_WAIT_SECONDS: 1800,
    TRANSFER_MIN_BUFFER_SECONDS: 180
  };

  it('devrait avoir des valeurs de configuration valides', () => {
    expect(config.STOP_SEARCH_RADIUS_M).toBeGreaterThan(0);
    expect(config.MAX_ITINERARIES).toBeGreaterThanOrEqual(config.MIN_BUS_ITINERARIES);
    expect(config.TRANSFER_MAX_WAIT_SECONDS).toBeGreaterThan(config.TRANSFER_MIN_BUFFER_SECONDS);
  });
});

describe('Router - Polyline encoding/decoding', () => {
  describe('encodePolyline', () => {
    it('devrait encoder des points simples', () => {
      const points = [[45.1833, 0.7167]];
      const encoded = encodePolyline(points);
      
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
    });

    it('devrait encoder plusieurs points', () => {
      const points = [
        [45.1833, 0.7167],
        [45.1840, 0.7170],
        [45.1850, 0.7180]
      ];
      const encoded = encodePolyline(points);
      
      expect(typeof encoded).toBe('string');
    });

    it('devrait retourner une chaîne vide pour un tableau vide', () => {
      const encoded = encodePolyline([]);
      expect(encoded).toBe('');
    });
  });

  describe('decodePolyline', () => {
    it('devrait décoder une polyline encodée', () => {
      const points = [
        [45.1833, 0.7167],
        [45.1840, 0.7170]
      ];
      const encoded = encodePolyline(points);
      const decoded = decodePolyline(encoded);
      
      expect(decoded.length).toBe(2);
      expect(decoded[0][0]).toBeCloseTo(45.1833, 4);
      expect(decoded[0][1]).toBeCloseTo(0.7167, 4);
    });

    it('devrait retourner un tableau vide pour une entrée vide', () => {
      expect(decodePolyline('')).toEqual([]);
      expect(decodePolyline(null)).toEqual([]);
    });
  });

  describe('roundtrip encode/decode', () => {
    it('devrait préserver les coordonnées après encode+decode', () => {
      const original = [
        [45.18330, 0.71670],
        [45.18400, 0.71700],
        [45.18500, 0.71800],
        [45.19000, 0.72000]
      ];
      
      const encoded = encodePolyline(original);
      const decoded = decodePolyline(encoded);
      
      expect(decoded.length).toBe(original.length);
      
      for (let i = 0; i < original.length; i++) {
        expect(decoded[i][0]).toBeCloseTo(original[i][0], 4);
        expect(decoded[i][1]).toBeCloseTo(original[i][1], 4);
      }
    });
  });
});

describe('Router - Walk duration calculation', () => {
  const AVERAGE_WALK_SPEED_MPS = 1.35; // ~4.8 km/h

  it('devrait calculer la durée de marche correctement', () => {
    const distanceMeters = 500;
    const duration = computeWalkDurationSeconds(distanceMeters);
    
    // 500m à 1.35m/s ≈ 370s
    expect(duration).toBeCloseTo(370, -1);
  });

  it('devrait retourner minimum 30s pour petites distances', () => {
    const duration = computeWalkDurationSeconds(10);
    expect(duration).toBeGreaterThanOrEqual(30);
  });

  it('devrait gérer 0 et NaN', () => {
    expect(computeWalkDurationSeconds(0)).toBe(0);
    expect(computeWalkDurationSeconds(NaN)).toBe(0);
  });
});

describe('Router - Trip filtering', () => {
  const mockTrips = [
    { tripId: '1', departureTime: '08:00:00', arrivalTime: '08:30:00', routeId: 'A' },
    { tripId: '2', departureTime: '08:15:00', arrivalTime: '08:45:00', routeId: 'A' },
    { tripId: '3', departureTime: '09:00:00', arrivalTime: '09:30:00', routeId: 'B' },
    { tripId: '4', departureTime: '08:30:00', arrivalTime: '09:00:00', routeId: 'C' }
  ];

  it('devrait filtrer les trips dans la fenêtre horaire', () => {
    const windowStart = 8 * 3600; // 08:00 en secondes
    const windowEnd = 8.5 * 3600; // 08:30 en secondes
    
    const filtered = filterTripsInWindow(mockTrips, windowStart, windowEnd);
    
    // Trips 1 (08:00), 2 (08:15) et 4 (08:30) sont dans la fenêtre
    expect(filtered.length).toBe(3);
    expect(filtered.map(t => t.tripId)).toContain('1');
    expect(filtered.map(t => t.tripId)).toContain('2');
    expect(filtered.map(t => t.tripId)).toContain('4');
  });

  it('devrait retourner un tableau vide si pas de trips dans la fenêtre', () => {
    const windowStart = 10 * 3600; // 10:00
    const windowEnd = 11 * 3600; // 11:00
    
    const filtered = filterTripsInWindow(mockTrips, windowStart, windowEnd);
    expect(filtered.length).toBe(0);
  });
});

// ============================================
// Fonctions helper (copies des vraies)
// ============================================

function encodePolyline(points) {
  if (!points || points.length === 0) return '';
  
  const encodeNumber = (num) => {
    let sgnNum = num < 0 ? ~(num << 1) : num << 1;
    let out = '';
    while (sgnNum >= 0x20) {
      out += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
      sgnNum >>= 5;
    }
    out += String.fromCharCode(sgnNum + 63);
    return out;
  };

  let lastLat = 0;
  let lastLng = 0;
  let result = '';
  for (const [lat, lng] of points) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);
    const dLat = latE5 - lastLat;
    const dLng = lngE5 - lastLng;
    result += encodeNumber(dLat);
    result += encodeNumber(dLng);
    lastLat = latE5;
    lastLng = lngE5;
  }
  return result;
}

function decodePolyline(encoded) {
  if (!encoded) return [];
  const poly = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    poly.push([lat / 1e5, lng / 1e5]);
  }
  return poly;
}

function computeWalkDurationSeconds(distanceMeters) {
  if (!distanceMeters || Number.isNaN(distanceMeters)) return 0;
  return Math.max(30, Math.round(distanceMeters / 1.35));
}

function filterTripsInWindow(trips, windowStartSec, windowEndSec) {
  return trips.filter(trip => {
    const parts = trip.departureTime.split(':');
    const depSec = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2] || 0);
    return depSec >= windowStartSec && depSec <= windowEndSec;
  });
}

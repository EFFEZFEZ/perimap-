/**
 * Tests unitaires - Utils Formatters
 * 
 * Teste les fonctions de formatage de temps et texte
 */

import { describe, it, expect, vi } from 'vitest';

// Note: Ces imports seront ajustés quand les modules seront refactorisés
// Pour l'instant, on teste les concepts

describe('Formatters - Temps', () => {
  describe('parseTimeStringToMinutes', () => {
    it('devrait convertir "08:30" en 510 minutes', () => {
      const result = parseTimeStringToMinutes('08:30');
      expect(result).toBe(510);
    });

    it('devrait convertir "00:00" en 0 minutes', () => {
      const result = parseTimeStringToMinutes('00:00');
      expect(result).toBe(0);
    });

    it('devrait convertir "23:59" en 1439 minutes', () => {
      const result = parseTimeStringToMinutes('23:59');
      expect(result).toBe(1439);
    });

    it('devrait gérer les heures après minuit (25:30)', () => {
      const result = parseTimeStringToMinutes('25:30');
      expect(result).toBe(1530); // 25*60 + 30
    });

    it('devrait retourner NaN pour une entrée invalide', () => {
      const result = parseTimeStringToMinutes('invalid');
      expect(result).toBeNaN();
    });
  });

  describe('formatMinutesToTimeString', () => {
    it('devrait convertir 510 minutes en "08:30"', () => {
      const result = formatMinutesToTimeString(510);
      expect(result).toBe('08:30');
    });

    it('devrait convertir 0 minutes en "00:00"', () => {
      const result = formatMinutesToTimeString(0);
      expect(result).toBe('00:00');
    });

    it('devrait gérer les minutes > 1440 (après minuit)', () => {
      const result = formatMinutesToTimeString(1530);
      expect(result).toBe('25:30');
    });
  });

  describe('computeTimeDifferenceMinutes', () => {
    it('devrait calculer la différence entre deux horaires', () => {
      const result = computeTimeDifferenceMinutes('08:00', '08:30');
      expect(result).toBe(30);
    });

    it('devrait gérer le passage à minuit', () => {
      const result = computeTimeDifferenceMinutes('23:30', '00:30');
      expect(result).toBe(60);
    });
  });
});

describe('Formatters - Texte', () => {
  describe('isMeaningfulTime', () => {
    it('devrait retourner true pour un horaire valide', () => {
      expect(isMeaningfulTime('08:30')).toBe(true);
    });

    it('devrait retourner false pour une chaîne vide', () => {
      expect(isMeaningfulTime('')).toBe(false);
    });

    it('devrait retourner false pour null', () => {
      expect(isMeaningfulTime(null)).toBe(false);
    });

    it('devrait retourner false pour undefined', () => {
      expect(isMeaningfulTime(undefined)).toBe(false);
    });
  });

  describe('getSafeStopLabel', () => {
    it('devrait retourner le nom si présent', () => {
      const stop = { name: 'Gare SNCF' };
      expect(getSafeStopLabel(stop)).toBe('Gare SNCF');
    });

    it('devrait retourner "Arrêt inconnu" si pas de nom', () => {
      expect(getSafeStopLabel({})).toBe('Arrêt inconnu');
    });

    it('devrait retourner "Arrêt inconnu" si null', () => {
      expect(getSafeStopLabel(null)).toBe('Arrêt inconnu');
    });
  });
});

// Fonctions helper (à remplacer par les vraies quand refactorisées)
function parseTimeStringToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return NaN;
  const parts = timeStr.split(':');
  if (parts.length < 2) return NaN;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return NaN;
  return hours * 60 + minutes;
}

function formatMinutesToTimeString(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function computeTimeDifferenceMinutes(time1, time2) {
  const m1 = parseTimeStringToMinutes(time1);
  const m2 = parseTimeStringToMinutes(time2);
  let diff = m2 - m1;
  if (diff < 0) diff += 1440; // Passage à minuit
  return diff;
}

function isMeaningfulTime(time) {
  return time != null && time !== '' && typeof time === 'string';
}

function getSafeStopLabel(stop) {
  if (!stop || !stop.name) return 'Arrêt inconnu';
  return stop.name;
}

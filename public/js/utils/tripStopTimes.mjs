/*
 * Helpers GTFS stop_times.
 * Objectif: distinguer départs vs arrivées au terminus (dernier arrêt d'un trip).
 */

export function hasMeaningfulGtfsTime(value) {
  if (value === undefined || value === null) return false;
  const trimmed = String(value).trim();
  if (!trimmed) return false;
  return trimmed !== '--:--' && trimmed !== '~';
}

export function isLastStopOfTrip(stopTimes, stopId) {
  if (!Array.isArray(stopTimes) || stopTimes.length === 0) return false;
  if (!stopId) return false;
  const last = stopTimes[stopTimes.length - 1];
  return Boolean(last && last.stop_id === stopId);
}

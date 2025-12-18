/*
 * Normalisation et comparaison robuste des noms d'arrêts.
 * Objectif: éviter les faux négatifs (accents, parenthèses, "TERMINUS", tirets, ponctuation).
 */

export function normalizeStopNameForComparison(value) {
  if (value === undefined || value === null) return '';

  const raw = String(value)
    .toLowerCase()
    .replace(/terminus\b/gi, ' ');

  // Retire les diacritiques (accents)
  const noDiacritics = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Remplace parenthèses/crochets par espaces
  const noBrackets = noDiacritics.replace(/[()\[\]{}]/g, ' ');

  // Uniformise séparateurs / ponctuation
  const alnumSpaced = noBrackets.replace(/[^a-z0-9]+/g, ' ');

  // Trim + collapse whitespace
  return alnumSpaced.replace(/\s+/g, ' ').trim();
}

export function areStopNamesEquivalent(a, b) {
  const na = normalizeStopNameForComparison(a);
  const nb = normalizeStopNameForComparison(b);
  if (!na || !nb) return false;
  return na === nb;
}

// Cas d'usage principal: ne pas afficher "Direction X" quand X est l'arrêt actuel (terminus)
export function shouldHideDestinationAtStop(stopName, destinationName) {
  return areStopNamesEquivalent(stopName, destinationName);
}

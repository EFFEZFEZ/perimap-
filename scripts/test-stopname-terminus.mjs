import assert from 'node:assert/strict';
import { normalizeStopNameForComparison, areStopNamesEquivalent, shouldHideDestinationAtStop } from '../public/js/utils/stopName.mjs';

// Normalisation: accents / ponctuation / terminus / parenthèses
assert.equal(normalizeStopNameForComparison('TOURNY (TERMINUS)'), 'tourny');
assert.equal(normalizeStopNameForComparison('Tourny - Terminus'), 'tourny');
assert.equal(normalizeStopNameForComparison('PÉRIGUEUX-GARE'), 'perigueux gare');
assert.equal(normalizeStopNameForComparison('  Gare (Périgueux)  '), 'gare perigueux');

// Équivalence
assert.equal(areStopNamesEquivalent('Tourny', 'TOURNY (TERMINUS)'), true);
assert.equal(areStopNamesEquivalent('Périgueux Gare', 'PERIGUEUX-GARE'), true);
assert.equal(areStopNamesEquivalent('Tourny', 'Chamiers'), false);

// Règle métier: ne pas afficher Direction = arrêt courant
assert.equal(shouldHideDestinationAtStop('Tourny', 'TOURNY (TERMINUS)'), true);
assert.equal(shouldHideDestinationAtStop('Tourny (Terminus)', 'Tourny'), true);
assert.equal(shouldHideDestinationAtStop('Tourny', 'Chamiers'), false);

console.log('[test-stopname-terminus] OK');

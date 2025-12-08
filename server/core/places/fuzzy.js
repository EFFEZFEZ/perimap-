/*
 * Copyright (c) 2025 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * fuzzy.js
 * Recherche floue (fuzzy search) pour l'autocomplétion
 * 
 * 🔴 STATUT: DÉSACTIVÉ - Code préparé pour le futur
 * 
 * La recherche floue permet de trouver des résultats même avec
 * des fautes de frappe ou des variations d'orthographe.
 * 
 * Algorithmes implémentés:
 * - Distance de Levenshtein (édition)
 * - Score de similarité
 * - Matching partiel
 */

/**
 * Calcul de la distance de Levenshtein optimisée
 * (nombre minimum d'opérations pour transformer une chaîne en une autre)
 * 
 * @param {string} a - Première chaîne
 * @param {string} b - Deuxième chaîne
 * @returns {number} Distance d'édition
 */
export function levenshteinDistance(a, b) {
  if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
  
  // Optimisation: si les chaînes sont identiques
  if (a === b) return 0;
  
  // Optimisation: utiliser la chaîne la plus courte comme base
  if (a.length > b.length) [a, b] = [b, a];

  const lenA = a.length;
  const lenB = b.length;

  // Optimisation: utiliser un seul tableau au lieu d'une matrice
  let prevRow = Array.from({ length: lenA + 1 }, (_, i) => i);
  let currRow = new Array(lenA + 1);

  for (let j = 1; j <= lenB; j++) {
    currRow[0] = j;

    for (let i = 1; i <= lenA; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[i] = Math.min(
        prevRow[i] + 1,      // Suppression
        currRow[i - 1] + 1,  // Insertion
        prevRow[i - 1] + cost // Substitution
      );
    }

    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[lenA];
}

/**
 * Calcule un score de similarité entre 0 et 1
 * (1 = identique, 0 = complètement différent)
 * 
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function similarityScore(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLength = Math.max(a.length, b.length);
  
  return 1 - (distance / maxLength);
}

/**
 * Vérifie si une chaîne correspond partiellement à une autre
 * avec une tolérance aux erreurs
 * 
 * @param {string} query - Requête de recherche
 * @param {string} target - Texte cible
 * @param {number} threshold - Seuil de similarité (0-1, défaut: 0.6)
 * @returns {Object} {matches: boolean, score: number}
 */
export function fuzzyMatch(query, target, threshold = 0.6) {
  if (!query || !target) {
    return { matches: false, score: 0 };
  }

  const normalizedQuery = normalizeText(query);
  const normalizedTarget = normalizeText(target);

  // Match exact ou préfixe
  if (normalizedTarget.startsWith(normalizedQuery)) {
    return { matches: true, score: 1 };
  }

  // Match de sous-chaîne
  if (normalizedTarget.includes(normalizedQuery)) {
    // Score basé sur la position (plus tôt = meilleur)
    const position = normalizedTarget.indexOf(normalizedQuery);
    const positionScore = 1 - (position / normalizedTarget.length) * 0.2;
    return { matches: true, score: 0.9 * positionScore };
  }

  // Match mot par mot
  const queryWords = normalizedQuery.split(/\s+/);
  const targetWords = normalizedTarget.split(/\s+/);
  
  let matchedWords = 0;
  let totalScore = 0;

  for (const queryWord of queryWords) {
    let bestWordScore = 0;
    
    for (const targetWord of targetWords) {
      // Match préfixe du mot
      if (targetWord.startsWith(queryWord)) {
        bestWordScore = Math.max(bestWordScore, 0.95);
        continue;
      }

      // Match flou du mot
      const wordScore = similarityScore(queryWord, targetWord);
      if (wordScore >= threshold) {
        bestWordScore = Math.max(bestWordScore, wordScore);
      }
    }

    if (bestWordScore > 0) {
      matchedWords++;
      totalScore += bestWordScore;
    }
  }

  if (matchedWords === 0) {
    // Dernier recours: similarité globale
    const globalScore = similarityScore(normalizedQuery, normalizedTarget);
    return {
      matches: globalScore >= threshold,
      score: globalScore,
    };
  }

  const averageScore = totalScore / queryWords.length;
  const coverageBonus = (matchedWords / queryWords.length) * 0.2;
  const finalScore = Math.min(1, averageScore + coverageBonus);

  return {
    matches: finalScore >= threshold,
    score: finalScore,
  };
}

/**
 * Normalise un texte pour la comparaison
 */
export function normalizeText(text) {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Recherche floue dans une liste d'éléments
 * 
 * @param {string} query - Requête de recherche
 * @param {Array} items - Liste d'éléments
 * @param {Object} options - Options
 * @param {string[]} options.keys - Propriétés à chercher
 * @param {number} options.threshold - Seuil de similarité
 * @param {number} options.limit - Nombre max de résultats
 * @returns {Array} Résultats triés par score
 */
export function fuzzySearch(query, items, options = {}) {
  const {
    keys = ['name'],
    threshold = 0.4,
    limit = 10,
  } = options;

  if (!query || !items || items.length === 0) {
    return [];
  }

  const results = [];

  for (const item of items) {
    let bestScore = 0;
    let bestKey = null;

    for (const key of keys) {
      const value = getNestedValue(item, key);
      if (!value) continue;

      const { matches, score } = fuzzyMatch(query, String(value), threshold);
      
      if (matches && score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }

    if (bestScore >= threshold) {
      results.push({
        item,
        score: bestScore,
        matchedKey: bestKey,
      });
    }
  }

  // Trier par score décroissant
  results.sort((a, b) => b.score - a.score);

  // Limiter les résultats
  return results.slice(0, limit);
}

/**
 * Récupère une valeur imbriquée dans un objet
 * Ex: getNestedValue({a: {b: 1}}, 'a.b') => 1
 */
function getNestedValue(obj, path) {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Classe pour gérer les recherches floues avec cache
 */
export class FuzzySearcher {
  /**
   * @param {Array} items - Éléments à indexer
   * @param {Object} options - Options
   */
  constructor(items = [], options = {}) {
    this.items = items;
    this.options = {
      keys: ['name'],
      threshold: 0.4,
      limit: 10,
      cacheSize: 100,
      ...options,
    };
    
    this.cache = new Map();
  }

  /**
   * Met à jour les éléments indexés
   */
  setItems(items) {
    this.items = items;
    this.cache.clear();
  }

  /**
   * Ajoute des éléments
   */
  addItems(items) {
    this.items.push(...items);
    this.cache.clear();
  }

  /**
   * Effectue une recherche (avec cache)
   */
  search(query) {
    if (!query || query.length < 2) return [];

    // Vérifier le cache
    const cacheKey = normalizeText(query);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Effectuer la recherche
    const results = fuzzySearch(query, this.items, this.options);

    // Mettre en cache
    if (this.cache.size >= this.options.cacheSize) {
      // Supprimer la plus ancienne entrée
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, results);

    return results;
  }

  /**
   * Vide le cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export default {
  levenshteinDistance,
  similarityScore,
  fuzzyMatch,
  fuzzySearch,
  normalizeText,
  FuzzySearcher,
};


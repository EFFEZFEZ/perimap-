/**
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * API Places - Autocomplétion avec hiérarchie intelligente
 * 
 * Priorité : POI > Communes > Arrêts bus > Adresses Google
 */

export const config = {
  runtime: 'edge',
  regions: ['cdg1'],
};

// ===========================================
// Cache pour les résultats Google Places
// ===========================================
const placesCache = new Map();
const PLACES_CACHE_MAX_SIZE = 200;
const PLACES_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanPlacesCache() {
  const now = Date.now();
  for (const [key, entry] of placesCache.entries()) {
    if (now - entry.timestamp > PLACES_CACHE_TTL_MS) {
      placesCache.delete(key);
    }
  }
  if (placesCache.size > PLACES_CACHE_MAX_SIZE) {
    const entries = [...placesCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, placesCache.size - PLACES_CACHE_MAX_SIZE);
    toDelete.forEach(([key]) => placesCache.delete(key));
  }
}

// ===========================================
// 1. POI LOCAUX - Points d'intérêt populaires
// ===========================================
const LOCAL_POIS = {
  // Grande distribution
  'auchan': { name: 'Auchan Périgueux Boulazac', category: 'Hypermarché', lat: 45.1847, lng: 0.7567 },
  'auchan boulazac': { name: 'Auchan Périgueux Boulazac', category: 'Hypermarché', lat: 45.1847, lng: 0.7567 },
  'auchan marsac': { name: 'Auchan Marsac-sur-l\'Isle', category: 'Hypermarché', lat: 45.1978, lng: 0.6789 },
  'leclerc': { name: 'E.Leclerc Trélissac', category: 'Hypermarché', lat: 45.1923, lng: 0.7612 },
  'leclerc trelissac': { name: 'E.Leclerc Trélissac', category: 'Hypermarché', lat: 45.1923, lng: 0.7612 },
  'leclerc boulazac': { name: 'E.Leclerc Boulazac', category: 'Hypermarché', lat: 45.1789, lng: 0.7634 },
  'carrefour': { name: 'Carrefour Market Périgueux', category: 'Supermarché', lat: 45.1842, lng: 0.7189 },
  'lidl': { name: 'Lidl Périgueux', category: 'Supermarché', lat: 45.1756, lng: 0.7298 },
  'lidl trelissac': { name: 'Lidl Trélissac', category: 'Supermarché', lat: 45.1912, lng: 0.7589 },
  'intermarche': { name: 'Intermarché Coulounieix', category: 'Supermarché', lat: 45.1678, lng: 0.6934 },
  'intermarché': { name: 'Intermarché Coulounieix', category: 'Supermarché', lat: 45.1678, lng: 0.6934 },
  'super u': { name: 'Super U Chancelade', category: 'Supermarché', lat: 45.1923, lng: 0.6812 },
  'biocoop': { name: 'Biocoop Périgueux', category: 'Magasin bio', lat: 45.1834, lng: 0.7201 },
  'netto': { name: 'Netto Coulounieix', category: 'Discount', lat: 45.1689, lng: 0.6923 },
  
  // Zones commerciales
  'zone commerciale boulazac': { name: 'Zone Commerciale Boulazac', category: 'Zone commerciale', lat: 45.1834, lng: 0.7589 },
  'zone commerciale trelissac': { name: 'Zone Commerciale Trélissac', category: 'Zone commerciale', lat: 45.1912, lng: 0.7601 },
  'zone commerciale marsac': { name: 'Zone Commerciale Marsac', category: 'Zone commerciale', lat: 45.2012, lng: 0.6823 },
  'la feuilleraie': { name: 'La Feuilleraie', category: 'Quartier résidentiel', lat: 45.1756, lng: 0.7145 },
  'feuilleraie': { name: 'La Feuilleraie', category: 'Quartier résidentiel', lat: 45.1756, lng: 0.7145 },
  
  // Santé
  'hopital': { name: 'Centre Hospitalier de Périgueux', category: 'Hôpital', lat: 45.1789, lng: 0.7312 },
  'hôpital': { name: 'Centre Hospitalier de Périgueux', category: 'Hôpital', lat: 45.1789, lng: 0.7312 },
  'centre hospitalier': { name: 'Centre Hospitalier de Périgueux', category: 'Hôpital', lat: 45.1789, lng: 0.7312 },
  'clinique': { name: 'Clinique Francheville', category: 'Clinique', lat: 45.1923, lng: 0.7145 },
  'francheville': { name: 'Clinique Francheville', category: 'Clinique', lat: 45.1923, lng: 0.7145 },
  'polyclinique': { name: 'Polyclinique Francheville', category: 'Clinique', lat: 45.1923, lng: 0.7145 },
  
  // Éducation - Lycées
  'bertran de born': { name: 'Lycée Bertran de Born', category: 'Lycée', lat: 45.1867, lng: 0.7234 },
  'jay de beaufort': { name: 'Lycée Jay de Beaufort', category: 'Lycée', lat: 45.1912, lng: 0.7189 },
  'laure gatet': { name: 'Lycée Laure Gatet', category: 'Lycée', lat: 45.1845, lng: 0.7156 },
  'albert claveille': { name: 'Lycée Albert Claveille', category: 'Lycée', lat: 45.1778, lng: 0.7267 },
  'claveille': { name: 'Lycée Albert Claveille', category: 'Lycée', lat: 45.1778, lng: 0.7267 },
  'saint joseph': { name: 'Lycée Saint-Joseph', category: 'Lycée privé', lat: 45.1856, lng: 0.7198 },
  'lycee': { name: 'Lycée Bertran de Born', category: 'Lycée', lat: 45.1867, lng: 0.7234 },
  'lycée': { name: 'Lycée Bertran de Born', category: 'Lycée', lat: 45.1867, lng: 0.7234 },
  
  // Éducation - Collèges
  'college montaigne': { name: 'Collège Michel de Montaigne', category: 'Collège', lat: 45.1834, lng: 0.7178 },
  'collège montaigne': { name: 'Collège Michel de Montaigne', category: 'Collège', lat: 45.1834, lng: 0.7178 },
  
  // Éducation - Supérieur
  'universite': { name: 'Campus Universitaire Périgueux', category: 'Université', lat: 45.1789, lng: 0.7234 },
  'université': { name: 'Campus Universitaire Périgueux', category: 'Université', lat: 45.1789, lng: 0.7234 },
  'iut': { name: 'IUT Périgueux-Bordeaux', category: 'IUT', lat: 45.1756, lng: 0.7289 },
  'campus': { name: 'Campus Périgord', category: 'Université', lat: 45.1789, lng: 0.7234 },
  'fac': { name: 'Campus Universitaire Périgueux', category: 'Université', lat: 45.1789, lng: 0.7234 },
  
  // Transport
  'gare': { name: 'Gare SNCF de Périgueux', category: 'Gare', lat: 45.1867, lng: 0.7145 },
  'gare sncf': { name: 'Gare SNCF de Périgueux', category: 'Gare', lat: 45.1867, lng: 0.7145 },
  'gare routiere': { name: 'Gare Routière de Périgueux', category: 'Gare routière', lat: 45.1856, lng: 0.7156 },
  'gare routière': { name: 'Gare Routière de Périgueux', category: 'Gare routière', lat: 45.1856, lng: 0.7156 },
  
  // Culture & Loisirs
  'vesone': { name: 'Musée Vesunna', category: 'Musée', lat: 45.1801, lng: 0.7089 },
  'vésone': { name: 'Musée Vesunna', category: 'Musée', lat: 45.1801, lng: 0.7089 },
  'vesunna': { name: 'Musée Vesunna', category: 'Musée', lat: 45.1801, lng: 0.7089 },
  'musee': { name: "Musée d'Art et d'Archéologie", category: 'Musée', lat: 45.1845, lng: 0.7189 },
  'musée': { name: "Musée d'Art et d'Archéologie", category: 'Musée', lat: 45.1845, lng: 0.7189 },
  'cathedrale': { name: 'Cathédrale Saint-Front', category: 'Monument', lat: 45.1845, lng: 0.7223 },
  'cathédrale': { name: 'Cathédrale Saint-Front', category: 'Monument', lat: 45.1845, lng: 0.7223 },
  'saint front': { name: 'Cathédrale Saint-Front', category: 'Monument', lat: 45.1845, lng: 0.7223 },
  'cinema': { name: 'CGR Périgueux', category: 'Cinéma', lat: 45.1823, lng: 0.7212 },
  'cinéma': { name: 'CGR Périgueux', category: 'Cinéma', lat: 45.1823, lng: 0.7212 },
  'cgr': { name: 'CGR Périgueux', category: 'Cinéma', lat: 45.1823, lng: 0.7212 },
  'mediatheque': { name: 'Médiathèque Pierre Fanlac', category: 'Médiathèque', lat: 45.1834, lng: 0.7198 },
  'médiathèque': { name: 'Médiathèque Pierre Fanlac', category: 'Médiathèque', lat: 45.1834, lng: 0.7198 },
  'bibliotheque': { name: 'Médiathèque Pierre Fanlac', category: 'Médiathèque', lat: 45.1834, lng: 0.7198 },
  'piscine': { name: 'Piscine Bertran de Born', category: 'Piscine', lat: 45.1878, lng: 0.7234 },
  'odyssee': { name: "L'Odyssée - Piscine", category: 'Piscine', lat: 45.1878, lng: 0.7234 },
  
  // Sport
  'stade': { name: 'Stade Francis Rongiéras', category: 'Stade', lat: 45.1756, lng: 0.7312 },
  'patinoire': { name: 'Patinoire de Boulazac', category: 'Patinoire', lat: 45.1801, lng: 0.7545 },
  'gymnase': { name: 'Gymnase Municipal', category: 'Gymnase', lat: 45.1823, lng: 0.7267 },
  'parc gamenson': { name: 'Parc de Gamenson', category: 'Parc', lat: 45.1789, lng: 0.7134 },
  'gamenson': { name: 'Parc de Gamenson', category: 'Parc', lat: 45.1789, lng: 0.7134 },
  
  // Quartiers populaires
  'chamiers': { name: 'Quartier de Chamiers', category: 'Quartier', lat: 45.1678, lng: 0.6934 },
  'la beune': { name: 'La Beune', category: 'Quartier', lat: 45.1801, lng: 0.7089 },
  'beune': { name: 'La Beune', category: 'Quartier', lat: 45.1801, lng: 0.7089 },
  'tocane': { name: 'Tocane', category: 'Quartier', lat: 45.1834, lng: 0.7156 },
  'combe des dames': { name: 'Combe des Dames', category: 'Quartier', lat: 45.1889, lng: 0.7123 },
  'la boetie': { name: 'La Boétie', category: 'Quartier', lat: 45.1867, lng: 0.7201 },
  'arenes': { name: 'Les Arènes', category: 'Quartier', lat: 45.1823, lng: 0.7145 },
  'arènes': { name: 'Les Arènes', category: 'Quartier', lat: 45.1823, lng: 0.7145 },
  
  // Administration
  'mairie': { name: 'Mairie de Périgueux', category: 'Mairie', lat: 45.1845, lng: 0.7189 },
  'mairie perigueux': { name: 'Mairie de Périgueux', category: 'Mairie', lat: 45.1845, lng: 0.7189 },
  'prefecture': { name: 'Préfecture de la Dordogne', category: 'Préfecture', lat: 45.1856, lng: 0.7178 },
  'préfecture': { name: 'Préfecture de la Dordogne', category: 'Préfecture', lat: 45.1856, lng: 0.7178 },
  'caf': { name: 'CAF Périgueux', category: 'Administration', lat: 45.1823, lng: 0.7156 },
  'pole emploi': { name: 'Pôle Emploi Périgueux', category: 'Administration', lat: 45.1789, lng: 0.7178 },
  'pôle emploi': { name: 'Pôle Emploi Périgueux', category: 'Administration', lat: 45.1789, lng: 0.7178 },
  'cpam': { name: 'CPAM Périgueux', category: 'Administration', lat: 45.1801, lng: 0.7189 },
  'tribunal': { name: 'Tribunal Judiciaire', category: 'Justice', lat: 45.1834, lng: 0.7167 },
  'poste': { name: 'La Poste Périgueux Centre', category: 'Services', lat: 45.1845, lng: 0.7201 },
  
  // Commerces spécialisés
  'decathlon': { name: 'Decathlon Boulazac', category: 'Sport', lat: 45.1834, lng: 0.7567 },
  'brico depot': { name: 'Brico Dépôt Périgueux', category: 'Bricolage', lat: 45.1756, lng: 0.7534 },
  'brico dépôt': { name: 'Brico Dépôt Périgueux', category: 'Bricolage', lat: 45.1756, lng: 0.7534 },
  'leroy merlin': { name: 'Leroy Merlin Trélissac', category: 'Bricolage', lat: 45.1912, lng: 0.7589 },
  'mr bricolage': { name: 'Mr Bricolage Coulounieix', category: 'Bricolage', lat: 45.1689, lng: 0.6945 },
  'action': { name: 'Action Boulazac', category: 'Discount', lat: 45.1823, lng: 0.7556 },
  'gifi': { name: 'Gifi Trélissac', category: 'Discount', lat: 45.1901, lng: 0.7578 },
  'la halle': { name: 'La Halle Boulazac', category: 'Vêtements', lat: 45.1812, lng: 0.7545 },
  'kiabi': { name: 'Kiabi Boulazac', category: 'Vêtements', lat: 45.1823, lng: 0.7534 },
  'zara': { name: 'Zara (Centre-ville)', category: 'Vêtements', lat: 45.1845, lng: 0.7212 },
  'fnac': { name: 'Fnac Périgueux', category: 'Culture', lat: 45.1840, lng: 0.7198 },
  'darty': { name: 'Darty Boulazac', category: 'Électroménager', lat: 45.1812, lng: 0.7556 },
  'boulanger': { name: 'Boulanger Trélissac', category: 'Électronique', lat: 45.1923, lng: 0.7589 },
  
  // Restaurants fast-food
  'mcdo': { name: "McDonald's Boulazac", category: 'Restaurant', lat: 45.1834, lng: 0.7523 },
  'mcdonald': { name: "McDonald's Boulazac", category: 'Restaurant', lat: 45.1834, lng: 0.7523 },
  "mcdonald's": { name: "McDonald's Boulazac", category: 'Restaurant', lat: 45.1834, lng: 0.7523 },
  'burger king': { name: 'Burger King Trélissac', category: 'Restaurant', lat: 45.1923, lng: 0.7601 },
  'kfc': { name: 'KFC Boulazac', category: 'Restaurant', lat: 45.1845, lng: 0.7534 },
  'subway': { name: 'Subway Périgueux', category: 'Restaurant', lat: 45.1840, lng: 0.7189 },
  'flunch': { name: 'Flunch Boulazac', category: 'Restaurant', lat: 45.1812, lng: 0.7545 },
  'buffalo grill': { name: 'Buffalo Grill Boulazac', category: 'Restaurant', lat: 45.1801, lng: 0.7534 },
};

// ===========================================
// 2. COMMUNES du Grand Périgueux
// ===========================================
const LOCAL_COMMUNES = {
  'perigueux': { name: 'Périgueux', lat: 45.1846, lng: 0.7214 },
  'périgueux': { name: 'Périgueux', lat: 45.1846, lng: 0.7214 },
  'boulazac': { name: 'Boulazac Isle Manoire', lat: 45.1823, lng: 0.7534 },
  'isle manoire': { name: 'Boulazac Isle Manoire', lat: 45.1823, lng: 0.7534 },
  'trelissac': { name: 'Trélissac', lat: 45.1956, lng: 0.7612 },
  'trélissac': { name: 'Trélissac', lat: 45.1956, lng: 0.7612 },
  'coulounieix': { name: 'Coulounieix-Chamiers', lat: 45.1678, lng: 0.6934 },
  'chamiers': { name: 'Coulounieix-Chamiers', lat: 45.1678, lng: 0.6934 },
  'coulounieix-chamiers': { name: 'Coulounieix-Chamiers', lat: 45.1678, lng: 0.6934 },
  'chancelade': { name: 'Chancelade', lat: 45.2012, lng: 0.6823 },
  'marsac': { name: 'Marsac-sur-l\'Isle', lat: 45.1945, lng: 0.6756 },
  'marsac sur l isle': { name: 'Marsac-sur-l\'Isle', lat: 45.1945, lng: 0.6756 },
  'sanilhac': { name: 'Notre-Dame-de-Sanilhac', lat: 45.1423, lng: 0.7312 },
  'notre dame de sanilhac': { name: 'Notre-Dame-de-Sanilhac', lat: 45.1423, lng: 0.7312 },
  'razac': { name: 'Razac-sur-l\'Isle', lat: 45.1734, lng: 0.6423 },
  'razac sur l isle': { name: 'Razac-sur-l\'Isle', lat: 45.1734, lng: 0.6423 },
  'bassillac': { name: 'Bassillac et Auberoche', lat: 45.1678, lng: 0.7823 },
  'auberoche': { name: 'Bassillac et Auberoche', lat: 45.1678, lng: 0.7823 },
  'antonne': { name: 'Antonne-et-Trigonant', lat: 45.2123, lng: 0.7734 },
  'trigonant': { name: 'Antonne-et-Trigonant', lat: 45.2123, lng: 0.7734 },
  'atur': { name: 'Atur', lat: 45.1512, lng: 0.7534 },
  'saint laurent sur manoire': { name: 'Saint-Laurent-sur-Manoire', lat: 45.1534, lng: 0.7823 },
  'escoire': { name: 'Escoire', lat: 45.2234, lng: 0.7912 },
  'la chapelle gonaguet': { name: 'La Chapelle-Gonaguet', lat: 45.2312, lng: 0.6612 },
  'chateau l eveque': { name: 'Château-l\'Évêque', lat: 45.2234, lng: 0.7023 },
  'château l évêque': { name: 'Château-l\'Évêque', lat: 45.2234, lng: 0.7023 },
  'cornille': { name: 'Cornille', lat: 45.2156, lng: 0.8012 },
  'eyliac': { name: 'Eyliac', lat: 45.1312, lng: 0.7623 },
  'saint astier': { name: 'Saint-Astier', lat: 45.1456, lng: 0.5312 },
};

// ===========================================
// 3. ARRÊTS DE BUS GTFS (moins prioritaires)
// ===========================================
const GTFS_STOPS = {
  // Pôles d'échange majeurs
  'cite': { name: 'Cité', lines: ['A', 'B', 'C', 'D'], lat: 45.1856, lng: 0.7178 },
  'cité': { name: 'Cité', lines: ['A', 'B', 'C', 'D'], lat: 45.1856, lng: 0.7178 },
  'bugeaud': { name: 'Bugeaud', lines: ['A', 'B'], lat: 45.1823, lng: 0.7189 },
  'tourny': { name: 'Tourny', lines: ['A', 'C'], lat: 45.1834, lng: 0.7212 },
  'montaigne': { name: 'Montaigne', lines: ['A'], lat: 45.1901, lng: 0.7178 },
  
  // Arrêts Ligne A
  'la filature': { name: 'La Filature', lines: ['A'], lat: 45.1789, lng: 0.7534 },
  'lakanal': { name: 'Lakanal', lines: ['A'], lat: 45.1912, lng: 0.7156 },
  'maleville': { name: 'Maleville', lines: ['A'], lat: 45.1934, lng: 0.7234 },
  'saltgourde': { name: 'Saltgourde', lines: ['A'], lat: 45.1956, lng: 0.7345 },
  'agora': { name: 'Agora', lines: ['A'], lat: 45.1795, lng: 0.7520 },
  
  // Arrêts Ligne B
  'churchill': { name: 'Churchill', lines: ['B'], lat: 45.1723, lng: 0.7089 },
  'yves guena': { name: 'Yves Guéna', lines: ['B'], lat: 45.1756, lng: 0.7123 },
  'yves guéna': { name: 'Yves Guéna', lines: ['B'], lat: 45.1756, lng: 0.7123 },
  'clos chassaing': { name: 'Clos Chassaing', lines: ['B'], lat: 45.1901, lng: 0.7156 },
  
  // Arrêts Ligne C
  'roland galissard': { name: 'Roland Galissard', lines: ['C'], lat: 45.1678, lng: 0.6923 },
  'borie': { name: 'Borie', lines: ['C'], lat: 45.1634, lng: 0.6856 },
  'combe des dames': { name: 'Combe des Dames', lines: ['C'], lat: 45.1712, lng: 0.6867 },
  
  // Arrêts Ligne D
  'campniac': { name: 'Campniac', lines: ['D'], lat: 45.1723, lng: 0.7534 },
  'perigord noir': { name: 'Périgord Noir', lines: ['D'], lat: 45.1689, lng: 0.7623 },
  'périgord noir': { name: 'Périgord Noir', lines: ['D'], lat: 45.1689, lng: 0.7623 },
  'barris': { name: 'Pont des Barris', lines: ['D'], lat: 45.1845, lng: 0.7252 },
};

// ===========================================
// Zone géographique du Grand Périgueux
// ===========================================
const GRAND_PERIGUEUX_BOUNDS = {
  south: 45.10,
  west: 0.50,
  north: 45.28,
  east: 0.90
};

const CENTER = { lat: 45.1846, lng: 0.7214 };

// ===========================================
// Fonctions utilitaires
// ===========================================

function normalize(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchLocal(query, dictionary, maxResults = 5) {
  const normalizedQuery = normalize(query);
  const queryWords = normalizedQuery.split(' ').filter(w => w.length > 1);
  const results = [];
  const seenNames = new Set();
  
  // Recherche exacte d'abord
  for (const [key, data] of Object.entries(dictionary)) {
    const normalizedKey = normalize(key);
    if (normalizedKey === normalizedQuery) {
      const uniqueName = normalize(data.name);
      if (!seenNames.has(uniqueName)) {
        seenNames.add(uniqueName);
        results.push({ ...data, score: 100 });
      }
    }
  }
  
  // Recherche partielle (commence par)
  for (const [key, data] of Object.entries(dictionary)) {
    const normalizedKey = normalize(key);
    const uniqueName = normalize(data.name);
    
    if (!seenNames.has(uniqueName)) {
      if (normalizedKey.startsWith(normalizedQuery)) {
        seenNames.add(uniqueName);
        results.push({ ...data, score: 90 });
      } else if (normalizedQuery.startsWith(normalizedKey) && normalizedKey.length >= 3) {
        seenNames.add(uniqueName);
        results.push({ ...data, score: 85 });
      }
    }
  }
  
  // Recherche contient (moins strict)
  for (const [key, data] of Object.entries(dictionary)) {
    const normalizedKey = normalize(key);
    const normalizedName = normalize(data.name);
    const uniqueName = normalize(data.name);
    
    if (!seenNames.has(uniqueName)) {
      // Match si la clé contient la requête
      if (normalizedKey.includes(normalizedQuery)) {
        seenNames.add(uniqueName);
        results.push({ ...data, score: 70 });
      }
      // Match si le nom contient la requête
      else if (normalizedName.includes(normalizedQuery)) {
        seenNames.add(uniqueName);
        results.push({ ...data, score: 65 });
      }
      // Match fuzzy par mots (très permissif)
      else if (queryWords.length > 0) {
        const keyWords = normalizedKey.split(' ');
        const nameWords = normalizedName.split(' ');
        const matchedWords = queryWords.filter(qw => 
          keyWords.some(kw => kw.includes(qw) || qw.includes(kw)) ||
          nameWords.some(nw => nw.includes(qw) || qw.includes(nw))
        );
        
        if (matchedWords.length >= Math.min(2, queryWords.length)) {
          seenNames.add(uniqueName);
          results.push({ ...data, score: 50 + (matchedWords.length * 5) });
        }
      }
    }
  }
  
  // Trier par score décroissant
  results.sort((a, b) => b.score - a.score);
  
  return results.slice(0, maxResults);
}

function formatResult(item, type, index) {
  let icon, subtitle;
  
  switch (type) {
    case 'poi':
      icon = '📍';
      subtitle = item.category || 'Lieu';
      break;
    case 'commune':
      icon = '🏘️';
      subtitle = 'Commune du Grand Périgueux';
      break;
    case 'stop':
      icon = '🚏';
      const lines = item.lines || [];
      subtitle = lines.length > 0 
        ? `Arrêt Péribus - Ligne${lines.length > 1 ? 's' : ''} ${lines.join(', ')}`
        : 'Arrêt Péribus';
      break;
    case 'google':
      icon = '📌';
      subtitle = item.formattedAddress || '';
      break;
    default:
      icon = '📍';
      subtitle = '';
  }
  
  // Format compatible avec le client (description + placeId/coordinates)
  const displayName = `${icon} ${item.name}`;
  const description = subtitle ? `${displayName}, ${subtitle}` : displayName;
  
  return {
    description: description,
    placeId: `local_${type}_${index}`,
    coordinates: { lat: item.lat, lng: item.lng },
    source: 'local',
    type: type
  };
}

// ===========================================
// Handler principal
// ===========================================

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const url = new URL(req.url);
  const input = url.searchParams.get('input')?.trim();

  if (!input || input.length < 2) {
    return new Response(JSON.stringify({ predictions: [] }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  }

  const results = [];
  const seenNames = new Set();

  // ========================================
  // 1. PRIORITÉ 1 : POI locaux
  // ========================================
  const pois = searchLocal(input, LOCAL_POIS, 3);
  for (let i = 0; i < pois.length; i++) {
    const item = pois[i];
    const normalizedName = normalize(item.name);
    if (!seenNames.has(normalizedName)) {
      seenNames.add(normalizedName);
      results.push(formatResult(item, 'poi', i));
    }
  }

  // ========================================
  // 2. PRIORITÉ 2 : Communes
  // ========================================
  const communes = searchLocal(input, LOCAL_COMMUNES, 2);
  for (let i = 0; i < communes.length; i++) {
    const item = communes[i];
    const normalizedName = normalize(item.name);
    if (!seenNames.has(normalizedName)) {
      seenNames.add(normalizedName);
      results.push(formatResult(item, 'commune', i + 100));
    }
  }

  // ========================================
  // 3. PRIORITÉ 3 : Arrêts de bus
  // ========================================
  const stops = searchLocal(input, GTFS_STOPS, 2);
  for (let i = 0; i < stops.length; i++) {
    const item = stops[i];
    const normalizedName = normalize(item.name);
    if (!seenNames.has(normalizedName)) {
      seenNames.add(normalizedName);
      results.push(formatResult(item, 'stop', i + 200));
    }
  }

  // ========================================
  // 4. PRIORITÉ 4 : Google Places (adresses)
  // ========================================
  const googleNeeded = 5 - results.length;
  
  if (googleNeeded > 0) {
    // Nettoyer le cache
    cleanPlacesCache();
    
    // Clé de cache basée sur la requête normalisée
    const cacheKey = normalize(input);
    const cachedGoogle = placesCache.get(cacheKey);
    
    if (cachedGoogle && (Date.now() - cachedGoogle.timestamp < PLACES_CACHE_TTL_MS)) {
      // Utiliser les résultats en cache
      console.log(`[Places] ✅ Cache HIT: "${input}"`);
      for (const item of cachedGoogle.data.slice(0, googleNeeded)) {
        if (!seenNames.has(normalize(item.name))) {
          seenNames.add(normalize(item.name));
          results.push(item);
        }
      }
    } else {
      // Appeler Google Places API
      try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) throw new Error('API key missing');

        const requestBody = {
          input: input,
          languageCode: 'fr',
          regionCode: 'FR',
          locationRestriction: {
            rectangle: {
              low: { latitude: GRAND_PERIGUEUX_BOUNDS.south, longitude: GRAND_PERIGUEUX_BOUNDS.west },
              high: { latitude: GRAND_PERIGUEUX_BOUNDS.north, longitude: GRAND_PERIGUEUX_BOUNDS.east }
            }
          }
        };

        const response = await fetch(
          'https://places.googleapis.com/v1/places:autocomplete',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
            },
          body: JSON.stringify(requestBody),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const suggestions = data.suggestions || [];
        
        let googleCount = 0;
        const googleResults = [];
        
        for (const suggestion of suggestions) {
          if (googleCount >= googleNeeded) break;
          
          const place = suggestion.placePrediction;
          if (!place) continue;
          
          const placeId = place.placeId;
          
          // Récupérer les détails
          const detailsResponse = await fetch(
            `https://places.googleapis.com/v1/places/${placeId}?languageCode=fr`,
            {
              headers: {
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'id,displayName,formattedAddress,location'
              }
            }
          );
          
          if (detailsResponse.ok) {
            const details = await detailsResponse.json();
            const name = details.displayName?.text || '';
            const normalizedName = normalize(name);
            
            if (!seenNames.has(normalizedName) && name) {
              seenNames.add(normalizedName);
              const location = details.location || { latitude: CENTER.lat, longitude: CENTER.lng };
              const item = {
                description: `📌 ${name}, ${details.formattedAddress || ''}`,
                placeId: placeId,
                coordinates: { lat: location.latitude, lng: location.longitude },
                source: 'google',
                type: 'address',
                name: name
              };
              results.push(item);
              googleResults.push(item);
              googleCount++;
            }
          }
        }
        
        // Stocker dans le cache
        if (googleResults.length > 0) {
          placesCache.set(cacheKey, {
            data: googleResults,
            timestamp: Date.now()
          });
          console.log(`[Places] 📦 Cache STORE: "${input}" (${googleResults.length} results)`);
        }
      }
    } catch (error) {
      console.error('Google Places error:', error.message);
    }
    } // Fin du else (pas de cache)
  } // Fin du if (googleNeeded > 0)

  return new Response(JSON.stringify({ 
    predictions: results.slice(0, 5)
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
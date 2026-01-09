/**
 * stopKeyMapping.js - Mapping entre stop_code GTFS et clés hawk.perimouv.fr
 * 
 * Ce fichier fait le lien entre les codes GTFS (ex: Tai01, AGO01)
 * et les clés numériques utilisées par hawk.perimouv.fr/qrcodes/schedule.aspx
 * 
 * Généré automatiquement à partir de hawk.perimouv.fr
 */

// Mapping stop_code GTFS -> hawk key (313 arrêts)
export const HAWK_KEY_BY_STOP_CODE = {
    "les01": "304", "MRo01": "267", "HOC02": "162", "PBa01": "129", "OMN02": "33",
    "Cle02": "279", "CRX02": "530", "Ros02": "242", "Ron02": "744", "Glc01": "12412",
    "COU01": "204", "CHo01": "193", "Vil01": "98", "CFr01": "285", "pre02": "284",
    "Doj01": "303", "Ros01": "244", "Lpt01": "12411", "GSG01": "340", "Gue02": "290",
    "AUG01": "47", "Ver01": "526", "bar01": "71", "Aut02": "2", "TGA01": "94",
    "CRO02": "86", "VED01": "136", "CFo04": "810", "AGO01": "83", "Dur01": "257",
    "bar02": "72", "MEd02": "139", "Tra01": "607", "Mdx02": "282", "TrM02": "12381",
    "ESG01": "278", "SPO02": "25", "BTO01": "34", "LAC03": "353", "GMO02": "80",
    "BUG02": "46", "ITi01": "12379", "Mil02": "673", "Tai01": "12359", "PHa01": "351",
    "Mds01": "151", "Sul01": "799", "SOM02": "66", "tou04": "687", "PEP01": "55",
    "ChA04": "515", "MAN02": "82", "MPA01": "88", "VHu02": "315", "FLE02": "11",
    "Can02": "131", "Bor01": "146", "PEM03": "755", "LYA02": "185", "PRo01": "208",
    "SNC02": "43", "CCh02": "273", "Bbe02": "12345", "CST02": "62", "POS01": "20",
    "Lil02": "192", "Sul02": "805", "tou03": "724", "Ple01": "12374", "Gue01": "289",
    "PLA01": "299", "BoI02": "459", "Lon02": "616", "Clu01": "753", "BFr01": "689",
    "Cco01": "669", "VST02": "31", "CIO02": "41", "PBE01": "18", "BPa02": "323",
    "TPD02": "60", "CLA02": "275", "COM01": "159", "Les02": "305", "CxB02": "343",
    "PMa02": "263", "SOM01": "65", "Ver03": "156", "CRX01": "291", "Erm02": "222",
    "Mou02": "97", "Ron01": "738", "COU02": "203", "Pen01": "209", "Rud02": "224",
    "Vil02": "99", "FMa01": "186", "par02": "171", "GSG02": "341", "RtA01": "698",
    "Ver02": "276", "Cit02": "110", "AVJ02": "9", "VED02": "137", "RPJ02": "7",
    "CAR01": "67", "Pen02": "12366", "Val01": "376", "Chb01": "214", "SGE01": "201",
    "Tra02": "608", "CDa01": "221", "Mds02": "150", "mon01": "345", "Ru02": "271",
    "GMO01": "79", "cha01": "347", "Hal01": "809", "Prm02": "293", "PEM01": "12343",
    "Cit01": "109", "RtR01": "704", "ITi02": "12382", "CEC01": "12", "Tai02": "375",
    "PHa02": "352", "Hor01": "239", "Amp01": "320", "Ars01": "132", "PEP02": "56",
    "Maj02": "458", "CEC02": "13", "CFr02": "286", "Pis02": "58", "Mah02": "12368",
    "Ebe01": "265", "PRo02": "12367", "TBa02": "235", "CLB02": "529", "Feu01": "154",
    "Bon02": "12365", "OdG02": "350", "SEV01": "38", "BEa02": "12362", "Rom02": "197",
    "RPT02": "93", "Puy01": "266", "Jau01": "260", "FER02": "37", "maz01": "206",
    "BoI01": "218", "OMN01": "32", "BFr02": "691", "TRo02": "200", "Aru02": "240",
    "4rt01": "301", "PBa02": "675", "Dur02": "736", "Pag02": "656", "mon02": "346",
    "HOC01": "161", "CxB03": "344", "Doj02": "630", "FER01": "36", "Por01": "251",
    "Mrl01": "714", "Cle01": "280", "PEX01": "16", "RtA02": "708", "Ver04": "697",
    "FMa02": "12344", "Aut01": "1", "PEC01": "28", "Sar01": "817", "BLZ01": "525",
    "Pag01": "181", "PoI02": "12384", "Gre01": "219", "par01": "170", "MaF01": "12369",
    "Sau01": "77", "Mdx01": "281", "Tac01": "3", "PEM02": "747", "LAC01": "534",
    "Jal02": "153", "Pl802": "12372", "MGr01": "135", "CRO01": "85", "AvC01": "701",
    "MEd01": "138", "Val02": "538", "ESA01": "517", "ERo01": "236", "EMa01": "142",
    "CRe01": "548", "ESG02": "277", "REY01": "14", "SPO01": "24", "Por02": "535",
    "BTO02": "35", "Pri01": "749", "adm01": "253", "FDH01": "51", "LYA01": "184",
    "pre01": "283", "PEX02": "17", "CCh01": "272", "Mil01": "653", "ZAE01": "5",
    "ERo02": "237", "POS02": "23", "Mrl02": "715", "FDH02": "52", "TOU01": "661",
    "FBo02": "693", "MAN01": "81", "MPA02": "89", "Ars02": "133", "Maj01": "457",
    "Pri02": "750", "Lon01": "216", "EMa02": "143", "SNC01": "42", "Sil01": "27",
    "CST01": "61", "Lil01": "191", "CIO01": "40", "Cde01": "12358", "BPa01": "324",
    "RPJ01": "6", "COM02": "160", "Rom01": "198", "TOU02": "718", "PLA02": "300",
    "BdS01": "703", "PEM04": "757", "Clu02": "754", "CDa02": "220", "Cco02": "670",
    "TRo01": "199", "Aru01": "241", "TPD01": "59", "VST01": "29", "LAB01": "140",
    "AMa02": "288", "AMa01": "287", "Lpt02": "12410", "Iza02": "104", "PoI01": "12383",
    "Dou02": "311", "ZAE02": "713", "BPU01": "12377", "Erm01": "223", "Mou01": "96",
    "BUG01": "45", "cam01": "811", "BLZ02": "87", "AVJ01": "8", "Mer01": "572",
    "CAR02": "68", "Iza01": "103", "FLE01": "10", "LAB02": "141", "Bad01": "748",
    "HMa01": "700", "Ru01": "270", "Ebe02": "12346", "PCa01": "685", "LAC02": "54",
    "Prm01": "292", "Jal01": "152", "Pl801": "12371", "MGr01": "134", "PLB01": "73",
    "SGE02": "202", "BPU02": "30", "REY02": "15", "aqu01": "231", "cha02": "348",
    "Hor02": "238", "CFo03": "550", "VHu01": "316", "Can01": "130", "Mah01": "207",
    "Doj04": "732", "Bor02": "147", "PBE02": "19", "Pis01": "57", "Tbg01": "325",
    "adm02": "597", "Lav01": "309", "CRe02": "593", "Bbe01": "217", "Suc01": "498",
    "Dou01": "310", "PLB02": "74", "Bon01": "210", "SEV02": "39", "Amp02": "319",
    "FBo01": "692", "RPT01": "92", "Rud01": "225", "PMa01": "262", "maz02": "205",
    "TBa01": "234", "4rt02": "302", "Feu02": "26", "OdG01": "349", "CLB01": "296",
    "BEa01": "213", "CLA01": "527", "Cde02": "12378"
};

// Cache pour le mapping stopId -> stopCode (chargé dynamiquement)
let stopIdToStopCodeCache = null;

/**
 * Charge le mapping stopId -> stopCode depuis les données GTFS en mémoire
 * @param {Array} stops - Liste des arrêts GTFS avec stop_id et stop_code
 */
export function loadStopIdMapping(stops) {
    if (!stops || stops.length === 0) {
        console.warn('[StopKeyMapping] Pas de stops fournis pour le mapping');
        return;
    }
    
    stopIdToStopCodeCache = new Map();
    
    for (const stop of stops) {
        if (stop.stop_id && stop.stop_code) {
            stopIdToStopCodeCache.set(stop.stop_id, stop.stop_code);
        }
    }
    
    console.log(`[StopKeyMapping] ${stopIdToStopCodeCache.size} mappings stop_id -> stop_code chargés`);
}

/**
 * Tente de trouver la clé hawk pour un stop_id GTFS
 * @param {string} stopId - L'identifiant GTFS de l'arrêt (ex: MOBIITI:Quay:111578)
 * @param {string} [stopCode] - Optionnel: le stop_code si déjà connu
 * @returns {string|null} La clé hawk ou null
 */
export function getHawkKeyForStop(stopId, stopCode = null) {
    // 1. Si on a un stop_code directement, l'utiliser
    if (stopCode && HAWK_KEY_BY_STOP_CODE[stopCode]) {
        return HAWK_KEY_BY_STOP_CODE[stopCode];
    }
    
    // 2. Chercher dans le cache stopId -> stopCode
    if (stopIdToStopCodeCache && stopIdToStopCodeCache.has(stopId)) {
        const code = stopIdToStopCodeCache.get(stopId);
        if (HAWK_KEY_BY_STOP_CODE[code]) {
            return HAWK_KEY_BY_STOP_CODE[code];
        }
    }
    
    // 3. Extraire le code depuis le stopId si pattern connu
    // Format possible: le stop_id peut contenir un code dans certains cas
    const codeMatch = stopId.match(/^([A-Za-z]{2,4}\d{2})$/);
    if (codeMatch && HAWK_KEY_BY_STOP_CODE[codeMatch[1]]) {
        return HAWK_KEY_BY_STOP_CODE[codeMatch[1]];
    }
    
    return null;
}

/**
 * Obtient les clés hawk pour un StopPlace (arrêt parent)
 * En trouvant tous les Quays associés et leurs clés hawk
 * @param {string} stopPlaceId - ID du StopPlace (ex: MOBIITI:StopPlace:77017)
 * @param {Array} allStops - Tous les arrêts GTFS
 * @returns {Array<{stopCode: string, hawkKey: string}>} Liste des clés hawk
 */
export function getHawkKeysForStopPlace(stopPlaceId, allStops) {
    const hawkKeys = [];
    
    if (!allStops) return hawkKeys;
    
    // Trouver tous les Quays qui ont ce parent_station
    for (const stop of allStops) {
        if (stop.parent_station === stopPlaceId && stop.stop_code) {
            const hawkKey = HAWK_KEY_BY_STOP_CODE[stop.stop_code];
            if (hawkKey) {
                hawkKeys.push({
                    stopId: stop.stop_id,
                    stopCode: stop.stop_code,
                    hawkKey: hawkKey
                });
            }
        }
    }
    
    return hawkKeys;
}

/**
 * Vérifie si un arrêt a potentiellement le temps réel disponible
 * @param {string} stopId - L'identifiant GTFS de l'arrêt
 * @param {string} [stopCode] - Optionnel: le stop_code si déjà connu
 * @returns {boolean}
 */
export function isRealtimeEnabled(stopId, stopCode = null) {
    // Un arrêt a le temps réel si on peut trouver sa clé hawk
    return getHawkKeyForStop(stopId, stopCode) !== null;
}

export default {
    HAWK_KEY_BY_STOP_CODE,
    loadStopIdMapping,
    getHawkKeyForStop,
    getHawkKeysForStopPlace,
    isRealtimeEnabled
};

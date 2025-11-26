/**
 * Script de test pour vérifier la logique de tri des itinéraires
 */

// Simulation des itinéraires retournés par l'API Google
const testItineraries = [
    { departureTime: '08:15', arrivalTime: '09:02', duration: '47min', type: 'BUS' },
    { departureTime: '07:30', arrivalTime: '08:25', duration: '55min', type: 'BUS' },
    { departureTime: '09:00', arrivalTime: '09:45', duration: '45min', type: 'BUS' },
    { departureTime: '07:00', arrivalTime: '07:55', duration: '55min', type: 'BUS' },
    { departureTime: '08:45', arrivalTime: '09:30', duration: '45min', type: 'BUS' },
    { departureTime: '07:15', arrivalTime: '08:10', duration: '55min', type: 'BUS' },
    { departureTime: '26:30', arrivalTime: '27:15', duration: '45min', type: 'BUS' }, // Horaire > 24h (lendemain)
];

function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return Infinity;
    const m = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!m) return Infinity;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

// Test Mode PARTIR
function testPartirSort(itineraries, requestedHour, requestedMinute) {
    const requestedMinutes = requestedHour * 60 + requestedMinute;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 TEST MODE PARTIR - Heure demandée: ${String(requestedHour).padStart(2,'0')}:${String(requestedMinute).padStart(2,'0')}`);
    console.log(`${'='.repeat(60)}`);
    
    console.log('\n📋 AVANT TRI (ordre original):');
    itineraries.forEach((it, i) => {
        console.log(`  ${i+1}. Départ: ${it.departureTime} → Arrivée: ${it.arrivalTime}`);
    });
    
    // Tri mode PARTIR : du plus tôt au plus tard
    const sorted = [...itineraries].sort((a, b) => {
        const depA = parseTimeToMinutes(a.departureTime);
        const depB = parseTimeToMinutes(b.departureTime);
        return depA - depB;
    });
    
    console.log('\n📋 APRÈS TRI (du plus tôt au plus tard):');
    sorted.forEach((it, i) => {
        const depMin = parseTimeToMinutes(it.departureTime);
        const status = depMin >= requestedMinutes ? '✅' : '⚠️ (avant heure demandée)';
        console.log(`  ${i+1}. Départ: ${it.departureTime} (${depMin}min) → Arrivée: ${it.arrivalTime} ${status}`);
    });
    
    // Filtrer ceux >= heure demandée
    const filtered = sorted.filter(it => parseTimeToMinutes(it.departureTime) >= requestedMinutes);
    console.log(`\n🎯 APRÈS FILTRAGE (départ >= ${String(requestedHour).padStart(2,'0')}:${String(requestedMinute).padStart(2,'0')}): ${filtered.length} itinéraires`);
    filtered.forEach((it, i) => {
        console.log(`  ${i+1}. Départ: ${it.departureTime} → Arrivée: ${it.arrivalTime}`);
    });
    
    return sorted;
}

// Test Mode ARRIVER
function testArriverSort(itineraries, requestedHour, requestedMinute) {
    const targetMinutes = requestedHour * 60 + requestedMinute;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏁 TEST MODE ARRIVER - Heure demandée: ${String(requestedHour).padStart(2,'0')}:${String(requestedMinute).padStart(2,'0')}`);
    console.log(`${'='.repeat(60)}`);
    
    console.log('\n📋 AVANT TRI (ordre original):');
    itineraries.forEach((it, i) => {
        console.log(`  ${i+1}. Départ: ${it.departureTime} → Arrivée: ${it.arrivalTime}`);
    });
    
    // Calculer arrivalDiff pour chaque itinéraire
    const scored = itineraries.map(it => {
        const arrMinutes = parseTimeToMinutes(it.arrivalTime);
        const arrivalDiff = targetMinutes - arrMinutes;
        return {
            it,
            arrMinutes,
            arrivalDiff: arrivalDiff >= 0 ? arrivalDiff : Infinity
        };
    });
    
    // Tri mode ARRIVER : arrivée la plus proche de la cible (sans dépasser)
    scored.sort((a, b) => a.arrivalDiff - b.arrivalDiff);
    
    console.log('\n📋 APRÈS TRI (arrivée la plus proche de la cible en premier):');
    scored.forEach((s, i) => {
        const diffStr = s.arrivalDiff === Infinity 
            ? '❌ TROP TARD (après heure demandée)' 
            : `✅ ${s.arrivalDiff}min avant la cible`;
        console.log(`  ${i+1}. Arrivée: ${s.it.arrivalTime} (${s.arrMinutes}min) ${diffStr}`);
    });
    
    // Filtrer ceux qui arrivent à l'heure ou avant
    const filtered = scored.filter(s => s.arrivalDiff !== Infinity);
    console.log(`\n🎯 VALIDES (arrivée <= ${String(requestedHour).padStart(2,'0')}:${String(requestedMinute).padStart(2,'0')}): ${filtered.length} itinéraires`);
    filtered.forEach((s, i) => {
        console.log(`  ${i+1}. Départ: ${s.it.departureTime} → Arrivée: ${s.it.arrivalTime} (${s.arrivalDiff}min avant cible)`);
    });
    
    return scored.map(s => s.it);
}

// Exécution des tests
console.log('\n' + '🧪'.repeat(30));
console.log('    TESTS DE LA LOGIQUE DE TRI DES ITINÉRAIRES');
console.log('🧪'.repeat(30));

// Test 1: Mode PARTIR à 7h50
testPartirSort(testItineraries, 7, 50);

// Test 2: Mode PARTIR à 8h30
testPartirSort(testItineraries, 8, 30);

// Test 3: Mode ARRIVER à 9h00
testArriverSort(testItineraries, 9, 0);

// Test 4: Mode ARRIVER à 8h30
testArriverSort(testItineraries, 8, 30);

console.log('\n' + '='.repeat(60));
console.log('✅ TESTS TERMINÉS');
console.log('='.repeat(60));

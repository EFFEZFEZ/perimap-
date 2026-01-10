/**
 * Test complet de la chaîne de routage
 * 1. Test du frontend (Peribus format)
 * 2. Test de l'Edge Function
 * 3. Validation des formats
 */

const VERCEL_API = 'https://perimap.fr/api/routes';
// Fallback to localhost for testing
const API_ENDPOINT = 'http://localhost:3000/api/routes';

async function testEdgeFunction(testName, payload) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🧪 ${testName}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    console.log('📤 Payload envoyé:');
    console.log(JSON.stringify(payload, null, 2));
    
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        console.log(`\n📥 Réponse: ${response.status}`);
        console.log(JSON.stringify(data, null, 2));
        
        if (response.ok && data.success) {
            console.log(`✅ Itinéraires trouvés: ${data.itineraries?.length || 'N/A'}`);
        } else {
            console.log(`❌ Erreur: ${data.error || 'Non spécifiée'}`);
            if (data.details) {
                console.log(`   Détails: ${data.details}`);
            }
        }
    } catch (error) {
        console.error(`❌ ERREUR FETCH: ${error.message}`);
    }
}

async function runTests() {
    console.log('🚀 TEST EDGE FUNCTION - Chaîne de Routage Complète');
    console.log(`API Endpoint: ${API_ENDPOINT}`);
    
    // Test 1: Format standard envoyé par le frontend
    await testEdgeFunction('Format Perimap standard (avec date/heure ISO)', {
        fromPlace: '45.195372,0.7808015',
        toPlace: '45.1858333,0.6619444',
        date: '2026-01-10T11:50:00+01:00',  // Format ISO direct du _buildDateTime()
        time: '2026-01-10T11:50:00+01:00',
        mode: 'TRANSIT',
        maxWalkDistance: 1000,
        numItineraries: 3
    });
    
    // Test 2: Format avec date et heure séparés
    await testEdgeFunction('Format avec date et time séparés', {
        fromPlace: '45.195372,0.7808015',
        toPlace: '45.1858333,0.6619444',
        date: '2026-01-10',
        time: '11:50',
        mode: 'TRANSIT',
        maxWalkDistance: 1000,
        numItineraries: 3
    });
    
    // Test 3: Format avec date/time combinés (comme le frontend pourrait envoyer)
    await testEdgeFunction('Format avec datetime combiné', {
        fromPlace: '45.195372,0.7808015',
        toPlace: '45.1858333,0.6619444',
        date: '2026-01-10 11:50',
        time: '2026-01-10 11:50',
        mode: 'TRANSIT',
        maxWalkDistance: 1000
    });
    
    // Test 4: Format origin/destination (pour vérifier la rétrocompatibilité)
    await testEdgeFunction('Format origin/destination', {
        origin: '45.195372,0.7808015',
        destination: '45.1858333,0.6619444',
        date: '2026-01-10',
        time: '11:50',
        mode: 'TRANSIT'
    });
    
    console.log('\n✨ Tests d\'Edge Function terminés!\n');
}

// Vérifier les formats localement
console.log('🔍 VALIDATION DES FORMATS\n');

// Simulation de _buildDateTime()
function buildDateTime(searchTime) {
    const now = new Date();
    const year = searchTime?.year || now.getFullYear();
    const month = (searchTime?.month + 1 || now.getMonth() + 1).toString().padStart(2, '0');
    const day = (searchTime?.date || now.getDate()).toString().padStart(2, '0');
    const hour = (searchTime?.hour || now.getHours()).toString().padStart(2, '0');
    const minute = (searchTime?.minute || now.getMinutes()).toString().padStart(2, '0');
    
    // Créer une date ISO pour la timezone locale
    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hour}:${minute}`;
    const isoStr = `${dateStr}T${timeStr}:00+01:00`;
    
    return isoStr;
}

const sampleTime = { year: 2026, month: 0, date: 10, hour: 11, minute: 50 };
const builtDateTime = buildDateTime(sampleTime);
console.log('📅 Exemple de _buildDateTime():');
console.log(`   Entrée: ${JSON.stringify(sampleTime)}`);
console.log(`   Sortie: ${builtDateTime}`);

// Tester les regex de parse
console.log('\n🔧 Test des regex de parsing:\n');

const testStrings = [
    '2026-01-10T11:50:00+01:00',
    '2026-01-10 11:50',
    '2026-01-10T11:50',
];

testStrings.forEach(str => {
    const dateMatch = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    const timeMatch = str.match(/(\d{2}):(\d{2})/);
    
    console.log(`String: "${str}"`);
    console.log(`  Date: ${dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : 'NOT FOUND'}`);
    console.log(`  Time: ${timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : 'NOT FOUND'}`);
    console.log();
});

// Exécuter si pas en mode d'import
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests().catch(console.error);
}

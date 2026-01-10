#!/usr/bin/env node
/**
 * Test OTP v2 avec différents formats de paramètres
 * Teste les formats de date, heure, coordonnées
 */

async function testOTP(testName, params) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🧪 TEST: ${testName}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // Construire l'URL
    const url = new URL('http://79.72.24.141:8080/otp/routers/default/plan');
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
    });
    
    console.log('📍 URL:', url.toString());
    console.log('📋 Paramètres:', JSON.stringify(params, null, 2));
    
    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'User-Agent': 'Perimap-Test/1.0'
            },
            timeout: 5000
        });
        
        console.log(`\n📊 Réponse Status: ${response.status}`);
        
        let data;
        try {
            data = await response.json();
        } catch (e) {
            console.error('❌ JSON Parse Error:', e.message);
            const text = await response.text();
            console.log('Raw response:', text.substring(0, 500));
            return;
        }
        
        if (data.error) {
            console.log('❌ Erreur OTP:', data.error);
            console.log('Détails:', JSON.stringify(data, null, 2));
        } else if (data.plan && data.plan.itineraries) {
            console.log(`✅ SUCCÈS! ${data.plan.itineraries.length} itinéraire(s) trouvé(s)`);
            
            data.plan.itineraries.forEach((itin, idx) => {
                const duration = itin.duration / 1000 / 60;
                const distance = itin.distance / 1000;
                console.log(`   📍 Itinéraire ${idx + 1}: ${duration.toFixed(0)}min, ${distance.toFixed(1)}km`);
                console.log(`      Étapes: ${itin.legs.length}`);
                itin.legs.forEach((leg, legIdx) => {
                    console.log(`        - ${leg.mode} (${(leg.distance/1000).toFixed(1)}km)`);
                });
            });
        } else {
            console.log('⚠️  Réponse inattendue:', JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error('❌ ERREUR FETCH:', error.message);
    }
}

async function runTests() {
    console.log('🚀 TESTS OTP v2 - Formats et Paramètres');
    console.log('Serveur: 79.72.24.141:8080');
    
    // Test 1: Trajet Trélissac → Marsac (example from user)
    await testOTP('Format standard OTP v2 (lat,lon)', {
        fromPlace: '45.195372,0.7808015',
        toPlace: '45.1858333,0.6619444',
        date: '2026-01-10',
        time: '11:50',
        mode: 'TRANSIT,WALK',
        maxWalkDistance: '1000',
        numItineraries: '3'
    });
    
    // Test 2: Coordonnées inversées (lon,lat)
    await testOTP('Format inversé (lon,lat)', {
        fromPlace: '0.7808015,45.195372',
        toPlace: '0.6619444,45.1858333',
        date: '2026-01-10',
        time: '11:50',
        mode: 'TRANSIT,WALK',
        maxWalkDistance: '1000',
        numItineraries: '3'
    });
    
    // Test 3: Sans numItineraries
    await testOTP('Sans numItineraries', {
        fromPlace: '45.195372,0.7808015',
        toPlace: '45.1858333,0.6619444',
        date: '2026-01-10',
        time: '11:50',
        mode: 'TRANSIT'
    });
    
    // Test 4: Mode uniquement WALK
    await testOTP('Mode WALK uniquement', {
        fromPlace: '45.195372,0.7808015',
        toPlace: '45.1858333,0.6619444',
        date: '2026-01-10',
        time: '11:50',
        mode: 'WALK'
    });
    
    // Test 5: Mode uniquement TRANSIT
    await testOTP('Mode TRANSIT uniquement', {
        fromPlace: '45.195372,0.7808015',
        toPlace: '45.1858333,0.6619444',
        date: '2026-01-10',
        time: '11:50',
        mode: 'TRANSIT'
    });
    
    // Test 6: Trajet différent (deux arrêts du réseau)
    await testOTP('Deux arrêts du réseau (Gare → Mairie)', {
        fromPlace: '45.18894,0.73936',  // Gare Périgueux
        toPlace: '45.1873,0.7399',       // Mairie Périgueux
        date: '2026-01-10',
        time: '14:30',
        mode: 'TRANSIT,WALK',
        maxWalkDistance: '1000'
    });
    
    // Test 7: Heure différente
    await testOTP('Heure matinale (08:00)', {
        fromPlace: '45.195372,0.7808015',
        toPlace: '45.1858333,0.6619444',
        date: '2026-01-10',
        time: '08:00',
        mode: 'TRANSIT,WALK'
    });
    
    // Test 8: Date à 5 jours
    await testOTP('Date future (2026-01-15)', {
        fromPlace: '45.195372,0.7808015',
        toPlace: '45.1858333,0.6619444',
        date: '2026-01-15',
        time: '11:50',
        mode: 'TRANSIT,WALK'
    });
    
    console.log('\n✨ Tests terminés!\n');
}

runTests().catch(console.error);

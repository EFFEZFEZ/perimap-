#!/usr/bin/env node
/**
 * Test complet de la simulation de l'Edge Function corrigée
 */

console.log('✅ TEST FINAL - Edge Function avec bug fix');
console.log('═'.repeat(70));

function simulateEdgeFunctionCorrected(body) {
    try {
        // Validation 1: Parameters présents
        if (!body || (!body.fromPlace && !body.origin) || (!body.toPlace && !body.destination)) {
            throw new Error('fromPlace/toPlace ou origin/destination requis');
        }
        
        // Récupérer les valeurs
        let fromPlace = body.fromPlace || body.origin;
        let toPlace = body.toPlace || body.destination;
        let date = body.date;
        let time = body.time;
        
        // Extract just HH:MM if time includes seconds or is ISO format
        let timeFormatted = time;
        if (time.includes('T')) {
            // ISO format like "2026-01-10T11:50:00+01:00" - extract both date and time
            const dateMatchISO = time.match(/^(\d{4})-(\d{2})-(\d{2})/);
            const timeMatch = time.match(/T(\d{2}):(\d{2})/);
            if (dateMatchISO) {
                date = `${dateMatchISO[1]}-${dateMatchISO[2]}-${dateMatchISO[3]}`;
            }
            if (timeMatch) {
                timeFormatted = `${timeMatch[1]}:${timeMatch[2]}`;
            }
        } else if (time.includes(' ')) {
            // Format like "2026-01-10 11:50" - extract time part
            const parts = time.split(' ');
            if (parts.length === 2) {
                date = parts[0];  // Update date from combined string
                timeFormatted = parts[1];
            }
        }
        
        // Also extract date from date field if it's in ISO format
        if (date && date.includes('T')) {
            const dateMatchISO = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (dateMatchISO) {
                date = `${dateMatchISO[1]}-${dateMatchISO[2]}-${dateMatchISO[3]}`;
            }
        }
        
        // Ensure date is YYYY-MM-DD
        if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            throw new Error(`Format date invalide: ${date}`);
        }
        
        // Construire URL OTP
        const otpUrl = new URL('http://79.72.24.141:8080/otp/routers/default/plan');
        otpUrl.searchParams.append('fromPlace', fromPlace);
        otpUrl.searchParams.append('toPlace', toPlace);
        otpUrl.searchParams.append('date', date);
        otpUrl.searchParams.append('time', timeFormatted);
        otpUrl.searchParams.append('mode', body.mode || 'TRANSIT,WALK');
        otpUrl.searchParams.append('maxWalkDistance', body.maxWalkDistance || 1000);
        otpUrl.searchParams.append('numItineraries', body.numItineraries || 3);
        
        return { 
            success: true, 
            url: otpUrl.toString(),
            parsed: { fromPlace, toPlace, date, time: timeFormatted }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

const testCases = [
    {
        name: '✅ Format standard (date séparée)',
        body: {
            fromPlace: '45.195372,0.7808015',
            toPlace: '45.1858333,0.6619444',
            date: '2026-01-10',
            time: '11:50',
            mode: 'TRANSIT'
        },
        expectSuccess: true
    },
    {
        name: '✅ Format ISO datetime (le format envoyé par le frontend)',
        body: {
            fromPlace: '45.195372,0.7808015',
            toPlace: '45.1858333,0.6619444',
            date: '2026-01-10T11:50:00+01:00',
            time: '2026-01-10T11:50:00+01:00',
            mode: 'TRANSIT'
        },
        expectSuccess: true
    },
    {
        name: '✅ Format combiné (datetime en un seul paramètre)',
        body: {
            fromPlace: '45.195372,0.7808015',
            toPlace: '45.1858333,0.6619444',
            date: '2026-01-10 11:50',
            time: '2026-01-10 11:50',
            mode: 'TRANSIT'
        },
        expectSuccess: true
    },
    {
        name: '✅ Format origin/destination',
        body: {
            origin: '45.195372,0.7808015',
            destination: '45.1858333,0.6619444',
            date: '2026-01-10',
            time: '11:50'
        },
        expectSuccess: true
    },
    {
        name: '✅ Format avec ISO date et time normal',
        body: {
            fromPlace: '45.195372,0.7808015',
            toPlace: '45.1858333,0.6619444',
            date: '2026-01-10T00:00:00+01:00',
            time: '11:50',
            mode: 'TRANSIT'
        },
        expectSuccess: true
    },
    {
        name: '❌ Format invalide (date manquante)',
        body: {
            fromPlace: '45.195372,0.7808015',
            toPlace: '45.1858333,0.6619444',
            date: null,
            time: '11:50'
        },
        expectSuccess: false
    }
];

console.log('\n🧪 Exécution des tests:');
console.log('');

let passCount = 0;
let failCount = 0;

testCases.forEach((test, idx) => {
    const result = simulateEdgeFunctionCorrected(test.body);
    const passed = result.success === test.expectSuccess;
    
    if (passed) passCount++;
    else failCount++;
    
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} Test ${idx + 1}: ${test.name}`);
    
    if (result.success) {
        console.log(`   Parsed: date=${result.parsed.date}, time=${result.parsed.time}`);
        console.log(`   fromPlace=${result.parsed.fromPlace}, toPlace=${result.parsed.toPlace}`);
        console.log(`   URL: ${result.url.substring(0, 80)}...`);
    } else {
        console.log(`   Erreur: ${result.error}`);
    }
    console.log('');
});

console.log('═'.repeat(70));
console.log(`\n📊 RÉSULTAT: ${passCount} passés ✅, ${failCount} échoués ❌`);

if (failCount === 0) {
    console.log('\n🎉 TOUS LES TESTS SONT PASSÉS!');
    console.log('\n📋 Prochaine étape:');
    console.log('   1. Redémarrer le serveur OTP sur Oracle Cloud');
    console.log('   2. Déployer les changements vers Vercel');
    console.log('   3. Tester un trajet complet du frontend');
} else {
    console.log('\n⚠️  Certains tests ont échoué - vérifier les corrections');
}

#!/usr/bin/env node
/**
 * Vérifier l'état du serveur OTP sur Oracle Cloud
 */

const { execSync } = require('child_process');

console.log('🔍 Vérification du serveur OTP sur Oracle Cloud');
console.log('═'.repeat(60));

// Ces commandes nécessitent une connexion SSH
// Pour le test, on va juste afficher ce qui devrait être fait

const commands = [
    '# 1. Vérifier si le service PM2 tourne',
    'ssh ubuntu@79.72.24.141 "pm2 status"',
    '',
    '# 2. Vérifier les logs OTP',
    'ssh ubuntu@79.72.24.141 "pm2 logs otp --lines 50 --err"',
    '',
    '# 3. Vérifier la mémoire',
    'ssh ubuntu@79.72.24.141 "free -h && ps aux | grep otp"',
    '',
    '# 4. Tester l\'API OTP localement',
    'ssh ubuntu@79.72.24.141 "curl -s http://localhost:8080/otp/routers/default | head -100"',
];

console.log('Commandes à exécuter manuellement:\n');
commands.forEach(cmd => {
    if (cmd.startsWith('#')) {
        console.log(`\n${cmd}`);
    } else if (cmd) {
        console.log(`  ${cmd}`);
    }
});

console.log('\n\n📌 Alternative: Vérification locale');
console.log('═'.repeat(60));

const testUrls = [
    'http://79.72.24.141:8080/otp/routers',
    'http://79.72.24.141:8080/otp/routers/default',
    'http://79.72.24.141:8080/otp/v2/routers/default/plan?fromPlace=45.195372,0.7808015&toPlace=45.1858333,0.6619444&date=2026-01-10&time=11:50',
];

console.log('\n❓ Le serveur OTP devrait répondre sur une de ces URLs:');
testUrls.forEach((url, idx) => {
    console.log(`${idx + 1}. ${url}`);
});

console.log('\n⚠️  NOTE: Les tests Node.js du `fetch` ont échoué.');
console.log('Cela signifie que:');
console.log('  - Le serveur n\'est pas accessible depuis Windows');
console.log('  - Possible raison: Pare-feu Oracle Cloud, serveur arrêté, ou IP incorrecte');
console.log('  - Action: Vérifier l\'état du serveur via le Dashboard Oracle Cloud');

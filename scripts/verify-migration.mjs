#!/usr/bin/env node

/**
 * verify-migration.mjs
 * Script de vérification post-migration
 * Phase 7: Final Verification
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Colors for terminal output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
    const fullPath = path.join(rootDir, filePath);
    const exists = fs.existsSync(fullPath);
    
    if (exists) {
        const stats = fs.statSync(fullPath);
        const lines = fs.readFileSync(fullPath, 'utf-8').split('\n').length;
        log(`✅ ${description} (${lines} lignes)`, 'green');
        return true;
    } else {
        log(`❌ ${description} - MANQUANT`, 'red');
        return false;
    }
}

function main() {
    log('\n🔍 VÉRIFICATION MIGRATION ARCHITECTURALE', 'blue');
    log('==========================================\n', 'blue');
    
    let totalChecks = 0;
    let passedChecks = 0;
    
    // Phase 1: Foundation
    log('📦 Phase 1: Foundation', 'yellow');
    const phase1Files = [
        ['public/js/EventBus.js', 'EventBus'],
        ['public/js/StateManager.js', 'StateManager'],
        ['public/js/Logger.js', 'Logger']
    ];
    
    phase1Files.forEach(([file, desc]) => {
        totalChecks++;
        if (checkFile(file, desc)) passedChecks++;
    });
    
    // Phase 2: API Services
    log('\n🌐 Phase 2: API Services', 'yellow');
    const phase2Files = [
        ['public/js/services/RouteService.js', 'RouteService'],
        ['public/js/services/GeocodeService.js', 'GeocodeService'],
        ['public/js/services/AutocompleteService.js', 'AutocompleteService'],
        ['public/js/services/APIServiceFactory.js', 'APIServiceFactory'],
        ['public/js/services/index.js', 'Services index']
    ];
    
    phase2Files.forEach(([file, desc]) => {
        totalChecks++;
        if (checkFile(file, desc)) passedChecks++;
    });
    
    // Phase 3: Data Stores
    log('\n💾 Phase 3: Data Stores', 'yellow');
    const phase3Files = [
        ['public/js/stores/GTFSStore.js', 'GTFSStore'],
        ['public/js/stores/TrafficStore.js', 'TrafficStore'],
        ['public/js/stores/UserStore.js', 'UserStore'],
        ['public/js/stores/CacheStore.js', 'CacheStore'],
        ['public/js/stores/DataStoreFactory.js', 'DataStoreFactory'],
        ['public/js/stores/index.js', 'Stores index']
    ];
    
    phase3Files.forEach(([file, desc]) => {
        totalChecks++;
        if (checkFile(file, desc)) passedChecks++;
    });
    
    // Phase 4: UI Components
    log('\n🎨 Phase 4: UI Components', 'yellow');
    const phase4Files = [
        ['public/js/components/MapComponent.js', 'MapComponent'],
        ['public/js/components/SearchBoxComponent.js', 'SearchBoxComponent'],
        ['public/js/components/index.js', 'Components index']
    ];
    
    phase4Files.forEach(([file, desc]) => {
        totalChecks++;
        if (checkFile(file, desc)) passedChecks++;
    });
    
    // Phase 5: CSS Atomization
    log('\n💅 Phase 5: CSS Atomization', 'yellow');
    const phase5Files = [
        ['public/css/_config.css', 'CSS Config'],
        ['public/css/_reset.css', 'CSS Reset'],
        ['public/css/components/button.css', 'Button CSS'],
        ['public/css/components/card.css', 'Card CSS'],
        ['public/css/components/form.css', 'Form CSS'],
        ['public/css/components/nav.css', 'Nav CSS'],
        ['public/css/components/modal.css', 'Modal CSS']
    ];
    
    phase5Files.forEach(([file, desc]) => {
        totalChecks++;
        if (checkFile(file, desc)) passedChecks++;
    });
    
    // Phase 6: Tests
    log('\n🧪 Phase 6: Tests', 'yellow');
    const phase6Files = [
        ['tests/unit/EventBus.test.js', 'EventBus Tests'],
        ['tests/unit/StateManager.test.js', 'StateManager Tests'],
        ['tests/unit/RouteService.test.js', 'RouteService Tests']
    ];
    
    phase6Files.forEach(([file, desc]) => {
        totalChecks++;
        if (checkFile(file, desc)) passedChecks++;
    });
    
    // Phase 7: Documentation
    log('\n📚 Phase 7: Documentation', 'yellow');
    const phase7Files = [
        ['ARCHITECTURE.md', 'Architecture doc'],
        ['MIGRATION_GUIDE.md', 'Migration guide'],
        ['PHASE7_MIGRATION_COMPLETION.md', 'Phase 7 report'],
        ['DEPLOYMENT_CHECKLIST.md', 'Deployment checklist'],
        ['SESSION_FINALE_RESUME.md', 'Session finale']
    ];
    
    phase7Files.forEach(([file, desc]) => {
        totalChecks++;
        if (checkFile(file, desc)) passedChecks++;
    });
    
    // Service Worker
    log('\n⚙️ Service Worker', 'yellow');
    totalChecks++;
    const swPath = path.join(rootDir, 'public/service-worker.js');
    if (fs.existsSync(swPath)) {
        const swContent = fs.readFileSync(swPath, 'utf-8');
        if (swContent.includes('v448')) {
            log('✅ Service Worker v448', 'green');
            passedChecks++;
        } else {
            log('❌ Service Worker - Version incorrecte', 'red');
        }
    } else {
        log('❌ Service Worker - MANQUANT', 'red');
    }
    
    // Summary
    log('\n' + '='.repeat(50), 'blue');
    const percentage = Math.round((passedChecks / totalChecks) * 100);
    
    if (percentage === 100) {
        log(`\n🎉 MIGRATION 100% COMPLÈTE!`, 'green');
        log(`✅ ${passedChecks}/${totalChecks} vérifications passées`, 'green');
    } else if (percentage >= 90) {
        log(`\n⚠️ Migration presque complète (${percentage}%)`, 'yellow');
        log(`✅ ${passedChecks}/${totalChecks} vérifications passées`, 'yellow');
    } else {
        log(`\n❌ Migration incomplète (${percentage}%)`, 'red');
        log(`✅ ${passedChecks}/${totalChecks} vérifications passées`, 'red');
    }
    
    log('');
    
    // Exit code
    process.exit(percentage === 100 ? 0 : 1);
}

main();

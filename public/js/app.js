/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
import { loadBaseLayout } from './viewLoader.js';
import { bootstrapApp } from './main.js';

function setMetaContent(selector, content) {
    if (!content) return;
    const el = document.querySelector(selector);
    if (el) {
        el.setAttribute('content', content);
        return;
    }
    // Create missing meta tags when needed (keeps SEO consistent even if tags evolve)
    const meta = document.createElement('meta');
    if (selector.startsWith('meta[name="')) {
        const name = selector.slice('meta[name="'.length, -2);
        meta.setAttribute('name', name);
    } else if (selector.startsWith('meta[property="')) {
        const property = selector.slice('meta[property="'.length, -2);
        meta.setAttribute('property', property);
    } else {
        return;
    }
    meta.setAttribute('content', content);
    document.head.appendChild(meta);
}

function applySeo({ title, description }) {
    if (title) document.title = title;
    if (description) setMetaContent('meta[name="description"]', description);

    // Social previews
    if (title) {
        setMetaContent('meta[property="og:title"]', title);
        setMetaContent('meta[name="twitter:title"]', title);
    }
    if (description) {
        setMetaContent('meta[property="og:description"]', description);
        setMetaContent('meta[name="twitter:description"]', description);
    }
}

function getHashRouteAndParams() {
    const raw = (window.location.hash || '').replace(/^#/, '').trim();
    if (!raw) return { route: '', params: new URLSearchParams() };

    const qIndex = raw.indexOf('?');
    if (qIndex === -1) {
        return { route: raw, params: new URLSearchParams() };
    }
    const route = raw.slice(0, qIndex);
    const query = raw.slice(qIndex + 1);
    return { route, params: new URLSearchParams(query) };
}

function configureDynamicSeo() {
    const BRAND = 'PériMap';

    const updateFromHash = () => {
        const { route, params } = getHashRouteAndParams();
        const normalized = (route || '').toLowerCase();

        const lineParam = (params.get('ligne') || params.get('line') || params.get('route') || '').trim();
        const lineLabel = lineParam ? lineParam.toUpperCase() : '';

        // Default (home)
        if (!normalized) {
            applySeo({
                title: `Péribus - Horaires & Itinéraires Bus Périgueux | ${BRAND}`,
                description: `Horaires Péribus en temps réel, itinéraires (trajets), carte du réseau et infos voyageurs à Périgueux. ${BRAND} : application gratuite.`
            });
            return;
        }

        if (normalized === 'horaires') {
            applySeo({
                title: lineLabel
                    ? `${BRAND} — Horaires ligne ${lineLabel} Péribus`
                    : `${BRAND} — Liste des lignes Péribus`,
                description: lineLabel
                    ? `Consultez les horaires de la ligne ${lineLabel} Péribus (Grand Périgueux) avec ${BRAND}. Prochains passages, arrêts et détails de la ligne.`
                    : `Retrouvez la liste des lignes Péribus et accédez aux horaires par ligne avec ${BRAND} (Grand Périgueux).`
            });
            return;
        }

        if (normalized === 'itineraire') {
            applySeo({
                title: `${BRAND} — Itinéraires Péribus (trajets)` ,
                description: `Calculez votre trajet Péribus à Périgueux : itinéraires, correspondances, marche et temps estimés. ${BRAND} simplifie vos déplacements.`
            });
            return;
        }

        if (normalized === 'trafic' || normalized === 'info-trafic') {
            applySeo({
                title: `${BRAND} — Informations voyageurs Péribus`,
                description: `Suivez les informations voyageurs Péribus : perturbations, état des lignes et messages trafic. Mis à jour régulièrement sur ${BRAND}.`
            });
            return;
        }

        if (normalized === 'carte') {
            applySeo({
                title: `${BRAND} — Carte du réseau Péribus`,
                description: `Explorez la carte du réseau Péribus : lignes, arrêts et déplacements autour de Périgueux. ${BRAND} sur mobile et desktop.`
            });
            return;
        }

        if (normalized === 'tarifs' || normalized === 'tarifs-grille' || normalized === 'tarifs-achat' || normalized === 'tarifs-billettique' || normalized === 'tarifs-amendes') {
            applySeo({
                title: `${BRAND} — Tarifs Péribus`,
                description: `Tarifs et billetterie Péribus : grille, achat, billettique et amendes. Retrouvez les infos utiles sur ${BRAND}.`
            });
            return;
        }

        // Fallback: keep current static SEO
    };

    // Initial hash (important because main.js cleans it via replaceState)
    updateFromHash();
    window.addEventListener('hashchange', updateFromHash);
}

/**
 * Enregistre le Service Worker avec détection automatique des mises à jour
 */
async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.log('[App] Service Worker non supporté');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('[App] Service Worker enregistré');

        // Vérifie les mises à jour au démarrage
        registration.update();

        // Écoute les mises à jour du SW
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('[App] Nouvelle version du Service Worker détectée');

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Nouvelle version prête: activer immédiatement (update fluide)
                    // + garde un fallback visuel si l'activation est bloquée.
                    try {
                        newWorker.postMessage('skipWaiting');
                    } catch (e) {
                        // ignore
                    }
                    showUpdateNotification(registration);
                }
            });
        });

        // Si le SW est déjà installé et qu'il y a une mise à jour en attente
        if (registration.waiting) {
            // On tente d'activer tout de suite.
            try {
                registration.waiting.postMessage('skipWaiting');
            } catch (e) {
                // ignore
            }
            showUpdateNotification(registration);
        }

        // Recharge automatiquement quand le nouveau SW prend le contrôle
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                console.log('[App] Nouveau Service Worker actif, rechargement...');
                window.location.reload();
            }
        });

        // Re-check updates when user comes back to the tab (keeps updates snappy)
        window.addEventListener('focus', () => {
            try { registration.update(); } catch (e) { /* ignore */ }
        });

    } catch (error) {
        console.warn('[App] Erreur enregistrement Service Worker:', error);
    }
}

/**
 * Affiche une notification discrète pour informer de la mise à jour
 */
function showUpdateNotification(registration) {
    // Évite les doublons
    if (document.getElementById('update-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.innerHTML = `
        <div class="update-banner-content">
            <span>?? Une nouvelle version est disponible</span>
            <button id="update-btn" class="btn btn-primary btn-sm">Mettre à jour</button>
            <button id="update-dismiss" class="btn-icon-round" aria-label="Fermer">×</button>
        </div>
    `;
    banner.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg-main, #fff);
        border: 2px solid var(--primary, #22c55e);
        border-radius: 12px;
        padding: 12px 16px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideUp 0.3s ease;
    `;

    document.body.appendChild(banner);

    // Bouton "Mettre à jour" - force le rechargement
    document.getElementById('update-btn').addEventListener('click', async () => {
        try {
            const reg = registration || await navigator.serviceWorker.getRegistration();
            // IMPORTANT: il faut envoyer skipWaiting au worker en attente, pas au controller actuel.
            if (reg?.waiting) {
                reg.waiting.postMessage('skipWaiting');
                return;
            }
            if (reg?.installing) {
                reg.installing.postMessage('skipWaiting');
                return;
            }
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage('skipWaiting');
            }
        } catch (e) {
            // fallback
            window.location.reload();
        }
    });

    // Bouton fermer
    document.getElementById('update-dismiss').addEventListener('click', () => {
        banner.remove();
    });
}

async function startApplication() {
    try {
        // Enregistre le SW en premier (non-bloquant)
        registerServiceWorker();

        // SEO dynamique (titres/snippets) pour les URLs avec hash (/#horaires, /#itineraire, etc.)
        // Important: main.js nettoie le hash après navigation, donc on doit le lire très tôt.
        configureDynamicSeo();
        
        await loadBaseLayout();
        await bootstrapApp();
    } catch (error) {
        console.error("[app] Echec du demarrage de l'interface", error);
    }
}

startApplication();



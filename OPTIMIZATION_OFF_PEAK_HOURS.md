# 🌙 Optimisation des Requêtes API - Heures Creuses

## Vue d'ensemble

Optimisation mise en place pour réduire la consommation des requêtes Vercel Free Plan en désactivant le GTFS Realtime pendant les heures de faible utilisation.

**Plage horaire optimisée:** 21h00 à 05h30 (8h30 de service réduit par jour)

## 📊 Impact Estimé

- **Réduction de requêtes:** ~35% des requêtes supprimées (faible trafic nocturne)
- **Économie:** Environ 10-15 requêtes par jour économisées sur le free plan Vercel
- **UX Impact:** Minimal (transports décalés après 21h, service redémarre à 5h30)

## 🔧 Modifications Effectuées

### 1. API Server (`/api/realtime.js`)

#### Fonction: `isInBlackoutWindow()`
- **Ligne:** ~99
- **Description:** Vérifie si l'heure actuelle est dans la fenêtre d'extinction (21h-5h30)
- **Logique:**
  - Entre 21h00 et 23h59 → Retourne `true`
  - Entre 00h00 et 04h59 → Retourne `true`
  - Entre 05h00 et 05h29 → Retourne `true`
  - Autres heures → Retourne `false`

#### Handler Principal
- **Ligne:** ~351
- **Changement:** Ajout de vérification en début du handler
- **Comportement:**
  ```javascript
  if (isInBlackoutWindow()) {
      return res.status(503).json({ 
          error: 'Service unavailable during off-peak hours (21h00 - 05h30)',
          timestamp: now.toISOString(),
          reason: 'GTFS Realtime disabled to optimize Vercel Free Plan usage',
          availableFrom: '05h30 CET',
          service: 'realtime'
      });
  }
  ```
- **Réponse:** HTTP 503 avec message explicatif

### 2. Client (`/public/js/realtimeManager.js`)

#### Fonction: `isInBlackoutWindow()`
- **Ligne:** ~62
- **Description:** Équivalent client de la vérification serveur
- **Usage:** Validation côté client avant de lancer les requêtes

#### Fonction: `calculateNextServiceStartTime()`
- **Ligne:** ~88
- **Description:** Calcule le timestamp du prochain redémarrage du service (5h30)
- **Retour:** Timestamp du prochain 5h30

#### Modification: `init()`
- **Ligne:** ~119
- **Description:** Activation automatique du mode sleep si nous sommes en heures creuses
- **Logique:**
  ```javascript
  if (this.isInBlackoutWindow()) {
      const nextStart = this.calculateNextServiceStartTime();
      this.setSleepUntil(nextStart);
      console.log('[Realtime] ⏸️  Service en heures creuses (21h-5h30) - Mode sleep activé');
  }
  ```
- **Effet:** 
  - Aucun préchargement des arrêts prioritaires
  - Aucun auto-refresh
  - Requêtes bloquées avec cache best-effort uniquement

#### Mode Sleep Existant
- **Méthode:** `isSleeping()`
- **Utilisation:** Le mode sleep existant est activé automatiquement via `calculateNextServiceStartTime()`
- **Bénéfice:** L'infrastructure sleep était déjà en place, nous l'utilisons pour l'optimisation

## 🔄 Flux de Fonctionnement

### Pendant les heures creuses (21h00 - 05h29)

```
Utilisateur ouvre l'app → init() détecte blackout → sleep activé
                      ↓
                Client: pas de requêtes
                Aucun preload des arrêts prioritaires
                Aucun auto-refresh
                Cache utilisé si disponible
                      ↓
Utilisateur demande data → fetch → serveur retourne 503
                      ↓
                Client affiche cache ou message "Service indisponible"
```

### Après 05h30

```
Service redémarre automatiquement
                      ↓
                init() détecte end of blackout
                Mode sleep désactivé
                      ↓
Préchargement BATCH des arrêts prioritaires
Auto-refresh toutes les 60 secondes
Service normal
```

## 📋 Détails Techniques

### Horaires Vercel Free Plan
- La limitation ne s'applique que pendant les heures non-opérationnelles du transport
- Les transports à Périgueux commencent à 5h30 du matin
- Les transports s'arrêtent aux alentours de 21h00 (derniers bus)

### Séquence Temporelle (24h)

| Heure | État | Action |
|-------|------|--------|
| 05h30 | Service ON | Réactivation, préchargement batch |
| 05h31-21h00 | Service ON | Fonctionnement normal, auto-refresh 60s |
| 21h00 | Transition | Extinction progressive |
| 21h01-05h29 | Service OFF | Mode sleep, pas de requêtes |
| 05h30 | Service ON | Réactivation |

### Résilience & Fallback
- Cache local conservé pendant la période creuse
- Données stale disponibles si demandées (mode sleep renvoie cache best-effort)
- Utilisateurs peuvent forcer un refresh après 5h30 (app redémarre automatiquement)

## 🛡️ Considérations

### Cas Limites
1. **Changement d'heure:** Adaptation automatique (JS utilise la date/heure du système)
2. **Rechargement de page:** Détection du blackout à chaque init()
3. **Requête manuelle:** Serveur refuse avec 503 même si client en sleep

### Monitoring
- Logs côté client: `[Realtime] ⏸️  Service en heures creuses (21h-5h30) - Mode sleep activé`
- Logs côté serveur: Pas de logs lors du blackout (requêtes rejetées rapidement)
- Réponse HTTP: 503 Service Unavailable avec raison explicite

## 🚀 Déploiement

Les modifications sont prêtes pour déploiement sur Vercel:
- ✅ `/api/realtime.js` - Serveur rejet les requêtes
- ✅ `/public/js/realtimeManager.js` - Client évite les requêtes

Aucune variable d'environnement requise, configuration basée sur l'heure du système.

## 📈 Métriques à Monitorer

Après déploiement, vérifier:
- Réduction du nombre de requêtes vers `/api/realtime` après 21h
- Pas d'erreurs 5xx dues à la nouvelle logique (les 503 sont intentionnels)
- Cache client utilisé correctement en heures creuses
- Redémarrage correct du service à 05h30

## 🔌 Intégration Future

Possibilité d'amélioration:
- Ajouter une variable d'env pour configurer les horaires (si changement futur)
- Monitoring des coûts Vercel pour valider l'économie
- Notification utilisateur dynamique des heures d'indisponibilité

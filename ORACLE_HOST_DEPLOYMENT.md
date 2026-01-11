# Oracle Host Deployment — Inventaire et plan de consolidation

Date: 2026-01-10
Auteur: équipe Peribus (document généré automatiquement)

Résumé
- Objectif: n'avoir qu'une seule API active, un seul moteur RAPTOR canonique, et un emplacement GTFS canonique sur la VM Oracle (éviter plusieurs copies dispersées).
- Arbre actif retenu comme canonical: `/home/ubuntu/peribus` (géré par PM2 sous le nom `peribus`).

Inventaire (résumé des chemins trouvés)
- Arbre actif recommandé (canonique): `/home/ubuntu/peribus`
- Autres copies/deploys observés: `/home/ubuntu/perimap-`, `/home/ubuntu/dist`, `/home/ubuntu/peribus_backup_*`
- Fichiers OTP: `/home/ubuntu/otp/otp-shaded.jar`, `/home/ubuntu/otp/graph.obj`
- GTFS trouvés dans plusieurs emplacements: `/home/ubuntu/peribus/public/data/gtfs`, `/home/ubuntu/perimap-/public/data/gtfs`, et des backups
- Fichiers RAPTOR/routeur natif (copies multiples): `server/core/pathfinding/raptor.js` (dans `peribus`, `perimap-`, backups)
- Service glue: `server/services/nativeRouterService.js` (copies multiples)

But: garder OTP séparé dans `/home/ubuntu/otp` est acceptable — OTP peut coexister mais ne doit pas être dupliqué dans des arbres applicatifs.

Règles/canonique
- Canonical API & code: `/home/ubuntu/peribus`
- Canonical GTFS: `/home/ubuntu/peribus/public/data/gtfs` (symlink possible vers un stockage central)
- Canonical RAPTOR implementation: `server/core/pathfinding/raptor.js` dans le tree `peribus`
- OTP runtime (si utilisé): rester dans `/home/ubuntu/otp` (ne pas dupliquer dans `peribus`)

Plan de consolidation (phases)
1) Préparation (sauvegarde + vérifications) — SAFE
- Créer un répertoire d'archive central: `/home/ubuntu/peribus_archives/YYYYMMDD/`
- Vérifier checksums et diffs entre copies avant déplacement:

```bash
ssh ubuntu@79.72.24.141
# créer archive dir
mkdir -p /home/ubuntu/peribus_archives/$(date +%F)
# lister et checksum des copies
sha256sum /home/ubuntu/peribus/server/core/pathfinding/raptor.js \
  /home/ubuntu/perimap-/server/core/pathfinding/raptor.js || true
# diff rapide
diff -u /home/ubuntu/peribus/server/core/pathfinding/raptor.js \
  /home/ubuntu/perimap-/server/core/pathfinding/raptor.js || true
```

2) Déclarer le canonique et faire une simulation (dry-run)
- S'assurer que `/home/ubuntu/peribus` contient la version finale souhaitée du code (celle testée).
- Préparer un script `consolidate.sh --dry-run` qui affiche actions (mv, ln -s) sans les exécuter.

3) Exécution safe (après approbation)
- Stopper le service PM2 temporairement:

```bash
pm2 stop peribus
pm2 save
```

- Déplacer/archiver les copies non-canonique:

```bash
# exemple: archiver perimap- copies
mv /home/ubuntu/perimap-/server/core/pathfinding/raptor.js \
  /home/ubuntu/peribus_archives/$(date +%F)/raptor.perimap.js
# créer un symlink vers la copie canonique si besoin
ln -sfn /home/ubuntu/peribus/server/core/pathfinding/raptor.js \
  /home/ubuntu/perimap-/server/core/pathfinding/raptor.js
```

- Pour GTFS: conserver une seule copie et créer un symlink depuis les anciens emplacements:

```bash
mv /home/ubuntu/perimap-/public/data/gtfs /home/ubuntu/peribus/public/data/gtfs_backup_$(date +%F)
ln -sfn /home/ubuntu/peribus/public/data/gtfs /home/ubuntu/perimap-/public/data/gtfs
```

- Redémarrer le service et tester l'API:

```bash
pm2 restart peribus
# vérifier écoute
ss -ltnp | grep 3000
# exécuter un POST de test (depuis le serveur) et valider réponse
curl -s -X POST http://127.0.0.1:3000/api/routes -H 'Content-Type: application/json' \
  --data-binary @/path/to/test-payload.json | jq .
```

4) Rollback plan
- Si erreur, restaurer les fichiers depuis `/home/ubuntu/peribus_archives/YYYYMMDD/` et redémarrer PM2.
- Toujours garder au moins une copie archivée.

Vérifications post-consolidation
- Exécuter checksums pour s'assurer que le code canonique n'a pas été modifié.
- Lancer un jeu de tests d'itinéraires (ex: payloads pour 07:30, 11:30, 19:00) et valider sorties attendues.

Sécurité & Permissions
- Actions ci-dessus requièrent accès `ubuntu` (sudo non nécessaire si propriétaire). Vérifier permissions après move/ln -s.

Propositions opérationnelles (choix)
- Option A (consolidation assistée) — j'exécute le script de consolidation (après approbation). Je ferai un dry-run puis l'exécution réelle.
- Option B (audit + diff) — je produis un rapport de diff/checksum détaillé pour révision avant toute modification.

Prochaine étape recommandée
- Confirmez l'option: `A` pour que j'exécute la consolidation (je ferai snapshot+archive+DRY-RUN puis exécution), ou `B` pour que je fournisse le rapport diffs/checksums.

Notes finales
- Ne pas supprimer OTP dans `/home/ubuntu/otp` — le garder séparé.
- S'engager à garder un seul arbre actif (ici `/home/ubuntu/peribus`) simplifiera les déploiements futurs et la maintenance.

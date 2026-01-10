# 🔧 DIAGNOSTIC SERVEUR OTP - Commandes à Exécuter

## 📋 PROCÉDURE COMPLÈTE DE DIAGNOSTIC

### ÉTAPE 1: Connexion SSH
```bash
ssh ubuntu@79.72.24.141
```

---

### ÉTAPE 2: Vérifier le statut PM2

```bash
# Voir tous les services
pm2 status

# Expected output:
# ┌─────┬────────┬─────────┬──────┬───────┬────────┬─────────┐
# │ id  │ name   │ version │ mode │ pid   │ status │ restart │
# ├─────┼────────┼─────────┼──────┼───────┼────────┼─────────┤
# │ 0   │ otp    │ N/A     │ fork │ XXXXX │ online │ 0       │
# └─────┴────────┴─────────┴──────┴───────┴────────┴─────────┘

# Si status = "stopped" ou "errored" → Problème!
```

---

### ÉTAPE 3: Vérifier les logs OTP

```bash
# Voir les 50 dernières lignes de logs
pm2 logs otp --lines 50

# Ou voir les erreurs spécifiquement
pm2 logs otp --err

# Ou voir en temps réel (Ctrl+C pour arrêter)
pm2 logs otp --tail --lines 30
```

**Ce qu'il faut chercher:**
- `java.lang.OutOfMemoryError` → Mémoire pleine
- `Address already in use` → Port 8080 occupé
- `NullPointerException` → Erreur dans OTP
- `Graph.obj not found` → Fichier graph manquant
- Autres exceptions Java

---

### ÉTAPE 4: Vérifier l'utilisation mémoire

```bash
# Voir la mémoire disponible
free -h

# Output attendu:
#               total        used        free      shared  buff/cache   available
# Mem:           976M        650M        150M         30M        176M        200M
# Swap:          4.0G        512M        3.5G

# ⚠️ Problème si: used > 900M (plus de 90%)
# ⚠️ Problème si: free < 50M
```

```bash
# Voir les processus utilisant le plus de mémoire
ps aux --sort=-%mem | head -10

# Chercher le processus OTP (java)
# Si la mémoire est très élevée (> 900M), OTP peut être bloqué
```

---

### ÉTAPE 5: Vérifier l'utilisation CPU

```bash
# Vue instantanée
top -n 1

# Ou plus détaillé
ps aux | grep java

# Chercher le process OTP (java -jar otp-shaded.jar)
# Note: Peut utiliser 100% CPU si en train de charger le graph
```

---

### ÉTAPE 6: Vérifier les fichiers OTP

```bash
# Aller au répertoire OTP
cd /home/otp

# Vérifier que les fichiers existent
ls -lh

# Expected:
# -rw-r--r-- otp otp 208M Jan 10 XX:XX graph.obj
# -rw-r--r-- otp otp  50M Jan 10 XX:XX otp-shaded.jar
# drwxr-xr-x otp otp 4.0K Jan 10 XX:XX data/

# Vérifier le graph.obj
ls -lh graph.obj
# Doit être ~208MB et avec date récente

# Vérifier le jar
ls -lh otp-shaded.jar
# Doit exister et être executable
```

---

### ÉTAPE 7: Test local du serveur

```bash
# Sur le serveur Oracle, tester localement
curl -s http://localhost:8080/otp/routers/default | head -50

# Ou avec une requête de test
curl -s "http://localhost:8080/otp/routers/default/plan?fromPlace=45.195372,0.7808015&toPlace=45.1858333,0.6619444&date=2026-01-10&time=11:50" | jq .

# Ou sans jq:
curl -s "http://localhost:8080/otp/routers/default/plan?fromPlace=45.195372,0.7808015&toPlace=45.1858333,0.6619444&date=2026-01-10&time=11:50"
```

**Réponse attendue:**
- Doit contenir `"plan"` avec `"itineraries"`
- OU contenir un message d'erreur expliquant pourquoi pas d'itinéraires
- ❌ Pas de réponse → Serveur pas accessible

---

### ÉTAPE 8: Vérifier si le port 8080 est en écoute

```bash
# Voir les ports en écoute
netstat -tlnp | grep 8080

# Ou avec ss (plus moderne):
ss -tlnp | grep 8080

# Expected:
# tcp  LISTEN 0  128 0.0.0.0:8080  0.0.0.0:*  pid/java

# Si pas de résultat → OTP n'écoute pas sur 8080
```

---

### ÉTAPE 9: Vérifier le pare-feu

```bash
# Voir les règles iptables
sudo iptables -L -n | grep 8080

# Ou vérifier si le pare-feu bloque
sudo ufw status
sudo ufw allow 8080/tcp

# Vérifier le statut firewall Oracle Cloud:
# Aller sur https://cloud.oracle.com/networking/vcns
# Vérifier le security list pour le port 8080
```

---

## 🔄 ACTIONS CORRECTIVES

### Scenario 1: OTP est arrêté
```bash
# Redémarrer
pm2 restart otp

# Attendre 5-10 secondes
sleep 10

# Vérifier le statut
pm2 status

# Vérifier les logs
pm2 logs otp --tail --lines 20
```

### Scenario 2: OTP crash avec OutOfMemory
```bash
# Le serveur n'a que 1GB RAM
# Lancer OTP avec moins de mémoire:

# D'abord, arrêter
pm2 stop otp

# Éditer le fichier de démarrage ou augmenter la swap
# Vérifier la swap:
free -h

# Si swap insufficient, l'ajouter:
# Mais c'est complexe. Mieux vaut monitorer.

# Redémarrer
pm2 start otp

# Monitorer
pm2 monit
```

### Scenario 3: OTP utilise 100% CPU
```bash
# Normal au démarrage (charger le graph)
# Peut prendre 30-60 secondes

# Attendre 2 minutes
sleep 120

# Vérifier l'utilisation CPU maintenant
top -n 1 | head -20

# Si toujours 100%, il y a un problème
# Vérifier les logs:
pm2 logs otp --tail --lines 50
```

### Scenario 4: Port 8080 déjà utilisé
```bash
# Voir quel process utilise le port
lsof -i :8080
# ou
netstat -tlnp | grep 8080

# Arrêter le processus conflictuel
sudo kill -9 <PID>

# Redémarrer OTP
pm2 restart otp
```

---

## 📊 CHECKLIST DIAGNOSTIC

```
[ ] SSH connexion réussie
[ ] pm2 status montre "online"
[ ] pm2 logs otp sans erreurs Java
[ ] free -h montre < 85% RAM utilisée
[ ] ps aux | grep java montre le process OTP
[ ] graph.obj existe et fait 208MB
[ ] curl http://localhost:8080/otp/routers/default répond
[ ] netstat montre port 8080 en LISTEN
[ ] Pas de pare-feu bloquant
[ ] Test depuis Windows (curl) répond

Si tous les cases sont cochés: ✅ OTP est OK!
```

---

## 🧪 TEST DE BOUT EN BOUT

Une fois OTP réparé:

```bash
# 1. Depuis le serveur Oracle
curl -s "http://localhost:8080/otp/routers/default/plan?fromPlace=45.195372,0.7808015&toPlace=45.1858333,0.6619444&date=2026-01-10&time=11:50" | jq '.plan.itineraries[0] | {duration, legs}'

# 2. Depuis Windows (quitter SSH d'abord)
# Dans PowerShell:
Invoke-WebRequest -Uri "http://79.72.24.141:8080/otp/routers/default/plan?fromPlace=45.195372,0.7808015&toPlace=45.1858333,0.6619444&date=2026-01-10&time=11:50" | ConvertFrom-Json | Select-Object -ExpandProperty plan | Select-Object -ExpandProperty itineraries | Select-Object duration,legs

# 3. Tester via Edge Function Vercel
# Faire un POST vers https://perimap.fr/api/routes avec:
# {
#   fromPlace: "45.195372,0.7808015",
#   toPlace: "45.1858333,0.6619444",
#   date: "2026-01-10",
#   time: "11:50"
# }
```

---

## 📈 MONITORING À LONG TERME

```bash
# Monitorer en temps réel
pm2 monit

# Voir l'historique des restarts
pm2 web
# Puis aller sur http://localhost:9615

# Configuration pour redémarrer automatiquement si crash:
# Déjà configuré dans ecosystem.config.js
```

---

## ✨ RÉSUMÉ

**Si tout est vert après ce diagnostic → OTP fonctionne et le système est opérationnel! 🚀**

Besoin d'aide? Vérifier:
- Les logs: `pm2 logs otp`
- La mémoire: `free -h`
- La connectivité: `curl http://localhost:8080/otp/routers`

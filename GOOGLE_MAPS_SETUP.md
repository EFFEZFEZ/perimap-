# Configuration de l'API Google Maps

## Erreur RefererNotAllowedMapError

Si vous voyez l'erreur suivante dans la console du navigateur :

```
Google Maps JavaScript API error: RefererNotAllowedMapError
Your site URL to be authorized: https://peribus-snowy.vercel.app/
```

Cela signifie que l'URL de votre site n'est pas autorisée à utiliser votre clé API Google Maps.

## Comment résoudre ce problème

1. **Connectez-vous à Google Cloud Console** : https://console.cloud.google.com/

2. **Accédez à la section APIs & Services > Credentials**

3. **Cliquez sur votre clé API** (celle utilisée dans l'application)

4. **Dans la section "Application restrictions"**, choisissez "HTTP referrers (web sites)"

5. **Ajoutez les URLs autorisées** :
   - Pour le développement local : `http://localhost/*` et `http://127.0.0.1/*`
   - Pour Vercel : `https://peribus-snowy.vercel.app/*`
   - Pour d'autres domaines : `https://votre-domaine.com/*`

6. **Sauvegardez les modifications**

## Note importante

- L'astérisque (`*`) est nécessaire pour autoriser toutes les pages du site
- Les changements peuvent prendre quelques minutes pour se propager
- Assurez-vous d'activer les APIs nécessaires :
  - Maps JavaScript API
  - Places API
  - Geocoding API
  - Routes API (si utilisée)

## Sécurité

⚠️ **Ne partagez jamais votre clé API publiquement** ⚠️

Pour une meilleure sécurité :
- Utilisez des restrictions de referrer HTTP
- Activez uniquement les APIs dont vous avez besoin
- Surveillez l'utilisation de votre clé via la console Google Cloud
- Configurez des quotas et des alertes de facturation

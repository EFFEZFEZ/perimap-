/**
 * API Vercel Serverless pour récupérer le token admin
 * Route: /api/admin-token
 * Sécurité: Nécessite le bon mot de passe
 */

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body || {};
  
  // Vérifier le mot de passe
  if (password !== 'lou23') {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Retourner le token depuis les variables d'environnement Vercel
  const token = process.env.VITE_ADMIN_TOKEN;
  
  if (!token) {
    return res.status(500).json({ error: 'Token not configured on server' });
  }

  return res.status(200).json({ token });
}

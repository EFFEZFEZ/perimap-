/*
 * Copyright (c) 2025 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * API Vercel Serverless pour récupérer le token admin
 * Route: /api/admin-token
 * Sécurité: Nécessite le bon mot de passe
 */

export default function handler(req, res) {
  // CORS headers (optionnellement restreints via ALLOWED_ORIGINS)
  const origin = req.headers?.origin;
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const originAllowed = !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin);

  res.setHeader('Vary', 'Origin');
  if (origin && originAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    if (origin && !originAllowed) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    return res.status(200).end();
  }

  if (origin && !originAllowed) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body || {};

  // Sécurité: pas de mot de passe codé en dur.
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedPassword) {
    return res.status(503).json({ error: 'Admin endpoint disabled (ADMIN_PASSWORD not configured)' });
  }

  if (!password || password !== expectedPassword) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Retourner le token depuis les variables d'environnement Vercel
  const token = process.env.VITE_ADMIN_TOKEN;
  
  if (!token) {
    return res.status(500).json({ error: 'Token not configured on server' });
  }

  return res.status(200).json({ token });
}


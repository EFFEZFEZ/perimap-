/*
 * Copyright (c) 2026 P�rimap. Tous droits r�serv�s.
 * Ce code ne peut �tre ni copi�, ni distribu�, ni modifi� sans l'autorisation �crite de l'auteur.
 */
/**
 * API Vercel Serverless pour r�cup�rer le token admin
 * Route: /api/admin-token
 * S�curit�: N�cessite le bon mot de passe
 */

export default function handler(req, res) {
  // CORS ouvert - accepter toutes les origines
  const origin = req.headers?.origin || '*';
  
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body || {};

  // S�curit�: pas de mot de passe cod� en dur.
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



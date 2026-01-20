import { neon } from '@neondatabase/serverless';

/**
 * API pour enregistrer les données de retard dans Neon DB
 * Utilise le driver @neondatabase/serverless (recommandé par Neon)
 * 
 * POST /api/record-delay
 * Body: {
 *   line: "A",           // Code de la ligne
 *   stop: "Gare SNCF",   // Nom de l'arrêt
 *   stopId: "...",       // ID GTFS de l'arrêt (optionnel)
 *   scheduled: "08:30",  // Heure prévue
 *   actual: "08:35",     // Heure réelle estimée (optionnel)
 *   delay: 5,            // Retard en minutes (positif = retard, négatif = avance)
 *   direction: "...",    // Direction/terminus (optionnel)
 *   isRealtime: true,    // Si basé sur données temps réel
 *   tripId: "...",       // ID du trip GTFS (optionnel)
 *   source: "hawk"       // Source des données (hawk, gtfs-rt, manual)
 * }
 */
export default async function handler(req, res) {
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

  // Connexion à Neon - essayer DATABASE_URL d'abord, puis POSTGRES_URL
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!connectionString) {
    console.error('[record-delay] ❌ Pas de connection string trouvée');
    return res.status(500).json({ 
      error: 'Database not configured',
      message: 'DATABASE_URL ou POSTGRES_URL non configuré'
    });
  }

  const sql = neon(connectionString);

  try {
    const { 
      line, 
      stop, 
      stopId,
      scheduled, 
      actual,
      delay, 
      direction,
      isRealtime,
      tripId,
      source 
    } = req.body;

    // Validation minimale
    if (!line || delay === undefined || delay === null) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['line', 'delay'],
        received: { line, delay }
      });
    }

    // Convertir le delay en nombre
    const delayMinutes = Number(delay);
    if (isNaN(delayMinutes)) {
      return res.status(400).json({ error: 'delay must be a number' });
    }

    // Créer la table si elle n'existe pas
    await sql`
      CREATE TABLE IF NOT EXISTS delay_reports (
        id SERIAL PRIMARY KEY,
        line_code VARCHAR(10) NOT NULL,
        stop_name VARCHAR(255),
        stop_id VARCHAR(100),
        scheduled_time VARCHAR(10),
        actual_time VARCHAR(10),
        delay_minutes INTEGER NOT NULL,
        direction VARCHAR(255),
        is_realtime BOOLEAN DEFAULT true,
        trip_id VARCHAR(100),
        source VARCHAR(50) DEFAULT 'hawk',
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        day_of_week INTEGER,
        hour_of_day INTEGER
      );
    `;

    // Calculer jour et heure pour analyse
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Dimanche
    const hourOfDay = now.getHours();

    // Insérer le rapport avec le driver Neon
    const result = await sql`
      INSERT INTO delay_reports (
        line_code, 
        stop_name, 
        stop_id,
        scheduled_time, 
        actual_time,
        delay_minutes,
        direction,
        is_realtime,
        trip_id,
        source,
        day_of_week,
        hour_of_day
      )
      VALUES (
        ${line}, 
        ${stop || null}, 
        ${stopId || null},
        ${scheduled || null}, 
        ${actual || null},
        ${delayMinutes},
        ${direction || null},
        ${isRealtime !== false},
        ${tripId || null},
        ${source || 'hawk'},
        ${dayOfWeek},
        ${hourOfDay}
      )
      RETURNING id, recorded_at;
    `;

    console.log(`[record-delay] ✅ Retard enregistré: Ligne ${line}, ${delayMinutes} min, arrêt ${stop || 'N/A'}`);

    return res.status(200).json({ 
      success: true, 
      id: result.rows[0]?.id,
      recordedAt: result.rows[0]?.recorded_at,
      data: { line, stop, delay: delayMinutes }
    });

  } catch (error) {
    console.error('[record-delay] ❌ Erreur:', error);
    
    // Si c'est une erreur de connexion DB, renvoyer un message approprié
    if (error.code === 'ECONNREFUSED' || error.message?.includes('connect')) {
      return res.status(503).json({ 
        error: 'Database unavailable',
        message: 'La base de données est temporairement indisponible'
      });
    }

    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

import { neon } from '@neondatabase/serverless';

/**
 * API pour récupérer les statistiques de retard depuis Neon DB
 * Utilise le driver @neondatabase/serverless
 * 
 * GET /api/delay-stats : Récupérer les statistiques agrégées
 * GET /api/delay-stats?line=A : Filtrer par ligne
 * GET /api/delay-stats?days=7 : Derniers X jours
 * GET /api/delay-stats?hour=8 : Filtrer par heure
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Connexion à Neon
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!connectionString) {
    return res.status(500).json({ 
      error: 'Database not configured',
      message: 'DATABASE_URL ou POSTGRES_URL non configuré'
    });
  }

  const sql = neon(connectionString);

  try {
    const { line, days = 30, hour, detailed } = req.query;
    const daysInt = parseInt(days) || 30;

    // Construire les clauses WHERE dynamiques
    const lineFilter = line ? `AND line_code = '${line}'` : '';
    const hourFilter = hour ? `AND hour_of_day = ${parseInt(hour)}` : '';

    // Statistiques globales par ligne
    const lineStats = await sql(`
      SELECT 
        line_code,
        COUNT(*) as total_reports,
        ROUND(AVG(delay_minutes)::numeric, 1) as avg_delay,
        MAX(delay_minutes) as max_delay,
        MIN(delay_minutes) as min_delay,
        COUNT(CASE WHEN delay_minutes >= 5 THEN 1 END) as major_delays,
        COUNT(CASE WHEN delay_minutes < 0 THEN 1 END) as early_arrivals
      FROM delay_reports
      WHERE recorded_at >= NOW() - INTERVAL '${daysInt} days'
      ${lineFilter}
      GROUP BY line_code
      ORDER BY total_reports DESC
    `);

    // Statistiques par heure de la journée
    const hourlyStats = await sql(`
      SELECT 
        hour_of_day,
        COUNT(*) as total_reports,
        ROUND(AVG(delay_minutes)::numeric, 1) as avg_delay,
        MAX(delay_minutes) as max_delay
      FROM delay_reports
      WHERE recorded_at >= NOW() - INTERVAL '${daysInt} days'
      ${lineFilter}
      ${hourFilter}
      GROUP BY hour_of_day
      ORDER BY hour_of_day
    `);

    // Statistiques par jour de la semaine
    const dayOfWeekStats = await sql(`
      SELECT 
        day_of_week,
        COUNT(*) as total_reports,
        ROUND(AVG(delay_minutes)::numeric, 1) as avg_delay
      FROM delay_reports
      WHERE recorded_at >= NOW() - INTERVAL '${daysInt} days'
      ${lineFilter}
      GROUP BY day_of_week
      ORDER BY day_of_week
    `);

    // Arrêts les plus problématiques
    const worstStops = await sql(`
      SELECT 
        stop_name,
        stop_id,
        COUNT(*) as total_reports,
        ROUND(AVG(delay_minutes)::numeric, 1) as avg_delay,
        MAX(delay_minutes) as max_delay
      FROM delay_reports
      WHERE recorded_at >= NOW() - INTERVAL '${daysInt} days'
        AND stop_name IS NOT NULL
      ${lineFilter}
      GROUP BY stop_name, stop_id
      HAVING AVG(delay_minutes) >= 2
      ORDER BY avg_delay DESC
      LIMIT 10
    `);

    // Tendance des derniers jours
    const dailyTrend = await sql(`
      SELECT 
        DATE(recorded_at) as date,
        COUNT(*) as total_reports,
        ROUND(AVG(delay_minutes)::numeric, 1) as avg_delay
      FROM delay_reports
      WHERE recorded_at >= NOW() - INTERVAL '${daysInt} days'
      ${lineFilter}
      GROUP BY DATE(recorded_at)
      ORDER BY date DESC
      LIMIT 14
    `);

    // Rapport détaillé si demandé
    let recentReports = [];
    if (detailed === 'true') {
      recentReports = await sql(`
        SELECT 
          line_code,
          stop_name,
          scheduled_time,
          actual_time,
          delay_minutes,
          direction,
          recorded_at
        FROM delay_reports
        WHERE recorded_at >= NOW() - INTERVAL '24 hours'
        ${lineFilter}
        ORDER BY recorded_at DESC
        LIMIT 100
      `);
    }

    // Total global
    const globalStats = await sql(`
      SELECT 
        COUNT(*) as total_reports,
        ROUND(AVG(delay_minutes)::numeric, 1) as avg_delay,
        MAX(delay_minutes) as max_delay,
        MIN(recorded_at) as first_report,
        MAX(recorded_at) as last_report
      FROM delay_reports
      WHERE recorded_at >= NOW() - INTERVAL '${daysInt} days'
      ${lineFilter}
    `);

    // Mapper les jours de la semaine
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const dayOfWeekFormatted = dayOfWeekStats.map(row => ({
      ...row,
      day_name: dayNames[row.day_of_week] || row.day_of_week
    }));

    return res.status(200).json({
      success: true,
      period: `${daysInt} derniers jours`,
      filter: line ? `Ligne ${line}` : 'Toutes les lignes',
      global: globalStats[0] || {},
      byLine: lineStats,
      byHour: hourlyStats,
      byDayOfWeek: dayOfWeekFormatted,
      worstStops: worstStops,
      dailyTrend: dailyTrend,
      recentReports: recentReports
    });

  } catch (error) {
    console.error('[delay-stats] ❌ Erreur:', error);

    // Si la table n'existe pas encore
    if (error.message?.includes('does not exist')) {
      return res.status(200).json({
        success: true,
        message: 'Aucune donnée disponible - la collecte vient de commencer',
        global: { total_reports: 0, avg_delay: 0 },
        byLine: [],
        byHour: [],
        byDayOfWeek: [],
        worstStops: [],
        dailyTrend: [],
        recentReports: []
      });
    }

    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

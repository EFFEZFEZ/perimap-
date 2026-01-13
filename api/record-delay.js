import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { line, stop, scheduled, delay } = req.body;

  try {
    if (line && stop && delay !== undefined) {
      await sql`
        INSERT INTO delay_stats (line_name, stop_name, scheduled_time, delay_minutes)
        VALUES (${line}, ${stop}, ${scheduled}, ${delay});
      `;
    }
    return res.status(200).json({ saved: true });
  } catch (error) {
    console.error('Erreur SQL:', error);
    return res.status(500).json({ error: error.message });
  }
}

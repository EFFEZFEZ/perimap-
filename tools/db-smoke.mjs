import { sql } from '@vercel/postgres';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('No DATABASE_URL in environment');
    process.exit(2);
  }

  try {
    await sql`CREATE TABLE IF NOT EXISTS delay_stats (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT now(),
      line_name TEXT,
      stop_name TEXT,
      scheduled_time TIMESTAMPTZ,
      delay_minutes INTEGER
    )`;

    const now = new Date().toISOString();
    // scheduled_time column in existing schema is varchar(20) — shorten to fit
    const nowShort = now.slice(0, 19);
    await sql`INSERT INTO delay_stats (line_name, stop_name, scheduled_time, delay_minutes) VALUES (${ 'SMOKE' }, ${ 'TEST_STOP' }, ${ nowShort }, ${ 99 })`;

    const rows = await sql`SELECT id, line_name, stop_name, scheduled_time, delay_minutes FROM delay_stats ORDER BY id DESC LIMIT 3`;
    console.log('Last rows:', JSON.stringify(rows, null, 2));
    console.log('DB smoke test succeeded');
    process.exit(0);
  } catch (err) {
    console.error('DB smoke test failed:', err?.message || err);
    process.exit(1);
  }
}

main();

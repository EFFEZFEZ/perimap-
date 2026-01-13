import { sql } from '@vercel/postgres';

async function main() {
  console.log('Checking for DATABASE_URL in environment...');
  if (!process.env.DATABASE_URL) {
    console.error('No DATABASE_URL found in environment. Cannot connect to Vercel Postgres.');
    console.error('Set DATABASE_URL or configure Vercel environment variables before running this test.');
    process.exit(2);
  }

  try {
    const result = await sql`SELECT 1 as ok, now() as now`;
    console.log('Query result:', JSON.stringify(result));
    console.log('Database connection OK');
    process.exit(0);
  } catch (err) {
    console.error('Database test failed:', err?.message || err);
    process.exit(1);
  }
}

main();

import { sql } from '@vercel/postgres';

async function main() {
  try {
    const cols = await sql`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'delay_stats'
      ORDER BY ordinal_position
    `;

    console.log('delay_stats columns:', JSON.stringify(cols, null, 2));

    const count = await sql`SELECT count(*)::int as cnt FROM delay_stats`;
    console.log('row count:', JSON.stringify(count, null, 2));
  } catch (err) {
    console.error('Inspect failed:', err?.message || err);
    process.exit(1);
  }
}

main();

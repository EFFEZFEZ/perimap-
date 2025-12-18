/* Validate that JSON-LD blocks embedded in our SEO landing pages are valid JSON.
 * Usage: node scripts/validate-jsonld.cjs
 */

const fs = require('fs');

const files = [
  'public/horaires.html',
  'public/horaires-ligne-a.html',
  'public/horaires-ligne-b.html',
  'public/horaires-ligne-c.html',
  'public/horaires-ligne-d.html',
  'public/itineraire.html',
  'public/trafic.html',
  'public/carte.html'
];

const jsonLdRegex = /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g;

let ok = true;

for (const filePath of files) {
  const html = fs.readFileSync(filePath, 'utf8');
  let match;
  let count = 0;

  while ((match = jsonLdRegex.exec(html))) {
    count += 1;
    const payload = match[1];
    try {
      JSON.parse(payload);
    } catch (error) {
      ok = false;
      console.error(`[JSON-LD] Parse error in ${filePath} (block #${count}): ${error.message}`);
    }
  }

  if (count === 0) {
    ok = false;
    console.error(`[JSON-LD] No JSON-LD block found in ${filePath}`);
  }
}

if (!ok) {
  process.exit(1);
}

console.log(`[JSON-LD] OK: valid JSON in ${files.length} files`);

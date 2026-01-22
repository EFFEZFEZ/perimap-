import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public', 'icons');

const inputPath = join(publicDir, 'perigueux-hero-original.png');
const outputPath = join(publicDir, 'perigueux-hero.webp');

console.log('Converting', inputPath, 'to WebP...');

sharp(inputPath)
  .resize(1920, null, { withoutEnlargement: true })
  .webp({ quality: 75, effort: 6 })
  .toFile(outputPath)
  .then(info => {
    console.log('Done!', info);
    console.log('Size reduced from 4.23MB to', (info.size / 1024 / 1024).toFixed(2), 'MB');
  })
  .catch(err => console.error('Error:', err));

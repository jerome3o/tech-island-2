import sharp from 'sharp';
import { readFileSync } from 'fs';

const svg = readFileSync('public/icons/icon.svg');

// Generate 192x192 icon
await sharp(svg)
  .resize(192, 192)
  .png()
  .toFile('public/icons/icon-192.png');

console.log('✓ Generated icon-192.png');

// Generate 512x512 icon
await sharp(svg)
  .resize(512, 512)
  .png()
  .toFile('public/icons/icon-512.png');

console.log('✓ Generated icon-512.png');

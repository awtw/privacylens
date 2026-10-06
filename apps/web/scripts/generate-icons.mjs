// One-off: renders PWA PNG icons from the 8plus % mark. Run `node scripts/generate-icons.mjs`; outputs are committed.
import sharp from 'sharp';

const mark = (scale) => {
  const s = 100 * scale;
  const o = (100 - s) / 2;
  return `<g transform="translate(${o} ${o}) scale(${scale})"><g fill="#fff"><circle cx="32" cy="29" r="18"/><path d="M53 9H68L36 91H21L53 9Z"/></g><circle cx="70" cy="64" r="28" fill="#FE5000"/></g>`;
};
const svg = (rx, scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="${rx}" fill="#002FA7"/>${mark(scale)}</svg>`;

const out = new URL('../public/', import.meta.url).pathname;
const jobs = [
  ['icon-192.png', 192, svg(18, 0.74)],
  ['icon-512.png', 512, svg(18, 0.74)],
  ['icon-maskable-512.png', 512, svg(0, 0.56)], // full-bleed + inside the 80% safe zone
  ['apple-touch-icon.png', 180, svg(0, 0.66)], // iOS applies its own rounding
];
for (const [name, size, s] of jobs) {
  await sharp(Buffer.from(s), { density: 384 }).resize(size, size).png().toFile(out + name);
  console.log('wrote', name);
}

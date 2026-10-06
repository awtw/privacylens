// Generates the PrivacyLens brand kit from one geometry: a scan frame around text lines, one of them redacted
// by a slanted orange bar (the slant echoes the 8plus "%" slash). Run `node scripts/generate-icons.mjs` from apps/web.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const BLUE = '#002FA7', ORANGE = '#FE5000', NIGHT = '#0A0E1A';

// Mark lives in a 100×100 box, centered on (50,50), bbox ≈ 14–86.
const mark = (ink) =>
  `<path d="M14 34V14H34M66 14H86V34M86 66V86H66M34 86H14V66" stroke="${ink}" stroke-width="7" stroke-linecap="square" fill="none"/>` +
  `<rect x="28" y="30" width="44" height="7" rx="3.5" fill="${ink}"/>` +
  `<path d="M30 44H78L74 57H26Z" fill="${ORANGE}"/>` +
  `<rect x="28" y="64" width="30" height="7" rx="3.5" fill="${ink}"/>`;
const placed = (ink, scale) => `<g transform="translate(${50 - 50 * scale} ${50 - 50 * scale}) scale(${scale})">${mark(ink)}</g>`;
const svg = (inner, vb = '0 0 100 100') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="none">${inner}</svg>`;

const root = new URL('../../../', import.meta.url).pathname;
const web = root + 'apps/web/public/';
const ios = root + 'apps/ios/App/Assets.xcassets/AppIcon.appiconset/';
mkdirSync(root + 'brand', { recursive: true });
mkdirSync(ios, { recursive: true });

// --- SVG masters ---
const files = {
  'brand/privacylens-mark.svg': svg(mark('#fff')), // for dark / blue backgrounds
  'brand/privacylens-mark-dark.svg': svg(mark(BLUE)), // for light backgrounds
  'brand/privacylens-app-icon.svg': svg(`<rect width="100" height="100" rx="22" fill="${BLUE}"/>${placed('#fff', 0.9)}`),
  'brand/privacylens-horizontal.svg': svg(
    `<g transform="scale(0.5)">${mark(BLUE)}</g>` +
      `<text x="62" y="36" font-family="Georgia, 'Songti TC', serif" font-size="30" font-weight="600" letter-spacing="-1" fill="${NIGHT}">PrivacyLens</text>` +
      `<text x="63" y="47" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="6.5" letter-spacing="1.2" fill="${ORANGE}">BY 8PLUS · LOCAL ONLY</text>`,
    '0 0 250 50',
  ),
};
for (const [p, s] of Object.entries(files)) writeFileSync(root + p, s);
writeFileSync(web + 'favicon.svg', files['brand/privacylens-app-icon.svg']);

// --- PNGs ---
const full = (scale) => svg(`<rect width="100" height="100" fill="${BLUE}"/>${placed('#fff', scale)}`); // full-bleed square
const rounded = (scale) => svg(`<rect width="100" height="100" rx="22" fill="${BLUE}"/>${placed('#fff', scale)}`); // keeps transparent corners
const jobs = [
  [web + 'icon-192.png', 192, rounded(0.9)],
  [web + 'icon-512.png', 512, rounded(0.9)],
  [web + 'icon-maskable-512.png', 512, full(0.66)], // inside the 80% safe zone
  [web + 'apple-touch-icon.png', 180, full(0.82)], // iOS rounds it itself
  [web + 'favicon-32.png', 32, rounded(0.96)],
  [ios + 'icon-1024.png', 1024, full(0.82)], // App Store/Springboard master: square, opaque, no pre-rounding
  [root + 'brand/privacylens-app-icon-1024.png', 1024, rounded(0.9)],
];
for (const [path, size, s] of jobs) {
  let img = sharp(Buffer.from(s), { density: 512 }).resize(size, size);
  // Opaque only for full-bleed outputs (iOS/maskable/apple-touch); rounded ones keep transparent corners.
  if (s.includes('rx="22"') === false) img = img.flatten({ background: BLUE });
  await img.png().toFile(path);
  console.log('wrote', path.replace(root, ''));
}

writeFileSync(
  ios + 'Contents.json',
  JSON.stringify({ images: [{ filename: 'icon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }], info: { author: 'xcode', version: 1 } }, null, 2),
);
writeFileSync(root + 'apps/ios/App/Assets.xcassets/Contents.json', JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2));

// Copies tesseract worker/core/language data into public/ocr so the app never fetches them from a CDN.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));
const out = new URL('../public/ocr/', import.meta.url).pathname;
mkdirSync(join(out, 'lang'), { recursive: true });

const copy = (from, to) => {
  if (!existsSync(from)) throw new Error(`missing OCR asset: ${from}`);
  cpSync(from, to);
};

copy(join(pkgDir('tesseract.js'), 'dist/worker.min.js'), join(out, 'worker.min.js'));
const core = pkgDir('tesseract.js-core');
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js']) copy(join(core, f), join(out, f));
for (const lang of ['eng', 'chi_tra']) {
  copy(join(pkgDir(`@tesseract.js-data/${lang}`), `4.0.0_best_int/${lang}.traineddata.gz`), join(out, `lang/${lang}.traineddata.gz`));
}
console.log('OCR assets copied to public/ocr');

import { createWorker, type Worker } from 'tesseract.js';
import type { OcrWord } from '@privacylens/privacy-spec';

let workerPromise: Promise<Worker> | null = null;
let onProgress: ((p: number, label: string) => void) | null = null;

// All OCR assets are self-hosted under /ocr (see scripts/copy-ocr-assets.mjs) so nothing is fetched from a CDN
// and the service worker can cache them for offline use.
const BASE = import.meta.env.BASE_URL;
function getWorker(): Promise<Worker> {
  workerPromise ??= (async () => {
    const w = await createWorker(['chi_tra', 'eng'], 1, {
      workerPath: `${BASE}ocr/worker.min.js`,
      corePath: `${BASE}ocr`,
      langPath: `${BASE}ocr/lang`,
      logger: (m) => onProgress?.(m.progress ?? 0, m.status),
    });
    return w;
  })();
  return workerPromise;
}

const TARGET_WIDTH = 3000;

/**
 * Preprocess for OCR: crop letterbox bars, upscale small text, grayscale + contrast stretch.
 * Returns the canvas plus the crop rect so bboxes can be mapped back to the original image.
 */
function preprocess(src: HTMLCanvasElement): { canvas: HTMLCanvasElement; crop: { x: number; y: number; w: number; h: number } } {
  const sctx = src.getContext('2d')!;
  // Crop near-black full-width rows at top/bottom (screenshots pasted into black frames).
  const rowDark = (y: number) => {
    const d = sctx.getImageData(0, y, src.width, 1).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 16) sum += d[i]! + d[i + 1]! + d[i + 2]!;
    return sum / (d.length / 16) / 3 < 14;
  };
  let top = 0;
  let bottom = src.height;
  while (top < bottom - 20 && rowDark(top)) top++;
  while (bottom > top + 20 && rowDark(bottom - 1)) bottom--;
  const crop = { x: 0, y: top, w: src.width, h: bottom - top };

  const scale = Math.max(1, Math.min(3, TARGET_WIDTH / crop.w));
  const c = document.createElement('canvas');
  c.width = Math.round(crop.w * scale);
  c.height = Math.round(crop.h * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, crop.x, crop.y, crop.w, crop.h, 0, 0, c.width, c.height);

  // Grayscale + percentile contrast stretch.
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const px = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const g = (px[i]! * 299 + px[i + 1]! * 587 + px[i + 2]! * 114) / 1000;
    px[i] = px[i + 1] = px[i + 2] = g;
    hist[g | 0]!++;
  }
  const total = c.width * c.height;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]!) < total * 0.0005; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]!) < total * 0.0005; hi--);
  // Sparse text on a plain page has few dark pixels; never stretch a degenerate range.
  if (hi - lo < 60) {
    lo = 0;
    hi = 255;
  }
  const range = hi - lo;
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((px[i]! - lo) * 255) / range));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: c, crop };
}

export interface OcrResult {
  words: OcrWord[];
  text: string;
}

/** Runs OCR locally in a Web Worker and returns words with normalized bboxes. */
export async function runOcr(
  image: HTMLCanvasElement,
  progress?: (p: number, label: string) => void,
): Promise<OcrResult> {
  onProgress = progress ?? null;
  const worker = await getWorker();
  const { canvas: img, crop } = preprocess(image);
  const { data } = await worker.recognize(img);
  // Map bboxes from the preprocessed canvas back to normalized coords of the ORIGINAL image.
  const W = img.width;
  const H = img.height;
  const fy = crop.h / image.height;
  const oy = crop.y / image.height;
  const words: OcrWord[] = [];
  data.lines.forEach((line, li) => {
    for (const w of line.words) {
      const text = w.text.trim();
      if (!text) continue;
      const { x0, y0, x1, y1 } = w.bbox;
      words.push({ text, line: li, bbox: { x: x0 / W, y: oy + (y0 / H) * fy, w: (x1 - x0) / W, h: ((y1 - y0) / H) * fy } });
    }
  });
  return { words, text: data.text };
}

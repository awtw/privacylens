import { createWorker, type Worker } from 'tesseract.js';
import type { OcrWord } from '@privacylens/privacy-spec';

let workerPromise: Promise<Worker> | null = null;

// PoC: language data is fetched by tesseract.js on first use. Self-host via `langPath` in Phase 3 (offline/PWA).
function getWorker(): Promise<Worker> {
  workerPromise ??= createWorker(['chi_tra', 'eng']);
  return workerPromise;
}

/** Runs OCR locally in a Web Worker and returns words with normalized bboxes. */
export async function runOcr(image: HTMLCanvasElement): Promise<OcrWord[]> {
  const worker = await getWorker();
  const { data } = await worker.recognize(image);
  const W = image.width;
  const H = image.height;
  const words: OcrWord[] = [];
  data.lines.forEach((line, li) => {
    for (const w of line.words) {
      const text = w.text.trim();
      if (!text) continue;
      const { x0, y0, x1, y1 } = w.bbox;
      words.push({ text, line: li, bbox: { x: x0 / W, y: y0 / H, w: (x1 - x0) / W, h: (y1 - y0) / H } });
    }
  });
  return words;
}

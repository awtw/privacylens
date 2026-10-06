import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const MAX_PDF_PAGES = 20;
const TARGET_WIDTH = 1600;

/** Renders PDF pages to canvases locally (pdf.js). Redaction is raster, so hidden text layers cannot leak. */
export async function renderPdf(file: File, onPage?: (done: number, total: number) => void): Promise<HTMLCanvasElement[]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const total = Math.min(doc.numPages, MAX_PDF_PAGES);
  const out: HTMLCanvasElement[] = [];
  for (let n = 1; n <= total; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(3, TARGET_WIDTH / base.width) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    out.push(canvas);
    onPage?.(n, total);
  }
  return out;
}

/** Builds a NEW PDF from (already redacted) page canvases. */
export async function canvasesToPdf(canvases: HTMLCanvasElement[]): Promise<Blob> {
  const pdf = await PDFDocument.create();
  for (const c of canvases) {
    const png = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/png'));
    const img = await pdf.embedPng(new Uint8Array(await png.arrayBuffer()));
    const page = pdf.addPage([c.width, c.height]);
    page.drawImage(img, { x: 0, y: 0, width: c.width, height: c.height });
  }
  pdf.setTitle('PrivacyLens redacted');
  pdf.setProducer('PrivacyLens');
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

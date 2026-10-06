import { toPixelRect, type Entity } from '@privacylens/privacy-spec';

export type RedactMode = 'blackbox' | 'blur' | 'pixelate';

/** Draws the source onto a NEW canvas and redacts it. Re-encoding also drops EXIF. */
export function redact(src: HTMLCanvasElement, entities: Entity[], mode: RedactMode): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  for (const e of entities) {
    if (!e.bbox) continue;
    const r = toPixelRect(e.bbox, out.width, out.height);
    if (r.w === 0 || r.h === 0) continue;
    if (mode === 'blackbox') {
      ctx.fillStyle = '#000';
      ctx.fillRect(r.x, r.y, r.w, r.h);
    } else if (mode === 'blur') {
      const tmp = document.createElement('canvas');
      tmp.width = r.w;
      tmp.height = r.h;
      const t = tmp.getContext('2d')!;
      t.filter = `blur(${Math.max(6, Math.round(r.h / 3))}px)`;
      t.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      ctx.drawImage(tmp, r.x, r.y);
      ctx.restore();
    } else {
      const block = Math.max(8, Math.round(r.h / 2));
      const sw = Math.max(1, Math.round(r.w / block));
      const sh = Math.max(1, Math.round(r.h / block));
      const tmp = document.createElement('canvas');
      tmp.width = sw;
      tmp.height = sh;
      tmp.getContext('2d')!.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, sw, sh);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, sw, sh, r.x, r.y, r.w, r.h);
      ctx.imageSmoothingEnabled = true;
    }
  }
  return out;
}

export function download(canvas: HTMLCanvasElement, name: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

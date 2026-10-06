import type { BBox } from './types';

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Normalized bbox → integer pixel rect, padded and clamped to the image. */
export function toPixelRect(b: BBox, width: number, height: number, pad = 2): PixelRect {
  const x0 = Math.max(0, Math.floor(b.x * width) - pad);
  const y0 = Math.max(0, Math.floor(b.y * height) - pad);
  const x1 = Math.min(width, Math.ceil((b.x + b.w) * width) + pad);
  const y1 = Math.min(height, Math.ceil((b.y + b.h) * height) + pad);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

export function normalizeBox(px: PixelRect, width: number, height: number): BBox {
  return { x: px.x / width, y: px.y / height, w: px.w / width, h: px.h / height };
}

/** Rect from two normalized points (any drag direction), clamped to 0–1. */
export function boxFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): BBox {
  const cl = (v: number) => Math.min(1, Math.max(0, v));
  const x0 = cl(Math.min(a.x, b.x));
  const y0 = cl(Math.min(a.y, b.y));
  return { x: x0, y: y0, w: cl(Math.max(a.x, b.x)) - x0, h: cl(Math.max(a.y, b.y)) - y0 };
}

export function pointInBox(p: { x: number; y: number }, b: BBox): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

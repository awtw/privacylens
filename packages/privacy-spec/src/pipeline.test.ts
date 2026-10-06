import { describe, expect, it } from 'vitest';
import cases from '../fixtures/cases.json';
import {
  detectFromOcr,
  detectFromText,
  isValidLuhn,
  isValidTaiwanId,
  summarizeRisk,
  toPixelRect,
  type OcrWord,
} from './index';

describe('shared fixtures', () => {
  for (const c of cases) {
    it(c.name, () => {
      const got = detectFromText(c.text).map((e) => ({ type: e.type, text: e.text }));
      expect(got).toEqual(c.expected);
    });
  }
});

describe('validators', () => {
  it('taiwan id', () => {
    expect(isValidTaiwanId('A123456789')).toBe(true);
    expect(isValidTaiwanId('A123456780')).toBe(false);
  });
  it('luhn', () => {
    expect(isValidLuhn('4111111111111111')).toBe(true);
    expect(isValidLuhn('4111111111111112')).toBe(false);
  });
});

describe('detectFromOcr', () => {
  const words: OcrWord[] = [
    { text: 'Mail:', bbox: { x: 0.1, y: 0.1, w: 0.1, h: 0.05 }, line: 0 },
    { text: 'a@b.com', bbox: { x: 0.2, y: 0.1, w: 0.2, h: 0.05 }, line: 0 },
    { text: '0912', bbox: { x: 0.1, y: 0.3, w: 0.1, h: 0.05 }, line: 1 },
    { text: '345', bbox: { x: 0.2, y: 0.3, w: 0.1, h: 0.05 }, line: 1 },
    { text: '678', bbox: { x: 0.3, y: 0.3, w: 0.1, h: 0.05 }, line: 1 },
  ];
  it('maps matches to normalized boxes and risk levels', () => {
    const es = detectFromOcr(words);
    expect(es.map((e) => e.type)).toEqual(['EMAIL', 'PHONE']);
    expect(es[0]!.bbox).toEqual({ x: 0.2, y: 0.1, w: 0.2, h: 0.05 });
    expect(es[1]!.bbox!.x).toBeCloseTo(0.1);
    expect(es[1]!.bbox!.w).toBeCloseTo(0.3);
    expect(es[1]!.riskLevel).toBe('high');
  });
  it('slices partially covered words proportionally', () => {
    const w: OcrWord[] = [{ text: 'mail:a@b.com', bbox: { x: 0, y: 0, w: 1, h: 0.1 }, line: 0 }];
    const e = detectFromOcr(w)[0]!;
    expect(e.bbox!.x).toBeCloseTo(5 / 12);
  });
});

describe('risk + geometry', () => {
  it('summarizes', () => {
    const s = summarizeRisk(detectFromText('A123456789 a@b.com'));
    expect(s.level).toBe('critical');
    expect(s.counts).toEqual({ critical: 1, medium: 1 });
  });
  it('clamps pixel rect', () => {
    expect(toPixelRect({ x: 0, y: 0, w: 1, h: 1 }, 100, 50, 5)).toEqual({ x: 0, y: 0, w: 100, h: 50 });
  });
});

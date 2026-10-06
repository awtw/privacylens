import { describe, expect, it } from 'vitest';
import cases from '../fixtures/cases.json';
import {
  detectFromOcr,
  detectFromText,
  boxFromPoints,
  isValidLuhn,
  maskText,
  metadataToEntities,
  pointInBox,
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

describe('name heuristic', () => {
  const w = (t: string, line: number, x: number) => ({ text: t, line, bbox: { x, y: line * 0.1, w: 0.1, h: 0.05 } });
  it('flags standalone surname tokens but not stopwords', () => {
    const es = detectFromOcr([w('王小明', 0, 0.1), w('金額', 0, 0.3), w('資料', 0, 0.5)]);
    expect(es.map((e) => [e.type, e.text])).toEqual([['PERSON', '王小明']]);
  });
  it('merges single-char OCR words into a name', () => {
    const es = detectFromOcr([w('王', 0, 0.1), w('大', 0, 0.2), w('明', 0, 0.3), w('已', 0, 0.4), w('送出', 0, 0.5)]);
    expect(es.map((e) => e.text)).toEqual(['王大明']);
    expect(es[0]!.bbox!.w).toBeCloseTo(0.3);
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

describe('manual box helpers + maskText', () => {
  it('normalizes drag direction and clamps', () => {
    expect(boxFromPoints({ x: 0.5, y: 0.6 }, { x: 0.2, y: 1.4 })).toEqual({ x: 0.2, y: 0.6, w: 0.3, h: 0.4 });
  });
  it('hit tests', () => {
    expect(pointInBox({ x: 0.3, y: 0.7 }, { x: 0.2, y: 0.6, w: 0.3, h: 0.4 })).toBe(true);
    expect(pointInBox({ x: 0.1, y: 0.7 }, { x: 0.2, y: 0.6, w: 0.3, h: 0.4 })).toBe(false);
  });
  it('masks text', () => {
    expect(maskText('信箱 a@b.com 結束', 'label')).toBe('信箱 [EMAIL] 結束');
    expect(maskText('a@b.com')).toBe('███████');
  });
});

describe('metadataToEntities', () => {
  it('reports gps and device', () => {
    const es = metadataToEntities({ latitude: 25.033, longitude: 121.5654, make: 'Apple', model: 'iPhone 15' });
    expect(es.map((e) => [e.type, e.riskLevel])).toEqual([['GPS', 'high'], ['DEVICE_INFO', 'medium']]);
    expect(es[0]!.text).toBe('25.03300, 121.56540');
    expect(metadataToEntities({})).toEqual([]);
  });
});

describe('NER merge', () => {
  const w = (t: string, line: number, x: number) => ({ text: t, line, bbox: { x, y: line * 0.1, w: 0.1, h: 0.05 } });
  it('maps whitespace-insensitive NER spans onto OCR words and outranks heuristics', () => {
    const words = [w('負責人', 0, 0.1), w('周', 0, 0.2), w('杰', 0, 0.3), w('倫', 0, 0.4), w('Alice', 1, 0.1), w('Chen', 1, 0.2)];
    const es = detectFromOcr(words, {
      ner: [
        { type: 'PERSON', text: '周杰倫', score: 0.98 },
        { type: 'PERSON', text: 'Alice Chen', score: 0.95 },
        { type: 'PERSON', text: '低分', score: 0.2 },
      ],
    });
    expect(es.map((e) => [e.type, e.text])).toEqual([['PERSON', '周杰倫'], ['PERSON', 'Alice Chen']]);
    expect(es[0]!.confidence).toBeGreaterThan(0.8);
  });
  it('works for plain text', () => {
    const es = detectFromText('Meeting with Tim Cook tomorrow', { ner: [{ type: 'PERSON', text: 'Tim Cook', score: 0.99 }] });
    expect(es.map((e) => e.text)).toEqual(['Tim Cook']);
  });
});

import { RULES, type Rule } from './rules';
import { riskOf } from './risk';
import type { BBox, Entity, EntityType, OcrWord } from './types';

interface Span {
  word: number;
  start: number;
  end: number;
}

interface Candidate {
  type: EntityType;
  start: number;
  end: number;
  confidence: number;
}

/** Joins OCR words (space within a line, newline between lines) and records offsets. */
export function buildTextIndex(words: OcrWord[]): { text: string; spans: Span[] } {
  let text = '';
  const spans: Span[] = [];
  words.forEach((w, i) => {
    if (i > 0) text += words[i - 1]!.line === w.line ? ' ' : '\n';
    spans.push({ word: i, start: text.length, end: text.length + w.text.length });
    text += w.text;
  });
  return { text, spans };
}

export function detectInText(text: string, rules: Rule[] = RULES): Candidate[] {
  const found: Candidate[] = [];
  for (const rule of rules) {
    for (const m of text.matchAll(rule.pattern)) {
      const value = m[rule.group ?? 0];
      if (!value) continue;
      if (rule.validate && !rule.validate(value)) continue;
      const start = (m.index ?? 0) + (rule.group ? m[0].indexOf(value) : 0);
      found.push({ type: rule.type, start, end: start + value.length, confidence: rule.confidence });
    }
  }
  return resolveOverlaps(found);
}

/** Keeps the best candidate among overlaps: higher confidence, then longer span. */
function resolveOverlaps(cands: Candidate[]): Candidate[] {
  const sorted = [...cands].sort(
    (a, b) => b.confidence - a.confidence || b.end - b.start - (a.end - a.start),
  );
  const kept: Candidate[] = [];
  for (const c of sorted) {
    if (!kept.some((k) => c.start < k.end && k.start < c.end)) kept.push(c);
  }
  return kept.sort((a, b) => a.start - b.start);
}

/** Bbox of a text range, sliced proportionally inside partially covered words. */
function rangeBoxes(words: OcrWord[], spans: Span[], start: number, end: number): BBox[] {
  const byLine = new Map<number, BBox>();
  for (const s of spans) {
    const o0 = Math.max(start, s.start);
    const o1 = Math.min(end, s.end);
    if (o0 >= o1) continue;
    const w = words[s.word]!;
    const len = s.end - s.start;
    const box: BBox = {
      x: w.bbox.x + (w.bbox.w * (o0 - s.start)) / len,
      y: w.bbox.y,
      w: (w.bbox.w * (o1 - o0)) / len,
      h: w.bbox.h,
    };
    const prev = byLine.get(w.line);
    if (!prev) byLine.set(w.line, box);
    else {
      const x0 = Math.min(prev.x, box.x);
      const y0 = Math.min(prev.y, box.y);
      const x1 = Math.max(prev.x + prev.w, box.x + box.w);
      const y1 = Math.max(prev.y + prev.h, box.y + box.h);
      byLine.set(w.line, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  }
  return [...byLine.values()];
}

/** Regex detection over OCR output → unified Entity list (one entity per line fragment). */
export function detectFromOcr(words: OcrWord[]): Entity[] {
  const { text, spans } = buildTextIndex(words);
  const entities: Entity[] = [];
  for (const c of detectInText(text)) {
    for (const bbox of rangeBoxes(words, spans, c.start, c.end)) {
      entities.push({
        id: `${c.type}-${entities.length}`,
        type: c.type,
        text: text.slice(c.start, c.end),
        confidence: c.confidence,
        bbox,
        source: 'regex',
        riskLevel: riskOf(c.type),
      });
    }
  }
  return entities;
}

/** Plain-text input (no geometry). */
export function detectFromText(text: string): Entity[] {
  return detectInText(text).map((c, i) => ({
    id: `${c.type}-${i}`,
    type: c.type,
    text: text.slice(c.start, c.end),
    confidence: c.confidence,
    bbox: null,
    source: 'regex' as const,
    riskLevel: riskOf(c.type),
  }));
}

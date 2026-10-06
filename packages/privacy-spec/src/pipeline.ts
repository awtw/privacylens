import { RULES, SURNAME_RE, NAME_STOPWORDS, type Rule } from './rules';
import { riskOf } from './risk';
import type { BBox, Entity, EntityType, OcrWord } from './types';

const CJK = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/;

/** A named entity from an NER model, as text (no offsets — wordpiece tokenizers rarely give reliable ones). */
export interface NerSpan {
  type: 'PERSON' | 'ORGANIZATION' | 'LOCATION';
  text: string;
  score: number;
}

export interface DetectOptions {
  ner?: NerSpan[];
}

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
    if (i > 0) {
      const prev = words[i - 1]!;
      // OCR emits CJK characters as separate words; don't inject spaces between them.
      const cjkJoin = CJK.test(prev.text.slice(-1)) && CJK.test(w.text[0] ?? '');
      text += prev.line === w.line ? (cjkJoin ? '' : ' ') : '\n';
    }
    spans.push({ word: i, start: text.length, end: text.length + w.text.length });
    text += w.text;
  });
  return { text, spans };
}

export function detectInText(text: string, rules: Rule[] = RULES): Candidate[] {
  return resolveOverlaps(collectCandidates(text, rules));
}

function collectCandidates(text: string, rules: Rule[] = RULES): Candidate[] {
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
  return found;
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
export function detectFromOcr(words: OcrWord[], opts: DetectOptions = {}): Entity[] {
  const { text, spans } = buildTextIndex(words);
  const cands = collectCandidates(text);
  cands.push(...nerCandidates(text, opts.ner ?? []));
  // Heuristic: a standalone OCR token that looks like a Taiwanese name (common surname + 1–2 chars).
  // OCR often splits CJK names into single-char words ("王 大 明"), so merge such runs first.
  for (let i = 0; i < spans.length; ) {
    let j = i + 1;
    const single = (k: number) => words[k]!.text.length === 1 && CJK.test(words[k]!.text);
    if (single(i)) while (j < spans.length && single(j) && words[j]!.line === words[i]!.line) j++;
    // Names are 2–3 chars; a longer run ("王 大 明 已") may carry trailing non-name chars.
    for (let len = Math.min(j - i, 3); len >= (j - i > 1 ? 2 : 1); len--) {
      const t = words.slice(i, i + len).map((w) => w.text).join('');
      if (SURNAME_RE.test(t) && !NAME_STOPWORDS.has(t)) {
        cands.push({ type: 'PERSON', start: spans[i]!.start, end: spans[i + len - 1]!.end, confidence: 0.4 });
        break;
      }
    }
    i = j;
  }
  const entities: Entity[] = [];
  for (const c of resolveOverlaps(cands)) {
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
export function detectFromText(text: string, opts: DetectOptions = {}): Entity[] {
  const cands = resolveOverlaps([...collectCandidates(text), ...nerCandidates(text, opts.ner ?? [])]);
  return cands.map((c, i) => ({
    id: `${c.type}-${i}`,
    type: c.type,
    text: text.slice(c.start, c.end),
    confidence: c.confidence,
    bbox: null,
    source: 'regex' as const,
    riskLevel: riskOf(c.type),
  }));
}

/** Masks detected spans in plain text. */
export function maskText(text: string, mode: 'block' | 'label' = 'block'): string {
  let out = '';
  let last = 0;
  for (const c of detectInText(text)) {
    out += text.slice(last, c.start);
    out += mode === 'label' ? `[${c.type}]` : '█'.repeat(Math.max(1, c.end - c.start));
    last = c.end;
  }
  return out + text.slice(last);
}


/** Text OCR words are joined into — NER must run on exactly this string (or any whitespace variant of it). */
export function textOfWords(words: OcrWord[]): string {
  return buildTextIndex(words).text;
}

/**
 * Locates NER spans in `text` ignoring whitespace (models see tokens, OCR text has arbitrary spaces).
 * Each occurrence of a span's text becomes a candidate; NER outranks the weak name heuristics.
 */
function nerCandidates(text: string, spans: NerSpan[]): Candidate[] {
  if (spans.length === 0) return [];
  const compact: string[] = [];
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (!/\s/.test(text[i]!)) {
      compact.push(text[i]!);
      map.push(i);
    }
  }
  const flat = compact.join('');
  const out: Candidate[] = [];
  for (const sp of spans) {
    const needle = sp.text.replace(/\s+/g, '');
    // Locations are low-risk and the model is noisy on them (e.g. company names), so demand more confidence.
    if (needle.length < 2 || sp.score < (sp.type === 'LOCATION' ? 0.85 : 0.6)) continue;
    for (let from = flat.indexOf(needle); from !== -1; from = flat.indexOf(needle, from + needle.length)) {
      out.push({
        type: sp.type,
        start: map[from]!,
        end: map[from + needle.length - 1]! + 1,
        confidence: Math.min(0.9, 0.5 + sp.score * 0.4),
      });
    }
  }
  return out;
}

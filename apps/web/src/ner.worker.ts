/// <reference lib="webworker" />
import { env, pipeline } from '@huggingface/transformers';
import type { NerSpan } from '@privacylens/privacy-spec';

// Only model weights are downloaded (once, then cached by the browser). User text never leaves the worker.
env.allowLocalModels = false;

const MODEL = 'Xenova/distilbert-base-multilingual-cased-ner-hrl';
const MAP: Record<string, NerSpan['type']> = { PER: 'PERSON', ORG: 'ORGANIZATION', LOC: 'LOCATION' };
const MAX_CHUNK = 400;

interface Tok {
  entity: string;
  score: number;
  index: number;
  word: string;
}

type Classifier = (text: string) => Promise<Tok[]>;
let classifier: Promise<Classifier> | null = null;

function load(): Promise<Classifier> {
  classifier ??= pipeline('token-classification', MODEL, {
    dtype: 'q8',
    progress_callback: (p: { status: string; progress?: number; file?: string }) =>
      self.postMessage({ type: 'progress', status: p.status, progress: p.progress ?? null, file: p.file ?? '' }),
  }) as unknown as Promise<Classifier>;
  return classifier;
}

/** Splits on line breaks, then hard-wraps, so each chunk fits the model's 512-token window. */
function chunk(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if (cur && cur.length + line.length + 1 > MAX_CHUNK) {
      out.push(cur);
      cur = '';
    }
    let rest = line;
    while (rest.length > MAX_CHUNK) {
      out.push(rest.slice(0, MAX_CHUNK));
      rest = rest.slice(MAX_CHUNK);
    }
    cur += (cur ? '\n' : '') + rest;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** Merges B-/I- wordpieces into entity strings. */
function aggregate(tokens: Tok[]): NerSpan[] {
  const spans: NerSpan[] = [];
  let cur: { type: NerSpan['type']; text: string; scores: number[]; last: number } | null = null;
  const flush = () => {
    if (cur) spans.push({ type: cur.type, text: cur.text, score: cur.scores.reduce((a, b) => a + b, 0) / cur.scores.length });
    cur = null;
  };
  for (const t of tokens) {
    const [bio, tag] = t.entity.split('-');
    const type = tag ? MAP[tag] : undefined;
    if (!type) {
      flush();
      continue;
    }
    const piece = t.word.replace(/^##/, '');
    const continues = cur && bio === 'I' && cur.type === type && t.index === cur.last + 1;
    if (continues && cur) {
      // Latin word starts (no ##) are separated by a space; Chinese chars and ## pieces are adjacent.
      cur.text += (t.word.startsWith('##') || /[㐀-鿿]/.test(piece) ? '' : ' ') + piece;
      cur.scores.push(t.score);
      cur.last = t.index;
    } else {
      flush();
      cur = { type, text: piece, scores: [t.score], last: t.index };
    }
  }
  flush();
  return spans;
}

self.onmessage = async (e: MessageEvent<{ type: 'init' | 'run'; id: number; text?: string }>) => {
  const { type, id, text } = e.data;
  try {
    const run = await load();
    if (type === 'init') return self.postMessage({ type: 'ready', id });
    const spans: NerSpan[] = [];
    for (const c of chunk(text ?? '')) spans.push(...aggregate(await run(c)));
    self.postMessage({ type: 'result', id, spans });
  } catch (err) {
    self.postMessage({ type: 'error', id, message: err instanceof Error ? err.message : String(err) });
  }
};

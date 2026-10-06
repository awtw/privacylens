import type { NerSpan } from '@privacylens/privacy-spec';

export interface NerProgress {
  status: string;
  progress: number | null;
  file: string;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (v: NerSpan[]) => void; reject: (e: Error) => void }>();
let onProgress: ((p: NerProgress) => void) | null = null;

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./ner.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (m.type === 'progress') return onProgress?.(m);
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.type === 'error') p.reject(new Error(m.message));
    else p.resolve(m.spans ?? []);
  };
  return worker;
}

function call(type: 'init' | 'run', text?: string): Promise<NerSpan[]> {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ type, id, text });
  });
}

/** Downloads (first time) and warms the model. */
export function loadNer(progress?: (p: NerProgress) => void): Promise<unknown> {
  onProgress = progress ?? null;
  return call('init');
}

export function runNer(text: string): Promise<NerSpan[]> {
  return call('run', text);
}

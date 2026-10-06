const OCR_URLS = [
  'worker.min.js',
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'lang/chi_tra.traineddata.gz',
  'lang/eng.traineddata.gz',
].map((f) => `${import.meta.env.BASE_URL}ocr/${f}`);

const FLAG = 'pl-offline-ready';

export function isOfflineReady(): boolean {
  try {
    return localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

/** Registers the service worker (production only) and precaches OCR assets. Resolves true once offline-ready. */
export async function registerPwa(): Promise<boolean> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return false;
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    const reg = await navigator.serviceWorker.ready;
    const done = new Promise<boolean>((resolve) => {
      navigator.serviceWorker.addEventListener('message', (e) => e.data?.type === 'precached' && resolve(true), { once: true });
      setTimeout(() => resolve(false), 120_000);
    });
    let assets: string[] = [];
    try {
      assets = ((await (await fetch(`${import.meta.env.BASE_URL}precache.json`)).json()) as string[]).map(
        (f) => `${import.meta.env.BASE_URL}${f}`,
      );
    } catch {
      /* no manifest: runtime caching still covers what the user actually uses */
    }
    reg.active?.postMessage({ type: 'precache', urls: [...OCR_URLS, ...assets] });
    const ok = await done;
    if (ok) {
      try {
        localStorage.setItem(FLAG, '1');
      } catch {
        /* storage blocked: badge just won't persist */
      }
    }
    return ok;
  } catch {
    return false;
  }
}

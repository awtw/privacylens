import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  boxFromPoints,
  detectFromOcr,
  pointInBox,
  riskOf,
  summarizeRisk,
  textOfWords,
  type BBox,
  type Entity,
  type OcrWord,
  type RiskLevel,
} from '@privacylens/privacy-spec';
import { TextMode } from './TextMode';
import { Logo } from './Logo';
import { scanMetadata } from './metadata';
import { loadNer, runNer, type NerProgress } from './ner';
import { runOcr } from './ocr';
import { isOfflineReady, registerPwa } from './pwa';
import { canvasesToPdf, renderPdf } from './pdf';
import { download, downloadBlob, redact, type RedactMode } from './redact';

type Status = 'idle' | 'scanning' | 'done' | 'error';

const LEVELS: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
const RISK_LABEL: Record<RiskLevel | 'none', string> = {
  none: '未發現',
  low: '低風險',
  medium: '中風險',
  high: '高風險',
  critical: '極高風險',
};
const TYPE_LABEL: Record<string, string> = {
  EMAIL: 'Email',
  PHONE: '電話',
  TW_NATIONAL_ID: '身分證',
  CREDIT_CARD: '信用卡',
  BANK_ACCOUNT: '銀行帳號',
  URL: '網址',
  IP_ADDRESS: 'IP',
  ID_NUMBER: '編號',
  USERNAME: '帳號名',
  CUSTOM: '手動',
  GPS: '位置',
  DEVICE_INFO: '裝置',
  ADDRESS: '地址',
  ORGANIZATION: '組織',
  LOCATION: '地點',
  PERSON: '姓名',
};
const MODES: { id: RedactMode; label: string }[] = [
  { id: 'blackbox', label: '黑框' },
  { id: 'blur', label: '模糊' },
  { id: 'pixelate', label: '馬賽克' },
];

async function loadCanvas(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close();
  return c;
}

interface Page {
  canvas: HTMLCanvasElement;
  entities: Entity[];
  selected: Set<string>;
  ocrText: string;
  words: OcrWord[];
}

const NO_ENTITIES: Entity[] = [];
const NO_SELECTION = new Set<string>();

export function App() {
  const [pages, setPages] = useState<Page[]>([]);
  const [cur, setCur] = useState(0);
  const [isPdf, setIsPdf] = useState(false);
  const [fileName, setFileName] = useState('image');
  const [meta, setMeta] = useState<Entity[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState({ p: 0, label: '' });
  const [error, setError] = useState('');
  const [mode, setMode] = useState<RedactMode>('blackbox');
  const [preview, setPreview] = useState(false);
  const [showText, setShowText] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<'image' | 'text'>('image');
  const [draft, setDraft] = useState<BBox | null>(null);
  const [offlineReady, setOfflineReady] = useState(isOfflineReady());
  const [online, setOnline] = useState(navigator.onLine);
  const [nerOn, setNerOn] = useState(() => {
    try {
      return localStorage.getItem('pl-ner') === '1';
    } catch {
      return false;
    }
  });
  const [ner, setNer] = useState<{ state: 'off' | 'loading' | 'ready' | 'error'; p: number; msg: string }>({ state: 'off', p: 0, msg: '' });
  const pagesRef = useRef<Page[]>([]);
  const view = useRef<HTMLCanvasElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const manualSeq = useRef(0);

  useEffect(() => {
    if (nerOn) void toggleNer(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void registerPwa().then((ok) => ok && setOfflineReady(true));
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  pagesRef.current = pages;

  // Run NER over already-scanned pages, keeping manual boxes. Auto entities are replaced.
  const applyNer = useCallback(
    async (nerOnNow: boolean) => {
      const snapshot = pagesRef.current;
      for (let i = 0; i < snapshot.length; i++) {
        const pg = snapshot[i]!;
        if (pg.words.length === 0) continue;
        const spans = nerOnNow ? await runNer(textOfWords(pg.words)) : [];
        const auto = detectFromOcr(pg.words, { ner: spans });
        setPages((ps) =>
          ps.map((p, k) => {
            if (k !== i) return p;
            const manual = p.entities.filter((e) => e.source === 'manual');
            const sel = new Set([...auto.map((e) => e.id), ...manual.filter((e) => p.selected.has(e.id)).map((e) => e.id)]);
            return { ...p, entities: [...auto, ...manual], selected: sel };
          }),
        );
      }
    },
    [],
  );

  const toggleNer = async (on: boolean) => {
    setNerOn(on);
    try {
      localStorage.setItem('pl-ner', on ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (!on) return setNer({ state: 'off', p: 0, msg: '' });
    try {
      setNer({ state: 'loading', p: 0, msg: '準備模型' });
      await loadNer((pr: NerProgress) =>
        setNer((n) => ({ state: 'loading', p: pr.progress != null ? pr.progress / 100 : n.p, msg: pr.file ? `下載 ${pr.file.split('/').pop()}` : pr.status })),
      );
      setNer({ state: 'ready', p: 1, msg: '' });
      await applyNer(true);
    } catch (e) {
      setNer({ state: 'error', p: 0, msg: e instanceof Error ? e.message : String(e) });
    }
  };

  const page = pages[cur];
  const source = page?.canvas ?? null;
  const entities = page?.entities ?? NO_ENTITIES;
  const selected = page?.selected ?? NO_SELECTION;
  const ocrText = page?.ocrText ?? '';

  const patchPage = useCallback((i: number, patch: Partial<Page>) => {
    setPages((ps) => ps.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  }, []);
  const setEntities = (fn: (es: Entity[]) => Entity[]) =>
    setPages((ps) => ps.map((p, k) => (k === cur ? { ...p, entities: fn(p.entities) } : p)));
  const setSelected = (v: Set<string> | ((s: Set<string>) => Set<string>)) =>
    setPages((ps) =>
      ps.map((p, k) => (k === cur ? { ...p, selected: typeof v === 'function' ? v(p.selected) : v } : p)),
    );

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!pdf && !file.type.startsWith('image/')) return;
      setStatus('scanning');
      setError('');
      setPreview(false);
      setCur(0);
      setMeta([]);
      setIsPdf(pdf);
      setProgress({ p: 0, label: '準備中' });
      try {
        setFileName(file.name.replace(/\.[^.]+$/, ''));
        let canvases: HTMLCanvasElement[];
        if (pdf) {
          canvases = await renderPdf(file, (n, t) => setProgress({ p: n / t, label: `轉換 PDF 第 ${n}/${t} 頁` }));
        } else {
          canvases = [await loadCanvas(file)];
          setMeta(await scanMetadata(file));
        }
        setPages(canvases.map((canvas) => ({ canvas, entities: [], selected: new Set(), ocrText: '', words: [] })));
        for (let i = 0; i < canvases.length; i++) {
          const label = canvases.length > 1 ? `第 ${i + 1}/${canvases.length} 頁 · ` : '';
          const ocr = await runOcr(canvases[i]!, (p, l) => setProgress({ p, label: label + l }));
          let spans: Awaited<ReturnType<typeof runNer>> = [];
          if (nerOn && ner.state === 'ready') {
            try {
              spans = await runNer(textOfWords(ocr.words));
            } catch {
              /* NER is best-effort; regex results still apply */
            }
          }
          const found = detectFromOcr(ocr.words, { ner: spans });
          patchPage(i, { entities: found, selected: new Set(found.map((e) => e.id)), ocrText: ocr.text, words: ocr.words });
        }
        setStatus('done');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    },
    [patchPage, nerOn, ner.state],
  );

  const allEntities = useMemo(() => pages.flatMap((p) => p.entities), [pages]);
  const totalChosen = useMemo(() => pages.reduce((n, p) => n + p.entities.filter((e) => p.selected.has(e.id)).length, 0), [pages]);

  const exportAll = async () => {
    const redacted = pages.map((p) => redact(p.canvas, p.entities.filter((e) => p.selected.has(e.id)), mode));
    if (isPdf) downloadBlob(await canvasesToPdf(redacted), `${fileName}-redacted.pdf`);
    else download(redacted[0]!, `${fileName}-redacted.png`);
  };

  const chosen = useMemo(() => entities.filter((e) => selected.has(e.id)), [entities, selected]);
  const summary = useMemo(() => summarizeRisk([...allEntities, ...meta]), [allEntities, meta]);

  useEffect(() => {
    const c = view.current;
    if (!c || !source) return;
    c.width = source.width;
    c.height = source.height;
    const ctx = c.getContext('2d')!;
    if (preview) {
      ctx.drawImage(redact(source, chosen, mode), 0, 0);
      return;
    }
    ctx.drawImage(source, 0, 0);
    ctx.lineWidth = Math.max(2, source.width / 350);
    for (const e of entities) {
      if (!e.bbox) continue;
      const on = selected.has(e.id);
      ctx.strokeStyle = on ? '#FE5000' : '#ffffff80';
      ctx.fillStyle = on ? '#FE500026' : '#ffffff14';
      const x = e.bbox.x * c.width;
      const y = e.bbox.y * c.height;
      const w = e.bbox.w * c.width;
      const h = e.bbox.h * c.height;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }
    if (draft) {
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(draft.x * c.width, draft.y * c.height, draft.w * c.width, draft.h * c.height);
      ctx.setLineDash([]);
    }
  }, [source, entities, selected, preview, mode, chosen, draft]);

  const toNorm = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (preview || scanning) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = toNorm(e);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragStart.current) setDraft(boxFromPoints(dragStart.current, toNorm(e)));
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const start = dragStart.current;
    dragStart.current = null;
    setDraft(null);
    if (!start) return;
    const end = toNorm(e);
    const box = boxFromPoints(start, end);
    const r = e.currentTarget.getBoundingClientRect();
    if (box.w * r.width < 6 && box.h * r.height < 6) {
      // Click: toggle the topmost existing box under the cursor.
      const hit = [...entities].reverse().find((en) => en.bbox && pointInBox(end, en.bbox));
      if (hit) toggle(hit.id);
      return;
    }
    const id = `CUSTOM-${++manualSeq.current}`;
    const ent: Entity = { id, type: 'CUSTOM', text: '手動框選', confidence: 1, bbox: box, source: 'manual', riskLevel: riskOf('CUSTOM') };
    setEntities((es) => [...es, ent]);
    setSelected((sel) => new Set(sel).add(id));
  };
  const remove = (id: string) => {
    setEntities((es) => es.filter((e) => e.id !== id));
    setSelected((sel) => {
      const n = new Set(sel);
      n.delete(id);
      return n;
    });
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const scanning = status === 'scanning';
  const level = summary.level;

  return (
    <div className="shell">
      <nav className="top">
        <div className="brand">
          <Logo size={30} />
          <b>PrivacyLens</b>
          <span className="by">by 8plus</span>
        </div>
        <span className="mono">
          {!online ? "OFFLINE · " : ""}
          {offlineReady ? "OFFLINE READY · " : ""}NO UPLOADS · LOCAL ONLY
        </span>
      </nav>

      <div className="tabs">
        <button className={tab === 'image' ? 'on' : ''} onClick={() => setTab('image')}>圖片</button>
        <button className={tab === 'text' ? 'on' : ''} onClick={() => setTab('text')}>文字</button>
      </div>

      {tab === 'text' ? (
        <TextMode />
      ) : (
      <>
      {!source && (
        <section className="hero">
          <span className="eyebrow">01 · SCAN</span>
          <h1>分享截圖前，<br />先遮住個資。</h1>
          <p>自動找出 Email、電話、身分證、信用卡、地址等資訊並一鍵遮罩。影像與辨識結果都不會離開你的裝置。</p>
        </section>
      )}

      <label
        className={`drop${dragging ? ' over' : ''}${source ? ' compact' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void onFile(e.dataTransfer.files[0]);
        }}
      >
        <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        <span>
          <b>{source ? '更換圖片' : '拖曳截圖到這裡'}</b>
          <small>或點擊選擇檔案 · PNG / JPG / WebP / PDF（最多 20 頁）</small>
        </span>
      </label>

      <div className="ner">
        <label className="switch">
          <input type="checkbox" checked={nerOn} onChange={(e) => void toggleNer(e.target.checked)} />
          <span />
        </label>
        <div>
          <b>進階姓名／組織／地點偵測（NER）</b>
          <small>
            {ner.state === 'loading'
              ? `下載模型中 ${Math.round(ner.p * 100)}% · ${ner.msg}`
              : ner.state === 'ready'
                ? '已啟用 · 模型在本機執行'
                : ner.state === 'error'
                  ? `載入失敗：${ner.msg}`
                  : '首次啟用需下載約 135MB 模型（僅下載模型，文字不會上傳），之後離線可用'}
          </small>
        </div>
      </div>

      {scanning && (
        <div className="progress" role="status">
          <div className="bar">
            <i style={{ width: `${Math.max(6, progress.p * 100)}%` }} />
          </div>
          <small>掃描中：{progress.label}（OCR 引擎於本機執行）</small>
        </div>
      )}
      {status === 'error' && <p className="err">錯誤：{error}</p>}

      {source && (
        <section className="work">
          <div className="card stage">
            <div className="stage-head">
              {pages.length > 1 && (
                <div className="pager">
                  <button disabled={cur === 0} onClick={() => setCur(cur - 1)} aria-label="上一頁">←</button>
                  <span className="mono">PAGE {cur + 1} / {pages.length}</span>
                  <button disabled={cur === pages.length - 1} onClick={() => setCur(cur + 1)} aria-label="下一頁">→</button>
                </div>
              )}
              <div className="seg">
                <button className={!preview ? 'on' : ''} onClick={() => setPreview(false)}>偵測標記</button>
                <button className={preview ? 'on' : ''} onClick={() => setPreview(true)}>遮罩預覽</button>
              </div>
              <small>{preview ? '預覽結果' : '拖曳畫框新增遮罩 · 點擊框切換選取'} · {source.width} × {source.height}</small>
            </div>
            <div className="canvas-wrap">
              <canvas
                ref={view}
                className={preview ? '' : 'draw'}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
              />
            </div>
          </div>

          <aside className="card side">
            <div className="risk">
              <span className="eyebrow">RISK LEVEL</span>
              <b>{scanning ? '掃描中…' : RISK_LABEL[level]}</b>
              <div className="meter">
                {LEVELS.map((l, i) => (
                  <i key={l} className={level !== 'none' && i <= LEVELS.indexOf(level) ? 'on' : ''} />
                ))}
              </div>
              <small>共偵測到 {allEntities.length + meta.length} 項{pages.length > 1 ? `（${pages.length} 頁）` : ''}</small>
            </div>

            {meta.length > 0 && (
              <div className="meta-box">
                <span className="eyebrow">METADATA · 輸出時自動移除</span>
                <ul>
                  {meta.map((m) => (
                    <li key={m.id}>
                      <span className="tag">{TYPE_LABEL[m.type] ?? m.type}</span>
                      <code>{m.text}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {status === 'done' && entities.length === 0 && (
              <p className="empty">
                沒有自動偵測到個資。若畫面中確有個資，可能是文字太小或對比不足——直接在圖上拖曳畫框，手動加入遮罩。
              </p>
            )}

            <ul className="list">
              {entities.map((e) => (
                <li key={e.id}>
                  <label>
                    <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                    <span className="tag">
                      {TYPE_LABEL[e.type] ?? e.type}
                    </span>
                    <code>{e.text}</code>
                  </label>
                  {e.source === 'manual' && (
                    <button className="x" aria-label="刪除手動框" onClick={() => remove(e.id)}>×</button>
                  )}
                </li>
              ))}
            </ul>

            {entities.length > 0 && (
              <div className="row">
                <button className="ghost" onClick={() => setSelected(new Set(entities.map((e) => e.id)))}>全選</button>
                <button className="ghost" onClick={() => setSelected(new Set())}>全不選</button>
              </div>
            )}

            <div className="seg full">
              {MODES.map((m) => (
                <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
                  {m.label}
                </button>
              ))}
            </div>

            <button className="primary" disabled={scanning || totalChosen === 0} onClick={() => void exportAll()}>
              遮罩 {totalChosen} 項並下載{isPdf ? ' PDF' : '新檔'}
            </button>
            <small className="note">輸出為新檔案，不會覆蓋原檔；PDF 會轉為純影像頁面，被遮蔽的文字無法被複製還原。</small>

            <button className="link" onClick={() => setShowText((s) => !s)}>
              {showText ? '隱藏' : '查看'} OCR 辨識結果
            </button>
            {showText && <pre className="ocr">{ocrText || '（沒有辨識到文字）'}</pre>}
          </aside>
        </section>
      )}

      </>
      )}

      <footer>
        <span className="mono">8PLUS.APP · PRIVACYLENS</span>
        <span className="mono">NO UPLOADS · NO AI API · LOCAL PROCESSING</span>
      </footer>
    </div>
  );
}

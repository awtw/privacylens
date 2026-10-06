import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { detectFromOcr, summarizeRisk, type Entity, type RiskLevel } from '@privacylens/privacy-spec';
import { runOcr } from './ocr';
import { download, redact, type RedactMode } from './redact';

type Status = 'idle' | 'scanning' | 'done' | 'error';

const COLOR: Record<RiskLevel, string> = {
  low: '#3b82f6',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
};

async function loadCanvas(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close();
  return c;
}

export function App() {
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [fileName, setFileName] = useState('image');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<RedactMode>('blackbox');
  const [preview, setPreview] = useState(false);
  const view = useRef<HTMLCanvasElement>(null);

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setStatus('scanning');
    setError('');
    setPreview(false);
    try {
      const canvas = await loadCanvas(file);
      setSource(canvas);
      setFileName(file.name.replace(/\.[^.]+$/, ''));
      const found = detectFromOcr(await runOcr(canvas));
      setEntities(found);
      setSelected(new Set(found.map((e) => e.id)));
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, []);

  const chosen = useMemo(() => entities.filter((e) => selected.has(e.id)), [entities, selected]);
  const summary = useMemo(() => summarizeRisk(entities), [entities]);

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
    ctx.lineWidth = Math.max(2, source.width / 400);
    for (const e of entities) {
      if (!e.bbox) continue;
      ctx.strokeStyle = COLOR[e.riskLevel];
      ctx.globalAlpha = selected.has(e.id) ? 1 : 0.35;
      ctx.strokeRect(e.bbox.x * c.width, e.bbox.y * c.height, e.bbox.w * c.width, e.bbox.h * c.height);
    }
    ctx.globalAlpha = 1;
  }, [source, entities, selected, preview, mode, chosen]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <main>
      <header>
        <h1>PrivacyLens</h1>
        <p>圖片個資偵測與遮罩 — 所有處理都在你的瀏覽器本機執行，不會上傳任何影像或文字。</p>
      </header>

      <label
        className="drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void onFile(e.dataTransfer.files[0]);
        }}
      >
        <input type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        {status === 'scanning' ? '掃描中…（首次使用需下載 OCR 語言資料）' : '拖曳或點擊選擇截圖／圖片'}
      </label>
      {status === 'error' && <p className="err">錯誤：{error}</p>}

      {source && (
        <section className="work">
          <div className="canvas-wrap">
            <canvas ref={view} />
          </div>
          <aside>
            <h2>風險：{summary.level === 'none' ? '未偵測到個資' : `${summary.level}（${summary.score}）`}</h2>
            <ul>
              {entities.map((e) => (
                <li key={e.id}>
                  <label>
                    <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                    <span className="dot" style={{ background: COLOR[e.riskLevel] }} />
                    <b>{e.type}</b> <code>{e.text}</code>
                  </label>
                </li>
              ))}
            </ul>
            <div className="row">
              <button onClick={() => setSelected(new Set(entities.map((e) => e.id)))}>全選</button>
              <button onClick={() => setSelected(new Set())}>全不選</button>
            </div>
            <div className="row">
              <select value={mode} onChange={(e) => setMode(e.target.value as RedactMode)}>
                <option value="blackbox">黑框</option>
                <option value="blur">模糊</option>
                <option value="pixelate">馬賽克</option>
              </select>
              <button onClick={() => setPreview((p) => !p)}>{preview ? '回到標記' : '預覽遮罩'}</button>
            </div>
            <button
              className="primary"
              disabled={chosen.length === 0 && entities.length > 0}
              onClick={() => download(redact(source, chosen, mode), `${fileName}-redacted.png`)}
            >
              Redact 並下載新檔
            </button>
            <small>輸出為新檔案，不會覆蓋原圖；重新編碼會移除 EXIF/GPS。</small>
          </aside>
        </section>
      )}
    </main>
  );
}

import { useMemo, useState } from 'react';
import { detectFromText, maskText, summarizeRisk } from '@privacylens/privacy-spec';

const RISK: Record<string, string> = { none: '未發現', low: '低風險', medium: '中風險', high: '高風險', critical: '極高風險' };

export function TextMode() {
  const [text, setText] = useState('');
  const [style, setStyle] = useState<'block' | 'label'>('block');
  const [copied, setCopied] = useState(false);
  const entities = useMemo(() => detectFromText(text), [text]);
  const summary = useMemo(() => summarizeRisk(entities), [entities]);
  const masked = useMemo(() => maskText(text, style), [text, style]);

  return (
    <section className="work text-mode">
      <div className="card stage">
        <div className="stage-head">
          <span className="eyebrow">ORIGINAL</span>
          <small>貼上文字，立即在本機偵測</small>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="貼上要檢查的文字，例如：聯絡人 王小明，手機 0912-345-678，Email a@b.com"
        />
      </div>
      <aside className="card side">
        <div className="risk">
          <span className="eyebrow">RISK LEVEL</span>
          <b>{RISK[summary.level]}</b>
          <small>共偵測到 {entities.length} 項</small>
        </div>
        <ul className="list">
          {entities.map((e) => (
            <li key={e.id}>
              <label>
                <span className="tag">{e.type}</span>
                <code>{e.text}</code>
              </label>
            </li>
          ))}
        </ul>
        <div className="seg full">
          <button className={style === 'block' ? 'on' : ''} onClick={() => setStyle('block')}>███ 遮蔽</button>
          <button className={style === 'label' ? 'on' : ''} onClick={() => setStyle('label')}>[類型] 標記</button>
        </div>
        <pre className="ocr">{masked || '（遮罩後的文字會顯示在這裡）'}</pre>
        <button
          className="primary"
          disabled={!text}
          onClick={async () => {
            await navigator.clipboard.writeText(masked);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? '已複製' : '複製遮罩後文字'}
        </button>
      </aside>
    </section>
  );
}

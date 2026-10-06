# PrivacyLens 架構文件

> 來源規格：`reference-doc/PrivacyLens 開發架構與測試部署規劃（無 Apple Developer Program）.md`

## 1. 產品定位
截圖／圖片／文字的個資偵測與遮罩工具。差異化：**No Uploads、No AI API、Local Processing**。
現階段不加入 Apple Developer Program；iOS 僅以 Personal Team 安裝到自己的 iPhone 測試（profile 7 天到期、最多 3 台裝置）。

## 2. 設計原則
1. 一套 Pipeline、一套 Entity Schema、一套 Risk 規則、兩個推論 Runtime（Web / iOS）。
2. 模型只負責 **Detect**；風險等級由商業規則（`risk.ts`）決定。
3. 第一版不使用大型 LLM：OCR + Regex + NER + Vision。
4. Cloud 只提供靜態網站與模型檔，不處理使用者影像、OCR 結果或推論。
5. 永遠輸出新檔案，不覆蓋原檔。
6. 座標一律使用 normalized (0–1)，與解析度、平台無關。

## 3. 系統總覽
```
Input (Image/Screenshot/PDF/Text)
  → Metadata Scanner (EXIF/GPS)
  → OCR (text + bbox)
  → Regex + NER  ─┐
  → Vision (Face/QR/Barcode) ─┤→ Entity Merge → Risk Engine → Redaction Engine → 新檔案
```
| 層 | Web | iOS |
|---|---|---|
| UI | React / TypeScript | SwiftUI |
| OCR | tesseract.js（PoC）→ ONNX OCR | Apple Vision |
| NER | ONNX Runtime Web（WebGPU / WASM fallback） | Core ML |
| Visual | Browser API / MediaPipe / ONNX | Vision |
| Redaction | Canvas | Core Image |
| 儲存 | Cache Storage / IndexedDB / OPFS | FileManager / Application Support |
| 部署 | Static Site（Cloudflare Pages / Vercel / Netlify）+ PWA | Xcode → 自己的 iPhone |

## 4. 共用資料契約（`packages/privacy-spec`）
`Entity { id, type, text, confidence, bbox (normalized | null), source, riskLevel }`
- `type`：EMAIL, PHONE, TW_NATIONAL_ID, CREDIT_CARD, BANK_ACCOUNT, URL, IP_ADDRESS, PERSON, ADDRESS, ORGANIZATION, LOCATION, FACE, QR_CODE, BARCODE, GPS, DEVICE_INFO
- `source`：regex | ner | vision | metadata
- `riskLevel`：low | medium | high | critical

風險對照（`SEVERITY`）：critical = 身分證、信用卡；high = 銀行帳號、電話、地址、GPS、人臉；medium = Email、人名、QR/Barcode、IP、裝置；low = 組織、地點、URL。

`fixtures/cases.json` 是跨平台共用測試資料；iOS 實作 Regex 時必須以同一份 fixture 驗證輸出一致。

## 5. 偵測細節
- OCR 輸出 `OcrWord[]`（正規化 bbox + 行號）→ `buildTextIndex` 以「行內空白、跨行換行」串成全文並記錄字元 offset。
- Regex 規則（`rules.ts`）不跨行；帶驗證器者（台灣身分證 checksum、信用卡 Luhn）需通過才算命中；銀行帳號需有「帳號/account」關鍵字上下文以降低誤報。
- 重疊命中以「信心度 → 長度」擇優。
- 命中範圍映射回 bbox：同一行合併；部分覆蓋的字詞依字元比例切割，避免遮到無關文字。

## 6. 模型策略（Phase 3 / 5）
單一 Source Model（PyTorch/HF）→ ONNX（Web）→ Core ML（iOS），共用 tokenizer、label mapping、測試資料與版本號。小模型隨 App 發佈；大模型首次使用下載並快取。iOS 第一版直接放進 Xcode bundle，不做遠端更新。

## 7. 部署與離線
Web 為靜態站；模型於 `public/models`，容量變大後移至 R2/CDN。快取完成後以 PWA + Service Worker 離線使用。對外措辭：「模型下載完成後，推論完全在本機執行」。WebGPU 優先、必須保留 WASM fallback。
> 現況：OCR 資源已自行託管於 `/ocr`，並由 Service Worker 預先快取；僅 Google Fonts 仍為外部資源（離線退回系統字型）。

## 8. iOS（無 Developer Program）
Personal Team + 自動簽署 + 唯一 Bundle ID。**不依賴**：Push、Sign in with Apple、CloudKit、Apple Pay、IAP。Share Extension 若受免費簽署限制則延後。

## 9. Repository 結構
```
privacylens/
  apps/web              React + Vite（已實作）
  apps/ios              SwiftUI（Phase 4）
  packages/privacy-spec Entity/Risk/Regex/Pipeline/fixtures（已實作，純 TS 無 DOM 依賴）
  models/{source,onnx,coreml}  training  scripts   （Phase 3+）
  docs/
```

## 10. 里程碑
| Phase | 內容 | 狀態 |
|---|---|---|
| 1 | Web PoC：拖放 → OCR → bbox → Regex → Redact All → 匯出 | ✅ 完成 |
| 2 | Privacy Core：Schema、Risk、Regex、Pipeline、標準測試資料 | ✅ 完成（可持續擴充規則） |
| 3 | Web MVP：PDF/Text、NER、PWA、Offline、Privacy Report、完整 redaction UI、公開部署 | 🟡 除 Privacy Report 與公開部署外皆完成 |
| 4 | iOS Local Build：Vision OCR + Regex + Core Image（Personal Team） | 🟡 程式完成、核心已驗證；待 Xcode 建置與實機測試 |
| 5 | iOS AI：Core ML NER、Face、Barcode、Metadata、Camera | ⏳ |
| 6 | 是否加入 Developer Program 的決策點 | — |

## 11. 風險與限制
- OCR 對中文/小字/低對比截圖會漏字或切錯 → 以 fixture + 真實截圖回歸測試，並讓使用者手動增減遮罩框（Phase 3）。
- Regex 誤報（電話 vs 一般數字）→ 驗證器 + 關鍵字上下文 + 使用者逐項取消勾選。
- iOS 7 天簽署到期 → 可接受，不為此提早付費。

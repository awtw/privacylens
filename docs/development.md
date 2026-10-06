# PrivacyLens 開發文件

## 環境
Node ≥ 20（開發使用 23）、npm ≥ 10。iOS 階段另需 Mac + Xcode + 一般 Apple Account + iPhone。

## 常用指令
```bash
npm install          # 安裝 workspace 依賴
npm run dev          # 啟動 Web（Vite）
npm test             # 執行 privacy-spec 單元測試（vitest）
npm run typecheck    # 型別檢查
npm run build        # 建置 Web 靜態站（apps/web/dist）
```

## Workspace
- `@privacylens/privacy-spec`：純 TypeScript、無 DOM 依賴，直接以 `src/index.ts` 被 web 引用。
  - `types.ts` Entity/BBox/OcrWord ・ `rules.ts` Regex 規則 ・ `validators.ts` 身分證/Luhn ・ `risk.ts` 嚴重度與摘要 ・ `pipeline.ts` OCR→Entity ・ `geometry.ts` 座標轉換
- `@privacylens/web`：`ocr.ts`（tesseract.js）、`redact.ts`（Canvas：黑框/模糊/馬賽克）、`App.tsx`（UI）。

## 如何新增偵測規則
1. 在 `packages/privacy-spec/src/rules.ts` 加入 `Rule`（pattern 不可跨行；需要時加 `validate` 或 `group`）。
2. 若是新 `EntityType`，在 `types.ts` 加入並於 `risk.ts` 的 `SEVERITY` 指定等級（TypeScript 會強制補齊）。
3. 在 `fixtures/cases.json` 加正例與反例；`npm test` 會自動跑。
4. iOS 實作時以同一份 fixture 驗證。

## 程式規範
- bbox 一律 normalized (0–1)；像素轉換只在 render/redact 邊界做（`toPixelRect`）。
- UI 只依賴 `Entity`，不得依賴特定引擎的原始輸出。
- 不得新增任何上傳使用者資料的網路請求；新增網路依賴（模型、語言資料）需記錄於架構文件。
- 輸出永遠是新檔案。

## 測試策略
- 單元：fixture 驅動的 Regex/validator、OCR→bbox 映射、風險摘要、幾何。
- 手動：以真實截圖（含中英文、Email、手機、身分證）拖入 Web，確認框選、預覽、匯出。
- Phase 3 起：加入 OCR 回歸圖庫（標註 ground truth）與 NER 評估集（precision/recall）。

## 路線圖（待辦）
**Phase 3 Web MVP**：手動新增/刪除遮罩框、PDF（pdf.js）與純文字輸入、EXIF/GPS 掃描與報告、ONNX NER（PERSON/ADDRESS/ORG）、tesseract 語言資料自託管、PWA + Service Worker、Privacy Report 匯出、部署 Cloudflare Pages。
**Phase 4 iOS**：建立 `apps/ios`（SwiftUI）。Xcode：Settings > Accounts 登入 → Signing & Capabilities 勾選 Automatically manage signing → Team 選 Personal Team → 唯一 Bundle ID → 選擇 iPhone → Run。流程：PhotosPicker → Vision OCR → Regex（移植 `rules.ts`）→ Core Image Redact → Save/Share。
**Phase 5**：Core ML NER、Face/QR/Barcode、EXIF、Camera Live Preview；Share Extension 視簽署限制決定。

## 已實作的 Phase 3 項目
- 手動框選：在圖上拖曳新增遮罩（`CUSTOM`、source=`manual`）、點擊框切換選取、清單可刪除手動框。
- EXIF/GPS 掃描（exifr，本機）：顯示位置、裝置、軟體、拍攝時間，計入風險分數；輸出時以 Canvas 重新編碼自動移除。純邏輯在 `privacy-spec/metadata.ts`。
- PDF 輸入（pdf.js 本機轉成影像頁 → 逐頁 OCR，最多 20 頁）：可翻頁檢視與手動框選；輸出以 pdf-lib 重新組成「純影像 PDF」，被遮蔽文字無法被複製還原。
- PWA / 離線：OCR 引擎（worker、core wasm、chi_tra/eng 語言資料，約 14MB）由 `scripts/copy-ocr-assets.mjs` 在 dev/build 前複製到 `public/ocr`（不進 git），不再走 CDN；`public/sw.js` 為 cache-first Service Worker，首次載入後預先快取全部資源，導覽列顯示 `OFFLINE READY`。僅 production build 註冊。已用無頭 Chrome 驗證：預先快取 13 個資源後，離線重新整理可載入，離線上傳 PDF 仍可 OCR 與偵測。
- PWA 圖示：`node apps/web/scripts/generate-icons.mjs`（sharp）由 8plus % 標誌產生 192/512、maskable、apple-touch PNG，輸出已提交。
- NER（可選、預設關閉）：導覽列下方開關。`Xenova/distilbert-base-multilingual-cased-ner-hrl`（q8，約 135MB）以 transformers.js 在 Web Worker 執行，只有模型權重會下載（首次後由瀏覽器快取），文字不離開本機。結果以文字形式回傳，`pipeline.ts` 以「忽略空白」的方式對回 OCR 文字再映射成 bbox；NER 的 PERSON/ORG/LOC 優先於中英文人名啟發式。已用無頭 Chrome 驗證（Tim Cook／林志玲／Alice Johnson 等無標籤人名皆抓到）。
- 文字模式：貼上文字 → 偵測 → 以 █ 或 [類型] 遮罩 → 複製。

## Phase 4：iOS（apps/ios）
- 已寫完：`PrivacyLensKit`（Rules/Pipeline/Risk/Geometry 逐項移植、Vision OCR、Core Image 遮罩）與 SwiftUI App、XcodeGen 設定。細節與安裝步驟見 `apps/ios/README.md`。
- 驗證：`npm run test:ios`（`swift run kit-check`）以與 TypeScript 相同的 fixtures 驗證；`xcodebuild` 已能成功建置（模擬器與實機 SDK，未簽署）。**尚未實際執行**：本機尚未安裝 iOS 模擬器 runtime，也未連接 iPhone。
- 修改規則時：先改 `packages/privacy-spec`（含 fixtures），再同步改 `Rules.swift`，兩邊測試都要過。

## 已知限制（目前實作）
- 輸入為圖片、PDF 與純文字；僅 Regex/啟發式偵測（無 NER/Vision/Metadata）。
- 手動框選尚不支援移動/縮放既有框，只能刪除後重畫。
- 糊圖與極小字 OCR 讀不出來，需 Phase 3 更換 OCR 引擎。
- Google Fonts 仍走外部，離線時退回系統字型。
- 未開啟 NER 時，人名僅以「標籤」與「常見姓氏／連續首字母大寫英文詞」啟發式偵測，信心低、會有誤報。NER 模型對中文組織／地點偶有誤標（如公司名標成地點），故地點需較高信心才採用。
- Regex 只覆蓋台灣常見格式（手機/市話/身分證）、信用卡、Email、URL、IPv4、帶關鍵字的銀行帳號。

## 開發備註
- 用 `npm run dev` 時，pdf.js worker 在 Vite dev server 偶爾載入停滯；驗證 PDF 請改用 `npm run build` 後 `npx vite preview`。
- PDF 輸出為點陣化頁面，檔案較大且不可選取文字，這是為了確保遮蔽不可逆。

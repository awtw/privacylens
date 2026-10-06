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

## 已知限制（目前實作）
- 僅支援圖片輸入；僅 Regex 偵測（無 NER/Vision/Metadata）。
- tesseract.js 首次使用需連網下載語言資料（尚未離線）。
- Regex 只覆蓋台灣常見格式（手機/市話/身分證）、信用卡、Email、URL、IPv4、帶關鍵字的銀行帳號。

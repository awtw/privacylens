<!-- monorepo-migration:start -->
> [!IMPORTANT]
> **本專案已遷移至 monorepo-side-project。**
>
> 自 2026-11-16 起，本儲存庫停止維護並封存，僅保留歷史紀錄；後續開發與更新請使用新儲存庫。
>
> **新專案目錄：** [`projects/privacylens`](https://github.com/awtw/monorepo-side-project/tree/main/projects/privacylens)
>
> **新儲存庫：** [awtw/monorepo-side-project](https://github.com/awtw/monorepo-side-project)。此為私人儲存庫，需具備存取權限才能開啟。
<!-- monorepo-migration:end -->

---

<div align="center">

<img src="brand/privacylens-horizontal.svg" alt="PrivacyLens" width="360" />

**截圖、圖片、PDF、文字的個資偵測與遮罩工具**

`No Uploads` · `No AI API` · `Local Processing`

**繁體中文** · [English](README.en.md)

</div>

---

PrivacyLens 能在你分享截圖或文件之前，自動找出其中的個人資料（Email、電話、身分證字號、信用卡號、地址、人名……），讓你確認後一鍵遮蔽，並輸出一份**全新的檔案**。

最大的差異：**你的圖片與文字不會離開你的裝置。** 沒有後端伺服器、沒有呼叫任何雲端 AI API，OCR 與偵測全部在瀏覽器或 iPhone 本機執行。

## 目錄

- [特色](#特色)
- [支援的偵測類型](#支援的偵測類型)
- [運作方式](#運作方式)
- [快速開始（Web）](#快速開始web)
- [iOS App](#ios-app)
- [專案結構](#專案結構)
- [開發指南](#開發指南)
- [隱私與網路請求說明](#隱私與網路請求說明)
- [已知限制](#已知限制)
- [路線圖](#路線圖)
- [貢獻](#貢獻)
- [授權](#授權)

## 特色

- **完全本機處理**：沒有上傳、沒有後端；伺服器只需要提供靜態檔案。
- **多種輸入**：圖片／截圖、PDF（最多 20 頁）、純文字。
- **可審核、可調整**：偵測結果逐項列出，可取消勾選誤報，也能在圖上拖曳手動框選漏掉的區域。
- **三種遮罩方式**：黑框、模糊、馬賽克。
- **不可逆遮蔽**：PDF 輸出會重新組成「純影像 PDF」，被遮蔽的文字無法再被選取或複製還原。
- **自動移除中繼資料**：掃描 EXIF／GPS（拍攝位置、裝置、軟體、拍攝時間）並計入風險分數；輸出時重新編碼影像，一併清除。
- **風險評分**：依偵測到的內容給出 `low / medium / high / critical` 與 0–100 的風險分數。
- **離線可用**：Web 版為 PWA，首次載入後預先快取 OCR 引擎與語言資料，之後可完全離線使用。
- **中英文友善**：內建繁體中文與英文 OCR，規則針對台灣常見格式（手機、市話、身分證、地址）設計。
- **永遠輸出新檔案**：不會覆蓋你的原始檔。
- **兩個平台、同一套規則**：Web（React）與 iOS（SwiftUI）共用同一份規格與測試資料，確保行為一致。

## 支援的偵測類型

風險等級由產品規則決定（`packages/privacy-spec/src/risk.ts`），模型只負責「偵測」，不負責「定級」。

| 風險 | 類型 |
|---|---|
| 🔴 critical | 台灣身分證字號（含檢查碼驗證）、信用卡號（含 Luhn 驗證） |
| 🟠 high | 銀行帳號、電話（手機／市話）、地址、GPS、人臉*、自訂手動框 |
| 🟡 medium | Email、人名、使用者帳號（@handle）、IP 位址、證號／編號、QR Code*、條碼*、裝置資訊 |
| 🟢 low | 組織、地點、URL |

\* 型別已定義於資料契約，對應的偵測器預計在後續階段實作，詳見[路線圖](#路線圖)。

偵測方式：

- **Regex 規則 + 驗證器**：身分證檢查碼、信用卡 Luhn；銀行帳號需帶「帳號／account」等關鍵字上下文以降低誤報。
- **啟發式**：以姓名標籤（姓名、聯絡人、收件人…）、常見姓氏、連續首字母大寫英文詞等線索找人名（信心較低，需由使用者確認）。
- **NER（可選）**：開啟後使用多語言 NER 模型辨識人名、組織、地點（僅 Web 版，預設關閉，見[隱私說明](#隱私與網路請求說明)）。

## 運作方式

```
輸入（圖片 / 截圖 / PDF / 文字）
  → Metadata 掃描（EXIF / GPS）
  → OCR（文字 + 座標）
  → Regex + NER ─┐
  → Vision（人臉 / QR / 條碼，規劃中）─┤→ 實體合併 → 風險引擎 → 遮罩引擎 → 全新檔案
```

設計原則：

1. **一套 Pipeline、一套 Entity Schema、一套風險規則**，兩個執行環境（Web / iOS）。
2. **座標一律使用正規化 (0–1)**，與解析度、平台無關。
3. **第一版不使用大型 LLM**：只用 OCR + Regex + 小型 NER。
4. **雲端只提供靜態網站與模型檔**，不處理任何使用者影像或文字。

| 層 | Web | iOS |
|---|---|---|
| UI | React + TypeScript + Vite | SwiftUI |
| OCR | tesseract.js（自託管，繁中 + 英文） | Apple Vision |
| NER | transformers.js（Web Worker，可選） | 規劃中（Core ML） |
| 遮罩 | Canvas | Core Image |
| PDF | pdf.js（轉影像）+ pdf-lib（輸出） | 規劃中 |

完整設計請見 [docs/architecture.md](docs/architecture.md)。

## 快速開始（Web）

**需求**：Node.js ≥ 20、npm ≥ 10。

```bash
git clone git@github.com:awtw/privacylens.git
cd privacylens
npm install
npm run dev
```

開啟終端機顯示的網址（Vite 預設為 `http://localhost:5173`），把截圖、圖片或 PDF 拖進頁面即可。

> 第一次執行 `dev` / `build` 時，`predev` / `prebuild` 腳本會把 OCR 引擎與語言資料（約 14 MB）從 `node_modules` 複製到 `apps/web/public/ocr`，這些檔案不會進 git。

### 常用指令

```bash
npm run dev          # 啟動開發伺服器
npm run build        # 建置靜態網站 → apps/web/dist
npm test             # 執行 privacy-spec 單元測試（vitest）
npm run typecheck    # TypeScript 型別檢查
```

### 部署

`npm run build` 的輸出（`apps/web/dist`）是純靜態網站，可直接放到 Cloudflare Pages、Vercel、Netlify、GitHub Pages 或任何靜態主機。Service Worker 僅在 production build 註冊。

> 提示：若要在本機驗證 PDF 或離線行為，請使用 `npm run build` 後執行 `npx vite preview`（dev server 載入 pdf.js worker 偶爾會停滯）。

## iOS App

iOS 版使用 SwiftUI + Apple Vision（OCR）+ Core Image（遮罩），整個流程在 iPhone 上離線完成。

目前定位為**本機測試版**：不需要付費的 Apple Developer Program，使用免費的 Personal Team 簽署後安裝到自己的 iPhone。

**需求**：Mac、Xcode、一般 Apple Account、iPhone。

```bash
# 驗證核心邏輯（不需要 Xcode 模擬器或實機）
npm run test:ios

# 產生 Xcode 專案並開啟
brew install xcodegen
cd apps/ios && xcodegen generate
open PrivacyLens.xcodeproj
```

接著在 Xcode 登入 Apple Account、設定 Team 與唯一的 Bundle ID（寫在 `apps/ios/project.yml`），連接 iPhone 後按 Run。

> Personal Team 的 provisioning profile **7 天到期**，到期後需重新從 Xcode 安裝；最多 3 台裝置。

完整安裝步驟、命令列安裝與除錯方式請見 [apps/ios/README.md](apps/ios/README.md)。

## 專案結構

```
privacylens/
├── apps/
│   ├── web/                 React + Vite 前端（PWA）
│   └── ios/                 SwiftUI App 與 PrivacyLensKit
├── packages/
│   └── privacy-spec/        共用規格：Entity / Risk / Regex / Pipeline / 測試資料
│                            （純 TypeScript，無 DOM 依賴）
├── brand/                   Logo 與 App 圖示素材
├── docs/                    架構與開發文件
└── reference-doc/           原始規劃文件
```

`packages/privacy-spec` 是整個專案的核心：

| 檔案 | 說明 |
|---|---|
| `types.ts` | `Entity`、`BBox`、`OcrWord` 等資料契約 |
| `rules.ts` | 偵測規則（Regex） |
| `validators.ts` | 身分證檢查碼、信用卡 Luhn |
| `risk.ts` | 風險等級對照與風險分數 |
| `pipeline.ts` | OCR 輸出 → Entity（含 bbox 映射） |
| `geometry.ts` | 正規化座標 ↔ 像素座標 |
| `metadata.ts` | EXIF / GPS 純邏輯 |
| `fixtures/cases.json` | **跨平台共用測試資料**（TypeScript 與 Swift 都用這份驗證） |

## 開發指南

### 新增偵測規則

1. 在 `packages/privacy-spec/src/rules.ts` 加入一筆 `Rule`（pattern 不可跨行；需要時加上 `validate` 或 `group`）。
2. 若是新的 `EntityType`，到 `types.ts` 新增，並在 `risk.ts` 的 `SEVERITY` 指定風險等級（TypeScript 會強制你補齊）。
3. 在 `fixtures/cases.json` 加入正例與反例，執行 `npm test`。
4. 同步更新 iOS 的 `apps/ios/Sources/PrivacyLensKit/Rules.swift`，並執行 `npm run test:ios`，**兩邊都要通過**。

### 程式規範

- bbox 一律使用 normalized (0–1)；像素轉換只在繪製／遮罩的邊界處理。
- UI 只依賴 `Entity`，不依賴特定 OCR／NER 引擎的原始輸出。
- **不得新增任何上傳使用者資料的網路請求。** 若新增網路依賴（模型、語言資料），需記錄於架構文件。
- 輸出永遠是新檔案。

更多細節請見 [docs/development.md](docs/development.md)。

## 隱私與網路請求說明

PrivacyLens 的承諾是：**你的圖片、PDF、文字與 OCR 結果不會被傳送到任何伺服器。** 為了讓說明準確，以下列出所有可能的網路行為：

| 行為 | 內容 | 是否包含使用者資料 |
|---|---|---|
| 載入網站本身 | HTML / JS / CSS / OCR 引擎與語言資料 | 否 |
| NER 模型下載（僅在使用者開啟 NER 時） | 模型權重（約 135 MB，之後由瀏覽器快取） | 否，只下載、不上傳 |
| Google Fonts | 字型檔 | 否；離線時退回系統字型 |

模型下載完成後，推論完全在本機執行。你可以在瀏覽器開發者工具的 Network 面板自行驗證。

## 已知限制

PrivacyLens 是輔助工具，**不保證偵測出所有個資**。分享前請務必目視檢查輸出結果。

- OCR 對模糊、極小字、低對比的截圖可能漏字或切錯，請搭配手動框選補強。
- 規則主要涵蓋台灣常見格式（手機、市話、身分證、地址），其他國家的格式覆蓋有限。
- 未開啟 NER 時，人名僅靠標籤與啟發式判斷，信心低、可能誤報或漏報。
- NER 對中文組織名稱／地點偶有誤標。
- 手動框選目前不支援移動或縮放既有的框，需刪除後重畫。
- PDF 輸出為點陣化頁面，檔案較大且文字不可選取——這是為了確保遮蔽不可逆。
- iOS 版目前僅支援圖片，尚無 PDF、NER、人臉與條碼偵測，且未在實機上完整驗證。

## 路線圖

| 階段 | 內容 | 狀態 |
|---|---|---|
| 1 | Web PoC：拖放 → OCR → 偵測 → 遮罩 → 匯出 | ✅ 完成 |
| 2 | Privacy Core：Schema、風險、Regex、Pipeline、標準測試資料 | ✅ 完成 |
| 3 | Web MVP：PDF／文字、NER、PWA、離線、手動框選、EXIF | 🟡 Privacy Report 匯出與公開部署待完成 |
| 4 | iOS 本機版：Vision OCR + Regex + Core Image | 🟡 程式完成、核心已驗證，待實機測試 |
| 5 | iOS 進階：Core ML NER、人臉、QR／條碼、EXIF、相機 | ⏳ 規劃中 |

## 貢獻

歡迎 Issue 與 Pull Request！特別需要的協助：

- 真實情境的截圖樣本（請先去識別化）與漏報／誤報回報
- 其他地區的個資格式規則（連同 fixtures 正反例）
- OCR 品質與效能改善

提交前請確認 `npm test`、`npm run typecheck` 通過；若修改了規則，也請同步 iOS 並執行 `npm run test:ios`。

## 授權

本專案以 [MIT License](LICENSE) 授權。

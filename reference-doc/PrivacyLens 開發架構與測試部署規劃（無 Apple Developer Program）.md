# PrivacyLens 開發架構與測試部署規劃（無 Apple Developer Program）

目標：同時規劃 Web App 與 iOS App，但現階段不加入 Apple Developer Program、不上架 App Store，也不使用 TestFlight。iOS 版只透過 Mac \+ Xcode 連接自己的 iPhone 安裝與測試，直到產品需求、使用者規模或發佈需求成立後，再補上正式 Apple Developer Program 與 App Store 發佈流程。

# 一、目前的開發限制與原則

現階段限制：沒有付費 Apple Developer Program 帳號；沒有預期短期上架 App Store；只需要在自己的電腦與 iPhone 上安裝測試；Web 版可以正常公開部署；AI 推論盡量本地執行，不把使用者影像、文件或辨識結果上傳伺服器。  
Apple Personal Team 限制必須直接納入規劃：以免費 Apple Account 登入 Xcode 後，可把 App 安裝到個人裝置，但 provisioning profile 會在 7 天後到期，因此需要重新 Build / Run；最多可註冊 3 台裝置，且每台最多安裝 3 個這類 App。  
因此 iOS 階段的產品目標不是「可發佈」，而是「可穩定在自己的測試機驗證核心流程」。所有需要 App Store Connect、TestFlight、正式發佈、付費 entitlement 或正式分發能力的功能，先視為 Future Scope。

# 二、建議產品策略

產品仍建議同時保留 Web 與 iOS 兩個方向，但開發順序不要同步展開。先做 Web MVP 證明產品價值，再做 iOS Native 版本。這樣可以先驗證 OCR、個資偵測、風險評分與遮罩流程，再把成熟邏輯搬到 iOS。  
Web 版角色：免安裝 Demo、容易分享、公開測試、快速更新。iOS 版角色：相機、相簿、Files、Share Sheet、本機 Vision / Core ML、即時掃描與真正 Mobile Offline。

# 三、整體架構

核心原則：一套 AI Pipeline、一套 Entity Schema、一套 Privacy Risk 規則、兩個推論 Runtime。Web 與 iOS 不強求共用所有程式碼，但共用輸出格式、模型來源、測試資料與產品規則。  
Web：React / TypeScript → Web Worker → ONNX Runtime Web → WebGPU（可用時）/ WASM fallback → Canvas / IndexedDB / OPFS。  
iOS：SwiftUI → Vision / Core ML → Neural Engine / GPU / CPU → Core Image / FileManager。  
Cloud 只提供靜態網站、模型檔、版本 manifest 與未來更新資源；不處理使用者圖片、PDF、OCR 結果或 AI 推論請求。

# 四、PrivacyLens 核心 Pipeline

Input：Image、Screenshot、PDF、Text；iOS 後續再加入 Camera、Photos、Files、Share Extension。  
Step 1 — Metadata Scanner：偵測 EXIF、GPS、拍攝裝置等 metadata。  
Step 2 — OCR：取得文字與 Bounding Box。Web 可用 ONNX / Browser OCR；iOS 優先用 Apple Vision。  
Step 3 — Sensitive Entity Detection：Regex \+ NER。Regex 處理 Email、電話、網址、IP、台灣身分證、信用卡、銀行帳號等 deterministic pattern；NER 模型處理 PERSON、ADDRESS、ORGANIZATION、LOCATION 等語意型資訊。  
Step 4 — Visual Privacy Detection：Face、QR Code、Barcode。iOS 優先用 Vision；Web 端用 Browser API、MediaPipe 或 ONNX。  
Step 5 — Entity Merge：將 OCR、NER、Regex、Vision、Metadata 統一成同一種 Entity Schema。  
Step 6 — Privacy Risk Engine：模型只負責 Detect；Business Logic 決定風險。每種 entity 定義 severity，產生 Low / Medium / High / Critical 風險等級。  
Step 7 — Redaction Engine：Web 使用 Canvas；iOS 使用 Core Image。支援 Black Box、Blur、Pixelate、Remove Metadata。永遠輸出新檔案，不覆蓋原始檔。

# 五、共用資料格式

Web 與 iOS 統一輸出 Entity 結構：type、text、confidence、bbox、source、riskLevel。UI 不需要知道底層是 Apple Vision、ONNX 或 Regex，只處理同一份結果格式。  
Bounding Box 建議使用 normalized coordinates（0–1），避免 Web 與 iOS 因圖片解析度不同而需要重寫 redaction 邏輯。

# 六、模型策略

第一版不要使用大型 LLM。PrivacyLens 更適合 OCR \+ NER \+ Regex \+ Vision。這樣模型更小、速度更快、可離線、比較容易 Browser-side 與 iPhone 本機推論，也更容易驗證錯誤。  
建議建立單一 Source Model，再匯出兩個格式：PyTorch / Hugging Face source model → ONNX 給 Web → Core ML 給 iOS。兩邊共用 tokenizer、label mapping、測試資料與版本號。  
模型下載策略：小型基本模型可直接隨 App / Web 發佈；較大的進階模型可以第一次使用時才下載並快取。Web 放在 CDN 後存入 Cache Storage / IndexedDB / OPFS；iOS 可下載後 compile 成 mlmodelc 並存到 Application Support。  
因為目前 iOS 只在自己的手機測試，第一版甚至可以先把 Core ML 模型直接放進 Xcode bundle，完全不需要建立遠端 model update 系統。等模型更新頻率變高後再加入 manifest / version / hash 機制。

# 七、Web 部署方式

Web App 建議先部署為 Static Site，可使用 Cloudflare Pages、Vercel 或 Netlify。模型可先放在 public/models；之後模型容量變大，再移到 R2 / CDN。  
第一次使用需要網路下載 App assets 與模型；下載完成並完成快取後，可透過 PWA \+ Service Worker 提供 Offline-first 使用。對外說明應使用「模型下載完成後，推論完全在本機執行」而不是宣稱第一次開啟就完全不需要網路。  
Web 推論：優先 WebGPU，但一定保留 WASM fallback。不要讓產品只在支援 WebGPU 的瀏覽器才能運作。

# 八、iOS：無 Developer Program 的開發方式

需要：一台 Mac、Xcode、一個一般 Apple Account、一台自己的 iPhone。Apple Developer Program 會員資格目前不是必要條件。  
Xcode 設定流程：在 Xcode \> Settings \> Accounts 登入 Apple Account；Target \> Signing & Capabilities 開啟 Automatically manage signing；Team 選擇自己的 Personal Team；使用唯一的 Bundle Identifier；用 USB 或已配對的無線方式連接 iPhone；在 Xcode 選擇該 iPhone 為 Run Destination；按 Run 安裝。  
第一次可能需要在 iPhone 允許 Developer Mode 或信任相關開發設定，依 Xcode / iOS 提示完成即可。  
免費 Personal Team 的核心限制：Provisioning Profile 7 天到期；到期後 App 可能無法正常啟動，需要回到 Mac 重新 Build / Run 安裝。這是現階段可接受的測試成本，因此不要為了避開這件事提早付費加入 Developer Program。  
目前不要規劃：App Store 上架、TestFlight、對外安裝連結、Ad Hoc 分發、企業分發、正式 production signing。這些都延後到真的要讓其他人穩定安裝時再處理。

# 九、目前應避免依賴的 iOS 能力

在沒有 Apple Developer Program 的階段，不要讓 MVP 依賴需要額外 entitlement、正式服務設定或 distribution workflow 的功能。例如遠端 Push Notification、Sign in with Apple、CloudKit / iCloud 深度整合、Apple Pay、App Store In-App Purchase 等。  
PrivacyLens 的核心功能並不需要上述能力。第一版可完全使用 Local Files、Photos Picker、Camera、Vision、Core ML、Core Image 與本機 storage。

# 十、iOS 第一版測試範圍

先做：選擇一張 Screenshot / Photo → Vision OCR → Regex 偵測 Email / Phone / Taiwan ID → 畫 Bounding Box → Redact All → 匯出新圖片。  
第二階段：加入 Core ML NER → Person / Address / Organization。  
第三階段：加入 Face / QR / Barcode / EXIF / GPS。  
第四階段：加入 Camera Live Preview，但仍只作為自己的測試版本，不處理商店發佈問題。  
第五階段：加入 Share Extension，讓 Photos 或 Files 可以 Share → PrivacyLens → Scan → Redact → 再分享。若免費簽署對 Extension 或 capability 造成額外限制，就把 Extension 保留到加入 Developer Program 後，不阻塞核心 App。

# 十一、建議 Repository 結構

privacylens/  
apps/web — React / TypeScript Web App  
apps/ios — SwiftUI / Xcode Project  
packages/privacy-spec — Entity type、risk rule、JSON schema、測試案例  
models/source — 原始模型與 tokenizer  
models/onnx — Web 模型  
models/coreml — iOS 模型  
training — fine-tune / evaluation  
scripts — export-onnx、export-coreml、quantize、model validation

# 十二、實際開發順序

## Phase 1 — Web Proof of Concept

完成 Image Drag & Drop → OCR → Bounding Box → Email / Phone / Taiwan ID Regex → Redact All → Export。此時不做登入、後端、Database、LLM。

## Phase 2 — Privacy Core

定義 Entity Schema、Risk Rules、Regex Rules、Detection Pipeline、標準測試資料。讓不同平台輸出結果可以互相比對。

## Phase 3 — Web MVP

加入 PDF / Text、模型 NER、PWA、Offline cache、Privacy Report、完整 redaction UI。部署公開網址，作為主要展示與測試入口。

## Phase 4 — iOS Local Test Build

建立 SwiftUI App；加入 Vision OCR、Regex、Core Image；使用 Personal Team 簽署，直接從 Xcode 安裝到自己的 iPhone。接受 7 天後需要重新安裝的限制。

## Phase 5 — iOS AI Enhancement

加入 Core ML NER、Face、Barcode、Metadata、Camera。這個階段仍然不需要 App Store。

## Phase 6 — 是否加入 Apple Developer Program 的決策點

只有在出現以下任一需求時再付費加入：需要讓其他測試者不用每 7 天重新簽署；需要 TestFlight；需要正式 App Store 發佈；需要較完整 entitlement / service；需要正式 distribution signing；需要建立公開 iOS Beta。

# 十三、目前最推薦的 MVP

Web MVP：Screenshot → Scan → 找出 Email / Phone / ID → 自動框選 → Redact All → Download。  
iOS MVP：Photos Picker → Vision OCR → Regex → Redact → Save / Share。  
兩邊先不要加入大型 LLM，也不要加入帳號系統、後端資料庫或雲端推論。產品差異化就是 No Uploads、No AI API、Local Processing。

# 十四、未來升級到正式 iOS 發佈時需要增加的工作

加入 Apple Developer Program 後，再處理正式 Bundle ID / Certificates / Provisioning、App Store Connect、TestFlight、Privacy Nutrition Label、App Privacy、正式 entitlement、Crash / Analytics 策略、App Store metadata、screenshots、review workflow。  
目前的架構不需要因此重做：SwiftUI \+ Vision \+ Core ML \+ Local-first 本身就是正式 App 可延續的架構，現在只是 distribution 與 signing 採用 Personal Team。

# 十五、最終決策

現階段最佳策略：Web 版先公開部署並快速迭代；iOS 版使用免費 Personal Team，只安裝到自己的 iPhone 做本機測試。不要因為還沒有 Apple Developer Program 而延後 iOS 開發，也不要因為想做 iOS 就提前處理 App Store。  
開發優先順序：先證明 Detection \+ Redaction 的產品價值，再做模型優化；先做 Web，再做 iOS；先做本機測試，再考慮 distribution。這能把成本、複雜度與開發風險降到最低。  

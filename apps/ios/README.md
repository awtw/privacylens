# PrivacyLens iOS（Phase 4：本機測試版，無需 Apple Developer Program）

SwiftUI + Apple Vision（OCR）+ Core Image（遮罩）。所有處理都在 iPhone 本機完成，沒有任何網路請求。

## 結構
- `Sources/PrivacyLensKit` — 與 `packages/privacy-spec`（TypeScript）對應的核心：`Rules`、`Validators`、`Risk`、`Pipeline`、`Geometry`，加上 `VisionOCR` 與 `Redactor`。
- `Sources/kit-check` — 不依賴 XCTest 的驗證程式（共用 `fixtures/cases.json`）。
- `App/` — SwiftUI 介面（選圖 → 掃描 → 框選／手動畫框 → 遮罩 → 分享／存相簿）。
- `project.yml` — XcodeGen 設定；`PrivacyLens.xcodeproj` 為產物，不進 git。

## 驗證核心（不需要 Xcode）
```bash
npm run test:ios      # 同步 fixtures 後執行 swift run kit-check
```

## 安裝到自己的 iPhone（免費 Personal Team）
1. 一次性：同意 Xcode 授權 `sudo xcodebuild -license`，並在 Xcode > Settings > Components 安裝 iOS 平台。
2. `brew install xcodegen`，然後 `cd apps/ios && xcodegen generate`，開啟 `PrivacyLens.xcodeproj`。
3. Xcode > Settings > Accounts 登入一般 Apple Account。
4. Target `PrivacyLens` > Signing & Capabilities：勾選 *Automatically manage signing*，Team 選你的 **Personal Team**，把 Bundle Identifier 改成唯一值（例如 `com.<你的名字>.privacylens`）。
5. 用 USB 接上 iPhone，選為 Run Destination，按 Run。第一次需在 iPhone「設定 > 隱私權與安全性 > 開發者模式」開啟，並在「VPN 與裝置管理」信任你的開發者。
6. 限制：Personal Team 的 provisioning profile **7 天到期**，到期後需回到 Mac 重新 Run；最多 3 台裝置、3 個 App。

## 與 Web 版的差異 / 待辦
- 已有：Vision OCR、Regex + 人名啟發式（同一份規則與 fixtures）、手動框選、黑框／模糊／馬賽克、分享與存相簿。
- 尚未：Core ML NER（Phase 5）、Face／QR／Barcode、EXIF 掃描、Camera、Share Extension、PDF。
- Vision 以 `NLTokenizer` 把中文斷詞後再交給 pipeline，讓姓名啟發式能運作；實機 OCR 品質需用真實截圖調校。

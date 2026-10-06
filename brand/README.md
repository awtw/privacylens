# PrivacyLens 品牌素材

**概念**：掃描框（找出）＋文字行（內容）＋一條橘色斜切遮蔽條（遮蔽）。遮蔽條的斜切端呼應 8plus「%」標誌的斜線；配色沿用 8plus：克萊因藍 `#002FA7`、橘 `#FE5000`、夜色 `#0A0E1A`。

| 檔案 | 用途 |
|---|---|
| `privacylens-mark.svg` | 標誌（白色線條，用在藍／深色底） |
| `privacylens-mark-dark.svg` | 標誌（藍色線條，用在淺色底） |
| `privacylens-app-icon.svg` | App 圖示（藍底圓角） |
| `privacylens-horizontal.svg` | 橫式標誌＋字樣（字型為 Georgia／JetBrains Mono，未轉外框） |
| `privacylens-app-icon-1024.png` | 圓角預覽圖（透明角） |

派生（由 `apps/web/scripts/generate-icons.mjs` 一次產生）：Web favicon／PWA 圖示（`apps/web/public`）、iOS `AppIcon`（`apps/ios/App/Assets.xcassets`，1024 方形不透明，由系統裁切圓角）。
修改設計：改腳本內的 `mark()` 後重跑 `cd apps/web && node scripts/generate-icons.mjs`；SwiftUI 與 React 的 `LogoMark`／`Logo` 需手動同步（座標相同）。

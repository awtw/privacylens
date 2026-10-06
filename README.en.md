<div align="center">

<img src="brand/privacylens-horizontal.svg" alt="PrivacyLens" width="360" />

**Detect and redact personal data in screenshots, images, PDFs and text**

`No Uploads` · `No AI API` · `Local Processing`

[繁體中文](README.md) · **English**

</div>

---

PrivacyLens finds personal data (emails, phone numbers, national ID numbers, credit cards, addresses, names, …) in a screenshot or document *before* you share it, lets you review the findings, and redacts them in one click, producing a **brand-new file**.

What sets it apart: **your images and text never leave your device.** There is no backend server and no cloud AI API. OCR and detection run entirely in your browser or on your iPhone.

## Table of contents

- [Features](#features)
- [What it detects](#what-it-detects)
- [How it works](#how-it-works)
- [Quick start (Web)](#quick-start-web)
- [iOS app](#ios-app)
- [Project structure](#project-structure)
- [Development guide](#development-guide)
- [Privacy and network requests](#privacy-and-network-requests)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Fully local**: no uploads, no backend; the server only serves static files.
- **Multiple inputs**: images/screenshots, PDFs (up to 20 pages), plain text.
- **Review and adjust**: every finding is listed and can be unchecked if it is a false positive; drag on the image to manually mark anything that was missed.
- **Three redaction styles**: black box, blur, mosaic.
- **Irreversible redaction**: PDF output is rebuilt as an image-only PDF, so redacted text cannot be selected or copied back out.
- **Metadata stripping**: scans EXIF/GPS (location, device, software, capture time) and includes it in the risk score; images are re-encoded on export, which removes it.
- **Risk scoring**: `low / medium / high / critical` plus a 0–100 score based on what was found.
- **Works offline**: the Web app is a PWA that pre-caches the OCR engine and language data on first load.
- **Chinese and English**: bundled Traditional Chinese + English OCR; rules are tuned for common Taiwanese formats (mobile, landline, national ID, address).
- **Always writes a new file**: your original is never overwritten.
- **Two platforms, one set of rules**: Web (React) and iOS (SwiftUI) share the same spec and test fixtures so behavior stays consistent.

## What it detects

Risk levels are decided by product rules (`packages/privacy-spec/src/risk.ts`); models only *detect*, they never decide severity.

| Risk | Types |
|---|---|
| 🔴 critical | Taiwan national ID (checksum validated), credit card (Luhn validated) |
| 🟠 high | Bank account, phone (mobile/landline), address, GPS, face*, manual custom box |
| 🟡 medium | Email, person name, username (@handle), IP address, ID/reference number, QR code*, barcode*, device info |
| 🟢 low | Organization, location, URL |

\* The type exists in the data contract, but the detector is planned for a later phase. See the [roadmap](#roadmap).

Detection methods:

- **Regex rules + validators**: ID checksum, credit-card Luhn; bank accounts require a keyword context such as "account" to reduce false positives.
- **Heuristics**: person names are inferred from labels (name, contact, recipient, …), common surnames and runs of capitalized English words (lower confidence; the user confirms).
- **NER (optional)**: when enabled, a multilingual NER model recognizes people, organizations and locations (Web only, off by default; see [privacy notes](#privacy-and-network-requests)).

## How it works

```
Input (image / screenshot / PDF / text)
  → Metadata scan (EXIF / GPS)
  → OCR (text + coordinates)
  → Regex + NER ─┐
  → Vision (face / QR / barcode, planned) ─┤→ Entity merge → Risk engine → Redaction engine → new file
```

Design principles:

1. **One pipeline, one entity schema, one risk ruleset**, two runtimes (Web / iOS).
2. **Coordinates are always normalized (0–1)**, independent of resolution and platform.
3. **No large LLM in v1**: just OCR + Regex + a small NER model.
4. **The cloud only serves static files and model weights**; it never touches user images or text.

| Layer | Web | iOS |
|---|---|---|
| UI | React + TypeScript + Vite | SwiftUI |
| OCR | tesseract.js (self-hosted, zh-Hant + English) | Apple Vision |
| NER | transformers.js (Web Worker, optional) | Planned (Core ML) |
| Redaction | Canvas | Core Image |
| PDF | pdf.js (to images) + pdf-lib (output) | Planned |

See [docs/architecture.md](docs/architecture.md) for the full design (written in Traditional Chinese).

## Quick start (Web)

**Requirements**: Node.js ≥ 20, npm ≥ 10.

```bash
git clone git@github.com:awtw/privacylens.git
cd privacylens
npm install
npm run dev
```

Open the URL printed in the terminal (Vite defaults to `http://localhost:5173`) and drop in a screenshot, image or PDF.

> On the first `dev` / `build`, the `predev` / `prebuild` script copies the OCR engine and language data (~14 MB) from `node_modules` into `apps/web/public/ocr`. These files are not committed to git.

### Common commands

```bash
npm run dev          # start the dev server
npm run build        # build the static site → apps/web/dist
npm test             # run privacy-spec unit tests (vitest)
npm run typecheck    # TypeScript type check
```

### Deployment

The output of `npm run build` (`apps/web/dist`) is a plain static site. Host it on Cloudflare Pages, Vercel, Netlify, GitHub Pages or any static host. The Service Worker is only registered in production builds.

> Tip: to verify PDF or offline behavior locally, run `npm run build` and then `npx vite preview`. The dev server occasionally stalls when loading the pdf.js worker.

## iOS app

The iOS app uses SwiftUI + Apple Vision (OCR) + Core Image (redaction), and the whole flow runs offline on the iPhone.

It is currently a **local test build**: it does not require the paid Apple Developer Program. You sign with a free Personal Team and install it on your own iPhone.

**Requirements**: a Mac, Xcode, a regular Apple Account, an iPhone.

```bash
# Verify the core logic (no simulator or device needed)
npm run test:ios

# Generate and open the Xcode project
brew install xcodegen
cd apps/ios && xcodegen generate
open PrivacyLens.xcodeproj
```

Then sign in to your Apple Account in Xcode, set your Team and a unique Bundle ID (configured in `apps/ios/project.yml`), connect your iPhone and press Run.

> A Personal Team provisioning profile **expires after 7 days**; reinstall from Xcode when it does. Up to 3 devices.

See [apps/ios/README.md](apps/ios/README.md) for detailed install steps, command-line install and debugging (written in Traditional Chinese).

## Project structure

```
privacylens/
├── apps/
│   ├── web/                 React + Vite front end (PWA)
│   └── ios/                 SwiftUI app and PrivacyLensKit
├── packages/
│   └── privacy-spec/        Shared spec: Entity / Risk / Regex / Pipeline / fixtures
│                            (pure TypeScript, no DOM dependency)
├── brand/                   Logo and app-icon assets
├── docs/                    Architecture and development docs
└── reference-doc/           Original planning document
```

`packages/privacy-spec` is the heart of the project:

| File | Description |
|---|---|
| `types.ts` | Data contracts: `Entity`, `BBox`, `OcrWord` |
| `rules.ts` | Detection rules (Regex) |
| `validators.ts` | ID checksum, credit-card Luhn |
| `risk.ts` | Risk-level mapping and risk score |
| `pipeline.ts` | OCR output → Entity (including bbox mapping) |
| `geometry.ts` | Normalized ↔ pixel coordinates |
| `metadata.ts` | EXIF / GPS pure logic |
| `fixtures/cases.json` | **Cross-platform test data** (verified by both TypeScript and Swift) |

## Development guide

### Adding a detection rule

1. Add a `Rule` in `packages/privacy-spec/src/rules.ts` (the pattern must not span lines; add `validate` or `group` if needed).
2. For a new `EntityType`, add it in `types.ts` and assign its level in `SEVERITY` in `risk.ts` (TypeScript forces you to fill it in).
3. Add positive and negative cases to `fixtures/cases.json` and run `npm test`.
4. Mirror the change in `apps/ios/Sources/PrivacyLensKit/Rules.swift` and run `npm run test:ios`. **Both sides must pass.**

### Conventions

- bbox values are always normalized (0–1); convert to pixels only at the drawing/redaction boundary.
- The UI depends only on `Entity`, never on raw output from a specific OCR/NER engine.
- **Never add a network request that uploads user data.** New network dependencies (models, language data) must be documented in the architecture doc.
- Output is always a new file.

See [docs/development.md](docs/development.md) for more (written in Traditional Chinese).

## Privacy and network requests

PrivacyLens promises that **your images, PDFs, text and OCR results are never sent to any server.** To keep that statement honest, here is every network behavior:

| Behavior | Content | Contains user data? |
|---|---|---|
| Loading the site itself | HTML / JS / CSS / OCR engine and language data | No |
| NER model download (only if the user enables NER) | Model weights (~135 MB, then cached by the browser) | No; download only, nothing is uploaded |
| Google Fonts | Font files | No; falls back to system fonts offline |

After the model is downloaded, inference runs entirely locally. You can verify this yourself in your browser's Network panel.

## Known limitations

PrivacyLens is an aid and **does not guarantee that all personal data is found**. Always visually check the output before sharing.

- OCR may miss or mis-segment text in blurry, tiny or low-contrast screenshots; use manual boxes to compensate.
- Rules mainly cover common Taiwanese formats (mobile, landline, national ID, address); coverage for other countries is limited.
- Without NER, person names rely on labels and heuristics: low confidence, with possible false positives and misses.
- NER sometimes mislabels Chinese organization names or locations.
- Manual boxes cannot yet be moved or resized; delete and redraw instead.
- PDF output is rasterized: larger files and no selectable text. This is deliberate, to keep redaction irreversible.
- The iOS app currently handles images only (no PDF, NER, face or barcode detection) and has not been fully verified on a physical device.

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Web PoC: drop → OCR → detect → redact → export | ✅ Done |
| 2 | Privacy Core: schema, risk, Regex, pipeline, shared fixtures | ✅ Done |
| 3 | Web MVP: PDF/text, NER, PWA, offline, manual boxes, EXIF | 🟡 Privacy Report export and public deployment pending |
| 4 | iOS local build: Vision OCR + Regex + Core Image | 🟡 Code complete, core verified; device testing pending |
| 5 | iOS advanced: Core ML NER, face, QR/barcode, EXIF, camera | ⏳ Planned |

## Contributing

Issues and pull requests are welcome! Help is especially appreciated with:

- Real-world screenshot samples (please anonymize first) and reports of false negatives/positives
- Rules for personal-data formats from other regions (with positive and negative fixtures)
- OCR quality and performance improvements

Before submitting, make sure `npm test` and `npm run typecheck` pass. If you changed rules, mirror them in iOS and run `npm run test:ios`.

## License

Released under the [MIT License](LICENSE).

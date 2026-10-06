import CoreGraphics
import Foundation
import ImageIO
@testable import PrivacyLensKit

// Framework-free checks: shared fixtures + pipeline, geometry, redaction, Vision smoke test.
var failures = 0
var checks = 0
func expect(_ ok: Bool, _ msg: @autoclosure () -> String) {
    checks += 1
    if !ok { failures += 1; print("FAIL: \(msg())") }
}
func close(_ a: Double, _ b: Double) -> Bool { abs(a - b) < 1e-9 }

struct Case: Decodable {
    struct Exp: Decodable { let type: String; let text: String }
    let name: String; let text: String; let expected: [Exp]
}


// Debug: `swift run kit-check --image path.png` prints Vision words and detected entities.
if let i = CommandLine.arguments.firstIndex(of: "--image"), i + 1 < CommandLine.arguments.count {
    let path = CommandLine.arguments[i + 1]
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil), let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
        print("cannot load \(path)"); exit(2)
    }
    print("image \(img.width)x\(img.height)")
    let words = try VisionOCR.recognize(img)
    for w in words { print(String(format: "W line%-2d x%.3f y%.3f w%.3f h%.3f  %@", w.line, w.bbox.x, w.bbox.y, w.bbox.w, w.bbox.h, w.text)) }
    for e in Pipeline.detect(words: words) {
        let b = e.bbox!
        print(String(format: "E %@ %.2f x%.3f y%.3f w%.3f h%.3f  %@", e.type.rawValue, e.confidence, b.x, b.y, b.w, b.h, e.text))
    }
    exit(0)
}

// 1. Shared fixtures — identical to the TypeScript suite.
let url = Bundle.module.url(forResource: "cases", withExtension: "json", subdirectory: "Fixtures")!
let cases = try JSONDecoder().decode([Case].self, from: Data(contentsOf: url))
expect(cases.count >= 30, "fixtures loaded (\(cases.count))")
for c in cases {
    let got = Pipeline.detect(text: c.text).map { "\($0.type.rawValue)|\($0.text)" }
    let want = c.expected.map { "\($0.type)|\($0.text)" }
    expect(got == want, "fixture '\(c.name)': got \(got) want \(want)")
}

// 2. Validators
expect(Validators.isValidTaiwanId("A123456789"), "valid TW id")
expect(!Validators.isValidTaiwanId("A123456780"), "invalid TW id")
expect(Validators.isValidLuhn("4111111111111111"), "valid luhn")
expect(!Validators.isValidLuhn("4111111111111112"), "invalid luhn")

// 3. OCR words → entities with boxes
func w(_ t: String, _ line: Int, _ x: Double) -> OcrWord { OcrWord(text: t, bbox: BBox(x: x, y: Double(line) * 0.1, w: 0.1, h: 0.05), line: line) }
let es = Pipeline.detect(words: [w("Mail:", 0, 0.1), OcrWord(text: "a@b.com", bbox: BBox(x: 0.2, y: 0.1, w: 0.2, h: 0.05), line: 0),
                                 w("0912", 1, 0.1), w("345", 1, 0.2), w("678", 1, 0.3)])
expect(es.map(\.type) == [.EMAIL, .PHONE], "types \(es.map(\.type))")
expect(es.count == 2 && es[1].riskLevel == .high && close(es[1].bbox!.w, 0.3), "phone box/risk")
expect(Risk.summarize(es).level == .high, "risk level")
let sliced = Pipeline.detect(words: [OcrWord(text: "mail:a@b.com", bbox: BBox(x: 0, y: 0, w: 1, h: 0.1), line: 0)])
expect(sliced.count == 1 && close(sliced[0].bbox!.x, 5.0 / 12.0), "partial word slicing")
let names = Pipeline.detect(words: [w("王", 0, 0.1), w("大", 0, 0.2), w("明", 0, 0.3), w("已", 0, 0.4), w("送出", 0, 0.5)])
expect(names.map(\.text) == ["王大明"] && close(names[0].bbox!.w, 0.3), "merged single-char name \(names.map(\.text))")
expect(Pipeline.detect(words: [w("王小明", 0, 0.1), w("金額", 0, 0.3)]).map(\.text) == ["王小明"], "name stopword")

// 4. maskText + geometry
expect(Pipeline.maskText("信箱 a@b.com 結束", label: true) == "信箱 [EMAIL] 結束", "mask label")
expect(Pipeline.maskText("a@b.com") == "███████", "mask block")
let box = Geometry.box(from: CGPoint(x: 0.5, y: 0.6), to: CGPoint(x: 0.2, y: 1.4))
expect(close(box.x, 0.2) && close(box.y, 0.6) && close(box.w, 0.3) && close(box.h, 0.4), "box from points")
expect(Geometry.pixelRect(BBox(x: 0, y: 0, w: 1, h: 1), width: 100, height: 50, pad: 5) == CGRect(x: 0, y: 0, width: 100, height: 50), "pixelRect clamp")

// 5. Core Image redaction
func bitmap(_ w: Int, _ h: Int) -> CGContext {
    CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(),
              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
}
func red(_ img: CGImage, _ x: Int, _ y: Int) -> UInt8 {
    let c = bitmap(img.width, img.height)
    c.draw(img, in: CGRect(x: 0, y: 0, width: img.width, height: img.height))
    return c.data!.assumingMemoryBound(to: UInt8.self)[y * img.width * 4 + x * 4]
}
let white = bitmap(100, 100)
white.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1)); white.fill(CGRect(x: 0, y: 0, width: 100, height: 100))
let src = white.makeImage()!
let ent = Entity(id: "x", type: .CUSTOM, text: "", confidence: 1, bbox: BBox(x: 0.2, y: 0.2, w: 0.3, h: 0.3), source: .manual, riskLevel: .high)
for mode in RedactMode.allCases {
    let out = Redactor.redact(src, entities: [ent], mode: mode)
    expect(out != nil && out!.width == 100 && out!.height == 100, "redact \(mode) produces image")
    if mode == .blackbox, let out {
        expect(red(out, 35, 35) == 0, "black box covers region (top-left origin)")
        expect(red(out, 90, 90) == 255, "outside untouched")
        expect(red(out, 35, 85) == 255, "bottom region untouched (y flip)")
        expect(Redactor.pngData(out) != nil, "png encode")
    }
}

// 6. Vision smoke test: render text, OCR it, expect it to be read.
let canvas = bitmap(900, 160)
canvas.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1)); canvas.fill(CGRect(x: 0, y: 0, width: 900, height: 160))
#if canImport(CoreText)
import CoreText
let attr = NSAttributedString(string: "Email john.doe@example.com Phone 0912-345-678",
                              attributes: [NSAttributedString.Key(kCTFontAttributeName as String): CTFontCreateWithName("Helvetica" as CFString, 36, nil)])
let line = CTLineCreateWithAttributedString(attr)
canvas.textPosition = CGPoint(x: 20, y: 60)
CTLineDraw(line, canvas)
#endif
do {
    let words = try VisionOCR.recognize(canvas.makeImage()!)
    let found = Pipeline.detect(words: words)
    print("Vision read: \(words.map(\.text).joined(separator: " "))")
    expect(words.allSatisfy { (0...1).contains($0.bbox.x) && (0...1).contains($0.bbox.y) }, "vision boxes normalized")
    expect(found.contains { $0.type == .EMAIL } && found.contains { $0.type == .PHONE }, "vision→pipeline finds email+phone: \(found.map { "\($0.type.rawValue)|\($0.text)" })")
} catch {
    expect(false, "vision threw: \(error)")
}

print(failures == 0 ? "OK — \(checks) checks passed" : "FAILED — \(failures)/\(checks) checks failed")
exit(failures == 0 ? 0 : 1)

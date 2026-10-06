import CoreGraphics
import Foundation
import NaturalLanguage
import Vision

/// Apple Vision OCR → `OcrWord`s with normalized top-left-origin boxes (the shape the pipeline expects).
public enum VisionOCR {
    public static func recognize(_ image: CGImage) throws -> [OcrWord] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["zh-Hant", "en-US"]
        request.usesLanguageCorrection = false // don't "fix" digits/emails into dictionary words
        try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])

        // Reading order: top to bottom, then left to right.
        let observations = (request.results ?? []).sorted {
            let a = $0.boundingBox, b = $1.boundingBox
            return abs(a.maxY - b.maxY) > 0.01 ? a.maxY > b.maxY : a.minX < b.minX
        }
        // (observation, token) pairs first; line ids are assigned afterwards from real geometry.
        var raw: [(obs: Int, text: String, box: BBox)] = []
        for (o, obs) in observations.enumerated() {
            guard let cand = obs.topCandidates(1).first else { continue }
            for range in tokenRanges(cand.string) {
                let token = String(cand.string[range])
                guard !token.isEmpty, let box = try? cand.boundingBox(for: range)?.boundingBox else { continue }
                // Vision: bottom-left origin → top-left origin.
                raw.append((o, token, BBox(x: box.minX, y: 1 - box.maxY, w: box.width, h: box.height)))
            }
        }
        // Sanity: a token far taller than typical text is a bad box (e.g. a range spanning wrapped lines). Drop it
        // rather than let a giant rectangle redact half the image.
        let heights = raw.map(\.box.h).sorted()
        let medianH = heights.isEmpty ? 0 : heights[heights.count / 2]
        raw = raw.filter { medianH == 0 || $0.box.h <= medianH * 3 }

        // One observation can wrap over several visual lines: split it so entity boxes never union across lines.
        var words: [OcrWord] = []
        var lineId = -1
        var prevObs = -1
        var lineCenter = 0.0
        for r in raw {
            let cy = r.box.y + r.box.h / 2
            if r.obs != prevObs || abs(cy - lineCenter) > max(r.box.h, medianH) * 0.6 {
                lineId += 1
                lineCenter = cy
                prevObs = r.obs
            }
            words.append(OcrWord(text: r.text, bbox: r.box, line: lineId))
        }
        return words
    }

    /// Whitespace splits tokens; non-CJK runs stay intact (emails, numbers, URLs); CJK runs are segmented
    /// with NaturalLanguage so names/words become separate tokens. Every character is covered exactly once.
    static func tokenRanges(_ s: String) -> [Range<String.Index>] {
        var out: [Range<String.Index>] = []
        var i = s.startIndex
        while i < s.endIndex {
            if s[i].isWhitespace { i = s.index(after: i); continue }
            let cjk = Rules.isCJK(s[i])
            var j = i
            while j < s.endIndex, !s[j].isWhitespace, Rules.isCJK(s[j]) == cjk { j = s.index(after: j) }
            let run = i..<j
            if cjk {
                let tk = NLTokenizer(unit: .word)
                tk.string = s
                tk.setLanguage(.traditionalChinese)
                var starts: [String.Index] = [run.lowerBound]
                tk.enumerateTokens(in: run) { r, _ in
                    if r.lowerBound > run.lowerBound, r.lowerBound > starts.last! { starts.append(r.lowerBound) }
                    return true
                }
                for (k, st) in starts.enumerated() {
                    out.append(st..<(k + 1 < starts.count ? starts[k + 1] : run.upperBound))
                }
            } else {
                out.append(run)
            }
            i = j
        }
        return out
    }
}

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
        var words: [OcrWord] = []
        for (line, obs) in observations.enumerated() {
            guard let cand = obs.topCandidates(1).first else { continue }
            for range in tokenRanges(cand.string) {
                let token = String(cand.string[range])
                guard !token.isEmpty, let box = try? cand.boundingBox(for: range)?.boundingBox else { continue }
                // Vision: bottom-left origin → top-left origin.
                words.append(OcrWord(text: token,
                                     bbox: BBox(x: box.minX, y: 1 - box.maxY, w: box.width, h: box.height),
                                     line: line))
            }
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

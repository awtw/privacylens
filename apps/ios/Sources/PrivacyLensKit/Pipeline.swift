import Foundation

/// Port of packages/privacy-spec/src/pipeline.ts (regex + name heuristics; NER arrives with Core ML in Phase 5).
/// All offsets are UTF-16 (NSRange / `utf16.count`) to match the TypeScript implementation exactly.
public enum Pipeline {
    struct Span { var word: Int; var start: Int; var end: Int }
    struct Candidate { var type: EntityType; var start: Int; var end: Int; var confidence: Double }

    /// Joins OCR words (space within a line, newline between lines) and records offsets.
    static func buildTextIndex(_ words: [OcrWord]) -> (text: String, spans: [Span]) {
        var text = ""
        var len = 0
        var spans: [Span] = []
        for (i, w) in words.enumerated() {
            if i > 0 {
                let prev = words[i - 1]
                // OCR emits CJK characters as separate words; don't inject spaces between them.
                let cjkJoin = (prev.text.last.map(Rules.isCJK) ?? false) && (w.text.first.map(Rules.isCJK) ?? false)
                let sep = prev.line == w.line ? (cjkJoin ? "" : " ") : "\n"
                text += sep
                len += sep.utf16.count
            }
            let n = w.text.utf16.count
            spans.append(Span(word: i, start: len, end: len + n))
            text += w.text
            len += n
        }
        return (text, spans)
    }

    static func collectCandidates(_ text: String, rules: [Rule] = Rules.all) -> [Candidate] {
        let ns = text as NSString
        let full = NSRange(location: 0, length: ns.length)
        var found: [Candidate] = []
        for rule in rules {
            for m in rule.regex.matches(in: text, range: full) {
                let r = m.range(at: rule.group ?? 0)
                guard r.location != NSNotFound, r.length > 0 else { continue }
                if let v = rule.validate, !v(ns.substring(with: r)) { continue }
                found.append(Candidate(type: rule.type, start: r.location, end: r.location + r.length, confidence: rule.confidence))
            }
        }
        return found
    }

    /// Keeps the best candidate among overlaps: higher confidence, then longer span, then earlier rule order.
    static func resolveOverlaps(_ cands: [Candidate]) -> [Candidate] {
        let sorted = cands.enumerated().sorted { a, b in
            if a.element.confidence != b.element.confidence { return a.element.confidence > b.element.confidence }
            let la = a.element.end - a.element.start, lb = b.element.end - b.element.start
            if la != lb { return la > lb }
            return a.offset < b.offset
        }.map(\.element)
        var kept: [Candidate] = []
        for c in sorted where !kept.contains(where: { c.start < $0.end && $0.start < c.end }) { kept.append(c) }
        return kept.sorted { $0.start < $1.start }
    }

    /// Bbox of a text range, sliced proportionally inside partially covered words; one box per line.
    static func rangeBoxes(_ words: [OcrWord], _ spans: [Span], _ start: Int, _ end: Int) -> [BBox] {
        var order: [Int] = []
        var byLine: [Int: BBox] = [:]
        for s in spans {
            let o0 = max(start, s.start), o1 = min(end, s.end)
            if o0 >= o1 { continue }
            let w = words[s.word]
            let len = Double(s.end - s.start)
            let box = BBox(x: w.bbox.x + w.bbox.w * Double(o0 - s.start) / len, y: w.bbox.y,
                           w: w.bbox.w * Double(o1 - o0) / len, h: w.bbox.h)
            if let prev = byLine[w.line] {
                let x0 = min(prev.x, box.x), y0 = min(prev.y, box.y)
                let x1 = max(prev.x + prev.w, box.x + box.w), y1 = max(prev.y + prev.h, box.y + box.h)
                byLine[w.line] = BBox(x: x0, y: y0, w: x1 - x0, h: y1 - y0)
            } else {
                byLine[w.line] = box
                order.append(w.line)
            }
        }
        return order.map { byLine[$0]! }
    }

    /// Regex + heuristic detection over OCR output → unified Entity list (one entity per line fragment).
    public static func detect(words: [OcrWord]) -> [Entity] {
        let (text, spans) = buildTextIndex(words)
        var cands = collectCandidates(text)
        // Name heuristic: standalone token = common surname + 1–2 CJK chars. Single-char OCR words are merged first.
        func single(_ k: Int) -> Bool { words[k].text.count == 1 && (words[k].text.first.map(Rules.isCJK) ?? false) }
        var i = 0
        while i < spans.count {
            var j = i + 1
            if single(i) { while j < spans.count && single(j) && words[j].line == words[i].line { j += 1 } }
            let lower = (j - i > 1) ? 2 : 1
            var len = min(j - i, 3)
            while len >= lower {
                let t = words[i..<(i + len)].map(\.text).joined()
                if Rules.looksLikeSurnameToken(t) && !Rules.nameStopwords.contains(t) {
                    cands.append(Candidate(type: .PERSON, start: spans[i].start, end: spans[i + len - 1].end, confidence: 0.4))
                    break
                }
                len -= 1
            }
            i = j
        }
        let ns = text as NSString
        var entities: [Entity] = []
        for c in resolveOverlaps(cands) {
            for box in rangeBoxes(words, spans, c.start, c.end) {
                entities.append(Entity(id: "\(c.type.rawValue)-\(entities.count)", type: c.type,
                                       text: ns.substring(with: NSRange(location: c.start, length: c.end - c.start)),
                                       confidence: c.confidence, bbox: box, source: .regex, riskLevel: Risk.of(c.type)))
            }
        }
        return entities
    }

    /// Plain-text input (no geometry).
    public static func detect(text: String) -> [Entity] {
        let ns = text as NSString
        return resolveOverlaps(collectCandidates(text)).enumerated().map { i, c in
            Entity(id: "\(c.type.rawValue)-\(i)", type: c.type,
                   text: ns.substring(with: NSRange(location: c.start, length: c.end - c.start)),
                   confidence: c.confidence, bbox: nil, source: .regex, riskLevel: Risk.of(c.type))
        }
    }

    /// Masks detected spans in plain text.
    public static func maskText(_ text: String, label: Bool = false) -> String {
        let ns = text as NSString
        var out = ""
        var last = 0
        for c in resolveOverlaps(collectCandidates(text)) {
            out += ns.substring(with: NSRange(location: last, length: c.start - last))
            out += label ? "[\(c.type.rawValue)]" : String(repeating: "█", count: max(1, c.end - c.start))
            last = c.end
        }
        return out + ns.substring(from: last)
    }
}

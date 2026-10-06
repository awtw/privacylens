import Foundation

public enum EntityType: String, Codable, CaseIterable, Sendable {
    case EMAIL, PHONE, TW_NATIONAL_ID, CREDIT_CARD, BANK_ACCOUNT, URL, IP_ADDRESS, ID_NUMBER, USERNAME
    case PERSON, ADDRESS, ORGANIZATION, LOCATION
    case FACE, QR_CODE, BARCODE, GPS, DEVICE_INFO, CUSTOM
}

public enum EntitySource: String, Codable, Sendable { case regex, ner, vision, metadata, manual }

public enum RiskLevel: String, Codable, CaseIterable, Comparable, Sendable {
    case low, medium, high, critical
    private var order: Int { Self.allCases.firstIndex(of: self)! }
    public static func < (a: RiskLevel, b: RiskLevel) -> Bool { a.order < b.order }
}

/// Normalized (0–1) rectangle, origin top-left, relative to image size.
public struct BBox: Codable, Equatable, Sendable {
    public var x: Double, y: Double, w: Double, h: Double
    public init(x: Double, y: Double, w: Double, h: Double) { self.x = x; self.y = y; self.w = w; self.h = h }
}

/// Cross-platform detection result (same shape as the TypeScript `Entity`).
public struct Entity: Codable, Identifiable, Equatable, Sendable {
    public var id: String
    public var type: EntityType
    public var text: String
    public var confidence: Double
    public var bbox: BBox?
    public var source: EntitySource
    public var riskLevel: RiskLevel
    public init(id: String, type: EntityType, text: String, confidence: Double, bbox: BBox?, source: EntitySource, riskLevel: RiskLevel) {
        self.id = id; self.type = type; self.text = text; self.confidence = confidence
        self.bbox = bbox; self.source = source; self.riskLevel = riskLevel
    }
}

/// One OCR word with a normalized, top-left-origin bbox. `line` groups words into lines.
public struct OcrWord: Equatable, Sendable {
    public var text: String
    public var bbox: BBox
    public var line: Int
    public init(text: String, bbox: BBox, line: Int) { self.text = text; self.bbox = bbox; self.line = line }
}

public struct RiskSummary: Equatable, Sendable {
    public var level: RiskLevel?
    public var score: Int
    public var counts: [RiskLevel: Int]
}

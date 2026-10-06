import Foundation

/// Models only detect; severity is decided here (product rule, not model output).
public enum Risk {
    public static let severity: [EntityType: RiskLevel] = [
        .TW_NATIONAL_ID: .critical, .CREDIT_CARD: .critical,
        .BANK_ACCOUNT: .high, .PHONE: .high, .ADDRESS: .high, .GPS: .high, .FACE: .high, .CUSTOM: .high,
        .EMAIL: .medium, .PERSON: .medium, .QR_CODE: .medium, .BARCODE: .medium, .DEVICE_INFO: .medium,
        .IP_ADDRESS: .medium, .ID_NUMBER: .medium, .USERNAME: .medium,
        .ORGANIZATION: .low, .LOCATION: .low, .URL: .low,
    ]
    private static let weight: [RiskLevel: Int] = [.low: 5, .medium: 15, .high: 30, .critical: 50]

    public static func of(_ type: EntityType) -> RiskLevel { severity[type] ?? .medium }

    public static func summarize(_ entities: [Entity]) -> RiskSummary {
        var counts: [RiskLevel: Int] = [:]
        var score = 0
        for e in entities { counts[e.riskLevel, default: 0] += 1; score += weight[e.riskLevel]! }
        return RiskSummary(level: entities.map(\.riskLevel).max(), score: min(100, score), counts: counts)
    }
}

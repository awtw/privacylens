import Foundation

public enum Validators {
    private static let letterValue: [Character: Int] = [
        "A": 10, "B": 11, "C": 12, "D": 13, "E": 14, "F": 15, "G": 16, "H": 17, "I": 34, "J": 18, "K": 19, "L": 20, "M": 21,
        "N": 22, "O": 35, "P": 23, "Q": 24, "R": 25, "S": 26, "T": 27, "U": 28, "V": 29, "W": 32, "X": 30, "Y": 31, "Z": 33,
    ]

    /// Taiwan National ID / ARC number checksum.
    public static func isValidTaiwanId(_ id: String) -> Bool {
        let chars = Array(id)
        guard chars.count == 10, let n = letterValue[chars[0]], "1289".contains(chars[1]),
              chars[1...].allSatisfy({ $0.isASCII && $0.isNumber }) else { return false }
        let weights = [8, 7, 6, 5, 4, 3, 2, 1, 1]
        var sum = n / 10 + (n % 10) * 9
        for i in 0..<9 { sum += Int(String(chars[i + 1]))! * weights[i] }
        return sum % 10 == 0
    }

    /// Luhn checksum over a digit-only string (13–19 digits).
    public static func isValidLuhn(_ digits: String) -> Bool {
        let d = digits.compactMap { $0.isASCII ? $0.wholeNumberValue : nil }
        guard d.count == digits.count, (13...19).contains(d.count) else { return false }
        var sum = 0
        for (i, v) in d.reversed().enumerated() {
            var x = v
            if i % 2 == 1 { x *= 2; if x > 9 { x -= 9 } }
            sum += x
        }
        return sum % 10 == 0
    }
}

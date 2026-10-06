import SwiftUI

/// 8plus identity: International Klein Blue field, Pantone Orange accent, white text, serif headlines.
enum Theme {
    static let blue = Color(red: 0, green: 0.184, blue: 0.655)      // #002FA7
    static let orange = Color(red: 1, green: 0.314, blue: 0)        // #FE5000
    static let night = Color(red: 0.039, green: 0.055, blue: 0.102) // #0A0E1A
    static let glass = Color.white.opacity(0.08)
    static let hairline = Color.white.opacity(0.14)
    static let muted = Color.white.opacity(0.7)
    static func serif(_ size: CGFloat) -> Font { .system(size: size, weight: .semibold, design: .serif) }
    static let mono = Font.system(size: 11, weight: .regular, design: .monospaced)
}

/// The 8plus "%" mark: small circle, thick slash, large circle (orange).
struct LogoMark: View {
    var size: CGFloat = 28
    var body: some View {
        Canvas { ctx, sz in
            let s = sz.width / 100
            ctx.fill(Path(ellipseIn: CGRect(x: 14 * s, y: 11 * s, width: 36 * s, height: 36 * s)), with: .color(.white))
            var slash = Path()
            slash.move(to: CGPoint(x: 53 * s, y: 9 * s)); slash.addLine(to: CGPoint(x: 68 * s, y: 9 * s))
            slash.addLine(to: CGPoint(x: 36 * s, y: 91 * s)); slash.addLine(to: CGPoint(x: 21 * s, y: 91 * s)); slash.closeSubpath()
            ctx.fill(slash, with: .color(.white))
            ctx.fill(Path(ellipseIn: CGRect(x: 42 * s, y: 36 * s, width: 56 * s, height: 56 * s)), with: .color(Theme.orange))
        }
        .frame(width: size, height: size)
        .accessibilityLabel("PrivacyLens")
    }
}

struct GlassCard<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(16)
            .background(Theme.glass, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(Theme.hairline))
    }
}

struct PillButtonStyle: ButtonStyle {
    var filled = true
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .medium))
            .foregroundStyle(.white)
            .padding(.vertical, 13).frame(maxWidth: .infinity)
            .background(filled ? Theme.orange : .clear, in: Capsule())
            .overlay(Capsule().stroke(filled ? .clear : Color.white.opacity(0.4)))
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

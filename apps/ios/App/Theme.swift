import SwiftUI

/// Native look first: system backgrounds, SF Symbols, Dynamic Type. 8plus orange is only the tint/accent.
enum Theme {
    static let orange = Color(red: 1, green: 0.314, blue: 0) // #FE5000
    static let blue = Color(red: 0, green: 0.184, blue: 0.655) // #002FA7
}

/// PrivacyLens mark: scan frame, text lines, one line redacted by a slanted orange bar (slant echoes 8plus "%").
/// Ink adapts: Klein blue on light backgrounds, white on dark.
struct LogoMark: View {
    var size: CGFloat = 28
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        Canvas { ctx, sz in
            let s = sz.width / 100
            let ink = GraphicsContext.Shading.color(scheme == .dark ? .white : Theme.blue)
            var frame = Path()
            // four corner brackets
            frame.move(to: CGPoint(x: 14 * s, y: 34 * s)); frame.addLine(to: CGPoint(x: 14 * s, y: 14 * s)); frame.addLine(to: CGPoint(x: 34 * s, y: 14 * s))
            frame.move(to: CGPoint(x: 66 * s, y: 14 * s)); frame.addLine(to: CGPoint(x: 86 * s, y: 14 * s)); frame.addLine(to: CGPoint(x: 86 * s, y: 34 * s))
            frame.move(to: CGPoint(x: 86 * s, y: 66 * s)); frame.addLine(to: CGPoint(x: 86 * s, y: 86 * s)); frame.addLine(to: CGPoint(x: 66 * s, y: 86 * s))
            frame.move(to: CGPoint(x: 34 * s, y: 86 * s)); frame.addLine(to: CGPoint(x: 14 * s, y: 86 * s)); frame.addLine(to: CGPoint(x: 14 * s, y: 66 * s))
            ctx.stroke(frame, with: ink, style: StrokeStyle(lineWidth: 7 * s, lineCap: .square))
            ctx.fill(Path(roundedRect: CGRect(x: 28 * s, y: 30 * s, width: 44 * s, height: 7 * s), cornerRadius: 3.5 * s), with: ink)
            ctx.fill(Path(roundedRect: CGRect(x: 28 * s, y: 64 * s, width: 30 * s, height: 7 * s), cornerRadius: 3.5 * s), with: ink)
            var bar = Path()
            bar.move(to: CGPoint(x: 30 * s, y: 44 * s)); bar.addLine(to: CGPoint(x: 78 * s, y: 44 * s))
            bar.addLine(to: CGPoint(x: 74 * s, y: 57 * s)); bar.addLine(to: CGPoint(x: 26 * s, y: 57 * s)); bar.closeSubpath()
            ctx.fill(bar, with: .color(Theme.orange))
        }
        .frame(width: size, height: size)
        .accessibilityLabel("PrivacyLens")
    }
}

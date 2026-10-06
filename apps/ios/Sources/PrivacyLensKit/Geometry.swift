import CoreGraphics
import Foundation

public enum Geometry {
    /// Normalized bbox (top-left origin) → integer pixel rect (top-left origin), padded and clamped to the image.
    public static func pixelRect(_ b: BBox, width: Int, height: Int, pad: Int = 2) -> CGRect {
        let x0 = max(0, Int(floor(b.x * Double(width))) - pad)
        let y0 = max(0, Int(floor(b.y * Double(height))) - pad)
        let x1 = min(width, Int(ceil((b.x + b.w) * Double(width))) + pad)
        let y1 = min(height, Int(ceil((b.y + b.h) * Double(height))) + pad)
        return CGRect(x: x0, y: y0, width: max(0, x1 - x0), height: max(0, y1 - y0))
    }

    /// Rect from two normalized points (any drag direction), clamped to 0–1.
    public static func box(from a: CGPoint, to b: CGPoint) -> BBox {
        func cl(_ v: Double) -> Double { min(1, max(0, v)) }
        let x0 = cl(min(a.x, b.x)), y0 = cl(min(a.y, b.y))
        return BBox(x: x0, y: y0, w: cl(max(a.x, b.x)) - x0, h: cl(max(a.y, b.y)) - y0)
    }

    public static func contains(_ b: BBox, _ p: CGPoint) -> Bool {
        p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h
    }
}

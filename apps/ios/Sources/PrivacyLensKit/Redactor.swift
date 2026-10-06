import CoreGraphics
import CoreImage
import CoreImage.CIFilterBuiltins
import Foundation
import ImageIO
import UniformTypeIdentifiers

public enum RedactMode: String, CaseIterable, Sendable { case blackbox, blur, pixelate }

/// Core Image redaction. Always returns a NEW image; re-encoding drops EXIF/GPS (CGImage carries no metadata).
public enum Redactor {
    private static let context = CIContext(options: [.useSoftwareRenderer: false])

    public static func redact(_ image: CGImage, entities: [Entity], mode: RedactMode) -> CGImage? {
        let w = image.width, h = image.height
        let base = CIImage(cgImage: image)
        let filtered: CIImage
        switch mode {
        case .blackbox: filtered = CIImage(color: .black).cropped(to: base.extent)
        case .blur:
            let f = CIFilter.gaussianBlur()
            f.inputImage = base.clampedToExtent()
            f.radius = Float(max(12, min(w, h) / 60))
            filtered = f.outputImage!
        case .pixelate:
            let f = CIFilter.pixellate()
            f.inputImage = base
            f.scale = Float(max(10, min(w, h) / 50))
            filtered = f.outputImage!
        }
        var result = base
        for e in entities {
            guard let b = e.bbox else { continue }
            let r = Geometry.pixelRect(b, width: w, height: h)
            if r.width == 0 || r.height == 0 { continue }
            // Core Image uses a bottom-left origin.
            let ci = CGRect(x: r.minX, y: CGFloat(h) - r.maxY, width: r.width, height: r.height)
            result = filtered.cropped(to: ci).composited(over: result)
        }
        return context.createCGImage(result, from: base.extent)
    }

    public static func pngData(_ image: CGImage) -> Data? {
        let data = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, image, nil)
        return CGImageDestinationFinalize(dest) ? data as Data : nil
    }
}

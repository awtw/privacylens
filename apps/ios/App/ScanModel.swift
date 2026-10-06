import PhotosUI
import PrivacyLensKit
import SwiftUI

@MainActor
final class ScanModel: ObservableObject {
    enum Status: Equatable { case idle, scanning, done, failed(String) }

    @Published var status: Status = .idle
    @Published var original: CGImage?
    @Published var entities: [Entity] = []
    @Published var selected: Set<String> = []
    @Published var mode: RedactMode = .blackbox
    @Published var showPreview = false
    private var manualSeq = 0

    var summary: RiskSummary { Risk.summarize(entities) }
    var chosen: [Entity] { entities.filter { selected.contains($0.id) } }

    /// Redacted copy (always a new image; re-encoding drops EXIF/GPS).
    var redacted: UIImage? {
        guard let original, let out = Redactor.redact(original, entities: chosen, mode: mode) else { return nil }
        return UIImage(cgImage: out)
    }

    func load(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        status = .scanning
        showPreview = false
        do {
            guard let data = try await item.loadTransferable(type: Data.self), let ui = UIImage(data: data) else {
                status = .failed("無法讀取這張圖片")
                return
            }
            let cg = Self.upright(ui)
            original = cg
            entities = []
            selected = []
            // Vision is synchronous and CPU/ANE heavy: keep it off the main actor.
            let found = try await Task.detached(priority: .userInitiated) {
                Pipeline.detect(words: try VisionOCR.recognize(cg))
            }.value
            entities = found
            selected = Set(found.map(\.id))
            status = .done
        } catch {
            status = .failed(error.localizedDescription)
        }
    }

    /// Bakes EXIF orientation into pixels so Vision boxes and redaction share one coordinate space.
    private static func upright(_ ui: UIImage) -> CGImage {
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let img = UIGraphicsImageRenderer(size: ui.size, format: format).image { _ in ui.draw(at: .zero) }
        return img.cgImage!
    }

    func toggle(_ id: String) {
        if selected.contains(id) { selected.remove(id) } else { selected.insert(id) }
    }

    func addManual(_ box: BBox) {
        manualSeq += 1
        let e = Entity(id: "CUSTOM-\(manualSeq)", type: .CUSTOM, text: "手動框選", confidence: 1, bbox: box, source: .manual, riskLevel: Risk.of(.CUSTOM))
        entities.append(e)
        selected.insert(e.id)
    }

    func remove(_ id: String) {
        entities.removeAll { $0.id == id }
        selected.remove(id)
    }

    func saveToPhotos() {
        guard let img = redacted else { return }
        UIImageWriteToSavedPhotosAlbum(img, nil, nil, nil)
    }
}

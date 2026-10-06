import PhotosUI
import PrivacyLensKit
import SwiftUI

private let typeLabel: [EntityType: String] = [
    .EMAIL: "Email", .PHONE: "電話", .TW_NATIONAL_ID: "身分證", .CREDIT_CARD: "信用卡", .BANK_ACCOUNT: "銀行帳號",
    .URL: "網址", .IP_ADDRESS: "IP", .ID_NUMBER: "編號", .USERNAME: "帳號名", .PERSON: "姓名", .ADDRESS: "地址",
    .ORGANIZATION: "組織", .LOCATION: "地點", .CUSTOM: "手動",
]

struct ContentView: View {
    @StateObject private var model = ScanModel()
    @State private var pickerItem: PhotosPickerItem?
    @State private var drawMode = false
    @State private var draft: BBox?

    var body: some View {
        NavigationStack {
            Group {
                if model.original == nil { emptyState } else { resultList }
            }
            .navigationTitle("PrivacyLens")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    PhotosPicker(selection: $pickerItem, matching: .images) { Image(systemName: "photo.badge.plus") }
                        .disabled(model.status == .scanning)
                        .accessibilityLabel("選擇圖片")
                }
            }
        }
        .onChange(of: pickerItem) { item in Task { await model.load(item) } }
    }

    // MARK: empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            LogoMark(size: 56)
            Text("分享截圖前，先遮住個資").font(.title2.bold()).multilineTextAlignment(.center)
            Text("自動找出 Email、電話、身分證、信用卡、地址等資訊並一鍵遮罩。影像與辨識結果都不會離開你的 iPhone。")
                .font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center).padding(.horizontal, 32)
            PhotosPicker(selection: $pickerItem, matching: .images) {
                Label("選擇截圖或照片", systemImage: "photo.on.rectangle")
            }
            .buttonStyle(.borderedProminent).controlSize(.large).padding(.top, 8)
            if case .failed(let msg) = model.status { Text(msg).font(.footnote).foregroundStyle(.red) }
            Spacer()
            Label("無上傳 · 無 AI API · 本機處理", systemImage: "lock.fill").font(.caption).foregroundStyle(.secondary).padding(.bottom, 12)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: result

    private var resultList: some View {
        List {
            Section {
                imageStage
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                Picker("檢視", selection: $model.showPreview) {
                    Text("偵測標記").tag(false)
                    Text("遮罩預覽").tag(true)
                }
                .pickerStyle(.segmented)
                if !model.showPreview {
                    Toggle(isOn: $drawMode) { Label("框選模式", systemImage: "rectangle.dashed") }
                }
            } footer: {
                Text(model.showPreview ? "預覽遮罩後的結果。" : drawMode ? "在圖上拖曳以新增遮罩框；完成後關閉框選模式即可捲動頁面。" : "點一下圖上的框可切換是否遮罩。")
            }

            Section("風險") { riskRow }

            Section("偵測結果（\(model.entities.count)）") {
                if model.status == .done && model.entities.isEmpty {
                    Text("沒有自動偵測到個資。若畫面中確有個資，請開啟「框選模式」手動加入遮罩。").font(.footnote).foregroundStyle(.secondary)
                }
                ForEach(model.entities) { e in
                    Toggle(isOn: Binding(get: { model.selected.contains(e.id) }, set: { _ in model.toggle(e.id) })) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(e.text).font(.body).lineLimit(1)
                            Text(typeLabel[e.type] ?? e.type.rawValue).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .swipeActions { if e.source == .manual { Button(role: .destructive) { model.remove(e.id) } label: { Label("刪除", systemImage: "trash") } } }
                }
            }

            Section {
                Picker("樣式", selection: $model.mode) {
                    Text("黑框").tag(RedactMode.blackbox); Text("模糊").tag(RedactMode.blur); Text("馬賽克").tag(RedactMode.pixelate)
                }
                .pickerStyle(.segmented)
                if let img = model.redacted, !model.chosen.isEmpty {
                    ShareLink(item: Image(uiImage: img), preview: SharePreview("已遮罩圖片", image: Image(uiImage: img))) {
                        Label("分享遮罩後的圖片（\(model.chosen.count) 項）", systemImage: "square.and.arrow.up")
                    }
                    Button { model.saveToPhotos() } label: { Label("儲存到相簿", systemImage: "square.and.arrow.down") }
                }
            } header: { Text("遮罩") } footer: {
                Text("輸出為新圖片，不會覆蓋原圖；重新編碼會移除 EXIF / GPS。")
            }
        }
    }

    private var riskRow: some View {
        let level = model.summary.level
        let names: [RiskLevel?: String] = [nil: "未發現", .low: "低風險", .medium: "中風險", .high: "高風險", .critical: "極高風險"]
        let tint: Color = switch level { case nil: .green; case .low?: .blue; case .medium?: .yellow; case .high?: .orange; case .critical?: .red }
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(model.status == .scanning ? "掃描中…" : names[level] ?? "", systemImage: level == nil ? "checkmark.shield" : "exclamationmark.shield")
                    .font(.headline).foregroundStyle(tint)
                Spacer()
                Text("\(model.summary.score)").font(.title3.monospacedDigit().bold()).foregroundStyle(tint)
            }
            ProgressView(value: Double(model.summary.score), total: 100).tint(tint)
        }
        .padding(.vertical, 4)
    }

    // MARK: image + overlay

    @ViewBuilder private var imageStage: some View {
        if let cg = model.original {
            let size = CGSize(width: cg.width, height: cg.height)
            ZStack {
                if model.showPreview, let img = model.redacted { Image(uiImage: img).resizable() } else { Image(decorative: cg, scale: 1).resizable() }
            }
            .aspectRatio(size, contentMode: .fit)
            .overlay { if !model.showPreview { boxes } }
            .overlay { if model.status == .scanning { ProgressView("掃描中…").padding().background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12)) } }
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .padding(.vertical, 4)
        }
    }

    /// Overlay in the image's own space. The drag gesture only exists in draw mode, so it never blocks scrolling.
    private var boxes: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                ForEach(model.entities) { e in
                    if let b = e.bbox { boxView(b, on: model.selected.contains(e.id), in: geo.size) }
                }
                if let d = draft { boxView(d, on: true, in: geo.size, dashed: true) }
                if drawMode {
                    Color.clear.contentShape(Rectangle())
                        .gesture(DragGesture(minimumDistance: 4)
                            .onChanged { v in draft = Geometry.box(from: norm(v.startLocation, geo.size), to: norm(v.location, geo.size)) }
                            .onEnded { v in
                                draft = nil
                                let box = Geometry.box(from: norm(v.startLocation, geo.size), to: norm(v.location, geo.size))
                                if box.w * geo.size.width >= 8 || box.h * geo.size.height >= 8 { model.addManual(box) }
                            })
                } else {
                    Color.clear.contentShape(Rectangle())
                        .onTapGesture { p in
                            let q = norm(p, geo.size)
                            if let hit = model.entities.last(where: { $0.bbox.map { Geometry.contains($0, q) } ?? false }) { model.toggle(hit.id) }
                        }
                }
            }
        }
    }

    private func norm(_ p: CGPoint, _ s: CGSize) -> CGPoint { CGPoint(x: p.x / s.width, y: p.y / s.height) }

    private func boxView(_ b: BBox, on: Bool, in s: CGSize, dashed: Bool = false) -> some View {
        Rectangle()
            .fill(on ? Theme.orange.opacity(0.28) : Color.white.opacity(0.1))
            .overlay(Rectangle().stroke(on ? Theme.orange : Color.white.opacity(0.6), style: StrokeStyle(lineWidth: 2, dash: dashed ? [6, 4] : [])))
            .frame(width: b.w * s.width, height: b.h * s.height)
            .offset(x: b.x * s.width, y: b.y * s.height)
            .allowsHitTesting(false)
    }
}

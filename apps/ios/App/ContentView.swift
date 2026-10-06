import PhotosUI
import PrivacyLensKit
import SwiftUI

private let typeLabel: [EntityType: String] = [
    .EMAIL: "Email", .PHONE: "電話", .TW_NATIONAL_ID: "身分證", .CREDIT_CARD: "信用卡", .BANK_ACCOUNT: "銀行帳號",
    .URL: "網址", .IP_ADDRESS: "IP", .ID_NUMBER: "編號", .USERNAME: "帳號名", .PERSON: "姓名", .ADDRESS: "地址",
    .ORGANIZATION: "組織", .LOCATION: "地點", .CUSTOM: "手動",
]
private let levelLabel: [RiskLevel?: String] = [nil: "未發現", .low: "低風險", .medium: "中風險", .high: "高風險", .critical: "極高風險"]

struct ContentView: View {
    @StateObject private var model = ScanModel()
    @State private var pickerItem: PhotosPickerItem?
    @State private var dragStart: CGPoint?
    @State private var draft: BBox?

    var body: some View {
        ZStack {
            Theme.blue.ignoresSafeArea()
            RadialGradient(colors: [Theme.orange.opacity(0.22), .clear], center: .topTrailing, startRadius: 0, endRadius: 420).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    if model.original == nil { hero } else { workspace }
                    picker
                    if case .failed(let msg) = model.status { Text("錯誤：\(msg)").foregroundStyle(Theme.orange).font(.footnote) }
                    footer
                }
                .padding(20)
            }
        }
        .onChange(of: pickerItem) { item in Task { await model.load(item) } }
    }

    // MARK: sections

    private var header: some View {
        HStack(spacing: 10) {
            LogoMark(size: 30)
            Text("PrivacyLens").font(.system(size: 18, weight: .medium))
            Text("by 8plus").font(Theme.mono).foregroundStyle(Theme.muted)
                .padding(.horizontal, 8).padding(.vertical, 2).overlay(Capsule().stroke(Theme.hairline))
            Spacer()
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("01 · SCAN").font(Theme.mono).foregroundStyle(Theme.orange)
            Text("分享截圖前，\n先遮住個資。").font(Theme.serif(40)).lineSpacing(2)
            Text("自動找出 Email、電話、身分證、信用卡、地址等資訊並一鍵遮罩。影像與辨識結果都不會離開你的 iPhone。")
                .foregroundStyle(Theme.muted).font(.system(size: 15, weight: .light))
        }
        .padding(.top, 36)
    }

    private var picker: some View {
        let hasImage = model.original != nil
        return PhotosPicker(selection: $pickerItem, matching: .images) {
            Text(hasImage ? "更換圖片" : "選擇截圖或照片")
        }
        .buttonStyle(PillButtonStyle(filled: !hasImage))
        .disabled(model.status == .scanning)
    }

    private var workspace: some View {
        VStack(spacing: 14) {
            GlassCard {
                VStack(spacing: 10) {
                    Picker("", selection: $model.showPreview) {
                        Text("偵測標記").tag(false)
                        Text("遮罩預覽").tag(true)
                    }.pickerStyle(.segmented)
                    imageStage
                    Text(model.showPreview ? "預覽結果" : "拖曳畫框新增遮罩 · 點擊框切換選取")
                        .font(Theme.mono).foregroundStyle(Theme.muted)
                }
            }
            GlassCard { riskPanel }
        }
    }

    @ViewBuilder private var imageStage: some View {
        if let cg = model.original {
            let size = CGSize(width: cg.width, height: cg.height)
            ZStack {
                if model.showPreview, let img = model.redacted {
                    Image(uiImage: img).resizable()
                } else {
                    Image(decorative: cg, scale: 1).resizable()
                }
            }
            .aspectRatio(size, contentMode: .fit)
            .overlay { if !model.showPreview { boxes } }
            .overlay { if model.status == .scanning { ProgressView("掃描中…").tint(.white).padding().background(.black.opacity(0.5), in: RoundedRectangle(cornerRadius: 12)) } }
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    /// Overlay in the image's own coordinate space (container == displayed image bounds).
    private var boxes: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                ForEach(model.entities) { e in
                    if let b = e.bbox { boxView(b, on: model.selected.contains(e.id), in: geo.size) }
                }
                if let d = draft { boxView(d, on: true, in: geo.size, dashed: true) }
                Color.clear.contentShape(Rectangle())
                    .gesture(DragGesture(minimumDistance: 0)
                        .onChanged { v in
                            let a = norm(v.startLocation, geo.size), b = norm(v.location, geo.size)
                            dragStart = a
                            draft = Geometry.box(from: a, to: b)
                        }
                        .onEnded { v in
                            let a = norm(v.startLocation, geo.size), b = norm(v.location, geo.size)
                            draft = nil
                            let box = Geometry.box(from: a, to: b)
                            if box.w * geo.size.width < 8 && box.h * geo.size.height < 8 {
                                if let hit = model.entities.last(where: { $0.bbox.map { Geometry.contains($0, b) } ?? false }) { model.toggle(hit.id) }
                            } else {
                                model.addManual(box)
                            }
                        })
            }
        }
    }

    private func norm(_ p: CGPoint, _ s: CGSize) -> CGPoint { CGPoint(x: p.x / s.width, y: p.y / s.height) }

    private func boxView(_ b: BBox, on: Bool, in s: CGSize, dashed: Bool = false) -> some View {
        Rectangle()
            .fill((on ? Theme.orange : Color.white).opacity(on ? 0.25 : 0.08))
            .overlay(Rectangle().stroke(on ? Theme.orange : Color.white.opacity(0.5), style: StrokeStyle(lineWidth: 2, dash: dashed ? [6, 4] : [])))
            .frame(width: b.w * s.width, height: b.h * s.height)
            .offset(x: b.x * s.width, y: b.y * s.height)
            .allowsHitTesting(false)
    }

    private var riskPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("RISK LEVEL").font(Theme.mono).foregroundStyle(Theme.orange)
            Text(model.status == .scanning ? "掃描中…" : levelLabel[model.summary.level] ?? "").font(Theme.serif(28))
            HStack(spacing: 4) {
                ForEach(Array(RiskLevel.allCases.enumerated()), id: \.offset) { i, l in
                    Capsule().fill((model.summary.level.map { l <= $0 } ?? false) ? Theme.orange : Theme.hairline).frame(height: 4)
                }
            }
            Text("共偵測到 \(model.entities.count) 項").font(.footnote).foregroundStyle(Theme.muted)

            if model.status == .done && model.entities.isEmpty {
                Text("沒有自動偵測到個資。若畫面中確有個資，請在圖上拖曳畫框，手動加入遮罩。").font(.footnote).foregroundStyle(Theme.muted)
            }
            ForEach(model.entities) { e in
                HStack(spacing: 10) {
                    Toggle("", isOn: Binding(get: { model.selected.contains(e.id) }, set: { _ in model.toggle(e.id) }))
                        .labelsHidden().tint(Theme.orange).scaleEffect(0.8)
                    Text(typeLabel[e.type] ?? e.type.rawValue).font(Theme.mono).foregroundStyle(Theme.muted).frame(width: 52, alignment: .leading)
                    Text(e.text).font(.system(size: 13, design: .monospaced)).lineLimit(1)
                    Spacer()
                    if e.source == .manual { Button { model.remove(e.id) } label: { Image(systemName: "xmark") }.foregroundStyle(Theme.muted) }
                }
                Divider().overlay(Theme.hairline)
            }

            Picker("遮罩樣式", selection: $model.mode) {
                Text("黑框").tag(RedactMode.blackbox); Text("模糊").tag(RedactMode.blur); Text("馬賽克").tag(RedactMode.pixelate)
            }.pickerStyle(.segmented)

            if let img = model.redacted, !model.chosen.isEmpty {
                ShareLink(item: Image(uiImage: img), preview: SharePreview("已遮罩圖片", image: Image(uiImage: img))) {
                    Text("分享遮罩後的圖片（\(model.chosen.count) 項）")
                }.buttonStyle(PillButtonStyle())
                Button("儲存到相簿") { model.saveToPhotos() }.buttonStyle(PillButtonStyle(filled: false))
            }
            Text("輸出為新圖片，不會覆蓋原圖；重新編碼會移除 EXIF / GPS。").font(.caption).foregroundStyle(Theme.muted)
        }
    }

    private var footer: some View {
        Text("NO UPLOADS · NO AI API · LOCAL PROCESSING").font(Theme.mono).foregroundStyle(Theme.muted).padding(.top, 20)
    }
}

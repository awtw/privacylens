// swift-tools-version: 5.9
import PackageDescription

// PrivacyLensKit = platform-neutral core (rules, risk, pipeline) + Vision OCR + Core Image redaction.
// Mirrors packages/privacy-spec (TypeScript); both are verified against the same fixtures/cases.json.
// `kit-check` is a framework-free verifier (`swift run kit-check`) that works with bare Command Line Tools.
let package = Package(
    name: "PrivacyLensKit",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [.library(name: "PrivacyLensKit", targets: ["PrivacyLensKit"])],
    targets: [
        .target(name: "PrivacyLensKit"),
        .executableTarget(name: "kit-check", dependencies: ["PrivacyLensKit"], resources: [.copy("Fixtures")]),
    ]
)

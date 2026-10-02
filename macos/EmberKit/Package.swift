// swift-tools-version: 6.2
import PackageDescription

let package = Package(
  name: "EmberKit",
  platforms: [.macOS(.v26)],
  products: [.library(name: "EmberKit", targets: ["EmberKit"])],
  targets: [
    .target(name: "EmberKit"),
    .testTarget(name: "EmberKitTests", dependencies: ["EmberKit"]),
  ]
)

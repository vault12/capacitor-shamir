// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorShamir",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "CapacitorShamir",
            targets: ["ShamirPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "7.0.0")
    ],
    targets: [
        .target(
            name: "ShamirPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/ShamirPlugin"),
        .testTarget(
            name: "ShamirPluginTests",
            dependencies: ["ShamirPlugin"],
            path: "ios/Tests/ShamirPluginTests")
    ]
)
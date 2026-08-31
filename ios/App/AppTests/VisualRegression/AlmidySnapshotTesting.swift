import XCTest
import UIKit

@MainActor
enum AlmidySnapshotTesting {
    static let canonicalPhoneSize = CGSize(width: 393, height: 852)
    static let canonicalScale: CGFloat = 3
    static let recordingEnvironmentKey = "ALMIDY_RECORD_SNAPSHOTS"

    static var isRecording: Bool {
        ProcessInfo.processInfo.environment[recordingEnvironmentKey] == "1"
    }

    static var baselineRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("DesignBaselines/Snapshots", isDirectory: true)
    }

    static func render(
        _ view: UIView,
        size: CGSize,
        contentSizeCategory: UIContentSizeCategory = .large,
        appearance: UIUserInterfaceStyle = .light
    ) -> UIImage {
        let child = UIViewController()
        child.view = view
        let host = UIViewController()
        host.loadViewIfNeeded()
        host.overrideUserInterfaceStyle = appearance
        host.view.frame = CGRect(origin: .zero, size: size)
        host.view.backgroundColor = .systemBackground
        var window: UIWindow?
        if appearance == .dark {
            let darkWindow = UIWindow(frame: host.view.frame)
            darkWindow.overrideUserInterfaceStyle = .dark
            darkWindow.rootViewController = host
            darkWindow.isHidden = false
            window = darkWindow
        }
        host.addChild(child)
        host.setOverrideTraitCollection(
            UITraitCollection(traitsFrom: [
                UITraitCollection(userInterfaceStyle: appearance),
                UITraitCollection(preferredContentSizeCategory: contentSizeCategory),
                UITraitCollection(displayScale: canonicalScale)
            ]),
            forChild: child
        )
        child.view.frame = host.view.bounds
        child.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        host.view.addSubview(child.view)
        child.didMove(toParent: host)
        if appearance == .dark {
            child.view.traitCollectionDidChange(UITraitCollection(userInterfaceStyle: .light))
        }
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        child.view.layoutIfNeeded()
        _ = window
        return renderLayer(host.view, size: size)
    }

    static func renderLayer(_ view: UIView, size: CGSize) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = canonicalScale
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.systemBackground.resolvedColor(with: view.traitCollection).setFill()
            context.fill(CGRect(origin: .zero, size: size))
            view.layer.render(in: context.cgContext)
        }
    }

    static func assertSnapshot(
        _ image: UIImage,
        named name: String,
        feature: String,
        appearance: UIUserInterfaceStyle = .light,
        file: StaticString = #filePath,
        line: UInt = #line,
        testCase: XCTestCase
    ) throws {
        precondition(name.range(of: "^[a-z0-9][a-z0-9-]*$", options: .regularExpression) != nil)
        precondition(feature.range(of: "^[A-Za-z][A-Za-z0-9]*$", options: .regularExpression) != nil)
        let appearanceRoot = appearance == .dark
            ? baselineRoot.appendingPathComponent("Dark", isDirectory: true)
            : baselineRoot
        let directory = appearanceRoot.appendingPathComponent(feature, isDirectory: true)
        let baseline = directory.appendingPathComponent("\(name).png")
        let data = try XCTUnwrap(image.pngData(), "Could not encode rendered snapshot", file: file, line: line)

        if isRecording {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try data.write(to: baseline, options: .atomic)
            let attachment = XCTAttachment(image: image)
            attachment.name = "Recorded-\(feature)-\(name)"
            attachment.lifetime = .keepAlways
            testCase.add(attachment)
            return
        }

        guard FileManager.default.fileExists(atPath: baseline.path) else {
            XCTFail(
                "Missing baseline \(baseline.path). Record explicitly with \(recordingEnvironmentKey)=1.",
                file: file,
                line: line
            )
            return
        }
        let expected = try XCTUnwrap(UIImage(contentsOfFile: baseline.path), file: file, line: line)
        let comparison = try compare(expected: expected, actual: image)
        guard comparison.mismatchedPixels == 0 else {
            for (label, artifact) in [
                ("Expected", expected),
                ("Actual", image),
                ("Difference", comparison.difference)
            ] {
                let attachment = XCTAttachment(image: artifact)
                attachment.name = "\(label)-\(feature)-\(name)"
                attachment.lifetime = .keepAlways
                testCase.add(attachment)
            }
            XCTFail(
                "Snapshot \(feature)/\(name) differs at \(comparison.mismatchedPixels) pixels; "
                    + "maximum channel delta \(comparison.maximumChannelDelta).",
                file: file,
                line: line
            )
            return
        }
    }

    static func validateBaselines() throws -> [URL] {
        let files = try FileManager.default.subpathsOfDirectory(atPath: baselineRoot.path)
            .filter { $0.hasSuffix(".png") }
            .map { baselineRoot.appendingPathComponent($0) }
            .sorted { $0.path < $1.path }
        for file in files {
            guard let image = UIImage(contentsOfFile: file.path), image.cgImage != nil else {
                throw SnapshotError.invalidBaseline(file.path)
            }
        }
        return files
    }

    struct Comparison {
        let mismatchedPixels: Int
        let maximumChannelDelta: UInt8
        let difference: UIImage
    }

    static func compare(expected: UIImage, actual: UIImage) throws -> Comparison {
        guard let expectedCG = expected.cgImage, let actualCG = actual.cgImage else {
            throw SnapshotError.missingCGImage
        }
        guard expectedCG.width == actualCG.width, expectedCG.height == actualCG.height else {
            throw SnapshotError.dimensionMismatch(
                expected: CGSize(width: expectedCG.width, height: expectedCG.height),
                actual: CGSize(width: actualCG.width, height: actualCG.height)
            )
        }
        let width = expectedCG.width
        let height = expectedCG.height
        let expectedBytes = try rgbaBytes(expectedCG)
        let actualBytes = try rgbaBytes(actualCG)
        var differenceBytes = [UInt8](repeating: 0, count: expectedBytes.count)
        var mismatchedPixels = 0
        var maximumDelta: UInt8 = 0
        for pixel in 0..<(width * height) {
            let offset = pixel * 4
            var differs = false
            for channel in 0..<4 {
                let delta = UInt8(abs(Int(expectedBytes[offset + channel]) - Int(actualBytes[offset + channel])))
                maximumDelta = max(maximumDelta, delta)
                differs = differs || delta > 0
            }
            if differs {
                mismatchedPixels += 1
                differenceBytes[offset] = 255
                differenceBytes[offset + 1] = 0
                differenceBytes[offset + 2] = 255
                differenceBytes[offset + 3] = 255
            } else {
                let gray = UInt8(
                    (Int(expectedBytes[offset]) + Int(expectedBytes[offset + 1]) + Int(expectedBytes[offset + 2])) / 9
                )
                differenceBytes[offset] = gray
                differenceBytes[offset + 1] = gray
                differenceBytes[offset + 2] = gray
                differenceBytes[offset + 3] = 255
            }
        }
        return Comparison(
            mismatchedPixels: mismatchedPixels,
            maximumChannelDelta: maximumDelta,
            difference: try image(bytes: differenceBytes, width: width, height: height, scale: expected.scale)
        )
    }

    private static func rgbaBytes(_ image: CGImage) throws -> [UInt8] {
        let count = image.width * image.height * 4
        var bytes = [UInt8](repeating: 0, count: count)
        guard let context = CGContext(
            data: &bytes,
            width: image.width,
            height: image.height,
            bitsPerComponent: 8,
            bytesPerRow: image.width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { throw SnapshotError.contextCreation }
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        return bytes
    }

    private static func image(bytes: [UInt8], width: Int, height: Int, scale: CGFloat) throws -> UIImage {
        guard let provider = CGDataProvider(data: Data(bytes) as CFData),
              let cgImage = CGImage(
                width: width,
                height: height,
                bitsPerComponent: 8,
                bitsPerPixel: 32,
                bytesPerRow: width * 4,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                provider: provider,
                decode: nil,
                shouldInterpolate: false,
                intent: .defaultIntent
              ) else { throw SnapshotError.imageCreation }
        return UIImage(cgImage: cgImage, scale: scale, orientation: .up)
    }

    enum SnapshotError: Error, Equatable {
        case missingCGImage
        case contextCreation
        case imageCreation
        case invalidBaseline(String)
        case dimensionMismatch(expected: CGSize, actual: CGSize)
    }
}

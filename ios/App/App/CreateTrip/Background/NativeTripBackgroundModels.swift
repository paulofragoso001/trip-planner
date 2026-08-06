import UIKit
import os

func nativeImageryDebug(_ message: @autoclosure () -> String) {
#if DEBUG
    Logger(subsystem: "app.almidy", category: "destination-imagery")
        .debug("\(message(), privacy: .public)")
#endif
}

enum NativeTripBackgroundSelectionMode: Equatable {
    case automaticGeneric
    case automaticDestination
    case manual
}

struct NativeTripTravelImageSelection {
    let identifier: String?
    let image: UIImage?
    let isUsingGlobeFallback: Bool
}

struct NativeTripBackgroundState: Equatable {
    let genericImageIdentifier: String?
    var isUsingGlobeFallback: Bool
    var selectionMode: NativeTripBackgroundSelectionMode
}

struct NativeTripBackgroundOption {
    let attribution: String?
    let title: String
    let image: UIImage

    init(title: String, image: UIImage, attribution: String? = nil) {
        self.attribution = attribution
        self.title = title
        self.image = image
    }
}

struct NativeRankedBackgroundSlots {
    private(set) var values: [NativeTripBackgroundOption?]

    init(count: Int) {
        values = Array(repeating: nil, count: max(count, 0))
    }

    mutating func insert(_ option: NativeTripBackgroundOption, at rankedIndex: Int) {
        guard values.indices.contains(rankedIndex) else { return }
        values[rankedIndex] = option
    }

    var loadedOptionsInServerOrder: [NativeTripBackgroundOption] {
        values.compactMap { $0 }
    }
}

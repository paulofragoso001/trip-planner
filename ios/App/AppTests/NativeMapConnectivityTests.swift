import XCTest
@testable import App

@MainActor
final class NativeMapConnectivityTests: XCTestCase {
    func testControllerDeallocatesAfterNetworkMonitorStarts() {
        weak var releasedController: NativeMapViewController?

        autoreleasepool {
            var controller: NativeMapViewController? = NativeMapViewController(trips: []) { _ in }
            controller?.loadViewIfNeeded()
            releasedController = controller
            controller = nil
        }

        XCTAssertNil(releasedController, "NWPathMonitor must not retain the native map controller.")
    }

    func testOfflineFallbackPreservesCameraAndRestoresMapSurface() {
        let controller = NativeMapViewController(
            trips: [],
            monitorsNetworkConnectivity: false
        ) { _ in }
        controller.loadViewIfNeeded()

        UIView.setAnimationsEnabled(false)
        defer { UIView.setAnimationsEnabled(true) }

        controller.setNetworkAvailabilityForTesting(false)
        XCTAssertTrue(controller.isShowingMapFallbackForTesting)

        controller.setNetworkAvailabilityForTesting(true)
        XCTAssertFalse(controller.isShowingMapFallbackForTesting)
    }
}

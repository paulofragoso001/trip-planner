import XCTest
@testable import Almidy

@MainActor
final class NativePlaceCardPresentationTests: XCTestCase {
    func testSheetConfigurationPreservesPlaceDetailsPresentation() {
        let configuration = NativeActivityPlaceDetailsViewController.sheetConfiguration

        if case .prominent = configuration.role {} else {
            XCTFail("Place Details must use the prominent sheet role")
        }
        XCTAssertEqual(configuration.preferredCornerRadius, 38)
        XCTAssertTrue(configuration.prefersGrabberVisible)
        XCTAssertTrue(configuration.prefersScrollingExpandsWhenScrolledToEdge)
        XCTAssertEqual(configuration.largestUndimmedDetentIdentifier, .large)
        XCTAssertEqual(NativeActivityPlaceDetailsViewController.headerHeight, 62)
        XCTAssertEqual(NativeActivityPlaceDetailsViewController.headerControlSize, 44)
        XCTAssertEqual(NativeActivityPlaceDetailsViewController.cardCornerRadius, 22)
        XCTAssertEqual(NativeActivityPlaceDetailsViewController.bottomBarHeight, 56)
    }

    func testTravelModesPreserveGeometryOrderAndSelectedTraits() {
        let view = NativePlaceTravelModesView(
            durations: ["5m", "3m", "4m", "6m"],
            selectedIndex: 1,
            onSelect: { _ in }
        )

        XCTAssertEqual(NativePlaceTravelModesView.height, 44)
        XCTAssertEqual(NativePlaceTravelModesView.cornerRadius, 22)
        XCTAssertEqual(NativePlaceTravelModesView.selectedCornerRadius, 18)
        XCTAssertEqual(view.buttons.map(\.tag), [0, 1, 2, 3])
        XCTAssertFalse(view.buttons[0].accessibilityTraits.contains(.selected))
        XCTAssertTrue(view.buttons[1].accessibilityTraits.contains(.selected))
        XCTAssertEqual(view.accessibilityElements as? [UIButton], view.buttons)
    }

    func testTravelModeCallbackAndSelectionUpdateRemainIndependent() {
        var selected: [Int] = []
        let view = NativePlaceTravelModesView(
            durations: ["5m", "3m", "4m", "6m"],
            selectedIndex: 0,
            onSelect: { selected.append($0) }
        )

        view.buttons[2].sendActions(for: .touchUpInside)
        XCTAssertEqual(selected, [2])

        view.update(durations: ["6m", "4m", "5m", "7m"], selectedIndex: 2)
        XCTAssertTrue(view.buttons[2].accessibilityTraits.contains(.selected))
        XCTAssertFalse(view.buttons[0].accessibilityTraits.contains(.selected))
        XCTAssertEqual(view.buttons[2].accessibilityLabel, "5m travel time")
    }

    func testPlaceActionUsesSameTouchAndVoiceOverCallback() {
        var actions = 0
        let view = NativePlaceAccessibleActionView(
            child: UILabel(),
            insets: .zero,
            onActivate: { actions += 1 }
        )

        XCTAssertTrue(view.accessibilityTraits.contains(.link))
        XCTAssertTrue(view.accessibilityActivate())
        XCTAssertEqual(actions, 1)
    }
}

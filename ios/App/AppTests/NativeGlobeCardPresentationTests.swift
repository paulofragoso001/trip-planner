import XCTest
import UIKit
@testable import Almidy

@MainActor
final class NativeGlobeCardPresentationTests: XCTestCase {
    func testTripCardPreservesMeasuredGeometryAndGradient() {
        let card = NativeGlobeTripCardView(
            identifier: "trip-1",
            title: "Lisbon",
            dates: "Sep 4 → Sep 10",
            status: "Starts in 8 days",
            height: NativeTripCardLayout.futureHeight
        )

        XCTAssertEqual(NativeGlobeTripCardView.cornerRadius, 36)
        XCTAssertEqual(NativeGlobeTripCardView.horizontalTextInset, 24)
        XCTAssertEqual(NativeGlobeTripCardView.bottomTextInset, 42)
        XCTAssertEqual(card.overlayGradient.locations, [0.40, 1.0])
        XCTAssertEqual(card.constraints.first(where: { $0.firstAttribute == .height })?.constant, 224)
    }

    func testTripCardCombinesMetadataIntoOneAccessibleButton() {
        let card = NativeGlobeTripCardView(
            identifier: "trip-1",
            title: "Lisbon",
            dates: "Sep 4 → Sep 10",
            status: "Planning",
            height: 224
        )

        XCTAssertEqual(card.accessibilityIdentifier, "trip-1")
        XCTAssertEqual(card.accessibilityLabel, "Lisbon, Sep 4 → Sep 10, Planning")
        XCTAssertTrue(card.accessibilityTraits.contains(.button))
        XCTAssertFalse(card.mediaView.isAccessibilityElement)
    }

    func testTripCardTouchAndVoiceOverShareActivationPath() {
        let card = NativeGlobeTripCardView(identifier: "1", title: "Trip", dates: "Dates", status: "Planning", height: 224)
        let target = ActionTarget()
        card.addTarget(target, action: #selector(ActionTarget.activateCard), for: .touchUpInside)

        card.sendActions(for: .touchUpInside)
        XCTAssertEqual(target.count, 1)
        XCTAssertTrue(card.accessibilityActivate())
        XCTAssertEqual(target.count, 2)
    }

    func testReservationCardKeepsActionsIndependentAndAccessible() {
        var opens = 0
        var dismissals = 0
        let card = NativeGlobeReservationAutomationView(
            onOpen: { opens += 1 },
            onDismiss: { dismissals += 1 }
        )
        let buttons = card.accessibilityElements?.compactMap { $0 as? UIButton } ?? []
        let open = buttons.first { $0.currentTitle == "Open Reservation Importer" }
        let dismiss = buttons.first { $0.accessibilityLabel == "Dismiss reservation suggestion" }

        XCTAssertFalse(card.isAccessibilityElement)
        XCTAssertNotNil(open)
        XCTAssertNotNil(dismiss)
        open?.sendActions(for: .touchUpInside)
        dismiss?.sendActions(for: .touchUpInside)
        XCTAssertEqual(opens, 1)
        XCTAssertEqual(dismissals, 1)
    }

    private final class ActionTarget: NSObject {
        var count = 0
        @objc func activateCard() { count += 1 }
    }
}

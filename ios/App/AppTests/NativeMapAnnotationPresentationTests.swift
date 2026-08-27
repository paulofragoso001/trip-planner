import XCTest
@testable import Almidy

@MainActor
final class NativeMapAnnotationPresentationTests: XCTestCase {
    func testActivityBadgeSurfacePreservesRenderingContract() {
        let badge = UIView()
        NativeMapAnnotationPresentation.applyActivityBadgeSurface(to: badge)

        XCTAssertEqual(NativeMapAnnotationPresentation.activityBadgeSize, 40)
        XCTAssertEqual(NativeMapAnnotationPresentation.activityGlyphSize, 20)
        XCTAssertEqual(NativeMapAnnotationPresentation.activityLabelWidth, 132)
        XCTAssertEqual(badge.layer.cornerRadius, 20)
        XCTAssertEqual(badge.layer.borderWidth, 2)
        XCTAssertEqual(badge.layer.shadowOpacity, 0.20)
        XCTAssertEqual(badge.layer.shadowRadius, 3)
        XCTAssertEqual(badge.layer.shadowOffset, CGSize(width: 0, height: 1.5))
    }

    func testSelectedAndUnselectedStateResetEveryVisualProperty() {
        let selected = NativeActivityAnnotationSelectionPresentation(
            selected: true,
            keepsTitleVisible: false,
            badgeSize: 40
        )
        let reused = NativeActivityAnnotationSelectionPresentation(
            selected: false,
            keepsTitleVisible: false,
            badgeSize: 40
        )

        XCTAssertFalse(selected.titleHidden)
        XCTAssertFalse(selected.tailHidden)
        XCTAssertEqual(selected.centerOffset, CGPoint(x: 0, y: -54))
        XCTAssertEqual(selected.badgeScale, 1.72)
        XCTAssertTrue(selected.accessibilityTraits.contains(.selected))
        XCTAssertTrue(reused.titleHidden)
        XCTAssertTrue(reused.tailHidden)
        XCTAssertEqual(reused.centerOffset, .zero)
        XCTAssertEqual(reused.badgeScale, 1)
        XCTAssertFalse(reused.accessibilityTraits.contains(.selected))
    }

    func testFocusedUnselectedAnnotationKeepsOnlyItsTitlePresentation() {
        let presentation = NativeActivityAnnotationSelectionPresentation(
            selected: false,
            keepsTitleVisible: true,
            badgeSize: 40
        )

        XCTAssertFalse(presentation.titleHidden)
        XCTAssertTrue(presentation.tailHidden)
        XCTAssertTrue(presentation.anchorHidden)
        XCTAssertEqual(presentation.titleOriginY, 45)
    }

    func testAnnotationAccessibilityLabelDropsEmptyDuplicatePresentation() {
        XCTAssertEqual(
            NativeMapAnnotationPresentation.accessibilityLabel(
                title: "Museum",
                subtitle: "  Main Street  "
            ),
            "Museum, Main Street"
        )
        XCTAssertEqual(
            NativeMapAnnotationPresentation.accessibilityLabel(title: "Museum", subtitle: " "),
            "Museum"
        )
    }
}

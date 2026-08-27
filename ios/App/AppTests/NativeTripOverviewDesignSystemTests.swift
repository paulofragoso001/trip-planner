import XCTest
import UIKit
@testable import Almidy

@MainActor
final class NativeTripOverviewDesignSystemTests: XCTestCase {
    func testOverviewSheetSemanticPreservesSpecializedChrome() {
        let configuration = AlmidySheetConfiguration.overview

        if case .overview = configuration.role {} else {
            XCTFail("Expected the dedicated Overview sheet role")
        }
        XCTAssertEqual(configuration.preferredCornerRadius, AlmidyDesignTokens.Component.TripOverview.sheetCornerRadius)
        XCTAssertFalse(configuration.prefersGrabberVisible)
        XCTAssertFalse(configuration.prefersScrollingExpandsWhenScrolledToEdge)
        XCTAssertTrue(configuration.prefersEdgeAttachedInCompactHeight)
        XCTAssertTrue(configuration.widthFollowsPreferredContentSizeWhenEdgeAttached)
    }

    func testComponentSpecificationOwnsActionAndAccessibilityGeometry() {
        let specification = AlmidyDesignTokens.Component.TripOverview.self

        XCTAssertEqual(specification.populatedActionCircleDiameter, 64)
        XCTAssertEqual(specification.populatedActionMinimumTarget, 60)
        XCTAssertEqual(specification.populatedActionIconDiameter, 29)
        XCTAssertEqual(specification.populatedActionLabelGap, 8)
        XCTAssertEqual(NativeTripOverviewActionsView.populatedCircleDiameter, specification.populatedActionCircleDiameter)
        XCTAssertEqual(NativeTripOverviewActionsView.populatedMinimumTarget, specification.populatedActionMinimumTarget)
    }

    func testBaseCardConsumesExactSharedSurfaceContract() {
        let card = NativeTripOverviewCard()

        XCTAssertEqual(card.backgroundColor, AlmidyDesignTokens.Color.surface)
        XCTAssertEqual(card.layer.cornerRadius, AlmidyDesignTokens.Component.TripOverview.cardCornerRadius)
        XCTAssertEqual(card.layer.borderWidth, 0)
        XCTAssertEqual(card.layer.shadowOpacity, 0)
        XCTAssertEqual(card.layer.cornerCurve, .continuous)
    }

    func testHeaderControlTouchAndVoiceOverShareActivation() {
        let button = NativeTripOverviewMinimumHitButton(type: .system)
        let target = ActionTarget()
        button.addTarget(target, action: #selector(ActionTarget.activate), for: .touchUpInside)

        button.sendActions(for: .touchUpInside)
        XCTAssertEqual(target.count, 1)
        XCTAssertTrue(button.accessibilityActivate())
        XCTAssertEqual(target.count, 2)
        XCTAssertEqual(button.minimumHitTarget, CGSize(width: 44, height: 44))
    }

    func testOverviewActionsTouchAndVoiceOverShareCallback() {
        let action = NativeTripOverviewAction(
            kind: .newActivity,
            label: "New Activity",
            destination: .webHandoff(URL(string: "https://almidy.app/trips/fixture")!)
        )
        let view = NativeTripOverviewActionsView()
        var activations = 0
        view.onAction = { received in
            XCTAssertEqual(received, action)
            activations += 1
        }

        view.render(actions: [action], activityMode: .empty)
        XCTAssertTrue(view.accessibilityActivateActionForTesting(at: 0))
        XCTAssertEqual(activations, 1)

        view.render(actions: [action], activityMode: .populated)
        XCTAssertTrue(view.accessibilityActivateActionForTesting(at: 0))
        XCTAssertEqual(activations, 2)
    }

    func testReduceMotionKeepsTransitionEndpointsAndResolvesDuration() {
        let animated = NativeTripOverviewHeaderTransition(progress: 0.25, reduceMotion: false)
        let reduced = NativeTripOverviewHeaderTransition(progress: 0.25, reduceMotion: true)
        let animatedEnd = NativeTripOverviewHeaderTransition(progress: 1, reduceMotion: false)
        let reducedEnd = NativeTripOverviewHeaderTransition(progress: 1, reduceMotion: true)

        XCTAssertNotEqual(animated.easedProgress, reduced.easedProgress)
        XCTAssertEqual(animatedEnd, reducedEnd)
        XCTAssertEqual(
            AlmidyDesignTokens.Motion.resolvedDuration(
                AlmidyDesignTokens.Motion.TripOverview.duration,
                reduceMotionEnabled: true
            ),
            0
        )
    }

    private final class ActionTarget: NSObject {
        var count = 0
        @objc func activate() { count += 1 }
    }
}

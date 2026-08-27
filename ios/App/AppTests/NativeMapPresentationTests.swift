import MapKit
import XCTest
@testable import Almidy

@MainActor
final class NativeMapPresentationTests: XCTestCase {
    func testControlClusterPreservesOrderingGeometryAndAccessibility() {
        let controls = NativeMapControlsView(onMapStyle: {}, onLocation: {}, onOrientation: {})

        XCTAssertEqual(NativeMapControlsView.controlSize, 48)
        XCTAssertEqual(NativeMapControlsView.clusterSpacing, 8)
        XCTAssertEqual(NativeMapControlsView.groupedSpacing, 1)
        XCTAssertEqual(controls.mapStyleButton.semanticDiameter, 48)
        XCTAssertEqual(controls.locationButton.semanticDiameter, 48)
        XCTAssertEqual(controls.orientationButton.semanticDiameter, 48)
        XCTAssertEqual(controls.accessibilityElements as? [AlmidyIconButton], [
            controls.mapStyleButton, controls.locationButton, controls.orientationButton
        ])
        XCTAssertEqual(controls.mapStyleButton.accessibilityLabel, "Change map style")
        XCTAssertEqual(controls.locationButton.accessibilityLabel, "Recenter on current location")
        XCTAssertEqual(controls.orientationButton.accessibilityLabel, "Reset map orientation")
    }

    func testControlCallbacksPreserveIndependentActions() {
        var actions: [String] = []
        let controls = NativeMapControlsView(
            onMapStyle: { actions.append("style") },
            onLocation: { actions.append("location") },
            onOrientation: { actions.append("orientation") }
        )

        controls.mapStyleButton.sendActions(for: .touchUpInside)
        controls.locationButton.sendActions(for: .touchUpInside)
        controls.orientationButton.sendActions(for: .touchUpInside)

        XCTAssertEqual(actions, ["style", "location", "orientation"])
    }

    func testControlHitTargetsMeetMinimumAndVoiceOverActivationUsesButtonPath() {
        var actions = 0
        let controls = NativeMapControlsView(
            onMapStyle: { actions += 1 },
            onLocation: {},
            onOrientation: {}
        )
        controls.mapStyleButton.bounds = CGRect(x: 0, y: 0, width: 48, height: 48)

        XCTAssertTrue(controls.mapStyleButton.point(inside: CGPoint(x: 47, y: 47), with: nil))
        XCTAssertGreaterThanOrEqual(controls.mapStyleButton.minimumHitTarget.width, 44)
        XCTAssertTrue(controls.mapStyleButton.accessibilityActivate())
        XCTAssertEqual(actions, 1)
    }

    func testMapPreferencesPreserveSheetAndMeasuredGeometry() {
        let configuration = NativeMapPreferencesViewController.sheetConfiguration

        if case .prominent = configuration.role {} else {
            XCTFail("Map Preferences must use the prominent sheet role")
        }
        XCTAssertEqual(configuration.preferredCornerRadius, AlmidyDesignTokens.TripOverview.sheetCornerRadius)
        XCTAssertFalse(configuration.prefersGrabberVisible)
        XCTAssertEqual(configuration.largestUndimmedDetentIdentifier, .large)
        XCTAssertEqual(NativeMapPreferencesViewController.titleFontSize, 34)
        XCTAssertEqual(NativeMapPreferencesViewController.closeSize, 48)
        XCTAssertEqual(NativeMapPreferencesViewController.styleCardHeight, 170)
        XCTAssertEqual(NativeMapPreferencesViewController.selectedBorderWidth, 3)
    }

    func testMapPreferencesPreserveSelectionAndCallbackSemantics() throws {
        var changes: [(Bool, Bool, Bool)] = []
        let controller = NativeMapPreferencesViewController(
            usesHybridMap: false,
            showsTransportationRoutes: true,
            showsFlightRoutes: false,
            previewCoordinate: CLLocationCoordinate2D(latitude: 0, longitude: 0),
            onChange: { changes.append(($0, $1, $2)) }
        )
        controller.loadViewIfNeeded()
        let map = try XCTUnwrap(controller.view.mapDescendants(of: UIButton.self).first {
            $0.accessibilityLabel == "Map"
        })
        let hybrid = try XCTUnwrap(controller.view.mapDescendants(of: UIButton.self).first {
            $0.accessibilityLabel == "Hybrid"
        })

        XCTAssertTrue(map.accessibilityTraits.contains(.selected))
        XCTAssertFalse(hybrid.accessibilityTraits.contains(.selected))
        hybrid.sendActions(for: .touchUpInside)

        XCTAssertFalse(map.accessibilityTraits.contains(.selected))
        XCTAssertTrue(hybrid.accessibilityTraits.contains(.selected))
        XCTAssertEqual(changes.count, 1)
        XCTAssertEqual(changes.first?.0, true)
        XCTAssertEqual(changes.first?.1, true)
        XCTAssertEqual(changes.first?.2, false)
    }
}

private extension UIView {
    func mapDescendants<T: UIView>(of type: T.Type) -> [T] {
        var matches = self as? T == nil ? [] : [self as! T]
        subviews.forEach { matches.append(contentsOf: $0.mapDescendants(of: type)) }
        return matches
    }
}

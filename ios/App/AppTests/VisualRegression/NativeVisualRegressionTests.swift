import XCTest
import UIKit
@testable import Almidy

@MainActor
final class AlmidySnapshotHarnessTests: XCTestCase {
    func testCanonicalBaselineRootAndNamingPolicyAreStable() {
        XCTAssertTrue(AlmidySnapshotTesting.baselineRoot.path.hasSuffix("ios/App/DesignBaselines/Snapshots"))
        XCTAssertEqual(AlmidySnapshotTesting.recordingEnvironmentKey, "ALMIDY_RECORD_SNAPSHOTS")
        XCTAssertEqual(AlmidySnapshotTesting.canonicalPhoneSize, CGSize(width: 393, height: 852))
        XCTAssertEqual(AlmidySnapshotTesting.canonicalScale, 3)
    }

    func testComparatorRejectsDimensionMismatch() {
        let first = solidImage(color: .black, size: CGSize(width: 2, height: 2))
        let second = solidImage(color: .black, size: CGSize(width: 3, height: 2))
        XCTAssertThrowsError(try AlmidySnapshotTesting.compare(expected: first, actual: second)) { error in
            guard case AlmidySnapshotTesting.SnapshotError.dimensionMismatch = error else {
                return XCTFail("Unexpected error: \(error)")
            }
        }
    }

    func testComparatorReportsStrictPixelMismatchAndDifferenceImage() throws {
        let expected = solidImage(color: .black, size: CGSize(width: 2, height: 2))
        let actual = solidImage(color: .white, size: CGSize(width: 2, height: 2))
        let comparison = try AlmidySnapshotTesting.compare(expected: expected, actual: actual)
        XCTAssertEqual(comparison.mismatchedPixels, 36)
        XCTAssertEqual(comparison.maximumChannelDelta, 255)
        XCTAssertEqual(comparison.difference.size, expected.size)
    }

    func testEveryCanonicalBaselineDecodes() throws {
        XCTAssertEqual(try AlmidySnapshotTesting.validateBaselines().count, 12)
    }

    private func solidImage(color: UIColor, size: CGSize) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 3
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            color.setFill()
            context.fill(CGRect(origin: .zero, size: size))
        }
    }
}

@MainActor
final class NativeVisualRegressionTests: XCTestCase {
    func testGlobeActiveTripCard() throws {
        let card = NativeGlobeTripCardView(
            identifier: "fixture-active-trip",
            title: "Lisbon & Porto",
            dates: "Sep 4 → Sep 10",
            status: "Day 3 of 7",
            height: NativeTripCardLayout.activeHeight
        )
        card.mediaView.image = fixtureMedia(start: UIColor(red: 0.08, green: 0.31, blue: 0.45, alpha: 1), end: .systemOrange)
        try snapshot(card, size: CGSize(width: 361, height: NativeTripCardLayout.activeHeight), name: "globe-active-trip-card", feature: "Globe")
    }

    func testGlobeFutureTripCard() throws {
        let card = NativeGlobeTripCardView(
            identifier: "fixture-future-trip",
            title: "Kyoto in Autumn",
            dates: "Nov 12 → Nov 19",
            status: "Starts in 76 days",
            height: NativeTripCardLayout.futureHeight
        )
        card.mediaView.image = fixtureMedia(start: UIColor(red: 0.32, green: 0.16, blue: 0.42, alpha: 1), end: UIColor(red: 0.85, green: 0.36, blue: 0.22, alpha: 1))
        try snapshot(card, size: CGSize(width: 361, height: NativeTripCardLayout.futureHeight), name: "globe-future-trip-card", feature: "Globe")
    }

    func testReservationAutomationCard() throws {
        let card = NativeGlobeReservationAutomationView(onOpen: {}, onDismiss: {})
        try snapshot(card, size: CGSize(width: 361, height: 236), name: "globe-reservation-automation", feature: "Globe")
    }

    func testMapControlCluster() throws {
        let controls = NativeMapControlsView(onMapStyle: {}, onLocation: {}, onOrientation: {})
        let backing = UIView()
        backing.backgroundColor = UIColor(red: 0.16, green: 0.22, blue: 0.20, alpha: 1)
        controls.translatesAutoresizingMaskIntoConstraints = false
        backing.addSubview(controls)
        NSLayoutConstraint.activate([
            controls.topAnchor.constraint(equalTo: backing.topAnchor, constant: 18),
            controls.trailingAnchor.constraint(equalTo: backing.trailingAnchor, constant: -12)
        ])
        try snapshot(backing, size: CGSize(width: 96, height: 190), name: "globe-map-controls", feature: "Globe")
    }

    func testPlaceTravelModeSelection() throws {
        let modes = NativePlaceTravelModesView(
            durations: ["12m", "7m", "18m", "9m"],
            selectedIndex: 1,
            onSelect: { _ in }
        )
        try snapshot(modes, size: CGSize(width: 353, height: NativePlaceTravelModesView.height), name: "place-card-travel-modes", feature: "PlaceCard")
    }

    func testSavedPlacePopulatedComposition() throws {
        let editor = NativeSavedPlaceEditorView(
            category: "Museum",
            accent: AlmidyDesignTokens.Color.info,
            costAction: actionView("Cost", value: "$48.00"),
            noteAction: actionView("Note", value: "Tickets saved"),
            attachmentAction: actionView("Documents", value: "2 files"),
            onChangeCategory: {}, onChange: {},
            onCheckInDate: {}, onCheckInTime: {}, onCheckOutDate: {}, onCheckOutTime: {}
        )
        editor.primaryFields["Name"]?.text = "Museu Nacional do Azulejo"
        editor.primaryFields["Address"]?.text = "Rua da Madre de Deus, Lisbon"
        editor.detailFields["Phone"]?.text = "+351 218 100 340"
        editor.detailFields["Website"]?.text = "museudoazulejo.gov.pt"
        editor.detailFields["Reservation Code"]?.text = "LIS-2048"
        try snapshot(editor, size: CGSize(width: 353, height: 704), name: "saved-place-populated", feature: "Editors")
    }

    func testTransportationTrainComposition() throws {
        let departure = routeView(title: "Departure", value: "Lisbon Oriente · Sep 6, 9:30 AM")
        let arrival = routeView(title: "Arrival", value: "Porto Campanhã · Sep 6, 12:18 PM")
        let editor = NativeTransportationEditorView(
            configuration: NativeTransportationEditorConfiguration(kind: .train)!,
            routeSections: [departure, arrival],
            costAction: actionView("Cost", value: "€42.00"),
            noteAction: actionView("Note", value: "Window seats"),
            attachmentAction: actionView("Documents", value: "1 ticket"),
            onChange: {}
        )
        editor.primaryFields["Route Name"]?.text = "Alfa Pendular"
        editor.primaryFields["Transport Number"]?.text = "AP 125"
        editor.primaryFields["Company"]?.text = "CP"
        editor.detailFields["Reservation Code"]?.text = "CP7A19"
        editor.detailFields["Coach Number"]?.text = "4"
        editor.detailFields["Seat"]?.text = "12A"
        try snapshot(editor, size: CGSize(width: 353, height: 910), name: "transportation-train", feature: "Editors")
    }

    func testFlightPopulatedComposition() throws {
        let editor = NativeFlightEditorView(
            initialAirline: "TAP Air Portugal",
            initialAirlineIATACode: "TP",
            initialFlightNumber: "1927",
            routeSections: [
                routeView(title: "Departure", value: "LIS · Sep 4, 8:20 AM"),
                routeView(title: "Arrival", value: "OPO · Sep 4, 9:15 AM")
            ],
            costAction: actionView("Cost", value: "$126.40"),
            noteAction: actionView("Note", value: "Carry-on only"),
            attachmentAction: actionView("Documents", value: "Boarding pass"),
            onChange: {}
        )
        editor.detailFields["Departure Airport Code"]?.text = "LIS"
        editor.detailFields["Departure Terminal"]?.text = "1"
        editor.detailFields["Departure Gate"]?.text = "18"
        editor.detailFields["Arrival Airport Code"]?.text = "OPO"
        editor.detailFields["Reservation Code"]?.text = "ALM22V"
        editor.detailFields["Seat"]?.text = "14F"
        try snapshot(editor, size: CGSize(width: 353, height: 980), name: "flight-populated", feature: "Editors")
    }

    private func snapshot(_ view: UIView, size: CGSize, name: String, feature: String) throws {
        view.backgroundColor = view.backgroundColor ?? AlmidyDesignTokens.Color.canvasGrouped
        let image = AlmidySnapshotTesting.render(view, size: size)
        try AlmidySnapshotTesting.assertSnapshot(image, named: name, feature: feature, testCase: self)
    }

    private func fixtureMedia(start: UIColor, end: UIColor) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: CGSize(width: 720, height: 720), format: format).image { context in
            let colors = [start.cgColor, end.cgColor] as CFArray
            let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1])!
            context.cgContext.drawLinearGradient(
                gradient,
                start: CGPoint(x: 0, y: 0),
                end: CGPoint(x: 720, y: 720),
                options: []
            )
        }
    }

    private func actionView(_ title: String, value: String) -> UIView {
        let row = UIView()
        row.backgroundColor = .systemBackground
        row.layer.cornerRadius = 18
        row.heightAnchor.constraint(equalToConstant: 64).isActive = true
        let titleLabel = UILabel()
        titleLabel.text = title
        titleLabel.font = .systemFont(ofSize: 17, weight: .medium)
        let valueLabel = UILabel()
        valueLabel.text = value
        valueLabel.textColor = .secondaryLabel
        valueLabel.font = .systemFont(ofSize: 15)
        let stack = UIStackView(arrangedSubviews: [titleLabel, UIView(), valueLabel])
        stack.translatesAutoresizingMaskIntoConstraints = false
        row.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: row.trailingAnchor, constant: -16),
            stack.centerYAnchor.constraint(equalTo: row.centerYAnchor)
        ])
        return row
    }

    private func routeView(title: String, value: String) -> UIView {
        let view = UIView()
        view.backgroundColor = .systemBackground
        view.layer.cornerRadius = 18
        view.heightAnchor.constraint(equalToConstant: 76).isActive = true
        let titleLabel = UILabel()
        titleLabel.text = title.uppercased()
        titleLabel.font = .systemFont(ofSize: 12, weight: .semibold)
        titleLabel.textColor = AlmidyDesignTokens.Color.accentText
        let valueLabel = UILabel()
        valueLabel.text = value
        valueLabel.font = .systemFont(ofSize: 16)
        valueLabel.numberOfLines = 2
        let stack = UIStackView(arrangedSubviews: [titleLabel, valueLabel])
        stack.axis = .vertical
        stack.spacing = 4
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        return view
    }
}

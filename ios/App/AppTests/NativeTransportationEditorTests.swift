import XCTest
@testable import Almidy

@MainActor
final class NativeTransportationEditorTests: XCTestCase {
    func testEveryNonFlightKindHasTransportationConfiguration() {
        let kinds = TransportationActivityDraft.Kind.allCases.filter { $0 != .flight }
        let configurations = kinds.compactMap(NativeTransportationEditorConfiguration.init)

        XCTAssertEqual(configurations.count, 10)
        XCTAssertEqual(configurations.map(\.kind), kinds)
        XCTAssertTrue(configurations.allSatisfy { !$0.title.isEmpty })
        XCTAssertTrue(configurations.allSatisfy { !$0.primaryFields.isEmpty })
        XCTAssertTrue(configurations.allSatisfy { !$0.detailRows.isEmpty })
    }

    func testRepresentativeKindsPreserveFieldAndRouteCopy() throws {
        let train = try XCTUnwrap(NativeTransportationEditorConfiguration(kind: .train))
        let carRental = try XCTUnwrap(NativeTransportationEditorConfiguration(kind: .carRental))
        let ferry = try XCTUnwrap(NativeTransportationEditorConfiguration(kind: .ferry))

        XCTAssertEqual(train.primaryFields, ["Route Name", "Transport Number", "Company"])
        XCTAssertEqual(train.departureTitle, "Add Departure Station")
        XCTAssertEqual(train.arrivalTitle, "Add Arrival Station")
        XCTAssertEqual(train.detailRows.map(\.label), [
            "Phone", "Website", "Reservation Code", "Coach Number", "Seat", "Seat Class", "Train Type"
        ])
        XCTAssertEqual(carRental.primaryFields, ["Name", "Company"])
        XCTAssertEqual(carRental.departureTitle, "Add Pick-up Location")
        XCTAssertTrue(carRental.detailRows.contains { $0.label == "Vehicle" })
        XCTAssertEqual(ferry.departureTitle, "Add Departure Port")
        XCTAssertEqual(ferry.arrivalTitle, "Add Arrival Port")
    }

    func testCompositionPreservesConfiguredFieldsAndOwnerCallbacks() throws {
        var changes = 0
        let editor = makeEditor(kind: .train, onChange: { changes += 1 })
        let routeName = try XCTUnwrap(editor.primaryFields["Route Name"])
        let coach = try XCTUnwrap(editor.detailFields["Coach Number"])
        routeName.text = "  Northeast Regional  "
        coach.text = "  4  "

        routeName.sendActions(for: .editingChanged)
        coach.sendActions(for: .editingChanged)

        XCTAssertEqual(changes, 2)
        XCTAssertEqual(routeName.text, "  Northeast Regional  ")
        XCTAssertEqual(coach.text, "  4  ")
        XCTAssertEqual(editor.accessibilityIdentifier, "native-transportation-editor-content")
        XCTAssertEqual(NativeTransportationEditorView.sectionSpacing, 14)
    }

    func testRouteSectionsRetainDepartureThenArrivalIdentity() throws {
        let departure = UIView()
        departure.accessibilityIdentifier = "departure"
        let arrival = UIView()
        arrival.accessibilityIdentifier = "arrival"
        let editor = makeEditor(kind: .bus, routeSections: [departure, arrival])
        let identifiers = editor.transportationDescendants.compactMap(\.accessibilityIdentifier)

        let departureIndex = try XCTUnwrap(identifiers.firstIndex(of: "departure"))
        let arrivalIndex = try XCTUnwrap(identifiers.firstIndex(of: "arrival"))
        XCTAssertLessThan(departureIndex, arrivalIndex)
    }

    private func makeEditor(
        kind: TransportationActivityDraft.Kind,
        routeSections: [UIView] = [],
        onChange: @escaping () -> Void = {}
    ) -> NativeTransportationEditorView {
        NativeTransportationEditorView(
            configuration: NativeTransportationEditorConfiguration(kind: kind)!,
            routeSections: routeSections,
            costAction: UIView(),
            noteAction: UIView(),
            attachmentAction: UIView(),
            onChange: onChange
        )
    }
}

private extension UIView {
    var transportationDescendants: [UIView] {
        [self] + subviews.flatMap(\.transportationDescendants)
    }
}

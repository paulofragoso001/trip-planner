import XCTest
@testable import Almidy

@MainActor
final class NativeFlightEditorTests: XCTestCase {
    func testConfigurationPreservesAviationFieldsAndReservationOrder() {
        let configuration = NativeFlightEditorConfiguration()

        XCTAssertEqual(configuration.title, "Flight Route")
        XCTAssertEqual(configuration.primaryFields, ["Flight Number", "Airline", "Airline IATA Code"])
        XCTAssertEqual(configuration.detailRows.map(\.label), [
            "Departure Airport Code", "Departure Terminal", "Departure Gate",
            "Arrival Airport Code", "Arrival Terminal", "Arrival Gate",
            "Reservation Code", "Seat", "Seat Class"
        ])
    }

    func testInitialMetadataAndAirportCodeInputBehaviorArePreserved() throws {
        let editor = makeEditor(
            initialAirline: "Example Air",
            initialAirlineIATACode: "EXA",
            initialFlightNumber: "123"
        )

        XCTAssertEqual(editor.primaryFields["Airline"]?.text, "Example Air")
        XCTAssertEqual(editor.primaryFields["Airline IATA Code"]?.text, "EXA")
        XCTAssertEqual(editor.primaryFields["Flight Number"]?.text, "123")
        let airlineCode = try XCTUnwrap(editor.primaryFields["Airline IATA Code"])
        XCTAssertEqual(airlineCode.autocapitalizationType, .allCharacters)
        XCTAssertEqual(airlineCode.autocorrectionType, .no)
        XCTAssertEqual(editor.detailFields["Departure Airport Code"]?.autocapitalizationType, .allCharacters)
        XCTAssertEqual(editor.detailFields["Arrival Airport Code"]?.autocorrectionType, .no)
    }

    func testPrimaryAndReservationMutationsRemainOwnerCallbacks() throws {
        var changes = 0
        let editor = makeEditor(onChange: { changes += 1 })
        let airline = try XCTUnwrap(editor.primaryFields["Airline"])
        let gate = try XCTUnwrap(editor.detailFields["Departure Gate"])
        airline.text = "  Example Air  "
        gate.text = " B12 "

        airline.sendActions(for: .editingChanged)
        gate.sendActions(for: .editingChanged)

        XCTAssertEqual(changes, 2)
        XCTAssertEqual(airline.text, "  Example Air  ")
        XCTAssertEqual(gate.text, " B12 ")
        XCTAssertEqual(editor.accessibilityIdentifier, "native-flight-editor-content")
    }

    func testAirportRouteSectionsRetainDepartureThenArrivalOrder() throws {
        let departure = UIView()
        departure.accessibilityIdentifier = "departure-airport"
        let arrival = UIView()
        arrival.accessibilityIdentifier = "arrival-airport"
        let editor = makeEditor(routeSections: [departure, arrival])
        let identifiers = editor.flightDescendants.compactMap(\.accessibilityIdentifier)

        let departureIndex = try XCTUnwrap(identifiers.firstIndex(of: "departure-airport"))
        let arrivalIndex = try XCTUnwrap(identifiers.firstIndex(of: "arrival-airport"))
        XCTAssertLessThan(departureIndex, arrivalIndex)
        XCTAssertEqual(NativeFlightEditorView.sectionSpacing, 14)
    }

    private func makeEditor(
        initialAirline: String? = nil,
        initialAirlineIATACode: String? = nil,
        initialFlightNumber: String? = nil,
        routeSections: [UIView] = [],
        onChange: @escaping () -> Void = {}
    ) -> NativeFlightEditorView {
        NativeFlightEditorView(
            initialAirline: initialAirline,
            initialAirlineIATACode: initialAirlineIATACode,
            initialFlightNumber: initialFlightNumber,
            routeSections: routeSections,
            costAction: UIView(),
            noteAction: UIView(),
            attachmentAction: UIView(),
            onChange: onChange
        )
    }
}

private extension UIView {
    var flightDescendants: [UIView] {
        [self] + subviews.flatMap(\.flightDescendants)
    }
}

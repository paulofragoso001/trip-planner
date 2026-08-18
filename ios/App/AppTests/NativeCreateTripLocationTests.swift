import CoreLocation
import XCTest
@testable import Almidy

final class NativeCreateTripLocationTests: XCTestCase {
    func testTripNameAloneCannotCreateLocationBackedTrip() {
        let state = NativeCreateTripState(
            tripName: "Summer with Mom",
            resolvedLocation: nil
        )
        XCTAssertEqual(
            NativeCreateTripValidator.validate(state),
            .failure(.missingResolvedLocation)
        )
    }

    func testFreeTripNameTextIsNotAuthoritativeLocation() {
        let state = NativeCreateTripState(
            tripName: "Paris",
            resolvedLocation: nil
        )
        XCTAssertEqual(
            NativeCreateTripValidator.validate(state),
            .failure(.missingResolvedLocation)
        )
    }

    func testResolvedLocationEnablesValidState() throws {
        let destination = NativeResolvedDestination(
            title: "Paris, France",
            coordinate: CLLocationCoordinate2D(latitude: 48.8566, longitude: 2.3522)
        )
        let state = NativeCreateTripState(
            tripName: "Paris",
            resolvedLocation: destination
        )
        XCTAssertEqual(try NativeCreateTripValidator.validate(state).get(), destination)
    }

    func testEditingTripNameInvalidatesResolvedLocation() {
        let destination = NativeResolvedDestination(
            title: "Tokyo",
            coordinate: CLLocationCoordinate2D(latitude: 35.6762, longitude: 139.6503)
        )
        var state = NativeCreateTripState(
            tripName: "Tokyo",
            resolvedLocation: destination
        )
        state.updateTripName("Tokyo with Friends")
        XCTAssertNil(state.resolvedLocation)
    }

    func testWhitespaceOnlyTripNameEditPreservesResolvedLocation() {
        let destination = NativeResolvedDestination(
            title: "Brazil",
            coordinate: CLLocationCoordinate2D(latitude: -14.235, longitude: -51.9253)
        )
        var state = NativeCreateTripState(
            tripName: "Brazil",
            resolvedLocation: destination
        )
        state.updateTripName("  Brazil  ")
        XCTAssertEqual(state.resolvedLocation, destination)
    }

    func testConfirmingLocationPreservesRawTripNameAndStoresCanonicalLocationSeparately() {
        var state = NativeCreateTripState(tripName: "Paris", resolvedLocation: nil)
        let destination = NativeResolvedDestination(
            title: "Paris, France",
            coordinate: CLLocationCoordinate2D(latitude: 48.8566, longitude: 2.3522)
        )
        state.confirmLocation(destination)
        XCTAssertEqual(state.tripName, "Paris")
        XCTAssertEqual(state.resolvedLocation, destination)
    }

    func testExistingTripCanRetainUserTitleAndCanonicalLocation() throws {
        let destination = NativeResolvedDestination(
            title: "Paris, France",
            coordinate: CLLocationCoordinate2D(latitude: 48.8566, longitude: 2.3522)
        )
        let state = NativeCreateTripState(
            tripName: "Anniversary",
            resolvedLocation: destination
        )
        XCTAssertEqual(try NativeCreateTripValidator.validate(state).get(), destination)
        XCTAssertEqual(state.tripName, "Anniversary")
    }

    func testValidationErrorsHaveAccessibleMessages() {
        XCTAssertFalse(NativeCreateTripValidationError.missingName.accessibilityMessage.isEmpty)
        XCTAssertTrue(
            NativeCreateTripValidationError.missingResolvedLocation.accessibilityMessage
                .localizedCaseInsensitiveContains("select")
        )
    }
}

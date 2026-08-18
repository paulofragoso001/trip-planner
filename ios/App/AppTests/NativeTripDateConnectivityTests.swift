import Capacitor
import Foundation
import MapKit
import XCTest
@testable import Almidy

@MainActor
final class NativeTripDateConnectivityTests: XCTestCase {
    func testNativeTripStatusUsesRelativeTiming() throws {
        let referenceDate = try XCTUnwrap(
            ISO8601DateFormatter().date(from: "2026-08-10T12:00:00Z")
        )
        let trip = NativeMapTrip(
            id: "trip-relative",
            name: "Barcelona",
            destination: "Barcelona",
            latitude: 41.3874,
            longitude: 2.1686,
            startDate: "2026-08-11",
            endDate: "2026-09-17",
            status: "Planning"
        )

        XCTAssertEqual(trip.relativeStatus(relativeTo: referenceDate), "Starts tomorrow")
    }

    func testNativeTripStoreHydratesTripsFromAuthenticatedApiResponse() {
        NativeTripStoreURLProtocol.handler = { request in
            let response = NativeTripStoreURLProtocol.response(for: request, statusCode: 200)
            let body = """
            {"trips":[{"id":"trip-1","name":"Miami Weekend","destination":"Miami","destination_lat":25.7617,"destination_lng":-80.1918,"start_date":"2026-05-29","end_date":"2026-05-31","status":"Planning"}]}
            """.data(using: .utf8)!
            return (response, body)
        }
        defer { NativeTripStoreURLProtocol.handler = nil }

        let expectation = expectation(description: "trip hydration")
        let store = nativeTripStore()
        store.loadTrips { result in
            guard case .success(let trips) = result else {
                XCTFail("Expected hydrated trips")
                expectation.fulfill()
                return
            }
            XCTAssertEqual(trips.count, 1)
            XCTAssertEqual(trips[0].id, "trip-1")
            XCTAssertEqual(trips[0].displayName, "Miami Weekend")
            XCTAssertEqual(trips[0].coordinate?.latitude ?? 0, 25.7617, accuracy: 0.0001)
            XCTAssertEqual(trips[0].displayDateRange, "May 29 → May 31")
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 2)
    }

    func testNativeTripStorePersistsCreatedTripWithSessionOriginAndPayload() {
        NativeTripStoreURLProtocol.handler = { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Origin"), "https://almidy.app")
            XCTAssertEqual(request.url?.path, "/api/trips")
            let payload = try! XCTUnwrap(nativeRequestBodyData(request))
            let json = try! XCTUnwrap(JSONSerialization.jsonObject(with: payload) as? [String: Any])
            XCTAssertEqual(json["start_date"] as? String, "2026-09-14")
            XCTAssertEqual(json["end_date"] as? String, "2026-09-18")

            let response = NativeTripStoreURLProtocol.response(for: request, statusCode: 201)
            let responseBody = """
            {"trip":{"id":"trip-created","name":"Paris Weekend","destination":"Paris","destination_lat":48.8566,"destination_lng":2.3522,"status":"Planning"}}
            """.data(using: .utf8)!
            return (response, responseBody)
        }
        defer { NativeTripStoreURLProtocol.handler = nil }

        let expectation = expectation(description: "trip persistence")
        let store = nativeTripStore()
        let draft = NativeTripDraft(
            name: "Paris Weekend",
            destination: "Paris",
            coordinate: CLLocationCoordinate2D(latitude: 48.8566, longitude: 2.3522),
            startDate: "2026-09-14",
            endDate: "2026-09-18"
        )
        store.createTrip(draft) { result in
            guard case .success(let trip) = result else {
                XCTFail("Expected persisted trip")
                expectation.fulfill()
                return
            }
            XCTAssertEqual(trip.id, "trip-created")
            XCTAssertEqual(trip.coordinate?.longitude ?? 0, 2.3522, accuracy: 0.0001)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 2)
    }

    func testNativeTripStoreUpdatesAndDeletesTripThroughVercelApi() {
        var requests: [(method: String, path: String)] = []
        NativeTripStoreURLProtocol.handler = { request in
            requests.append((request.httpMethod ?? "", request.url?.path ?? ""))

            if request.httpMethod == "PATCH" {
                let payload = try! XCTUnwrap(nativeRequestBodyData(request))
                let json = try! XCTUnwrap(JSONSerialization.jsonObject(with: payload) as? [String: Any])
                XCTAssertEqual(json["start_date"] as? String, "2026-10-02")
                XCTAssertEqual(json["end_date"] as? String, "2026-10-06")
                let response = NativeTripStoreURLProtocol.response(for: request, statusCode: 200)
                let body = """
                {"trip":{"id":"trip-1","name":"Updated Miami","destination":"Miami Beach","destination_lat":25.7907,"destination_lng":-80.1300,"status":"Planning"}}
                """.data(using: .utf8)!
                return (response, body)
            }

            return (NativeTripStoreURLProtocol.response(for: request, statusCode: 204), Data())
        }
        defer { NativeTripStoreURLProtocol.handler = nil }

        let store = nativeTripStore()
        let draft = NativeTripDraft(
            name: "Updated Miami",
            destination: "Miami Beach",
            coordinate: CLLocationCoordinate2D(latitude: 25.7907, longitude: -80.1300),
            startDate: "2026-10-02",
            endDate: "2026-10-06"
        )
        let updateExpectation = expectation(description: "trip update")

        store.updateTrip(id: "trip-1", draft: draft) { result in
            guard case .success(let trip) = result else {
                XCTFail("Expected updated trip")
                updateExpectation.fulfill()
                return
            }
            XCTAssertEqual(trip.displayName, "Updated Miami")
            XCTAssertEqual(trip.coordinate?.latitude ?? 0, 25.7907, accuracy: 0.0001)
            updateExpectation.fulfill()
        }
        wait(for: [updateExpectation], timeout: 2)

        let deleteExpectation = expectation(description: "trip delete")
        store.deleteTrip(id: "trip-1") { result in
            if case .failure(let error) = result {
                XCTFail("Expected deleted trip request to succeed: \(error.localizedDescription)")
            }
            deleteExpectation.fulfill()
        }
        wait(for: [deleteExpectation], timeout: 2)

        XCTAssertEqual(requests.map(\.method), ["PATCH", "DELETE"])
        XCTAssertEqual(requests.map(\.path), ["/api/trips/trip-1", "/api/trips/trip-1"])
    }

}

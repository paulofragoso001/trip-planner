import MapKit
import XCTest
@testable import App

@MainActor
final class NativeMapConnectivityTests: XCTestCase {
    func testSyncPayloadDecodesAndRejectsStaleRevisions() throws {
        let payloadData = try XCTUnwrap(syncPayloadFixture.data(using: .utf8))
        let payload = try JSONDecoder().decode(NativeMapSyncPayload.self, from: payloadData)

        XCTAssertEqual(payload.revisionId, 1_714_312_800_000)
        XCTAssertEqual(payload.routeId, "rte_9f82c4")
        XCTAssertEqual(payload.trip.origin.name, "SF Transit Hub")
        XCTAssertEqual(payload.wallet.balance, "42.50")
        XCTAssertEqual(payload.camera.altitude, 10_000_000)

        var gate = NativeMapRevisionGate()
        XCTAssertTrue(gate.accept(payload))
        XCTAssertFalse(gate.accept(payload))

        let stalePayload = NativeMapSyncPayload(
            revisionId: payload.revisionId - 1,
            routeId: payload.routeId,
            status: payload.status,
            trip: payload.trip,
            wallet: payload.wallet,
            camera: payload.camera
        )
        XCTAssertFalse(gate.accept(stalePayload))

        let invalidPayloadData = try XCTUnwrap(
            syncPayloadFixture.replacingOccurrences(of: "37.7749", with: "137.7749").data(using: .utf8)
        )
        XCTAssertThrowsError(try JSONDecoder().decode(NativeMapSyncPayload.self, from: invalidPayloadData))
    }

    func testControllerDeallocatesAfterNetworkMonitorStarts() {
        weak var releasedController: NativeMapViewController?

        autoreleasepool {
            var controller: NativeMapViewController? = NativeMapViewController(trips: []) { _ in }
            controller?.loadViewIfNeeded()
            releasedController = controller
            controller = nil
        }

        XCTAssertNil(releasedController, "NWPathMonitor must not retain the native map controller.")
    }

    func testOfflineFallbackPreservesCameraAndRestoresMapSurface() {
        let controller = NativeMapViewController(
            trips: [],
            monitorsNetworkConnectivity: false
        ) { _ in }
        controller.loadViewIfNeeded()

        UIView.setAnimationsEnabled(false)
        defer { UIView.setAnimationsEnabled(true) }

        controller.setNetworkAvailabilityForTesting(false)
        XCTAssertTrue(controller.isShowingMapFallbackForTesting)

        let synchronizedCamera = MKMapCamera(
            lookingAtCenter: CLLocationCoordinate2D(latitude: 36, longitude: -120),
            fromDistance: 8_000_000,
            pitch: 12,
            heading: 24
        )
        controller.applyCameraTelemetry(synchronizedCamera)

        controller.setNetworkAvailabilityForTesting(true)
        XCTAssertFalse(controller.isShowingMapFallbackForTesting)
        XCTAssertEqual(controller.mapCameraForTesting.centerCoordinate.latitude, 36, accuracy: 0.0001)
        XCTAssertEqual(controller.mapCameraForTesting.centerCoordinate.longitude, -120, accuracy: 0.0001)
        XCTAssertEqual(controller.mapCameraForTesting.centerCoordinateDistance, 8_000_000, accuracy: 1)
        XCTAssertEqual(controller.mapCameraForTesting.pitch, 12, accuracy: 0.1)
        XCTAssertEqual(controller.preservedCameraForTesting?.heading ?? -1, 24, accuracy: 0.1)
    }
}

private let syncPayloadFixture = """
{
  "revisionId": 1714312800000,
  "routeId": "rte_9f82c4",
  "status": "active",
  "trip": {
    "tripId": "trp_alpha_01",
    "origin": { "lat": 37.7749, "lng": -122.4194, "name": "SF Transit Hub" },
    "destination": { "lat": 34.0522, "lng": -118.2437, "name": "LA Terminal" }
  },
  "wallet": {
    "passId": "pass_wallet_881",
    "isPassInstalled": true,
    "balance": "42.50",
    "currency": "USD"
  },
  "camera": {
    "center": { "lat": 36.0, "lng": -120.0 },
    "altitude": 10000000.0,
    "pitch": 0.0,
    "heading": 0.0
  }
}
"""

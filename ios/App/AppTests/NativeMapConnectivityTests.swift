import Capacitor
import MapKit
import XCTest
@testable import App

@MainActor
final class NativeMapConnectivityTests: XCTestCase {
    func testNativeUnderlayUsesHybridFlyoverPlanetScaleConfiguration() {
        let mapView = MapGatewayPlugin().makeNativeUnderlayMapForTesting()

        XCTAssertTrue(mapView.isPitchEnabled)
        XCTAssertTrue(mapView.isRotateEnabled)
        XCTAssertTrue(mapView.isScrollEnabled)
        XCTAssertTrue(mapView.isZoomEnabled)
        XCTAssertEqual(mapView.mapType, .hybridFlyover)
        XCTAssertEqual(mapView.camera.centerCoordinate.latitude, 37.7749, accuracy: 0.0001)
        XCTAssertEqual(mapView.camera.centerCoordinate.longitude, -122.4194, accuracy: 0.0001)
        XCTAssertEqual(mapView.camera.centerCoordinateDistance, 24_000_000, accuracy: 1)
        XCTAssertEqual(mapView.cameraZoomRange.maxCenterCoordinateDistance, 30_000_000, accuracy: 1)
    }

    func testNativeUnderlayTransparencySweepClearsContainersButPreservesMap() {
        let plugin = MapGatewayPlugin()
        let rootView = UIView(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        let hostingView = UIView(frame: rootView.bounds)
        let mapView = plugin.makeNativeUnderlayMapForTesting()
        rootView.backgroundColor = .black
        rootView.isOpaque = true
        hostingView.backgroundColor = .white
        hostingView.isOpaque = true
        mapView.backgroundColor = .systemRed
        mapView.isOpaque = true
        rootView.addSubview(mapView)
        rootView.addSubview(hostingView)

        plugin.makeSubviewsTransparentForTesting(view: rootView)

        XCTAssertEqual(rootView.backgroundColor, .clear)
        XCTAssertFalse(rootView.isOpaque)
        XCTAssertEqual(hostingView.backgroundColor, .clear)
        XCTAssertFalse(hostingView.isOpaque)
        XCTAssertEqual(mapView.backgroundColor, .systemRed)
        XCTAssertTrue(mapView.isOpaque)
    }

    func testNativeUnderlayPinsToNonzeroRootBoundsBehindHostingContent() {
        let plugin = MapGatewayPlugin()
        let rootView = UIView(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        let hostingView = UIView(frame: rootView.bounds)
        rootView.addSubview(hostingView)

        let mapView = plugin.attachNativeUnderlayForTesting(to: rootView)

        XCTAssertTrue(rootView.subviews.first === mapView)
        XCTAssertTrue(rootView.subviews.last === hostingView)
        XCTAssertEqual(mapView.frame, rootView.bounds)
        XCTAssertGreaterThan(mapView.bounds.width, 0)
        XCTAssertGreaterThan(mapView.bounds.height, 0)
    }

    func testNativeMapTouchForwarderRoutesMapSpaceAndProtectsWalletRegions() {
        let plugin = MapGatewayPlugin()
        let mapView = plugin.makeNativeUnderlayMapForTesting()
        let frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        let walletRegion = CGRect(x: 0, y: 560, width: 390, height: 284)

        let mapTarget = plugin.nativeMapTouchTargetForTesting(
            mapView: mapView,
            frame: frame,
            excludedRegions: [walletRegion],
            point: CGPoint(x: 180, y: 280)
        )
        let walletTarget = plugin.nativeMapTouchTargetForTesting(
            mapView: mapView,
            frame: frame,
            excludedRegions: [walletRegion],
            point: CGPoint(x: 180, y: 700)
        )

        XCTAssertNotNil(mapTarget)
        XCTAssertNil(walletTarget)
    }

    func testNativeUnderlayReportsUsableSizeBeforeRootViewHasLaidOut() {
        let plugin = MapGatewayPlugin()
        let rootView = UIView(frame: .zero)
        let mapView = plugin.attachNativeUnderlayForTesting(to: rootView)

        let resolvedSize = plugin.resolvedUnderlaySizeForTesting(mapView: mapView, rootView: rootView)

        XCTAssertGreaterThan(resolvedSize.width, 0)
        XCTAssertGreaterThan(resolvedSize.height, 0)
    }

    func testMapGatewayRejectsLegacyTimestampThroughPluginCall() {
        let plugin = MapGatewayPlugin()
        var acceptedResponse: [String: Any]?
        var staleResponse: [String: Any]?

        plugin.syncPayloadToNative(makeSyncPluginCall(jsonString: syncPayloadFixture) { result in
            acceptedResponse = result
        })

        let legacyPayload = syncPayloadFixture.replacingOccurrences(
            of: "1714312800000",
            with: "946684800000"
        )
        plugin.syncPayloadToNative(makeSyncPluginCall(jsonString: legacyPayload) { result in
            staleResponse = result
        })

        XCTAssertEqual(acceptedResponse?["success"] as? Bool, true)
        XCTAssertEqual(staleResponse?["success"] as? Bool, false)
        XCTAssertEqual(staleResponse?["reason"] as? String, "Stale revision ignored")
    }

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

private func makeSyncPluginCall(
    jsonString: String,
    onSuccess: @escaping ([String: Any]) -> Void
) -> CAPPluginCall {
    CAPPluginCall(
        callbackId: UUID().uuidString,
        methodName: "syncPayloadToNative",
        options: ["jsonString": jsonString],
        success: { result, _ in
            onSuccess(result?.data ?? [:])
        },
        error: { error in
            XCTFail("MapGateway plugin call failed: \(error?.message ?? "Unknown error")")
        }
    )
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

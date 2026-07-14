import Capacitor
import Foundation
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

        XCTAssertIdentical(mapTarget, mapView)
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
            var controller: NativeMapViewController? = NativeMapViewController(trips: [])
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
        )
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
        let store = NativeTripStore(webView: nil, baseURL: URL(string: "https://almidy.app")!, session: nativeTripStoreSession())
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
            XCTAssertEqual(trips[0].displayDateRange, "2026-05-29 – 2026-05-31")
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 2)
    }

    func testNativeTripStorePersistsCreatedTripWithSessionOriginAndPayload() {
        NativeTripStoreURLProtocol.handler = { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Origin"), "https://almidy.app")
            let body = try! XCTUnwrap(request.httpBody)
            let json = try! XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
            XCTAssertEqual(json["name"] as? String, "Paris Weekend")
            XCTAssertEqual(json["destination"] as? String, "Paris")
            XCTAssertEqual(json["destination_status"] as? String, "resolved")

            let response = NativeTripStoreURLProtocol.response(for: request, statusCode: 201)
            let responseBody = """
            {"trip":{"id":"trip-created","name":"Paris Weekend","destination":"Paris","destination_lat":48.8566,"destination_lng":2.3522,"status":"Planning"}}
            """.data(using: .utf8)!
            return (response, responseBody)
        }
        defer { NativeTripStoreURLProtocol.handler = nil }

        let expectation = expectation(description: "trip persistence")
        let store = NativeTripStore(webView: nil, baseURL: URL(string: "https://almidy.app")!, session: nativeTripStoreSession())
        let draft = NativeTripDraft(
            name: "Paris Weekend",
            destination: "Paris",
            coordinate: CLLocationCoordinate2D(latitude: 48.8566, longitude: 2.3522)
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

    func testKeychainSessionRestoresAndAutomaticallyRefreshesBeforeUse() {
        let service = "app.almidy.tests.supabase-session-\(UUID().uuidString)"
        let store = NativeAuthSessionStore(
            service: service,
            supabaseURL: URL(string: "https://supabase.test")!,
            publishableKey: "test-publishable-key"
        )
        store.save(NativeAuthSession(
            accessToken: "expired-access-token",
            refreshToken: "refresh-token",
            expiresAt: Int(Date().timeIntervalSince1970) - 1
        ))
        defer { store.clear() }

        XCTAssertEqual(store.session?.accessToken, "expired-access-token")
        XCTAssertTrue(store.isExpiringSoon)

        NativeAuthSessionURLProtocol.handler = { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.value(forHTTPHeaderField: "apikey"), "test-publishable-key")
            let body = try! XCTUnwrap(request.httpBody)
            let json = try! XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
            XCTAssertEqual(json["refresh_token"] as? String, "refresh-token")
            let response = NativeAuthSessionURLProtocol.response(for: request, statusCode: 200)
            let responseBody = """
            {"access_token":"refreshed-access-token","refresh_token":"rotated-refresh-token","expires_in":3600}
            """.data(using: .utf8)!
            return (response, responseBody)
        }
        defer { NativeAuthSessionURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [NativeAuthSessionURLProtocol.self]
        let session = URLSession(configuration: configuration)
        let expectation = expectation(description: "automatic session refresh")

        store.accessToken(using: session) { accessToken in
            XCTAssertEqual(accessToken, "refreshed-access-token")
            XCTAssertEqual(store.session?.refreshToken, "rotated-refresh-token")
            XCTAssertFalse(store.isExpiringSoon)
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 2)
    }

    func testNativeAuthSessionContractCoversSignInRefreshAndSignOut() throws {
        let signedIn = NativeAuthSessionContract(
            event: .signedIn,
            revisionId: 1,
            accessToken: "access-token",
            refreshToken: "refresh-token",
            expiresAt: 1_900_000_000,
            userId: "user-1",
            isSignedIn: true
        )
        let refreshed = NativeAuthSessionContract(
            event: .tokenRefreshed,
            revisionId: 2,
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
            expiresAt: 1_900_003_600,
            userId: "user-1",
            isSignedIn: true
        )
        let signedOut = NativeAuthSessionContract.signedOut(revisionId: 3)

        for contract in [signedIn, refreshed, signedOut] {
            let data = try JSONEncoder().encode(contract)
            let decoded = try JSONDecoder().decode(NativeAuthSessionContract.self, from: data)
            XCTAssertEqual(decoded, contract)
        }
        XCTAssertEqual(signedIn.userId, refreshed.userId)
        XCTAssertFalse(signedOut.isSignedIn)
        XCTAssertNil(signedOut.accessToken)
        XCTAssertNil(signedOut.refreshToken)
    }

    func testNativeWebRoutePolicyAllowsOnlySecondaryPages() {
        XCTAssertTrue(NativeWebRoutePolicy.allows("/dashboard/help"))
        XCTAssertTrue(NativeWebRoutePolicy.allows("/dashboard/imports/forward-reservation"))
        XCTAssertTrue(NativeWebRoutePolicy.allows("/dashboard/account/profile"))
        XCTAssertTrue(NativeWebRoutePolicy.allows("/dashboard/account#help"))
        XCTAssertTrue(NativeWebRoutePolicy.allows("/dashboard/settings/preferences"))
        XCTAssertFalse(NativeWebRoutePolicy.allows("/dashboard"))
        XCTAssertFalse(NativeWebRoutePolicy.allows("/dashboard/trips"))
        XCTAssertFalse(NativeWebRoutePolicy.allows("/dashboard/search"))
        XCTAssertFalse(NativeWebRoutePolicy.allows("/dashboard/account"))
        XCTAssertFalse(NativeWebRoutePolicy.allows("/dashboard/account#unknown"))
        XCTAssertFalse(NativeWebRoutePolicy.allows("https://example.com/dashboard/help"))
    }

    func testNativeRouteOwnershipIsExplicit() {
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "/dashboard/trips"), .native)
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "/dashboard/search"), .native)
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "/dashboard/account"), .native)
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "/dashboard/imports#reservation-forwarding"), .controlledWebView)
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "/dashboard/account#help"), .controlledWebView)
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "/dashboard/settings/preferences"), .controlledWebView)
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "https://example.com/dashboard/help"), .external)
    }

    func testNativeWebRoutePolicyIdentifiesNativeOwnedRoutes() {
        XCTAssertTrue(NativeWebRoutePolicy.isNativeOwned(URL(string: "https://almidy.app/dashboard/trips")!))
        XCTAssertTrue(NativeWebRoutePolicy.isNativeOwned(URL(string: "https://almidy.app/dashboard/search")!))
        XCTAssertTrue(NativeWebRoutePolicy.isNativeOwned(URL(string: "https://almidy.app/dashboard/wallet")!))
        XCTAssertFalse(NativeWebRoutePolicy.isNativeOwned(URL(string: "https://almidy.app/dashboard/help")!))
        XCTAssertFalse(NativeWebRoutePolicy.isNativeOwned(URL(string: "https://example.com/dashboard/trips")!))
    }

    func testNativeWebFeatureResultsCoverDismissalAndRefreshCallbacks() {
        let results: [NativeWebFeatureResult] = [.dismissed, .tripDataChanged, .importCompleted]
        XCTAssertEqual(results.count, 3)

        for result in results {
            switch result {
            case .dismissed, .tripDataChanged, .importCompleted:
                continue
            }
        }
    }
}

private func nativeTripStoreSession() -> URLSession {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [NativeTripStoreURLProtocol.self]
    return URLSession(configuration: configuration)
}

private final class NativeTripStoreURLProtocol: URLProtocol {
    static var handler: ((URLRequest) -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocolDidFinishLoading(self)
            return
        }
        let (response, body) = handler(request)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    static func response(for request: URLRequest, statusCode: Int) -> HTTPURLResponse {
        HTTPURLResponse(
            url: request.url!,
            statusCode: statusCode,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
    }
}

private final class NativeAuthSessionURLProtocol: URLProtocol {
    static var handler: ((URLRequest) -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocolDidFinishLoading(self)
            return
        }
        let (response, body) = handler(request)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    static func response(for request: URLRequest, statusCode: Int) -> HTTPURLResponse {
        HTTPURLResponse(
            url: request.url!,
            statusCode: statusCode,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
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

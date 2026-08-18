import Capacitor
import Foundation
import MapKit
import XCTest
@testable import Almidy

@MainActor
final class NativeMapConnectivityTests: XCTestCase {
    func testNativeUnderlayUsesPlanetScaleHybridConfiguration() {
        let mapView = MapGatewayPlugin().makeNativeUnderlayMapForTesting()

        XCTAssertTrue(mapView.isPitchEnabled)
        XCTAssertTrue(mapView.isRotateEnabled)
        XCTAssertTrue(mapView.isScrollEnabled)
        XCTAssertTrue(mapView.isZoomEnabled)
        if #available(iOS 16.0, *) {
            XCTAssertTrue(mapView.preferredConfiguration is MKHybridMapConfiguration)
        } else {
            XCTAssertEqual(mapView.mapType, .hybridFlyover)
        }
        XCTAssertEqual(mapView.camera.centerCoordinate.latitude, 37.7749, accuracy: 0.0001)
        XCTAssertEqual(mapView.camera.centerCoordinate.longitude, -122.4194, accuracy: 0.0001)
        XCTAssertGreaterThanOrEqual(
            mapView.camera.centerCoordinateDistance,
            29_000_000,
            "MapKit should clamp the requested maximum distance to its full-Earth framing for the current viewport."
        )
        XCTAssertEqual(mapView.cameraZoomRange.maxCenterCoordinateDistance, 90_000_000, accuracy: 1)
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

        XCTAssertTrue(mapTarget === mapView || mapTarget?.isDescendant(of: mapView) == true)
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

    func testPopulatedGlobeKeepsScaleAwareHybridLabelsAcrossCameraChanges() {
        let trip = NativeMapTrip(
            id: "trip-map-style",
            name: "Rome",
            destination: "Rome",
            latitude: 41.9028,
            longitude: 12.4964
        )
        let controller = NativeMapViewController(
            trips: [trip],
            monitorsNetworkConnectivity: false
        )
        controller.loadViewIfNeeded()

        XCTAssertTrue(controller.isZoomEnabledForTesting)
        XCTAssertGreaterThanOrEqual(
            controller.mapCameraForTesting.centerCoordinateDistance,
            29_000_000,
            "A populated globe should launch completely zoomed out with the whole Earth visible."
        )
        for distance in [2_000_000.0, 10_000_000.0, 65_000_000.0, 90_000_000.0] {
            controller.setMapCameraDistanceForTesting(distance)
            XCTAssertTrue(
                controller.usesScaleAwareHybridPresentationForTesting,
                "A populated globe must stay hybrid so MapKit can adapt city, country, continent, ocean, and boundary labels to the current zoom level."
            )
        }
        XCTAssertEqual(
            controller.geographicLabelOverlayCountForTesting,
            0,
            "MapKit should own scale-aware geographic labels; Almidy must not add a competing static label overlay."
        )
    }

    func testTripFlagBadgeIsCircularAndAnchoredToItsCoordinate() throws {
        let trip = NativeMapTrip(
            id: "trip-flag-anchor",
            name: "Italy",
            destination: "Rome, Italy",
            latitude: 41.9028,
            longitude: 12.4964
        )
        let controller = NativeMapViewController(
            trips: [trip],
            monitorsNetworkConnectivity: false
        )
        controller.loadViewIfNeeded()

        let layout = try XCTUnwrap(controller.tripFlagAnchorForTesting)
        XCTAssertEqual(layout.badgeSize.width, 40, accuracy: 0.5)
        XCTAssertEqual(layout.badgeSize.height, 40, accuracy: 0.5)
        XCTAssertEqual(layout.badgeCornerRadius, layout.badgeSize.width / 2, accuracy: 0.5)
        XCTAssertTrue(layout.flagClipsToCircle)
        XCTAssertFalse(layout.badgeBackgroundIsClear)
        XCTAssertGreaterThanOrEqual(layout.flagFontSize, layout.badgeSize.width * 0.9)
        XCTAssertLessThan(layout.flagFontSize, layout.badgeSize.width)
        XCTAssertFalse(layout.canShowCallout)

        let badgeCenterRelativeToAnnotation = CGPoint(
            x: layout.badgeCenter.x - 80,
            y: layout.badgeCenter.y - 39
        )
        XCTAssertEqual(layout.centerOffset.x + badgeCenterRelativeToAnnotation.x, 0, accuracy: 0.5)
        XCTAssertEqual(layout.centerOffset.y + badgeCenterRelativeToAnnotation.y, 0, accuracy: 0.5)
    }

    func testExpandedHeaderUsesCompactMutedGoldControls() throws {
        let trip = NativeMapTrip(
            id: "trip-expanded-header",
            name: "New York",
            destination: "New York, United States",
            latitude: 40.7128,
            longitude: -74.0060
        )
        let controller = NativeMapViewController(
            trips: [trip],
            monitorsNetworkConnectivity: false
        )
        controller.loadViewIfNeeded()

        let chrome = try XCTUnwrap(controller.expandedHeaderChromeForTesting)
        XCTAssertEqual(chrome.settingsSize.width, 42, accuracy: 0.5)
        XCTAssertEqual(chrome.settingsSize.height, 42, accuracy: 0.5)
        XCTAssertEqual(chrome.settingsCornerRadius, 21, accuracy: 0.5)
        XCTAssertEqual(chrome.settingsTranslation.x, 0, accuracy: 0.5)
        XCTAssertEqual(chrome.settingsTranslation.y, -2, accuracy: 0.5)
        XCTAssertTrue(chrome.settingsBackground?.isEqual(AlmidyDesignTokens.Color.goldMutedSurface) == true)
        XCTAssertTrue(chrome.settingsTint.isEqual(AlmidyDesignTokens.Color.goldMuted))
        XCTAssertEqual(chrome.yearFontSize, 18, accuracy: 0.5)
        XCTAssertTrue(chrome.yearBackground?.isEqual(AlmidyDesignTokens.Color.goldMutedSurface) == true)
        XCTAssertTrue(chrome.yearTextColor?.isEqual(AlmidyDesignTokens.Color.goldMuted) == true)
    }

    func testTripCollectionArrowOpensMenuWhileSheetExpansionRemainsGestureDriven() {
        let controller = NativeMapViewController(
            trips: [],
            monitorsNetworkConnectivity: false
        )
        controller.loadViewIfNeeded()

        let menu = controller.tripCollectionMenuForTesting
        XCTAssertEqual(menu.titles, ["My Trips", "Friends' Trips"])
        XCTAssertEqual(menu.selectedTitle, "My Trips")
        XCTAssertEqual(menu.disabledTitles, ["Friends' Trips"])
        XCTAssertTrue(menu.opensAsPrimaryAction)
        XCTAssertTrue(menu.chevronIsInteractive)
        XCTAssertTrue(menu.sheetSupportsPan)
        XCTAssertFalse(menu.titleHasLegacyToggleAction)
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

    func testNativeTripMutationsFailWhenPersistenceIsUnavailable() {
        let controller = NativeMapViewController(
            trips: [],
            monitorsNetworkConnectivity: false,
            tripStore: nil
        )
        let draft = NativeTripDraft(
            name: "Paris Weekend",
            destination: "Paris",
            coordinate: CLLocationCoordinate2D(latitude: 48.8566, longitude: 2.3522)
        )

        let createExpectation = expectation(description: "unavailable trip creation")
        controller.createTripFromServer(draft) { result in
            guard case .failure(let error) = result else {
                XCTFail("An unavailable store must not create a local-only trip")
                createExpectation.fulfill()
                return
            }
            XCTAssertEqual(error.localizedDescription, "Native trip persistence is unavailable.")
            createExpectation.fulfill()
        }

        let updateExpectation = expectation(description: "unavailable trip update")
        controller.updateTripFromServer(id: "trip-1", draft: draft) { result in
            guard case .failure(let error) = result else {
                XCTFail("An unavailable store must not report a local-only update as successful")
                updateExpectation.fulfill()
                return
            }
            XCTAssertEqual(error.localizedDescription, "Native trip persistence is unavailable.")
            updateExpectation.fulfill()
        }

        wait(for: [createExpectation, updateExpectation], timeout: 1)
    }

    func testNativeImportCompletionReportsPlacesForWalletRefresh() {
        NativeTripStoreURLProtocol.handler = { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertTrue(request.value(forHTTPHeaderField: "Content-Type")?.contains("multipart/form-data") == true)
            let response = NativeTripStoreURLProtocol.response(for: request, statusCode: 200)
            let responseBody = """
            {"data":{"socialImport":{"status":"review","id":"import-1"},"extractedPlaces":[{"id":"place-1"},{"id":"place-2"}],"extractedPosts":[]}}
            """.data(using: .utf8)!
            return (response, responseBody)
        }
        defer { NativeTripStoreURLProtocol.handler = nil }

        let store = nativeTripStore()
        let expectation = expectation(description: "import completion")
        store.submitSocialImport(sourceURL: nil, rawText: "Reservation for Miami", imageData: nil) { result in
            guard case .success(let importResult) = result else {
                XCTFail("Expected import completion")
                expectation.fulfill()
                return
            }
            XCTAssertEqual(importResult.extractedPlaceCount, 2)
            XCTAssertEqual(importResult.status, "review")
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 2)
    }

    func testNativeWebRoutePolicyAllowsOnlySecondaryPages() {
        XCTAssertTrue(NativeWebRoutePolicy.allows("/dashboard/help"))
        XCTAssertTrue(NativeWebRoutePolicy.allows("/dashboard/imports/forward-reservation"))
        XCTAssertTrue(NativeWebRoutePolicy.allows("/dashboard/profile/stats"))
        XCTAssertTrue(NativeWebRoutePolicy.allows("/dashboard/account/profile"))
        XCTAssertTrue(NativeWebRoutePolicy.allows("/dashboard/account#deletion"))
        XCTAssertTrue(NativeWebRoutePolicy.allows("/dashboard/account#help"))
        XCTAssertTrue(NativeWebRoutePolicy.allows("/dashboard/account#membership"))
        XCTAssertTrue(NativeWebRoutePolicy.allows("/dashboard/account#preferences"))
        XCTAssertTrue(NativeWebRoutePolicy.allows("/dashboard/account#notifications"))
        XCTAssertTrue(NativeWebRoutePolicy.allows("/dashboard/account#sync"))
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
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "/dashboard/trips/trip-123/timeline"), .controlledWebView)
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "/dashboard/trips/trip-123/timeline#new-plan"), .controlledWebView)
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "/dashboard/trips/trip-123/documents"), .controlledWebView)
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "/dashboard/trips/trip-123/budget"), .controlledWebView)
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "/dashboard/trips/trip-123/flights"), .unavailable)
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "/dashboard/search"), .native)
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "/dashboard/account"), .native)
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "/dashboard/imports"), .controlledWebView)
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "/dashboard/profile/stats"), .controlledWebView)
        XCTAssertEqual(NativeWebRoutePolicy.owner(for: "/dashboard/account#deletion"), .controlledWebView)
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

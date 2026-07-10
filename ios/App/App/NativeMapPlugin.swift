import Capacitor
import CoreGraphics
import CoreLocation
import EventKit
import Foundation
import MapKit
import Network
import UIKit
import WebKit

@objc(NativeMapPlugin)
public class NativeMapPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeMapPlugin"
    public let jsName = "NativeMap"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]
    weak var mapGatewayPlugin: MapGatewayPlugin?

    @objc func open(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let options = (try? call.decode(NativeMapOptions.self)) ?? NativeMapOptions(trips: [])
            let mapViewController = NativeMapViewController(trips: options.trips) { [weak self] route in
                self?.openWebRoute(route)
            }
            self.mapGatewayPlugin?.attach(mapViewController)
            mapViewController.modalPresentationStyle = .fullScreen

            guard let presenter = self.bridge?.viewController else {
                call.reject("Unable to find presenting view controller")
                return
            }

            presenter.present(mapViewController, animated: true)
            call.resolve()
        }
    }

    private func openWebRoute(_ route: String) {
        guard let viewController = bridge?.viewController else { return }
        let escapedRoute = route
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        let script = "window.location.assign('\(escapedRoute)')"

        viewController.dismiss(animated: true) { [weak self] in
            self?.mapGatewayPlugin?.detachActiveMapController()
            self?.bridge?.webView?.evaluateJavaScript(script)
        }
    }
}

private struct NativeMapOptions: Decodable {
    let trips: [NativeMapTrip]

    init(trips: [NativeMapTrip]) {
        self.trips = trips
    }
}

enum NativeMapRouteStatus: String, Codable {
    case active
    case paused
    case completed
    case cancelled
}

struct NativeMapCoordinatePayload: Codable, Equatable {
    let lat: Double
    let lng: Double
}

struct NativeMapNamedCoordinatePayload: Codable, Equatable {
    let lat: Double
    let lng: Double
    let name: String
}

struct NativeMapTripPayload: Codable, Equatable {
    let tripId: String
    let origin: NativeMapNamedCoordinatePayload
    let destination: NativeMapNamedCoordinatePayload
}

struct NativeMapWalletPayload: Codable, Equatable {
    let passId: String
    let isPassInstalled: Bool
    let balance: String
    let currency: String
}

struct NativeMapCameraPayload: Codable, Equatable {
    let center: NativeMapCoordinatePayload
    let altitude: Double
    let pitch: Double
    let heading: Double
}

struct NativeMapSyncPayload: Codable, Equatable {
    let revisionId: Int64
    let routeId: String
    let status: NativeMapRouteStatus
    let trip: NativeMapTripPayload
    let wallet: NativeMapWalletPayload
    let camera: NativeMapCameraPayload

    init(
        revisionId: Int64,
        routeId: String,
        status: NativeMapRouteStatus,
        trip: NativeMapTripPayload,
        wallet: NativeMapWalletPayload,
        camera: NativeMapCameraPayload
    ) {
        self.revisionId = revisionId
        self.routeId = routeId
        self.status = status
        self.trip = trip
        self.wallet = wallet
        self.camera = camera
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        revisionId = try container.decode(Int64.self, forKey: .revisionId)
        routeId = try container.decode(String.self, forKey: .routeId)
        status = try container.decode(NativeMapRouteStatus.self, forKey: .status)
        trip = try container.decode(NativeMapTripPayload.self, forKey: .trip)
        wallet = try container.decode(NativeMapWalletPayload.self, forKey: .wallet)
        camera = try container.decode(NativeMapCameraPayload.self, forKey: .camera)

        guard revisionId >= 0, revisionId <= 9_007_199_254_740_991,
              isNonempty(routeId), isNonempty(trip.tripId),
              isValidCoordinate(lat: trip.origin.lat, lng: trip.origin.lng),
              isValidCoordinate(lat: trip.destination.lat, lng: trip.destination.lng),
              isNonempty(trip.origin.name), isNonempty(trip.destination.name),
              isNonempty(wallet.passId),
              wallet.balance.range(of: #"^\d+(?:\.\d{1,2})?$"#, options: .regularExpression) != nil,
              wallet.currency.range(of: #"^[A-Z]{3}$"#, options: .regularExpression) != nil,
              isValidCoordinate(lat: camera.center.lat, lng: camera.center.lng),
              camera.altitude.isFinite, camera.altitude >= 0,
              camera.pitch.isFinite, (0...180).contains(camera.pitch),
              camera.heading.isFinite, (0...360).contains(camera.heading) else {
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "Invalid native map synchronization payload.")
            )
        }
    }

    private func isNonempty(_ value: String) -> Bool {
        !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func isValidCoordinate(lat: Double, lng: Double) -> Bool {
        lat.isFinite && lng.isFinite && (-90...90).contains(lat) && (-180...180).contains(lng)
    }
}

struct NativeMapRevisionGate {
    private(set) var latestRevisionId: Int64?

    mutating func accept(_ payload: NativeMapSyncPayload) -> Bool {
        if let latestRevisionId, payload.revisionId <= latestRevisionId {
            return false
        }

        latestRevisionId = payload.revisionId
        return true
    }
}

private struct NativeMapInteractiveRegionPayload: Decodable {
    let regions: [NativeMapInteractiveRegion]
}

private struct NativeMapInteractiveRegion: Decodable {
    let x: CGFloat
    let y: CGFloat
    let width: CGFloat
    let height: CGFloat

    var rect: CGRect {
        CGRect(x: x, y: y, width: width, height: height)
    }
}

private final class NativeMapTouchForwardingView: UIView {
    weak var mapView: MKMapView?
    var excludedRegions: [CGRect] = []

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        isUserInteractionEnabled = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("NativeMapTouchForwardingView does not support storyboard initialization.")
    }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        guard bounds.contains(point) else { return false }
        return !excludedRegions.contains { $0.insetBy(dx: -8, dy: -8).contains(point) }
    }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard self.point(inside: point, with: event), let mapView else { return nil }
        let mapPoint = convert(point, to: mapView)
        return mapView.hitTest(mapPoint, with: event) ?? mapView
    }
}

@objc(MapGatewayPlugin)
public final class MapGatewayPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MapGatewayPlugin"
    public let jsName = "MapGateway"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initializeNativeMapUnderlay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setNativeMapInteractiveRegions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncPayloadToNative", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "acknowledgeReceipt", returnType: CAPPluginReturnPromise)
    ]

    private let stateQueue = DispatchQueue(label: "app.almidy.map-gateway.state")
    private var revisionGate = NativeMapRevisionGate()
    private var cachedPayload: NativeMapSyncPayload?
    private var cachedPayloadJson: String?
    private var lastAcknowledgedRevisionId: Int64?
    private weak var activeMapController: NativeMapViewController?
    private weak var nativeMapUnderlay: MKMapView?
    private weak var nativeMapHostView: UIView?
    private weak var nativeMapTouchForwarder: NativeMapTouchForwardingView?
    private var nativeMapInteractiveRegions: [CGRect] = []

    @objc func initializeNativeMapUnderlay(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self,
                  let bridge = self.bridge,
                  let webView = bridge.webView,
                  let rootView = bridge.viewController?.view else {
                call.reject("Unable to initialize the native map underlay.", "native_map_underlay_unavailable")
                return
            }

            // Keep the map in the same hit-test tree as the WebView. This lets
            // the forwarding view return MapKit's own gesture target directly.
            let mapHostView = rootView
            mapHostView.backgroundColor = .clear
            rootView.backgroundColor = .clear
            self.makeSubviewsTransparent(view: rootView)
            webView.isOpaque = false
            webView.backgroundColor = .clear
            webView.scrollView.isOpaque = false
            webView.scrollView.backgroundColor = .clear

            rootView.setNeedsLayout()
            rootView.layoutIfNeeded()

            let mapView: MKMapView
            if let nativeMapUnderlay = self.nativeMapUnderlay {
                mapView = nativeMapUnderlay
                if mapView.superview !== mapHostView {
                    self.attachNativeUnderlay(mapView, to: mapHostView)
                }
            } else {
                mapView = self.makeNativeUnderlayMap(frame: mapHostView.bounds)
                self.attachNativeUnderlay(mapView, to: mapHostView)
                self.nativeMapUnderlay = mapView
            }
            self.nativeMapHostView = mapHostView
            self.installNativeMapTouchForwarder(in: rootView, webView: webView, mapView: mapView)

            mapHostView.sendSubviewToBack(mapView)
            mapHostView.setNeedsLayout()
            mapHostView.layoutIfNeeded()
            rootView.setNeedsLayout()
            rootView.layoutIfNeeded()
            mapView.setNeedsLayout()
            mapView.layoutIfNeeded()
            if let payload = self.stateQueue.sync(execute: { self.cachedPayload }) {
                mapView.setCamera(self.mapCamera(from: payload.camera), animated: false)
            }
            let resolvedSize = self.resolvedUnderlaySize(for: mapView, in: mapHostView)
            call.resolve([
                "success": mapView.superview === mapHostView,
                "height": resolvedSize.height,
                "width": resolvedSize.width
            ])
        }
    }

    @objc func syncPayloadToNative(_ call: CAPPluginCall) {
        guard let jsonString = call.getString("jsonString"),
              let payload = decodePayload(jsonString) else {
            call.reject("Malformed native map synchronization payload.", "invalid_map_sync_payload")
            return
        }

        guard accept(payload, jsonString: jsonString) else {
            call.resolve(["success": false, "reason": "Stale revision ignored"])
            return
        }

        applyCamera(payload.camera)
        call.resolve(["success": true])
    }

    @objc func setNativeMapInteractiveRegions(_ call: CAPPluginCall) {
        guard let jsonString = call.getString("jsonString"),
              let data = jsonString.data(using: .utf8),
              let payload = try? JSONDecoder().decode(NativeMapInteractiveRegionPayload.self, from: data) else {
            call.reject("Malformed native map interactive region payload.", "invalid_native_map_interactive_regions")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.nativeMapInteractiveRegions = payload.regions.map(\.rect)
            self.updateNativeMapTouchExclusions()
            call.resolve(["success": true])
        }
    }

    @objc func acknowledgeReceipt(_ call: CAPPluginCall) {
        guard let revisionValue = call.getInt("revisionId") else {
            call.reject("Synchronization acknowledgment requires a revision ID.", "missing_revision_id")
            return
        }

        let revisionId = Int64(revisionValue)
        stateQueue.sync {
            if let lastAcknowledgedRevisionId, revisionId <= lastAcknowledgedRevisionId {
                return
            } else {
                lastAcknowledgedRevisionId = revisionId
            }
        }
        call.resolve()
    }

    public func broadcastStateToWeb(updatedJsonPayload: String) {
        guard let payload = decodePayload(updatedJsonPayload),
              accept(payload, jsonString: updatedJsonPayload) else {
            return
        }

        DispatchQueue.main.async { [weak self] in
            self?.notifyListeners("onNativeStateSync", data: ["jsonString": updatedJsonPayload])
        }
    }

    func attach(_ controller: NativeMapViewController) {
        activeMapController = controller
        let payload = stateQueue.sync { cachedPayload }
        if let payload {
            applyCamera(payload.camera)
        }
    }

    func detachActiveMapController() {
        activeMapController = nil
    }

    private func decodePayload(_ jsonString: String) -> NativeMapSyncPayload? {
        guard let data = jsonString.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(NativeMapSyncPayload.self, from: data)
    }

    private func accept(_ payload: NativeMapSyncPayload, jsonString: String) -> Bool {
        stateQueue.sync {
            guard revisionGate.accept(payload) else { return false }
            cachedPayload = payload
            cachedPayloadJson = jsonString
            return true
        }
    }

    private func applyCamera(_ cameraPayload: NativeMapCameraPayload) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            let camera = self.mapCamera(from: cameraPayload)
            self.activeMapController?.applyCameraTelemetry(camera)
            self.nativeMapUnderlay?.setCamera(camera, animated: true)
        }
    }

    private func configureNativeUnderlayPresentation(_ mapView: MKMapView) {
        mapView.mapType = .hybridFlyover
        mapView.cameraZoomRange = MKMapView.CameraZoomRange(
            minCenterCoordinateDistance: 500,
            maxCenterCoordinateDistance: 30_000_000
        )
    }

    private func makeNativeUnderlayMap(frame: CGRect) -> MKMapView {
        let mapView = MKMapView(frame: frame)
        mapView.isPitchEnabled = true
        mapView.isRotateEnabled = true
        mapView.isScrollEnabled = true
        mapView.isZoomEnabled = true
        configureNativeUnderlayPresentation(mapView)
        mapView.setCamera(nativeUnderlayGlobeCamera(), animated: false)
        return mapView
    }

    private func attachNativeUnderlay(_ mapView: MKMapView, to hostView: UIView) {
        mapView.removeFromSuperview()
        mapView.translatesAutoresizingMaskIntoConstraints = false
        hostView.insertSubview(mapView, at: 0)
        NSLayoutConstraint.activate([
            mapView.topAnchor.constraint(equalTo: hostView.topAnchor),
            mapView.leadingAnchor.constraint(equalTo: hostView.leadingAnchor),
            mapView.trailingAnchor.constraint(equalTo: hostView.trailingAnchor),
            mapView.bottomAnchor.constraint(equalTo: hostView.bottomAnchor)
        ])
        hostView.setNeedsLayout()
        hostView.layoutIfNeeded()
    }

    private func installNativeMapTouchForwarder(in rootView: UIView, webView: WKWebView, mapView: MKMapView) {
        let forwarder: NativeMapTouchForwardingView
        if let nativeMapTouchForwarder {
            forwarder = nativeMapTouchForwarder
        } else {
            forwarder = NativeMapTouchForwardingView(frame: rootView.bounds)
            forwarder.translatesAutoresizingMaskIntoConstraints = false
            forwarder.backgroundColor = .clear
            forwarder.isOpaque = false
            forwarder.isAccessibilityElement = false
            rootView.addSubview(forwarder)
            NSLayoutConstraint.activate([
                forwarder.topAnchor.constraint(equalTo: rootView.topAnchor),
                forwarder.leadingAnchor.constraint(equalTo: rootView.leadingAnchor),
                forwarder.trailingAnchor.constraint(equalTo: rootView.trailingAnchor),
                forwarder.bottomAnchor.constraint(equalTo: rootView.bottomAnchor)
            ])
            nativeMapTouchForwarder = forwarder
        }

        forwarder.mapView = mapView
        rootView.bringSubviewToFront(forwarder)
        updateNativeMapTouchExclusions(webView: webView)
    }

    private func updateNativeMapTouchExclusions(webView: WKWebView? = nil) {
        guard let forwarder = nativeMapTouchForwarder,
              let webView = webView ?? bridge?.webView else { return }
        // DOM rects are viewport coordinates. Keep both the direct root-space
        // rect and UIKit's converted rect because Capacitor can inset the
        // WKWebView independently during safe-area/layout transitions.
        forwarder.excludedRegions = nativeMapInteractiveRegions.flatMap { region in
            [region, webView.convert(region, to: forwarder)]
        }
    }

    private func resolvedUnderlaySize(for mapView: MKMapView, in rootView: UIView) -> CGSize {
        if mapView.bounds.width > 0, mapView.bounds.height > 0 {
            return mapView.bounds.size
        }

        if rootView.bounds.width > 0, rootView.bounds.height > 0 {
            return rootView.bounds.size
        }

        return UIScreen.main.bounds.size
    }

    private func nativeUnderlayGlobeCamera() -> MKMapCamera {
        MKMapCamera(
            lookingAtCenter: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
            fromDistance: 24_000_000,
            pitch: 0,
            heading: 0
        )
    }

    private func mapCamera(from payload: NativeMapCameraPayload) -> MKMapCamera {
        MKMapCamera(
            lookingAtCenter: CLLocationCoordinate2D(
                latitude: payload.center.lat,
                longitude: payload.center.lng
            ),
            fromDistance: payload.altitude,
            pitch: payload.pitch,
            heading: payload.heading
        )
    }

    private func makeSubviewsTransparent(view: UIView) {
        guard !(view is MKMapView) else { return }

        view.isOpaque = false
        view.backgroundColor = .clear
        for subview in view.subviews {
            makeSubviewsTransparent(view: subview)
        }
    }

#if DEBUG
    func makeNativeUnderlayMapForTesting() -> MKMapView {
        makeNativeUnderlayMap(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
    }

    func makeSubviewsTransparentForTesting(view: UIView) {
        makeSubviewsTransparent(view: view)
    }

    func attachNativeUnderlayForTesting(to rootView: UIView) -> MKMapView {
        let mapView = makeNativeUnderlayMap(frame: rootView.bounds)
        attachNativeUnderlay(mapView, to: rootView)
        return mapView
    }

    func nativeMapTouchTargetForTesting(
        mapView: MKMapView,
        frame: CGRect,
        excludedRegions: [CGRect],
        point: CGPoint
    ) -> UIView? {
        let forwarder = NativeMapTouchForwardingView(frame: frame)
        forwarder.mapView = mapView
        forwarder.excludedRegions = excludedRegions
        return forwarder.hitTest(point, with: nil)
    }

    func resolvedUnderlaySizeForTesting(mapView: MKMapView, rootView: UIView) -> CGSize {
        resolvedUnderlaySize(for: mapView, in: rootView)
    }
#endif
}

@objc(AppleCalendarPlugin)
public class AppleCalendarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleCalendarPlugin"
    public let jsName = "AppleCalendar"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestCalendarAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCalendarAuthorizationStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listCalendars", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createTripCalendarEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateTripCalendarEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteTripCalendarEvent", returnType: CAPPluginReturnPromise)
    ]

    private let eventStore = EKEventStore()
    private let isoDateFormatter = ISO8601DateFormatter()

    public override init() {
        super.init()
        isoDateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    }

    @objc func getCalendarAuthorizationStatus(_ call: CAPPluginCall) {
        call.resolve(["status": currentAuthorizationStatusString()])
    }

    @objc func requestCalendarAccess(_ call: CAPPluginCall) {
        if #available(iOS 17.0, *) {
            eventStore.requestFullAccessToEvents { [weak self] granted, error in
                self?.resolveAccessRequest(call, granted: granted, error: error)
            }
        } else {
            eventStore.requestAccess(to: .event) { [weak self] granted, error in
                self?.resolveAccessRequest(call, granted: granted, error: error)
            }
        }
    }

    @objc func listCalendars(_ call: CAPPluginCall) {
        guard hasFullCalendarAccess else {
            call.reject("Apple Calendar full access is required to list calendars.", "calendar_access_required")
            return
        }

        call.resolve([
            "calendars": eventStore.calendars(for: .event)
                .filter { $0.allowsContentModifications }
                .map(calendarPayload),
            "status": currentAuthorizationStatusString()
        ])
    }

    @objc func createTripCalendarEvent(_ call: CAPPluginCall) {
        guard hasFullCalendarAccess else {
            call.reject("Apple Calendar access is required to create events.", "calendar_access_required")
            return
        }

        do {
            let payload = try calendarEventPayload(from: call)
            let event = EKEvent(eventStore: eventStore)
            try apply(payload, to: event)
            try save(event)
            call.resolve(eventPayload(event))
        } catch {
            call.reject(error.localizedDescription, "apple_calendar_create_failed")
        }
    }

    @objc func updateTripCalendarEvent(_ call: CAPPluginCall) {
        guard hasFullCalendarAccess else {
            call.reject("Apple Calendar access is required to update events.", "calendar_access_required")
            return
        }

        do {
            let payload = try calendarEventPayload(from: call)
            let event = findExistingEvent(for: payload) ?? EKEvent(eventStore: eventStore)
            try apply(payload, to: event)
            try save(event)
            call.resolve(eventPayload(event, recovered: payload.eventIdentifier != nil && event.eventIdentifier != payload.eventIdentifier))
        } catch {
            call.reject(error.localizedDescription, "apple_calendar_update_failed")
        }
    }

    @objc func deleteTripCalendarEvent(_ call: CAPPluginCall) {
        guard hasFullCalendarAccess else {
            call.reject("Apple Calendar access is required to delete events.", "calendar_access_required")
            return
        }

        let identity = CalendarEventIdentity(
            eventIdentifier: clean(call.getString("eventIdentifier")),
            calendarItemIdentifier: clean(call.getString("calendarItemIdentifier")),
            almidyId: clean(call.getString("almidyId")) ?? clean(call.getString("tripId")) ?? clean(call.getString("segmentId")),
            startDate: parseDate(call.getString("startDate")),
            endDate: parseDate(call.getString("endDate")),
            title: clean(call.getString("title"))
        )

        guard let event = findExistingEvent(for: identity) else {
            call.resolve([
                "deleted": false,
                "status": currentAuthorizationStatusString()
            ])
            return
        }

        do {
            try eventStore.remove(event, span: .thisEvent, commit: true)
            call.resolve([
                "deleted": true,
                "eventIdentifier": event.eventIdentifier as Any,
                "calendarItemIdentifier": event.calendarItemIdentifier,
                "status": currentAuthorizationStatusString()
            ])
        } catch {
            call.reject(error.localizedDescription, "apple_calendar_delete_failed")
        }
    }

    private func resolveAccessRequest(_ call: CAPPluginCall, granted: Bool, error: Error?) {
        DispatchQueue.main.async { [weak self] in
            if let error {
                call.reject(error.localizedDescription, "apple_calendar_access_failed")
                return
            }

            call.resolve([
                "granted": granted,
                "status": self?.currentAuthorizationStatusString() ?? "unknown"
            ])
        }
    }

    private var hasFullCalendarAccess: Bool {
        let status = EKEventStore.authorizationStatus(for: .event)
        if #available(iOS 17.0, *) {
            return status == .fullAccess
        }
        return status == .authorized
    }

    private func currentAuthorizationStatusString() -> String {
        let status = EKEventStore.authorizationStatus(for: .event)
        if #available(iOS 17.0, *) {
            switch status {
            case .notDetermined:
                return "notDetermined"
            case .restricted:
                return "restricted"
            case .denied:
                return "denied"
            case .authorized, .fullAccess:
                return "authorized"
            case .writeOnly:
                return "writeOnly"
            @unknown default:
                return "unknown"
            }
        }

        switch status {
        case .notDetermined:
            return "notDetermined"
        case .restricted:
            return "restricted"
        case .denied:
            return "denied"
        case .authorized:
            return "authorized"
        @unknown default:
            return "unknown"
        }
    }

    private func calendarEventPayload(from call: CAPPluginCall) throws -> CalendarEventPayload {
        guard let title = clean(call.getString("title")) ?? clean(call.getString("tripName")) else {
            throw AppleCalendarError.invalidPayload("Missing event title.")
        }

        guard let startDate = parseDate(call.getString("startDate")) else {
            throw AppleCalendarError.invalidPayload("Missing or invalid startDate.")
        }

        let allDay = call.getBool("allDay") ?? isDateOnly(call.getString("startDate"))
        let endDate = parseDate(call.getString("endDate")) ?? defaultEndDate(for: startDate, allDay: allDay)

        guard endDate > startDate else {
            throw AppleCalendarError.invalidPayload("endDate must be after startDate.")
        }

        return CalendarEventPayload(
            title: title,
            startDate: startDate,
            endDate: endDate,
            allDay: allDay,
            calendarId: clean(call.getString("calendarId")),
            location: clean(call.getString("location")),
            notes: clean(call.getString("notes")),
            url: parseURL(call.getString("url")),
            eventIdentifier: clean(call.getString("eventIdentifier")),
            calendarItemIdentifier: clean(call.getString("calendarItemIdentifier")),
            almidyId: clean(call.getString("almidyId")) ?? clean(call.getString("tripId")) ?? clean(call.getString("segmentId")),
            tripId: clean(call.getString("tripId")),
            segmentId: clean(call.getString("segmentId"))
        )
    }

    private func apply(_ payload: CalendarEventPayload, to event: EKEvent) throws {
        event.title = payload.title
        event.startDate = payload.startDate
        event.endDate = payload.endDate
        event.isAllDay = payload.allDay
        event.location = payload.location
        event.notes = notesWithMetadata(payload)
        event.url = payload.url
        event.calendar = try selectedCalendar(calendarId: payload.calendarId)
    }

    private func save(_ event: EKEvent) throws {
        do {
            try eventStore.save(event, span: .thisEvent, commit: true)
        } catch {
            eventStore.reset()
            throw error
        }
    }

    private func selectedCalendar(calendarId: String?) throws -> EKCalendar {
        if let calendarId, let calendar = eventStore.calendar(withIdentifier: calendarId), calendar.allowsContentModifications {
            return calendar
        }

        if let defaultCalendar = eventStore.defaultCalendarForNewEvents, defaultCalendar.allowsContentModifications {
            return defaultCalendar
        }

        guard let firstWritable = eventStore.calendars(for: .event).first(where: { $0.allowsContentModifications }) else {
            throw AppleCalendarError.noWritableCalendars
        }

        return firstWritable
    }

    private func findExistingEvent(for payload: CalendarEventPayload) -> EKEvent? {
        findExistingEvent(
            for: CalendarEventIdentity(
                eventIdentifier: payload.eventIdentifier,
                calendarItemIdentifier: payload.calendarItemIdentifier,
                almidyId: payload.almidyId,
                startDate: payload.startDate,
                endDate: payload.endDate,
                title: payload.title
            )
        )
    }

    private func findExistingEvent(for identity: CalendarEventIdentity) -> EKEvent? {
        if let eventIdentifier = identity.eventIdentifier,
           let event = eventStore.event(withIdentifier: eventIdentifier) {
            return event
        }

        let searchStart = Calendar.current.date(byAdding: .day, value: -7, to: identity.startDate ?? Date()) ?? Date()
        let searchEnd = Calendar.current.date(byAdding: .day, value: 7, to: identity.endDate ?? identity.startDate ?? Date()) ?? Date()
        let predicate = eventStore.predicateForEvents(withStart: searchStart, end: searchEnd, calendars: nil)

        return eventStore.events(matching: predicate).first { event in
            if let calendarItemIdentifier = identity.calendarItemIdentifier,
               event.calendarItemIdentifier == calendarItemIdentifier {
                return true
            }

            if let almidyId = identity.almidyId,
               event.notes?.contains(metadataLine(key: "Almidy ID", value: almidyId)) == true {
                return true
            }

            if let title = identity.title, let startDate = identity.startDate {
                return event.title == title && abs(event.startDate.timeIntervalSince(startDate)) < 60
            }

            return false
        }
    }

    private func eventPayload(_ event: EKEvent, recovered: Bool = false) -> [String: Any] {
        [
            "eventIdentifier": event.eventIdentifier as Any,
            "calendarItemIdentifier": event.calendarItemIdentifier,
            "calendarId": event.calendar.calendarIdentifier,
            "calendarTitle": event.calendar.title,
            "startDate": formatDate(event.startDate),
            "endDate": formatDate(event.endDate),
            "allDay": event.isAllDay,
            "recovered": recovered,
            "status": currentAuthorizationStatusString()
        ]
    }

    private func calendarPayload(_ calendar: EKCalendar) -> [String: Any] {
        [
            "id": calendar.calendarIdentifier,
            "title": calendar.title,
            "sourceTitle": calendar.source.title,
            "allowsContentModifications": calendar.allowsContentModifications,
            "color": calendar.cgColor?.hexString ?? ""
        ]
    }

    private func notesWithMetadata(_ payload: CalendarEventPayload) -> String {
        var lines: [String] = []
        if let notes = payload.notes {
            lines.append(notes)
            lines.append("")
        }

        lines.append("Created by Almidy")
        if let almidyId = payload.almidyId {
            lines.append(metadataLine(key: "Almidy ID", value: almidyId))
        }
        if let tripId = payload.tripId {
            lines.append(metadataLine(key: "Almidy Trip ID", value: tripId))
        }
        if let segmentId = payload.segmentId {
            lines.append(metadataLine(key: "Almidy Segment ID", value: segmentId))
        }

        return lines.joined(separator: "\n")
    }

    private func metadataLine(key: String, value: String) -> String {
        "\(key): \(value)"
    }

    private func parseDate(_ value: String?) -> Date? {
        guard let value = clean(value) else { return nil }

        if let date = isoDateFormatter.date(from: value) {
            return date
        }

        let fallbackFormatter = ISO8601DateFormatter()
        fallbackFormatter.formatOptions = [.withInternetDateTime]
        if let date = fallbackFormatter.date(from: value) {
            return date
        }

        if isDateOnly(value) {
            let formatter = DateFormatter()
            formatter.calendar = Calendar(identifier: .gregorian)
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(secondsFromGMT: 0)
            formatter.dateFormat = "yyyy-MM-dd"
            return formatter.date(from: value)
        }

        return nil
    }

    private func formatDate(_ date: Date) -> String {
        isoDateFormatter.string(from: date)
    }

    private func defaultEndDate(for startDate: Date, allDay: Bool) -> Date {
        Calendar.current.date(byAdding: allDay ? .day : .hour, value: 1, to: startDate) ?? startDate.addingTimeInterval(allDay ? 86_400 : 3_600)
    }

    private func isDateOnly(_ value: String?) -> Bool {
        guard let value else { return false }
        return value.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil
    }

    private func parseURL(_ value: String?) -> URL? {
        guard let value = clean(value) else { return nil }
        return URL(string: value)
    }

    private func clean(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
            return nil
        }
        return trimmed
    }
}

private struct CalendarEventPayload {
    let title: String
    let startDate: Date
    let endDate: Date
    let allDay: Bool
    let calendarId: String?
    let location: String?
    let notes: String?
    let url: URL?
    let eventIdentifier: String?
    let calendarItemIdentifier: String?
    let almidyId: String?
    let tripId: String?
    let segmentId: String?
}

private struct CalendarEventIdentity {
    let eventIdentifier: String?
    let calendarItemIdentifier: String?
    let almidyId: String?
    let startDate: Date?
    let endDate: Date?
    let title: String?
}

private enum AppleCalendarError: LocalizedError {
    case invalidPayload(String)
    case noWritableCalendars

    var errorDescription: String? {
        switch self {
        case .invalidPayload(let message):
            return message
        case .noWritableCalendars:
            return "No writable Apple calendars are available on this device."
        }
    }
}

private extension CGColor {
    var hexString: String? {
        guard let components = converted(to: CGColorSpaceCreateDeviceRGB(), intent: .defaultIntent, options: nil)?.components,
              components.count >= 3 else {
            return nil
        }

        let red = Int(round(components[0] * 255))
        let green = Int(round(components[1] * 255))
        let blue = Int(round(components[2] * 255))
        return String(format: "#%02X%02X%02X", red, green, blue)
    }
}

struct NativeMapTrip: Decodable {
    let dateRange: String?
    let destination: String?
    let href: String?
    let id: String
    let imageUrl: String?
    let latitude: Double?
    let longitude: Double?
    let name: String?
    let status: String?

    var displayName: String {
        clean(name) ?? clean(destination) ?? "Untitled trip"
    }

    var displayDateRange: String {
        clean(dateRange) ?? "Dates not set"
    }

    var displayStatus: String {
        clean(status) ?? "Planning"
    }

    var route: String {
        clean(href) ?? "/dashboard/trips/\(id)"
    }

    var coordinate: CLLocationCoordinate2D? {
        guard let latitude, let longitude else { return nil }
        guard CLLocationCoordinate2DIsValid(CLLocationCoordinate2D(latitude: latitude, longitude: longitude)) else { return nil }
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

final class NativeMapViewController: UIViewController, CLLocationManagerDelegate, MKMapViewDelegate {
    private enum SheetState: CaseIterable {
        case collapsed
        case medium
        case expanded
    }

    private enum MapPresentationMode {
        case hybrid
        case imagery
        case standard
    }

    private enum MapFallbackReason {
        case offline
        case serviceUnavailable
    }

    private let mapView = MKMapView()
    private let locationManager = CLLocationManager()
    private let networkMonitor = NWPathMonitor()
    private let networkMonitorQueue = DispatchQueue(label: "app.almidy.native-map.network-monitor", qos: .utility)
    private let monitorsNetworkConnectivity: Bool
    private let trips: [NativeMapTrip]
    private let openRoute: (String) -> Void
    private let sheetView = UIView()
    private let sheetHandle = UIView()
    private let headerStack = UIStackView()
    private let titleButton = UIButton(type: .system)
    private let chevronImageView = UIImageView(image: UIImage(systemName: "chevron.down"))
    private let settingsButton = UIButton(type: .system)
    private let collapsedActions = UIStackView()
    private let expandedScrollView = UIScrollView()
    private let expandedContentStack = UIStackView()
    private let mapControlStack = UIStackView()
    private var sheetBottomConstraint: NSLayoutConstraint?
    private var sheetHeightConstraint: NSLayoutConstraint?
    private var sheetState: SheetState
    private var panStartHeight: CGFloat = 0
    private var hasPlayedIntroCamera = false
    private var isConnected: Bool?
    private var isNetworkMonitorRunning = false
    private var mapPresentationMode: MapPresentationMode = .hybrid
    private var mapFallbackReason: MapFallbackReason?
    private var offlineOverlayView: UIView?
    private weak var offlineRetryButton: UIButton?
    private var pendingCameraTelemetry: MKMapCamera?
    private var preservedCamera: MKMapCamera?
    private var isRequestingLocationAuthorization = false
    private var reservationCardVisible = !UserDefaults.standard.bool(forKey: "almidy.native.reservationCardDismissed")

    init(
        trips: [NativeMapTrip],
        monitorsNetworkConnectivity: Bool = true,
        openRoute: @escaping (String) -> Void
    ) {
        self.trips = trips
        self.monitorsNetworkConnectivity = monitorsNetworkConnectivity
        self.openRoute = openRoute
        self.sheetState = trips.isEmpty ? .medium : .collapsed
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        configureMap()
        configureMapControls()
        configureSheet()
        renderSheetContent()
        addTripPins()
        applySheetState(sheetState, animated: false)
        if monitorsNetworkConnectivity {
            startNetworkMonitoring()
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        playIntroCameraIfNeeded()
    }

    deinit {
        networkMonitor.pathUpdateHandler = nil
        networkMonitor.cancel()
    }

    private func configureMap() {
        mapView.translatesAutoresizingMaskIntoConstraints = false
        mapView.delegate = self
        mapView.pointOfInterestFilter = .includingAll
        mapView.showsCompass = false
        mapView.showsScale = false
        mapView.showsBuildings = true
        mapView.showsTraffic = false
        mapView.showsUserLocation = false
        mapView.isScrollEnabled = true
        mapView.isZoomEnabled = true
        mapView.isRotateEnabled = true
        mapView.isPitchEnabled = true
        mapView.isMultipleTouchEnabled = true
        if #available(iOS 11.0, *) {
            mapView.insetsLayoutMarginsFromSafeArea = false
        }
        if #available(iOS 13.0, *) {
            mapView.setCameraZoomRange(MKMapView.CameraZoomRange(minCenterCoordinateDistance: 900, maxCenterCoordinateDistance: 20_000_000), animated: false)
        }
        applyMapPresentation(.hybrid)
        view.addSubview(mapView)

        NSLayoutConstraint.activate([
            mapView.topAnchor.constraint(equalTo: view.topAnchor),
            mapView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            mapView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            mapView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        mapView.setCamera(globeCamera(distance: 10_000_000, heading: 0), animated: false)
        if let pendingCameraTelemetry {
            applyCameraTelemetry(pendingCameraTelemetry)
            self.pendingCameraTelemetry = nil
        }
    }

    private func playIntroCameraIfNeeded() {
        guard !hasPlayedIntroCamera else { return }
        hasPlayedIntroCamera = true

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
            guard let self else { return }
            self.mapView.setCamera(self.globeCamera(distance: 7_800_000, heading: 2), animated: true)
        }
    }

    private func globeCamera(distance: CLLocationDistance, heading: CLLocationDirection) -> MKMapCamera {
        MKMapCamera(
            lookingAtCenter: CLLocationCoordinate2D(latitude: 42.5, longitude: -96.0),
            fromDistance: distance,
            pitch: 0,
            heading: heading
        )
    }

    func applyCameraTelemetry(_ camera: MKMapCamera) {
        hasPlayedIntroCamera = true
        preservedCamera = camera.copy() as? MKMapCamera ?? camera

        guard isViewLoaded else {
            pendingCameraTelemetry = preservedCamera
            return
        }

        guard mapFallbackReason == nil else { return }
        mapView.setCamera(camera, animated: true)
    }

    private func applyMapPresentation(_ mode: MapPresentationMode) {
        mapPresentationMode = mode
        if #available(iOS 16.0, *) {
            switch mode {
            case .hybrid:
                let configuration = MKHybridMapConfiguration(elevationStyle: .realistic)
                configuration.pointOfInterestFilter = .includingAll
                configuration.showsTraffic = false
                mapView.preferredConfiguration = configuration
            case .imagery:
                mapView.preferredConfiguration = MKImageryMapConfiguration(elevationStyle: .realistic)
            case .standard:
                let configuration = MKStandardMapConfiguration(elevationStyle: .realistic, emphasisStyle: .default)
                configuration.pointOfInterestFilter = .includingAll
                configuration.showsTraffic = false
                mapView.preferredConfiguration = configuration
            }
        } else {
            switch mode {
            case .hybrid:
                mapView.mapType = .hybridFlyover
            case .imagery:
                mapView.mapType = .satelliteFlyover
            case .standard:
                mapView.mapType = .standard
            }
        }
    }

    private func startNetworkMonitoring() {
        guard !isNetworkMonitorRunning else { return }
        isNetworkMonitorRunning = true

        networkMonitor.pathUpdateHandler = { [weak self] path in
            let activeConnection = path.status == .satisfied

            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                let previousConnection = self.isConnected
                self.isConnected = activeConnection

                if activeConnection {
                    if previousConnection == false || self.mapFallbackReason == .offline {
                        self.restoreOnlineMap()
                    }
                } else if previousConnection != false {
                    self.showMapFallback(reason: .offline)
                }
            }
        }
        networkMonitor.start(queue: networkMonitorQueue)
    }

    private func showMapFallback(reason: MapFallbackReason) {
        mapFallbackReason = reason
        preservedCamera = mapView.camera.copy() as? MKMapCamera ?? mapView.camera
        mapControlStack.isUserInteractionEnabled = false
        mapControlStack.alpha = 0.46

        if offlineOverlayView != nil {
            updateMapFallbackCopy(reason: reason)
            return
        }

        let overlay = UIView()
        overlay.translatesAutoresizingMaskIntoConstraints = false
        overlay.backgroundColor = UIColor(red: 0.02, green: 0.035, blue: 0.055, alpha: 0.96)
        overlay.alpha = 0
        overlay.accessibilityViewIsModal = false

        let globeImageView = UIImageView(image: UIImage(named: "AlmidyOfflineGlobe") ?? UIImage(systemName: "globe.americas.fill"))
        globeImageView.contentMode = .scaleAspectFit
        globeImageView.tintColor = UIColor(red: 0.3, green: 0.66, blue: 0.92, alpha: 1)
        globeImageView.translatesAutoresizingMaskIntoConstraints = false
        globeImageView.accessibilityElementsHidden = true

        let statusImageView = UIImageView(image: UIImage(systemName: reason == .offline ? "wifi.slash" : "exclamationmark.triangle"))
        statusImageView.contentMode = .scaleAspectFit
        statusImageView.tintColor = .white
        statusImageView.translatesAutoresizingMaskIntoConstraints = false
        statusImageView.accessibilityElementsHidden = true

        let titleLabel = UILabel()
        titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.accessibilityTraits = .header
        titleLabel.tag = 4101

        let descriptionLabel = UILabel()
        descriptionLabel.font = .systemFont(ofSize: 14, weight: .regular)
        descriptionLabel.textColor = UIColor.white.withAlphaComponent(0.68)
        descriptionLabel.numberOfLines = 0
        descriptionLabel.textAlignment = .center
        descriptionLabel.translatesAutoresizingMaskIntoConstraints = false
        descriptionLabel.tag = 4102

        let retryButton = UIButton(type: .system)
        var retryConfiguration = UIButton.Configuration.filled()
        retryConfiguration.title = "Try again"
        retryConfiguration.image = UIImage(systemName: "arrow.clockwise")
        retryConfiguration.imagePadding = 8
        retryConfiguration.baseBackgroundColor = .white
        retryConfiguration.baseForegroundColor = .black
        retryConfiguration.cornerStyle = .capsule
        retryButton.configuration = retryConfiguration
        retryButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .bold)
        retryButton.translatesAutoresizingMaskIntoConstraints = false
        retryButton.addTarget(self, action: #selector(triggerManualMapRetry), for: .touchUpInside)

        overlay.addSubview(globeImageView)
        overlay.addSubview(statusImageView)
        overlay.addSubview(titleLabel)
        overlay.addSubview(descriptionLabel)
        overlay.addSubview(retryButton)
        view.insertSubview(overlay, aboveSubview: mapView)

        NSLayoutConstraint.activate([
            overlay.topAnchor.constraint(equalTo: view.topAnchor),
            overlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            overlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            overlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            globeImageView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 28),
            globeImageView.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            globeImageView.widthAnchor.constraint(equalTo: overlay.widthAnchor, multiplier: 0.82),
            globeImageView.heightAnchor.constraint(equalTo: globeImageView.widthAnchor, multiplier: 0.68),

            statusImageView.topAnchor.constraint(equalTo: globeImageView.bottomAnchor, constant: -10),
            statusImageView.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            statusImageView.widthAnchor.constraint(equalToConstant: 28),
            statusImageView.heightAnchor.constraint(equalToConstant: 28),

            titleLabel.topAnchor.constraint(equalTo: statusImageView.bottomAnchor, constant: 12),
            titleLabel.leadingAnchor.constraint(equalTo: overlay.leadingAnchor, constant: 32),
            titleLabel.trailingAnchor.constraint(equalTo: overlay.trailingAnchor, constant: -32),

            descriptionLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            descriptionLabel.leadingAnchor.constraint(equalTo: overlay.leadingAnchor, constant: 32),
            descriptionLabel.trailingAnchor.constraint(equalTo: overlay.trailingAnchor, constant: -32),

            retryButton.topAnchor.constraint(equalTo: descriptionLabel.bottomAnchor, constant: 18),
            retryButton.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            retryButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44)
        ])

        offlineOverlayView = overlay
        offlineRetryButton = retryButton
        updateMapFallbackCopy(reason: reason)
        UIAccessibility.post(notification: .announcement, argument: titleLabel.text)

        UIView.animate(withDuration: 0.28) {
            overlay.alpha = 1
        }
    }

    private func updateMapFallbackCopy(reason: MapFallbackReason) {
        guard let overlay = offlineOverlayView,
              let titleLabel = overlay.viewWithTag(4101) as? UILabel,
              let descriptionLabel = overlay.viewWithTag(4102) as? UILabel else { return }

        switch reason {
        case .offline:
            titleLabel.text = "You are offline"
            descriptionLabel.text = "Your globe position and wallet remain saved. Reconnect to restore Apple Maps."
        case .serviceUnavailable:
            titleLabel.text = "Apple Maps unavailable"
            descriptionLabel.text = "The map service could not finish loading. Your globe position and wallet remain saved."
        }
    }

    private func restoreOnlineMap(animated: Bool = true) {
        guard let overlay = offlineOverlayView else {
            mapFallbackReason = nil
            return
        }

        mapFallbackReason = nil
        mapControlStack.isUserInteractionEnabled = true
        mapControlStack.alpha = 1
        applyMapPresentation(mapPresentationMode)
        mapView.setNeedsLayout()
        mapView.setNeedsDisplay()

        if let preservedCamera {
            mapView.setCamera(preservedCamera, animated: true)
        }

        let cleanup = { [weak self, weak overlay] in
            overlay?.removeFromSuperview()
            guard let self, self.offlineOverlayView === overlay else { return }
            self.offlineOverlayView = nil
            self.offlineRetryButton = nil
        }

        if animated {
            UIView.animate(withDuration: 0.28, animations: {
                overlay.alpha = 0
            }) { _ in
                cleanup()
            }
        } else {
            overlay.alpha = 0
            cleanup()
        }
    }

    @objc private func triggerManualMapRetry() {
        if networkMonitor.currentPath.status == .satisfied {
            isConnected = true
            restoreOnlineMap()
            return
        }

        let feedback = UINotificationFeedbackGenerator()
        feedback.notificationOccurred(.warning)
        let shake = CABasicAnimation(keyPath: "transform.translation.x")
        shake.duration = 0.07
        shake.repeatCount = 3
        shake.autoreverses = true
        shake.fromValue = -8
        shake.toValue = 8
        offlineRetryButton?.layer.add(shake, forKey: "almidy-offline-retry-shake")
    }

#if DEBUG
    var isShowingMapFallbackForTesting: Bool {
        offlineOverlayView != nil
    }

    var mapCameraForTesting: MKMapCamera {
        mapView.camera
    }

    var preservedCameraForTesting: MKMapCamera? {
        preservedCamera
    }

    func setNetworkAvailabilityForTesting(_ isAvailable: Bool) {
        isConnected = isAvailable
        if isAvailable {
            restoreOnlineMap(animated: false)
        } else {
            showMapFallback(reason: .offline)
        }
    }
#endif

    private func configureMapControls() {
        mapControlStack.axis = .vertical
        mapControlStack.alignment = .center
        mapControlStack.spacing = 1
        mapControlStack.backgroundColor = UIColor.black.withAlphaComponent(0.48)
        mapControlStack.layer.cornerRadius = 28
        mapControlStack.clipsToBounds = true
        mapControlStack.translatesAutoresizingMaskIntoConstraints = false

        let mapModeButton = mapControlButton(systemName: "map", accessibilityLabel: "Change map mode")
        mapModeButton.addTarget(self, action: #selector(toggleMapMode), for: .touchUpInside)

        let separator = UIView()
        separator.backgroundColor = UIColor.white.withAlphaComponent(0.18)
        separator.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            separator.widthAnchor.constraint(equalToConstant: 30),
            separator.heightAnchor.constraint(equalToConstant: 1)
        ])

        let locationButton = mapControlButton(systemName: "location.fill", accessibilityLabel: "Use current location")
        locationButton.addTarget(self, action: #selector(requestCurrentLocation), for: .touchUpInside)

        mapControlStack.addArrangedSubview(mapModeButton)
        mapControlStack.addArrangedSubview(separator)
        mapControlStack.addArrangedSubview(locationButton)
        view.addSubview(mapControlStack)

        NSLayoutConstraint.activate([
            mapControlStack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            mapControlStack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 142),
            mapControlStack.widthAnchor.constraint(equalToConstant: 58)
        ])
    }

    private func mapControlButton(systemName: String, accessibilityLabel: String) -> UIButton {
        let button = UIButton(type: .system)
        button.tintColor = .white
        button.setImage(UIImage(systemName: systemName), for: .normal)
        button.accessibilityLabel = accessibilityLabel
        button.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            button.widthAnchor.constraint(equalToConstant: 58),
            button.heightAnchor.constraint(equalToConstant: 58)
        ])
        return button
    }

    private func configureSheet() {
        sheetView.translatesAutoresizingMaskIntoConstraints = false
        sheetView.backgroundColor = .white
        sheetView.layer.cornerRadius = 32
        sheetView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        sheetView.layer.shadowColor = UIColor.black.cgColor
        sheetView.layer.shadowOpacity = 0.22
        sheetView.layer.shadowRadius = 28
        sheetView.layer.shadowOffset = CGSize(width: 0, height: -12)
        view.addSubview(sheetView)

        sheetBottomConstraint = sheetView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        sheetHeightConstraint = sheetView.heightAnchor.constraint(equalToConstant: height(for: sheetState))
        NSLayoutConstraint.activate([
            sheetView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            sheetView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            sheetBottomConstraint!,
            sheetHeightConstraint!
        ])

        let pan = UIPanGestureRecognizer(target: self, action: #selector(handleSheetPan(_:)))
        sheetView.addGestureRecognizer(pan)

        sheetHandle.backgroundColor = UIColor.systemGray3
        sheetHandle.layer.cornerRadius = 3
        sheetHandle.translatesAutoresizingMaskIntoConstraints = false
        sheetView.addSubview(sheetHandle)

        headerStack.axis = .horizontal
        headerStack.alignment = .center
        headerStack.spacing = 10
        headerStack.translatesAutoresizingMaskIntoConstraints = false
        sheetView.addSubview(headerStack)

        titleButton.setTitle("My Trips", for: .normal)
        titleButton.setTitleColor(.black, for: .normal)
        titleButton.titleLabel?.font = .systemFont(ofSize: 42, weight: .black)
        titleButton.titleLabel?.adjustsFontSizeToFitWidth = true
        titleButton.titleLabel?.minimumScaleFactor = 0.72
        titleButton.contentHorizontalAlignment = .left
        titleButton.addTarget(self, action: #selector(toggleSheetFromTitle), for: .touchUpInside)

        chevronImageView.tintColor = .systemGray2
        chevronImageView.contentMode = .scaleAspectFit
        chevronImageView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            chevronImageView.widthAnchor.constraint(equalToConstant: 24),
            chevronImageView.heightAnchor.constraint(equalToConstant: 24)
        ])

        settingsButton.backgroundColor = UIColor(red: 1.0, green: 0.94, blue: 0.89, alpha: 1.0)
        settingsButton.tintColor = UIColor(red: 1.0, green: 0.42, blue: 0.12, alpha: 1.0)
        settingsButton.layer.cornerRadius = 29
        settingsButton.setImage(UIImage(systemName: "gearshape"), for: .normal)
        settingsButton.addTarget(self, action: #selector(openSettings), for: .touchUpInside)
        settingsButton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            settingsButton.widthAnchor.constraint(equalToConstant: 58),
            settingsButton.heightAnchor.constraint(equalToConstant: 58)
        ])

        let titleGroup = UIStackView(arrangedSubviews: [titleButton, chevronImageView])
        titleGroup.axis = .horizontal
        titleGroup.alignment = .center
        titleGroup.spacing = 8
        titleGroup.setContentHuggingPriority(.defaultLow, for: .horizontal)
        headerStack.addArrangedSubview(titleGroup)
        headerStack.addArrangedSubview(settingsButton)

        collapsedActions.axis = .horizontal
        collapsedActions.alignment = .center
        collapsedActions.distribution = .fill
        collapsedActions.spacing = 14
        collapsedActions.translatesAutoresizingMaskIntoConstraints = false
        sheetView.addSubview(collapsedActions)

        expandedScrollView.translatesAutoresizingMaskIntoConstraints = false
        expandedScrollView.alwaysBounceVertical = true
        sheetView.addSubview(expandedScrollView)

        expandedContentStack.axis = .vertical
        expandedContentStack.alignment = .fill
        expandedContentStack.spacing = 20
        expandedContentStack.translatesAutoresizingMaskIntoConstraints = false
        expandedScrollView.addSubview(expandedContentStack)

        NSLayoutConstraint.activate([
            sheetHandle.topAnchor.constraint(equalTo: sheetView.topAnchor, constant: 10),
            sheetHandle.centerXAnchor.constraint(equalTo: sheetView.centerXAnchor),
            sheetHandle.widthAnchor.constraint(equalToConstant: 42),
            sheetHandle.heightAnchor.constraint(equalToConstant: 6),

            headerStack.topAnchor.constraint(equalTo: sheetHandle.bottomAnchor, constant: 26),
            headerStack.leadingAnchor.constraint(equalTo: sheetView.leadingAnchor, constant: 28),
            headerStack.trailingAnchor.constraint(equalTo: sheetView.trailingAnchor, constant: -28),

            collapsedActions.leadingAnchor.constraint(equalTo: sheetView.leadingAnchor, constant: 28),
            collapsedActions.trailingAnchor.constraint(equalTo: sheetView.trailingAnchor, constant: -28),
            collapsedActions.bottomAnchor.constraint(equalTo: sheetView.safeAreaLayoutGuide.bottomAnchor, constant: -20),
            collapsedActions.heightAnchor.constraint(equalToConstant: 64),

            expandedScrollView.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 26),
            expandedScrollView.leadingAnchor.constraint(equalTo: sheetView.leadingAnchor),
            expandedScrollView.trailingAnchor.constraint(equalTo: sheetView.trailingAnchor),
            expandedScrollView.bottomAnchor.constraint(equalTo: sheetView.bottomAnchor),

            expandedContentStack.topAnchor.constraint(equalTo: expandedScrollView.contentLayoutGuide.topAnchor),
            expandedContentStack.leadingAnchor.constraint(equalTo: expandedScrollView.contentLayoutGuide.leadingAnchor, constant: 28),
            expandedContentStack.trailingAnchor.constraint(equalTo: expandedScrollView.contentLayoutGuide.trailingAnchor, constant: -28),
            expandedContentStack.bottomAnchor.constraint(equalTo: expandedScrollView.contentLayoutGuide.bottomAnchor, constant: -40),
            expandedContentStack.widthAnchor.constraint(equalTo: expandedScrollView.frameLayoutGuide.widthAnchor, constant: -56)
        ])
    }

    private func renderSheetContent() {
        collapsedActions.arrangedSubviews.forEach { view in
            collapsedActions.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
        expandedContentStack.arrangedSubviews.forEach { view in
            expandedContentStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }

        if trips.isEmpty {
            renderWelcomeContent()
        } else {
            renderCollapsedActions()
            renderTripContent()
        }
        syncSheetVisibility()
    }

    private func renderCollapsedActions() {
        let search = circularButton(systemName: "magnifyingglass", backgroundColor: .white, tintColor: .black)
        search.addTarget(self, action: #selector(openSearch), for: .touchUpInside)

        let book = UIButton(type: .system)
        book.backgroundColor = .white
        book.layer.cornerRadius = 28
        book.layer.shadowColor = UIColor.black.cgColor
        book.layer.shadowOpacity = 0.06
        book.layer.shadowRadius = 18
        book.layer.shadowOffset = CGSize(width: 0, height: 9)
        book.setTitle("  My Tripsy Book", for: .normal)
        book.setTitleColor(.black, for: .normal)
        book.titleLabel?.font = .systemFont(ofSize: 17, weight: .bold)
        book.setImage(UIImage(systemName: "globe.americas.fill"), for: .normal)
        book.tintColor = .black
        book.contentHorizontalAlignment = .center
        book.addTarget(self, action: #selector(openTripsyBook), for: .touchUpInside)

        let add = circularButton(systemName: "plus", backgroundColor: UIColor(red: 1.0, green: 0.42, blue: 0.12, alpha: 1.0), tintColor: .white)
        add.addTarget(self, action: #selector(createTrip), for: .touchUpInside)

        collapsedActions.addArrangedSubview(search)
        collapsedActions.addArrangedSubview(book)
        collapsedActions.addArrangedSubview(add)
        book.setContentHuggingPriority(.defaultLow, for: .horizontal)
        NSLayoutConstraint.activate([
            search.widthAnchor.constraint(equalToConstant: 64),
            add.widthAnchor.constraint(equalToConstant: 64)
        ])
    }

    private func renderTripContent() {
        let year = pillLabel("2026", fontSize: 24, textColor: UIColor(red: 1.0, green: 0.42, blue: 0.12, alpha: 1.0), backgroundColor: UIColor(red: 1.0, green: 0.94, blue: 0.9, alpha: 1.0))
        expandedContentStack.addArrangedSubview(year)

        let upcoming = UIStackView()
        upcoming.axis = .horizontal
        upcoming.alignment = .center
        upcoming.spacing = 12
        let label = UILabel()
        label.text = "Upcoming"
        label.textColor = .systemGray
        label.font = .systemFont(ofSize: 22, weight: .regular)
        let line = UIView()
        line.backgroundColor = UIColor.systemGray4
        upcoming.addArrangedSubview(label)
        upcoming.addArrangedSubview(line)
        NSLayoutConstraint.activate([line.heightAnchor.constraint(equalToConstant: 1)])
        expandedContentStack.addArrangedSubview(upcoming)

        if let latestTrip = trips.first {
            expandedContentStack.addArrangedSubview(tripCard(for: latestTrip))
        }

        if reservationCardVisible {
            expandedContentStack.addArrangedSubview(reservationAutomationCard())
        }
    }

    private func renderWelcomeContent() {
        let card = UIView()
        card.backgroundColor = UIColor(red: 1.0, green: 0.95, blue: 0.91, alpha: 1.0)
        card.layer.cornerRadius = 28
        card.layer.borderWidth = 1
        card.layer.borderColor = UIColor(red: 1.0, green: 0.72, blue: 0.54, alpha: 0.55).cgColor
        card.translatesAutoresizingMaskIntoConstraints = false

        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)

        let eyebrow = UILabel()
        eyebrow.text = "WELCOME"
        eyebrow.textColor = UIColor(red: 1.0, green: 0.42, blue: 0.12, alpha: 1.0)
        eyebrow.font = .systemFont(ofSize: 16, weight: .black)

        let title = UILabel()
        title.text = "Get Started"
        title.font = .systemFont(ofSize: 36, weight: .black)
        title.textColor = .black

        let body = UILabel()
        body.text = "Create your next trip and plan your itinerary, expenses, documents, and more"
        body.numberOfLines = 0
        body.textColor = .systemGray
        body.font = .systemFont(ofSize: 23, weight: .regular)

        stack.addArrangedSubview(eyebrow)
        stack.addArrangedSubview(title)
        stack.addArrangedSubview(body)
        stack.addArrangedSubview(actionButton(title: "Create Your First Trip", backgroundColor: UIColor(red: 1.0, green: 0.36, blue: 0.03, alpha: 1.0), textColor: .white, action: #selector(createTrip)))
        stack.addArrangedSubview(actionButton(title: "Forward Your Reservation", backgroundColor: UIColor(red: 0.9, green: 0.84, blue: 0.8, alpha: 1.0), textColor: .black, action: #selector(forwardReservation)))
        stack.addArrangedSubview(actionButton(title: "Explore Sample Trip", backgroundColor: UIColor(red: 0.9, green: 0.84, blue: 0.8, alpha: 1.0), textColor: .black, action: #selector(openSampleTrip)))

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 28),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -24),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -24)
        ])
        expandedContentStack.addArrangedSubview(card)
    }

    private func tripCard(for trip: NativeMapTrip) -> UIView {
        let button = UIButton(type: .custom)
        button.layer.cornerRadius = 28
        button.clipsToBounds = true
        button.backgroundColor = UIColor(white: 0.2, alpha: 1.0)
        button.addTarget(self, action: #selector(openLatestTrip), for: .touchUpInside)

        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFill
        imageView.translatesAutoresizingMaskIntoConstraints = false
        button.addSubview(imageView)
        loadTripImage(into: imageView, trip: trip)

        let gradient = CAGradientLayer()
        gradient.colors = [UIColor.clear.cgColor, UIColor.black.withAlphaComponent(0.62).cgColor]
        gradient.locations = [0.35, 1.0]
        button.layer.addSublayer(gradient)

        let textStack = UIStackView()
        textStack.axis = .vertical
        textStack.alignment = .leading
        textStack.spacing = 3
        textStack.translatesAutoresizingMaskIntoConstraints = false
        button.addSubview(textStack)

        let title = UILabel()
        title.text = trip.displayName
        title.textColor = .white
        title.font = .systemFont(ofSize: 38, weight: .black)
        title.adjustsFontSizeToFitWidth = true
        title.minimumScaleFactor = 0.72

        let dates = UILabel()
        dates.text = trip.displayDateRange
        dates.textColor = .white.withAlphaComponent(0.92)
        dates.font = .systemFont(ofSize: 21, weight: .semibold)

        let status = UILabel()
        status.text = trip.displayStatus
        status.textColor = .white.withAlphaComponent(0.82)
        status.font = .systemFont(ofSize: 19, weight: .regular)

        textStack.addArrangedSubview(title)
        textStack.addArrangedSubview(dates)
        textStack.addArrangedSubview(status)

        NSLayoutConstraint.activate([
            button.heightAnchor.constraint(equalToConstant: 340),
            imageView.topAnchor.constraint(equalTo: button.topAnchor),
            imageView.leadingAnchor.constraint(equalTo: button.leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: button.trailingAnchor),
            imageView.bottomAnchor.constraint(equalTo: button.bottomAnchor),
            textStack.leadingAnchor.constraint(equalTo: button.leadingAnchor, constant: 24),
            textStack.trailingAnchor.constraint(equalTo: button.trailingAnchor, constant: -24),
            textStack.bottomAnchor.constraint(equalTo: button.bottomAnchor, constant: -26)
        ])

        button.layoutIfNeeded()
        gradient.frame = CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width - 56, height: 340)
        return button
    }

    private func loadTripImage(into imageView: UIImageView, trip: NativeMapTrip) {
        if let imageUrl = trip.imageUrl, let url = URL(string: imageUrl) {
            URLSession.shared.dataTask(with: url) { data, _, _ in
                guard let data, let image = UIImage(data: data) else { return }
                DispatchQueue.main.async { imageView.image = image }
            }.resume()
            return
        }

        if let coordinate = trip.coordinate {
            let options = MKMapSnapshotter.Options()
            options.mapType = .hybrid
            options.region = MKCoordinateRegion(center: coordinate, latitudinalMeters: 25_000, longitudinalMeters: 25_000)
            options.size = CGSize(width: 720, height: 520)
            options.scale = UIScreen.main.scale
            MKMapSnapshotter(options: options).start { snapshot, _ in
                DispatchQueue.main.async { imageView.image = snapshot?.image }
            }
            return
        }

        imageView.image = destinationGradientImage(named: trip.displayName)
    }

    private func reservationAutomationCard() -> UIView {
        let card = UIView()
        card.backgroundColor = .white
        card.layer.cornerRadius = 26
        card.layer.borderWidth = 1
        card.layer.borderColor = UIColor.systemGray4.cgColor

        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)

        let close = UIButton(type: .system)
        close.setImage(UIImage(systemName: "xmark"), for: .normal)
        close.tintColor = .systemGray
        close.addTarget(self, action: #selector(dismissReservationCard), for: .touchUpInside)
        close.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(close)

        let envelope = UILabel()
        envelope.text = "✉"
        envelope.textAlignment = .center
        envelope.textColor = UIColor(red: 1.0, green: 0.42, blue: 0.12, alpha: 1.0)
        envelope.font = .systemFont(ofSize: 34, weight: .regular)

        let eyebrow = UILabel()
        eyebrow.text = "AUTOMATION"
        eyebrow.textColor = UIColor(red: 1.0, green: 0.42, blue: 0.12, alpha: 1.0)
        eyebrow.font = .systemFont(ofSize: 15, weight: .black)

        let title = UILabel()
        title.text = "Add Reservations via Email"
        title.font = .systemFont(ofSize: 27, weight: .black)
        title.textColor = .black
        title.numberOfLines = 0

        let body = UILabel()
        body.text = "Let Almidy automatically create an itinerary based on your flight or hotel reservation."
        body.font = .systemFont(ofSize: 19, weight: .regular)
        body.textColor = .systemGray
        body.numberOfLines = 0

        let cta = actionButton(title: "Forward Your Reservation", backgroundColor: UIColor(red: 1.0, green: 0.9, blue: 0.84, alpha: 1.0), textColor: UIColor(red: 1.0, green: 0.42, blue: 0.12, alpha: 1.0), action: #selector(forwardReservation))

        stack.addArrangedSubview(envelope)
        stack.addArrangedSubview(eyebrow)
        stack.addArrangedSubview(title)
        stack.addArrangedSubview(body)
        stack.addArrangedSubview(cta)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 26),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -24),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -24),
            close.topAnchor.constraint(equalTo: card.topAnchor, constant: 18),
            close.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18),
            close.widthAnchor.constraint(equalToConstant: 34),
            close.heightAnchor.constraint(equalToConstant: 34)
        ])

        return card
    }

    private func circularButton(systemName: String, backgroundColor: UIColor, tintColor: UIColor) -> UIButton {
        let button = UIButton(type: .system)
        button.backgroundColor = backgroundColor
        button.tintColor = tintColor
        button.layer.cornerRadius = 32
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOpacity = 0.08
        button.layer.shadowRadius = 18
        button.layer.shadowOffset = CGSize(width: 0, height: 9)
        button.setImage(UIImage(systemName: systemName), for: .normal)
        return button
    }

    private func actionButton(title: String, backgroundColor: UIColor, textColor: UIColor, action: Selector) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.setTitleColor(textColor, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 20, weight: .bold)
        button.backgroundColor = backgroundColor
        button.layer.cornerRadius = 25
        button.contentEdgeInsets = UIEdgeInsets(top: 14, left: 18, bottom: 14, right: 18)
        button.addTarget(self, action: action, for: .touchUpInside)
        NSLayoutConstraint.activate([button.heightAnchor.constraint(greaterThanOrEqualToConstant: 54)])
        return button
    }

    private func pillLabel(_ text: String, fontSize: CGFloat, textColor: UIColor, backgroundColor: UIColor) -> UILabel {
        let label = PaddingLabel(insets: UIEdgeInsets(top: 9, left: 17, bottom: 9, right: 17))
        label.text = text
        label.textColor = textColor
        label.font = .systemFont(ofSize: fontSize, weight: .black)
        label.backgroundColor = backgroundColor
        label.layer.cornerRadius = 22
        label.clipsToBounds = true
        label.setContentHuggingPriority(.required, for: .horizontal)
        return label
    }

    private func syncSheetVisibility() {
        collapsedActions.isHidden = sheetState != .collapsed || trips.isEmpty
        expandedScrollView.isHidden = sheetState == .collapsed
        chevronImageView.transform = sheetState == .collapsed ? .identity : CGAffineTransform(rotationAngle: .pi)
    }

    private func applySheetState(_ state: SheetState, animated: Bool) {
        sheetState = state
        sheetHeightConstraint?.constant = height(for: state)
        let changes = {
            self.syncSheetVisibility()
            self.view.layoutIfNeeded()
        }

        if animated {
            UIView.animate(withDuration: 0.48, delay: 0, usingSpringWithDamping: 0.84, initialSpringVelocity: 0.45, options: [.allowUserInteraction, .curveEaseOut], animations: changes)
        } else {
            changes()
        }
    }

    private func height(for state: SheetState) -> CGFloat {
        let fullHeight = view.bounds.height > 0 ? view.bounds.height : UIScreen.main.bounds.height
        switch state {
        case .collapsed:
            return trips.isEmpty ? min(300, fullHeight * 0.28) : min(268, fullHeight * 0.26)
        case .medium:
            return min(fullHeight * 0.58, 520)
        case .expanded:
            return fullHeight - view.safeAreaInsets.top - 10
        }
    }

    @objc private func handleSheetPan(_ recognizer: UIPanGestureRecognizer) {
        let translation = recognizer.translation(in: view)
        switch recognizer.state {
        case .began:
            panStartHeight = sheetHeightConstraint?.constant ?? height(for: sheetState)
        case .changed:
            let nextHeight = max(height(for: .collapsed), min(height(for: .expanded), panStartHeight - translation.y))
            sheetHeightConstraint?.constant = nextHeight
            view.layoutIfNeeded()
        case .ended, .cancelled:
            let velocity = recognizer.velocity(in: view).y
            let currentHeight = sheetHeightConstraint?.constant ?? height(for: sheetState)
            applySheetState(nearestState(for: currentHeight, velocity: velocity), animated: true)
        default:
            break
        }
    }

    private func nearestState(for height: CGFloat, velocity: CGFloat) -> SheetState {
        if velocity < -700 { return .expanded }
        if velocity > 700 { return .collapsed }
        return SheetState.allCases.min { abs(self.height(for: $0) - height) < abs(self.height(for: $1) - height) } ?? .medium
    }

    private func addTripPins() {
        let annotations = trips.compactMap { trip -> NativeTripAnnotation? in
            guard let coordinate = trip.coordinate else { return nil }
            return NativeTripAnnotation(trip: trip, coordinate: coordinate)
        }
        mapView.addAnnotations(annotations)
    }

    func mapViewDidFinishLoadingMap(_ mapView: MKMapView) {
        if mapFallbackReason == .serviceUnavailable && isConnected != false {
            restoreOnlineMap()
        }
    }

    func mapViewDidFailLoadingMap(_ mapView: MKMapView, withError error: Error) {
        let mapError = error as NSError
        guard mapError.code != NSURLErrorCancelled else { return }

        if isConnected == false {
            showMapFallback(reason: .offline)
        } else {
            showMapFallback(reason: .serviceUnavailable)
        }
    }

    func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
        guard annotation is NativeTripAnnotation else { return nil }
        let identifier = "trip-pin"
        let annotationView = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) ?? MKMarkerAnnotationView(annotation: annotation, reuseIdentifier: identifier)
        annotationView.annotation = annotation
        annotationView.canShowCallout = true
        annotationView.rightCalloutAccessoryView = UIButton(type: .detailDisclosure)
        if let marker = annotationView as? MKMarkerAnnotationView {
            marker.markerTintColor = UIColor(red: 1.0, green: 0.42, blue: 0.12, alpha: 1.0)
            marker.glyphImage = UIImage(systemName: "airplane")
        }
        return annotationView
    }

    func mapView(_ mapView: MKMapView, didSelect annotation: MKAnnotation) {
        guard let tripAnnotation = annotation as? NativeTripAnnotation else { return }
        mapView.setCamera(MKMapCamera(lookingAtCenter: tripAnnotation.coordinate, fromDistance: 90_000, pitch: 52, heading: mapView.camera.heading), animated: true)
    }

    func mapView(_ mapView: MKMapView, annotationView view: MKAnnotationView, calloutAccessoryControlTapped control: UIControl) {
        guard let tripAnnotation = view.annotation as? NativeTripAnnotation else { return }
        openRoute(tripAnnotation.trip.route)
    }

    @objc private func toggleMapMode() {
        let nextMode: MapPresentationMode
        switch mapPresentationMode {
        case .hybrid:
            nextMode = .imagery
        case .imagery:
            nextMode = .standard
        case .standard:
            nextMode = .hybrid
        }

        applyMapPresentation(nextMode)
        if nextMode == .hybrid || nextMode == .imagery {
            mapView.setCamera(globeCamera(distance: max(mapView.camera.centerCoordinateDistance, 6_000_000), heading: mapView.camera.heading), animated: true)
        }
    }

    @objc private func requestCurrentLocation() {
        guard !isRequestingLocationAuthorization else { return }

        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        switch locationManager.authorizationStatus {
        case .notDetermined:
            isRequestingLocationAuthorization = true
            locationManager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            mapView.showsUserLocation = true
            locationManager.requestLocation()
        case .denied, .restricted:
            break
        @unknown default:
            break
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        isRequestingLocationAuthorization = false

        if manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways {
            mapView.showsUserLocation = true
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let coordinate = locations.last?.coordinate else { return }
        mapView.showsUserLocation = true
        mapView.setUserTrackingMode(.followWithHeading, animated: true)
        mapView.setCamera(MKMapCamera(lookingAtCenter: coordinate, fromDistance: 18_000, pitch: 58, heading: mapView.camera.heading), animated: true)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}

    @objc private func toggleSheetFromTitle() {
        applySheetState(sheetState == .collapsed ? .medium : .collapsed, animated: true)
    }

    @objc private func openSettings() {
        openRoute("/dashboard/account")
    }

    @objc private func openSearch() {
        openRoute("/dashboard/search")
    }

    @objc private func openTripsyBook() {
        openRoute("/dashboard/trips")
    }

    @objc private func createTrip() {
        openRoute("/dashboard/trips?view=list#new-trip")
    }

    @objc private func forwardReservation() {
        openRoute("/dashboard/imports")
    }

    @objc private func openSampleTrip() {
        openRoute("/dashboard/plan")
    }

    @objc private func openLatestTrip() {
        guard let trip = trips.first else { return }
        openRoute(trip.route)
    }

    @objc private func dismissReservationCard() {
        reservationCardVisible = false
        UserDefaults.standard.set(true, forKey: "almidy.native.reservationCardDismissed")
        renderSheetContent()
    }

    private func destinationGradientImage(named name: String) -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 720, height: 520))
        return renderer.image { context in
            let bounds = CGRect(x: 0, y: 0, width: 720, height: 520)
            UIColor(red: 0.09, green: 0.2, blue: 0.28, alpha: 1).setFill()
            context.fill(bounds)
            let colors = [UIColor(red: 0.08, green: 0.38, blue: 0.48, alpha: 1).cgColor, UIColor(red: 0.88, green: 0.38, blue: 0.18, alpha: 1).cgColor]
            let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors as CFArray, locations: [0, 1])!
            context.cgContext.drawLinearGradient(gradient, start: CGPoint(x: 0, y: 0), end: CGPoint(x: 720, y: 520), options: [])
        }
    }
}

private final class NativeTripAnnotation: NSObject, MKAnnotation {
    let coordinate: CLLocationCoordinate2D
    let title: String?
    let trip: NativeMapTrip

    init(trip: NativeMapTrip, coordinate: CLLocationCoordinate2D) {
        self.trip = trip
        self.coordinate = coordinate
        self.title = trip.displayName
    }
}

private final class PaddingLabel: UILabel {
    private let insets: UIEdgeInsets

    init(insets: UIEdgeInsets) {
        self.insets = insets
        super.init(frame: .zero)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var intrinsicContentSize: CGSize {
        let size = super.intrinsicContentSize
        return CGSize(width: size.width + insets.left + insets.right, height: size.height + insets.top + insets.bottom)
    }

    override func drawText(in rect: CGRect) {
        super.drawText(in: rect.inset(by: insets))
    }
}

private func clean(_ value: String?) -> String? {
    guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
        return nil
    }
    return trimmed
}

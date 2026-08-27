import Foundation
import CoreLocation
import GeoToolbox
import MapKit
import UIKit

protocol NativeTripOverviewRouting: AnyObject {
    func route(_ action: NativeTripOverviewAction)
    func route(_ category: NativeActivityCategory, tripID: String)
    func route(_ destination: NativeTripOverviewMoreDestination, tripID: String)
    func route(_ action: NativeTripOverviewMenuAction, tripID: String)
    func filterGlobe(for category: NativeActivityCategory, query: String, nearby: Bool, region: MKCoordinateRegion?, results: [MKMapItem])
    func focusGlobeResult(for category: NativeActivityCategory, query: String, nearby: Bool, region: MKCoordinateRegion?, results: [MKMapItem], selectedResultID: String)
    func clearGlobeActivityFilter()
    func recoverAuthentication()
    func finishPeerPresentation()
    func close()
}

enum NativeActivityPlaceIdentity {
    static func value(for mapItem: MKMapItem) -> String {
        if #available(iOS 18.0, *), let identifier = mapItem.identifier {
            return "apple-place:\(identifier.rawValue)"
        }
        return legacyValue(for: mapItem)
    }

    static func persistentPlaceID(for mapItem: MKMapItem) -> String? {
        guard #available(iOS 18.0, *), let identifier = mapItem.identifier else { return nil }
        return identifier.rawValue
    }

    private static func legacyValue(for mapItem: MKMapItem) -> String {
        let coordinate = mapItem.placemark.coordinate
        let name = (mapItem.name ?? "")
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return "legacy-place:\(name)|\(String(format: "%.5f", coordinate.latitude))|\(String(format: "%.5f", coordinate.longitude))"
    }
}

enum NativeCoordinatePlace {
    @available(iOS 26.0, *)
    static func resolve(_ descriptor: PlaceDescriptor) async throws -> MKMapItem {
        let request = MKMapItemRequest(placeDescriptor: descriptor)
        return try await request.mapItem
    }

    @available(iOS 26.0, *)
    static func descriptor(for mapItem: MKMapItem) -> PlaceDescriptor? {
        PlaceDescriptor(item: mapItem)
    }

    /// Creates a MapKit-compatible place immediately from user or imported
    /// coordinates. The resolver enriches it later without changing the pin.
    static func mapItem(title: String, coordinate: CLLocationCoordinate2D) -> MKMapItem? {
        guard CLLocationCoordinate2DIsValid(coordinate) else { return nil }
        let item = MKMapItem(placemark: MKPlacemark(coordinate: coordinate))
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        item.name = cleanTitle.isEmpty ? "Pinned Place" : cleanTitle
        return item
    }

    @available(iOS 26.0, *)
    static func descriptor(
        title: String,
        coordinate: CLLocationCoordinate2D,
        serviceIdentifiers: [String: String] = [:]
    ) -> PlaceDescriptor? {
        guard CLLocationCoordinate2DIsValid(coordinate) else { return nil }
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if serviceIdentifiers.isEmpty {
            return PlaceDescriptor(
                representations: [.coordinate(coordinate)],
                commonName: cleanTitle.isEmpty ? "Pinned Place" : cleanTitle
            )
        }
        return PlaceDescriptor(
            representations: [.coordinate(coordinate)],
            commonName: cleanTitle.isEmpty ? "Pinned Place" : cleanTitle,
            supportingRepresentations: [.serviceIdentifiers(serviceIdentifiers)]
        )
    }

    static func resolveCoordinate(
        title: String,
        coordinate: CLLocationCoordinate2D,
        serviceIdentifiers: [String: String] = [:],
        completion: @escaping (MKMapItem?) -> Void
    ) {
        guard let fallbackItem = mapItem(title: title, coordinate: coordinate) else {
            completion(nil)
            return
        }
        if #available(iOS 26.0, *),
           let descriptor = descriptor(
               title: title,
               coordinate: coordinate,
               serviceIdentifiers: serviceIdentifiers
           ) {
            Task {
                do {
                    let item = try await resolve(descriptor)
                    await MainActor.run { completion(item) }
                } catch {
                    NativeActivityPlaceResolver.resolveLatest(fallbackItem) { completion($0) }
                }
            }
            return
        }
        NativeActivityPlaceResolver.resolveLatest(fallbackItem) { completion($0) }
    }

    @available(iOS 26.0, *)
    static func descriptor(commonName: String, address: String) -> PlaceDescriptor? {
        let cleanAddress = address.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanAddress.isEmpty else { return nil }
        let cleanName = commonName.trimmingCharacters(in: .whitespacesAndNewlines)
        return PlaceDescriptor(
            representations: [.address(cleanAddress)],
            commonName: cleanName.isEmpty ? cleanAddress : cleanName
        )
    }

    static func resolveAddress(
        _ address: String,
        commonName: String,
        completion: @escaping (MKMapItem?) -> Void
    ) {
        if #available(iOS 26.0, *),
           let descriptor = descriptor(commonName: commonName, address: address) {
            Task {
                do {
                    let item = try await resolve(descriptor)
                    await MainActor.run { completion(item) }
                } catch {
                    forwardGeocode(
                        address,
                        commonName: commonName,
                        completion: completion
                    )
                }
            }
            return
        }
        if #available(iOS 26.0, *) {
            forwardGeocode(address, commonName: commonName, completion: completion)
        } else {
            legacyAddressSearch(address, commonName: commonName, completion: completion)
        }
    }

    @available(iOS 26.0, *)
    private static func forwardGeocode(
        _ address: String,
        commonName: String,
        completion: @escaping (MKMapItem?) -> Void
    ) {
        guard let request = MKGeocodingRequest(addressString: address) else {
            legacyAddressSearch(address, commonName: commonName, completion: completion)
            return
        }
        Task {
            do {
                let item = try await request.mapItems.first
                await MainActor.run {
                    guard let item else {
                        legacyAddressSearch(address, commonName: commonName, completion: completion)
                        return
                    }
                    let cleanName = commonName.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !cleanName.isEmpty { item.name = cleanName }
                    completion(item)
                }
            } catch {
                legacyAddressSearch(address, commonName: commonName, completion: completion)
            }
        }
    }

    private static func legacyAddressSearch(
        _ address: String,
        commonName: String,
        completion: @escaping (MKMapItem?) -> Void
    ) {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = [commonName, address]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        request.resultTypes = [.address, .pointOfInterest]
        MKLocalSearch(request: request).start { response, _ in
            DispatchQueue.main.async { completion(response?.mapItems.first) }
        }
    }
}

enum NativeActivityPlaceResolver {
    /// Refreshes an Apple Maps place before presenting details. Place IDs are
    /// available on iOS 18 and later; older systems keep the search result that
    /// already contains the best MapKit data available on that OS.
    static func resolveLatest(_ mapItem: MKMapItem, completion: @escaping (MKMapItem) -> Void) {
        if #available(iOS 18.0, *), let identifier = mapItem.identifier {
            let request = MKMapItemRequest(mapItemIdentifier: identifier)
            request.getMapItem { refreshedItem, _ in
                DispatchQueue.main.async {
                    completion(refreshedItem ?? mapItem)
                }
            }
            return
        }

        let coordinate = mapItem.placemark.coordinate
        if #available(iOS 26.0, *),
           let descriptor = NativeCoordinatePlace.descriptor(for: mapItem)
               ?? NativeCoordinatePlace.descriptor(
                   title: mapItem.name ?? "Pinned Place",
                   coordinate: coordinate
               ) {
            Task {
                do {
                    let resolvedItem = try await NativeCoordinatePlace.resolve(descriptor)
                    await MainActor.run {
                        completion(resolvedItem)
                    }
                } catch {
                    reverseGeocode(mapItem, completion: completion)
                }
            }
            return
        }

        reverseGeocode(mapItem, completion: completion)
    }

    private static func reverseGeocode(_ mapItem: MKMapItem, completion: @escaping (MKMapItem) -> Void) {
        let placemark = mapItem.placemark
        let hasStructuredAddress = placemark.thoroughfare != nil
            || placemark.locality != nil
            || placemark.administrativeArea != nil
            || placemark.country != nil
        let coordinate = placemark.coordinate
        guard !hasStructuredAddress, CLLocationCoordinate2DIsValid(coordinate) else {
            completion(mapItem)
            return
        }

        let location = CLLocation(
            latitude: coordinate.latitude,
            longitude: coordinate.longitude
        )
        if #available(iOS 26.0, *),
           let request = MKReverseGeocodingRequest(location: location) {
            Task {
                do {
                    let resolvedItem = try await request.mapItems.first
                    await MainActor.run {
                        guard let resolvedItem else {
                            legacyReverseGeocode(location, originalItem: mapItem, completion: completion)
                            return
                        }
                        mergeOriginalDetails(from: mapItem, into: resolvedItem)
                        completion(resolvedItem)
                    }
                } catch {
                    legacyReverseGeocode(location, originalItem: mapItem, completion: completion)
                }
            }
            return
        }

        legacyReverseGeocode(location, originalItem: mapItem, completion: completion)
    }

    private static func legacyReverseGeocode(
        _ location: CLLocation,
        originalItem mapItem: MKMapItem,
        completion: @escaping (MKMapItem) -> Void
    ) {
        CLGeocoder().reverseGeocodeLocation(location) { placemarks, _ in
            DispatchQueue.main.async {
                guard let resolvedPlacemark = placemarks?.first else {
                    completion(mapItem)
                    return
                }
                let enriched = MKMapItem(placemark: MKPlacemark(placemark: resolvedPlacemark))
                enriched.name = mapItem.name ?? resolvedPlacemark.name ?? "Pinned Place"
                enriched.phoneNumber = mapItem.phoneNumber
                enriched.url = mapItem.url
                enriched.timeZone = mapItem.timeZone ?? resolvedPlacemark.timeZone
                completion(enriched)
            }
        }
    }

    private static func mergeOriginalDetails(from original: MKMapItem, into resolved: MKMapItem) {
        let originalName = original.name?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let originalName, !originalName.isEmpty, originalName != "Pinned Place" {
            resolved.name = originalName
        }
        resolved.phoneNumber = original.phoneNumber ?? resolved.phoneNumber
        resolved.url = original.url ?? resolved.url
        resolved.timeZone = original.timeZone ?? resolved.timeZone
    }
}

enum NativeTripOverviewMenuAction: String, CaseIterable, Equatable {
    case shareTrip
    case manageGuests
    case editName
    case changeDates
    case changeBackground
    case duplicateTrip
    case mergeTrip
    case turnOffNotifications

    var title: String {
        switch self {
        case .shareTrip: return "Share Trip"
        case .manageGuests: return "Manage Guests"
        case .editName: return "Edit Name"
        case .changeDates: return "Change Dates"
        case .changeBackground: return "Change Background"
        case .duplicateTrip: return "Duplicate Trip"
        case .mergeTrip: return "Merge into another trip"
        case .turnOffNotifications: return "Turn Off Notifications"
        }
    }

    var systemImage: String {
        switch self {
        case .shareTrip: return "square.and.arrow.up"
        case .manageGuests: return "person.2"
        case .editName: return "character.cursor.ibeam"
        case .changeDates: return "calendar"
        case .changeBackground: return "photo"
        case .duplicateTrip: return "plus.square.on.square"
        case .mergeTrip: return "arrow.triangle.merge"
        case .turnOffNotifications: return "bell.slash"
        }
    }

    var isAvailable: Bool {
        true
    }
}

enum NativeTripOverviewMoreDestination: String, CaseIterable, Equatable {
    case itinerary
    case importedItems
    case expenses

    var title: String {
        switch self {
        case .itinerary: return "Itinerary"
        case .importedItems: return "Imported items"
        case .expenses: return "Expenses"
        }
    }
}

final class NativeTripOverviewRouter: NativeTripOverviewRouting {
    typealias WebHandoff = (URL) -> Void
    typealias NativeRoute = (NativeTripOverviewActionKind, URL) -> Void
    typealias ActivitySearchRoute = (NativeActivityCategory, String) -> Void
    typealias ActivityFilterRoute = (NativeActivityCategory?, String, Bool, String?, MKCoordinateRegion?, [MKMapItem]) -> Void

    private weak var viewController: UIViewController?
    private let webHandoff: WebHandoff
    private let nativeRoute: NativeRoute
    private let activitySearchRoute: ActivitySearchRoute
    private let activityFilterRoute: ActivityFilterRoute
    private let authenticationRecovery: () -> Void
    private let onClose: () -> Void

    init(
        viewController: UIViewController,
        webHandoff: @escaping WebHandoff,
        nativeRoute: @escaping NativeRoute,
        activitySearchRoute: @escaping ActivitySearchRoute = { _, _ in },
        activityFilterRoute: @escaping ActivityFilterRoute = { _, _, _, _, _, _ in },
        authenticationRecovery: @escaping () -> Void = {},
        onClose: @escaping () -> Void = {}
    ) {
        self.viewController = viewController
        self.webHandoff = webHandoff
        self.nativeRoute = nativeRoute
        self.activitySearchRoute = activitySearchRoute
        self.activityFilterRoute = activityFilterRoute
        self.authenticationRecovery = authenticationRecovery
        self.onClose = onClose
    }

    func route(_ category: NativeActivityCategory, tripID: String) {
        let route = activitySearchRoute
        guard let viewController, viewController.presentingViewController != nil else {
            route(category, tripID)
            return
        }

        viewController.dismiss(animated: true) {
            route(category, tripID)
        }
    }

    func recoverAuthentication() { authenticationRecovery() }

    func finishPeerPresentation() { onClose() }

    func filterGlobe(for category: NativeActivityCategory, query: String, nearby: Bool, region: MKCoordinateRegion?, results: [MKMapItem]) {
        activityFilterRoute(category, query, nearby, nil, region, results)
    }

    func clearGlobeActivityFilter() {
        activityFilterRoute(nil, "", false, nil, nil, [])
    }

    func focusGlobeResult(for category: NativeActivityCategory, query: String, nearby: Bool, region: MKCoordinateRegion?, results: [MKMapItem], selectedResultID: String) {
        activityFilterRoute(category, query, nearby, selectedResultID, region, results)
    }

    func route(_ action: NativeTripOverviewAction) {
        switch action.destination {
        case .webHandoff(let url): webHandoff(url)
        case .nativePlaces(let url): nativeRoute(.places, url)
        case .nativeRoutes(let url): nativeRoute(.routes, url)
        case nil: break
        }
    }

    func route(_ destination: NativeTripOverviewMoreDestination, tripID: String) {
        let encodedID = tripID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? tripID
        let suffix: String
        switch destination {
        case .itinerary: suffix = "timeline"
        case .importedItems: suffix = "documents"
        case .expenses: suffix = "budget"
        }
        guard let url = URL(string: "/dashboard/trips/\(encodedID)/\(suffix)") else { return }
        webHandoff(url)
    }

    func route(_ action: NativeTripOverviewMenuAction, tripID: String) {
        let encodedID = tripID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? tripID
        let route: String
        switch action {
        case .shareTrip:
            route = "/dashboard/trips/\(encodedID)/share"
        case .manageGuests:
            route = "/dashboard/trips/\(encodedID)/sharing"
        case .editName:
            route = "/dashboard/trips/\(encodedID)?tripAction=edit-name"
        case .changeDates:
            route = "/dashboard/trips/\(encodedID)?tripAction=change-dates"
        case .changeBackground:
            route = "/dashboard/trips/\(encodedID)?tripAction=change-background"
        case .duplicateTrip:
            route = "/dashboard/trips/\(encodedID)?tripAction=duplicate"
        case .mergeTrip:
            route = "/dashboard/trips/\(encodedID)?tripAction=merge"
        case .turnOffNotifications:
            route = "/dashboard/account#notifications"
        }
        guard let url = URL(string: route) else { return }
        webHandoff(url)
    }

    func close() {
        guard let viewController else {
            onClose()
            return
        }
        viewController.dismiss(animated: true, completion: onClose)
    }
}

extension URL {
    var almidyRoute: String {
        let encodedPath = URLComponents(url: self, resolvingAgainstBaseURL: false)?.percentEncodedPath
        var route = encodedPath?.isEmpty == false ? encodedPath! : absoluteString
        if let query { route += "?\(query)" }
        if let fragment { route += "#\(fragment)" }
        return route
    }
}

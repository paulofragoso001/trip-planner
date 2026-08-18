import Foundation
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
    func close()
}

enum NativeActivityPlaceIdentity {
    static func value(for mapItem: MKMapItem) -> String {
        let coordinate = mapItem.placemark.coordinate
        let name = (mapItem.name ?? "")
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return "\(name)|\(String(format: "%.5f", coordinate.latitude))|\(String(format: "%.5f", coordinate.longitude))"
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

import Foundation
import UIKit

protocol NativeTripOverviewRouting: AnyObject {
    func route(_ action: NativeTripOverviewAction)
    func route(_ destination: NativeTripOverviewMoreDestination, tripID: String)
    func recoverAuthentication()
    func close()
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

    private weak var viewController: UIViewController?
    private let webHandoff: WebHandoff
    private let nativeRoute: NativeRoute
    private let authenticationRecovery: () -> Void

    init(
        viewController: UIViewController,
        webHandoff: @escaping WebHandoff,
        nativeRoute: @escaping NativeRoute,
        authenticationRecovery: @escaping () -> Void = {}
    ) {
        self.viewController = viewController
        self.webHandoff = webHandoff
        self.nativeRoute = nativeRoute
        self.authenticationRecovery = authenticationRecovery
    }

    func recoverAuthentication() { authenticationRecovery() }

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

    func close() {
        viewController?.dismiss(animated: true)
    }
}

extension URL {
    var almidyRoute: String {
        var route = path.isEmpty ? absoluteString : path
        if let query { route += "?\(query)" }
        if let fragment { route += "#\(fragment)" }
        return route
    }
}

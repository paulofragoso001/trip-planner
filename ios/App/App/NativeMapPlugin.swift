import Capacitor
import CoreGraphics
import CoreLocation
import CryptoKit
import Foundation
import MapKit
import Network
import os
import PhotosUI
import Security
import UIKit
import WebKit
import UniformTypeIdentifiers
import AuthenticationServices

enum NativeServiceConfiguration {
    static let appBaseURL = URL(string: "https://almidy.app")!
    static let appHost = appBaseURL.host!
    static let appOrigin = appBaseURL.originString

    // These are optional build-time values. The publishable key is safe for a
    // client bundle; service-role credentials must remain server-side.
    static var supabaseURL: URL? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "SupabaseURL") as? String else {
            return nil
        }
        return URL(string: value)
    }

    static var supabasePublishableKey: String? {
        Bundle.main.object(forInfoDictionaryKey: "SupabasePublishableKey") as? String
    }
}

extension URL {
    var originString: String {
        guard let scheme, let host else { return absoluteString }
        return scheme + "://" + host + (port.map { ":\($0)" } ?? "")
    }
}

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
            if let accessToken = options.accessToken, !accessToken.isEmpty {
                let webSession = NativeAuthSession(
                    accessToken: accessToken,
                    refreshToken: options.refreshToken,
                    expiresAt: options.expiresAt
                )
                let revision = NativeJWTClaims.issuedAtMilliseconds(from: accessToken) ?? 0
                _ = NativeSessionCoordinator.shared.importWebSession(webSession, revision: revision)
            }
            let tripStore = NativeTripStore(webView: self.bridge?.webView)
            let mapViewController = NativeMapViewController(
                trips: options.trips,
                tripStore: tripStore,
                sourceWebView: self.bridge?.webView
            )
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

}

private struct NativeMapOptions: Decodable {
    let accessToken: String?
    let expiresAt: Int?
    let refreshToken: String?
    let trips: [NativeMapTrip]

    init(trips: [NativeMapTrip]) {
        accessToken = nil
        expiresAt = nil
        refreshToken = nil
        self.trips = trips
    }
}

struct NativeTripDraft {
    let name: String
    let destination: String
    let coordinate: CLLocationCoordinate2D
    let startDate: String?
    let endDate: String?

    init(
        name: String,
        destination: String,
        coordinate: CLLocationCoordinate2D,
        startDate: String? = nil,
        endDate: String? = nil
    ) {
        self.name = name
        self.destination = destination
        self.coordinate = coordinate
        self.startDate = startDate
        self.endDate = endDate
    }
}

enum NativeTripStoreError: LocalizedError {
    case invalidResponse
    case unauthorized
    case requestFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Almidy returned an invalid trip response."
        case .unauthorized:
            return "Your Almidy session has expired."
        case .requestFailed(let message):
            return message
        }
    }
}

struct NativeImportResult {
    let extractedPlaceCount: Int
    let status: String
}

private struct NativeDestinationHeroResponse: Decodable {
    let data: DataPayload

    struct DataPayload: Decodable {
        let resolved: ResolvedPlace
    }

    struct ResolvedPlace: Decodable {
        let address: String?
        let city: String?
        let country: String?
        let diagnostics: Diagnostics?
        let inventoryItem: InventoryItem?
        let latitude: Double?
        let longitude: Double?
        let provider: String?
    }

    struct Diagnostics: Decodable {
        let lastErrorCode: String?
        let providerResultCount: Int?
        let status: String?
    }

    struct InventoryItem: Decodable {
        let imageUrl: String?
        let title: String?
    }
}

private struct NativeDestinationImageBankResponse: Decodable {
    let data: DataPayload

    struct DataPayload: Decodable {
        let suggestions: [Suggestion]
    }

    struct Suggestion: Decodable {
        let imageAttribution: String?
        let imageProvider: String?
        let imageUrl: String?
        let title: String
    }
}

private struct NativeUserPreferencesResponse: Decodable {
    let preferences: NativeUserPreferences
}

struct NativeDestinationImageChoice {
    let attribution: String?
    let title: String
    let url: URL
}

final class NativeTripStore {
    private let webView: WKWebView?
    private let baseURL: URL
    private let session: URLSession
    private let apiClient: NativeAuthenticatedHTTPClient

    init(
        webView: WKWebView?,
        baseURL: URL = NativeServiceConfiguration.appBaseURL,
        session: URLSession = .shared,
        coordinator: NativeSessionCoordinator = .shared
    ) {
        self.webView = webView
        self.baseURL = baseURL
        self.session = session
        self.apiClient = NativeAuthenticatedHTTPClient(
            webView: webView,
            baseURL: baseURL,
            session: session,
            coordinator: coordinator
        )
    }

    func loadTrips(completion: @escaping (Result<[NativeMapTrip], Error>) -> Void) {
        send(path: "/api/trips", method: "GET", body: nil) { result in
            completion(result.flatMap { data in
                do {
                    let response = try JSONDecoder().decode(NativeTripListResponse.self, from: data)
                    return .success(response.trips)
                } catch {
                    return .failure(error)
                }
            })
        }
    }

    func updateProfileName(_ name: String, completion: @escaping (Bool) -> Void) {
        let body = try? JSONSerialization.data(withJSONObject: ["displayName": name])
        apiClient.request(path: "/api/account/profile", method: "POST", body: body) { result in
            guard case .success = result else { completion(false); return }
            NativeSessionCoordinator.shared.refresh(using: .shared) { completion($0) }
        }
    }

    func requestPasswordReset(completion: @escaping (Bool) -> Void) {
        apiClient.request(path: "/api/account/password-reset", method: "POST", body: Data("{}".utf8)) { result in
            if case .success = result {
                completion(true)
            } else {
                completion(false)
            }
        }
    }

    func loadUserPreferences(completion: @escaping (Result<NativeUserPreferences, Error>) -> Void) {
        apiClient.request(path: "/api/user-preferences", method: "GET", body: nil) { result in
            completion(result.flatMap { data in
                guard let response = try? JSONDecoder().decode(NativeUserPreferencesResponse.self, from: data) else {
                    return .failure(NativeTripStoreError.invalidResponse)
                }
                return .success(response.preferences)
            })
        }
    }

    func updateUserPreferences(_ values: [String: String], completion: @escaping (Result<NativeUserPreferences, Error>) -> Void) {
        guard JSONSerialization.isValidJSONObject(values), let body = try? JSONSerialization.data(withJSONObject: values) else {
            completion(.failure(NativeTripStoreError.invalidResponse)); return
        }
        apiClient.request(path: "/api/user-preferences", method: "PATCH", body: body) { result in
            completion(result.flatMap { data in
                guard let response = try? JSONDecoder().decode(NativeUserPreferencesResponse.self, from: data) else {
                    return .failure(NativeTripStoreError.invalidResponse)
                }
                return .success(response.preferences)
            })
        }
    }

    func createTrip(_ draft: NativeTripDraft, completion: @escaping (Result<NativeMapTrip, Error>) -> Void) {
        let payload: [String: Any] = [
            "name": draft.name,
            "destination": draft.destination,
            "destination_status": "resolved",
            "destination_lat": draft.coordinate.latitude,
            "destination_lng": draft.coordinate.longitude,
            "destination_formatted_address": draft.destination,
            "start_date": draft.startDate as Any? ?? NSNull(),
            "end_date": draft.endDate as Any? ?? NSNull(),
            "status": "Planning",
            "travel_style": "balanced",
            "budget": 0,
            "notes": NSNull()
        ]

        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload) else {
            completion(.failure(NativeTripStoreError.requestFailed("Could not prepare the trip request.")))
            return
        }

        send(path: "/api/trips", method: "POST", body: data) { result in
            completion(result.flatMap { data in
                do {
                    let response = try JSONDecoder().decode(NativeTripResponse.self, from: data)
                    return .success(response.trip)
                } catch {
                    return .failure(error)
                }
            })
        }
    }

    func updateTrip(
        id: String,
        draft: NativeTripDraft,
        completion: @escaping (Result<NativeMapTrip, Error>) -> Void
    ) {
        let payload: [String: Any] = [
            "name": draft.name,
            "destination": draft.destination,
            "destination_status": "resolved",
            "destination_lat": draft.coordinate.latitude,
            "destination_lng": draft.coordinate.longitude,
            "destination_formatted_address": draft.destination,
            "start_date": draft.startDate as Any? ?? NSNull(),
            "end_date": draft.endDate as Any? ?? NSNull(),
            "status": "Planning",
            "travel_style": "balanced",
            "budget": 0
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload) else {
            completion(.failure(NativeTripStoreError.requestFailed("Could not prepare the trip request.")))
            return
        }

        send(path: "/api/trips/\(id)", method: "PATCH", body: data) { result in
            completion(result.flatMap { data in
                do {
                    return .success(try JSONDecoder().decode(NativeTripResponse.self, from: data).trip)
                } catch {
                    return .failure(error)
                }
            })
        }
    }

    func deleteTrip(id: String, completion: @escaping (Result<Void, Error>) -> Void) {
        send(path: "/api/trips/\(id)", method: "DELETE", body: nil) { result in
            completion(result.map { _ in () })
        }
    }

    func resolveDestinationHeroImage(
        query: String,
        minimumPixelDimension: Int = 0,
        completion: @escaping (URL?) -> Void
    ) {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedQuery.isEmpty else {
            completion(nil)
            return
        }
        nativeImageryDebug("Automatic image lookup query=\(normalizedQuery)")

        func chooseQualityURL(_ candidates: [URL], completion: @escaping (URL?) -> Void) {
            // The server already returns destination-ranked photo URLs and the
            // proxy applies the requested 3200px width. Pre-downloading every
            // candidate here duplicated network and decode work, delayed the
            // UI, and could reject otherwise usable provider formats. Let the
            // background controller download, display, and cache the top-ranked
            // destination image exactly once.
            completion(candidates.first)
        }

        func resolve(_ candidate: String, retryWithLandmark: Bool) {
            guard let body = try? JSONSerialization.data(withJSONObject: [
                "address": NSNull(),
                "city": NSNull(),
                "country": NSNull(),
                "locationHint": NSNull(),
                "name": candidate
            ]) else {
                completion(nil)
                return
            }

            send(path: "/api/travel-data/resolve-place", method: "POST", body: body) { [baseURL] result in
                guard case .success(let data) = result else {
                    if case .failure(let error) = result {
                        nativeImageryDebug("Automatic resolve request failed query=\(candidate) category=\(Self.imageryErrorCategory(error))")
                    }
                    completion(nil)
                    return
                }
                guard let response = try? JSONDecoder().decode(NativeDestinationHeroResponse.self, from: data) else {
                    nativeImageryDebug("Automatic resolve response invalid query=\(candidate) category=decode")
                    completion(nil)
                    return
                }
                let resolved = response.data.resolved
                nativeImageryDebug("Automatic resolve result query=\(candidate) provider=\(resolved.provider ?? "none") status=\(resolved.diagnostics?.status ?? "unknown") error=\(resolved.diagnostics?.lastErrorCode ?? "none") count=\(resolved.diagnostics?.providerResultCount ?? 0) latitude=\(resolved.latitude ?? 0) longitude=\(resolved.longitude ?? 0) hasImage=\(resolved.inventoryItem?.imageUrl != nil)")

                func highResolutionURL(_ imagePath: String?) -> URL? {
                    guard let imagePath,
                          let resolvedURL = URL(string: imagePath, relativeTo: baseURL)?.absoluteURL else {
                        return nil
                    }
                    var components = URLComponents(url: resolvedURL, resolvingAgainstBaseURL: false)
                    var queryItems = components?.queryItems?.filter { $0.name != "maxWidth" } ?? []
                    queryItems.append(URLQueryItem(name: "maxWidth", value: "3200"))
                    components?.queryItems = queryItems
                    return components?.url ?? resolvedURL
                }

                let inventoryURL = highResolutionURL(response.data.resolved.inventoryItem?.imageUrl)
                guard let latitude = response.data.resolved.latitude,
                      let longitude = response.data.resolved.longitude,
                      let suggestionsBody = try? JSONSerialization.data(withJSONObject: [
                        "latitude": latitude,
                        "longitude": longitude,
                        "limit": 12,
                        "purpose": "postcard_gallery",
                        "radiusMeters": 25_000,
                        "title": normalizedQuery,
                        "tripId": NSNull()
                      ]) else {
                    chooseQualityURL([inventoryURL].compactMap { $0 }) { url in
                        if let url { completion(url) }
                        else if retryWithLandmark {
                            resolve("\(normalizedQuery) most visited iconic landmark", retryWithLandmark: false)
                        } else { completion(nil) }
                    }
                    return
                }

                self.send(path: "/api/travel-data/suggestions", method: "POST", body: suggestionsBody) { result in
                    let galleryURLs: [URL]
                    if case .success(let data) = result,
                       let gallery = try? JSONDecoder().decode(NativeDestinationImageBankResponse.self, from: data) {
                        galleryURLs = gallery.data.suggestions.compactMap { highResolutionURL($0.imageUrl) }
                    } else {
                        galleryURLs = []
                    }
                    nativeImageryDebug("Automatic suggestion result query=\(normalizedQuery) count=\(galleryURLs.count)")
                    chooseQualityURL(galleryURLs + [inventoryURL].compactMap { $0 }) { url in
                        if let url { completion(url) }
                        else if retryWithLandmark {
                            resolve("\(normalizedQuery) most visited iconic landmark", retryWithLandmark: false)
                        } else { completion(nil) }
                    }
                }
            }
        }

        resolve(normalizedQuery, retryWithLandmark: true)
    }

    func resolveDestinationImageBank(
        query: String,
        completion: @escaping ([NativeDestinationImageChoice]) -> Void
    ) {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedQuery.isEmpty,
              let body = try? JSONSerialization.data(withJSONObject: [
                "address": NSNull(),
                "city": NSNull(),
                "country": NSNull(),
                "locationHint": NSNull(),
                "name": normalizedQuery
              ]) else {
            completion([])
            return
        }
        nativeImageryDebug("Picker image lookup query=\(normalizedQuery)")

        send(path: "/api/travel-data/resolve-place", method: "POST", body: body) { [baseURL] result in
            guard case .success(let data) = result,
                  let response = try? JSONDecoder().decode(NativeDestinationHeroResponse.self, from: data),
                  let latitude = response.data.resolved.latitude,
                  let longitude = response.data.resolved.longitude,
                  let suggestionsBody = try? JSONSerialization.data(withJSONObject: [
                    "latitude": latitude,
                    "longitude": longitude,
                    "limit": 10,
                    "purpose": "postcard_gallery",
                    "radiusMeters": 25_000,
                    "title": normalizedQuery,
                    "tripId": NSNull()
                  ]) else {
                nativeImageryDebug("Picker resolve failed query=\(normalizedQuery) category=resolve_or_decode")
                completion([])
                return
            }

            var initialOptions: [NativeDestinationImageChoice] = []
            if let inventory = response.data.resolved.inventoryItem,
               let imagePath = inventory.imageUrl,
               let resolvedURL = URL(string: imagePath, relativeTo: baseURL)?.absoluteURL {
                var components = URLComponents(url: resolvedURL, resolvingAgainstBaseURL: false)
                var queryItems = components?.queryItems?.filter { $0.name != "maxWidth" } ?? []
                queryItems.append(URLQueryItem(name: "maxWidth", value: "2400"))
                components?.queryItems = queryItems
                initialOptions.append(NativeDestinationImageChoice(
                    attribution: "Google",
                    title: inventory.title ?? normalizedQuery,
                    url: components?.url ?? resolvedURL
                ))
            }

            self.send(path: "/api/travel-data/suggestions", method: "POST", body: suggestionsBody) { result in
                guard case .success(let data) = result,
                      let response = try? JSONDecoder().decode(NativeDestinationImageBankResponse.self, from: data) else {
                    nativeImageryDebug("Picker suggestions failed query=\(normalizedQuery) category=request_or_decode fallbackCount=\(initialOptions.count)")
                    completion(initialOptions)
                    return
                }
                var seen = Set(initialOptions.map { $0.url.absoluteString })
                let options = response.data.suggestions.compactMap { suggestion -> NativeDestinationImageChoice? in
                    guard let imagePath = suggestion.imageUrl,
                          let resolvedURL = URL(string: imagePath, relativeTo: baseURL)?.absoluteURL else { return nil }
                    var components = URLComponents(url: resolvedURL, resolvingAgainstBaseURL: false)
                    var queryItems = components?.queryItems?.filter { $0.name != "maxWidth" } ?? []
                    queryItems.append(URLQueryItem(name: "maxWidth", value: "2400"))
                    components?.queryItems = queryItems
                    let url = components?.url ?? resolvedURL
                    guard seen.insert(url.absoluteString).inserted else { return nil }
                    let credit = [suggestion.imageProvider, suggestion.imageAttribution]
                        .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
                        .filter { !$0.isEmpty }
                        .joined(separator: " • ")
                    return NativeDestinationImageChoice(
                        attribution: credit.isEmpty ? "Google" : credit,
                        title: suggestion.title,
                        url: url
                    )
                }
                nativeImageryDebug("Picker suggestions result query=\(normalizedQuery) count=\(initialOptions.count + options.count)")
                completion(initialOptions + options)
            }
        }
    }

    private static func imageryErrorCategory(_ error: Error) -> String {
        if error is URLError { return "network" }
        if let storeError = error as? NativeTripStoreError {
            switch storeError {
            case .unauthorized: return "unauthorized"
            case .invalidResponse: return "invalid_response"
            case .requestFailed: return "server_request"
            }
        }
        return "server_request"
    }

    func submitSocialImport(
        sourceURL: String?,
        rawText: String?,
        imageData: Data?,
        completion: @escaping (Result<NativeImportResult, Error>) -> Void
    ) {
        let boundary = "Boundary-\(UUID().uuidString)"
        var body = Data()
        appendMultipartField(&body, boundary: boundary, name: "processNow", value: "true")
        appendMultipartField(&body, boundary: boundary, name: "sourcePlatform", value: imageData == nil ? "manual" : "screenshot")
        if let sourceURL, !sourceURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            appendMultipartField(&body, boundary: boundary, name: "sourceUrl", value: sourceURL)
        }
        if let rawText, !rawText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            appendMultipartField(&body, boundary: boundary, name: "rawText", value: rawText)
        }
        if let imageData {
            appendMultipartFile(&body, boundary: boundary, name: "file", filename: "capture.jpg", mimeType: "image/jpeg", data: imageData)
        }
        body.append(Data("--\(boundary)--\r\n".utf8))

        guard let url = URL(string: "/api/social-imports", relativeTo: baseURL) else {
            completion(.failure(NativeTripStoreError.invalidResponse))
            return
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = body
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue(baseURL.absoluteString, forHTTPHeaderField: "Origin")
        request.setValue(baseURL.absoluteString + "/dashboard/imports", forHTTPHeaderField: "Referer")
        apiClient.request(request, completion: { result in
            completion(result.flatMap { data in
                do {
                    let response = try JSONDecoder().decode(NativeImportResponse.self, from: data)
                    return .success(NativeImportResult(
                        extractedPlaceCount: response.data.extractedPlaces.count,
                        status: response.data.socialImport.status
                    ))
                } catch {
                    return .failure(error)
                }
            })
        })
    }

    private func send(
        path: String,
        method: String,
        body: Data?,
        completion: @escaping (Result<Data, Error>) -> Void
    ) {
        apiClient.request(path: path, method: method, body: body, completion: completion)
    }

    private func appendMultipartField(_ body: inout Data, boundary: String, name: String, value: String) {
        body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".utf8))
    }

    private func appendMultipartFile(_ body: inout Data, boundary: String, name: String, filename: String, mimeType: String, data: Data) {
        body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\nContent-Type: \(mimeType)\r\n\r\n".utf8))
        body.append(data)
        body.append(Data("\r\n".utf8))
    }
}

private struct NativeTripListResponse: Decodable {
    let trips: [NativeMapTrip]
}

private struct NativeTripResponse: Decodable {
    let trip: NativeMapTrip
}

private struct NativeImportResponse: Decodable {
    let data: NativeImportData
}

private struct NativeImportData: Decodable {
    let extractedPlaces: [NativeImportedPlace]
    let socialImport: NativeImportedPost
}

private struct NativeImportedPlace: Decodable {
    let id: String?
}

private struct NativeImportedPost: Decodable {
    let status: String
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

private final class NativeMapAutocompleteDelegate: NSObject, MKLocalSearchCompleterDelegate {
    let onResults: ([MKLocalSearchCompletion]?, Error?) -> Void

    init(onResults: @escaping ([MKLocalSearchCompletion]?, Error?) -> Void) {
        self.onResults = onResults
        super.init()
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        onResults(completer.results, nil)
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        onResults(nil, error)
    }
}

@objc(MapGatewayPlugin)
public final class MapGatewayPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MapGatewayPlugin"
    public let jsName = "MapGateway"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initializeNativeMapUnderlay", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setNativeMapInteractiveRegions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "autocomplete", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resolveAutocomplete", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncPayloadToNative", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "acknowledgeReceipt", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getNativeAuthSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncNativeAuthSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearNativeAuthSession", returnType: CAPPluginReturnPromise)
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
    private var autocompleteCompleter: MKLocalSearchCompleter?
    private var autocompleteDelegate: NativeMapAutocompleteDelegate?
    private var authObserver: NSObjectProtocol?
    private let authLogger = Logger(subsystem: "app.almidy", category: "native-auth-bridge")

    public override func load() {
        super.load()
        authObserver = NotificationCenter.default.addObserver(
            forName: .nativeAuthSessionChanged,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let contract = notification.object as? NativeAuthSessionContract else { return }
            self?.notifyAuthStateChanged(contract)
        }
    }

    deinit {
        if let authObserver {
            NotificationCenter.default.removeObserver(authObserver)
        }
    }

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

    @objc func autocomplete(_ call: CAPPluginCall) {
        guard let query = call.getString("query")?.trimmingCharacters(in: .whitespacesAndNewlines),
              query.count >= 2 else {
            call.resolve(["results": []])
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }

            self.autocompleteCompleter?.cancel()
            let completer = MKLocalSearchCompleter()
            let delegate = NativeMapAutocompleteDelegate { [weak self] results, error in
                guard let self else { return }
                if let error {
                    call.reject(error.localizedDescription, "native_map_autocomplete_failed")
                } else {
                    let suggestions = (results ?? []).prefix(6).map { completion in
                        [
                            "id": "\(completion.title)|\(completion.subtitle)",
                            "title": completion.title,
                            "subtitle": completion.subtitle
                        ]
                    }
                    call.resolve(["results": Array(suggestions)])
                }

                self.autocompleteCompleter = nil
                self.autocompleteDelegate = nil
            }

            completer.delegate = delegate
            if let mapView = self.nativeMapUnderlay {
                completer.region = mapView.region
            }
            self.autocompleteCompleter = completer
            self.autocompleteDelegate = delegate
            completer.queryFragment = query
        }
    }

    @objc func resolveAutocomplete(_ call: CAPPluginCall) {
        guard let title = call.getString("title"),
              let subtitle = call.getString("subtitle") else {
            call.reject("Autocomplete selection is missing its title or subtitle.", "invalid_native_map_autocomplete_selection")
            return
        }

        DispatchQueue.main.async {
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = [title, subtitle].filter { !$0.isEmpty }.joined(separator: ", ")
            MKLocalSearch(request: request).start { response, error in
                if let error {
                    call.reject(error.localizedDescription, "native_map_autocomplete_resolve_failed")
                    return
                }

                guard let item = response?.mapItems.first else {
                    call.reject("Apple Maps returned no destination for that suggestion.", "native_map_autocomplete_empty")
                    return
                }

                let placemark = item.placemark
                let coordinate = placemark.coordinate
                let address = placemark.title ?? item.name ?? [title, subtitle].filter { !$0.isEmpty }.joined(separator: ", ")
                call.resolve([
                    "address": address,
                    "formattedAddress": address,
                    "lat": coordinate.latitude,
                    "lng": coordinate.longitude,
                    "name": item.name ?? title,
                    "placeId": "",
                    "providerMetadata": [
                        "provider": "apple_mapkit",
                        "source": "local_search_completer",
                        "title": title,
                        "subtitle": subtitle
                    ]
                ])
            }
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

    @objc func getNativeAuthSession(_ call: CAPPluginCall) {
        let coordinator = NativeSessionCoordinator.shared
        if case .expired = coordinator.state {
            coordinator.validSession { [weak self] _ in
                DispatchQueue.main.async { self?.resolveNativeAuthSession(call) }
            }
            return
        }
        resolveNativeAuthSession(call)
    }

    private func resolveNativeAuthSession(_ call: CAPPluginCall) {
        let coordinator = NativeSessionCoordinator.shared
        let session = coordinator.session
        let contractState: NativeAuthSessionContract.State
        let generation: Int64?
        switch coordinator.state {
        case .missing:
            contractState = .missing
            generation = nil
        case .valid:
            contractState = .valid
            generation = nil
        case .expired:
            contractState = .expired
            generation = nil
        case .invalid:
            contractState = .invalid
            generation = nil
        case .explicitlySignedOut(let marker):
            contractState = .explicitlySignedOut
            generation = marker.generation
        }
        let contract = NativeAuthSessionContract(
            event: contractState == .explicitlySignedOut ? .signedOut : .signedIn,
            revisionId: Int64(Date().timeIntervalSince1970 * 1000),
            accessToken: session?.accessToken,
            refreshToken: session?.refreshToken,
            expiresAt: session?.expiresAt,
            isSignedIn: session != nil,
            signOutGeneration: generation,
            state: contractState
        )
        call.resolve(contractDictionary(contract))
    }

    @objc func syncNativeAuthSession(_ call: CAPPluginCall) {
        guard let jsonString = call.getString("jsonString"),
              let data = jsonString.data(using: .utf8),
              let contract = try? JSONDecoder().decode(NativeAuthSessionContract.self, from: data) else {
            authLogger.error("Session sync rejected: malformed_contract")
            call.reject("Malformed native authentication session contract.", "invalid_native_auth_session")
            return
        }

        if contract.event == .signedOut || contract.state == .explicitlySignedOut {
            NativeSessionCoordinator.shared.explicitSignOut(generation: contract.signOutGeneration ?? contract.revisionId)
            authLogger.info("Session sync completed: event=SIGNED_OUT state=explicitly_signed_out revision=\(contract.revisionId, privacy: .public)")
            call.resolve(["success": true])
            return
        }

        guard let accessToken = contract.accessToken, !accessToken.isEmpty,
              let refreshToken = contract.refreshToken, !refreshToken.isEmpty,
              let expiresAt = contract.expiresAt, expiresAt > 0 else {
            authLogger.error("Session sync rejected: incomplete_signed_in_credentials")
            call.reject("Signed-in authentication state is incomplete.", "invalid_native_auth_session")
            return
        }
        let importResult = NativeSessionCoordinator.shared.importWebSession(NativeAuthSession(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: expiresAt
        ), revision: contract.revisionId)
        guard importResult.isAccepted else {
            authLogger.error("Session sync rejected: stale_session revision=\(contract.revisionId, privacy: .public)")
            call.reject("The Web session is older than the explicit sign-out state.", "stale_native_auth_session")
            return
        }
        if importResult == .unchanged {
            authLogger.info("Session import ignored: logical session unchanged origin=web_import state=valid revision=\(contract.revisionId, privacy: .public)")
        }
        authLogger.info("Session sync completed: event=\(contract.event.rawValue, privacy: .public) state=\(contract.state.rawValue, privacy: .public) credentialsPresent=true expired=\(expiresAt <= Int(Date().timeIntervalSince1970), privacy: .public) revision=\(contract.revisionId, privacy: .public)")
        call.resolve(["success": true])
    }

    @objc func clearNativeAuthSession(_ call: CAPPluginCall) {
        if case .explicitlySignedOut = NativeSessionCoordinator.shared.state {
            call.resolve(["success": true])
            return
        }
        NativeSessionCoordinator.shared.explicitSignOut()
        call.resolve(["success": true])
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

    private func notifyAuthStateChanged(_ contract: NativeAuthSessionContract) {
        notifyListeners("nativeAuthStateChanged", data: contractDictionary(contract))
    }

    private func contractDictionary(_ contract: NativeAuthSessionContract) -> [String: Any] {
        guard let data = try? JSONEncoder().encode(contract),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return ["event": contract.event.rawValue, "revisionId": contract.revisionId, "isSignedIn": contract.isSignedIn]
        }
        return object
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
        if #available(iOS 16.0, *) {
            let configuration = MKHybridMapConfiguration(elevationStyle: .realistic)
            configuration.pointOfInterestFilter = .includingAll
            configuration.showsTraffic = false
            mapView.preferredConfiguration = configuration
        } else {
            mapView.mapType = .hybridFlyover
        }
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

struct NativeMapTrip: Decodable {
    let dateRange: String?
    let destination: String?
    let endDate: String?
    let href: String?
    let id: String
    let imageUrl: String?
    let latitude: Double?
    let longitude: Double?
    let name: String?
    let startDate: String?
    let status: String?

    private enum CodingKeys: String, CodingKey {
        case dateRange, destination, destinationLat = "destination_lat", destinationLng = "destination_lng"
        case endDate = "end_date", href, id, imageUrl, latitude, longitude, name, route, startDate = "start_date", status
    }

    init(
        id: String,
        name: String,
        destination: String,
        latitude: Double,
        longitude: Double,
        dateRange: String? = nil,
        startDate: String? = nil,
        endDate: String? = nil,
        href: String? = nil,
        imageUrl: String? = nil,
        status: String? = "Planning"
    ) {
        self.dateRange = dateRange
        self.destination = destination
        self.endDate = endDate
        self.href = href
        self.id = id
        self.imageUrl = imageUrl
        self.latitude = latitude
        self.longitude = longitude
        self.name = name
        self.startDate = startDate
        self.status = status
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        let decodedStart = try values.decodeIfPresent(String.self, forKey: .startDate)
        let decodedEnd = try values.decodeIfPresent(String.self, forKey: .endDate)
        let decodedDateRange = try values.decodeIfPresent(String.self, forKey: .dateRange)

        self.dateRange = decodedDateRange ?? Self.dateRange(start: decodedStart, end: decodedEnd)
        self.destination = try values.decodeIfPresent(String.self, forKey: .destination)
        self.endDate = decodedEnd
        self.href = try values.decodeIfPresent(String.self, forKey: .href) ?? values.decodeIfPresent(String.self, forKey: .route)
        self.id = try values.decode(String.self, forKey: .id)
        self.imageUrl = try values.decodeIfPresent(String.self, forKey: .imageUrl)
        self.latitude = try values.decodeIfPresent(Double.self, forKey: .latitude)
            ?? values.decodeIfPresent(Double.self, forKey: .destinationLat)
        self.longitude = try values.decodeIfPresent(Double.self, forKey: .longitude)
            ?? values.decodeIfPresent(Double.self, forKey: .destinationLng)
        self.name = try values.decodeIfPresent(String.self, forKey: .name)
        self.startDate = decodedStart
        self.status = try values.decodeIfPresent(String.self, forKey: .status)
    }

    private static func dateRange(start: String?, end: String?) -> String? {
        switch (start, end) {
        case let (start?, end?): return "\(start) – \(end)"
        case let (start?, nil): return start
        case let (nil, end?): return end
        case (nil, nil): return nil
        }
    }

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
    private static let populatedGlobeDistance: CLLocationDistance = 25_000_000
    private static let populatedGlobeVerticalOffset: CGFloat = 0
    private static let populatedGlobeLongitude: CLLocationDegrees = -108

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
    private var trips: [NativeMapTrip]
    private let tripStore: NativeTripStore?
    private let sourceWebView: WKWebView?
    private let sheetView = UIView()
    private let sheetHandle = UIView()
    private let headerStack = UIStackView()
    private let titleButton = UIButton(type: .system)
    private let chevronImageView = UIImageView(image: UIImage(systemName: "chevron.down"))
    private let settingsButton = UIButton(type: .system)
    private let collapsedActions = UIStackView()
    private let expandedScrollView = UIScrollView()
    private let expandedContentStack = UIStackView()
    private var expandedContentWidthConstraint: NSLayoutConstraint?
    private let mapControlStack = UIStackView()
    private var firstTripCard: UIView?
    private var sheetBottomConstraint: NSLayoutConstraint?
    private var sheetHeightConstraint: NSLayoutConstraint?
    private var mapTopConstraint: NSLayoutConstraint?
    private var mapBottomConstraint: NSLayoutConstraint?
    private var mapControlTopConstraint: NSLayoutConstraint?
    private var sheetState: SheetState
    private var panStartHeight: CGFloat = 0
    private var hasPlayedIntroCamera = false
    private var isConnected: Bool?
    private var isNetworkMonitorRunning = false
    private var mapPresentationMode: MapPresentationMode = .hybrid
    private var usesExpandedGlobeConfiguration = false
    private var mapFallbackReason: MapFallbackReason?
    private var offlineOverlayView: UIView?
    private weak var offlineRetryButton: UIButton?
    private var pendingCameraTelemetry: MKMapCamera?
    private var preservedCamera: MKMapCamera?
    private var resolvedLegacyTripCoordinates: [String: CLLocationCoordinate2D] = [:]
    private var resolvingLegacyTripIDs: Set<String> = []
    private var isRequestingLocationAuthorization = false
    private var hasRequestedInitialLocation = false
    private var hasCenteredInitialLocation = false
    private var reservationCardVisible = !UserDefaults.standard.bool(forKey: "almidy.native.reservationCardDismissed")

    init(
        trips: [NativeMapTrip],
        monitorsNetworkConnectivity: Bool = true,
        tripStore: NativeTripStore? = nil,
        sourceWebView: WKWebView? = nil
    ) {
        self.trips = trips
        self.monitorsNetworkConnectivity = monitorsNetworkConnectivity
        self.tripStore = tripStore
        self.sourceWebView = sourceWebView
        self.sheetState = .collapsed
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = AlmidyDesignTokens.Color.mapSurface
        trips.forEach { warmTripBackground($0) }
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
        if !hasRequestedInitialLocation {
            hasRequestedInitialLocation = true
            requestCurrentLocation()
        }
        refreshTripsFromServer()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        mapControlTopConstraint?.constant = NativeAdaptiveLayout.isCompactHeight(view) ? 16 : 142
        updateExpandedContentWidthPriority(for: view.bounds.width)
        let nextHeight = height(for: sheetState)
        if abs((sheetHeightConstraint?.constant ?? 0) - nextHeight) > 0.5 {
            sheetHeightConstraint?.constant = nextHeight
        }
    }

    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        coordinator.animate(alongsideTransition: { [weak self] _ in
            guard let self else { return }
            self.sheetHeightConstraint?.constant = self.height(for: self.sheetState, containerSize: size)
            self.updateExpandedContentWidthPriority(for: size.width)
            self.view.layoutIfNeeded()
        })
    }

    func refreshTripsFromServer() {
        tripStore?.loadTrips { [weak self] result in
            guard let self else { return }
            if case .success(let trips) = result {
                self.replaceTrips(trips)
            }
        }
    }

    func createTripFromServer(
        _ draft: NativeTripDraft,
        completion: @escaping (Result<NativeMapTrip, Error>) -> Void
    ) {
        guard let tripStore else {
            completion(.failure(NativeTripStoreError.requestFailed("Native trip persistence is unavailable.")))
            return
        }
        tripStore.createTrip(draft) { [weak self] result in
            if case .success(let trip) = result {
                self?.replaceTrip(trip)
            }
            completion(result)
        }
    }

    func updateTripFromServer(
        id: String,
        draft: NativeTripDraft,
        completion: @escaping (Result<NativeMapTrip, Error>) -> Void
    ) {
        guard let tripStore else {
            completion(.failure(NativeTripStoreError.requestFailed("Native trip persistence is unavailable.")))
            return
        }
        tripStore.updateTrip(id: id, draft: draft) { [weak self] result in
            if case .success(let trip) = result {
                self?.replaceTrip(trip)
            }
            completion(result)
        }
    }

    func deleteTripFromServer(
        id: String,
        completion: ((Result<Void, Error>) -> Void)? = nil
    ) {
        guard let tripStore else {
            completion?(.failure(NativeTripStoreError.requestFailed("Native trip persistence is unavailable.")))
            return
        }
        tripStore.deleteTrip(id: id) { [weak self] result in
            switch result {
            case .success:
                self?.refreshTripsFromServer()
                completion?(.success(()))
            case .failure(let error):
                completion?(.failure(error))
            }
        }
    }

    private func replaceTrips(_ nextTrips: [NativeMapTrip]) {
        let previouslyHadTrips = !trips.isEmpty
        trips = nextTrips
        let activeTripIDs = Set(nextTrips.map(\.id))
        resolvedLegacyTripCoordinates = resolvedLegacyTripCoordinates.filter { activeTripIDs.contains($0.key) }
        resolvingLegacyTripIDs.formIntersection(activeTripIDs)
        nextTrips.forEach { warmTripBackground($0) }
        updateMapFramingForTripAvailability(
            zoomsToPopulatedGlobe: !previouslyHadTrips && !nextTrips.isEmpty
        )
        addTripPins()
        renderSheetContent()
    }

    deinit {
        networkMonitor.pathUpdateHandler = nil
        networkMonitor.cancel()
    }

    private func configureMap() {
        mapView.translatesAutoresizingMaskIntoConstraints = false
        mapView.delegate = self
        mapView.pointOfInterestFilter = trips.isEmpty ? .includingAll : .excludingAll
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
            mapView.setCameraZoomRange(
                MKMapView.CameraZoomRange(
                    minCenterCoordinateDistance: 900,
                    maxCenterCoordinateDistance: 90_000_000
                ),
                animated: false
            )
        }
        applyMapPresentation(.hybrid)
        view.addSubview(mapView)

        let populatedLaunchVerticalOffset: CGFloat = trips.isEmpty ? 0 : Self.populatedGlobeVerticalOffset
        let mapTopConstraint = mapView.topAnchor.constraint(
            equalTo: view.topAnchor,
            constant: populatedLaunchVerticalOffset
        )
        let mapBottomConstraint = mapView.bottomAnchor.constraint(
            equalTo: view.bottomAnchor,
            constant: populatedLaunchVerticalOffset
        )
        self.mapTopConstraint = mapTopConstraint
        self.mapBottomConstraint = mapBottomConstraint
        NSLayoutConstraint.activate([
            mapTopConstraint,
            mapView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            mapView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            mapBottomConstraint
        ])

        let initialDistance: CLLocationDistance = trips.isEmpty ? 10_000_000 : Self.populatedGlobeDistance
        let initialLongitude = trips.isEmpty ? -96.0 : Self.populatedGlobeLongitude
        mapView.setCamera(globeCamera(distance: initialDistance, heading: 0, longitude: initialLongitude), animated: false)
        if let pendingCameraTelemetry {
            applyCameraTelemetry(pendingCameraTelemetry)
            self.pendingCameraTelemetry = nil
        }
    }

    private func updateMapFramingForTripAvailability(zoomsToPopulatedGlobe: Bool) {
        let verticalOffset: CGFloat = trips.isEmpty ? 0 : Self.populatedGlobeVerticalOffset
        mapTopConstraint?.constant = verticalOffset
        mapBottomConstraint?.constant = verticalOffset
        mapView.pointOfInterestFilter = trips.isEmpty ? .includingAll : .excludingAll
        mapControlStack.isHidden = !trips.isEmpty
        applyMapPresentation(mapPresentationMode)

        if zoomsToPopulatedGlobe {
            mapView.setCamera(
                globeCamera(
                    distance: Self.populatedGlobeDistance,
                    heading: 2,
                    longitude: Self.populatedGlobeLongitude
                ),
                animated: true
            )
        }
    }

    private func playIntroCameraIfNeeded() {
        guard !hasPlayedIntroCamera else { return }
        hasPlayedIntroCamera = true

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
            guard let self else { return }
            let launchDistance: CLLocationDistance = self.trips.isEmpty ? 7_800_000 : Self.populatedGlobeDistance
            let launchLongitude = self.trips.isEmpty ? -96.0 : Self.populatedGlobeLongitude
            self.mapView.setCamera(
                self.globeCamera(distance: launchDistance, heading: 2, longitude: launchLongitude),
                animated: true
            )
        }
    }

    private func globeCamera(
        distance: CLLocationDistance,
        heading: CLLocationDirection,
        longitude: CLLocationDegrees = -96
    ) -> MKMapCamera {
        MKMapCamera(
            lookingAtCenter: CLLocationCoordinate2D(latitude: 42.5, longitude: longitude),
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
        usesExpandedGlobeConfiguration = false
        if #available(iOS 16.0, *) {
            switch mode {
            case .hybrid:
                if !trips.isEmpty {
                    mapView.preferredConfiguration = MKImageryMapConfiguration(elevationStyle: .realistic)
                    return
                }
                let configuration = MKHybridMapConfiguration(elevationStyle: .realistic)
                configuration.pointOfInterestFilter = trips.isEmpty ? .includingAll : .excludingAll
                configuration.showsTraffic = false
                mapView.preferredConfiguration = configuration
            case .imagery:
                mapView.preferredConfiguration = MKImageryMapConfiguration(elevationStyle: .realistic)
            case .standard:
                let configuration = MKStandardMapConfiguration(elevationStyle: .realistic, emphasisStyle: .default)
                configuration.pointOfInterestFilter = trips.isEmpty ? .includingAll : .excludingAll
                configuration.showsTraffic = false
                mapView.preferredConfiguration = configuration
            }
        } else {
            switch mode {
            case .hybrid:
                mapView.mapType = trips.isEmpty ? .hybridFlyover : .satelliteFlyover
            case .imagery:
                mapView.mapType = .satelliteFlyover
            case .standard:
                mapView.mapType = .standard
            }
        }
    }

    private func setExpandedGlobeConfiguration(_ expanded: Bool) {
        guard usesExpandedGlobeConfiguration != expanded else { return }
        usesExpandedGlobeConfiguration = expanded

        if #available(iOS 16.0, *) {
            if expanded {
                let configuration = MKHybridMapConfiguration(elevationStyle: .realistic)
                configuration.pointOfInterestFilter = .excludingAll
                configuration.showsTraffic = false
                mapView.preferredConfiguration = configuration
            } else {
                mapView.preferredConfiguration = MKImageryMapConfiguration(elevationStyle: .realistic)
            }
        } else {
            mapView.mapType = expanded ? .hybridFlyover : .satelliteFlyover
        }

        let geographicLabels = mapView.annotations.compactMap { $0 as? NativeGeographicLabelAnnotation }
        if expanded {
            mapView.removeAnnotations(geographicLabels)
        } else if geographicLabels.isEmpty {
            mapView.addAnnotations(NativeGeographicLabelAnnotation.majorLabels)
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
        overlay.backgroundColor = AlmidyDesignTokens.Color.settingsBackground.withAlphaComponent(0.98)
        overlay.alpha = 0
        overlay.accessibilityViewIsModal = false

        let globeImageView = UIImageView(image: UIImage(named: "AlmidyOfflineGlobe") ?? UIImage(systemName: "globe.americas.fill"))
        globeImageView.contentMode = .scaleAspectFit
        globeImageView.tintColor = AlmidyDesignTokens.Color.offlineGlobeTint
        globeImageView.translatesAutoresizingMaskIntoConstraints = false
        globeImageView.accessibilityElementsHidden = true

        let statusImageView = UIImageView(image: UIImage(systemName: reason == .offline ? "wifi.slash" : "exclamationmark.triangle"))
        statusImageView.contentMode = .scaleAspectFit
        statusImageView.tintColor = AlmidyDesignTokens.Color.goldDark
        statusImageView.translatesAutoresizingMaskIntoConstraints = false
        statusImageView.accessibilityElementsHidden = true

        let titleLabel = UILabel()
        titleLabel.font = AlmidyDesignTokens.Font.title(20)
        titleLabel.textColor = AlmidyDesignTokens.Color.textPrimary
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.accessibilityTraits = .header
        titleLabel.tag = 4101

        let descriptionLabel = UILabel()
        descriptionLabel.font = .systemFont(ofSize: 14, weight: .regular)
        descriptionLabel.textColor = AlmidyDesignTokens.Color.textSecondary
        descriptionLabel.numberOfLines = 0
        descriptionLabel.textAlignment = .center
        descriptionLabel.translatesAutoresizingMaskIntoConstraints = false
        descriptionLabel.tag = 4102

        let retryButton = UIButton(type: .system)
        var retryConfiguration = UIButton.Configuration.filled()
        retryConfiguration.title = "Try again"
        retryConfiguration.image = UIImage(systemName: "arrow.clockwise")
        retryConfiguration.imagePadding = 8
        retryConfiguration.baseBackgroundColor = AlmidyDesignTokens.Color.gold
        retryConfiguration.baseForegroundColor = AlmidyDesignTokens.Color.settingsText
        retryConfiguration.cornerStyle = .capsule
        retryButton.configuration = retryConfiguration
        retryButton.titleLabel?.font = AlmidyDesignTokens.Font.button(14)
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
        mapControlStack.backgroundColor = AlmidyDesignTokens.Color.surface.withAlphaComponent(0.92)
        mapControlStack.layer.cornerRadius = AlmidyDesignTokens.Radius.card
        mapControlStack.clipsToBounds = true
        mapControlStack.isHidden = !trips.isEmpty
        mapControlStack.translatesAutoresizingMaskIntoConstraints = false

        let mapModeButton = mapControlButton(systemName: "map", accessibilityLabel: "Change map mode")
        mapModeButton.addTarget(self, action: #selector(toggleMapMode), for: .touchUpInside)

        let separator = UIView()
        separator.backgroundColor = AlmidyDesignTokens.Color.line
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

        mapControlTopConstraint = mapControlStack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 142)
        NSLayoutConstraint.activate([
            mapControlStack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            mapControlTopConstraint!,
            mapControlStack.widthAnchor.constraint(equalToConstant: 58)
        ])
    }

    private func mapControlButton(systemName: String, accessibilityLabel: String) -> UIButton {
        let button = UIButton(type: .system)
        button.tintColor = AlmidyDesignTokens.Color.textPrimary
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
        sheetView.backgroundColor = AlmidyDesignTokens.Color.surface
        sheetView.layer.cornerRadius = 40
        sheetView.layer.maskedCorners = [
            .layerMinXMinYCorner,
            .layerMaxXMinYCorner,
            .layerMinXMaxYCorner,
            .layerMaxXMaxYCorner
        ]
        sheetView.layer.shadowColor = AlmidyDesignTokens.Color.shadowBlack.cgColor
        sheetView.layer.shadowOpacity = 0.20
        sheetView.layer.shadowRadius = 34
        sheetView.layer.shadowOffset = CGSize(width: 0, height: -4)
        view.addSubview(sheetView)

        sheetBottomConstraint = sheetView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -12)
        sheetHeightConstraint = sheetView.heightAnchor.constraint(equalToConstant: height(for: sheetState))
        NSLayoutConstraint.activate([
            sheetView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 8),
            sheetView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -8),
            sheetBottomConstraint!,
            sheetHeightConstraint!
        ])

        let pan = UIPanGestureRecognizer(target: self, action: #selector(handleSheetPan(_:)))
        sheetView.addGestureRecognizer(pan)

        sheetHandle.backgroundColor = AlmidyDesignTokens.Color.textTertiary
        sheetHandle.layer.cornerRadius = 3
        sheetHandle.translatesAutoresizingMaskIntoConstraints = false
        sheetView.addSubview(sheetHandle)

        headerStack.axis = .horizontal
        headerStack.alignment = .center
        headerStack.spacing = 10
        headerStack.translatesAutoresizingMaskIntoConstraints = false
        sheetView.addSubview(headerStack)

        titleButton.setTitle("My Trips", for: .normal)
        titleButton.setTitleColor(AlmidyDesignTokens.Color.textPrimary, for: .normal)
        titleButton.titleLabel?.font = AlmidyDesignTokens.Font.display(32)
        titleButton.titleLabel?.adjustsFontSizeToFitWidth = true
        titleButton.titleLabel?.minimumScaleFactor = 0.72
        titleButton.contentHorizontalAlignment = .left
        titleButton.accessibilityLabel = "My Trips"
        titleButton.accessibilityHint = "Expands or collapses the trip wallet"
        titleButton.addTarget(self, action: #selector(toggleSheetFromTitle), for: .touchUpInside)

        chevronImageView.tintColor = AlmidyDesignTokens.Color.textSecondary
        chevronImageView.contentMode = .scaleAspectFit
        chevronImageView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            chevronImageView.widthAnchor.constraint(equalToConstant: 24),
            chevronImageView.heightAnchor.constraint(equalToConstant: 24)
        ])

        settingsButton.backgroundColor = AlmidyDesignTokens.Color.avatarPeachSurface
        settingsButton.tintColor = AlmidyDesignTokens.Color.gold
        settingsButton.layer.cornerRadius = 23
        settingsButton.setImage(NativeLaunchSettingsIcon.image, for: .normal)
        settingsButton.transform = CGAffineTransform(translationX: 6, y: -4)
        settingsButton.accessibilityLabel = "Open Settings"
        settingsButton.addTarget(self, action: #selector(openSettings), for: .touchUpInside)
        settingsButton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            settingsButton.widthAnchor.constraint(equalToConstant: 46),
            settingsButton.heightAnchor.constraint(equalToConstant: 46)
        ])

        let titleGroup = UIStackView(arrangedSubviews: [titleButton, chevronImageView])
        titleGroup.axis = .horizontal
        titleGroup.alignment = .center
        titleGroup.spacing = 4
        titleButton.setContentHuggingPriority(.required, for: .horizontal)
        titleGroup.setContentHuggingPriority(.required, for: .horizontal)

        let headerSpacer = UIView()
        headerSpacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        headerStack.addArrangedSubview(titleGroup)
        headerStack.addArrangedSubview(headerSpacer)
        headerStack.addArrangedSubview(settingsButton)

        collapsedActions.axis = .horizontal
        collapsedActions.alignment = .center
        collapsedActions.distribution = .fill
        collapsedActions.spacing = 6
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

        let expandedContentWidthConstraint = expandedContentStack.widthAnchor.constraint(
            equalTo: expandedScrollView.frameLayoutGuide.widthAnchor,
            constant: -56
        )
        expandedContentWidthConstraint.priority = .defaultHigh
        self.expandedContentWidthConstraint = expandedContentWidthConstraint

        NSLayoutConstraint.activate([
            sheetHandle.topAnchor.constraint(equalTo: sheetView.topAnchor, constant: 10),
            sheetHandle.centerXAnchor.constraint(equalTo: sheetView.centerXAnchor),
            sheetHandle.widthAnchor.constraint(equalToConstant: 36),
            sheetHandle.heightAnchor.constraint(equalToConstant: 6),

            headerStack.topAnchor.constraint(equalTo: sheetHandle.bottomAnchor, constant: 8),
            headerStack.centerXAnchor.constraint(equalTo: sheetView.centerXAnchor),
            headerStack.leadingAnchor.constraint(greaterThanOrEqualTo: sheetView.leadingAnchor, constant: 20),
            headerStack.trailingAnchor.constraint(lessThanOrEqualTo: sheetView.trailingAnchor, constant: -20),
            headerStack.widthAnchor.constraint(lessThanOrEqualToConstant: NativeAdaptiveLayout.cardMaxWidth),
            NativeAdaptiveLayout.preferredWidth(headerStack, equalTo: sheetView.widthAnchor, constant: -40),

            collapsedActions.centerXAnchor.constraint(equalTo: sheetView.centerXAnchor),
            collapsedActions.leadingAnchor.constraint(greaterThanOrEqualTo: sheetView.leadingAnchor, constant: 24),
            collapsedActions.trailingAnchor.constraint(lessThanOrEqualTo: sheetView.trailingAnchor, constant: -24),
            collapsedActions.widthAnchor.constraint(lessThanOrEqualToConstant: NativeAdaptiveLayout.cardMaxWidth),
            NativeAdaptiveLayout.preferredWidth(collapsedActions, equalTo: sheetView.widthAnchor, constant: -48),
            collapsedActions.bottomAnchor.constraint(equalTo: sheetView.bottomAnchor, constant: -24),
            collapsedActions.heightAnchor.constraint(equalToConstant: 48),

            expandedScrollView.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 26),
            expandedScrollView.leadingAnchor.constraint(equalTo: sheetView.leadingAnchor),
            expandedScrollView.trailingAnchor.constraint(equalTo: sheetView.trailingAnchor),
            expandedScrollView.bottomAnchor.constraint(equalTo: sheetView.bottomAnchor),

            expandedContentStack.topAnchor.constraint(equalTo: expandedScrollView.contentLayoutGuide.topAnchor),
            expandedContentStack.centerXAnchor.constraint(equalTo: expandedScrollView.frameLayoutGuide.centerXAnchor),
            expandedContentStack.leadingAnchor.constraint(greaterThanOrEqualTo: expandedScrollView.contentLayoutGuide.leadingAnchor, constant: 28),
            expandedContentStack.trailingAnchor.constraint(lessThanOrEqualTo: expandedScrollView.contentLayoutGuide.trailingAnchor, constant: -28),
            expandedContentStack.bottomAnchor.constraint(equalTo: expandedScrollView.contentLayoutGuide.bottomAnchor, constant: -40),
            expandedContentStack.widthAnchor.constraint(lessThanOrEqualTo: expandedScrollView.frameLayoutGuide.widthAnchor, constant: -56),
            expandedContentStack.widthAnchor.constraint(lessThanOrEqualToConstant: NativeAdaptiveLayout.cardMaxWidth),
            expandedContentWidthConstraint
        ])
    }

    private func updateExpandedContentWidthPriority(for containerWidth: CGFloat) {
        let compactWidthLimit = NativeAdaptiveLayout.cardMaxWidth + 56
        expandedContentWidthConstraint?.priority = containerWidth <= compactWidthLimit ? .required : .defaultHigh
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
            installFirstTripCard()
        } else {
            firstTripCard?.removeFromSuperview()
            firstTripCard = nil
            renderCollapsedActions()
            renderTripContent()
        }
        syncSheetVisibility()
    }

    private func renderCollapsedActions() {
        let search = circularButton(systemName: "magnifyingglass", backgroundColor: AlmidyDesignTokens.Color.card, tintColor: AlmidyDesignTokens.Color.textPrimary)
        search.layer.cornerRadius = 24
        search.transform = CGAffineTransform(translationX: -6, y: 0)
        search.accessibilityLabel = "Search the globe"
        search.addTarget(self, action: #selector(openSearch), for: .touchUpInside)

        let book = UIButton(type: .system)
        book.backgroundColor = AlmidyDesignTokens.Color.surface.withAlphaComponent(0.94)
        book.layer.cornerRadius = AlmidyDesignTokens.Radius.card
        book.layer.shadowColor = AlmidyDesignTokens.Color.shadowBlack.cgColor
        book.layer.shadowOpacity = 0.06
        book.layer.shadowRadius = 18
        book.layer.shadowOffset = CGSize(width: 0, height: 9)
        book.addTarget(self, action: #selector(openTravelBook), for: .touchUpInside)
        let countryCount = Set(trips.compactMap { NativeTripCountryPresentation(trip: $0).regionCode }).count
        let tripSummary = "\(trips.count) \(trips.count == 1 ? "trip" : "trips"), "
            + "\(countryCount) \(countryCount == 1 ? "country" : "countries")"
        book.accessibilityLabel = "Open My Almidy Book, \(tripSummary)"

        let bookIcon = UIImageView(image: UIImage(systemName: "globe.americas.fill"))
        bookIcon.tintColor = AlmidyDesignTokens.Color.textPrimary
        bookIcon.contentMode = .scaleAspectFit
        bookIcon.translatesAutoresizingMaskIntoConstraints = false

        let bookTitle = UILabel()
        bookTitle.text = "My Almidy Book"
        bookTitle.textColor = AlmidyDesignTokens.Color.textPrimary
        bookTitle.font = AlmidyDesignTokens.Font.button(15)

        let bookSubtitle = UILabel()
        bookSubtitle.text = tripSummary
        bookSubtitle.textColor = AlmidyDesignTokens.Color.textSecondary
        bookSubtitle.font = AlmidyDesignTokens.Font.body(14)

        let bookLabels = UIStackView(arrangedSubviews: [bookTitle, bookSubtitle])
        bookLabels.axis = .vertical
        bookLabels.alignment = .leading
        bookLabels.spacing = 0

        let bookContent = UIStackView(arrangedSubviews: [bookIcon, bookLabels])
        bookContent.axis = .horizontal
        bookContent.alignment = .center
        bookContent.spacing = 11
        bookContent.isUserInteractionEnabled = false
        bookContent.translatesAutoresizingMaskIntoConstraints = false
        book.addSubview(bookContent)

        NSLayoutConstraint.activate([
            bookIcon.widthAnchor.constraint(equalToConstant: 24),
            bookIcon.heightAnchor.constraint(equalToConstant: 24),
            bookContent.centerYAnchor.constraint(equalTo: book.centerYAnchor),
            bookContent.leadingAnchor.constraint(equalTo: book.leadingAnchor, constant: 18),
            bookContent.trailingAnchor.constraint(lessThanOrEqualTo: book.trailingAnchor, constant: -14)
        ])

        let add = circularButton(
            systemName: "plus",
            backgroundColor: AlmidyDesignTokens.Color.gold,
            tintColor: .white
        )
        add.layer.cornerRadius = 24
        add.transform = CGAffineTransform(translationX: 6, y: 0)
        add.accessibilityLabel = "Create a trip"
        add.addTarget(self, action: #selector(createTrip), for: .touchUpInside)

        collapsedActions.addArrangedSubview(search)
        collapsedActions.addArrangedSubview(book)
        collapsedActions.addArrangedSubview(add)
        book.setContentHuggingPriority(.defaultLow, for: .horizontal)
        NSLayoutConstraint.activate([
            search.widthAnchor.constraint(equalToConstant: 48),
            search.heightAnchor.constraint(equalToConstant: 48),
            book.heightAnchor.constraint(equalToConstant: 48),
            add.widthAnchor.constraint(equalToConstant: 48),
            add.heightAnchor.constraint(equalToConstant: 48)
        ])
    }

    private func renderTripContent() {
        let year = pillLabel(overviewYear, fontSize: 22, textColor: AlmidyDesignTokens.Color.goldSoft, backgroundColor: AlmidyDesignTokens.Color.card)
        expandedContentStack.addArrangedSubview(year)

        let upcoming = UIStackView()
        upcoming.axis = .horizontal
        upcoming.alignment = .center
        upcoming.spacing = 12
        let label = UILabel()
        label.text = "Upcoming"
        label.textColor = AlmidyDesignTokens.Color.textSecondary
        label.font = AlmidyDesignTokens.Font.body(20)
        let line = UIView()
        line.backgroundColor = AlmidyDesignTokens.Color.line
        upcoming.addArrangedSubview(label)
        upcoming.addArrangedSubview(line)
        NSLayoutConstraint.activate([line.heightAnchor.constraint(equalToConstant: 1)])
        expandedContentStack.addArrangedSubview(upcoming)

        for trip in trips {
            expandedContentStack.addArrangedSubview(tripCard(for: trip))
        }

        if reservationCardVisible {
            expandedContentStack.addArrangedSubview(reservationAutomationCard())
        }
    }

    private var overviewYear: String {
        for trip in trips {
            guard let startDate = trip.startDate?.trimmingCharacters(in: .whitespacesAndNewlines),
                  startDate.count >= 4 else { continue }
            let year = String(startDate.prefix(4))
            if year.allSatisfy(\.isNumber) {
                return year
            }
        }
        return String(Calendar.current.component(.year, from: Date()))
    }

    private func renderWelcomeContent() {
        let card = UIView()
        card.backgroundColor = AlmidyDesignTokens.Color.surface
        card.layer.cornerRadius = AlmidyDesignTokens.Radius.card
        card.layer.borderWidth = 1
        card.layer.borderColor = AlmidyDesignTokens.Color.goldDeep.withAlphaComponent(0.28).cgColor
        card.clipsToBounds = true
        card.translatesAutoresizingMaskIntoConstraints = false

        // Composite the translucent brand wash over an opaque surface so MapKit
        // labels and controls never bleed through the Welcome card.
        let brandWash = UIView()
        brandWash.backgroundColor = AlmidyDesignTokens.Color.gold.withAlphaComponent(0.10)
        brandWash.isUserInteractionEnabled = false
        brandWash.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(brandWash)

        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)

        let eyebrow = UILabel()
        eyebrow.text = "WELCOME"
        eyebrow.textColor = AlmidyDesignTokens.Color.goldSoft
        eyebrow.font = .systemFont(ofSize: 14, weight: .semibold)

        let title = UILabel()
        title.text = "Get Started"
        title.font = AlmidyDesignTokens.Font.title(28)
        title.textColor = AlmidyDesignTokens.Color.textPrimary

        let body = UILabel()
        body.text = "Create your next trip and plan your itinerary, expenses, documents, and more"
        body.numberOfLines = 0
        body.textColor = AlmidyDesignTokens.Color.textSecondary
        body.font = AlmidyDesignTokens.Font.body(16)

        stack.addArrangedSubview(eyebrow)
        stack.addArrangedSubview(title)
        stack.addArrangedSubview(body)
        stack.setCustomSpacing(18, after: body)
        stack.addArrangedSubview(actionButton(title: "Create Your First Trip", backgroundColor: AlmidyDesignTokens.Color.gold, textColor: AlmidyDesignTokens.Color.bgLight, action: #selector(createTrip), fontSize: 17, minHeight: 50, cornerRadius: AlmidyDesignTokens.Radius.capsule))
        stack.addArrangedSubview(actionButton(title: "Import a Reservation Manually", backgroundColor: AlmidyDesignTokens.Color.disabledActionBackground, textColor: AlmidyDesignTokens.Color.textPrimary, action: #selector(openManualReservationImporter), fontSize: 17, minHeight: 50, cornerRadius: AlmidyDesignTokens.Radius.capsule))
        stack.addArrangedSubview(actionButton(title: "Explore Sample Trip", backgroundColor: AlmidyDesignTokens.Color.disabledActionBackground, textColor: AlmidyDesignTokens.Color.textPrimary, action: #selector(openSampleTripPreview), fontSize: 17, minHeight: 50, cornerRadius: AlmidyDesignTokens.Radius.capsule))

        NSLayoutConstraint.activate([
            brandWash.topAnchor.constraint(equalTo: card.topAnchor),
            brandWash.leadingAnchor.constraint(equalTo: card.leadingAnchor),
            brandWash.trailingAnchor.constraint(equalTo: card.trailingAnchor),
            brandWash.bottomAnchor.constraint(equalTo: card.bottomAnchor),
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 22),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 22),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -22),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -22)
        ])
        expandedContentStack.addArrangedSubview(card)
    }

    private func installFirstTripCard() {
        firstTripCard?.removeFromSuperview()

        let card = UIView()
        card.backgroundColor = AlmidyDesignTokens.Color.card
        card.layer.cornerRadius = AlmidyDesignTokens.Radius.card
        card.layer.shadowColor = AlmidyDesignTokens.Color.shadowBlack.cgColor
        card.layer.shadowOpacity = 0.18
        card.layer.shadowRadius = 24
        card.layer.shadowOffset = CGSize(width: 0, height: 12)
        card.translatesAutoresizingMaskIntoConstraints = false

        let iconView = UILabel()
        iconView.text = regionFlagEmoji()
        iconView.font = .systemFont(ofSize: 38)
        iconView.textAlignment = .center
        iconView.backgroundColor = AlmidyDesignTokens.Color.surface
        iconView.layer.cornerRadius = AlmidyDesignTokens.Radius.control
        iconView.clipsToBounds = true
        iconView.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(iconView)

        let title = UILabel()
        title.text = "Create your first trip"
        title.font = AlmidyDesignTokens.Font.title(20)
        title.textColor = AlmidyDesignTokens.Color.textPrimary
        title.numberOfLines = 0
        title.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(title)

        let body = UILabel()
        body.text = "After creating a trip, a country flag will appear on the map to mark its location."
        body.font = AlmidyDesignTokens.Font.body(15)
        body.textColor = AlmidyDesignTokens.Color.textSecondary
        body.numberOfLines = 0
        body.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(body)

        let create = UIButton(type: .system)
        create.setTitle("Create Trip", for: .normal)
        create.setTitleColor(AlmidyDesignTokens.Color.goldSoft, for: .normal)
        create.titleLabel?.font = AlmidyDesignTokens.Font.button(18)
        create.contentHorizontalAlignment = .left
        create.addTarget(self, action: #selector(createTrip), for: .touchUpInside)
        create.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(create)

        view.addSubview(card)
        view.bringSubviewToFront(card)

        NSLayoutConstraint.activate([
            card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            card.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 16),
            card.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -16),
            card.widthAnchor.constraint(lessThanOrEqualToConstant: NativeAdaptiveLayout.cardMaxWidth),
            NativeAdaptiveLayout.preferredWidth(card, equalTo: view.widthAnchor, constant: -32),
            card.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 28),
            card.heightAnchor.constraint(equalToConstant: 164),

            iconView.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 18),
            iconView.topAnchor.constraint(equalTo: card.topAnchor, constant: 18),
            iconView.widthAnchor.constraint(equalToConstant: 56),
            iconView.heightAnchor.constraint(equalToConstant: 56),

            title.leadingAnchor.constraint(equalTo: iconView.trailingAnchor, constant: 14),
            title.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18),
            title.topAnchor.constraint(equalTo: card.topAnchor, constant: 20),

            body.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            body.trailingAnchor.constraint(equalTo: title.trailingAnchor),
            body.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 6),

            create.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            create.trailingAnchor.constraint(equalTo: title.trailingAnchor),
            create.topAnchor.constraint(greaterThanOrEqualTo: body.bottomAnchor, constant: 2),
            create.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -8),
            create.heightAnchor.constraint(equalToConstant: 44)
        ])
        firstTripCard = card
    }

    private func regionFlagEmoji() -> String {
        let regionCode = Locale.current.regionCode?.uppercased() ?? "US"
        guard regionCode.count == 2 else { return "🇺🇸" }
        return regionCode.unicodeScalars.reduce(into: "") { result, scalar in
            guard let regionalIndicator = UnicodeScalar(127397 + scalar.value) else { return }
            result.unicodeScalars.append(regionalIndicator)
        }
    }

    private func tripCard(for trip: NativeMapTrip) -> UIView {
        let card = UIView()
        card.layer.cornerRadius = 30
        card.clipsToBounds = true
        card.backgroundColor = AlmidyDesignTokens.Color.card

        let button = NativeGradientButton(type: .custom)
        button.accessibilityIdentifier = trip.id
        button.accessibilityLabel = "Open \(trip.displayName)"
        button.addTarget(self, action: #selector(openTripAction(_:)), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(button)

        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFill
        imageView.translatesAutoresizingMaskIntoConstraints = false
        button.addSubview(imageView)
        loadTripImage(into: imageView, trip: trip)

        button.overlayGradient.colors = [
            AlmidyDesignTokens.Color.tripCardGradientStart.cgColor,
            AlmidyDesignTokens.Color.tripCardGradientEnd.cgColor
        ]
        button.overlayGradient.locations = [0.40, 1.0]
        button.layer.addSublayer(button.overlayGradient)

        let textStack = UIStackView()
        textStack.axis = .vertical
        textStack.alignment = .leading
        textStack.spacing = 3
        textStack.translatesAutoresizingMaskIntoConstraints = false
        button.addSubview(textStack)

        let edit = NativeTripActionButton(tripId: trip.id, systemName: "pencil")
        edit.addTarget(self, action: #selector(editTripAction(_:)), for: .touchUpInside)
        let delete = NativeTripActionButton(tripId: trip.id, systemName: "trash")
        delete.tintColor = .systemRed
        delete.addTarget(self, action: #selector(deleteTripAction(_:)), for: .touchUpInside)
        let actions = UIStackView(arrangedSubviews: [edit, delete])
        actions.axis = .horizontal
        actions.spacing = 8
        actions.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(actions)

        let title = UILabel()
        title.text = trip.displayName
        title.textColor = AlmidyDesignTokens.Color.tripCardTextPrimary
        title.font = AlmidyDesignTokens.Font.title(31)
        title.adjustsFontSizeToFitWidth = true
        title.minimumScaleFactor = 0.72

        let dates = UILabel()
        dates.text = trip.displayDateRange
        dates.textColor = AlmidyDesignTokens.Color.tripCardTextSecondary
        dates.font = .systemFont(ofSize: 20, weight: .semibold)

        let status = UILabel()
        status.text = trip.displayStatus
        status.textColor = AlmidyDesignTokens.Color.tripCardTextTertiary
        status.font = .systemFont(ofSize: 18, weight: .regular)

        textStack.addArrangedSubview(title)
        textStack.addArrangedSubview(dates)
        textStack.addArrangedSubview(status)

        NSLayoutConstraint.activate([
            card.heightAnchor.constraint(equalToConstant: 300),
            button.topAnchor.constraint(equalTo: card.topAnchor),
            button.leadingAnchor.constraint(equalTo: card.leadingAnchor),
            button.trailingAnchor.constraint(equalTo: card.trailingAnchor),
            button.bottomAnchor.constraint(equalTo: card.bottomAnchor),
            imageView.topAnchor.constraint(equalTo: button.topAnchor),
            imageView.leadingAnchor.constraint(equalTo: button.leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: button.trailingAnchor),
            imageView.bottomAnchor.constraint(equalTo: button.bottomAnchor),
            textStack.leadingAnchor.constraint(equalTo: button.leadingAnchor, constant: 24),
            textStack.trailingAnchor.constraint(equalTo: button.trailingAnchor, constant: -24),
            textStack.bottomAnchor.constraint(equalTo: button.bottomAnchor, constant: -26),
            actions.topAnchor.constraint(equalTo: card.topAnchor, constant: 18),
            actions.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18),
            edit.widthAnchor.constraint(equalToConstant: 44),
            edit.heightAnchor.constraint(equalToConstant: 44),
            delete.widthAnchor.constraint(equalToConstant: 44),
            delete.heightAnchor.constraint(equalToConstant: 44)
        ])
        return card
    }

    private func loadTripImage(into imageView: UIImageView, trip: NativeMapTrip) {
        if let cachedImage = NativeTripBackgroundImageCache.shared.image(for: trip) {
            imageView.image = cachedImage
            return
        }
        if let imageUrl = trip.imageUrl, let url = URL(string: imageUrl) {
            URLSession.shared.dataTask(with: url) { data, _, _ in
                guard let data, let image = UIImage(data: data) else { return }
                NativeTripBackgroundImageCache.shared.store(image, for: trip)
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
        card.backgroundColor = AlmidyDesignTokens.Color.card
        card.layer.cornerRadius = AlmidyDesignTokens.Radius.card
        card.layer.borderWidth = 1
        card.layer.borderColor = UIColor.systemGray4.cgColor

        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)

        let close = UIButton(type: .system)
        close.setImage(UIImage(systemName: "xmark"), for: .normal)
        close.accessibilityLabel = "Dismiss reservation suggestion"
        close.tintColor = .systemGray
        close.addTarget(self, action: #selector(dismissReservationCard), for: .touchUpInside)
        close.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(close)

        let envelope = UILabel()
        envelope.text = "✉"
        envelope.textAlignment = .center
        envelope.textColor = AlmidyDesignTokens.Color.gold
        envelope.font = .systemFont(ofSize: 34, weight: .regular)

        let eyebrow = UILabel()
        eyebrow.text = "IMPORT"
        eyebrow.textColor = AlmidyDesignTokens.Color.goldSoft
        eyebrow.font = AlmidyDesignTokens.Font.semibold(15)

        let title = UILabel()
        title.text = "Manual Reservation Importer"
        title.font = AlmidyDesignTokens.Font.title(27)
        title.textColor = AlmidyDesignTokens.Color.textPrimary
        title.numberOfLines = 0

        let body = UILabel()
        body.text = "Add reservation details from the importer while email forwarding remains unavailable."
        body.font = .systemFont(ofSize: 19, weight: .regular)
        body.textColor = .systemGray
        body.numberOfLines = 0

        let cta = actionButton(title: "Open Reservation Importer", backgroundColor: AlmidyDesignTokens.Color.gold, textColor: AlmidyDesignTokens.Color.settingsText, action: #selector(openManualReservationImporter))

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
            close.widthAnchor.constraint(equalToConstant: 44),
            close.heightAnchor.constraint(equalToConstant: 44)
        ])

        return card
    }

    private func circularButton(systemName: String, backgroundColor: UIColor, tintColor: UIColor) -> UIButton {
        let button = UIButton(type: .system)
        button.backgroundColor = backgroundColor
        button.tintColor = tintColor
        button.layer.cornerRadius = AlmidyDesignTokens.Radius.control
        button.layer.shadowColor = AlmidyDesignTokens.Color.shadowBlack.cgColor
        button.layer.shadowOpacity = 0.08
        button.layer.shadowRadius = 18
        button.layer.shadowOffset = CGSize(width: 0, height: 9)
        button.setImage(UIImage(systemName: systemName), for: .normal)
        return button
    }

    private func actionButton(
        title: String,
        backgroundColor: UIColor,
        textColor: UIColor,
        action: Selector,
        fontSize: CGFloat = 20,
        minHeight: CGFloat = 54,
        cornerRadius: CGFloat = 25
    ) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.setTitleColor(textColor, for: .normal)
        button.titleLabel?.font = AlmidyDesignTokens.Font.button(fontSize)
        button.backgroundColor = backgroundColor
        button.layer.cornerRadius = cornerRadius == 25 ? AlmidyDesignTokens.Radius.capsule : cornerRadius
        var configuration = UIButton.Configuration.plain()
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 10, leading: 14, bottom: 10, trailing: 14)
        configuration.baseForegroundColor = textColor
        button.configuration = configuration
        button.addTarget(self, action: action, for: .touchUpInside)
        NSLayoutConstraint.activate([button.heightAnchor.constraint(greaterThanOrEqualToConstant: minHeight)])
        return button
    }

    private func pillLabel(_ text: String, fontSize: CGFloat, textColor: UIColor, backgroundColor: UIColor) -> UILabel {
        let label = PaddingLabel(insets: UIEdgeInsets(top: 9, left: 17, bottom: 9, right: 17))
        label.text = text
        label.textColor = textColor
        label.font = AlmidyDesignTokens.Font.title(fontSize)
        label.backgroundColor = backgroundColor
        label.layer.cornerRadius = AlmidyDesignTokens.Radius.control
        label.clipsToBounds = true
        label.setContentHuggingPriority(.required, for: .horizontal)
        return label
    }

    private func syncSheetVisibility() {
        collapsedActions.isHidden = sheetState != .collapsed || trips.isEmpty
        expandedScrollView.isHidden = sheetState == .collapsed
        firstTripCard?.isHidden = !(trips.isEmpty && sheetState == .collapsed)
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

    private func height(for state: SheetState, containerSize: CGSize? = nil) -> CGFloat {
        let size = containerSize ?? view.bounds.size
        let fullHeight = size.height > 0 ? size.height : 700
        let compactHeight = fullHeight < 700 || size.width > fullHeight
        switch state {
        case .collapsed:
            let preferred = trips.isEmpty ? (compactHeight ? 210.0 : 300.0) : 192.0
            return min(preferred, fullHeight * (compactHeight ? 0.48 : 0.28))
        case .medium:
            return min(fullHeight * (compactHeight ? 0.72 : 0.58), 520)
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
        mapView.removeAnnotations(mapView.annotations.filter {
            $0 is NativeTripAnnotation || $0 is NativeGeographicLabelAnnotation
        })
        if !trips.isEmpty {
            mapView.addAnnotations(NativeGeographicLabelAnnotation.majorLabels)
        }
        let annotations = trips.compactMap { trip -> NativeTripAnnotation? in
            guard let coordinate = trip.coordinate ?? resolvedLegacyTripCoordinates[trip.id] else {
                resolveLegacyTripCoordinateIfNeeded(for: trip)
                return nil
            }
            return NativeTripAnnotation(trip: trip, coordinate: coordinate)
        }
        mapView.addAnnotations(annotations)
    }

    private func resolveLegacyTripCoordinateIfNeeded(for trip: NativeMapTrip) {
        guard trip.coordinate == nil,
              resolvedLegacyTripCoordinates[trip.id] == nil,
              !resolvingLegacyTripIDs.contains(trip.id),
              let destination = trip.destination?.trimmingCharacters(in: .whitespacesAndNewlines),
              !destination.isEmpty else { return }

        resolvingLegacyTripIDs.insert(trip.id)
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = destination
        request.resultTypes = [.address]

        MKLocalSearch(request: request).start { [weak self] response, _ in
            DispatchQueue.main.async {
                guard let self else { return }
                self.resolvingLegacyTripIDs.remove(trip.id)
                guard self.trips.contains(where: { $0.id == trip.id }),
                      let coordinate = response?.mapItems.first?.placemark.coordinate,
                      CLLocationCoordinate2DIsValid(coordinate) else { return }
                self.resolvedLegacyTripCoordinates[trip.id] = coordinate
                self.addTripPins()
            }
        }
    }

    func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
        guard !trips.isEmpty, mapPresentationMode == .hybrid else { return }

        let distance = mapView.camera.centerCoordinateDistance
        if !usesExpandedGlobeConfiguration, distance >= 29_000_000 {
            setExpandedGlobeConfiguration(true)
        } else if usesExpandedGlobeConfiguration, distance <= 27_000_000 {
            setExpandedGlobeConfiguration(false)
        }
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
        if annotation is MKUserLocation {
            let identifier = "user-location"
            let annotationView = mapView.dequeueReusableAnnotationView(withIdentifier: identifier)
                ?? NativeUserLocationAnnotationView(annotation: annotation, reuseIdentifier: identifier)
            annotationView.annotation = annotation
            return annotationView
        }

        if let geographicLabel = annotation as? NativeGeographicLabelAnnotation {
            let identifier = "major-geographic-label"
            let annotationView = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) as? NativeGeographicLabelAnnotationView
                ?? NativeGeographicLabelAnnotationView(annotation: geographicLabel, reuseIdentifier: identifier)
            annotationView.annotation = annotation
            annotationView.configure(with: geographicLabel)
            return annotationView
        }

        guard let tripAnnotation = annotation as? NativeTripAnnotation else { return nil }
        let identifier = "trip-country-flag"
        let annotationView = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) as? NativeTripFlagAnnotationView
            ?? NativeTripFlagAnnotationView(annotation: tripAnnotation, reuseIdentifier: identifier)
        annotationView.annotation = annotation
        annotationView.canShowCallout = true
        annotationView.rightCalloutAccessoryView = UIButton(type: .detailDisclosure)
        annotationView.configure(with: tripAnnotation.countryPresentation)
        return annotationView
    }

    func mapView(_ mapView: MKMapView, didSelect annotation: MKAnnotation) {
        guard let tripAnnotation = annotation as? NativeTripAnnotation else { return }
        mapView.setCamera(MKMapCamera(lookingAtCenter: tripAnnotation.coordinate, fromDistance: 90_000, pitch: 52, heading: mapView.camera.heading), animated: true)
    }

    func mapView(_ mapView: MKMapView, annotationView view: MKAnnotationView, calloutAccessoryControlTapped control: UIControl) {
        guard let tripAnnotation = view.annotation as? NativeTripAnnotation else { return }
        focusTrip(tripAnnotation.trip)
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
        guard !hasCenteredInitialLocation else { return }
        hasCenteredInitialLocation = true
        mapView.setUserTrackingMode(.none, animated: false)

        // A populated globe has a deliberate launch composition. Location is
        // shown as an annotation, but it must not replace the user's camera or
        // opt the map into follow mode after they begin interacting with it.
        guard trips.isEmpty else { return }
        mapView.setCamera(
            MKMapCamera(
                lookingAtCenter: coordinate,
                fromDistance: 3_600_000,
                pitch: 0,
                heading: 0
            ),
            animated: true
        )
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}

    @objc private func toggleSheetFromTitle() {
        applySheetState(sheetState == .collapsed ? .medium : .collapsed, animated: true)
    }

    @objc private func openSettings() {
        let settings = NativeSettingsViewController(
            profile: NativeSessionCoordinator.shared.session == nil ? nil : NativeSessionCoordinator.shared.profile,
            onOpenAccount: { [weak self] in
                guard let self else { return }
                self.dismiss(animated: true) { [weak self] in
                    guard let self else { return }
                    if NativeSessionCoordinator.shared.session == nil {
                        self.presentNativeAuth(
                            reopensSettingsOnAuthentication: true
                        )
                    } else {
                        self.presentNativeAccount()
                    }
                }
            },
            onSignOut: { [weak self] in
                guard let self else { return }
                self.clearNativeSession { [weak self] success in
                    guard let self, success else { return }
                    self.dismiss(animated: true) { [weak self] in
                        self?.renderSheetContent()
                        self?.presentNativeAuth()
                    }
                }
            },
            onChangePassword: { [weak self] completion in
                guard let tripStore = self?.tripStore else {
                    completion(false)
                    return
                }
                tripStore.requestPasswordReset(completion: completion)
            },
            onOpenManualReservationImporter: { [weak self] in
                self?.dismiss(animated: true) { [weak self] in
                    self?.presentNativeWebFeature(
                        route: "/dashboard/imports",
                        title: "Reservation Importer"
                    )
                }
            },
            onOpenTrips: { [weak self] in
                self?.dismiss(animated: true) { [weak self] in
                    self?.refreshTripsFromServer()
                    self?.applySheetState(.expanded, animated: true)
                }
            },
            onOpenTravelBook: { [weak self] in
                self?.dismiss(animated: true) { [weak self] in
                    self?.presentNativeWebFeature(
                        route: "/dashboard/profile/stats",
                        title: "Travel Book"
                    )
                }
            },
            onOpenHelp: { [weak self] in
                self?.dismiss(animated: true) { [weak self] in
                    self?.presentNativeWebFeature(route: "/dashboard/account#help", title: "Help")
                }
            },
            onOpenNotificationPreferences: { [weak self] in
                self?.dismiss(animated: true) { [weak self] in
                    self?.presentNativeWebFeature(route: "/dashboard/account#notifications", title: "Notifications")
                }
            },
            onLoadPreferences: { [weak self] completion in
                guard let tripStore = self?.tripStore else {
                    completion(.failure(NativeTripStoreError.requestFailed("Native preference persistence is unavailable.")))
                    return
                }
                tripStore.loadUserPreferences(completion: completion)
            },
            onUpdatePreferences: { [weak self] values, completion in
                guard let tripStore = self?.tripStore else {
                    completion(.failure(NativeTripStoreError.requestFailed("Native preference persistence is unavailable.")))
                    return
                }
                tripStore.updateUserPreferences(values, completion: completion)
            },
            onOpenPublicPage: { [weak self] path in
                self?.dismiss(animated: true) {
                    guard let url = URL(string: path, relativeTo: NativeServiceConfiguration.appBaseURL)?.absoluteURL else {
                        return
                    }
                    UIApplication.shared.open(url)
                }
            },
            onTalkToUs: { [weak self] address in
                self?.dismiss(animated: true) {
                    guard let url = URL(string: "mailto:\(address)") else { return }
                    UIApplication.shared.open(url)
                }
            }
        )
        settings.modalPresentationStyle = .pageSheet
        if let sheet = settings.sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = 28
        }
        present(settings, animated: true)
    }

    private func presentNativeAccount() {
        let presentAccount: (NativeWebAuthStorage?) -> Void = { [weak self] authStorage in
            guard let self else { return }
            let importedWebSession = authStorage.map {
                NativeSessionCoordinator.shared.update(from: $0.value)
            } ?? false
            let isSignedIn = importedWebSession || NativeSessionCoordinator.shared.session != nil
            guard isSignedIn else {
                self.presentNativeAuth(reopensSettingsOnAuthentication: true)
                return
            }
            let account = NativeAccountViewController(
                profile: NativeSessionCoordinator.shared.profile,
                isSignedIn: true,
                onSignIn: { [weak self] in
                    self?.dismiss(animated: true) { [weak self] in
                        self?.presentNativeAuth()
                    }
                },
                onSignOut: { [weak self] completion in
                    self?.clearNativeSession(completion: completion)
                },
                onSaveName: { [weak self] name, completion in
                    guard let tripStore = self?.tripStore else {
                        completion(false)
                        return
                    }
                    tripStore.updateProfileName(name, completion: completion)
                },
                onDeleteAccount: { [weak self] in
                    self?.dismiss(animated: true) { [weak self] in
                        self?.presentNativeWebFeature(route: "/dashboard/account#deletion", title: "Delete Account")
                    }
                },
                onSignedOut: { [weak self] in
                    self?.dismiss(animated: true) { [weak self] in
                        self?.renderSheetContent()
                        self?.presentNativeAuth()
                    }
                }
            )
            account.modalPresentationStyle = .pageSheet
            if let sheet = account.sheetPresentationController {
                sheet.detents = [.large()]
                sheet.prefersGrabberVisible = true
                sheet.preferredCornerRadius = 28
            }
            self.present(account, animated: true)
        }

        if let sourceWebView {
            NativeWebFeatureViewController.exportAuthStorage(from: sourceWebView) { authStorage in
                DispatchQueue.main.async { presentAccount(authStorage) }
            }
        } else {
            presentAccount(nil)
        }
    }

    private func presentNativeAuth(
        startsInSignup: Bool = false,
        reopensSettingsOnAuthentication: Bool = false
    ) {
        let auth = NativeAuthViewController { [weak self] result in
            guard let self else { return }
            switch result {
            case .authenticated:
                self.dismiss(animated: true) { [weak self] in
                    self?.refreshTripsFromServer()
                    self?.renderSheetContent()
                    if reopensSettingsOnAuthentication {
                        self?.openSettings()
                    }
                }
            case .createdPendingConfirmation:
                self.showMessage(
                    title: "Check your email",
                    message: "Your account was created. Confirm your email, then sign in to sync your trips."
                )
            case .cancelled:
                break
            }
        }
        auth.startsInSignup = startsInSignup
        auth.modalPresentationStyle = UIModalPresentationStyle.pageSheet
        if let sheet = auth.sheetPresentationController {
            sheet.detents = [UISheetPresentationController.Detent.large()]
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = 28
        }
        present(auth, animated: true)
    }

    private func showMessage(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Done", style: .default))
        present(alert, animated: true)
    }

    private func clearNativeSession(completion: @escaping (Bool) -> Void) {
        NativeSessionCoordinator.shared.explicitSignOut()
        guard let sourceWebView else {
            completion(true)
            return
        }
        let script = """
        (() => {
            for (const store of [localStorage, sessionStorage]) {
                for (const key of Object.keys(store)) {
                    if (key.includes('auth-token')) store.removeItem(key);
                }
            }
            return true;
        })()
        """
        sourceWebView.evaluateJavaScript(script) { [weak self] _, error in
            guard let self else { return }
            let cookieStore = sourceWebView.configuration.websiteDataStore.httpCookieStore
            cookieStore.getAllCookies { cookies in
                let group = DispatchGroup()
                for cookie in cookies where cookie.domain.contains("almidy") || cookie.domain.contains("supabase") {
                    group.enter()
                    cookieStore.delete(cookie) { group.leave() }
                }
                group.notify(queue: .main) {
                    completion(error == nil)
                    self.replaceTrips([])
                }
            }
        }
    }

    func presentNativeWebFeature(route: String, title: String) {
        guard NativeWebRoutePolicy.allows(route) else { return }
        let previousSheetState = sheetState
        let presentFeature: (NativeWebAuthStorage?, NativeAuthSession) -> Void = { [weak self] authStorage, nativeSession in
            guard let self else { return }
            let feature = NativeWebFeatureViewController.wrapped(
                route: route,
                title: title,
                onFinish: { [weak self] result in
            guard let self else { return }
            switch result {
            case .dismissed, .tripDataChanged, .importCompleted:
                self.refreshTripsFromServer()
                self.addTripPins()
                self.renderSheetContent()
                self.applySheetState(previousSheetState, animated: false)
            }
            },
                onNativeRoute: { [weak self] path in
                guard let self else { return }
                if path.hasPrefix("/dashboard/search") {
                    self.openSearch()
                } else if path.hasPrefix("/dashboard/trips") || path.hasPrefix("/dashboard/wallet") {
                    self.applySheetState(.expanded, animated: true)
                }
                },
                authStorage: authStorage,
                nativeSession: nativeSession,
                onAuthFailure: { [weak self] in
                    guard let self, self.presentedViewController == nil else { return }
                    self.presentNativeAuth()
                }
            )
            self.present(feature, animated: true)
        }

        let restoreAndPresent: (NativeWebAuthStorage?) -> Void = { [weak self] authStorage in
            guard let self else { return }
            if let authStorage {
                _ = NativeSessionCoordinator.shared.update(from: authStorage.value)
            }
            NativeSessionCoordinator.shared.validSession { [weak self] result in
                DispatchQueue.main.async {
                    guard let self else { return }
                    switch result {
                    case .success(let session):
                        presentFeature(authStorage, session)
                    case .failure:
                        self.presentNativeAuth()
                    }
                }
            }
        }

        if let sourceWebView {
            NativeWebFeatureViewController.exportAuthStorage(from: sourceWebView) { authStorage in
                DispatchQueue.main.async { restoreAndPresent(authStorage) }
            }
        } else {
            restoreAndPresent(nil)
        }
    }

    @objc private func openSearch() {
        let search = NativeMapSearchViewController { [weak self] coordinate in
            guard let self else { return }
            self.mapView.setCamera(
                MKMapCamera(
                    lookingAtCenter: coordinate,
                    fromDistance: 120_000,
                    pitch: 42,
                    heading: self.mapView.camera.heading
                ),
                animated: true
            )
            self.applySheetState(.collapsed, animated: true)
        }
        search.modalPresentationStyle = .pageSheet
        if let sheet = search.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = 28
        }
        present(search, animated: true)
    }

    @objc private func openTravelBook() {
        applySheetState(.expanded, animated: true)
    }

    @objc private func createTrip() {
        let form = NativeCreateTripViewController(
            onResolveBackground: { [weak self] query, completion in
                guard let tripStore = self?.tripStore else {
                    completion(nil)
                    return
                }
                tripStore.resolveDestinationHeroImage(
                    query: query,
                    minimumPixelDimension: 1400,
                    completion: completion
                )
            },
            onResolveBackgroundBank: { [weak self] query, completion in
                guard let tripStore = self?.tripStore else {
                    completion([])
                    return
                }
                tripStore.resolveDestinationImageBank(query: query, completion: completion)
            },
            onCreate: { [weak self] draft, completion in
                guard let self else { return }
                self.createTripFromServer(draft, completion: completion)
            }
        )
        presentTripForm(form)
    }

    private func addNativeTrip(_ trip: NativeMapTrip) {
        guard !trips.contains(where: { $0.id == trip.id }) else { return }
        trips.insert(trip, at: 0)
        warmTripBackground(trip)
        addTripPins()
        renderSheetContent()
        if let coordinate = trip.coordinate {
            mapView.setCamera(
                MKMapCamera(lookingAtCenter: coordinate, fromDistance: 120_000, pitch: 42, heading: mapView.camera.heading),
                animated: true
            )
        }
    }

    @objc private func openTripAction(_ sender: UIButton) {
        guard let id = sender.accessibilityIdentifier,
              let trip = trips.first(where: { $0.id == id }) else { return }
        // Keep trip navigation inside the native globe and wallet. The WebView
        // route can still be opened by dedicated web navigation, but a native
        // wallet card must not dismiss this shell into the legacy trip form.
        focusTrip(trip)
    }

    @objc private func editTripAction(_ sender: NativeTripActionButton) {
        guard let trip = trips.first(where: { $0.id == sender.tripId }) else { return }
        let presentEditor = { [weak self] in
            guard let self, self.presentedViewController == nil else { return }
            let form = NativeCreateTripViewController(
                existingTrip: trip,
                onResolveBackground: { [weak self] query, completion in
                    guard let tripStore = self?.tripStore else {
                        completion(nil)
                        return
                    }
                    tripStore.resolveDestinationHeroImage(
                        query: query,
                        minimumPixelDimension: 1400,
                        completion: completion
                    )
                },
                onResolveBackgroundBank: { [weak self] query, completion in
                    guard let tripStore = self?.tripStore else {
                        completion([])
                        return
                    }
                    tripStore.resolveDestinationImageBank(query: query, completion: completion)
                },
                onCreate: { [weak self] draft, completion in
                    guard let self else { return }
                    self.updateTripFromServer(id: trip.id, draft: draft, completion: completion)
                }
            )
            self.presentTripForm(form)
        }
        if NativeTripBackgroundImageCache.shared.image(for: trip) != nil {
            presentEditor()
        } else {
            warmTripBackground(trip, completion: presentEditor)
        }
    }

    private func warmTripBackground(_ trip: NativeMapTrip, completion: (() -> Void)? = nil) {
        if NativeTripBackgroundImageCache.shared.image(for: trip) != nil {
            DispatchQueue.main.async { completion?() }
            return
        }

        let download: (URL?) -> Void = { url in
            guard let url else {
                DispatchQueue.main.async { completion?() }
                return
            }
            URLSession.shared.dataTask(with: url) { data, response, _ in
                let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
                if (statusCode == 0 || (200...299).contains(statusCode)),
                   let data, let image = UIImage(data: data) {
                    NativeTripBackgroundImageCache.shared.store(image, for: trip)
                }
                DispatchQueue.main.async { completion?() }
            }.resume()
        }

        if let imageUrl = trip.imageUrl, let url = URL(string: imageUrl) {
            download(url)
        } else if let destination = trip.destination, let tripStore {
            tripStore.resolveDestinationHeroImage(
                query: destination,
                minimumPixelDimension: 1400,
                completion: download
            )
        } else {
            download(nil)
        }
    }

    @objc private func deleteTripAction(_ sender: NativeTripActionButton) {
        guard let trip = trips.first(where: { $0.id == sender.tripId }) else { return }
        let alert = UIAlertController(
            title: "Delete \(trip.displayName)?",
            message: "This removes the trip from your wallet and globe.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Delete", style: .destructive) { [weak self] _ in
            guard let self else { return }
            self.tripStore?.deleteTrip(id: trip.id) { [weak self] result in
                guard case .success = result else { return }
                self?.refreshTripsFromServer()
            }
        })
        present(alert, animated: true)
    }

    private func replaceTrip(_ updatedTrip: NativeMapTrip) {
        if let index = trips.firstIndex(where: { $0.id == updatedTrip.id }) {
            trips[index] = updatedTrip
        } else {
            trips.insert(updatedTrip, at: 0)
        }
        warmTripBackground(updatedTrip)
        addTripPins()
        renderSheetContent()
        refreshTripsFromServer()
    }

    private func presentTripForm(_ form: UIViewController) {
        form.modalPresentationStyle = .pageSheet
        if let sheet = form.sheetPresentationController {
            sheet.detents = [.large()]
            sheet.selectedDetentIdentifier = .large
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = 28
        }
        present(form, animated: true)
    }

    @objc private func openManualReservationImporter() {
        presentNativeWebFeature(
            route: "/dashboard/imports",
            title: "Reservation Importer"
        )
    }

    @objc private func openLatestTrip() {
        guard let trip = trips.first else { return }
        focusTrip(trip)
    }

    @objc private func openSampleTripPreview() {
        let preview = UIAlertController(
            title: "Sample Trip Preview",
            message: "Explore how an Almidy trip can organize an itinerary, expenses, and documents. This preview does not create a trip, add a map pin, or save data to your account.",
            preferredStyle: .alert
        )
        preview.view.tintColor = AlmidyDesignTokens.Color.gold
        preview.addAction(UIAlertAction(title: "Done", style: .cancel))
        present(preview, animated: true)
    }

    private func focusTrip(_ trip: NativeMapTrip) {
        guard let coordinate = trip.coordinate else {
            applySheetState(.expanded, animated: true)
            return
        }
        mapView.setCamera(
            MKMapCamera(lookingAtCenter: coordinate, fromDistance: 120_000, pitch: 42, heading: mapView.camera.heading),
            animated: true
        )
        applySheetState(.expanded, animated: true)
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
            AlmidyDesignTokens.Color.generatedTripImageBase.setFill()
            context.fill(bounds)
            let colors = [
                AlmidyDesignTokens.Color.generatedTripGradientStart.cgColor,
                AlmidyDesignTokens.Color.generatedTripGradientEnd.cgColor
            ]
            let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors as CFArray, locations: [0, 1])!
            context.cgContext.drawLinearGradient(gradient, start: CGPoint(x: 0, y: 0), end: CGPoint(x: 720, y: 520), options: [])
        }
    }
}

private final class NativeSettingsViewController: UIViewController, UITableViewDataSource, UITableViewDelegate {
    private let profile: NativeAuthProfile?
    private let onOpenAccount: () -> Void
    private let onSignOut: () -> Void
    private let onChangePassword: (@escaping (Bool) -> Void) -> Void
    private let onOpenManualReservationImporter: () -> Void
    private let onOpenTrips: () -> Void
    private let onOpenTravelBook: () -> Void
    private let onOpenHelp: () -> Void
    private let onOpenNotificationPreferences: () -> Void
    private let onLoadPreferences: (@escaping (Result<NativeUserPreferences, Error>) -> Void) -> Void
    private let onUpdatePreferences: ([String: String], @escaping (Result<NativeUserPreferences, Error>) -> Void) -> Void
    private let onOpenPublicPage: (String) -> Void
    private let onTalkToUs: (String) -> Void
    private let tableView = UITableView(frame: .zero, style: .insetGrouped)
    private weak var adaptiveHeaderView: UIView?

    private var preferenceState: NativePreferenceViewState
    private var sections: [NativeSettingsSectionModel] { NativeSettingsCatalog.sections(preferenceState: preferenceState) }

    init(
        profile: NativeAuthProfile?,
        onOpenAccount: @escaping () -> Void,
        onSignOut: @escaping () -> Void,
        onChangePassword: @escaping (@escaping (Bool) -> Void) -> Void,
        onOpenManualReservationImporter: @escaping () -> Void,
        onOpenTrips: @escaping () -> Void,
        onOpenTravelBook: @escaping () -> Void,
        onOpenHelp: @escaping () -> Void,
        onOpenNotificationPreferences: @escaping () -> Void,
        onLoadPreferences: @escaping (@escaping (Result<NativeUserPreferences, Error>) -> Void) -> Void,
        onUpdatePreferences: @escaping ([String: String], @escaping (Result<NativeUserPreferences, Error>) -> Void) -> Void,
        onOpenPublicPage: @escaping (String) -> Void,
        onTalkToUs: @escaping (String) -> Void
    ) {
        self.profile = profile
        self.onOpenAccount = onOpenAccount
        self.onSignOut = onSignOut
        self.onChangePassword = onChangePassword
        self.onOpenManualReservationImporter = onOpenManualReservationImporter
        self.onOpenTrips = onOpenTrips
        self.onOpenTravelBook = onOpenTravelBook
        self.onOpenHelp = onOpenHelp
        self.onOpenNotificationPreferences = onOpenNotificationPreferences
        self.onLoadPreferences = onLoadPreferences
        self.onUpdatePreferences = onUpdatePreferences
        self.onOpenPublicPage = onOpenPublicPage
        self.onTalkToUs = onTalkToUs
        self.preferenceState = profile == nil ? .signedOut : .loading
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = AlmidyDesignTokens.Color.settingsBackground
        configureTable()
        if profile != nil { loadPreferences() }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        updateSettingsHeaderHeight()
    }

    private func configureTable() {
        let closeButton = UIButton(type: .system)
        let closeSymbol = UIImage.SymbolConfiguration(pointSize: 24, weight: .regular)
        closeButton.setImage(UIImage(systemName: "xmark", withConfiguration: closeSymbol), for: .normal)
        closeButton.tintColor = AlmidyDesignTokens.Color.settingsText
        closeButton.backgroundColor = AlmidyDesignTokens.Color.settingsCard
        closeButton.layer.cornerRadius = 26
        closeButton.layer.borderWidth = 1
        closeButton.layer.borderColor = AlmidyDesignTokens.Color.settingsLine.cgColor
        closeButton.accessibilityLabel = "Close Settings"
        closeButton.addTarget(self, action: #selector(close), for: .touchUpInside)

        let title = UILabel()
        title.text = "Settings"
        title.font = AlmidyDesignTokens.Font.display(38)
        title.textColor = AlmidyDesignTokens.Color.settingsText

        tableView.dataSource = self
        tableView.delegate = self
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "native-settings-row")
        tableView.backgroundColor = .clear
        tableView.tintColor = AlmidyDesignTokens.Color.settingsGold
        tableView.separatorColor = AlmidyDesignTokens.Color.settingsLine
        tableView.rowHeight = 64
        tableView.sectionHeaderHeight = 52
        tableView.sectionFooterHeight = 12
        tableView.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20)
        let settingsHeader = makeSettingsHeader()
        adaptiveHeaderView = settingsHeader
        tableView.tableHeaderView = settingsHeader
        tableView.tableFooterView = makeVersionFooter()
        tableView.translatesAutoresizingMaskIntoConstraints = false
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        title.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(closeButton)
        view.addSubview(title)
        view.addSubview(tableView)

        NSLayoutConstraint.activate([
            closeButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 14),
            closeButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            closeButton.widthAnchor.constraint(equalToConstant: 52),
            closeButton.heightAnchor.constraint(equalToConstant: 52),
            title.topAnchor.constraint(equalTo: closeButton.bottomAnchor, constant: 24),
            title.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            title.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24),
            tableView.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 20),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func makeSettingsHeader() -> UIView {
        let signedIn = profile != nil
        let header = UIView(frame: CGRect(x: 0, y: 0, width: view.bounds.width, height: 1))
        header.autoresizingMask = [.flexibleWidth]

        let promoCard = makePromoCard()
        promoCard.translatesAutoresizingMaskIntoConstraints = false
        header.addSubview(promoCard)

        let card = UIView()
        card.backgroundColor = AlmidyDesignTokens.Color.settingsCard
        card.layer.cornerRadius = AlmidyDesignTokens.Radius.card
        card.layer.borderWidth = 1
        card.layer.borderColor = AlmidyDesignTokens.Color.settingsLine.cgColor
        card.translatesAutoresizingMaskIntoConstraints = false
        header.addSubview(card)

        let promoTrailingInset = promoCard.trailingAnchor.constraint(
            lessThanOrEqualTo: header.trailingAnchor,
            constant: -20
        )
        promoTrailingInset.priority = UILayoutPriority(999)

        let accountTrailingInset = card.trailingAnchor.constraint(
            lessThanOrEqualTo: header.trailingAnchor,
            constant: -20
        )
        accountTrailingInset.priority = UILayoutPriority(999)

        let preferredPromoCenter = promoCard.centerXAnchor.constraint(equalTo: header.centerXAnchor)
        preferredPromoCenter.priority = UILayoutPriority(999)
        let preferredAccountCenter = card.centerXAnchor.constraint(equalTo: header.centerXAnchor)
        preferredAccountCenter.priority = UILayoutPriority(999)

        NSLayoutConstraint.activate([
            promoCard.topAnchor.constraint(equalTo: header.topAnchor, constant: 10),
            preferredPromoCenter,
            promoCard.leadingAnchor.constraint(greaterThanOrEqualTo: header.leadingAnchor, constant: 20),
            promoTrailingInset,
            promoCard.widthAnchor.constraint(lessThanOrEqualToConstant: NativeAdaptiveLayout.cardMaxWidth),
            NativeAdaptiveLayout.preferredWidth(promoCard, equalTo: header.widthAnchor, constant: -40),
            promoCard.heightAnchor.constraint(greaterThanOrEqualToConstant: 160),
            card.topAnchor.constraint(equalTo: promoCard.bottomAnchor, constant: 18),
            preferredAccountCenter,
            card.leadingAnchor.constraint(greaterThanOrEqualTo: header.leadingAnchor, constant: 20),
            accountTrailingInset,
            card.widthAnchor.constraint(lessThanOrEqualToConstant: NativeAdaptiveLayout.cardMaxWidth),
            NativeAdaptiveLayout.preferredWidth(card, equalTo: header.widthAnchor, constant: -40),
            card.heightAnchor.constraint(greaterThanOrEqualToConstant: signedIn ? 238 : 128),
            card.bottomAnchor.constraint(equalTo: header.bottomAnchor, constant: -10)
        ])

        if let profile {
            configureSignedInCard(card, profile: profile)
        } else {
            configureSignedOutCard(card)
        }

        if header.bounds.width > 0 {
            let fittingTarget = CGSize(
                width: header.bounds.width,
                height: UIView.layoutFittingCompressedSize.height
            )
            let fittingHeight = header.systemLayoutSizeFitting(
                fittingTarget,
                withHorizontalFittingPriority: .required,
                verticalFittingPriority: .fittingSizeLevel
            ).height
            if fittingHeight > 1 {
                header.frame.size.height = ceil(fittingHeight)
            }
        }
        return header
    }

    private func updateSettingsHeaderHeight() {
        guard let header = adaptiveHeaderView, tableView.bounds.width > 0 else { return }
        if abs(header.bounds.width - tableView.bounds.width) > 0.5 {
            header.bounds.size.width = tableView.bounds.width
        }
        let target = CGSize(width: tableView.bounds.width, height: UIView.layoutFittingCompressedSize.height)
        let height = header.systemLayoutSizeFitting(
            target,
            withHorizontalFittingPriority: .required,
            verticalFittingPriority: .fittingSizeLevel
        ).height
        guard height > 0, abs(header.frame.height - height) > 0.5 else { return }
        header.frame.size.height = height
        tableView.tableHeaderView = header
    }

    private func makeVersionFooter() -> UIView {
        let footer = UIView(frame: CGRect(x: 0, y: 0, width: view.bounds.width, height: 72))
        let label = UILabel()
        label.text = NativeSettingsAppMetadata.version()
        label.font = AlmidyDesignTokens.Font.body(14)
        label.textColor = AlmidyDesignTokens.Color.settingsSecondary
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        footer.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: footer.centerXAnchor),
            label.topAnchor.constraint(equalTo: footer.topAnchor, constant: 20)
        ])
        return footer
    }

    private func makePromoCard() -> UIView {
        let card = UIView()
        card.backgroundColor = AlmidyDesignTokens.Color.settingsCard
        card.layer.cornerRadius = AlmidyDesignTokens.Radius.card
        card.layer.borderWidth = 1
        card.layer.borderColor = AlmidyDesignTokens.Color.settingsLine.cgColor

        let eyebrow = UILabel()
        eyebrow.text = "ALMIDY"
        eyebrow.font = AlmidyDesignTokens.Font.section(14)
        eyebrow.textColor = AlmidyDesignTokens.Color.settingsGold

        let title = UILabel()
        title.text = "Plan with confidence"
        title.font = AlmidyDesignTokens.Font.title(22)
        title.textColor = AlmidyDesignTokens.Color.settingsText

        let copy = UILabel()
        copy.text = "Keep trip details and reservations organized in one place."
        copy.font = AlmidyDesignTokens.Font.body(16)
        copy.textColor = AlmidyDesignTokens.Color.settingsSecondary
        copy.numberOfLines = 2

        let icon = UIImageView(image: UIImage(systemName: "envelope.open.fill"))
        icon.tintColor = AlmidyDesignTokens.Color.settingsGold
        icon.contentMode = .scaleAspectFit

        [eyebrow, title, copy, icon].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            card.addSubview($0)
        }
        let preferredIconWidth = icon.widthAnchor.constraint(equalToConstant: 54)
        preferredIconWidth.priority = UILayoutPriority(999)
        let preferredIconHeight = icon.heightAnchor.constraint(equalToConstant: 54)
        preferredIconHeight.priority = UILayoutPriority(999)
        let preferredTitleSpacing = title.trailingAnchor.constraint(lessThanOrEqualTo: icon.leadingAnchor, constant: -12)
        preferredTitleSpacing.priority = UILayoutPriority(999)
        let preferredCopySpacing = copy.trailingAnchor.constraint(equalTo: icon.leadingAnchor, constant: -12)
        preferredCopySpacing.priority = UILayoutPriority(999)
        NSLayoutConstraint.activate([
            eyebrow.topAnchor.constraint(equalTo: card.topAnchor, constant: 24),
            eyebrow.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            title.topAnchor.constraint(equalTo: eyebrow.bottomAnchor, constant: 8),
            title.leadingAnchor.constraint(equalTo: eyebrow.leadingAnchor),
            preferredTitleSpacing,
            copy.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 7),
            copy.leadingAnchor.constraint(equalTo: eyebrow.leadingAnchor),
            preferredCopySpacing,
            icon.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -22),
            icon.centerYAnchor.constraint(equalTo: card.centerYAnchor),
            preferredIconWidth,
            preferredIconHeight
        ])
        return card
    }

    private func configureSignedInCard(_ card: UIView, profile: NativeAuthProfile) {
        card.isAccessibilityElement = true
        card.accessibilityLabel = "Edit profile for \(profile.name.isEmpty ? "Almidy Traveler" : profile.name)"
        card.accessibilityTraits = .button
        card.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(openProfile)))

        let avatar = UIImageView(image: UIImage(systemName: "person.crop.circle"))
        avatar.tintColor = AlmidyDesignTokens.Color.settingsSecondary
        avatar.contentMode = .scaleAspectFit
        avatar.translatesAutoresizingMaskIntoConstraints = false

        let name = UILabel()
        name.text = profile.name.isEmpty ? "Almidy Traveler" : profile.name
        name.font = AlmidyDesignTokens.Font.title(24)
        name.textColor = AlmidyDesignTokens.Color.settingsText
        name.textAlignment = .center
        name.translatesAutoresizingMaskIntoConstraints = false

        let email = UILabel()
        email.text = profile.email
        email.font = AlmidyDesignTokens.Font.body(16)
        email.textColor = AlmidyDesignTokens.Color.settingsGold
        email.textAlignment = .center
        email.lineBreakMode = .byTruncatingMiddle
        email.translatesAutoresizingMaskIntoConstraints = false

        [avatar, name, email].forEach(card.addSubview)
        let preferredAvatarWidth = avatar.widthAnchor.constraint(equalToConstant: 118)
        preferredAvatarWidth.priority = UILayoutPriority(999)
        let preferredAvatarHeight = avatar.heightAnchor.constraint(equalToConstant: 118)
        preferredAvatarHeight.priority = UILayoutPriority(999)
        let preferredNameLeading = name.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 18)
        preferredNameLeading.priority = UILayoutPriority(999)
        let preferredNameTrailing = name.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18)
        preferredNameTrailing.priority = UILayoutPriority(999)
        NSLayoutConstraint.activate([
            avatar.topAnchor.constraint(equalTo: card.topAnchor, constant: 28),
            avatar.centerXAnchor.constraint(equalTo: card.centerXAnchor),
            preferredAvatarWidth,
            preferredAvatarHeight,
            name.topAnchor.constraint(equalTo: avatar.bottomAnchor, constant: 14),
            preferredNameLeading,
            preferredNameTrailing,
            email.topAnchor.constraint(equalTo: name.bottomAnchor, constant: 4),
            email.leadingAnchor.constraint(equalTo: name.leadingAnchor),
            email.trailingAnchor.constraint(equalTo: name.trailingAnchor),
            email.bottomAnchor.constraint(lessThanOrEqualTo: card.bottomAnchor, constant: -28)
        ])
    }

    private func configureSignedOutCard(_ card: UIView) {
        card.isAccessibilityElement = true
        card.accessibilityLabel = "Save your trips. Log in or create an account."
        card.accessibilityTraits = .button
        card.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(openProfile)))

        let icon = UIImageView(image: UIImage(systemName: "icloud"))
        icon.tintColor = AlmidyDesignTokens.Color.settingsIcon
        icon.contentMode = .scaleAspectFit
        let eyebrow = UILabel()
        eyebrow.text = "Save your trips"
        eyebrow.font = AlmidyDesignTokens.Font.body(15)
        eyebrow.textColor = AlmidyDesignTokens.Color.settingsGold
        let title = UILabel()
        title.text = "Log in or create an account"
        title.font = AlmidyDesignTokens.Font.body(18)
        title.textColor = AlmidyDesignTokens.Color.settingsText
        let chevron = UIImageView(image: UIImage(systemName: "chevron.right"))
        chevron.tintColor = AlmidyDesignTokens.Color.settingsSecondary

        [icon, eyebrow, title, chevron].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            card.addSubview($0)
        }
        NSLayoutConstraint.activate([
            icon.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            icon.centerYAnchor.constraint(equalTo: card.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 30),
            icon.heightAnchor.constraint(equalToConstant: 30),
            eyebrow.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 16),
            eyebrow.bottomAnchor.constraint(equalTo: card.centerYAnchor, constant: -2),
            title.leadingAnchor.constraint(equalTo: eyebrow.leadingAnchor),
            title.topAnchor.constraint(equalTo: card.centerYAnchor, constant: 2),
            title.trailingAnchor.constraint(lessThanOrEqualTo: chevron.leadingAnchor, constant: -10),
            chevron.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            chevron.centerYAnchor.constraint(equalTo: card.centerYAnchor),
            title.bottomAnchor.constraint(lessThanOrEqualTo: card.bottomAnchor, constant: -20)
        ])
    }

    @objc private func openProfile() {
        guard profile != nil else {
            onOpenAccount()
            return
        }
        let menu = NativeProfileMenuViewController(
            onEditProfile: { [weak self] in self?.onOpenAccount() },
            onChangePassword: { [weak self] completion in self?.onChangePassword(completion) },
            onSignOut: { [weak self] in self?.onSignOut() }
        )
        menu.modalPresentationStyle = .popover
        menu.preferredContentSize = CGSize(width: 280, height: 188)
        if let popover = menu.popoverPresentationController,
           let sourceView = tableView.tableHeaderView {
            popover.sourceView = sourceView
            popover.sourceRect = CGRect(x: sourceView.bounds.midX - 1, y: 20, width: 2, height: 2)
            popover.permittedArrowDirections = .down
            popover.delegate = menu
            popover.backgroundColor = AlmidyDesignTokens.Color.settingsCard
        }
        present(menu, animated: true)
    }

    @objc private func close() {
        dismiss(animated: true)
    }

    private func loadPreferences() {
        preferenceState = .loading
        tableView.reloadData()
        onLoadPreferences { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let preferences): self.preferenceState = .loaded(preferences)
            case .failure: self.preferenceState = .failed(self.preferenceState.preferences)
            }
            self.tableView.reloadData()
        }
    }

    private func chooseCurrency(from sourceView: UIView) {
        let alert = UIAlertController(title: "Default currency", message: "Used for new expense records. Existing money is not converted.", preferredStyle: .actionSheet)
        for currency in NativeCurrency.allCases {
            alert.addAction(UIAlertAction(title: currency.label, style: .default) { [weak self] _ in
                self?.savePreference(["default_currency": currency.rawValue])
            })
        }
        presentPreferenceSheet(alert, from: sourceView)
    }

    private func chooseDistanceUnit(from sourceView: UIView) {
        let alert = UIAlertController(title: "Distance unit", message: "Used when Almidy formats distances.", preferredStyle: .actionSheet)
        for unit in NativeDistanceUnit.allCases {
            alert.addAction(UIAlertAction(title: unit.label, style: .default) { [weak self] _ in
                self?.savePreference(["distance_unit": unit.rawValue])
            })
        }
        presentPreferenceSheet(alert, from: sourceView)
    }

    private func presentPreferenceSheet(_ alert: UIAlertController, from sourceView: UIView) {
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        if let popover = alert.popoverPresentationController {
            popover.sourceView = sourceView
            popover.sourceRect = sourceView.bounds
        }
        present(alert, animated: true)
    }

    private func savePreference(_ values: [String: String]) {
        guard let current = preferenceState.preferences else { return }
        preferenceState = .saving(current)
        tableView.reloadData()
        onUpdatePreferences(values) { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let preferences): self.preferenceState = .loaded(preferences)
            case .failure: self.preferenceState = .failed(current)
            }
            self.tableView.reloadData()
        }
    }

    private func shareAlmidy(from sourceView: UIView) {
        let activity = UIActivityViewController(activityItems: [NativeShareContract.message, NativeShareContract.url], applicationActivities: nil)
        if let popover = activity.popoverPresentationController {
            popover.sourceView = sourceView
            popover.sourceRect = sourceView.bounds
        }
        present(activity, animated: true)
    }

    func numberOfSections(in tableView: UITableView) -> Int {
        sections.count
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        sections[section].rows.count
    }

    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        sections[section].title.uppercased()
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "native-settings-row", for: indexPath)
        let row = sections[indexPath.section].rows[indexPath.row]
        var content = cell.defaultContentConfiguration()
        content.text = row.title
        content.secondaryText = row.detail
        content.textProperties.font = AlmidyDesignTokens.Font.body(17)
        content.textProperties.color = row.isEnabled
            ? AlmidyDesignTokens.Color.settingsText
            : AlmidyDesignTokens.Color.settingsSecondary
        content.secondaryTextProperties.font = AlmidyDesignTokens.Font.body(14)
        content.secondaryTextProperties.color = AlmidyDesignTokens.Color.settingsSecondary
        content.image = UIImage(systemName: row.systemImageName)
        content.imageProperties.tintColor = row.isEnabled
            ? AlmidyDesignTokens.Color.settingsIcon
            : AlmidyDesignTokens.Color.settingsSecondary
        content.imageProperties.maximumSize = CGSize(width: 24, height: 24)
        cell.contentConfiguration = content
        cell.backgroundColor = AlmidyDesignTokens.Color.settingsRowBackground
        cell.tintColor = AlmidyDesignTokens.Color.settingsGold
        cell.accessoryType = row.showsDisclosureIndicator ? .disclosureIndicator : .none
        cell.selectionStyle = row.isEnabled ? .default : .none
        cell.isUserInteractionEnabled = row.isEnabled
        cell.accessibilityTraits = row.isEnabled ? .button : [.notEnabled]
        return cell
    }

    func tableView(_ tableView: UITableView, willDisplayHeaderView view: UIView, forSection section: Int) {
        guard let header = view as? UITableViewHeaderFooterView else { return }
        header.textLabel?.font = AlmidyDesignTokens.Font.section(15)
        header.textLabel?.textColor = AlmidyDesignTokens.Color.settingsSecondary
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let row = sections[indexPath.section].rows[indexPath.row]
        guard let action = row.action else { return }
        switch action {
        case .openManualReservationImporter:
            onOpenManualReservationImporter()
        case .openTrips:
            onOpenTrips()
        case .openTravelBook:
            onOpenTravelBook()
        case .openHelp:
            onOpenHelp()
        case .openNotificationPreferences:
            onOpenNotificationPreferences()
        case .selectCurrency:
            chooseCurrency(from: tableView.cellForRow(at: indexPath) ?? tableView)
        case .selectDistanceUnit:
            chooseDistanceUnit(from: tableView.cellForRow(at: indexPath) ?? tableView)
        case .shareAlmidy:
            shareAlmidy(from: tableView.cellForRow(at: indexPath) ?? tableView)
        case .openPublicPage(let path):
            onOpenPublicPage(path)
        case .composeSupportEmail(let address):
            onTalkToUs(address)
        }
    }
}

private final class NativeProfileMenuViewController: UIViewController, UIPopoverPresentationControllerDelegate {
    private let onEditProfile: () -> Void
    private let onChangePassword: (@escaping (Bool) -> Void) -> Void
    private let onSignOut: () -> Void

    init(onEditProfile: @escaping () -> Void, onChangePassword: @escaping (@escaping (Bool) -> Void) -> Void, onSignOut: @escaping () -> Void) {
        self.onEditProfile = onEditProfile
        self.onChangePassword = onChangePassword
        self.onSignOut = onSignOut
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = AlmidyDesignTokens.Color.settingsCard

        let edit = menuButton(title: "Edit Profile", color: AlmidyDesignTokens.Color.settingsText, action: #selector(editProfile))
        let password = menuButton(
            title: NativeProfileMenuModel.changePasswordTitle,
            color: AlmidyDesignTokens.Color.settingsSecondary,
            action: #selector(changePassword)
        )
        password.isEnabled = NativeProfileMenuModel.isChangePasswordEnabled
        let signOut = menuButton(title: "Sign Out", color: AlmidyDesignTokens.Color.danger, action: #selector(signOut))
        let stack = UIStackView(arrangedSubviews: [edit, password, signOut])
        stack.axis = .vertical
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 10),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            stack.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -10)
        ])
    }

    @objc private func changePassword() {
        onChangePassword { [weak self] success in
            let alert = UIAlertController(
                title: success ? "Reset requested" : "Could not request reset",
                message: success ? NativeProfileMenuModel.resetSuccessMessage : "Please wait and try again. Almidy does not send reset requests to client-supplied email addresses.",
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            self?.present(alert, animated: true)
        }
    }

    private func menuButton(title: String, color: UIColor, action: Selector?) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.setTitleColor(color, for: .normal)
        button.titleLabel?.font = AlmidyDesignTokens.Font.button(18)
        button.backgroundColor = AlmidyDesignTokens.Color.settingsBackground
        button.layer.cornerRadius = 18
        let heightConstraint = button.heightAnchor.constraint(equalToConstant: 50)
        heightConstraint.priority = UILayoutPriority(999)
        heightConstraint.isActive = true
        if let action {
            button.addTarget(self, action: action, for: .touchUpInside)
        }
        return button
    }

    @objc private func editProfile() { finish(with: onEditProfile) }
    @objc private func signOut() { finish(with: onSignOut) }

    private func finish(with action: @escaping () -> Void) {
        dismiss(animated: true, completion: action)
    }

    func adaptivePresentationStyle(for controller: UIPresentationController) -> UIModalPresentationStyle { .none }
}

private enum NativeAuthResult {
    case authenticated
    case createdPendingConfirmation
    case cancelled
}

private final class NativeAuthViewController: UIViewController, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding, ASWebAuthenticationPresentationContextProviding {
    private enum Screen { case choices, signup, login }

    private let onFinish: (NativeAuthResult) -> Void
    private var screen: Screen = .choices
    private var currentNonce: String?
    private var webAuthSession: ASWebAuthenticationSession?

    private let scrollView = UIScrollView()
    private let contentView = UIView()
    private let bodyStack = UIStackView()
    private let statusLabel = UILabel()
    private let activity = UIActivityIndicatorView(style: .medium)
    private var nameField: UITextField?
    private var emailField: UITextField?
    private var passwordField: UITextField?
    private var actionButtons: [UIControl] = []
    private var choicesTopSpacerConstraint: NSLayoutConstraint?
    var startsInSignup = false

    private let orange = AlmidyDesignTokens.Color.gold
    private let warmBackground = AlmidyDesignTokens.Color.surface

    init(onFinish: @escaping (NativeAuthResult) -> Void) {
        self.onFinish = onFinish
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        if startsInSignup {
            screen = .signup
        }
        view.backgroundColor = warmBackground
        configureShell()
        rebuildScreen()
    }

    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        choicesTopSpacerConstraint?.constant = size.height < 700 || size.width > size.height ? 12 : 48
    }

    private func configureShell() {
        scrollView.alwaysBounceVertical = true
        scrollView.keyboardDismissMode = .interactive
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        contentView.translatesAutoresizingMaskIntoConstraints = false
        bodyStack.axis = .vertical
        bodyStack.alignment = .fill
        bodyStack.spacing = 16
        bodyStack.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.font = .systemFont(ofSize: 15, weight: .medium)
        statusLabel.textColor = AlmidyDesignTokens.Color.danger
        statusLabel.numberOfLines = 0
        statusLabel.textAlignment = .center
        statusLabel.isAccessibilityElement = true
        activity.hidesWhenStopped = true
        activity.accessibilityLabel = "Working"

        view.addSubview(scrollView)
        scrollView.addSubview(contentView)
        contentView.addSubview(bodyStack)
        NSLayoutConstraint.activate([
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            contentView.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),
            bodyStack.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            bodyStack.leadingAnchor.constraint(greaterThanOrEqualTo: contentView.leadingAnchor, constant: 24),
            bodyStack.trailingAnchor.constraint(lessThanOrEqualTo: contentView.trailingAnchor, constant: -24),
            bodyStack.widthAnchor.constraint(lessThanOrEqualToConstant: NativeAdaptiveLayout.formMaxWidth),
            NativeAdaptiveLayout.preferredWidth(bodyStack, equalTo: contentView.widthAnchor, constant: -48),
            bodyStack.topAnchor.constraint(equalTo: contentView.safeAreaLayoutGuide.topAnchor, constant: 14),
            bodyStack.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -24)
        ])
    }

    private func rebuildScreen() {
        bodyStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        bodyStack.spacing = 16
        nameField = nil
        emailField = nil
        passwordField = nil
        actionButtons.removeAll()
        choicesTopSpacerConstraint = nil
        statusLabel.text = nil

        let header = UIStackView()
        header.axis = .horizontal
        header.alignment = .center
        header.distribution = .fill
        header.heightAnchor.constraint(equalToConstant: 50).isActive = true

        let leading = UIButton(type: .system)
        leading.titleLabel?.font = AlmidyDesignTokens.Font.button(19)
        leading.setTitle(screen == .choices ? "Cancel" : "‹", for: .normal)
        leading.setTitleColor(AlmidyDesignTokens.Color.textPrimary, for: .normal)
        if screen == .choices {
            leading.backgroundColor = AlmidyDesignTokens.Color.card
            leading.layer.cornerRadius = AlmidyDesignTokens.Radius.capsule
            leading.layer.borderWidth = 1
            leading.layer.borderColor = AlmidyDesignTokens.Color.line.cgColor
            leading.contentEdgeInsets = UIEdgeInsets(top: 0, left: 22, bottom: 0, right: 22)
            leading.heightAnchor.constraint(equalToConstant: 50).isActive = true
        }
        leading.addTarget(self, action: #selector(handleLeadingAction), for: .touchUpInside)
        leading.accessibilityLabel = screen == .choices ? "Cancel" : "Back to account options"
        let trailing = UIButton(type: .system)
        var trailingConfiguration = UIButton.Configuration.filled()
        trailingConfiguration.title = screen == .signup ? "Signup" : screen == .login ? "Login" : ""
        trailingConfiguration.baseBackgroundColor = orange
        trailingConfiguration.baseForegroundColor = AlmidyDesignTokens.Color.settingsText
        trailingConfiguration.cornerStyle = .capsule
        trailingConfiguration.contentInsets = NSDirectionalEdgeInsets(top: 11, leading: 18, bottom: 11, trailing: 18)
        trailingConfiguration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attributes in
            var updated = attributes
            updated.font = AlmidyDesignTokens.Font.button(17)
            return updated
        }
        trailing.configuration = trailingConfiguration
        trailing.addTarget(self, action: #selector(submit), for: .touchUpInside)
        trailing.accessibilityLabel = screen == .signup ? "Submit signup" : "Submit login"
        trailing.isHidden = screen == .choices
        trailing.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        let leftSpacer = UIView()
        let rightSpacer = UIView()
        let headerTitle = UILabel()
        headerTitle.text = screen == .signup ? "Create an Account" : screen == .login ? "Have an account?" : ""
        headerTitle.font = AlmidyDesignTokens.Font.title(22)
        headerTitle.textColor = AlmidyDesignTokens.Color.textPrimary
        headerTitle.textAlignment = .center
        header.addArrangedSubview(leading)
        header.addArrangedSubview(leftSpacer)
        header.addArrangedSubview(headerTitle)
        header.addArrangedSubview(rightSpacer)
        header.addArrangedSubview(trailing)
        leading.widthAnchor.constraint(greaterThanOrEqualToConstant: 72).isActive = true
        trailing.widthAnchor.constraint(greaterThanOrEqualToConstant: 72).isActive = true
        bodyStack.addArrangedSubview(header)

        switch screen {
        case .choices: buildChoices()
        case .signup: buildEmailForm(signingUp: true)
        case .login: buildEmailForm(signingUp: false)
        }
    }

    private func buildChoices() {
        bodyStack.spacing = 12
        let topSpacer = UIView()
        choicesTopSpacerConstraint = topSpacer.heightAnchor.constraint(
            equalToConstant: NativeAdaptiveLayout.isCompactHeight(view) ? 12 : 48
        )
        choicesTopSpacerConstraint?.isActive = true
        bodyStack.addArrangedSubview(topSpacer)
        let avatars = UIView()
        avatars.translatesAutoresizingMaskIntoConstraints = false
        avatars.heightAnchor.constraint(equalToConstant: 148).isActive = true
        avatars.widthAnchor.constraint(equalToConstant: 282).isActive = true
        let avatarContainer = UIView()
        avatarContainer.addSubview(avatars)
        NSLayoutConstraint.activate([
            avatars.centerXAnchor.constraint(equalTo: avatarContainer.centerXAnchor),
            avatars.topAnchor.constraint(equalTo: avatarContainer.topAnchor),
            avatars.bottomAnchor.constraint(equalTo: avatarContainer.bottomAnchor)
        ])

        let left = makeAvatarBadge(
            emoji: "👨🏻‍🦰",
            background: AlmidyDesignTokens.Color.avatarRoseSurface,
            size: 88
        )
        let center = makeAvatarBadge(
            emoji: "👩🏻‍🦰",
            background: AlmidyDesignTokens.Color.avatarPeachSurface,
            size: 132
        )
        let right = makeAvatarBadge(
            emoji: "👩🏾‍🦱",
            background: AlmidyDesignTokens.Color.avatarLavenderSurface,
            size: 88
        )
        avatars.addSubview(left)
        avatars.addSubview(right)
        avatars.addSubview(center)
        NSLayoutConstraint.activate([
            left.leadingAnchor.constraint(equalTo: avatars.leadingAnchor, constant: 4),
            left.topAnchor.constraint(equalTo: avatars.topAnchor, constant: 22),
            left.widthAnchor.constraint(equalToConstant: 88),
            left.heightAnchor.constraint(equalTo: left.widthAnchor),
            right.trailingAnchor.constraint(equalTo: avatars.trailingAnchor, constant: -4),
            right.topAnchor.constraint(equalTo: avatars.topAnchor, constant: 22),
            right.widthAnchor.constraint(equalToConstant: 88),
            right.heightAnchor.constraint(equalTo: right.widthAnchor),
            center.centerXAnchor.constraint(equalTo: avatars.centerXAnchor),
            center.topAnchor.constraint(equalTo: avatars.topAnchor, constant: 4),
            center.widthAnchor.constraint(equalToConstant: 132),
            center.heightAnchor.constraint(equalTo: center.widthAnchor)
        ])
        bodyStack.addArrangedSubview(avatarContainer)

        let title = makeLabel("Create Account", size: 34, weight: .medium, color: AlmidyDesignTokens.Color.textPrimary, alignment: .center)
        bodyStack.addArrangedSubview(title)
        let copyContainer = UIView()
        let copy = makeLabel("Store your data on the cloud to have access from other devices.\n\nYou can delete your account at any time from the app.", size: 16, weight: .regular, color: AlmidyDesignTokens.Color.textSecondary, alignment: .center)
        copyContainer.addSubview(copy)
        copy.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            copy.topAnchor.constraint(equalTo: copyContainer.topAnchor),
            copy.bottomAnchor.constraint(equalTo: copyContainer.bottomAnchor),
            copy.leadingAnchor.constraint(equalTo: copyContainer.leadingAnchor, constant: 8),
            copy.trailingAnchor.constraint(equalTo: copyContainer.trailingAnchor, constant: -8)
        ])
        bodyStack.addArrangedSubview(copyContainer)
        // Apple requires its sign-in treatment to retain the provider's black brand surface.
        bodyStack.addArrangedSubview(centeredAuthAction(makeAppleButton()))
        bodyStack.addArrangedSubview(centeredAuthAction(makeGoogleButton()))
        bodyStack.addArrangedSubview(centeredAuthAction(makeButton("Sign up with email", background: orange, titleColor: .white, height: 54, fontSize: 17, action: #selector(showSignup))))
        let login = UIButton(type: .system)
        login.setTitle("Have an account?", for: .normal)
        login.setTitleColor(AlmidyDesignTokens.Color.goldSoft, for: .normal)
        login.titleLabel?.font = AlmidyDesignTokens.Font.button(17)
        login.addTarget(self, action: #selector(showLogin), for: .touchUpInside)
        login.accessibilityLabel = "Log in with an existing account"
        login.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        bodyStack.addArrangedSubview(statusLabel)
        bodyStack.addArrangedSubview(login)
    }

    private func makeAvatarBadge(emoji: String, background: UIColor, size: CGFloat) -> UIView {
        let wrapper = UIView()
        wrapper.translatesAutoresizingMaskIntoConstraints = false
        wrapper.isAccessibilityElement = true
        wrapper.accessibilityLabel = "Profile avatar"

        let circle = UIView()
        circle.backgroundColor = background
        circle.layer.cornerRadius = size / 2
        circle.clipsToBounds = true
        circle.translatesAutoresizingMaskIntoConstraints = false
        wrapper.addSubview(circle)

        let face = UIImageView(image: emojiImage(emoji, size: size * 0.62))
        face.contentMode = .scaleAspectFit
        face.translatesAutoresizingMaskIntoConstraints = false
        circle.addSubview(face)
        NSLayoutConstraint.activate([
            circle.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor),
            circle.trailingAnchor.constraint(equalTo: wrapper.trailingAnchor),
            circle.topAnchor.constraint(equalTo: wrapper.topAnchor),
            circle.bottomAnchor.constraint(equalTo: wrapper.bottomAnchor),
            face.leadingAnchor.constraint(equalTo: circle.leadingAnchor),
            face.trailingAnchor.constraint(equalTo: circle.trailingAnchor),
            face.topAnchor.constraint(equalTo: circle.topAnchor, constant: 4),
            face.bottomAnchor.constraint(equalTo: circle.bottomAnchor, constant: -2)
        ])
        return wrapper
    }

    private func centeredAuthAction(_ control: UIView) -> UIView {
        let container = UIView()
        control.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(control)
        let preferredWidth = control.widthAnchor.constraint(equalTo: container.widthAnchor, constant: -16)
        preferredWidth.priority = .defaultHigh
        NSLayoutConstraint.activate([
            control.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            control.topAnchor.constraint(equalTo: container.topAnchor),
            control.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            control.leadingAnchor.constraint(greaterThanOrEqualTo: container.leadingAnchor),
            control.trailingAnchor.constraint(lessThanOrEqualTo: container.trailingAnchor),
            control.widthAnchor.constraint(lessThanOrEqualToConstant: 320),
            preferredWidth
        ])
        return container
    }

    private func emojiImage(_ emoji: String, size: CGFloat) -> UIImage? {
        let canvas = CGSize(width: size * 1.35, height: size * 1.35)
        let renderer = UIGraphicsImageRenderer(size: canvas)
        return renderer.image { _ in
            let paragraph = NSMutableParagraphStyle()
            paragraph.alignment = .center
            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: size),
                .paragraphStyle: paragraph
            ]
            let rect = CGRect(x: 0, y: (canvas.height - size * 1.15) / 2, width: canvas.width, height: size * 1.15)
            (emoji as NSString).draw(in: rect, withAttributes: attributes)
        }
    }

    private func makeGoogleButton() -> UIButton {
        let button = UIButton(type: .system)
        button.backgroundColor = AlmidyDesignTokens.Color.card
        button.layer.cornerRadius = AlmidyDesignTokens.Radius.capsule
        button.layer.borderWidth = 1
        button.layer.borderColor = AlmidyDesignTokens.Color.line.cgColor
        button.heightAnchor.constraint(equalToConstant: 54).isActive = true
        button.addTarget(self, action: #selector(signInWithGoogle), for: .touchUpInside)
        button.accessibilityLabel = "Continue with Google"
        actionButtons.append(button)

        let content = UIStackView()
        content.axis = .horizontal
        content.alignment = .center
        content.spacing = 10
        content.translatesAutoresizingMaskIntoConstraints = false
        button.addSubview(content)

        // Provider-brand exception: preserve Google's official multicolor mark; do not tint it.
        let logo = UIImageView(image: UIImage(named: "GoogleG"))
        logo.contentMode = .scaleAspectFit
        logo.isAccessibilityElement = false
        logo.translatesAutoresizingMaskIntoConstraints = false
        logo.widthAnchor.constraint(equalToConstant: 21).isActive = true
        logo.heightAnchor.constraint(equalTo: logo.widthAnchor).isActive = true
        content.addArrangedSubview(logo)

        let title = UILabel()
        title.text = "Continue with Google"
        title.textColor = AlmidyDesignTokens.Color.textPrimary
        title.font = AlmidyDesignTokens.Font.button(16)
        content.addArrangedSubview(title)

        NSLayoutConstraint.activate([
            content.centerXAnchor.constraint(equalTo: button.centerXAnchor),
            content.centerYAnchor.constraint(equalTo: button.centerYAnchor)
        ])
        return button
    }

    private func makeAppleButton() -> ASAuthorizationAppleIDButton {
        let button = ASAuthorizationAppleIDButton(type: .signUp, style: .black)
        button.cornerRadius = 27
        button.heightAnchor.constraint(equalToConstant: 54).isActive = true
        button.accessibilityLabel = "Sign up with Apple"
        button.addTarget(self, action: #selector(signInWithApple), for: .touchUpInside)
        actionButtons.append(button)
        return button
    }

    private func buildEmailForm(signingUp: Bool) {
        if signingUp {
            let icon = UIImageView(image: UIImage(systemName: "person.crop.circle.badge.plus"))
            icon.tintColor = .systemGray
            icon.contentMode = .scaleAspectFit
            icon.heightAnchor.constraint(equalToConstant: 150).isActive = true
            bodyStack.addArrangedSubview(icon)
        }
        let fields = UIStackView()
        fields.axis = .vertical
        fields.spacing = 0
        if signingUp {
            nameField = makeField("Full name", contentType: .name)
            fields.addArrangedSubview(nameField!)
        }
        emailField = makeField("your@email.com", contentType: .emailAddress)
        passwordField = makeField("******", contentType: .password)
        passwordField?.isSecureTextEntry = true
        fields.addArrangedSubview(emailField!)
        fields.addArrangedSubview(passwordField!)
        fields.arrangedSubviews.forEach { $0.heightAnchor.constraint(equalToConstant: 64).isActive = true }
        fields.backgroundColor = AlmidyDesignTokens.Color.darkInput
        fields.layer.cornerRadius = 24
        fields.layer.borderWidth = 1
        fields.layer.borderColor = AlmidyDesignTokens.Color.darkInputBorder.cgColor
        fields.clipsToBounds = true
        bodyStack.addArrangedSubview(fields)
        bodyStack.addArrangedSubview(statusLabel)
        if !signingUp {
            let forgot = UIButton(type: .system)
            forgot.setTitle("Forgot Password?", for: .normal)
            forgot.setTitleColor(orange, for: .normal)
            forgot.titleLabel?.font = .systemFont(ofSize: 20, weight: .regular)
            forgot.addTarget(self, action: #selector(forgotPassword), for: .touchUpInside)
            forgot.accessibilityLabel = "Forgot password"
            forgot.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
            bodyStack.addArrangedSubview(forgot)
        }
        let button = makePrimaryAuthButton(signingUp ? "Signup" : "Login")
        bodyStack.addArrangedSubview(button)
        bodyStack.addArrangedSubview(activity)
    }

    private func makePrimaryAuthButton(_ title: String) -> UIButton {
        let button = UIButton(type: .system)
        var configuration = UIButton.Configuration.filled()
        configuration.title = title
        configuration.baseBackgroundColor = orange
        configuration.baseForegroundColor = AlmidyDesignTokens.Color.settingsText
        configuration.cornerStyle = .capsule
        configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attributes in
            var updated = attributes
            updated.font = AlmidyDesignTokens.Font.button(17)
            return updated
        }
        button.configuration = configuration
        button.heightAnchor.constraint(greaterThanOrEqualToConstant: 48).isActive = true
        button.addTarget(self, action: #selector(submit), for: .touchUpInside)
        button.accessibilityLabel = title == "Signup" ? "Submit signup" : "Submit login"
        actionButtons.append(button)
        return button
    }

    private func makeLabel(_ text: String, size: CGFloat, weight: UIFont.Weight, color: UIColor, alignment: NSTextAlignment) -> UILabel {
        let label = UILabel()
        label.text = text
        label.font = .systemFont(ofSize: size, weight: weight)
        label.textColor = color
        label.textAlignment = alignment
        label.numberOfLines = 0
        return label
    }

    private func makeField(_ placeholder: String, contentType: UITextContentType) -> UITextField {
        let field = UITextField()
        field.attributedPlaceholder = NSAttributedString(
            string: placeholder,
            attributes: [.foregroundColor: AlmidyDesignTokens.Color.darkPlaceholder]
        )
        field.font = AlmidyDesignTokens.Font.body(21)
        field.textColor = AlmidyDesignTokens.Color.textPrimary
        field.backgroundColor = AlmidyDesignTokens.Color.darkInput
        field.setPadding(16)
        field.autocapitalizationType = .none
        field.autocorrectionType = .no
        field.textContentType = contentType
        return field
    }

    private func makeButton(_ title: String, background: UIColor, titleColor: UIColor = .white, border: Bool = false, height: CGFloat = AlmidyDesignTokens.Control.buttonHeight, fontSize: CGFloat = 17, action: Selector) -> UIButton {
        let button = UIButton(type: .system)
        var configuration = UIButton.Configuration.filled()
        configuration.title = title
        configuration.baseBackgroundColor = background
        configuration.baseForegroundColor = titleColor
        configuration.cornerStyle = .capsule
        configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attributes in
            var updated = attributes
            updated.font = AlmidyDesignTokens.Font.button(fontSize)
            return updated
        }
        button.configuration = configuration
        if border {
            button.layer.borderWidth = 1
            button.layer.borderColor = AlmidyDesignTokens.Color.line.cgColor
        }
        button.heightAnchor.constraint(equalToConstant: height).isActive = true
        button.addTarget(self, action: action, for: .touchUpInside)
        button.accessibilityLabel = title
        actionButtons.append(button)
        return button
    }

    @objc private func handleLeadingAction() {
        if screen == .choices {
            onFinish(.cancelled)
            dismiss(animated: true)
        } else {
            screen = .choices
            rebuildScreen()
        }
    }

    @objc private func showSignup() { screen = .signup; rebuildScreen() }
    @objc private func showLogin() { screen = .login; rebuildScreen() }

    @objc private func submit() {
        let email = emailField?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let password = passwordField?.text ?? ""
        let signingUp = screen == .signup
        guard email.contains("@"), password.count >= 6 else {
            showAuthStatus("Enter a valid email and a password with at least 6 characters.")
            return
        }
        setLoading(true)
        NativeSessionCoordinator.shared.authenticate(email: email, password: password, name: nameField?.text, signingUp: signingUp) { [weak self] result in
            guard let self else { return }
            self.setLoading(false)
            switch result {
            case .success(let session):
                if session == nil && signingUp {
                    self.onFinish(.createdPendingConfirmation)
                    self.showAuthStatus("Check your email to confirm your account.", isError: false)
                } else if session != nil {
                    self.onFinish(.authenticated)
                    self.dismiss(animated: true)
                }
            case .failure(let error): self.showAuthStatus(error.localizedDescription)
            }
        }
    }

    @objc private func signInWithGoogle() {
        setLoading(true)
        webAuthSession = NativeSessionCoordinator.shared.authenticateWithGoogle(using: self) { [weak self] result in
            guard let self else { return }
            self.setLoading(false)
            switch result {
            case .success:
                self.onFinish(.authenticated)
                self.dismiss(animated: true)
            case .failure(let error): self.showAuthStatus(error.localizedDescription)
            }
        }
    }

    @objc private func forgotPassword() {
        showAuthStatus("Password reset is available from the email sent by Almidy.", isError: false)
    }

    @objc private func signInWithApple() {
        let nonce = randomNonce()
        currentNonce = nonce
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.email, .fullName]
        request.nonce = sha256(nonce)
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        setLoading(true)
        controller.performRequests()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8),
              let nonce = currentNonce else {
            setLoading(false)
            showAuthStatus("Apple sign-in returned an invalid credential.")
            return
        }
        NativeSessionCoordinator.shared.authenticateWithApple(identityToken: token, nonce: nonce) { [weak self] result in
            guard let self else { return }
            self.setLoading(false)
            switch result {
            case .success:
                self.onFinish(.authenticated)
                self.dismiss(animated: true)
            case .failure(let error):
                self.showAuthStatus(error.localizedDescription)
            }
        }
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        setLoading(false)
        let nsError = error as NSError
        if nsError.code != ASAuthorizationError.canceled.rawValue {
            showAuthStatus(error.localizedDescription)
        }
    }

    private func showAuthStatus(_ message: String, isError: Bool = true) {
        statusLabel.textColor = isError ? AlmidyDesignTokens.Color.danger : AlmidyDesignTokens.Color.textSecondary
        statusLabel.text = message
        UIAccessibility.post(notification: .announcement, argument: message)
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        view.window ?? UIWindow()
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        view.window ?? UIWindow()
    }

    private func setLoading(_ loading: Bool) {
        actionButtons.forEach { $0.isEnabled = !loading }
        nameField?.isEnabled = !loading
        emailField?.isEnabled = !loading
        passwordField?.isEnabled = !loading
        loading ? activity.startAnimating() : activity.stopAnimating()
    }

    private func randomNonce(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length
        while remaining > 0 {
            var random: UInt8 = 0
            let status = SecRandomCopyBytes(kSecRandomDefault, 1, &random)
            if status == errSecSuccess && random < charset.count {
                result.append(charset[Int(random)])
                remaining -= 1
            }
        }
        return result
    }

    private func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

private final class NativeAccountViewController: UIViewController {
    private let profile: NativeAuthProfile
    private let isSignedIn: Bool
    private let onSignIn: () -> Void
    private let onSignOut: (@escaping (Bool) -> Void) -> Void
    private let onSaveName: (String, @escaping (Bool) -> Void) -> Void
    private let onDeleteAccount: () -> Void
    private let onSignedOut: () -> Void
    private let statusLabel = UILabel()
    private let actionButton = UIButton(type: .system)
    private let nameField = UITextField()
    private let saveButton = UIButton(type: .system)
    private let deleteButton = UIButton(type: .system)
    private let scrollView = UIScrollView()
    private let contentView = UIView()

    init(
        profile: NativeAuthProfile,
        isSignedIn: Bool,
        onSignIn: @escaping () -> Void,
        onSignOut: @escaping (@escaping (Bool) -> Void) -> Void,
        onSaveName: @escaping (String, @escaping (Bool) -> Void) -> Void,
        onDeleteAccount: @escaping () -> Void,
        onSignedOut: @escaping () -> Void = {}
    ) {
        self.profile = profile
        self.isSignedIn = isSignedIn
        self.onSignIn = onSignIn
        self.onSignOut = onSignOut
        self.onSaveName = onSaveName
        self.onDeleteAccount = onDeleteAccount
        self.onSignedOut = onSignedOut
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = AlmidyDesignTokens.Color.settingsBackground
        scrollView.alwaysBounceVertical = true
        scrollView.keyboardDismissMode = .interactive
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        contentView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        scrollView.addSubview(contentView)

        let closeButton = UIButton(type: .system)
        closeButton.setTitle("Cancel", for: .normal)
        closeButton.titleLabel?.font = AlmidyDesignTokens.Font.button(17)
        closeButton.setTitleColor(AlmidyDesignTokens.Color.settingsGold, for: .normal)
        closeButton.addTarget(self, action: #selector(close), for: .touchUpInside)
        closeButton.accessibilityLabel = "Cancel profile editing"

        let title = UILabel()
        title.text = "Edit Profile"
        title.font = AlmidyDesignTokens.Font.title(22)
        title.textColor = AlmidyDesignTokens.Color.settingsText
        title.textAlignment = .center

        var saveConfiguration = UIButton.Configuration.filled()
        saveConfiguration.title = "Save"
        saveConfiguration.baseBackgroundColor = AlmidyDesignTokens.Color.gold
        saveConfiguration.baseForegroundColor = AlmidyDesignTokens.Color.settingsText
        saveConfiguration.cornerStyle = .capsule
        saveButton.configuration = saveConfiguration
        saveButton.addTarget(self, action: #selector(saveProfile), for: .touchUpInside)
        saveButton.accessibilityLabel = "Save profile"

        let avatar = UIImageView(image: UIImage(systemName: "person.crop.circle"))
        avatar.tintColor = AlmidyDesignTokens.Color.settingsSecondary
        avatar.contentMode = .scaleAspectFit

        let profileCard = UIView()
        profileCard.backgroundColor = AlmidyDesignTokens.Color.settingsCard
        profileCard.layer.cornerRadius = AlmidyDesignTokens.Radius.card
        profileCard.layer.borderWidth = 1
        profileCard.layer.borderColor = AlmidyDesignTokens.Color.settingsLine.cgColor

        let nameLabel = UILabel()
        nameLabel.text = "Name"
        nameLabel.font = AlmidyDesignTokens.Font.body(17)
        nameLabel.textColor = AlmidyDesignTokens.Color.settingsText
        nameField.text = profile.name
        nameField.placeholder = "Your name"
        nameField.font = AlmidyDesignTokens.Font.body(17)
        nameField.textColor = AlmidyDesignTokens.Color.settingsText
        nameField.textAlignment = .right

        let divider = UIView()
        divider.backgroundColor = AlmidyDesignTokens.Color.settingsLine
        let emailLabel = UILabel()
        emailLabel.text = "Email"
        emailLabel.font = AlmidyDesignTokens.Font.body(17)
        emailLabel.textColor = AlmidyDesignTokens.Color.settingsText
        let emailValue = UILabel()
        emailValue.text = profile.email.isEmpty ? "Email unavailable" : profile.email
        emailValue.font = AlmidyDesignTokens.Font.body(17)
        emailValue.textColor = AlmidyDesignTokens.Color.settingsSecondary
        emailValue.textAlignment = .right
        emailValue.lineBreakMode = .byTruncatingMiddle

        actionButton.setTitle("Sign Out", for: .normal)
        actionButton.setTitleColor(AlmidyDesignTokens.Color.settingsGold, for: .normal)
        actionButton.titleLabel?.font = AlmidyDesignTokens.Font.button(17)
        actionButton.addTarget(self, action: #selector(action), for: .touchUpInside)
        actionButton.accessibilityLabel = isSignedIn ? "Sign out" : "Sign in"

        deleteButton.setTitle("Delete Account", for: .normal)
        deleteButton.setTitleColor(AlmidyDesignTokens.Color.danger, for: .normal)
        deleteButton.titleLabel?.font = AlmidyDesignTokens.Font.button(17)
        deleteButton.addTarget(self, action: #selector(confirmAccountDeletion), for: .touchUpInside)
        deleteButton.accessibilityLabel = "Delete account"

        [closeButton, title, saveButton, avatar, profileCard, actionButton, deleteButton, statusLabel].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            contentView.addSubview($0)
        }
        [nameLabel, nameField, divider, emailLabel, emailValue].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            profileCard.addSubview($0)
        }
        statusLabel.font = AlmidyDesignTokens.Font.body(15)
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0
        statusLabel.isAccessibilityElement = true
        statusLabel.text = "Avatar changes are available in web Account Settings."
        statusLabel.textColor = AlmidyDesignTokens.Color.settingsSecondary

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
            contentView.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),

            closeButton.topAnchor.constraint(equalTo: contentView.safeAreaLayoutGuide.topAnchor, constant: 12),
            closeButton.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            closeButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            saveButton.centerYAnchor.constraint(equalTo: closeButton.centerYAnchor),
            saveButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            saveButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 76),
            saveButton.heightAnchor.constraint(equalToConstant: 46),
            title.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            title.centerYAnchor.constraint(equalTo: closeButton.centerYAnchor),

            avatar.topAnchor.constraint(equalTo: closeButton.bottomAnchor, constant: 36),
            avatar.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            avatar.widthAnchor.constraint(equalToConstant: 132),
            avatar.heightAnchor.constraint(equalToConstant: 132),

            profileCard.topAnchor.constraint(equalTo: avatar.bottomAnchor, constant: 38),
            profileCard.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            profileCard.leadingAnchor.constraint(greaterThanOrEqualTo: contentView.leadingAnchor, constant: 24),
            profileCard.trailingAnchor.constraint(lessThanOrEqualTo: contentView.trailingAnchor, constant: -24),
            profileCard.widthAnchor.constraint(lessThanOrEqualToConstant: NativeAdaptiveLayout.formMaxWidth),
            NativeAdaptiveLayout.preferredWidth(profileCard, equalTo: contentView.widthAnchor, constant: -48),
            profileCard.heightAnchor.constraint(equalToConstant: 128),
            nameLabel.leadingAnchor.constraint(equalTo: profileCard.leadingAnchor, constant: 18),
            nameLabel.centerYAnchor.constraint(equalTo: profileCard.topAnchor, constant: 32),
            nameField.leadingAnchor.constraint(equalTo: nameLabel.trailingAnchor, constant: 16),
            nameField.trailingAnchor.constraint(equalTo: profileCard.trailingAnchor, constant: -18),
            nameField.centerYAnchor.constraint(equalTo: nameLabel.centerYAnchor),
            divider.leadingAnchor.constraint(equalTo: profileCard.leadingAnchor, constant: 18),
            divider.trailingAnchor.constraint(equalTo: profileCard.trailingAnchor),
            divider.centerYAnchor.constraint(equalTo: profileCard.centerYAnchor),
            divider.heightAnchor.constraint(equalToConstant: 1),
            emailLabel.leadingAnchor.constraint(equalTo: nameLabel.leadingAnchor),
            emailLabel.centerYAnchor.constraint(equalTo: profileCard.bottomAnchor, constant: -32),
            emailValue.leadingAnchor.constraint(equalTo: emailLabel.trailingAnchor, constant: 16),
            emailValue.trailingAnchor.constraint(equalTo: profileCard.trailingAnchor, constant: -18),
            emailValue.centerYAnchor.constraint(equalTo: emailLabel.centerYAnchor),

            statusLabel.topAnchor.constraint(equalTo: profileCard.bottomAnchor, constant: 12),
            statusLabel.leadingAnchor.constraint(equalTo: profileCard.leadingAnchor),
            statusLabel.trailingAnchor.constraint(equalTo: profileCard.trailingAnchor),
            actionButton.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            actionButton.topAnchor.constraint(greaterThanOrEqualTo: statusLabel.bottomAnchor, constant: 32),
            actionButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            deleteButton.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            deleteButton.topAnchor.constraint(equalTo: actionButton.bottomAnchor, constant: 8),
            deleteButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            deleteButton.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -20)
        ])
    }

    @objc private func confirmAccountDeletion() {
        let alert = UIAlertController(
            title: "Delete Account?",
            message: "You’ll continue to Almidy’s secure deletion request. Nothing is removed until you complete the required confirmation.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Continue", style: .destructive) { [weak self] _ in
            self?.onDeleteAccount()
        })
        present(alert, animated: true)
    }

    @objc private func saveProfile() {
        let name = nameField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        saveButton.isEnabled = false
        statusLabel.text = "Saving…"
        statusLabel.textColor = AlmidyDesignTokens.Color.settingsSecondary
        onSaveName(name) { [weak self] success in
            guard let self else { return }
            self.saveButton.isEnabled = true
            self.statusLabel.text = success ? "Profile saved" : "Could not save profile. Try again."
            self.statusLabel.textColor = success ? AlmidyDesignTokens.Color.success : AlmidyDesignTokens.Color.danger
            UIAccessibility.post(notification: .announcement, argument: self.statusLabel.text)
        }
    }

    @objc private func close() {
        dismiss(animated: true)
    }

    @objc private func action() {
        if isSignedIn {
            actionButton.isEnabled = false
            actionButton.setTitle("Signing Out…", for: .normal)
            onSignOut { [weak self] success in
                guard let self else { return }
                if success {
                    self.onSignedOut()
                } else {
                    self.actionButton.isEnabled = true
                    self.actionButton.setTitle("Sign Out", for: .normal)
                    self.statusLabel.text = "Could not sign out. Try again."
                    self.statusLabel.textColor = .systemRed
                    UIAccessibility.post(notification: .announcement, argument: self.statusLabel.text)
                }
            }
        } else {
            onSignIn()
        }
    }
}

private final class NativeMapSearchViewController: UIViewController, MKLocalSearchCompleterDelegate, UITableViewDataSource, UITableViewDelegate, UITextFieldDelegate {
    private let onSelect: (CLLocationCoordinate2D) -> Void
    private let completer = MKLocalSearchCompleter()
    private var completions: [MKLocalSearchCompletion] = []

    private let queryField = UITextField()
    private let suggestionTable = UITableView(frame: .zero, style: .plain)
    private let statusLabel = UILabel()

    init(onSelect: @escaping (CLLocationCoordinate2D) -> Void) {
        self.onSelect = onSelect
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = AlmidyDesignTokens.Color.surface
        completer.delegate = self
        completer.resultTypes = [.address, .pointOfInterest, .query]
        configureSearch()
    }

    private func configureSearch() {
        let cancelButton = UIButton(type: .system)
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.titleLabel?.font = AlmidyDesignTokens.Font.button(17)
        cancelButton.setTitleColor(AlmidyDesignTokens.Color.goldSoft, for: .normal)
        cancelButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)
        cancelButton.accessibilityLabel = "Close globe search"

        let title = UILabel()
        title.text = "Search the globe"
        title.font = AlmidyDesignTokens.Font.display(30)
        title.textColor = AlmidyDesignTokens.Color.textPrimary

        let subtitle = UILabel()
        subtitle.text = "Find a place and move the globe there."
        subtitle.font = .systemFont(ofSize: 17, weight: .regular)
        subtitle.textColor = AlmidyDesignTokens.Color.textSecondary

        queryField.placeholder = "Search a city or place"
        queryField.font = AlmidyDesignTokens.Font.body(18)
        queryField.textColor = AlmidyDesignTokens.Color.textPrimary
        queryField.backgroundColor = AlmidyDesignTokens.Color.darkInput
        queryField.layer.cornerRadius = AlmidyDesignTokens.Radius.control
        queryField.layer.borderWidth = 1
        queryField.layer.borderColor = AlmidyDesignTokens.Color.darkInputBorder.cgColor
        queryField.attributedPlaceholder = NSAttributedString(
            string: "Search a city or place",
            attributes: [.foregroundColor: AlmidyDesignTokens.Color.darkPlaceholder]
        )
        queryField.setPadding(16)
        queryField.clearButtonMode = .whileEditing
        queryField.returnKeyType = .search
        queryField.delegate = self
        queryField.addTarget(self, action: #selector(queryChanged), for: .editingChanged)
        queryField.accessibilityLabel = "Search for a city or place"

        statusLabel.font = AlmidyDesignTokens.Font.body(16)
        statusLabel.textColor = AlmidyDesignTokens.Color.searchEmptyState
        statusLabel.numberOfLines = 0
        statusLabel.textAlignment = .center
        statusLabel.text = "Start typing to search the globe."
        statusLabel.isAccessibilityElement = true

        suggestionTable.register(UITableViewCell.self, forCellReuseIdentifier: "map-search-suggestion")
        suggestionTable.dataSource = self
        suggestionTable.delegate = self
        suggestionTable.isHidden = true
        suggestionTable.rowHeight = 68
        suggestionTable.backgroundColor = AlmidyDesignTokens.Color.card
        suggestionTable.layer.cornerRadius = AlmidyDesignTokens.Radius.control
        suggestionTable.layer.borderWidth = 1
        suggestionTable.layer.borderColor = AlmidyDesignTokens.Color.line.cgColor

        [cancelButton, title, subtitle, queryField, statusLabel, suggestionTable].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview($0)
        }

        NSLayoutConstraint.activate([
            cancelButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 10),
            cancelButton.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            cancelButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            title.topAnchor.constraint(equalTo: cancelButton.bottomAnchor, constant: 22),
            title.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            title.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
            title.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24),
            title.widthAnchor.constraint(lessThanOrEqualToConstant: NativeAdaptiveLayout.formMaxWidth),
            NativeAdaptiveLayout.preferredWidth(title, equalTo: view.widthAnchor, constant: -48),
            subtitle.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 5),
            subtitle.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            subtitle.trailingAnchor.constraint(equalTo: title.trailingAnchor),
            queryField.topAnchor.constraint(equalTo: subtitle.bottomAnchor, constant: 24),
            queryField.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            queryField.trailingAnchor.constraint(equalTo: title.trailingAnchor),
            queryField.heightAnchor.constraint(equalToConstant: 54),
            statusLabel.topAnchor.constraint(equalTo: queryField.bottomAnchor, constant: 10),
            statusLabel.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            statusLabel.trailingAnchor.constraint(equalTo: title.trailingAnchor),
            suggestionTable.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 10),
            suggestionTable.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            suggestionTable.trailingAnchor.constraint(equalTo: title.trailingAnchor),
            suggestionTable.heightAnchor.constraint(equalToConstant: 272),
            suggestionTable.bottomAnchor.constraint(lessThanOrEqualTo: view.keyboardLayoutGuide.topAnchor, constant: -20)
        ])

        queryField.becomeFirstResponder()
    }

    @objc private func cancel() {
        dismiss(animated: true)
    }

    @objc private func queryChanged() {
        let query = queryField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        completions = []
        suggestionTable.reloadData()
        suggestionTable.isHidden = query.count < 2
        statusLabel.text = query.count < 2 ? "Start typing to search the globe." : "Searching…"
        if query.count >= 2 {
            completer.queryFragment = query
        }
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        completions = Array(completer.results.prefix(4))
        suggestionTable.isHidden = completions.isEmpty
        statusLabel.text = completions.isEmpty ? "No places found yet." : ""
        suggestionTable.reloadData()
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        completions = []
        suggestionTable.isHidden = true
        statusLabel.text = "Could not load search suggestions."
        UIAccessibility.post(notification: .announcement, argument: statusLabel.text)
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        completions.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "map-search-suggestion", for: indexPath)
        let completion = completions[indexPath.row]
        var content = cell.defaultContentConfiguration()
        content.text = completion.title
        content.secondaryText = completion.subtitle
        content.textProperties.font = AlmidyDesignTokens.Font.body(16)
        content.secondaryTextProperties.font = AlmidyDesignTokens.Font.body(13)
        content.textProperties.color = AlmidyDesignTokens.Color.textPrimary
        content.secondaryTextProperties.color = AlmidyDesignTokens.Color.textSecondary
        content.textProperties.numberOfLines = 1
        content.secondaryTextProperties.numberOfLines = 1
        cell.contentConfiguration = content
        cell.backgroundColor = AlmidyDesignTokens.Color.card
        cell.tintColor = AlmidyDesignTokens.Color.gold
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let completion = completions[indexPath.row]
        queryField.resignFirstResponder()
        suggestionTable.isHidden = true
        statusLabel.text = "Finding \(completion.title)…"

        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = [completion.title, completion.subtitle]
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        MKLocalSearch(request: request).start { [weak self] response, error in
            DispatchQueue.main.async {
                guard let self else { return }
                guard let coordinate = response?.mapItems.first?.placemark.coordinate, error == nil else {
                    self.statusLabel.text = "Could not resolve that place."
                    UIAccessibility.post(notification: .announcement, argument: self.statusLabel.text)
                    return
                }
                self.onSelect(coordinate)
                self.dismiss(animated: true)
            }
        }
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        guard !completions.isEmpty else { return false }
        tableView(suggestionTable, didSelectRowAt: IndexPath(row: 0, section: 0))
        return true
    }
}

private final class NativeCaptureIdeasViewController: UIViewController, PHPickerViewControllerDelegate {
    private let tripStore: NativeTripStore?
    private let onImportFinished: () -> Void
    private let noteView = UITextView()
    private let linkField = UITextField()
    private let sourceLabel = UILabel()
    private var imageData: Data?

    init(tripStore: NativeTripStore?, onImportFinished: @escaping () -> Void) {
        self.tripStore = tripStore
        self.onImportFinished = onImportFinished
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = AlmidyDesignTokens.Color.settingsBackground
        configureView()
    }

    private func configureView() {
        let cancel = UIButton(type: .system)
        cancel.setTitle("Cancel", for: .normal)
        cancel.setTitleColor(AlmidyDesignTokens.Color.settingsGold, for: .normal)
        cancel.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        cancel.addTarget(self, action: #selector(close), for: .touchUpInside)

        let title = UILabel()
        title.text = "Capture travel ideas"
        title.textColor = AlmidyDesignTokens.Color.settingsText
        title.font = AlmidyDesignTokens.Font.title(30)

        let subtitle = UILabel()
        subtitle.text = "Forward a reservation, paste a note, or save an idea without leaving your globe."
        subtitle.textColor = AlmidyDesignTokens.Color.settingsSecondary
        subtitle.font = .systemFont(ofSize: 17, weight: .regular)
        subtitle.numberOfLines = 0

        let sourceStack = UIStackView(arrangedSubviews: [
            sourceButton(title: "Paste link", systemName: "link", action: #selector(pasteLink)),
            sourceButton(title: "Upload screenshot", systemName: "square.and.arrow.up", action: #selector(uploadScreenshot)),
            sourceButton(title: "Paste note", systemName: "note.text", action: #selector(pasteNote))
        ])
        sourceStack.axis = .vertical
        sourceStack.spacing = 10

        sourceLabel.text = "Choose a capture option to start."
        sourceLabel.textColor = AlmidyDesignTokens.Color.settingsSecondary
        sourceLabel.font = .systemFont(ofSize: 15, weight: .medium)

        noteView.backgroundColor = AlmidyDesignTokens.Color.settingsCard
        noteView.textColor = AlmidyDesignTokens.Color.settingsText
        noteView.font = .systemFont(ofSize: 17, weight: .regular)
        noteView.layer.cornerRadius = 16
        noteView.layer.borderWidth = 1
        noteView.layer.borderColor = AlmidyDesignTokens.Color.settingsLine.cgColor
        noteView.text = "Paste a note, caption, or visible text"
        noteView.textColor = AlmidyDesignTokens.Color.settingsSecondary
        noteView.delegate = self
        noteView.isHidden = true

        linkField.placeholder = "Paste a travel link"
        linkField.textColor = AlmidyDesignTokens.Color.settingsText
        linkField.font = .systemFont(ofSize: 17, weight: .regular)
        linkField.borderStyle = .roundedRect
        linkField.isHidden = true

        let review = UIButton(type: .system)
        review.setTitle("Review idea", for: .normal)
        review.setTitleColor(AlmidyDesignTokens.Color.settingsText, for: .normal)
        review.titleLabel?.font = AlmidyDesignTokens.Font.button(18)
        review.backgroundColor = AlmidyDesignTokens.Color.gold
        review.layer.cornerRadius = AlmidyDesignTokens.Radius.capsule
        review.addTarget(self, action: #selector(reviewIdea), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [cancel, title, subtitle, sourceStack, sourceLabel, linkField, noteView, review])
        stack.axis = .vertical
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        cancel.setContentHuggingPriority(.required, for: .vertical)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 14),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20),
            noteView.heightAnchor.constraint(equalToConstant: 150),
            review.heightAnchor.constraint(equalToConstant: 54)
        ])
    }

    private func sourceButton(title: String, systemName: String, action: Selector) -> UIButton {
        let button = UIButton(type: .system)
        button.contentHorizontalAlignment = .leading
        button.setTitle("  \(title)", for: .normal)
        button.setImage(UIImage(systemName: systemName), for: .normal)
        button.setTitleColor(AlmidyDesignTokens.Color.settingsText, for: .normal)
        button.tintColor = AlmidyDesignTokens.Color.settingsIcon
        button.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        button.backgroundColor = AlmidyDesignTokens.Color.settingsCard
        button.layer.cornerRadius = 16
        var configuration = UIButton.Configuration.plain()
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 15, leading: 18, bottom: 15, trailing: 18)
        configuration.baseForegroundColor = AlmidyDesignTokens.Color.settingsText
        configuration.imagePadding = 6
        button.configuration = configuration
        button.addTarget(self, action: action, for: .touchUpInside)
        return button
    }

    @objc private func pasteLink() {
        if let value = UIPasteboard.general.string, !value.isEmpty {
            linkField.text = value
            linkField.isHidden = false
            linkField.becomeFirstResponder()
            sourceLabel.text = "Link pasted. Review it when ready."
        } else {
            sourceLabel.text = "Copy a reservation link, then tap Paste link again."
        }
    }

    @objc private func uploadScreenshot() {
        var configuration = PHPickerConfiguration(photoLibrary: .shared())
        configuration.filter = .images
        configuration.selectionLimit = 1
        present(PHPickerViewController(configuration: configuration), animated: true)
    }

    @objc private func pasteNote() {
        noteView.isHidden = false
        noteView.becomeFirstResponder()
        sourceLabel.text = "Add the reservation details below."
    }

    @objc private func reviewIdea() {
        noteView.resignFirstResponder()
        linkField.resignFirstResponder()
        let rawText = noteView.textColor == .white ? noteView.text : nil
        let sourceURL = linkField.text
        guard imageData != nil || !(rawText?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) || !(sourceURL?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) else {
            sourceLabel.text = "Paste a link, note, or screenshot first."
            return
        }
        guard let tripStore else {
            sourceLabel.text = "Import service is unavailable."
            return
        }
        sourceLabel.text = "Reviewing idea…"
        tripStore.submitSocialImport(sourceURL: sourceURL, rawText: rawText, imageData: imageData) { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let importResult):
                self.sourceLabel.text = importResult.extractedPlaceCount > 0
                    ? "Review ready: \(importResult.extractedPlaceCount) place(s) found."
                    : "Import \(importResult.status). Add more detail if no places appeared."
                self.imageData = nil
                self.onImportFinished()
            case .failure(let error):
                self.sourceLabel.text = error.localizedDescription
            }
        }
    }

    @objc private func close() {
        dismiss(animated: true)
    }
}

extension NativeCaptureIdeasViewController: UITextViewDelegate {
    func textViewDidBeginEditing(_ textView: UITextView) {
        if textView.textColor == AlmidyDesignTokens.Color.overlayPlaceholderText {
            textView.text = nil
            textView.textColor = AlmidyDesignTokens.Color.tripCardTextPrimary
        }
    }
}

extension NativeCaptureIdeasViewController {
    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        dismiss(animated: true)
        guard let provider = results.first?.itemProvider,
              provider.canLoadObject(ofClass: UIImage.self) else {
            sourceLabel.text = "Choose an image to upload."
            return
        }
        provider.loadDataRepresentation(forTypeIdentifier: UTType.image.identifier) { [weak self] data, _ in
            DispatchQueue.main.async {
                guard let self else { return }
                self.imageData = data
                self.sourceLabel.text = data == nil ? "Could not read that screenshot." : "Screenshot ready to review."
            }
        }
    }
}

private enum NativeLaunchSettingsIcon {
    static let image: UIImage = {
        let size = CGSize(width: 24, height: 24)
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { _ in
            let gear = UIBezierPath()
            let pointCount = 32
            for index in 0..<pointCount {
                let angle = CGFloat(index) * (.pi * 2 / CGFloat(pointCount)) - (.pi / 2)
                let radius: CGFloat = index.isMultiple(of: 2) ? 10.5 : 8.4
                let point = CGPoint(
                    x: center.x + cos(angle) * radius,
                    y: center.y + sin(angle) * radius
                )
                index == 0 ? gear.move(to: point) : gear.addLine(to: point)
            }
            gear.close()
            gear.lineJoinStyle = .round
            gear.lineWidth = 1.8
            UIColor.black.setStroke()
            gear.stroke()

            let innerRing = UIBezierPath(
                arcCenter: center,
                radius: 6.7,
                startAngle: 0,
                endAngle: .pi * 2,
                clockwise: true
            )
            innerRing.lineWidth = 1.5
            innerRing.stroke()

            let spokes = UIBezierPath()
            for index in 0..<8 {
                let angle = CGFloat(index) * (.pi / 4) - (.pi / 2)
                spokes.move(to: CGPoint(
                    x: center.x + cos(angle) * 3.6,
                    y: center.y + sin(angle) * 3.6
                ))
                spokes.addLine(to: CGPoint(
                    x: center.x + cos(angle) * 6.1,
                    y: center.y + sin(angle) * 6.1
                ))
            }
            spokes.lineCapStyle = .round
            spokes.lineWidth = 1.2
            spokes.stroke()

            let hub = UIBezierPath(arcCenter: center, radius: 2.4, startAngle: 0, endAngle: .pi * 2, clockwise: true)
            hub.lineWidth = 1.5
            hub.stroke()
        }.withRenderingMode(.alwaysTemplate)
    }()
}

private final class NativeGeographicLabelAnnotation: NSObject, MKAnnotation {
    enum Kind {
        case continent
        case ocean
    }

    let coordinate: CLLocationCoordinate2D
    let title: String?
    let kind: Kind

    init(_ title: String, latitude: Double, longitude: Double, kind: Kind) {
        self.title = title
        self.coordinate = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        self.kind = kind
    }

    static let majorLabels: [NativeGeographicLabelAnnotation] = [
        .init("NORTH\nAMERICA", latitude: 45, longitude: -94, kind: .continent),
        .init("SOUTH AMERICA", latitude: -17, longitude: -60, kind: .continent),
        .init("EUROPE", latitude: 51, longitude: 18, kind: .continent),
        .init("AFRICA", latitude: 6, longitude: 20, kind: .continent),
        .init("ASIA", latitude: 47, longitude: 87, kind: .continent),
        .init("AUSTRALIA", latitude: -25, longitude: 134, kind: .continent),
        .init("ARCTIC\nOCEAN", latitude: 74, longitude: -85, kind: .ocean),
        .init("NORTH ATLANTIC OCEAN", latitude: 29, longitude: -58, kind: .ocean),
        .init("NORTH PACIFIC OCEAN", latitude: 26, longitude: -155, kind: .ocean),
        .init("INDIAN OCEAN", latitude: -17, longitude: 78, kind: .ocean)
    ]
}

private final class NativeGeographicLabelAnnotationView: MKAnnotationView {
    private let label = UILabel()

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        frame = CGRect(x: 0, y: 0, width: 190, height: 54)
        collisionMode = .rectangle
        displayPriority = .defaultHigh
        canShowCallout = false

        label.frame = bounds
        label.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        label.textColor = .white
        label.textAlignment = .center
        label.numberOfLines = 2
        label.adjustsFontSizeToFitWidth = true
        label.minimumScaleFactor = 0.72
        label.layer.shadowColor = UIColor.black.cgColor
        label.layer.shadowOpacity = 1
        label.layer.shadowRadius = 2
        label.layer.shadowOffset = .zero
        addSubview(label)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func configure(with annotation: NativeGeographicLabelAnnotation) {
        let font: UIFont
        let fillColor: UIColor
        let strokeColor: UIColor
        let strokeWidth: CGFloat
        let letterSpacing: CGFloat

        switch annotation.kind {
        case .continent:
            font = .systemFont(ofSize: 18, weight: .bold)
            fillColor = .white
            strokeColor = UIColor.black.withAlphaComponent(0.88)
            strokeWidth = -4
            letterSpacing = 2.4
        case .ocean:
            font = .italicSystemFont(ofSize: 15)
            fillColor = UIColor(red: 0.67, green: 0.82, blue: 0.90, alpha: 1)
            strokeColor = UIColor(red: 0.06, green: 0.15, blue: 0.19, alpha: 0.9)
            strokeWidth = -4
            letterSpacing = 0.5
        }

        label.attributedText = NSAttributedString(
            string: annotation.title ?? "",
            attributes: [
                .font: font,
                .foregroundColor: fillColor,
                .strokeColor: strokeColor,
                .strokeWidth: strokeWidth,
                .kern: letterSpacing
            ]
        )
        accessibilityLabel = annotation.title?.replacingOccurrences(of: "\n", with: " ")
    }
}

private final class NativeTripAnnotation: NSObject, MKAnnotation {
    let coordinate: CLLocationCoordinate2D
    let title: String?
    let trip: NativeMapTrip
    let countryPresentation: NativeTripCountryPresentation

    init(trip: NativeMapTrip, coordinate: CLLocationCoordinate2D) {
        self.trip = trip
        self.coordinate = coordinate
        self.countryPresentation = NativeTripCountryPresentation(trip: trip)
        self.title = countryPresentation.name
    }
}

private struct NativeTripCountryPresentation {
    let flag: String
    let name: String
    let regionCode: String?

    init(trip: NativeMapTrip, locale: Locale = .current) {
        let destinationParts = (trip.destination ?? "")
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .reversed()

        for candidate in destinationParts {
            if let regionCode = Self.regionCode(for: candidate, locale: locale) {
                self.flag = Self.flagEmoji(for: regionCode)
                self.name = locale.localizedString(forRegionCode: regionCode) ?? candidate
                self.regionCode = regionCode
                return
            }
        }

        self.flag = "🌐"
        self.name = trip.displayName
        self.regionCode = nil
    }

    private static func regionCode(for countryName: String, locale: Locale) -> String? {
        let normalized = countryName.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: locale)
        let aliases = [
            "usa": "US",
            "u.s.a.": "US",
            "united states of america": "US",
            "uk": "GB",
            "u.k.": "GB"
        ]
        if let alias = aliases[normalized] {
            return alias
        }

        return Locale.isoRegionCodes.first { regionCode in
            guard let localizedName = locale.localizedString(forRegionCode: regionCode) else { return false }
            return localizedName.folding(
                options: [.caseInsensitive, .diacriticInsensitive],
                locale: locale
            ) == normalized
        }
    }

    private static func flagEmoji(for regionCode: String) -> String {
        regionCode.uppercased().unicodeScalars.reduce(into: "") { result, scalar in
            guard let regionalIndicator = UnicodeScalar(127397 + scalar.value) else { return }
            result.unicodeScalars.append(regionalIndicator)
        }
    }
}

private final class NativeUserLocationAnnotationView: MKAnnotationView {
    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)

        frame = CGRect(x: 0, y: 0, width: 22, height: 22)
        backgroundColor = AlmidyDesignTokens.Color.gold
        layer.cornerRadius = 11
        layer.borderColor = UIColor.white.cgColor
        layer.borderWidth = 3
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.24
        layer.shadowRadius = 5
        layer.shadowOffset = CGSize(width: 0, height: 2)
        collisionMode = .circle
        displayPriority = .required
        canShowCallout = false
        accessibilityLabel = "Your location"
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

private final class NativeTripFlagAnnotationView: MKAnnotationView {
    private let flagLabel = UILabel()
    private let countryLabel = UILabel()

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)

        frame = CGRect(x: 0, y: 0, width: 160, height: 78)
        centerOffset = CGPoint(x: 0, y: -55)
        collisionMode = .none
        displayPriority = .required
        if #available(iOS 14.0, *) {
            zPriority = .max
        }

        flagLabel.backgroundColor = .white
        flagLabel.font = .systemFont(ofSize: 30)
        flagLabel.textAlignment = .center
        flagLabel.layer.cornerRadius = 24
        flagLabel.layer.borderColor = UIColor.white.cgColor
        flagLabel.layer.borderWidth = 3
        flagLabel.layer.shadowColor = UIColor.black.cgColor
        flagLabel.layer.shadowOpacity = 0.24
        flagLabel.layer.shadowRadius = 5
        flagLabel.layer.shadowOffset = CGSize(width: 0, height: 2)
        flagLabel.clipsToBounds = false
        flagLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(flagLabel)

        countryLabel.textColor = .white
        countryLabel.font = .systemFont(ofSize: 14, weight: .bold)
        countryLabel.textAlignment = .center
        countryLabel.adjustsFontSizeToFitWidth = true
        countryLabel.minimumScaleFactor = 0.72
        countryLabel.layer.shadowColor = UIColor.black.cgColor
        countryLabel.layer.shadowOpacity = 1
        countryLabel.layer.shadowRadius = 2
        countryLabel.layer.shadowOffset = .zero
        countryLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(countryLabel)

        NSLayoutConstraint.activate([
            flagLabel.topAnchor.constraint(equalTo: topAnchor),
            flagLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            flagLabel.widthAnchor.constraint(equalToConstant: 48),
            flagLabel.heightAnchor.constraint(equalToConstant: 48),
            countryLabel.topAnchor.constraint(equalTo: flagLabel.bottomAnchor, constant: 2),
            countryLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            countryLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            countryLabel.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func configure(with presentation: NativeTripCountryPresentation) {
        flagLabel.text = presentation.flag
        countryLabel.text = presentation.name
        accessibilityLabel = "Trip in \(presentation.name)"
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

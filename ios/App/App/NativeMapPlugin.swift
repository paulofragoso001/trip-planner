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
import ARKit
import SceneKit

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
    let imageURL: URL?

    init(
        name: String,
        destination: String,
        coordinate: CLLocationCoordinate2D,
        startDate: String? = nil,
        endDate: String? = nil,
        imageURL: URL? = nil
    ) {
        self.name = name
        self.destination = destination
        self.coordinate = coordinate
        self.startDate = startDate
        self.endDate = endDate
        self.imageURL = imageURL
    }
}

enum NativeTripCardMenuAction: CaseIterable, Equatable {
    case shareTrip
    case editName
    case changeDates
    case changeBackground
    case duplicateTrip
    case mergeTrip
    case removeTrip

    var title: String {
        switch self {
        case .shareTrip: return "Share Trip"
        case .editName: return "Edit Name"
        case .changeDates: return "Change Dates"
        case .changeBackground: return "Change Background"
        case .duplicateTrip: return "Duplicate Trip"
        case .mergeTrip: return "Merge into another Trip"
        case .removeTrip: return "Remove Trip"
        }
    }

    var systemImage: String {
        switch self {
        case .shareTrip: return "square.and.arrow.up"
        case .editName: return "character.cursor.ibeam"
        case .changeDates: return "calendar"
        case .changeBackground: return "photo"
        case .duplicateTrip: return "plus.square.on.square"
        case .mergeTrip: return "arrow.triangle.merge"
        case .removeTrip: return "trash"
        }
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
    private let baseURL: URL
    private let session: URLSession
    private let apiClient: NativeAuthenticatedHTTPClient

    init(
        webView: WKWebView?,
        baseURL: URL = NativeServiceConfiguration.appBaseURL,
        session: URLSession = .shared,
        coordinator: NativeSessionCoordinator = .shared
    ) {
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
            "destination_provider_metadata": draft.imageURL.map {
                ["image_url": $0.absoluteString, "image_source": "native_destination_resolver"]
            } ?? [:],
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
            "destination_provider_metadata": draft.imageURL.map {
                ["image_url": $0.absoluteString, "image_source": "native_destination_resolver"]
            } ?? [:],
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

    func enableTripSharing(id: String, completion: @escaping (Result<Void, Error>) -> Void) {
        send(path: "/api/trips/\(id)/share", method: "POST", body: Data("{}".utf8)) { result in
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
              (try? JSONDecoder().decode(NativeAuthSessionContract.self, from: data)) != nil else {
            authLogger.error("Session sync rejected: malformed_contract")
            call.reject("Malformed native authentication session contract.", "invalid_native_auth_session")
            return
        }

        authLogger.error("Session sync rejected: native_session_is_authoritative")
        call.reject("Web authentication cannot replace the native session.", "native_auth_authoritative")
    }

    @objc func clearNativeAuthSession(_ call: CAPPluginCall) {
        authLogger.error("Session clear rejected: native_session_is_authoritative")
        call.reject("Web content cannot clear the native session.", "native_auth_authoritative")
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
            maxCenterCoordinateDistance: 90_000_000
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
            fromDistance: 90_000_000,
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
    enum ScheduleState: Int, Equatable {
        case active
        case future
        case past
        case undated
    }

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

    func usingImageURL(_ url: URL?) -> NativeMapTrip {
        guard imageUrl == nil, let url else { return self }
        return NativeMapTrip(
            id: id,
            name: name ?? destination ?? "Trip",
            destination: destination ?? name ?? "Trip",
            latitude: latitude ?? 0,
            longitude: longitude ?? 0,
            dateRange: dateRange,
            startDate: startDate,
            endDate: endDate,
            href: href,
            imageUrl: url.absoluteString,
            status: status
        )
    }

    private static func dateRange(start: String?, end: String?) -> String? {
        switch (start, end) {
        case let (start?, end?): return "\(start) – \(end)"
        case let (start?, nil): return start
        case let (nil, end?): return end
        case (nil, nil): return nil
        }
    }

    private static func dateValue(_ value: String?) -> Date? {
        guard let value = clean(value) else { return nil }

        let parser = DateFormatter()
        parser.calendar = Calendar(identifier: .gregorian)
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = TimeZone(secondsFromGMT: 0)
        parser.dateFormat = "yyyy-MM-dd"
        return parser.date(from: value)
    }

    private static func displayDate(_ value: String?) -> String? {
        guard let date = dateValue(value) else { return nil }

        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    var displayName: String {
        clean(name) ?? clean(destination) ?? "Untitled trip"
    }

    var displayDateRange: String {
        switch (Self.displayDate(startDate), Self.displayDate(endDate)) {
        case let (start?, end?): return "\(start) → \(end)"
        case let (start?, nil): return start
        case let (nil, end?): return end
        case (nil, nil): return clean(dateRange) ?? "Dates not set"
        }
    }

    var displayStatus: String {
        relativeStatus(relativeTo: Date())
    }

    func scheduleState(relativeTo referenceDate: Date) -> ScheduleState {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        let today = calendar.startOfDay(for: referenceDate)
        guard let start = Self.dateValue(startDate) else { return .undated }
        let end = Self.dateValue(endDate) ?? start

        if today < start { return .future }
        if today <= end { return .active }
        return .past
    }

    static func scheduled(_ trips: [NativeMapTrip], relativeTo referenceDate: Date = Date()) -> [NativeMapTrip] {
        trips.enumerated().sorted { left, right in
            let leftState = left.element.scheduleState(relativeTo: referenceDate)
            let rightState = right.element.scheduleState(relativeTo: referenceDate)
            if leftState.rawValue != rightState.rawValue {
                return leftState.rawValue < rightState.rawValue
            }

            switch (Self.dateValue(left.element.startDate), Self.dateValue(right.element.startDate)) {
            case let (leftDate?, rightDate?) where leftDate != rightDate:
                return leftDate < rightDate
            default:
                return left.offset < right.offset
            }
        }.map(\.element)
    }

    func relativeStatus(relativeTo referenceDate: Date) -> String {
        var calendar = Calendar(identifier: .gregorian)
        if let utc = TimeZone(secondsFromGMT: 0) {
            calendar.timeZone = utc
        }
        let today = calendar.startOfDay(for: referenceDate)

        if let start = Self.dateValue(startDate) {
            let daysUntilStart = calendar.dateComponents([.day], from: today, to: start).day ?? 0
            if daysUntilStart > 0 {
                return daysUntilStart == 1 ? "Starts tomorrow" : "Starts in \(daysUntilStart) days"
            }
            if daysUntilStart == 0, Self.dateValue(endDate) == nil {
                return "Starts today"
            }
        }

        if let end = Self.dateValue(endDate) {
            let daysUntilEnd = calendar.dateComponents([.day], from: today, to: end).day ?? 0
            switch daysUntilEnd {
            case 1: return "Ends tomorrow"
            case 0: return "Ends today"
            case 2...: return "Ends in \(daysUntilEnd) days"
            case -1: return "Ended yesterday"
            default: return "Ended \(-daysUntilEnd) days ago"
            }
        }

        return clean(status) ?? "Planning"
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

enum NativeTripCardLayout {
    static let activeHeight: CGFloat = 354
    static let futureHeight: CGFloat = 224
    static let titleFontSize: CGFloat = 32
    static let dateFontSize: CGFloat = 17
    static let statusFontSize: CGFloat = 17

    static func height(for state: NativeMapTrip.ScheduleState) -> CGFloat {
        state == .active ? activeHeight : futureHeight
    }
}

final class NativeMapPreferencesViewController: UIViewController {
    static let titleFontSize: CGFloat = 34
    static let closeSize: CGFloat = 48
    static let styleCardHeight: CGFloat = 170
    static let selectedBorderWidth: CGFloat = 3

    static var sheetConfiguration: AlmidySheetConfiguration {
        let selected: UISheetPresentationController.Detent.Identifier
        let detents: [UISheetPresentationController.Detent]
        if #available(iOS 16.0, *) {
            let reference = UISheetPresentationController.Detent.custom(
                identifier: .init("map-preferences-reference")
            ) { context in context.maximumDetentValue * 0.494 }
            selected = reference.identifier
            detents = [reference, .large()]
        } else {
            selected = .medium
            detents = [.medium(), .large()]
        }
        return AlmidySheetConfiguration.prominent.overriding(
            detents: detents,
            selectedDetentIdentifier: selected,
            cornerRadius: AlmidyDesignTokens.TripOverview.sheetCornerRadius,
            grabberVisible: false,
            largestUndimmedDetentIdentifier: .large
        )
    }

    private let onChange: (Bool, Bool, Bool) -> Void
    private var usesHybridMap: Bool
    private let transportationSwitch = UISwitch()
    private let flightSwitch = UISwitch()
    private let mapButton = UIButton(type: .system)
    private let hybridButton = UIButton(type: .system)
    private let mapPreview = UIImageView()
    private let hybridPreview = UIImageView()
    private let previewCoordinate: CLLocationCoordinate2D

    init(
        usesHybridMap: Bool,
        showsTransportationRoutes: Bool,
        showsFlightRoutes: Bool,
        previewCoordinate: CLLocationCoordinate2D,
        onChange: @escaping (Bool, Bool, Bool) -> Void
    ) {
        self.usesHybridMap = usesHybridMap
        self.previewCoordinate = previewCoordinate
        self.onChange = onChange
        transportationSwitch.isOn = showsTransportationRoutes
        flightSwitch.isOn = showsFlightRoutes
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.isOpaque = false
        view.backgroundColor = .clear

        let sheetMaterial = UIVisualEffectView(effect: UIBlurEffect(style: .systemUltraThinMaterialLight))
        sheetMaterial.contentView.backgroundColor = UIColor.systemGray6.withAlphaComponent(0.34)
        sheetMaterial.isUserInteractionEnabled = false
        sheetMaterial.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(sheetMaterial)
        NSLayoutConstraint.activate([
            sheetMaterial.topAnchor.constraint(equalTo: view.topAnchor),
            sheetMaterial.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            sheetMaterial.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            sheetMaterial.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        let titleLabel = UILabel()
        titleLabel.text = "Map Preferences"
        titleLabel.font = .systemFont(ofSize: Self.titleFontSize, weight: .regular)
        titleLabel.adjustsFontForContentSizeCategory = true

        let closeButton = AlmidyIconButton(
            symbol: "xmark",
            accessibilityLabel: "Close map preferences",
            overrides: .init(
                diameter: Self.closeSize,
                foregroundColor: .label,
                backgroundColor: .secondarySystemGroupedBackground
            )
        )
        closeButton.layer.borderWidth = 0
        closeButton.addTarget(self, action: #selector(closePreferences), for: .touchUpInside)

        let header = UIStackView(arrangedSubviews: [titleLabel, closeButton])
        header.axis = .horizontal
        header.alignment = .center
        header.spacing = 12

        configureStyleButton(mapButton, preview: mapPreview, title: "Map", tag: 0)
        configureStyleButton(hybridButton, preview: hybridPreview, title: "Hybrid", tag: 1)
        let styleRow = UIStackView(arrangedSubviews: [mapButton, hybridButton])
        styleRow.axis = .horizontal
        styleRow.distribution = .fillEqually
        styleRow.spacing = 12

        transportationSwitch.onTintColor = AlmidyDesignTokens.Color.tripOverviewAccent
        flightSwitch.onTintColor = AlmidyDesignTokens.Color.tripOverviewAccent
        transportationSwitch.addTarget(self, action: #selector(preferenceChanged), for: .valueChanged)
        flightSwitch.addTarget(self, action: #selector(preferenceChanged), for: .valueChanged)

        let routeCard = UIStackView(arrangedSubviews: [
            preferenceRow(title: "Show Transportation Routes", toggle: transportationSwitch),
            AlmidyDivider(color: .separator),
            preferenceRow(title: "Show Flight Routes", toggle: flightSwitch)
        ])
        routeCard.axis = .vertical
        routeCard.backgroundColor = AlmidyDesignTokens.Color.settingsCard
        routeCard.layer.cornerRadius = 20
        routeCard.clipsToBounds = true

        let content = UIStackView(arrangedSubviews: [header, styleRow, routeCard])
        content.axis = .vertical
        content.spacing = 19
        content.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(content)
        NSLayoutConstraint.activate([
            content.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            content.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            content.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24)
        ])
        updateStyleSelection()
        loadMapPreview(into: mapPreview, mapType: .standard)
        loadMapPreview(into: hybridPreview, mapType: .hybrid)
    }

    private func configureStyleButton(_ button: UIButton, preview: UIImageView, title: String, tag: Int) {
        button.backgroundColor = AlmidyDesignTokens.Color.settingsCard
        button.clipsToBounds = true
        button.tag = tag
        button.accessibilityLabel = title
        button.accessibilityHint = "Changes the active globe appearance"
        button.addTarget(self, action: #selector(selectMapStyle(_:)), for: .touchUpInside)
        button.heightAnchor.constraint(equalToConstant: Self.styleCardHeight).isActive = true

        preview.contentMode = .scaleAspectFill
        preview.clipsToBounds = true
        preview.isUserInteractionEnabled = false
        preview.translatesAutoresizingMaskIntoConstraints = false
        button.addSubview(preview)

        let label = UILabel()
        label.text = title
        label.font = .systemFont(ofSize: 20, weight: .regular)
        label.textColor = .label
        label.textAlignment = .center
        label.backgroundColor = AlmidyDesignTokens.Color.settingsCard
        label.isUserInteractionEnabled = false
        label.translatesAutoresizingMaskIntoConstraints = false
        button.addSubview(label)

        NSLayoutConstraint.activate([
            preview.topAnchor.constraint(equalTo: button.topAnchor),
            preview.leadingAnchor.constraint(equalTo: button.leadingAnchor),
            preview.trailingAnchor.constraint(equalTo: button.trailingAnchor),
            preview.bottomAnchor.constraint(equalTo: label.topAnchor),
            label.leadingAnchor.constraint(equalTo: button.leadingAnchor),
            label.trailingAnchor.constraint(equalTo: button.trailingAnchor),
            label.bottomAnchor.constraint(equalTo: button.bottomAnchor),
            label.heightAnchor.constraint(equalToConstant: 50)
        ])
    }

    private func loadMapPreview(into imageView: UIImageView, mapType: MKMapType) {
        let options = MKMapSnapshotter.Options()
        options.mapType = mapType
        options.region = MKCoordinateRegion(
            center: previewCoordinate,
            latitudinalMeters: 8_000,
            longitudinalMeters: 8_000
        )
        options.size = CGSize(width: 320, height: 120)
        options.scale = UIScreen.main.scale
        options.pointOfInterestFilter = .includingAll
        MKMapSnapshotter(options: options).start(with: .main) { snapshot, _ in
            imageView.image = snapshot?.image
        }
    }

    private func preferenceRow(title: String, toggle: UISwitch) -> UIView {
        let label = UILabel()
        label.text = title
        label.font = .preferredFont(forTextStyle: .body)
        label.adjustsFontForContentSizeCategory = true
        let row = UIStackView(arrangedSubviews: [label, toggle])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 12
        row.isLayoutMarginsRelativeArrangement = true
        row.layoutMargins = UIEdgeInsets(top: 18, left: 18, bottom: 18, right: 18)
        return row
    }

    @objc private func selectMapStyle(_ sender: UIButton) {
        usesHybridMap = sender.tag == 1
        updateStyleSelection()
        notifyChange()
    }

    @objc private func preferenceChanged() { notifyChange() }

    private func notifyChange() {
        onChange(usesHybridMap, transportationSwitch.isOn, flightSwitch.isOn)
    }

    private func updateStyleSelection() {
        updateStyleButton(mapButton, selected: !usesHybridMap)
        updateStyleButton(hybridButton, selected: usesHybridMap)
    }

    private func updateStyleButton(_ button: UIButton, selected: Bool) {
        button.layer.cornerRadius = 20
        button.layer.masksToBounds = true
        button.layer.borderWidth = selected ? Self.selectedBorderWidth : 0
        button.layer.borderColor = AlmidyDesignTokens.Color.tripOverviewAccent.cgColor
        button.accessibilityTraits = selected ? [.button, .selected] : .button
    }

    @objc private func closePreferences() { dismiss(animated: true) }
}

struct NativeSavedPlaceSegment: Decodable, Equatable {
    let id: String
    let startTime: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case startTime = "start_time"
    }
}

struct NativeSavedPlaceDetailDraft: Encodable, Equatable {
    struct ReservationDetails: Encodable, Equatable {
        let phone: String?
        let website: String?
        let costAmount: Decimal?
        let costCurrency: String?
        let links: [String]
    }

    let title: String
    let location: String?
    let startTime: String?
    let endTime: String?
    let bookingUrl: String?
    let confirmationCode: String?
    let notes: String?
    let reservation: ReservationDetails
}

private final class NativePlaceItineraryAPIClient {
    private struct Response: Decodable {
        struct DataPayload: Decodable { let segment: NativeSavedPlaceSegment }
        let data: DataPayload
    }
    private struct Payload: Encodable {
        let tripId: String
        let title: String
        let startTime: String
        let kind: String
        let location: String?
        let locationStatus: String
        let lat: Double
        let lng: Double
        let bookingUrl: String?
        let notes: String?
        let provider: String
        let providerPlaceId: String?
    }

    private let client: NativeAuthenticatedHTTPClient

    init(webView: AnyObject?) {
        client = NativeAuthenticatedHTTPClient(
            webView: webView,
            baseURL: NativeServiceConfiguration.appBaseURL,
            session: .shared
        )
    }

    func save(
        mapItem: MKMapItem,
        category: NativeActivityCategory,
        tripID: String,
        startAt: Date,
        completion: @escaping (Result<NativeSavedPlaceSegment, Error>) -> Void
    ) {
        let coordinate = mapItem.placemark.coordinate
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let categoryName = category.name.lowercased()
        let segmentType: String
        if categoryName.contains("hotel") || categoryName.contains("stay") {
            segmentType = "hotel"
        } else if categoryName.contains("restaurant") || categoryName.contains("food") || categoryName.contains("cafe") {
            segmentType = "restaurant"
        } else {
            segmentType = "activity"
        }
        let cleanedName = mapItem.name?.trimmingCharacters(in: .whitespacesAndNewlines)
        let address = mapItem.placemark.title?.trimmingCharacters(in: .whitespacesAndNewlines)
        let payload = Payload(
            tripId: tripID,
            title: cleanedName.flatMap { $0.isEmpty ? nil : $0 } ?? "Saved Place",
            startTime: formatter.string(from: startAt),
            kind: segmentType,
            location: address.flatMap { $0.isEmpty ? nil : $0 },
            locationStatus: "resolved",
            lat: coordinate.latitude,
            lng: coordinate.longitude,
            bookingUrl: mapItem.url?.absoluteString,
            notes: "Saved from Apple Maps place card",
            provider: "apple_maps",
            providerPlaceId: NativeActivityPlaceIdentity.persistentPlaceID(for: mapItem)
        )
        do {
            let body = try JSONEncoder().encode(payload)
            client.request(path: "/api/trip-segments", method: "POST", body: body) { result in
                completion(result.flatMap { data in
                    do { return .success(try JSONDecoder().decode(Response.self, from: data).data.segment) }
                    catch { return .failure(error) }
                })
            }
        } catch {
            completion(.failure(error))
        }
    }

    func update(
        segmentID: String,
        draft: NativeSavedPlaceDetailDraft,
        completion: @escaping (Result<NativeSavedPlaceSegment, Error>) -> Void
    ) {
        do {
            let body = try JSONEncoder().encode(draft)
            let encodedID = segmentID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? segmentID
            client.request(path: "/api/trip-segments/\(encodedID)", method: "PATCH", body: body) { result in
                completion(result.flatMap { data in
                    do { return .success(try JSONDecoder().decode(Response.self, from: data).data.segment) }
                    catch { return .failure(error) }
                })
            }
        } catch {
            completion(.failure(error))
        }
    }
}

final class NativeActivityPlaceDetailsViewController: UIViewController {
    static let headerHeight: CGFloat = 62
    static let headerControlSize: CGFloat = 44
    static let cardCornerRadius: CGFloat = 22
    static let bottomBarHeight: CGFloat = 56

    static var sheetConfiguration: AlmidySheetConfiguration {
        let selected: UISheetPresentationController.Detent.Identifier
        let detents: [UISheetPresentationController.Detent]
        if #available(iOS 16.0, *) {
            let summary = UISheetPresentationController.Detent.custom(
                identifier: .init("place-details-summary")
            ) { context in context.maximumDetentValue * 0.396 }
            selected = summary.identifier
            detents = [summary, .large()]
        } else {
            selected = .medium
            detents = [.medium(), .large()]
        }
        return AlmidySheetConfiguration.prominent.overriding(
            detents: detents,
            selectedDetentIdentifier: selected,
            cornerRadius: 38,
            grabberVisible: true,
            scrollingExpandsWhenScrolledToEdge: true,
            largestUndimmedDetentIdentifier: .large
        )
    }

    private enum LookAroundReadyState: String {
        case idle, loading, ready, error, closed, fullScreen
    }

    private let mapItem: MKMapItem
    let selectionPlaceID: String
    private let category: NativeActivityCategory
    private let origin: CLLocationCoordinate2D
    private let onSave: (@escaping (Result<NativeSavedPlaceSegment, Error>) -> Void) -> Void
    private let onSaved: (NativeSavedPlaceSegment) -> Void
    private let onRouteChanged: ([MKRoute]) -> Void
    private let onClose: () -> Void
    private weak var travelModesView: NativePlaceTravelModesView?
    private var travelModeMinutes: [Int] = []
    private var travelModeDistancesMiles: [Double] = []
    private var etaDirections: [Int: MKDirections] = [:]
    private var etaGeneration = 0
    private var routeDirections: MKDirections?
    private var routeGeneration = 0
    private var returnedRoutes: [MKRoute] = []
    private var selectedTravelModeIndex = 0
    private var travelDistanceMiles = 0.0
    private weak var travelSummaryLabel: UILabel?
    private weak var routeDestinationLabel: UILabel?
    private var routeDestinationMapItem: MKMapItem?
    // Type-erased so the Place Card itself remains available on iOS 15.
    private var lookAroundRequest: NSObject?
    private weak var lookAroundContainer: UIView?
    private var lookAroundController: UIViewController?
    private var lookAroundReadyState: LookAroundReadyState = .idle
    private let lookAroundLogger = Logger(subsystem: "app.almidy", category: "look-around")
    private weak var saveButton: UIButton?
    private var isSaving = false

    init(
        mapItem: MKMapItem,
        selectionPlaceID: String,
        category: NativeActivityCategory,
        origin: CLLocationCoordinate2D,
        onSave: @escaping (@escaping (Result<NativeSavedPlaceSegment, Error>) -> Void) -> Void,
        onSaved: @escaping (NativeSavedPlaceSegment) -> Void,
        onRouteChanged: @escaping ([MKRoute]) -> Void,
        onClose: @escaping () -> Void
    ) {
        self.mapItem = mapItem
        self.selectionPlaceID = selectionPlaceID
        self.category = category
        self.origin = origin
        self.onSave = onSave
        self.onSaved = onSaved
        self.onRouteChanged = onRouteChanged
        self.onClose = onClose
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.isOpaque = true
        view.backgroundColor = AlmidyDesignTokens.Color.settingsBackground

        let scrollView = UIScrollView()
        scrollView.alwaysBounceVertical = true
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)

        let content = UIStackView()
        content.axis = .vertical
        content.spacing = 16
        content.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(content)

        let header = makeHeader()
        let travelCard = makeTravelCard()
        content.addArrangedSubview(header)
        if #available(iOS 16.0, *) {
            content.addArrangedSubview(makeLookAroundPreview())
            loadLookAroundScene()
        }
        let informationCard = makePlaceInformationCard()
        content.addArrangedSubview(informationCard)
        if let contactCard = makeContactCard() {
            content.addArrangedSubview(contactCard)
        }
        content.addArrangedSubview(travelCard)

        let bottomBar = makeBottomBar()
        bottomBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bottomBar)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            // Keep the details content moving beneath the floating actions, as
            // in the reference sheet. Ending the scroll view above the bar
            // clipped the Address value at the compact detent.
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            content.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            content.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 20),
            content.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -20),
            content.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -96),
            bottomBar.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            bottomBar.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            bottomBar.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: 4),
            bottomBar.heightAnchor.constraint(equalToConstant: Self.bottomBarHeight)
        ])
    }

    @available(iOS 16.0, *)
    private func makeLookAroundPreview() -> UIView {
        let wrapper = UIView()
        wrapper.isHidden = true
        let preview = UIView()
        preview.translatesAutoresizingMaskIntoConstraints = false
        preview.layer.cornerRadius = 10
        preview.clipsToBounds = true
        preview.accessibilityIdentifier = "place-card-look-around-preview"
        wrapper.addSubview(preview)
        NSLayoutConstraint.activate([
            preview.topAnchor.constraint(equalTo: wrapper.topAnchor, constant: 8),
            preview.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor),
            preview.bottomAnchor.constraint(equalTo: wrapper.bottomAnchor, constant: -8),
            preview.widthAnchor.constraint(equalToConstant: 230),
            preview.heightAnchor.constraint(equalToConstant: 140),
            preview.trailingAnchor.constraint(lessThanOrEqualTo: wrapper.trailingAnchor)
        ])
        lookAroundContainer = preview
        return wrapper
    }

    @available(iOS 16.0, *)
    private func loadLookAroundScene() {
        (lookAroundRequest as? MKLookAroundSceneRequest)?.cancel()
        updateLookAroundReadyState(.loading)
        let request = MKLookAroundSceneRequest(mapItem: mapItem)
        lookAroundRequest = request
        request.getSceneWithCompletionHandler { [weak self, weak request] scene, error in
            guard let self,
                  self.lookAroundRequest === request,
                  let container = self.lookAroundContainer else { return }
            guard let scene, error == nil else {
                self.updateLookAroundReadyState(.error)
                self.fadeOutLookAroundPreview()
                return
            }
            let controller = MKLookAroundViewController(scene: scene)
            controller.delegate = self
            controller.isNavigationEnabled = true
            controller.showsRoadLabels = true
            controller.pointOfInterestFilter = .includingAll
            self.addChild(controller)
            controller.view.translatesAutoresizingMaskIntoConstraints = false
            container.addSubview(controller.view)
            NSLayoutConstraint.activate([
                controller.view.topAnchor.constraint(equalTo: container.topAnchor),
                controller.view.leadingAnchor.constraint(equalTo: container.leadingAnchor),
                controller.view.trailingAnchor.constraint(equalTo: container.trailingAnchor),
                controller.view.bottomAnchor.constraint(equalTo: container.bottomAnchor)
            ])
            controller.didMove(toParent: self)
            self.lookAroundController = controller
            let expand = self.lookAroundControl(
                symbol: "arrow.up.left.and.arrow.down.right",
                accessibilityLabel: "Open Look Around full screen",
                action: #selector(self.expandLookAround)
            )
            let close = self.lookAroundControl(
                symbol: "xmark",
                accessibilityLabel: "Close Look Around preview",
                action: #selector(self.closeLookAroundPreview)
            )
            let controls = UIStackView(arrangedSubviews: [expand, close])
            controls.axis = .horizontal
            controls.spacing = 6
            controls.translatesAutoresizingMaskIntoConstraints = false
            container.addSubview(controls)
            NSLayoutConstraint.activate([
                controls.topAnchor.constraint(equalTo: container.topAnchor, constant: 8),
                controls.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -8)
            ])
            self.updateLookAroundReadyState(.ready)
            let wrapper = container.superview
            wrapper?.alpha = 0
            wrapper?.isHidden = false
            UIView.animate(withDuration: 0.24) { wrapper?.alpha = 1 }
            container.accessibilityLabel = "Interactive Look Around preview for \(self.mapItem.name ?? "this place")"
        }
    }

    private func lookAroundControl(
        symbol: String,
        accessibilityLabel: String,
        action: Selector
    ) -> UIButton {
        let button = UIButton(type: .system)
        var configuration = UIButton.Configuration.filled()
        configuration.image = UIImage(systemName: symbol)
        configuration.baseForegroundColor = .label
        configuration.baseBackgroundColor = UIColor.systemBackground.withAlphaComponent(0.82)
        configuration.cornerStyle = .capsule
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 7, leading: 7, bottom: 7, trailing: 7)
        button.configuration = configuration
        button.accessibilityLabel = accessibilityLabel
        button.addTarget(self, action: action, for: .touchUpInside)
        return button
    }

    @available(iOS 16.0, *)
    @objc private func expandLookAround() {
        guard let embedded = lookAroundController as? MKLookAroundViewController,
              let scene = embedded.scene else { return }
        let expanded = MKLookAroundViewController(scene: scene)
        expanded.delegate = self
        expanded.isNavigationEnabled = true
        expanded.showsRoadLabels = true
        expanded.pointOfInterestFilter = .includingAll
        expanded.modalPresentationStyle = .fullScreen
        present(expanded, animated: true)
    }

    @available(iOS 16.0, *)
    @objc private func closeLookAroundPreview() {
        (lookAroundRequest as? MKLookAroundSceneRequest)?.cancel()
        lookAroundRequest = nil
        updateLookAroundReadyState(.closed)
        fadeOutLookAroundPreview()
    }

    private func fadeOutLookAroundPreview() {
        guard let wrapper = lookAroundContainer?.superview else { return }
        UIView.animate(withDuration: 0.2, animations: {
            wrapper.alpha = 0
        }) { [weak self] _ in
            guard let self else { return }
            self.lookAroundController?.willMove(toParent: nil)
            self.lookAroundController?.view.removeFromSuperview()
            self.lookAroundController?.removeFromParent()
            self.lookAroundController = nil
            wrapper.isHidden = true
            wrapper.alpha = 1
        }
    }

    private func updateLookAroundReadyState(_ state: LookAroundReadyState) {
        lookAroundReadyState = state
        lookAroundLogger.debug("Look Around readyState: \(state.rawValue, privacy: .public)")
    }

    private func makeHeader() -> UIView {
        let share = roundButton(symbol: "square.and.arrow.up", label: "Share place")
        share.addTarget(self, action: #selector(sharePlace), for: .touchUpInside)
        let close = roundButton(symbol: "xmark", label: "Close place details")
        close.addTarget(self, action: #selector(closeDetails), for: .touchUpInside)

        let title = UILabel()
        title.text = mapItem.name ?? "Place"
        title.font = .systemFont(ofSize: 24, weight: .semibold)
        title.textAlignment = .center
        title.numberOfLines = 2
        title.lineBreakMode = .byTruncatingTail
        title.adjustsFontSizeToFitWidth = false
        title.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        let subtitle = UILabel()
        let locality = placeLocality()
        subtitle.text = [placeCategoryName(), locality]
            .compactMap { $0 }.joined(separator: " in ")
        subtitle.font = .systemFont(ofSize: 16, weight: .regular)
        subtitle.textColor = UIColor.secondaryLabel.withAlphaComponent(0.78)
        subtitle.textAlignment = .center

        let labels = UIStackView(arrangedSubviews: [title, subtitle])
        labels.axis = .vertical
        labels.spacing = 3
        let header = UIStackView(arrangedSubviews: [share, labels, close])
        header.axis = .horizontal
        header.alignment = .center
        header.spacing = 14
        header.isLayoutMarginsRelativeArrangement = true
        header.layoutMargins = UIEdgeInsets(top: 8, left: 0, bottom: 0, right: 0)
        header.heightAnchor.constraint(greaterThanOrEqualToConstant: Self.headerHeight).isActive = true
        share.widthAnchor.constraint(equalToConstant: Self.headerControlSize).isActive = true
        close.widthAnchor.constraint(equalToConstant: Self.headerControlSize).isActive = true
        return header
    }

    private func makePlaceInformationCard() -> UIView {
        let stack = cardStack()
        var rows: [UIView] = [detailRow(label: "Category", value: placeCategoryName(), action: nil)]
        if let locality = placeLocality() {
            rows.append(detailRow(label: "Location", value: locality, action: nil))
        }
        if let timeZone = mapItem.timeZone {
            rows.append(detailRow(label: "Time Zone", value: timeZone.localizedName(for: .generic, locale: .current) ?? timeZone.identifier, action: nil))
        }
        addDetailRows(rows, to: stack)
        return stack
    }

    private func makeContactCard() -> UIView? {
        let stack = cardStack()
        var rows: [UIView] = []
        if let phone = clean(mapItem.phoneNumber) {
            rows.append(detailRow(label: "Phone", value: phone, action: { [weak self] in self?.callPlace() }))
        }
        if let website = mapItem.url {
            rows.append(detailRow(label: "Website", value: website.host ?? website.absoluteString, action: { [weak self] in self?.openWebsite() }))
        }
        if let address = availableFormattedAddress() {
            rows.append(detailRow(label: "Address", value: address, action: nil))
        }
        guard !rows.isEmpty else { return nil }
        addDetailRows(rows, to: stack)
        return stack
    }

    private func addDetailRows(_ rows: [UIView], to stack: UIStackView) {
        for (index, row) in rows.enumerated() {
            stack.addArrangedSubview(row)
            if index < rows.count - 1 { stack.addArrangedSubview(divider()) }
        }
    }

    private func placeLocality() -> String? {
        let placemark = mapItem.placemark
        let locality = clean(placemark.locality) ?? clean(placemark.subLocality)
        let region = clean(placemark.administrativeArea)
        let country = clean(placemark.country)
        let values = [locality, region, country].compactMap { $0 }
        guard !values.isEmpty else { return nil }
        return values.reduce(into: [String]()) { result, value in
            if !result.contains(where: { $0.localizedCaseInsensitiveCompare(value) == .orderedSame }) {
                result.append(value)
            }
        }.joined(separator: ", ")
    }

    private func placeCategoryName() -> String {
        guard let rawValue = mapItem.pointOfInterestCategory?.rawValue else {
            return NativeActivityPurposeRegistry.purpose(for: category).searchToken
        }
        let value = rawValue.replacingOccurrences(of: "MKPOICategory", with: "")
        let separated = value.reduce(into: "") { result, character in
            if character.isUppercase, !result.isEmpty { result.append(" ") }
            result.append(character)
        }
        return separated.capitalized
    }

    private func makeTravelCard() -> UIView {
        let stack = cardStack()
        let title = UILabel()
        title.text = "Travel Time"
        title.font = .systemFont(ofSize: 22, weight: .semibold)
        stack.addArrangedSubview(padded(title, insets: UIEdgeInsets(top: 18, left: 16, bottom: 8, right: 16)))

        let meters = CLLocation(latitude: origin.latitude, longitude: origin.longitude).distance(
            from: CLLocation(latitude: mapItem.placemark.coordinate.latitude, longitude: mapItem.placemark.coordinate.longitude)
        )
        updateTravelMetrics(meters: meters)
        let durations = travelModeMinutes.map(formattedTravelDuration(minutes:))
        let modesRow = NativePlaceTravelModesView(
            durations: durations,
            selectedIndex: selectedTravelModeIndex
        ) { [weak self] index in
            guard let self else { return }
            self.selectedTravelModeIndex = index
            self.updateTravelModeSelection()
            self.fetchSelectedRoute()
        }
        travelModesView = modesRow
        updateTravelModeSelection()
        stack.addArrangedSubview(padded(modesRow, insets: UIEdgeInsets(top: 0, left: 16, bottom: 12, right: 16)))
        stack.addArrangedSubview(divider())

        stack.addArrangedSubview(travelEndpoint(
            symbol: category.image,
            tint: category.palette.tint,
            title: mapItem.name ?? "Place",
            connectsBelow: true
        ))
        stack.addArrangedSubview(divider(leftInset: 66))
        stack.addArrangedSubview(travelEndpoint(
            symbol: UIImage(systemName: "location.fill")!,
            tint: AlmidyDesignTokens.Color.tripOverviewAccent,
            title: "Current Location",
            accessorySymbol: "magnifyingglass",
            connectsAbove: true,
            connectsBelow: true,
            accessoryAction: #selector(openRouteDestinationSearch),
            capturesRouteDestinationLabel: true
        ))
        stack.addArrangedSubview(divider(leftInset: 66))
        stack.addArrangedSubview(travelEndpoint(
            symbol: UIImage(systemName: "clock")!,
            tint: .secondaryLabel,
            title: "",
            accessorySymbol: "arrow.turn.up.right",
            connectsAbove: true,
            capturesTitleLabel: true,
            accessoryMenu: makeTravelMapMenu()
        ))
        updateTravelModeSelection()
        refreshTravelETAs()
        return stack
    }

    private func updateTravelModeSelection() {
        travelModesView?.update(
            durations: travelModeMinutes.map(formattedTravelDuration(minutes:)),
            selectedIndex: selectedTravelModeIndex
        )
        guard travelModeMinutes.indices.contains(selectedTravelModeIndex) else { return }
        let arrival = Date().addingTimeInterval(TimeInterval(travelModeMinutes[selectedTravelModeIndex] * 60))
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        let distance = travelModeDistancesMiles.indices.contains(selectedTravelModeIndex)
            ? travelModeDistancesMiles[selectedTravelModeIndex]
            : travelDistanceMiles
        travelSummaryLabel?.text = String(
            format: "%.2f mi • %@",
            distance,
            formatter.string(from: arrival)
        )
    }

    private func updateTravelMetrics(meters: CLLocationDistance) {
        travelDistanceMiles = meters / 1_609.344
        travelModeDistancesMiles = Array(repeating: travelDistanceMiles, count: 4)
        let speeds: [Double] = [1.35, 10.5, 7.0, 4.5]
        travelModeMinutes = speeds.map { max(1, Int(ceil(meters / $0 / 60))) }
        updateTravelModeSelection()
    }

    private func refreshTravelETAs() {
        etaGeneration += 1
        let generation = etaGeneration
        etaDirections.values.forEach { $0.cancel() }
        etaDirections.removeAll()

        let source: MKMapItem
        let destination: MKMapItem
        if let routeDestinationMapItem {
            source = mapItem
            destination = routeDestinationMapItem
        } else {
            source = MKMapItem(placemark: MKPlacemark(coordinate: origin))
            destination = mapItem
        }
        var supportedModes: [(Int, MKDirectionsTransportType)] = [
            (0, .walking), (1, .automobile), (2, .transit)
        ]
        if #available(iOS 26.0, *) {
            supportedModes.append((3, .cycling))
        }
        for (index, transportType) in supportedModes {
            let request = MKDirections.Request()
            request.source = source
            request.destination = destination
            request.transportType = transportType
            request.requestsAlternateRoutes = false
            let directions = MKDirections(request: request)
            etaDirections[index] = directions
            directions.calculateETA { [weak self, weak directions] response, _ in
                DispatchQueue.main.async {
                    guard let self,
                          let directions,
                          generation == self.etaGeneration,
                          self.etaDirections[index] === directions else { return }
                    self.etaDirections[index] = nil
                    guard let response else { return }
                    if self.travelModeMinutes.indices.contains(index) {
                        self.travelModeMinutes[index] = max(1, Int(ceil(response.expectedTravelTime / 60)))
                    }
                    if self.travelModeDistancesMiles.indices.contains(index) {
                        self.travelModeDistancesMiles[index] = response.distance / 1_609.344
                    }
                    self.updateTravelMetricsDisplay(at: index)
                    self.updateTravelModeSelection()
                }
            }
        }
        fetchSelectedRoute()
    }

    private func fetchSelectedRoute() {
        routeGeneration += 1
        let generation = routeGeneration
        routeDirections?.cancel()
        returnedRoutes = []
        onRouteChanged([])

        let request = MKDirections.Request()
        if let routeDestinationMapItem {
            request.source = mapItem
            request.destination = routeDestinationMapItem
        } else {
            request.source = .forCurrentLocation()
            request.destination = mapItem
        }
        switch selectedTravelModeIndex {
        case 0: request.transportType = .walking
        case 1: request.transportType = .automobile
        case 2: request.transportType = .transit
        case 3:
            if #available(iOS 26.0, *) {
                request.transportType = .cycling
            } else {
                request.transportType = .walking
            }
        default: request.transportType = .automobile
        }
        request.requestsAlternateRoutes = true

        let directions = MKDirections(request: request)
        routeDirections = directions
        Task { [weak self, weak directions] in
            guard let directions else { return }
            do {
                let response = try await directions.calculate()
                await MainActor.run {
                    guard let self,
                          generation == self.routeGeneration,
                          self.routeDirections === directions else { return }
                    self.routeDirections = nil
                    self.returnedRoutes = response.routes
                    self.onRouteChanged(response.routes)
                    guard let route = response.routes.first else { return }
                    let index = self.selectedTravelModeIndex
                    if self.travelModeMinutes.indices.contains(index) {
                        self.travelModeMinutes[index] = max(1, Int(ceil(route.expectedTravelTime / 60)))
                    }
                    if self.travelModeDistancesMiles.indices.contains(index) {
                        self.travelModeDistancesMiles[index] = route.distance / 1_609.344
                    }
                    self.updateTravelMetricsDisplay(at: index)
                    self.updateTravelModeSelection()
                }
            } catch {
                await MainActor.run {
                    guard let self, generation == self.routeGeneration else { return }
                    self.routeDirections = nil
                    self.returnedRoutes = []
                    self.onRouteChanged([])
                }
            }
        }
    }

    private func updateTravelMetricsDisplay(at index: Int) {
        guard travelModeMinutes.indices.contains(index) else { return }
        travelModesView?.update(
            durations: travelModeMinutes.map(formattedTravelDuration(minutes:)),
            selectedIndex: selectedTravelModeIndex
        )
    }

    private func makeBottomBar() -> UIView {
        let route = roundButton(symbol: "arrow.turn.up.right", label: "Open directions")
        route.menu = makeDirectionsMenu()
        route.showsMenuAsPrimaryAction = true
        route.widthAnchor.constraint(equalToConstant: 48).isActive = true

        let save = UIButton(type: .system)
        save.setTitle("Save Place", for: .normal)
        save.titleLabel?.font = .systemFont(ofSize: 20, weight: .semibold)
        save.setTitleColor(
            UIColor(red: 1.0, green: 0.91, blue: 0.67, alpha: 1),
            for: .normal
        )
        save.backgroundColor = category.palette.tint
        save.layer.cornerRadius = 26
        save.layer.shadowColor = UIColor.black.cgColor
        save.layer.shadowOpacity = 0.18
        save.layer.shadowRadius = 10
        save.layer.shadowOffset = CGSize(width: 0, height: 4)
        save.layer.masksToBounds = false
        save.accessibilityHint = "Adds this place to the trip"
        save.addTarget(self, action: #selector(savePlace), for: .touchUpInside)
        save.widthAnchor.constraint(greaterThanOrEqualToConstant: 124).isActive = true
        save.heightAnchor.constraint(equalToConstant: 52).isActive = true
        saveButton = save

        let spacer = UIView()
        let row = UIStackView(arrangedSubviews: [route, spacer, save])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 12
        return row
    }

    private func makeDirectionsMenu() -> UIMenu {
        let menuTitle = [mapItem.name, formattedAddress(), "activity.get_directions"]
            .compactMap { $0 }
            .joined(separator: "\n")
        let services: [(String, String)] = [
            ("Uber", "car.fill"),
            ("Lyft", "car.side.fill"),
            ("Waze", "location.fill"),
            ("Google Maps", "map.fill"),
            ("Apple Maps", "map")
        ]
        let serviceActions = services.map { service, symbol in
            UIAction(title: service, image: UIImage(systemName: symbol)) { [weak self] _ in
                self?.openDirections(using: service)
            }
        }
        let copy = UIAction(title: "Copy Address", image: UIImage(systemName: "doc.on.doc")) { [weak self] _ in
            guard let self else { return }
            UIPasteboard.general.string = self.formattedAddress().replacingOccurrences(of: "\n", with: ", ")
            UIAccessibility.post(notification: .announcement, argument: "Address copied")
        }
        return UIMenu(
            title: menuTitle,
            children: serviceActions + [UIMenu(options: .displayInline, children: [copy])]
        )
    }

    private func makeTravelMapMenu() -> UIMenu {
        let appleMaps = UIAction(title: "Apple Maps", image: UIImage(systemName: "map")) { [weak self] _ in
            self?.openDirections()
        }
        let googleMaps = UIAction(title: "Google Maps", image: UIImage(systemName: "map.fill")) { [weak self] _ in
            self?.openDirections(using: "Google Maps")
        }
        return UIMenu(children: [appleMaps, googleMaps])
    }

    private func openDirections(using service: String) {
        let destination = routeDestinationMapItem ?? mapItem
        let coordinate = destination.placemark.coordinate
        let latitude = String(format: "%.6f", coordinate.latitude)
        let longitude = String(format: "%.6f", coordinate.longitude)
        let name = destination.name ?? destination.placemark.title ?? "Destination"
        let encodedName = name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "Destination"
        let encodedAddress = formattedAddress()
            .replacingOccurrences(of: "\n", with: ", ")
            .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""

        switch service {
        case "Uber":
            openExternalApp(
                URL(string: "uber://?action=setPickup&pickup=my_location&dropoff[latitude]=\(latitude)&dropoff[longitude]=\(longitude)&dropoff[nickname]=\(encodedName)"),
                fallback: URL(string: "https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=\(latitude)&dropoff[longitude]=\(longitude)&dropoff[nickname]=\(encodedName)")
            )
        case "Lyft":
            openExternalApp(
                URL(string: "lyft://ridetype?id=lyft&destination[latitude]=\(latitude)&destination[longitude]=\(longitude)"),
                fallback: URL(string: "https://ride.lyft.com/?destination[latitude]=\(latitude)&destination[longitude]=\(longitude)")
            )
        case "Waze":
            openExternalApp(
                URL(string: "waze://?ll=\(latitude),\(longitude)&navigate=yes"),
                fallback: URL(string: "https://www.waze.com/ul?ll=\(latitude)%2C\(longitude)&navigate=yes")
            )
        case "Google Maps":
            openExternalApp(
                URL(string: "comgooglemaps://?daddr=\(latitude),\(longitude)&directionsmode=driving"),
                fallback: URL(string: "https://www.google.com/maps/dir/?api=1&destination=\(latitude)%2C\(longitude)&destination_place_id=\(encodedAddress)")
            )
        default:
            openDirections()
        }
    }

    private func openExternalApp(_ appURL: URL?, fallback: URL?) {
        guard let appURL else {
            if let fallback { UIApplication.shared.open(fallback) }
            return
        }
        UIApplication.shared.open(appURL, options: [:]) { opened in
            guard !opened, let fallback else { return }
            UIApplication.shared.open(fallback)
        }
    }

    private func cardStack() -> UIStackView {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.backgroundColor = AlmidyDesignTokens.Color.settingsCard
        stack.layer.cornerRadius = Self.cardCornerRadius
        stack.clipsToBounds = true
        return stack
    }

    private func detailRow(label: String, value: String, action: (() -> Void)?) -> UIView {
        let caption = UILabel()
        caption.text = label
        caption.font = .systemFont(ofSize: 14, weight: .regular)
        caption.textColor = UIColor.secondaryLabel.withAlphaComponent(0.72)
        let detail = UILabel()
        detail.text = value
        detail.font = .systemFont(ofSize: 16, weight: .regular)
        detail.textColor = action == nil ? .label : category.palette.tint
        detail.numberOfLines = 0
        let stack = UIStackView(arrangedSubviews: [caption, detail])
        stack.axis = .vertical
        stack.spacing = 4
        let insets = UIEdgeInsets(top: 10, left: 16, bottom: 10, right: 16)
        let container: UIView
        if let action {
            container = NativePlaceAccessibleActionView(child: stack, insets: insets, onActivate: action)
        } else {
            container = padded(stack, insets: insets)
            container.isAccessibilityElement = true
        }
        container.isAccessibilityElement = true
        container.accessibilityLabel = label
        container.accessibilityValue = value.replacingOccurrences(of: "\n", with: ", ")
        return container
    }

    private func travelEndpoint(
        symbol: UIImage,
        tint: UIColor,
        title: String,
        accessorySymbol: String? = nil,
        connectsAbove: Bool = false,
        connectsBelow: Bool = false,
        capturesTitleLabel: Bool = false,
        accessoryAction: Selector? = nil,
        capturesRouteDestinationLabel: Bool = false,
        accessoryMenu: UIMenu? = nil
    ) -> UIView {
        let icon = UIImageView(image: symbol.withRenderingMode(.alwaysTemplate))
        icon.tintColor = tint
        icon.contentMode = .scaleAspectFit
        icon.translatesAutoresizingMaskIntoConstraints = false
        let iconContainer = UIView()
        iconContainer.backgroundColor = tint.withAlphaComponent(0.10)
        iconContainer.layer.cornerRadius = 18
        iconContainer.addSubview(icon)
        iconContainer.widthAnchor.constraint(equalToConstant: 36).isActive = true
        iconContainer.heightAnchor.constraint(equalToConstant: 36).isActive = true
        NSLayoutConstraint.activate([
            icon.centerXAnchor.constraint(equalTo: iconContainer.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: iconContainer.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 22),
            icon.heightAnchor.constraint(equalToConstant: 22)
        ])
        let label = UILabel()
        label.text = title
        label.font = .systemFont(ofSize: 16, weight: .regular)
        label.numberOfLines = 1
        if capturesTitleLabel {
            travelSummaryLabel = label
        }
        if capturesRouteDestinationLabel {
            routeDestinationLabel = label
        }
        let spacer = UIView()
        var arrangedSubviews: [UIView] = [iconContainer, label, spacer]
        if let accessorySymbol {
            let accessory = UIButton(type: .system)
            accessory.setImage(UIImage(systemName: accessorySymbol), for: .normal)
            accessory.tintColor = .secondaryLabel
            accessory.accessibilityLabel = accessoryAction == nil ? nil : "Choose route destination"
            if let accessoryAction {
                accessory.addTarget(self, action: accessoryAction, for: .touchUpInside)
            } else if let accessoryMenu {
                accessory.menu = accessoryMenu
                accessory.showsMenuAsPrimaryAction = true
            } else {
                accessory.isUserInteractionEnabled = false
            }
            accessory.widthAnchor.constraint(equalToConstant: 44).isActive = true
            accessory.heightAnchor.constraint(equalToConstant: 44).isActive = true
            arrangedSubviews.append(accessory)
        }
        let row = UIStackView(arrangedSubviews: arrangedSubviews)
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 14
        let container = padded(row, insets: UIEdgeInsets(top: 8, left: 16, bottom: 8, right: 16))
        let routeLineColor = UIColor.separator.withAlphaComponent(0.20)
        if connectsAbove {
            let line = UIView()
            line.backgroundColor = routeLineColor
            line.translatesAutoresizingMaskIntoConstraints = false
            container.insertSubview(line, at: 0)
            NSLayoutConstraint.activate([
                line.widthAnchor.constraint(equalToConstant: 1.5),
                line.centerXAnchor.constraint(equalTo: container.leadingAnchor, constant: 34),
                line.topAnchor.constraint(equalTo: container.topAnchor),
                line.bottomAnchor.constraint(equalTo: iconContainer.topAnchor)
            ])
        }
        if connectsBelow {
            let line = UIView()
            line.backgroundColor = routeLineColor
            line.translatesAutoresizingMaskIntoConstraints = false
            container.insertSubview(line, at: 0)
            NSLayoutConstraint.activate([
                line.widthAnchor.constraint(equalToConstant: 1.5),
                line.centerXAnchor.constraint(equalTo: container.leadingAnchor, constant: 34),
                line.topAnchor.constraint(equalTo: iconContainer.bottomAnchor),
                line.bottomAnchor.constraint(equalTo: container.bottomAnchor)
            ])
        }
        return container
    }

    private func roundButton(symbol: String, label: String) -> UIButton {
        let button = AlmidyIconButton(
            symbol: symbol,
            style: .floating,
            accessibilityLabel: label,
            overrides: .init(
                diameter: Self.headerControlSize,
                symbolPointSize: 18,
                symbolWeight: .regular,
                foregroundColor: .label,
                backgroundColor: AlmidyDesignTokens.Color.settingsCard.withAlphaComponent(0.76),
                elevation: .init(
                    color: .black,
                    opacity: 0.10,
                    radius: 10,
                    offset: CGSize(width: 0, height: 4)
                )
            )
        )
        return button
    }

    private func padded(_ child: UIView, insets: UIEdgeInsets) -> UIView {
        let container = UIView()
        child.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(child)
        NSLayoutConstraint.activate([
            child.topAnchor.constraint(equalTo: container.topAnchor, constant: insets.top),
            child.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: insets.left),
            child.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -insets.right),
            child.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -insets.bottom)
        ])
        return container
    }

    private func divider(leftInset: CGFloat = 16) -> UIView {
        let line = AlmidyDivider(color: UIColor.separator.withAlphaComponent(0.22))
        return padded(line, insets: UIEdgeInsets(top: 0, left: leftInset, bottom: 0, right: 16))
    }

    private func formattedTravelDuration(minutes: Int) -> String {
        guard minutes >= 60 else { return "\(minutes)m" }
        let hours = minutes / 60
        let remainingMinutes = minutes % 60
        if hours >= 24 {
            return remainingMinutes >= 30 ? "\(hours + 1)h" : "\(hours)h"
        }
        return remainingMinutes == 0 ? "\(hours)h" : "\(hours)h \(remainingMinutes)m"
    }

    private func availableFormattedAddress() -> String? {
        let placemark = mapItem.placemark
        let street = [clean(placemark.subThoroughfare), clean(placemark.thoroughfare)]
            .compactMap { $0 }
            .joined(separator: " ")
        let cityRegionPostal = [clean(placemark.locality), clean(placemark.administrativeArea), clean(placemark.postalCode)]
            .compactMap { $0 }
            .joined(separator: " ")
        let semanticLines = [clean(street), clean(cityRegionPostal), clean(placemark.country)]
            .compactMap { $0 }
        if !semanticLines.isEmpty {
            return semanticLines.joined(separator: "\n")
        }
        return clean(placemark.title)
    }

    private func formattedAddress() -> String {
        availableFormattedAddress() ?? "Address unavailable"
    }

    private func clean(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        return value
    }

    @objc private func closeDetails() {
        dismiss(animated: true, completion: onClose)
    }
    @objc private func sharePlace(_ sender: UIButton) {
        let values: [Any] = [mapItem.name, mapItem.url?.absoluteString, mapItem.placemark.title].compactMap { $0 }
        let controller = UIActivityViewController(activityItems: values, applicationActivities: nil)
        controller.popoverPresentationController?.sourceView = sender
        present(controller, animated: true)
    }
    @objc private func callPlace() {
        guard let phone = clean(mapItem.phoneNumber), let url = URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })") else { return }
        UIApplication.shared.open(url)
    }
    @objc private func openWebsite() {
        guard let url = mapItem.url else { return }
        UIApplication.shared.open(url)
    }
    @objc private func openDirections() {
        let options = [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving]
        if let routeDestinationMapItem {
            MKMapItem.openMaps(with: [mapItem, routeDestinationMapItem], launchOptions: options)
        } else {
            mapItem.openInMaps(launchOptions: options)
        }
    }

    @objc private func openRouteDestinationSearch() {
        let controller = NativeRouteDestinationSearchViewController(
            accent: category.palette.tint,
            nearbyCoordinate: origin
        ) { [weak self] destination in
            guard let self else { return }
            self.routeDestinationMapItem = destination
            self.routeDestinationLabel?.text = destination.name ?? destination.placemark.title ?? "Destination"
            let start = CLLocation(
                latitude: self.mapItem.placemark.coordinate.latitude,
                longitude: self.mapItem.placemark.coordinate.longitude
            )
            let end = CLLocation(
                latitude: destination.placemark.coordinate.latitude,
                longitude: destination.placemark.coordinate.longitude
            )
            self.updateTravelMetrics(meters: start.distance(from: end))
            self.refreshTravelETAs()
        }
        controller.modalPresentationStyle = .pageSheet
        if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
            sheet.prefersGrabberVisible = false
            sheet.preferredCornerRadius = 36
        }
        present(controller, animated: true)
    }
    @objc private func savePlace() {
        guard !isSaving else { return }
        isSaving = true
        saveButton?.isEnabled = false
        saveButton?.setTitle("Saving…", for: .normal)
        onSave { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                self.isSaving = false
                self.saveButton?.isEnabled = true
                self.saveButton?.setTitle("Save Place", for: .normal)
                switch result {
                case .success(let segment):
                    let categoryName = NativeActivityPurposeRegistry.purpose(for: self.category).searchToken.uppercased()
                    let confirmation = UIAlertController(
                        title: "SAVED IN \(categoryName)",
                        message: nil,
                        preferredStyle: .alert
                    )
                    self.present(confirmation, animated: true)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self, weak confirmation] in
                        guard let self else { return }
                        confirmation?.dismiss(animated: true) {
                            self.dismiss(animated: true) { self.onSaved(segment) }
                        }
                    }
                case .failure(let error):
                    let message: String
                    if let storeError = error as? NativeTripStoreError,
                       case .unauthorized = storeError {
                        message = "Your Almidy session expired. Sign in again, then retry saving this place."
                    } else if (error as NSError).domain == "app.almidy.place-card" {
                        message = "Open this place from a trip’s New Activity search, then try again."
                    } else {
                        message = "Almidy couldn’t add this place to the itinerary. Please try again."
                    }
                    let alert = UIAlertController(
                        title: "Place Not Saved",
                        message: message,
                        preferredStyle: .alert
                    )
                    alert.addAction(UIAlertAction(title: "OK", style: .default))
                    self.present(alert, animated: true)
                }
            }
        }
    }
}

private final class NativeVerticalCalendarView: UIView {
    var onSelectDate: ((Date) -> Void)?

    private let calendar = Calendar.current
    private let selectedDate: Date
    private let startOfToday: Date

    init(selectedDate: Date = Date()) {
        self.selectedDate = selectedDate
        self.startOfToday = Calendar.current.startOfDay(for: Date())
        super.init(frame: .zero)
        buildView()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func buildView() {
        backgroundColor = .systemBackground

        let weekdayRow = UIStackView()
        weekdayRow.axis = .horizontal
        weekdayRow.distribution = .fillEqually
        weekdayRow.translatesAutoresizingMaskIntoConstraints = false
        for weekday in calendar.veryShortStandaloneWeekdaySymbols {
            let label = UILabel()
            label.text = weekday.uppercased()
            label.textAlignment = .center
            label.textColor = .secondaryLabel
            label.font = .systemFont(ofSize: 13, weight: .semibold)
            weekdayRow.addArrangedSubview(label)
        }

        let scrollView = UIScrollView()
        scrollView.alwaysBounceVertical = true
        scrollView.showsVerticalScrollIndicator = true
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        let monthsStack = UIStackView()
        monthsStack.axis = .vertical
        monthsStack.spacing = 26
        monthsStack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(monthsStack)

        addSubview(weekdayRow)
        addSubview(scrollView)
        NSLayoutConstraint.activate([
            weekdayRow.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            weekdayRow.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 24),
            weekdayRow.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -24),
            weekdayRow.heightAnchor.constraint(equalToConstant: 28),
            scrollView.topAnchor.constraint(equalTo: weekdayRow.bottomAnchor, constant: 8),
            scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),
            monthsStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            monthsStack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: 24),
            monthsStack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -24),
            monthsStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -24),
            monthsStack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor, constant: -48)
        ])

        let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: startOfToday)) ?? startOfToday
        for offset in 0..<24 {
            guard let month = calendar.date(byAdding: .month, value: offset, to: monthStart) else { continue }
            monthsStack.addArrangedSubview(makeMonthView(month))
        }
    }

    private func makeMonthView(_ month: Date) -> UIView {
        let container = UIStackView()
        container.axis = .vertical
        container.spacing = 10

        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        let title = UILabel()
        title.text = formatter.string(from: month)
        title.font = .systemFont(ofSize: 23, weight: .semibold)
        container.addArrangedSubview(title)

        let grid = UIStackView()
        grid.axis = .vertical
        grid.distribution = .fillEqually
        grid.spacing = 5
        container.addArrangedSubview(grid)

        let dayRange = calendar.range(of: .day, in: .month, for: month) ?? 1..<1
        let weekday = calendar.component(.weekday, from: month)
        let leadingBlanks = (weekday - calendar.firstWeekday + 7) % 7
        let cellCount = leadingBlanks + dayRange.count
        let rowCount = Int(ceil(Double(cellCount) / 7.0))

        for rowIndex in 0..<rowCount {
            let row = UIStackView()
            row.axis = .horizontal
            row.distribution = .fillEqually
            row.spacing = 4
            grid.addArrangedSubview(row)
            for column in 0..<7 {
                let index = rowIndex * 7 + column
                let day = index - leadingBlanks + 1
                let button = UIButton(type: .system)
                button.titleLabel?.font = .systemFont(ofSize: 20, weight: .regular)
                button.heightAnchor.constraint(equalToConstant: 42).isActive = true
                guard day >= 1, day <= dayRange.count,
                      let date = calendar.date(byAdding: .day, value: day - 1, to: month) else {
                    button.isEnabled = false
                    row.addArrangedSubview(button)
                    continue
                }
                button.setTitle("\(day)", for: .normal)
                button.accessibilityLabel = DateFormatter.localizedString(from: date, dateStyle: .long, timeStyle: .none)
                button.tag = Int(date.timeIntervalSince1970)
                button.addTarget(self, action: #selector(dayTapped(_:)), for: .touchUpInside)
                let isPast = calendar.startOfDay(for: date) < startOfToday
                button.isEnabled = !isPast
                button.setTitleColor(isPast ? .tertiaryLabel : .label, for: .normal)
                if calendar.isDate(date, inSameDayAs: selectedDate) {
                    button.backgroundColor = AlmidyDesignTokens.Color.goldDark
                    button.setTitleColor(.white, for: .normal)
                    button.layer.cornerRadius = 21
                }
                row.addArrangedSubview(button)
            }
        }
        return container
    }

    @objc private func dayTapped(_ sender: UIButton) {
        onSelectDate?(Date(timeIntervalSince1970: TimeInterval(sender.tag)))
    }
}

typealias NativeFlightDraftSubmission = (
    TransportationActivityDraft,
    @escaping (Result<Void, Error>) -> Void
) -> Void

final class NativeFlightSearchViewController: UIViewController,
    MKLocalSearchCompleterDelegate, UITableViewDataSource, UITableViewDelegate, UITextFieldDelegate {
    private let accent: UIColor
    private let tripID: String?
    private let onSubmitFlight: NativeFlightDraftSubmission?
    private let onFlightSaved: (() -> Void)?
    private let completer = MKLocalSearchCompleter()
    private var completions: [MKLocalSearchCompletion] = []
    private let searchField = UITextField()
    private let resultsTable = UITableView(frame: .zero, style: .plain)
    private let forwardingCard = UIView()
    private weak var flightNumberField: UITextField?
    private weak var airlineField: UITextField?
    private weak var dateField: UITextField?
    private weak var flightSuggestion: UIView?
    private weak var arrivalPrompt: UIView?
    private weak var verticalCalendar: NativeVerticalCalendarView?
    private weak var emptySearchPrompt: UIView?
    private weak var matchedFlightView: UIView?
    private weak var flightEntryView: UIView?
    private var selectedAirline: (name: String, codes: String)?
    private var inferredFlightNumber: String?
    private var selectedDate: Date?
    private var airlineResults: [(name: String, codes: String)] = []
    private let airlines: [(String, String)] = [
        ("American Air Charter", "GTW"), ("American Airlines", "AAL · AA"),
        ("American Falcon", "AF"), ("American Jet International", "SCM"),
        ("Latin American Wings", "JMR · LW"), ("Native American Air Ambulance", "NVT"),
        ("North American Airlines", "NAO · NA"), ("North American Charters", "NC"),
        ("North American Jet", "SFH")
    ]

    init(
        accent: UIColor,
        tripID: String? = nil,
        onSubmitFlight: NativeFlightDraftSubmission? = nil,
        onFlightSaved: (() -> Void)? = nil
    ) {
        self.accent = accent
        self.tripID = tripID
        self.onSubmitFlight = onSubmitFlight
        self.onFlightSaved = onFlightSaved
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        completer.delegate = self
        completer.resultTypes = [.address, .pointOfInterest, .query]

        let cancel = UIButton(type: .system)
        cancel.setTitle("Cancel", for: .normal)
        cancel.setTitleColor(.label, for: .normal)
        cancel.titleLabel?.font = .systemFont(ofSize: 18, weight: .medium)
        cancel.backgroundColor = UIColor.secondarySystemBackground.withAlphaComponent(0.82)
        cancel.layer.cornerRadius = 22
        cancel.layer.shadowColor = UIColor.black.cgColor
        cancel.layer.shadowOpacity = 0.08
        cancel.layer.shadowRadius = 10
        cancel.layer.shadowOffset = CGSize(width: 0, height: 4)
        cancel.addTarget(self, action: #selector(cancelSearch), for: .touchUpInside)

        let title = UILabel()
        title.text = "Search Flight"
        title.font = .systemFont(ofSize: 22, weight: .semibold)
        title.textAlignment = .center

        searchField.placeholder = "Airport, Airline or Flight Number (e.g AA107)"
        searchField.font = .systemFont(ofSize: 17)
        searchField.backgroundColor = .secondarySystemFill
        searchField.layer.cornerRadius = 12
        searchField.clearButtonMode = .whileEditing
        searchField.returnKeyType = .search
        searchField.autocapitalizationType = .allCharacters
        searchField.autocorrectionType = .no
        searchField.tintColor = AlmidyDesignTokens.Color.goldDark
        searchField.setPadding(12)
        searchField.delegate = self
        searchField.accessibilityIdentifier = "native-flight-search-query"
        searchField.addTarget(self, action: #selector(queryChanged), for: .editingChanged)

        configureForwardingCard()

        resultsTable.register(UITableViewCell.self, forCellReuseIdentifier: "flight-search-result")
        resultsTable.dataSource = self
        resultsTable.delegate = self
        resultsTable.rowHeight = 68
        resultsTable.keyboardDismissMode = .interactive
        resultsTable.tableFooterView = UIView()
        resultsTable.isHidden = true

        let separator = UIView()
        separator.backgroundColor = UIColor.separator.withAlphaComponent(0.22)
        [cancel, title, searchField, separator, forwardingCard, resultsTable].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview($0)
        }
        NSLayoutConstraint.activate([
            cancel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            cancel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            cancel.widthAnchor.constraint(equalToConstant: 76),
            cancel.heightAnchor.constraint(equalToConstant: 34),
            title.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            title.centerYAnchor.constraint(equalTo: cancel.centerYAnchor),
            searchField.topAnchor.constraint(equalTo: cancel.bottomAnchor, constant: 18),
            searchField.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            searchField.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            searchField.heightAnchor.constraint(equalToConstant: 44),
            separator.topAnchor.constraint(equalTo: searchField.bottomAnchor, constant: 8),
            separator.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            separator.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            separator.heightAnchor.constraint(equalToConstant: 1 / UIScreen.main.scale),
            forwardingCard.topAnchor.constraint(equalTo: separator.bottomAnchor, constant: 16),
            forwardingCard.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            forwardingCard.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            forwardingCard.heightAnchor.constraint(equalToConstant: 130),
            resultsTable.topAnchor.constraint(equalTo: separator.bottomAnchor, constant: 8),
            resultsTable.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            resultsTable.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            resultsTable.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        searchField.becomeFirstResponder()
    }

    private func configureForwardingCard() {
        forwardingCard.backgroundColor = AlmidyDesignTokens.Color.goldMutedSurface
        forwardingCard.layer.cornerRadius = 16

        let icon = UIImageView(image: UIImage(systemName: "arrowshape.turn.up.right"))
        icon.tintColor = .secondaryLabel
        icon.contentMode = .scaleAspectFit
        let title = UILabel()
        title.text = "Forward Reservations"
        title.font = .systemFont(ofSize: 18, weight: .semibold)
        let detail = UILabel()
        detail.text = "Forward ticket reservations, and save in your itinerary automatically."
        detail.font = .systemFont(ofSize: 14)
        detail.textColor = .secondaryLabel
        detail.numberOfLines = 2
        let setup = UIButton(type: .system)
        setup.setTitle("Set Up Now", for: .normal)
        setup.setTitleColor(AlmidyDesignTokens.Color.goldDark, for: .normal)
        setup.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        setup.contentHorizontalAlignment = .leading
        setup.addTarget(self, action: #selector(setUpForwarding), for: .touchUpInside)
        let close = UIButton(type: .system)
        close.setImage(UIImage(systemName: "xmark"), for: .normal)
        close.tintColor = .secondaryLabel
        close.addTarget(self, action: #selector(hideForwardingCard), for: .touchUpInside)
        close.accessibilityLabel = "Dismiss Forward Reservations"

        [icon, title, detail, setup, close].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            forwardingCard.addSubview($0)
        }
        NSLayoutConstraint.activate([
            icon.leadingAnchor.constraint(equalTo: forwardingCard.leadingAnchor, constant: 16),
            icon.topAnchor.constraint(equalTo: forwardingCard.topAnchor, constant: 20),
            icon.widthAnchor.constraint(equalToConstant: 28),
            icon.heightAnchor.constraint(equalToConstant: 28),
            close.trailingAnchor.constraint(equalTo: forwardingCard.trailingAnchor, constant: -12),
            close.topAnchor.constraint(equalTo: forwardingCard.topAnchor, constant: 12),
            close.widthAnchor.constraint(equalToConstant: 36),
            close.heightAnchor.constraint(equalToConstant: 36),
            title.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 14),
            title.topAnchor.constraint(equalTo: forwardingCard.topAnchor, constant: 16),
            title.trailingAnchor.constraint(lessThanOrEqualTo: close.leadingAnchor, constant: -8),
            detail.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            detail.trailingAnchor.constraint(equalTo: forwardingCard.trailingAnchor, constant: -24),
            detail.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 5),
            setup.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            setup.topAnchor.constraint(equalTo: detail.bottomAnchor, constant: 6),
            setup.trailingAnchor.constraint(equalTo: detail.trailingAnchor),
            setup.bottomAnchor.constraint(lessThanOrEqualTo: forwardingCard.bottomAnchor, constant: -10)
        ])
    }

    @objc private func cancelSearch() { dismiss(animated: true) }
    @objc private func hideForwardingCard() {
        forwardingCard.isHidden = true
        showFlightEmptyState()
    }
    @objc private func setUpForwarding() {
        let alert = UIAlertController(
            title: "Forward Reservations",
            message: "Reservation forwarding setup will connect your travel inbox to this itinerary.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    @objc private func queryChanged() {
        let query = searchField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if query.count < 2 {
            inferredFlightNumber = nil
            airlineResults = []
            completions = []
            resultsTable.isHidden = true
            forwardingCard.isHidden = false
            resultsTable.reloadData()
            completer.queryFragment = ""
            return
        }
        forwardingCard.isHidden = true
        emptySearchPrompt?.removeFromSuperview()
        inferredFlightNumber = Self.flightNumberComponent(in: query)
        airlineResults = airlines.filter {
            $0.0.localizedCaseInsensitiveContains(query) || $0.1.localizedCaseInsensitiveContains(query)
                || Self.airlineCodes(in: $0.1).contains { query.uppercased().hasPrefix($0) }
        }
        if !airlineResults.isEmpty {
            resultsTable.isHidden = false
            resultsTable.reloadData()
        }
        completer.queryFragment = "airport airline \(query)"
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        let query = searchField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard query.count >= 2, airlineResults.isEmpty, selectedAirline == nil else { return }
        completions = Array(completer.results.prefix(6))
        resultsTable.isHidden = completions.isEmpty
        resultsTable.reloadData()
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        completions = []
        resultsTable.isHidden = true
        resultsTable.reloadData()
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        airlineResults.isEmpty ? completions.count : airlineResults.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "flight-search-result", for: indexPath)
        var content = cell.defaultContentConfiguration()
        if !airlineResults.isEmpty {
            let airline = airlineResults[indexPath.row]
            content.image = UIImage(systemName: "airplane.circle.fill")
            content.text = airline.name
            content.secondaryText = airline.codes
        } else {
            let completion = completions[indexPath.row]
            content.image = UIImage(systemName: "airplane")
            content.text = completion.title
            content.secondaryText = completion.subtitle
        }
        content.imageProperties.tintColor = AlmidyDesignTokens.Color.goldDark
        content.textProperties.font = .systemFont(ofSize: 16, weight: .medium)
        content.secondaryTextProperties.color = .secondaryLabel
        cell.contentConfiguration = content
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        if !airlineResults.isEmpty {
            showFlightEntry(for: airlineResults[indexPath.row])
            return
        }
        let completion = completions[indexPath.row]
        searchField.text = completion.title
        searchField.resignFirstResponder()
        tableView.isHidden = true
        openManualFlightRoute()
    }

    private func showFlightEntry(for airline: (name: String, codes: String)) {
        selectedAirline = airline
        searchField.resignFirstResponder()
        forwardingCard.isHidden = true
        resultsTable.isHidden = true
        searchField.isHidden = true

        let airlineField = flightField(symbol: "airplane", text: Self.threeLetterAirlineCode(in: airline.codes) ?? airline.codes)
        self.airlineField = airlineField
        let clearAirline = UIButton(type: .system)
        clearAirline.setImage(UIImage(systemName: "xmark.circle.fill"), for: .normal)
        clearAirline.tintColor = .tertiaryLabel
        clearAirline.frame = CGRect(x: 0, y: 0, width: 40, height: 44)
        clearAirline.addTarget(self, action: #selector(clearSelectedAirline), for: .touchUpInside)
        clearAirline.accessibilityLabel = "Clear airline"
        airlineField.rightView = clearAirline
        airlineField.rightViewMode = .always
        let numberField = flightField(symbol: "number.circle", text: "Flight Number")
        numberField.tag = 100
        numberField.keyboardType = .default
        numberField.autocapitalizationType = .allCharacters
        numberField.autocorrectionType = .no
        numberField.delegate = self
        numberField.addTarget(self, action: #selector(flightNumberChanged), for: .editingChanged)
        numberField.text = inferredFlightNumber
        numberField.accessibilityIdentifier = "native-flight-number"
        flightNumberField = numberField
        let dateField = flightField(symbol: "calendar", text: "Date")
        dateField.tag = 101
        dateField.delegate = self
        dateField.accessibilityIdentifier = "native-flight-date"
        self.dateField = dateField
        let topRow = UIStackView(arrangedSubviews: [airlineField, numberField])
        topRow.axis = .horizontal
        topRow.distribution = .fillEqually
        topRow.spacing = 8
        let fields = UIStackView(arrangedSubviews: [topRow, dateField])
        fields.axis = .vertical
        fields.spacing = 8
        flightEntryView = fields

        let icons = flightPromptIcons()
        let prompt = UILabel()
        prompt.text = "Enter Arrival"
        prompt.font = .systemFont(ofSize: 24, weight: .semibold)
        prompt.textAlignment = .center
        let subtitle = UILabel()
        subtitle.text = "You can search by arrival city or airport"
        subtitle.font = .systemFont(ofSize: 17)
        subtitle.textColor = .secondaryLabel
        subtitle.textAlignment = .center
        let empty = UIStackView(arrangedSubviews: [icons, prompt, subtitle])
        empty.axis = .vertical
        empty.spacing = 0
        empty.setCustomSpacing(28, after: icons)
        empty.setCustomSpacing(16, after: prompt)
        arrivalPrompt = empty

        let suggestion = makeFlightSuggestion()
        suggestion.isHidden = true
        flightSuggestion = suggestion

        [fields, suggestion, empty].forEach { $0.translatesAutoresizingMaskIntoConstraints = false; view.addSubview($0) }
        NSLayoutConstraint.activate([
            fields.topAnchor.constraint(equalTo: searchField.topAnchor),
            fields.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            fields.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            suggestion.topAnchor.constraint(equalTo: fields.bottomAnchor),
            suggestion.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            suggestion.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            suggestion.heightAnchor.constraint(equalToConstant: 72),
            empty.topAnchor.constraint(equalTo: fields.bottomAnchor, constant: 34),
            empty.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
            empty.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32)
        ])
        if numberField.text?.isEmpty == false {
            flightNumberChanged()
        }
        numberField.becomeFirstResponder()
    }

    private func flightPromptIcons() -> UIView {
        let symbols = ["calendar", "airplane", "clock"]
        let iconAccent = accent
        let circleFill = UIColor { traits in
            let foreground = iconAccent.resolvedColor(with: traits)
            let background = UIColor.systemBackground.resolvedColor(with: traits)
            var foregroundRed: CGFloat = 0
            var foregroundGreen: CGFloat = 0
            var foregroundBlue: CGFloat = 0
            var foregroundAlpha: CGFloat = 0
            var backgroundRed: CGFloat = 0
            var backgroundGreen: CGFloat = 0
            var backgroundBlue: CGFloat = 0
            var backgroundAlpha: CGFloat = 0
            guard foreground.getRed(
                &foregroundRed,
                green: &foregroundGreen,
                blue: &foregroundBlue,
                alpha: &foregroundAlpha
            ), background.getRed(
                &backgroundRed,
                green: &backgroundGreen,
                blue: &backgroundBlue,
                alpha: &backgroundAlpha
            ) else {
                return background
            }
            let blend: CGFloat = 0.12
            return UIColor(
                red: foregroundRed * blend + backgroundRed * (1 - blend),
                green: foregroundGreen * blend + backgroundGreen * (1 - blend),
                blue: foregroundBlue * blend + backgroundBlue * (1 - blend),
                alpha: 1
            )
        }
        let row = UIStackView()
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = -7
        row.translatesAutoresizingMaskIntoConstraints = false
        for symbol in symbols {
            let circle = UIView()
            circle.backgroundColor = circleFill
            circle.layer.cornerRadius = 27
            circle.translatesAutoresizingMaskIntoConstraints = false
            let image = UIImageView(image: UIImage(systemName: symbol))
            image.tintColor = accent
            image.contentMode = .scaleAspectFit
            image.translatesAutoresizingMaskIntoConstraints = false
            circle.addSubview(image)
            NSLayoutConstraint.activate([
                circle.widthAnchor.constraint(equalToConstant: 54),
                circle.heightAnchor.constraint(equalToConstant: 54),
                image.centerXAnchor.constraint(equalTo: circle.centerXAnchor),
                image.centerYAnchor.constraint(equalTo: circle.centerYAnchor),
                image.widthAnchor.constraint(equalToConstant: 27),
                image.heightAnchor.constraint(equalToConstant: 27)
            ])
            row.addArrangedSubview(circle)
        }
        let container = UIView()
        container.addSubview(row)
        NSLayoutConstraint.activate([
            container.heightAnchor.constraint(equalToConstant: 54),
            row.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            row.topAnchor.constraint(equalTo: container.topAnchor),
            row.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])
        return container
    }

    private func flightField(symbol: String, text: String) -> UITextField {
        let field = UITextField()
        field.placeholder = text
        field.text = text == "Flight Number" || text == "Date" ? nil : text
        field.font = .systemFont(ofSize: 17)
        field.backgroundColor = .secondarySystemFill
        field.layer.cornerRadius = 12
        field.setPadding(44)
        let iconContainer = UIView(frame: CGRect(x: 0, y: 0, width: 44, height: 44))
        let icon = UIImageView(image: UIImage(systemName: symbol))
        icon.tintColor = .label
        icon.frame = CGRect(x: 10, y: 0, width: 24, height: 44)
        icon.contentMode = .center
        iconContainer.addSubview(icon)
        field.leftView = iconContainer
        field.leftViewMode = .always
        field.heightAnchor.constraint(equalToConstant: 44).isActive = true
        return field
    }

    @objc private func clearSelectedAirline() {
        view.endEditing(true)
        verticalCalendar?.removeFromSuperview()
        matchedFlightView?.removeFromSuperview()
        flightSuggestion?.removeFromSuperview()
        arrivalPrompt?.removeFromSuperview()
        flightEntryView?.removeFromSuperview()
        selectedAirline = nil
        inferredFlightNumber = nil
        airlineResults = []
        completions = []
        searchField.text = nil
        searchField.isHidden = false
        forwardingCard.isHidden = false
        resultsTable.isHidden = true
        resultsTable.reloadData()
        searchField.becomeFirstResponder()
    }

    private func makeFlightSuggestion() -> UIView {
        let icon = UILabel()
        icon.text = selectedAirline?.codes.components(separatedBy: " · ").last ?? "✈"
        icon.textColor = AlmidyDesignTokens.Color.goldDark
        icon.font = .systemFont(ofSize: 16, weight: .medium)
        let title = UILabel()
        title.tag = 201
        title.font = .systemFont(ofSize: 20, weight: .semibold)
        let subtitle = UILabel()
        subtitle.text = selectedAirline?.name
        subtitle.font = .systemFont(ofSize: 14)
        subtitle.textColor = .secondaryLabel
        let labels = UIStackView(arrangedSubviews: [title, subtitle])
        labels.axis = .vertical
        let arrow = UIImageView(image: UIImage(systemName: "arrow.up.right"))
        arrow.tintColor = .secondaryLabel
        let row = UIStackView(arrangedSubviews: [icon, labels, UIView(), arrow])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 14
        row.isUserInteractionEnabled = true
        row.accessibilityTraits = .button
        row.accessibilityLabel = "Select \(selectedAirline?.name ?? "flight")"
        row.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(selectFlightSuggestion)))
        return row
    }

    @objc private func selectFlightSuggestion() {
        guard let number = flightNumberField?.text?.trimmingCharacters(in: .whitespacesAndNewlines),
              !number.isEmpty else { return }
        flightNumberField?.text = number
        flightNumberField?.resignFirstResponder()
        flightSuggestion?.isHidden = true
        dateField?.becomeFirstResponder()
    }

    @objc private func flightNumberChanged() {
        let number = flightNumberField?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !number.isEmpty else {
            flightSuggestion?.isHidden = true
            arrivalPrompt?.isHidden = false
            return
        }
        let code = selectedAirline?.codes.components(separatedBy: " · ").last ?? ""
        flightSuggestion?.viewWithTag(201).flatMap { $0 as? UILabel }?.text = "\(code) \(number)"
        flightSuggestion?.isHidden = false
        arrivalPrompt?.isHidden = true
    }

    func textFieldShouldBeginEditing(_ textField: UITextField) -> Bool {
        guard textField.tag == 101 else { return true }
        view.endEditing(true)
        showCalendar()
        return false
    }

    private func showCalendar() {
        verticalCalendar?.removeFromSuperview()
        flightSuggestion?.isHidden = true
        arrivalPrompt?.isHidden = true
        let calendarView = NativeVerticalCalendarView()
        calendarView.onSelectDate = { [weak self, weak calendarView] date in
            self?.selectCalendarDate(date)
            calendarView?.removeFromSuperview()
        }
        calendarView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(calendarView)
        verticalCalendar = calendarView
        NSLayoutConstraint.activate([
            calendarView.topAnchor.constraint(equalTo: dateField!.bottomAnchor, constant: 8),
            calendarView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            calendarView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            calendarView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
    }

    private func selectCalendarDate(_ date: Date) {
        selectedDate = date
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        dateField?.text = formatter.string(from: date)
        showMatchedFlight(on: date)
    }

    private func showFlightEmptyState() {
        guard emptySearchPrompt == nil, selectedAirline == nil else { return }
        resultsTable.isHidden = true

        func makeSymbolBadge(_ systemName: String) -> UIView {
            let badge = UIView()
            badge.translatesAutoresizingMaskIntoConstraints = false
            badge.backgroundColor = AlmidyDesignTokens.Color.goldMutedSurface
            badge.layer.cornerRadius = 27

            let imageView = UIImageView(image: UIImage(systemName: systemName))
            imageView.translatesAutoresizingMaskIntoConstraints = false
            imageView.tintColor = AlmidyDesignTokens.Color.goldDark
            imageView.contentMode = .scaleAspectFit
            badge.addSubview(imageView)

            NSLayoutConstraint.activate([
                badge.widthAnchor.constraint(equalToConstant: 54),
                badge.heightAnchor.constraint(equalToConstant: 54),
                imageView.centerXAnchor.constraint(equalTo: badge.centerXAnchor),
                imageView.centerYAnchor.constraint(equalTo: badge.centerYAnchor),
                imageView.widthAnchor.constraint(equalToConstant: 27),
                imageView.heightAnchor.constraint(equalToConstant: 27)
            ])
            return badge
        }

        let symbols = UIStackView(arrangedSubviews: [
            makeSymbolBadge("calendar"),
            makeSymbolBadge("airplane"),
            makeSymbolBadge("clock")
        ])
        symbols.axis = .horizontal
        symbols.spacing = -7
        symbols.alignment = .center
        let heading = UILabel()
        heading.text = "Search Flight"
        heading.font = .systemFont(ofSize: 24, weight: .semibold)
        heading.textAlignment = .center
        let detail = UILabel()
        detail.text = "Search by Airport, Airline, or Flight Number. If it’s not a commercial flight, add it manually."
        detail.font = .systemFont(ofSize: 16)
        detail.textColor = .secondaryLabel
        detail.textAlignment = .center
        detail.numberOfLines = 3
        let manual = UIButton(type: .system)
        manual.setTitle("Enter manually", for: .normal)
        manual.setTitleColor(AlmidyDesignTokens.Color.goldDark, for: .normal)
        manual.titleLabel?.font = .systemFont(ofSize: 18, weight: .semibold)
        manual.addTarget(self, action: #selector(openManualFlightRoute), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [symbols, heading, detail, manual])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 0
        stack.setCustomSpacing(28, after: symbols)
        stack.setCustomSpacing(16, after: heading)
        stack.setCustomSpacing(18, after: detail)
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        emptySearchPrompt = stack
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: searchField.bottomAnchor, constant: 40),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 56),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -56),
            detail.widthAnchor.constraint(lessThanOrEqualToConstant: 300)
        ])
        searchField.becomeFirstResponder()
    }

    private func showMatchedFlight(on date: Date) {
        matchedFlightView?.removeFromSuperview()
        flightSuggestion?.isHidden = true
        arrivalPrompt?.isHidden = true
        let airline = selectedAirline?.name ?? "Airline"
        let code = selectedAirline?.codes.components(separatedBy: " · ").last ?? ""
        let number = flightNumberField?.text ?? ""
        let dayFormatter = DateFormatter()
        dayFormatter.dateFormat = "EEE, MMM d"

        let airlineLabel = UILabel()
        airlineLabel.text = airline
        airlineLabel.font = .systemFont(ofSize: 19, weight: .semibold)
        let route = UILabel()
        route.text = "Flight details will be confirmed when you save."
        route.font = .systemFont(ofSize: 15)
        route.textColor = .secondaryLabel
        route.numberOfLines = 2
        let dateLabel = UILabel()
        dateLabel.text = "\(dayFormatter.string(from: date))\n\(code)\(number)"
        dateLabel.textColor = .secondaryLabel
        dateLabel.font = .systemFont(ofSize: 16, weight: .medium)
        dateLabel.textAlignment = .right
        dateLabel.numberOfLines = 2
        let left = UIStackView(arrangedSubviews: [airlineLabel, route])
        left.axis = .vertical
        left.spacing = 8
        let row = UIStackView(arrangedSubviews: [left, UIView(), dateLabel])
        row.axis = .horizontal
        row.alignment = .center
        let question = UILabel()
        question.text = "Unable to find what you want?"
        question.textColor = .secondaryLabel
        question.font = .systemFont(ofSize: 16)
        let manual = UIButton(type: .system)
        manual.setTitle("Enter manually", for: .normal)
        manual.setTitleColor(AlmidyDesignTokens.Color.goldDark, for: .normal)
        manual.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        manual.addTarget(self, action: #selector(openManualFlightRoute), for: .touchUpInside)
        let footer = UIStackView(arrangedSubviews: [question, UIView(), manual])
        footer.axis = .horizontal
        let container = UIStackView(arrangedSubviews: [row, footer])
        container.axis = .vertical
        container.spacing = 20
        container.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(container)
        matchedFlightView = container
        container.accessibilityIdentifier = "native-flight-match"
        NSLayoutConstraint.activate([
            container.topAnchor.constraint(equalTo: dateField!.bottomAnchor, constant: 20),
            container.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            container.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16)
        ])
    }

    @objc private func openManualFlightRoute() {
        let controller = NativeManualFlightRouteViewController(
            accent: accent,
            tripID: tripID,
            initialCompany: selectedAirline?.name,
            initialAirlineIATACode: selectedAirline.flatMap { Self.threeLetterAirlineCode(in: $0.codes) },
            initialTransportNumber: flightNumberField?.text,
            initialDepartureDate: selectedDate,
            onSubmitFlight: onSubmitFlight,
            onFlightSaved: onFlightSaved
        )
        controller.modalPresentationStyle = .pageSheet
        if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
            sheet.prefersGrabberVisible = false
            sheet.preferredCornerRadius = 34
        }
        present(controller, animated: true)
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        if textField === searchField {
            guard tableView(resultsTable, numberOfRowsInSection: 0) > 0 else { return false }
            tableView(resultsTable, didSelectRowAt: IndexPath(row: 0, section: 0))
            return true
        }
        if textField.tag == 100 {
            selectFlightSuggestion()
            return true
        }
        textField.resignFirstResponder()
        return true
    }

    private static func airlineCodes(in codes: String) -> [String] {
        codes.components(separatedBy: " · ")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() }
            .filter { !$0.isEmpty }
    }

    private static func threeLetterAirlineCode(in codes: String) -> String? {
        airlineCodes(in: codes).first { $0.range(of: "^[A-Z]{3}$", options: .regularExpression) != nil }
    }

    private static func flightNumberComponent(in query: String) -> String? {
        let compact = query.uppercased().filter { $0.isLetter || $0.isNumber }
        guard let firstDigit = compact.firstIndex(where: \.isNumber) else { return nil }
        let number = String(compact[firstDigit...])
        return number.isEmpty ? nil : number
    }
}

final class NativeManualFlightRouteViewController: UIViewController,
    UIDocumentPickerDelegate, PHPickerViewControllerDelegate, UIImagePickerControllerDelegate,
    UINavigationControllerDelegate {
    private enum RouteKind {
        case flight
        case car
        case train
        case carRental
        case transfer
        case cruise
        case walk
        case bus
        case bike
        case ferry
        case motorcycle
        case location

        init(transportationKind: TransportationActivityDraft.Kind) {
            switch transportationKind {
            case .flight: self = .flight
            case .car: self = .car
            case .train: self = .train
            case .carRental: self = .carRental
            case .transfer: self = .transfer
            case .cruise: self = .cruise
            case .walk: self = .walk
            case .bus: self = .bus
            case .bike: self = .bike
            case .ferry: self = .ferry
            case .motorcycle: self = .motorcycle
            }
        }

        var transportationKind: TransportationActivityDraft.Kind? {
            switch self {
            case .flight: return .flight
            case .car: return .car
            case .train: return .train
            case .carRental: return .carRental
            case .transfer: return .transfer
            case .cruise: return .cruise
            case .walk: return .walk
            case .bus: return .bus
            case .bike: return .bike
            case .ferry: return .ferry
            case .motorcycle: return .motorcycle
            case .location: return nil
            }
        }

        var title: String {
            switch self {
            case .flight: return "Flight Route"
            case .car: return "Car Route"
            case .train: return "Train Route"
            case .carRental: return "Car Rental"
            case .transfer: return "Transfer Route"
            case .cruise: return "Cruise Route"
            case .walk: return "Walk Route"
            case .bus: return "Bus Route"
            case .bike: return "Bike Route"
            case .ferry: return "Ferry Route"
            case .motorcycle: return "Motorcycle Route"
            case .location: return "Location"
            }
        }
    }

    private let accent: UIColor
    private let routeKind: RouteKind
    private let tripID: String?
    private let initialCompany: String?
    private let initialAirlineIATACode: String?
    private let initialTransportNumber: String?
    private let initialDepartureDate: Date?
    private let initialDraft: TransportationActivityDraft?
    private let initialLocationMapItem: MKMapItem?
    private let initialLocationCategory: String?
    private let savedPlaceSegmentID: String?
    private let onSubmitSavedPlace: ((NativeSavedPlaceDetailDraft, @escaping (Result<Void, Error>) -> Void) -> Void)?
    private let onSavedPlaceUpdated: (() -> Void)?
    private let onSubmitFlight: NativeFlightDraftSubmission?
    private let onFlightSaved: (() -> Void)?
    private weak var saveButton: UIButton?
    private let submissionStatusLabel = UILabel()
    private var primaryFields: [String: UITextField] = [:]
    private var detailFields: [String: UITextField] = [:]
    private weak var totalCostLabel: UILabel?
    private weak var noteLabel: UILabel?
    private weak var attachmentLabel: UILabel?
    private weak var departureButton: UIButton?
    private weak var arrivalButton: UIButton?
    private weak var departureEditIcon: UIImageView?
    private weak var arrivalEditIcon: UIImageView?
    private weak var invertRouteCard: UIView?
    private weak var distanceCard: UIView?
    private weak var distanceValueLabel: UILabel?
    private weak var departureDateButton: UIButton?
    private weak var arrivalDateButton: UIButton?
    private weak var departureTimeButton: UIButton?
    private weak var arrivalTimeButton: UIButton?
    private var departureDate: Date?
    private var arrivalDate: Date?
    private var departureTime: Date?
    private var arrivalTime: Date?
    private var departureLocation: MKMapItem?
    private var arrivalLocation: MKMapItem?
    private var totalCost: TransportationActivityDraft.Money?
    private var note: String?
    private var attachments: [TransportationActivityDraft.Attachment] = []
    private var isSaving = false
    private let savedPlaceAutosaveGeneration = NativeSavedPlaceAutosaveGeneration()
    private var distanceRequest: MKDirections?
    private let nearbyCoordinate: CLLocationCoordinate2D?
    init(accent: UIColor, transportKind: TransportationActivityDraft.Kind? = nil, isCarRoute: Bool = false, isTrainRoute: Bool = false, isCarRental: Bool = false, isTransferRoute: Bool = false, isCruiseRoute: Bool = false, isWalkRoute: Bool = false, isBusRoute: Bool = false, isBikeRoute: Bool = false, isFerryRoute: Bool = false, isMotorcycleRoute: Bool = false, isLocation: Bool = false, nearbyCoordinate: CLLocationCoordinate2D? = nil, tripID: String? = nil, initialCompany: String? = nil, initialAirlineIATACode: String? = nil, initialTransportNumber: String? = nil, initialDepartureDate: Date? = nil, initialDraft: TransportationActivityDraft? = nil, initialLocationMapItem: MKMapItem? = nil, initialLocationCategory: String? = nil, savedPlaceSegmentID: String? = nil, onSubmitSavedPlace: ((NativeSavedPlaceDetailDraft, @escaping (Result<Void, Error>) -> Void) -> Void)? = nil, onSavedPlaceUpdated: (() -> Void)? = nil, onSubmitFlight: NativeFlightDraftSubmission? = nil, onFlightSaved: (() -> Void)? = nil) {
        self.accent = accent
        routeKind = transportKind.map(RouteKind.init(transportationKind:))
            ?? (isLocation ? .location : (isMotorcycleRoute ? .motorcycle : (isFerryRoute ? .ferry : (isBikeRoute ? .bike : (isBusRoute ? .bus : (isWalkRoute ? .walk : (isCruiseRoute ? .cruise : (isTransferRoute ? .transfer : (isCarRental ? .carRental : (isTrainRoute ? .train : (isCarRoute ? .car : .flight)))))))))))
        self.nearbyCoordinate = nearbyCoordinate
        self.tripID = tripID
        self.initialCompany = initialCompany
        self.initialAirlineIATACode = initialAirlineIATACode
        self.initialTransportNumber = initialTransportNumber
        self.initialDepartureDate = initialDepartureDate
        self.initialDraft = initialDraft
        self.initialLocationMapItem = initialLocationMapItem
        self.initialLocationCategory = initialLocationCategory
        self.savedPlaceSegmentID = savedPlaceSegmentID
        self.onSubmitSavedPlace = onSubmitSavedPlace
        self.onSavedPlaceUpdated = onSavedPlaceUpdated
        self.onSubmitFlight = onSubmitFlight
        self.onFlightSaved = onFlightSaved
        super.init(nibName: nil, bundle: nil)
    }
    @available(*, unavailable) required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemGroupedBackground
        let back = UIButton(type: .system)
        back.setImage(UIImage(systemName: "chevron.left"), for: .normal)
        back.tintColor = .label
        back.backgroundColor = .systemBackground
        back.layer.cornerRadius = 22
        back.addTarget(self, action: #selector(close), for: .touchUpInside)
        let title = UILabel()
        title.text = routeKind == .location
            ? "\(initialLocationCategory ?? "Place") Details"
            : routeKind.title
        title.font = .systemFont(ofSize: 22, weight: .semibold)
        title.textAlignment = .center
        let save = UIButton(type: .system)
        saveButton = save
        save.setTitle("Save", for: .normal)
        save.isEnabled = false
        save.titleLabel?.font = .systemFont(ofSize: 18, weight: .semibold)
        save.backgroundColor = .tertiarySystemFill
        save.layer.cornerRadius = 20
        save.accessibilityIdentifier = "native-flight-save"
        save.addTarget(self, action: #selector(saveTransportationActivity), for: .touchUpInside)

        let scrollView = UIScrollView()
        scrollView.alwaysBounceVertical = true
        scrollView.keyboardDismissMode = .interactive
        scrollView.showsVerticalScrollIndicator = false
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 14
        submissionStatusLabel.font = .systemFont(ofSize: 15, weight: .medium)
        submissionStatusLabel.textColor = .systemRed
        submissionStatusLabel.numberOfLines = 0
        submissionStatusLabel.textAlignment = .center
        submissionStatusLabel.isHidden = true
        submissionStatusLabel.accessibilityIdentifier = "native-flight-save-status"
        stack.addArrangedSubview(submissionStatusLabel)
        if routeKind == .location {
            let content = NativeSavedPlaceEditorView(
                category: initialLocationCategory ?? "Location",
                accent: accent,
                costAction: actionCard(symbol: "creditcard", title: "Total Cost", action: #selector(openTotalCost)),
                noteAction: actionCard(symbol: "square.and.pencil", title: "Write a note", action: #selector(openNote)),
                attachmentAction: attachmentActionCard(),
                onChangeCategory: { [weak self] in self?.close() },
                onChange: { [weak self] in self?.formValueChanged() },
                onCheckInDate: { [weak self] in self?.openDepartureDate() },
                onCheckInTime: { [weak self] in self?.openDepartureTime() },
                onCheckOutDate: { [weak self] in self?.openArrivalDate() },
                onCheckOutTime: { [weak self] in self?.openArrivalTime() }
            )
            primaryFields = content.primaryFields
            detailFields = content.detailFields
            departureDateButton = content.checkInDateButton
            departureTimeButton = content.checkInTimeButton
            arrivalDateButton = content.checkOutDateButton
            arrivalTimeButton = content.checkOutTimeButton
            stack.addArrangedSubview(content)
        } else if routeKind == .flight {
            let configuration = NativeFlightEditorConfiguration()
            let content = NativeFlightEditorView(
                configuration: configuration,
                initialAirline: initialCompany,
                initialAirlineIATACode: initialAirlineIATACode,
                initialFlightNumber: initialTransportNumber,
                routeSections: [
                    routeCard(title: configuration.departureTitle, footer: "Departure", action: #selector(openDepartureSearch)),
                    routeCard(title: configuration.arrivalTitle, footer: "Arrival", action: #selector(openArrivalSearch)),
                    actionCard(symbol: "arkit", title: "View Flight Route in AR", action: #selector(openFlightARPreview))
                ],
                costAction: actionCard(symbol: "creditcard", title: "Total Cost", action: #selector(openTotalCost)),
                noteAction: actionCard(symbol: "square.and.pencil", title: "Write a note", action: #selector(openNote)),
                attachmentAction: attachmentActionCard(),
                onChange: { [weak self] in self?.formValueChanged() }
            )
            primaryFields = content.primaryFields
            detailFields = content.detailFields
            stack.addArrangedSubview(content)
        } else if let kind = routeKind.transportationKind {
            guard let configuration = NativeTransportationEditorConfiguration(kind: kind) else { return }
            var routeSections: [UIView] = []
            if kind == .carRental {
                routeSections.append(routeCard(title: configuration.departureTitle, footer: "Pick-up", action: #selector(openDepartureSearch)))
                routeSections.append(sameDropOffAddressCard())
                routeSections.append(transportationTimeOnlyCard(footer: "Drop-off"))
            } else {
                routeSections.append(routeCard(title: configuration.departureTitle, footer: "Departure", action: #selector(openDepartureSearch)))
                routeSections.append(routeCard(title: configuration.arrivalTitle, footer: "Arrival", action: #selector(openArrivalSearch)))
                let invert = actionCard(symbol: "arrow.triangle.swap", title: "Invert Route Locations", action: #selector(invertRouteLocations))
                invertRouteCard = invert
                setInvertRouteEnabled(false)
                routeSections.append(invert)
            }
            if kind == .car {
                let routeDistanceCard = makeDistanceCard()
                distanceCard = routeDistanceCard
                routeDistanceCard.isHidden = true
                routeSections.append(routeDistanceCard)
            }
            let content = NativeTransportationEditorView(
                configuration: configuration,
                routeSections: routeSections,
                costAction: actionCard(symbol: "creditcard", title: "Total Cost", action: #selector(openTotalCost)),
                noteAction: actionCard(symbol: "square.and.pencil", title: "Write a note", action: #selector(openNote)),
                attachmentAction: attachmentActionCard(),
                onChange: { [weak self] in self?.formValueChanged() }
            )
            primaryFields = content.primaryFields
            detailFields = content.detailFields
            stack.addArrangedSubview(content)
        }
        [back, title, save, scrollView, stack].forEach { $0.translatesAutoresizingMaskIntoConstraints = false }
        view.addSubview(back); view.addSubview(title); view.addSubview(save)
        view.addSubview(scrollView); scrollView.addSubview(stack)
        NSLayoutConstraint.activate([
            back.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 14), back.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20), back.widthAnchor.constraint(equalToConstant: 44), back.heightAnchor.constraint(equalToConstant: 44),
            title.centerXAnchor.constraint(equalTo: view.centerXAnchor), title.centerYAnchor.constraint(equalTo: back.centerYAnchor),
            save.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20), save.centerYAnchor.constraint(equalTo: back.centerYAnchor), save.widthAnchor.constraint(equalToConstant: 76), save.heightAnchor.constraint(equalToConstant: 40),
            scrollView.topAnchor.constraint(equalTo: back.bottomAnchor, constant: 16),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            stack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -28)
        ])
        if routeKind == .flight, let initialDepartureDate {
            setDepartureDate(initialDepartureDate)
        }
        if let initialDraft {
            apply(initialDraft)
        }
        if routeKind == .location, let initialLocationMapItem {
            applyInitialLocation(initialLocationMapItem)
            save.isHidden = true
        }
        refreshSaveState()
    }

    // MARK: - Initial feature state

    private func applyInitialLocation(_ item: MKMapItem) {
        primaryFields["Name"]?.text = item.name
        primaryFields["Address"]?.text = item.placemark.title
        detailFields["Phone"]?.text = item.phoneNumber
        detailFields["Website"]?.text = item.url?.absoluteString
        departureLocation = item
        arrivalLocation = item
        departureDate = initialDepartureDate ?? Date()
        departureTime = initialDepartureDate
        updateDateButton(departureDateButton, with: departureDate)
        updateTimeButton(departureTimeButton, with: departureTime)
    }

    private func apply(_ draft: TransportationActivityDraft) {
        primaryFields["Company"]?.text = draft.company
        primaryFields["Transport Number"]?.text = draft.transportNumber
        primaryFields["Airline"]?.text = draft.flight?.provider.name ?? draft.company
        primaryFields["Airline IATA Code"]?.text = draft.flight?.provider.iataCode
        primaryFields["Flight Number"]?.text = draft.flight?.flightNumber ?? draft.transportNumber
        primaryFields["Route Name"]?.text = draft.title
        primaryFields["Name"]?.text = draft.title
        detailFields["Reservation Code"]?.text = draft.reservation.confirmationCode
        detailFields["Seat"]?.text = draft.reservation.seat
        detailFields["Seat Class"]?.text = draft.reservation.seatClass
        detailFields["Coach Number"]?.text = draft.reservation.coachNumber
        detailFields["Vehicle"]?.text = draft.reservation.vehicle
        detailFields["Train Type"]?.text = draft.reservation.serviceType
        detailFields["Phone"]?.text = draft.reservation.phone
        detailFields["Website"]?.text = draft.reservation.website?.absoluteString
        detailFields["Departure Terminal"]?.text = draft.flight?.departureTerminal
        detailFields["Departure Airport Code"]?.text = draft.flight?.departureAirport.iataCode
        detailFields["Departure Gate"]?.text = draft.flight?.departureGate
        detailFields["Arrival Terminal"]?.text = draft.flight?.arrivalTerminal
        detailFields["Arrival Airport Code"]?.text = draft.flight?.arrivalAirport.iataCode
        detailFields["Arrival Gate"]?.text = draft.flight?.arrivalGate
        departureDate = draft.startAt.map { Calendar.current.startOfDay(for: $0) }
        departureTime = draft.startAt
        arrivalDate = draft.endAt.map { Calendar.current.startOfDay(for: $0) }
        arrivalTime = draft.endAt
        updateDateButton(departureDateButton, with: departureDate)
        updateTimeButton(departureTimeButton, with: departureTime)
        updateDateButton(arrivalDateButton, with: arrivalDate)
        updateTimeButton(arrivalTimeButton, with: arrivalTime)
        if let location = draft.departure {
            departureLocation = mapItem(
                from: location,
                timeZoneIdentifier: draft.flight?.departureAirport.timeZoneIdentifier
            )
            renderSelectedLocation(departureLocation!, button: departureButton, icon: departureEditIcon)
        }
        if let location = draft.arrival {
            arrivalLocation = mapItem(
                from: location,
                timeZoneIdentifier: draft.flight?.arrivalAirport.timeZoneIdentifier
            )
            renderSelectedLocation(arrivalLocation!, button: arrivalButton, icon: arrivalEditIcon)
        }
        note = draft.note
        noteLabel?.text = draft.note == nil ? "Write a note" : "Note added"
        refreshRouteDistance()
    }

    private func mapItem(
        from location: TransportationActivityDraft.Location,
        timeZoneIdentifier: String? = nil
    ) -> MKMapItem {
        let coordinate = CLLocationCoordinate2D(latitude: location.latitude ?? 0, longitude: location.longitude ?? 0)
        let placemark = MKPlacemark(coordinate: coordinate)
        let item = MKMapItem(placemark: placemark)
        item.name = location.name
        if let timeZoneIdentifier {
            item.timeZone = TimeZone(identifier: timeZoneIdentifier)
        }
        return item
    }

    private func routeCard(title: String, footer: String, action: Selector) -> UIView {
        let addIcon: UIView
        if routeKind != .flight {
            let icon = UIImageView(image: UIImage(systemName: "plus"))
            icon.tintColor = AlmidyDesignTokens.Color.goldDark
            icon.contentMode = .center
            if footer == "Departure" || footer == "Pick-up" { departureEditIcon = icon } else { arrivalEditIcon = icon }
            addIcon = icon
        } else {
            let icon = UILabel()
            icon.text = "+"
            icon.textAlignment = .center
            icon.textColor = AlmidyDesignTokens.Color.goldDark
            icon.font = .systemFont(ofSize: 27)
            addIcon = icon
        }
        addIcon.backgroundColor = AlmidyDesignTokens.Color.goldDark.withAlphaComponent(0.12)
        addIcon.layer.cornerRadius = 24
        addIcon.clipsToBounds = true
        addIcon.widthAnchor.constraint(equalToConstant: 48).isActive = true
        addIcon.heightAnchor.constraint(equalToConstant: 48).isActive = true
        addIcon.setContentHuggingPriority(.required, for: .horizontal)
        addIcon.setContentCompressionResistancePriority(.required, for: .horizontal)
        addIcon.setContentCompressionResistancePriority(.required, for: .vertical)
        let add = UIButton(type: .system); add.setTitle(title, for: .normal); add.setTitleColor(AlmidyDesignTokens.Color.goldDark, for: .normal); add.titleLabel?.font = .systemFont(ofSize: 18, weight: .semibold); add.contentHorizontalAlignment = .leading; add.isUserInteractionEnabled = false
        if footer == "Departure" || footer == "Pick-up" { departureButton = add } else { arrivalButton = add }
        let addRow = UIStackView(arrangedSubviews: [addIcon, add]); addRow.axis = .horizontal; addRow.alignment = .center; addRow.spacing = 14
        addRow.isUserInteractionEnabled = true
        addRow.accessibilityTraits = .button
        addRow.accessibilityLabel = title
        addRow.addGestureRecognizer(UITapGestureRecognizer(target: self, action: action))
        let separator = UIView(); separator.backgroundColor = .separator; separator.heightAnchor.constraint(equalToConstant: 0.5).isActive = true
        let footerLabel = UILabel(); footerLabel.text = footer; footerLabel.textColor = .secondaryLabel; footerLabel.font = .systemFont(ofSize: 18, weight: .semibold)
        let date = UIButton(type: .system); date.setTitle("Date", for: .normal); date.tintColor = .label; date.backgroundColor = .secondarySystemFill; date.layer.cornerRadius = 8
        date.contentEdgeInsets = UIEdgeInsets(top: 0, left: 12, bottom: 0, right: 12)
        date.setContentHuggingPriority(.required, for: .horizontal)
        date.setContentCompressionResistancePriority(.required, for: .horizontal)
        if footer == "Departure" || footer == "Pick-up" || footer == "Check-in" {
            departureDateButton = date
            date.addTarget(self, action: #selector(openDepartureDate), for: .touchUpInside)
        } else {
            arrivalDateButton = date
            date.addTarget(self, action: #selector(openArrivalDate), for: .touchUpInside)
        }
        let time = UIButton(type: .system); time.setTitle("Time", for: .normal); time.tintColor = .label; time.backgroundColor = .secondarySystemFill; time.layer.cornerRadius = 8
        time.contentEdgeInsets = UIEdgeInsets(top: 0, left: 12, bottom: 0, right: 12)
        time.setContentHuggingPriority(.required, for: .horizontal)
        time.setContentCompressionResistancePriority(.required, for: .horizontal)
        if footer == "Departure" || footer == "Pick-up" || footer == "Check-in" {
            departureTimeButton = time
            time.addTarget(self, action: #selector(openDepartureTime), for: .touchUpInside)
        } else {
            arrivalTimeButton = time
            time.addTarget(self, action: #selector(openArrivalTime), for: .touchUpInside)
        }
        date.widthAnchor.constraint(greaterThanOrEqualToConstant: 60).isActive = true
        time.widthAnchor.constraint(greaterThanOrEqualToConstant: 60).isActive = true
        let row = UIStackView(arrangedSubviews: [footerLabel, UIView(), date, time]); row.axis = .horizontal; row.spacing = 4
        let stack = UIStackView(arrangedSubviews: [addRow, separator, row]); stack.axis = .vertical; stack.spacing = 10; stack.backgroundColor = .systemBackground; stack.layer.cornerRadius = 18; stack.isLayoutMarginsRelativeArrangement = true; stack.layoutMargins = UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16); row.heightAnchor.constraint(equalToConstant: 38).isActive = true
        return stack
    }

    private func sameDropOffAddressCard() -> UIView {
        let icon = UIImageView(image: UIImage(systemName: "mappin.and.ellipse"))
        icon.tintColor = .secondaryLabel
        icon.contentMode = .scaleAspectFit
        icon.widthAnchor.constraint(equalToConstant: 28).isActive = true
        icon.heightAnchor.constraint(equalToConstant: 28).isActive = true
        let label = UILabel()
        label.text = "Same Drop-off Address"
        label.textColor = .secondaryLabel
        label.font = .systemFont(ofSize: 19, weight: .semibold)
        let toggle = UISwitch()
        toggle.isOn = true
        toggle.onTintColor = accent
        toggle.accessibilityLabel = "Same drop-off address"
        let row = UIStackView(arrangedSubviews: [icon, label, UIView(), toggle])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 18
        row.backgroundColor = .systemBackground
        row.layer.cornerRadius = 18
        row.isLayoutMarginsRelativeArrangement = true
        row.layoutMargins = UIEdgeInsets(top: 15, left: 18, bottom: 15, right: 18)
        row.heightAnchor.constraint(equalToConstant: 64).isActive = true
        return row
    }

    private func transportationTimeOnlyCard(footer: String) -> UIView {
        let footerLabel = UILabel()
        footerLabel.text = footer
        footerLabel.textColor = .secondaryLabel
        footerLabel.font = .systemFont(ofSize: 18, weight: .semibold)
        let date = UIButton(type: .system)
        date.setTitle("Date", for: .normal)
        date.tintColor = .label
        date.backgroundColor = .secondarySystemFill
        date.layer.cornerRadius = 8
        date.contentEdgeInsets = UIEdgeInsets(top: 0, left: 12, bottom: 0, right: 12)
        date.addTarget(self, action: #selector(openArrivalDate), for: .touchUpInside)
        arrivalDateButton = date
        let time = UIButton(type: .system)
        time.setTitle("Time", for: .normal)
        time.tintColor = .label
        time.backgroundColor = .secondarySystemFill
        time.layer.cornerRadius = 8
        time.contentEdgeInsets = UIEdgeInsets(top: 0, left: 12, bottom: 0, right: 12)
        time.addTarget(self, action: #selector(openArrivalTime), for: .touchUpInside)
        arrivalTimeButton = time
        date.widthAnchor.constraint(greaterThanOrEqualToConstant: 60).isActive = true
        time.widthAnchor.constraint(greaterThanOrEqualToConstant: 60).isActive = true
        let row = UIStackView(arrangedSubviews: [footerLabel, UIView(), date, time])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 4
        row.backgroundColor = .systemBackground
        row.layer.cornerRadius = 18
        row.isLayoutMarginsRelativeArrangement = true
        row.layoutMargins = UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16)
        row.heightAnchor.constraint(equalToConstant: 64).isActive = true
        return row
    }

    // MARK: - Save state and Saved Place autosave

    @objc private func formValueChanged() {
        submissionStatusLabel.isHidden = true
        refreshSaveState()
        scheduleSavedPlaceUpdate()
    }

    private func refreshSaveState() {
        guard routeKind.transportationKind != nil, !isSaving else {
            saveButton?.isEnabled = false
            saveButton?.backgroundColor = .tertiarySystemFill
            return
        }
        let enabled = transportationDraft() != nil && onSubmitFlight != nil
        saveButton?.isEnabled = enabled
        saveButton?.backgroundColor = enabled ? accent : .tertiarySystemFill
        saveButton?.setTitleColor(enabled ? .white : .tertiaryLabel, for: .normal)
        saveButton?.accessibilityTraits = enabled ? .button : [.button, .notEnabled]
    }

    private func savedPlaceDraft() -> NativeSavedPlaceDetailDraft? {
        guard routeKind == .location,
              let title = clean(primaryFields["Name"]?.text) else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let start = combinedDate(
            day: departureDate,
            time: departureTime ?? departureDate,
            timeZone: NativeTimeZonePreference.timeZone
        )
        let end = combinedDate(
            day: arrivalDate,
            time: arrivalTime ?? arrivalDate,
            timeZone: NativeTimeZonePreference.timeZone
        )
        let website = clean(detailFields["Website"]?.text)
        return NativeSavedPlaceDetailDraft(
            title: title,
            location: clean(primaryFields["Address"]?.text),
            startTime: start.map { formatter.string(from: $0) },
            endTime: end.map { formatter.string(from: $0) },
            bookingUrl: website,
            confirmationCode: clean(detailFields["Reservation Code"]?.text),
            notes: note,
            reservation: .init(
                phone: clean(detailFields["Phone"]?.text),
                website: website,
                costAmount: totalCost?.amount,
                costCurrency: totalCost?.currency,
                links: attachments.compactMap { attachment in
                    attachment.kind == .link ? attachment.sourceURL.absoluteString : nil
                }
            )
        )
    }

    private func scheduleSavedPlaceUpdate(delay: TimeInterval = 0.45) {
        guard savedPlaceSegmentID != nil, onSubmitSavedPlace != nil else { return }
        let generation = savedPlaceAutosaveGeneration.advance()
        submissionStatusLabel.isHidden = false
        submissionStatusLabel.textColor = .secondaryLabel
        submissionStatusLabel.text = "Unsaved changes…"
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self, self.savedPlaceAutosaveGeneration.isCurrent(generation),
                  !self.isSaving, let draft = self.savedPlaceDraft(),
                  let submit = self.onSubmitSavedPlace else { return }
            self.isSaving = true
            self.submissionStatusLabel.text = "Saving place details…"
            submit(draft) { [weak self] result in
                guard let self else { return }
                self.isSaving = false
                guard self.savedPlaceAutosaveGeneration.isCurrent(generation) else {
                    self.scheduleSavedPlaceUpdate(delay: 0)
                    return
                }
                switch result {
                case .success:
                    self.submissionStatusLabel.textColor = .systemGreen
                    self.submissionStatusLabel.text = "Place details saved"
                    self.onSavedPlaceUpdated?()
                    UIAccessibility.post(notification: .announcement, argument: "Place details saved")
                case .failure(let error):
                    self.submissionStatusLabel.textColor = .systemRed
                    self.submissionStatusLabel.text = self.saveErrorMessage(error)
                    UIAccessibility.post(notification: .announcement, argument: self.submissionStatusLabel.text)
                }
            }
        }
    }

    // MARK: - Flight and Transportation domain drafts

    private func transportationDraft() -> TransportationActivityDraft? {
        guard let kind = routeKind.transportationKind,
              let tripID,
              let departureLocation else { return nil }
        let resolvedArrival = routeKind == .carRental ? departureLocation : arrivalLocation
        guard let resolvedArrival else { return nil }
        let departureTimeZone = departureLocation.timeZone ?? .current
        let arrivalTimeZone = resolvedArrival.timeZone ?? .current
        guard let startAt = combinedDate(
                  day: departureDate,
                  time: departureTime,
                  timeZone: kind == .flight ? departureTimeZone : .current
              ),
              let endAt = combinedDate(
                  day: arrivalDate,
                  time: arrivalTime,
                  timeZone: kind == .flight ? arrivalTimeZone : .current
              ),
              endAt >= startAt else { return nil }
        let company = clean(primaryFields[kind == .flight ? "Airline" : "Company"]?.text)
        let number = clean(primaryFields[kind == .flight ? "Flight Number" : "Transport Number"]?.text)
        let airlineCode = validatedAirlineCode(primaryFields["Airline IATA Code"]?.text)
        let departureAirportCode = validatedAirportCode(detailFields["Departure Airport Code"]?.text)
        let arrivalAirportCode = validatedAirportCode(detailFields["Arrival Airport Code"]?.text)
        let enteredTitle = clean(primaryFields["Route Name"]?.text)
            ?? clean(primaryFields["Name"]?.text)
        let title: String
        if kind == .flight {
            guard let company, let number, airlineCode != nil,
                  departureAirportCode != nil, arrivalAirportCode != nil else { return nil }
            title = "\(company) \(number)"
        } else {
            guard let enteredTitle else { return nil }
            title = enteredTitle
        }
        let departureName = clean(departureLocation.name) ?? "Departure"
        let arrivalName = clean(resolvedArrival.name) ?? "Arrival"
        let departureDraft = draftLocation(from: departureLocation, fallbackName: departureName)
        let arrivalDraft = draftLocation(from: resolvedArrival, fallbackName: arrivalName)
        let flightDetails: TransportationActivityDraft.FlightDetails?
        if kind == .flight,
           let company,
           let number,
           let airlineCode,
           let departureAirportCode,
           let arrivalAirportCode {
            flightDetails = .init(
                provider: .init(name: company, iataCode: airlineCode),
                flightNumber: number,
                departureAirport: .init(
                    iataCode: departureAirportCode,
                    name: departureDraft.name,
                    address: postalAddress(from: departureDraft),
                    location: departureDraft,
                    timeZoneIdentifier: departureTimeZone.identifier
                ),
                arrivalAirport: .init(
                    iataCode: arrivalAirportCode,
                    name: arrivalDraft.name,
                    address: postalAddress(from: arrivalDraft),
                    location: arrivalDraft,
                    timeZoneIdentifier: arrivalTimeZone.identifier
                ),
                departureTime: startAt,
                arrivalTime: endAt,
                departureTerminal: clean(detailFields["Departure Terminal"]?.text),
                departureGate: clean(detailFields["Departure Gate"]?.text),
                arrivalTerminal: clean(detailFields["Arrival Terminal"]?.text),
                arrivalGate: clean(detailFields["Arrival Gate"]?.text)
            )
        } else {
            flightDetails = nil
        }
        return TransportationActivityDraft(
            tripID: tripID,
            kind: kind,
            title: title,
            company: company,
            transportNumber: number,
            departure: departureDraft,
            arrival: arrivalDraft,
            startAt: startAt,
            endAt: endAt,
            reservation: .init(
                confirmationCode: clean(detailFields["Reservation Code"]?.text),
                seat: clean(detailFields["Seat"]?.text),
                seatClass: clean(detailFields["Seat Class"]?.text),
                coachNumber: clean(detailFields["Coach Number"]?.text),
                vehicle: clean(detailFields["Vehicle"]?.text),
                serviceType: clean(detailFields["Train Type"]?.text),
                phone: clean(detailFields["Phone"]?.text),
                website: clean(detailFields["Website"]?.text).flatMap(URL.init(string:))
            ),
            cost: totalCost,
            note: note,
            attachments: attachments,
            flight: flightDetails
        )
    }

    private func draftLocation(
        from item: MKMapItem,
        fallbackName: String
    ) -> TransportationActivityDraft.Location {
        let coordinate = item.placemark.coordinate
        return .init(
            name: clean(item.name) ?? fallbackName,
            address: clean(fullAddress(for: item.placemark)),
            latitude: CLLocationCoordinate2DIsValid(coordinate) ? coordinate.latitude : nil,
            longitude: CLLocationCoordinate2DIsValid(coordinate) ? coordinate.longitude : nil,
            streetAddress: clean([item.placemark.subThoroughfare, item.placemark.thoroughfare]
                .compactMap { $0 }.joined(separator: " ")),
            addressLocality: clean(item.placemark.locality),
            addressRegion: clean(item.placemark.administrativeArea),
            postalCode: clean(item.placemark.postalCode),
            addressCountry: clean(item.placemark.country)
        )
    }

    private func combinedDate(day: Date?, time: Date?, timeZone: TimeZone) -> Date? {
        guard let day, let time else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let components = calendar.dateComponents(in: timeZone, from: time)
        return calendar.date(
            bySettingHour: components.hour ?? 0,
            minute: components.minute ?? 0,
            second: 0,
            of: day
        )
    }

    private func clean(_ value: String?) -> String? {
        let value = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return value.isEmpty ? nil : value
    }

    private func validatedAirlineCode(_ value: String?) -> String? {
        guard let code = clean(value)?.uppercased(),
              code.range(of: "^[A-Z]{3}$", options: .regularExpression) != nil else { return nil }
        return code
    }

    private func validatedAirportCode(_ value: String?) -> String? {
        guard let code = clean(value)?.uppercased(),
              code.range(of: "^[A-Z]{3}$", options: .regularExpression) != nil else { return nil }
        return code
    }

    // MARK: - Flight AR

    @objc private func openFlightARPreview() {
        guard let departureLocation, let arrivalLocation else {
            let alert = UIAlertController(
                title: "Choose Both Airports",
                message: "Add departure and arrival airports before opening the AR route.",
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            present(alert, animated: true)
            return
        }
        guard ARWorldTrackingConfiguration.isSupported else {
            let alert = UIAlertController(
                title: "AR Unavailable",
                message: "This device can still show the flight route on the map, but it does not support ARKit world tracking.",
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            present(alert, animated: true)
            return
        }
        let controller = NativeFlightARPreviewViewController(
            departure: departureLocation,
            arrival: arrivalLocation,
            accent: accent
        )
        controller.modalPresentationStyle = .fullScreen
        present(controller, animated: true)
    }

    private func postalAddress(
        from location: TransportationActivityDraft.Location
    ) -> TransportationActivityDraft.FlightDetails.Airport.PostalAddress? {
        let address = TransportationActivityDraft.FlightDetails.Airport.PostalAddress(
            streetAddress: location.streetAddress,
            addressLocality: location.addressLocality,
            addressRegion: location.addressRegion,
            postalCode: location.postalCode,
            addressCountry: location.addressCountry
        )
        return [address.streetAddress, address.addressLocality, address.addressRegion, address.postalCode, address.addressCountry]
            .contains(where: { $0 != nil }) ? address : nil
    }

    @objc private func saveTransportationActivity() {
        guard !isSaving, let draft = transportationDraft(), let onSubmitFlight else {
            refreshSaveState()
            return
        }
        isSaving = true
        submissionStatusLabel.isHidden = false
        submissionStatusLabel.textColor = .secondaryLabel
        submissionStatusLabel.text = "Saving activity…"
        saveButton?.setTitle("Saving…", for: .normal)
        saveButton?.isEnabled = false
        view.isUserInteractionEnabled = false
        view.accessibilityViewIsModal = true
        UIAccessibility.post(notification: .announcement, argument: "Saving activity")

        onSubmitFlight(draft) { [weak self] result in
            guard let self else { return }
            isSaving = false
            view.isUserInteractionEnabled = true
            saveButton?.setTitle("Save", for: .normal)
            switch result {
            case .success:
                submissionStatusLabel.textColor = .secondaryLabel
                submissionStatusLabel.text = "Activity saved"
                UIAccessibility.post(notification: .announcement, argument: "Activity saved")
                if let onFlightSaved {
                    onFlightSaved()
                } else {
                    dismiss(animated: true)
                }
            case .failure(let error):
                submissionStatusLabel.textColor = .systemRed
                submissionStatusLabel.text = saveErrorMessage(error)
                submissionStatusLabel.isHidden = false
                UIAccessibility.post(notification: .announcement, argument: submissionStatusLabel.text)
                refreshSaveState()
            }
        }
    }

    private func saveErrorMessage(_ error: Error) -> String {
        if case NativeTripStoreError.unauthorized = error {
            return "Your session expired. Sign in again and retry."
        }
        return "Activity couldn’t be saved. Check your connection and try again."
    }

    // MARK: - Shared feature composition factories

    private func actionCard(symbol: String, title: String, action: Selector? = nil) -> UIView {
        let icon = UIImageView(image: UIImage(systemName: symbol))
        icon.tintColor = .secondaryLabel
        icon.contentMode = .scaleAspectFit
        icon.widthAnchor.constraint(equalToConstant: 28).isActive = true
        icon.heightAnchor.constraint(equalToConstant: 28).isActive = true
        let label = UILabel()
        label.text = title
        label.textColor = .secondaryLabel
        label.font = .systemFont(ofSize: 19, weight: .semibold)
        if title == "Total Cost" { totalCostLabel = label }
        if title == "Write a note" { noteLabel = label }
        let row = UIStackView(arrangedSubviews: [icon, label])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 18
        row.backgroundColor = .systemBackground
        row.layer.cornerRadius = 18
        row.isLayoutMarginsRelativeArrangement = true
        row.layoutMargins = UIEdgeInsets(top: 15, left: 18, bottom: 15, right: 18)
        row.heightAnchor.constraint(equalToConstant: 64).isActive = true
        if let action {
            row.isUserInteractionEnabled = true
            row.accessibilityTraits = .button
            row.accessibilityLabel = title
            row.addGestureRecognizer(UITapGestureRecognizer(target: self, action: action))
        }
        return row
    }

    private func makeDistanceCard() -> UIView {
        let title = UILabel()
        title.text = "Distance"
        title.textColor = .secondaryLabel
        title.font = .systemFont(ofSize: 17, weight: .regular)
        let value = UILabel()
        value.textColor = .label
        value.font = .systemFont(ofSize: 17, weight: .regular)
        value.textAlignment = .right
        distanceValueLabel = value
        let row = UIStackView(arrangedSubviews: [title, UIView(), value])
        row.axis = .horizontal
        row.alignment = .center
        row.backgroundColor = .systemBackground
        row.layer.cornerRadius = 18
        row.isLayoutMarginsRelativeArrangement = true
        row.layoutMargins = UIEdgeInsets(top: 15, left: 18, bottom: 15, right: 18)
        row.heightAnchor.constraint(equalToConstant: 64).isActive = true
        row.accessibilityLabel = "Route distance"
        return row
    }

    private func setInvertRouteEnabled(_ enabled: Bool) {
        invertRouteCard?.isUserInteractionEnabled = enabled
        invertRouteCard?.alpha = enabled ? 1 : 0.52
        invertRouteCard?.accessibilityTraits = enabled ? .button : [.button, .notEnabled]
    }

    private func attachmentActionCard() -> UIView {
        let view = NativeAttachmentActionView(
            onImportDocument: { [weak self] in self?.importDocument() },
            onSaveLink: { [weak self] in self?.saveLink() },
            onChoosePhoto: { [weak self] in self?.choosePhoto() },
            onTakePhoto: { [weak self] in self?.takePhoto() }
        )
        attachmentLabel = view.titleLabel
        return view
    }
    @objc private func openTotalCost() {
        let controller = NativeTotalCostInputViewController(accent: accent) { [weak self] amount, currency, displayAmount in
            self?.totalCost = .init(amount: amount, currency: currency)
            self?.totalCostLabel?.text = "Total Cost · \(displayAmount)"
            self?.refreshSaveState()
            self?.scheduleSavedPlaceUpdate()
        }
        NativeTotalCostInputViewController.sheetConfiguration.apply(to: controller)
        if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
        }
        present(controller, animated: true)
    }
    // MARK: - Flight and Transportation route orchestration

    @objc private func openDepartureSearch() {
        presentLocationSearch(title: "From") { [weak self] item, airportCode in
            self?.departureLocation = item
            if let airportCode { self?.detailFields["Departure Airport Code"]?.text = airportCode }
            self?.renderSelectedLocation(item, button: self?.departureButton, icon: self?.departureEditIcon)
            self?.refreshRouteDistance()
            self?.refreshSaveState()
        }
    }

    @objc private func openArrivalSearch() {
        presentLocationSearch(title: "To") { [weak self] item, airportCode in
            self?.arrivalLocation = item
            if let airportCode { self?.detailFields["Arrival Airport Code"]?.text = airportCode }
            self?.renderSelectedLocation(item, button: self?.arrivalButton, icon: self?.arrivalEditIcon)
            self?.refreshRouteDistance()
            self?.refreshSaveState()
        }
    }

    @objc private func invertRouteLocations() {
        guard departureLocation != nil, arrivalLocation != nil else { return }
        swap(&departureLocation, &arrivalLocation)
        if let departureLocation {
            renderSelectedLocation(departureLocation, button: departureButton, icon: departureEditIcon)
        }
        if let arrivalLocation {
            renderSelectedLocation(arrivalLocation, button: arrivalButton, icon: arrivalEditIcon)
        }

        swap(&departureDate, &arrivalDate)
        swap(&departureTime, &arrivalTime)
        updateDateButton(departureDateButton, with: departureDate)
        updateDateButton(arrivalDateButton, with: arrivalDate)
        updateTimeButton(departureTimeButton, with: departureTime)
        updateTimeButton(arrivalTimeButton, with: arrivalTime)
        refreshRouteDistance()
    }

    private func presentLocationSearch(title: String, onSelect: @escaping (MKMapItem, String?) -> Void) {
        if routeKind != .flight, let nearbyCoordinate {
            let controller = NativeRouteDestinationSearchViewController(
                title: title,
                accent: accent,
                nearbyCoordinate: nearbyCoordinate,
                onSelect: { item in onSelect(item, nil) }
            )
            controller.modalPresentationStyle = .pageSheet
            if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                sheet.prefersGrabberVisible = false
                sheet.preferredCornerRadius = 34
            }
            present(controller, animated: true)
            return
        }
        let controller = NativeFlightLocationSearchViewController(title: title, onSelect: onSelect)
        controller.modalPresentationStyle = .pageSheet
        if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
            sheet.prefersGrabberVisible = false
            sheet.preferredCornerRadius = 34
        }
        present(controller, animated: true)
    }

    private func renderSelectedLocation(_ item: MKMapItem, button: UIButton?, icon: UIImageView?) {
        guard routeKind != .flight else {
            button?.setTitle(item.name ?? "Location selected", for: .normal)
            return
        }
        let name = item.name ?? "Selected location"
        let address = fullAddress(for: item.placemark)
        let text = NSMutableAttributedString(
            string: name,
            attributes: [
                .font: UIFont.systemFont(ofSize: 18, weight: .semibold),
                .foregroundColor: UIColor.label,
            ]
        )
        if !address.isEmpty, address.localizedCaseInsensitiveCompare(name) != .orderedSame {
            text.append(NSAttributedString(
                string: "\n\(address)",
                attributes: [
                    .font: UIFont.systemFont(ofSize: 15, weight: .regular),
                    .foregroundColor: UIColor.secondaryLabel,
                ]
            ))
        }
        button?.setAttributedTitle(text, for: .normal)
        button?.titleLabel?.numberOfLines = 0
        button?.titleLabel?.lineBreakMode = .byWordWrapping
        icon?.image = UIImage(systemName: "pencil")
        icon?.accessibilityLabel = "Edit location"
    }

    private func fullAddress(for placemark: MKPlacemark) -> String {
        let street = [placemark.subThoroughfare, placemark.thoroughfare]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        let locality = [placemark.locality, placemark.administrativeArea, placemark.postalCode]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        let structured = [street, locality, placemark.country]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        return structured.isEmpty
            ? (placemark.title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "")
            : structured
    }

    private func refreshRouteDistance() {
        distanceRequest?.cancel()
        distanceRequest = nil
        guard let departureLocation, let arrivalLocation else {
            distanceCard?.isHidden = true
            distanceValueLabel?.text = nil
            setInvertRouteEnabled(false)
            return
        }

        setInvertRouteEnabled(true)
        guard routeKind == .car else { return }
        distanceCard?.isHidden = false
        distanceValueLabel?.text = "Calculating…"
        let request = MKDirections.Request()
        request.source = departureLocation
        request.destination = arrivalLocation
        request.transportType = .automobile
        request.requestsAlternateRoutes = false
        let directions = MKDirections(request: request)
        distanceRequest = directions
        directions.calculate { [weak self, weak directions] response, _ in
            DispatchQueue.main.async {
                guard let self, self.distanceRequest === directions else { return }
                self.distanceRequest = nil
                guard let meters = response?.routes.first?.distance else {
                    self.distanceValueLabel?.text = "Unavailable"
                    return
                }
                let measurement = Measurement(value: meters, unit: UnitLength.meters)
                let formatter = MeasurementFormatter()
                formatter.unitOptions = .naturalScale
                formatter.unitStyle = .short
                formatter.numberFormatter.maximumFractionDigits = 2
                self.distanceValueLabel?.text = formatter.string(from: measurement)
                self.distanceCard?.accessibilityValue = self.distanceValueLabel?.text
            }
        }
    }

    // MARK: - Shared date and time orchestration

    @objc private func openDepartureDate() {
        presentDatePicker { [weak self] date in
            self?.setDepartureDate(date)
        }
    }

    @objc private func openArrivalDate() {
        presentDatePicker { [weak self] date in
            self?.arrivalDate = date
            self?.updateDateButton(self?.arrivalDateButton, with: date)
            self?.refreshSaveState()
            self?.scheduleSavedPlaceUpdate()
        }
    }

    private func presentDatePicker(onSave: @escaping (Date?) -> Void) {
        let controller = NativeFlightDateInputViewController(accent: AlmidyDesignTokens.Color.goldDark, onSave: onSave)
        NativeFlightDateInputViewController.sheetConfiguration.apply(to: controller)
        if let sheet = controller.sheetPresentationController {
            if #available(iOS 16.0, *) {
                sheet.detents = [.custom(identifier: .init("flightDate")) { context in
                    min(700, context.maximumDetentValue * 0.79)
                }]
            } else {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
            }
        }
        present(controller, animated: true)
    }

    @objc private func openDepartureTime() {
        presentTimePicker(date: departureTime ?? defaultTime(for: departureDate)) { [weak self] date in
            self?.setDepartureTime(date)
        }
    }

    @objc private func openArrivalTime() {
        presentTimePicker(date: arrivalTime ?? defaultTime(for: arrivalDate)) { [weak self] date in
            self?.arrivalTime = date
            self?.updateTimeButton(self?.arrivalTimeButton, with: date)
            self?.refreshSaveState()
            self?.scheduleSavedPlaceUpdate()
        }
    }

    private func defaultTime(for selectedDay: Date?) -> Date {
        guard let selectedDay else { return Date() }
        let calendar = Calendar.current
        let nowTime = calendar.dateComponents([.hour, .minute], from: Date())
        return calendar.date(
            bySettingHour: nowTime.hour ?? 0,
            minute: nowTime.minute ?? 0,
            second: 0,
            of: selectedDay
        ) ?? selectedDay
    }

    private func setDepartureDate(_ date: Date?) {
        departureDate = date
        updateDateButton(departureDateButton, with: date)
        defer { scheduleSavedPlaceUpdate() }
        guard let date else {
            departureTime = nil
            arrivalDate = nil
            arrivalTime = nil
            updateTimeButton(departureTimeButton, with: nil)
            updateDateButton(arrivalDateButton, with: nil)
            updateTimeButton(arrivalTimeButton, with: nil)
            refreshSaveState()
            return
        }

        if let existingTime = departureTime {
            let calendar = Calendar.current
            let components = calendar.dateComponents([.hour, .minute], from: existingTime)
            departureTime = calendar.date(
                bySettingHour: components.hour ?? 0,
                minute: components.minute ?? 0,
                second: 0,
                of: date
            )
            setAutomaticArrival(from: departureTime ?? date)
        } else {
            arrivalDate = date
            updateDateButton(arrivalDateButton, with: date)
        }
        refreshSaveState()
    }

    private func setDepartureTime(_ date: Date?) {
        departureTime = date
        updateTimeButton(departureTimeButton, with: date)
        defer { scheduleSavedPlaceUpdate() }
        guard let date else {
            arrivalTime = nil
            updateTimeButton(arrivalTimeButton, with: nil)
            refreshSaveState()
            return
        }
        departureDate = Calendar.current.startOfDay(for: date)
        updateDateButton(departureDateButton, with: departureDate)
        setAutomaticArrival(from: date)
        refreshSaveState()
    }

    private func setAutomaticArrival(from departure: Date) {
        let arrival = Calendar.current.date(byAdding: .minute, value: 45, to: departure) ?? departure
        arrivalDate = Calendar.current.startOfDay(for: arrival)
        arrivalTime = arrival
        updateDateButton(arrivalDateButton, with: arrivalDate)
        updateTimeButton(arrivalTimeButton, with: arrival)
        refreshSaveState()
    }

    private func presentTimePicker(date: Date, onSave: @escaping (Date?) -> Void) {
        let controller = NativeFlightTimeInputViewController(date: date, accent: AlmidyDesignTokens.Color.goldDark, onSave: onSave)
        NativeFlightTimeInputViewController.sheetConfiguration.apply(to: controller)
        if let sheet = controller.sheetPresentationController {
            if #available(iOS 16.0, *) {
                sheet.detents = [.custom(identifier: .init("flightTime")) { context in
                    min(410, context.maximumDetentValue * 0.47)
                }]
            } else {
                sheet.detents = [.medium(), .large()]
            }
        }
        present(controller, animated: true)
    }

    private func updateDateButton(_ button: UIButton?, with date: Date?) {
        guard let date else {
            button?.setTitle("Date", for: .normal)
            return
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d"
        formatter.timeZone = NativeTimeZonePreference.timeZone
        button?.setTitle(formatter.string(from: date), for: .normal)
    }

    private func updateTimeButton(_ button: UIButton?, with date: Date?) {
        guard let date else {
            button?.setTitle("Time", for: .normal)
            return
        }
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.timeZone = NativeTimeZonePreference.timeZone
        button?.setTitle(formatter.string(from: date), for: .normal)
    }
    // MARK: - Extracted utility integrations

    @objc private func openNote() {
        let controller = NativeNoteInputViewController(accent: AlmidyDesignTokens.Color.goldDark) { [weak self] note in
            self?.note = note.isEmpty ? nil : note
            self?.noteLabel?.text = note.isEmpty ? "Write a note" : "Note added"
            self?.refreshSaveState()
            self?.scheduleSavedPlaceUpdate()
        }
        NativeNoteInputViewController.sheetConfiguration.apply(to: controller)
        if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
        }
        present(controller, animated: true)
    }

    private func importDocument() {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item], asCopy: true)
        picker.delegate = self
        present(picker, animated: true)
    }

    private func saveLink() {
        let alert = NativeLinkInputAlert.make { [weak self] url, displayName in
            self?.attachments.append(.init(kind: .link, displayName: displayName, sourceURL: url))
            self?.attachmentLabel?.text = "Link added"
            self?.refreshSaveState()
            self?.scheduleSavedPlaceUpdate()
        }
        present(alert, animated: true)
    }

    private func choosePhoto() {
        var configuration = PHPickerConfiguration(photoLibrary: .shared())
        configuration.filter = .images
        configuration.selectionLimit = 1
        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = self
        present(picker, animated: true)
    }

    private func takePhoto() {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
            let alert = UIAlertController(title: "Camera Unavailable", message: "Choose a photo from your library instead.", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            present(alert, animated: true)
            return
        }
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = self
        present(picker, animated: true)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let name = urls.first?.lastPathComponent else { return }
        attachmentLabel?.text = name
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        if !results.isEmpty { attachmentLabel?.text = "Photo added" }
    }

    func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        picker.dismiss(animated: true)
        attachmentLabel?.text = "Photo added"
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { picker.dismiss(animated: true) }
    @objc private func close() { dismiss(animated: true) }
}

enum NativeTimeZonePreference {
    static let changedNotification = Notification.Name("almidy.native.timeZoneChanged")
    private static let defaultsKey = "almidy.native.selectedTimeZoneIdentifier"

    static var selectedIdentifier: String? {
        guard let identifier = UserDefaults.standard.string(forKey: defaultsKey),
              TimeZone(identifier: identifier) != nil else { return nil }
        return identifier
    }

    static var timeZone: TimeZone {
        selectedIdentifier.flatMap(TimeZone.init(identifier:)) ?? .autoupdatingCurrent
    }

    static func applyStoredSelection() {
        if selectedIdentifier == nil {
            NSTimeZone.resetSystemTimeZone()
        } else {
            NSTimeZone.default = timeZone
        }
    }

    static func select(_ identifier: String?) {
        if let identifier, TimeZone(identifier: identifier) != nil {
            UserDefaults.standard.set(identifier, forKey: defaultsKey)
        } else {
            UserDefaults.standard.removeObject(forKey: defaultsKey)
        }
        applyStoredSelection()
        NotificationCenter.default.post(name: changedNotification, object: nil)
    }
}

struct NativeTimeZoneEntry {
    let city: String
    let country: String
    let identifier: String
    let aliases: [String]

    var displayName: String { "\(city), \(country)" }
    var searchText: String {
        ([city, country, identifier] + aliases).joined(separator: " ").folding(
            options: [.caseInsensitive, .diacriticInsensitive], locale: .current
        )
    }

    func offsetText(at date: Date = Date()) -> String {
        guard let zone = TimeZone(identifier: identifier) else { return "GMT" }
        let seconds = zone.secondsFromGMT(for: date)
        if seconds == 0 { return "GMT" }
        let sign = seconds < 0 ? "-" : "+"
        let absolute = abs(seconds)
        let hours = absolute / 3600
        let minutes = (absolute % 3600) / 60
        return minutes == 0 ? "GMT\(sign)\(hours)" : String(format: "GMT%@%d:%02d", sign, hours, minutes)
    }

    static let representative: [NativeTimeZoneEntry] = [
        .init(city: "Miami", country: "United States", identifier: "America/New_York", aliases: ["New York", "Eastern", "EST", "EDT"]),
        .init(city: "Chicago", country: "United States", identifier: "America/Chicago", aliases: ["Central", "CST", "CDT"]),
        .init(city: "Denver", country: "United States", identifier: "America/Denver", aliases: ["Mountain", "MST", "MDT"]),
        .init(city: "Phoenix", country: "United States", identifier: "America/Phoenix", aliases: ["Arizona", "MST"]),
        .init(city: "Los Angeles", country: "United States", identifier: "America/Los_Angeles", aliases: ["Pacific", "PST", "PDT"]),
        .init(city: "Anchorage", country: "United States", identifier: "America/Anchorage", aliases: ["Alaska", "AKST", "AKDT"]),
        .init(city: "Honolulu", country: "United States", identifier: "Pacific/Honolulu", aliases: ["Hawaii", "HST"]),
        .init(city: "Toronto", country: "Canada", identifier: "America/Toronto", aliases: ["Eastern", "EST", "EDT"]),
        .init(city: "Vancouver", country: "Canada", identifier: "America/Vancouver", aliases: ["Pacific", "PST", "PDT"]),
        .init(city: "Mexico City", country: "Mexico", identifier: "America/Mexico_City", aliases: ["Central"]),
        .init(city: "São Paulo", country: "Brazil", identifier: "America/Sao_Paulo", aliases: ["Sao Paulo", "Brasilia", "BRT"]),
        .init(city: "Buenos Aires", country: "Argentina", identifier: "America/Argentina/Buenos_Aires", aliases: ["Argentina", "ART"]),
        .init(city: "Bogotá", country: "Colombia", identifier: "America/Bogota", aliases: ["Bogota", "COT"]),
        .init(city: "Lima", country: "Peru", identifier: "America/Lima", aliases: ["PET"]),
        .init(city: "Santiago", country: "Chile", identifier: "America/Santiago", aliases: ["Chile", "CLT", "CLST"]),
        .init(city: "London", country: "United Kingdom", identifier: "Europe/London", aliases: ["British", "GMT", "BST"]),
        .init(city: "Paris", country: "France", identifier: "Europe/Paris", aliases: ["Central European", "CET", "CEST"]),
        .init(city: "Berlin", country: "Germany", identifier: "Europe/Berlin", aliases: ["Central European", "CET", "CEST"]),
        .init(city: "Rome", country: "Italy", identifier: "Europe/Rome", aliases: ["Central European", "CET", "CEST"]),
        .init(city: "Madrid", country: "Spain", identifier: "Europe/Madrid", aliases: ["Central European", "CET", "CEST"]),
        .init(city: "Athens", country: "Greece", identifier: "Europe/Athens", aliases: ["Eastern European", "EET", "EEST"]),
        .init(city: "Istanbul", country: "Türkiye", identifier: "Europe/Istanbul", aliases: ["Turkey", "TRT"]),
        .init(city: "Kyiv", country: "Ukraine", identifier: "Europe/Kyiv", aliases: ["Kiev", "EET", "EEST"]),
        .init(city: "Cairo", country: "Egypt", identifier: "Africa/Cairo", aliases: ["EET", "EEST"]),
        .init(city: "Johannesburg", country: "South Africa", identifier: "Africa/Johannesburg", aliases: ["SAST"]),
        .init(city: "Lagos", country: "Nigeria", identifier: "Africa/Lagos", aliases: ["WAT"]),
        .init(city: "Nairobi", country: "Kenya", identifier: "Africa/Nairobi", aliases: ["EAT"]),
        .init(city: "Dubai", country: "United Arab Emirates", identifier: "Asia/Dubai", aliases: ["Gulf", "GST"]),
        .init(city: "Riyadh", country: "Saudi Arabia", identifier: "Asia/Riyadh", aliases: ["Arabia", "AST"]),
        .init(city: "Jerusalem", country: "Israel", identifier: "Asia/Jerusalem", aliases: ["Israel", "IST", "IDT"]),
        .init(city: "Delhi", country: "India", identifier: "Asia/Kolkata", aliases: ["New Delhi", "Calcutta", "India Standard", "IST"]),
        .init(city: "Bangkok", country: "Thailand", identifier: "Asia/Bangkok", aliases: ["Indochina", "ICT"]),
        .init(city: "Singapore", country: "Singapore", identifier: "Asia/Singapore", aliases: ["SGT"]),
        .init(city: "Hong Kong", country: "Hong Kong", identifier: "Asia/Hong_Kong", aliases: ["HKT"]),
        .init(city: "Shanghai", country: "China", identifier: "Asia/Shanghai", aliases: ["Beijing", "China Standard", "CST"]),
        .init(city: "Tokyo", country: "Japan", identifier: "Asia/Tokyo", aliases: ["Japan Standard", "JST"]),
        .init(city: "Seoul", country: "South Korea", identifier: "Asia/Seoul", aliases: ["Korea Standard", "KST"]),
        .init(city: "Sydney", country: "Australia", identifier: "Australia/Sydney", aliases: ["Australian Eastern", "AEST", "AEDT"]),
        .init(city: "Adelaide", country: "Australia", identifier: "Australia/Adelaide", aliases: ["Australian Central", "ACST", "ACDT"]),
        .init(city: "Perth", country: "Australia", identifier: "Australia/Perth", aliases: ["Australian Western", "AWST"]),
        .init(city: "Auckland", country: "New Zealand", identifier: "Pacific/Auckland", aliases: ["New Zealand", "NZST", "NZDT"]),
        .init(city: "UTC", country: "Coordinated Universal Time", identifier: "UTC", aliases: ["GMT", "Zulu"])
    ]
}

@available(iOS 16.0, *)
extension NativeActivityPlaceDetailsViewController: MKLookAroundViewControllerDelegate {
    func lookAroundViewControllerWillPresentFullScreen(_ viewController: MKLookAroundViewController) {
        updateLookAroundReadyState(.fullScreen)
    }

    func lookAroundViewControllerDidDismissFullScreen(_ viewController: MKLookAroundViewController) {
        updateLookAroundReadyState(.ready)
    }

    func lookAroundViewControllerDidUpdateScene(_ viewController: MKLookAroundViewController) {
        updateLookAroundReadyState(.ready)
    }
}

private final class NativeFlightARPreviewViewController: UIViewController, MKMapViewDelegate {
    private let departure: MKMapItem
    private let arrival: MKMapItem
    private let accent: UIColor
    private let sceneView = ARSCNView(frame: .zero)
    private let mapView = MKMapView(frame: .zero)

    init(departure: MKMapItem, arrival: MKMapItem, accent: UIColor) {
        self.departure = departure
        self.arrival = arrival
        self.accent = accent
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        sceneView.translatesAutoresizingMaskIntoConstraints = false
        sceneView.automaticallyUpdatesLighting = true
        view.addSubview(sceneView)
        NSLayoutConstraint.activate([
            sceneView.topAnchor.constraint(equalTo: view.topAnchor),
            sceneView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            sceneView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            sceneView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        let close = UIButton(type: .system)
        close.setImage(UIImage(systemName: "xmark"), for: .normal)
        close.tintColor = .label
        close.accessibilityLabel = "Close AR flight route"
        close.addTarget(self, action: #selector(closePreview), for: .touchUpInside)
        close.widthAnchor.constraint(equalToConstant: 44).isActive = true
        close.heightAnchor.constraint(equalToConstant: 44).isActive = true

        let title = UILabel()
        title.text = "\(departure.name ?? "Departure")  →  \(arrival.name ?? "Arrival")"
        title.font = .systemFont(ofSize: 17, weight: .semibold)
        title.textColor = .label
        title.numberOfLines = 2

        mapView.delegate = self
        mapView.isUserInteractionEnabled = false
        mapView.pointOfInterestFilter = .excludingAll
        mapView.layer.cornerRadius = 18
        mapView.clipsToBounds = true
        mapView.heightAnchor.constraint(equalToConstant: 170).isActive = true
        let departureAnnotation = MKPointAnnotation()
        departureAnnotation.coordinate = departure.placemark.coordinate
        departureAnnotation.title = departure.name
        let arrivalAnnotation = MKPointAnnotation()
        arrivalAnnotation.coordinate = arrival.placemark.coordinate
        arrivalAnnotation.title = arrival.name
        mapView.addAnnotations([departureAnnotation, arrivalAnnotation])
        let route = MKGeodesicPolyline(coordinates: [departureAnnotation.coordinate, arrivalAnnotation.coordinate], count: 2)
        mapView.addOverlay(route)
        mapView.setVisibleMapRect(
            route.boundingMapRect,
            edgePadding: UIEdgeInsets(top: 32, left: 32, bottom: 32, right: 32),
            animated: false
        )

        let header = UIStackView(arrangedSubviews: [title, UIView(), close])
        header.axis = .horizontal
        header.alignment = .center
        header.spacing = 12
        let content = UIStackView(arrangedSubviews: [header, mapView])
        content.axis = .vertical
        content.spacing = 12
        content.translatesAutoresizingMaskIntoConstraints = false

        let panel: UIVisualEffectView
        if #available(iOS 26.0, *) {
            let effect = UIGlassEffect(style: .regular)
            effect.isInteractive = true
            effect.tintColor = accent.withAlphaComponent(0.18)
            panel = UIVisualEffectView(effect: effect)
        } else {
            panel = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterial))
        }
        panel.layer.cornerRadius = 28
        panel.clipsToBounds = true
        panel.translatesAutoresizingMaskIntoConstraints = false
        panel.contentView.addSubview(content)
        view.addSubview(panel)
        NSLayoutConstraint.activate([
            panel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 18),
            panel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -18),
            panel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12),
            content.topAnchor.constraint(equalTo: panel.contentView.topAnchor, constant: 16),
            content.leadingAnchor.constraint(equalTo: panel.contentView.leadingAnchor, constant: 16),
            content.trailingAnchor.constraint(equalTo: panel.contentView.trailingAnchor, constant: -16),
            content.bottomAnchor.constraint(equalTo: panel.contentView.bottomAnchor, constant: -16)
        ])
        addPlaneNode()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        let configuration = ARWorldTrackingConfiguration()
        configuration.worldAlignment = .gravityAndHeading
        sceneView.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        sceneView.session.pause()
    }

    private func addPlaneNode() {
        let text = SCNText(string: "✈︎", extrusionDepth: 0.02)
        text.font = .systemFont(ofSize: 0.34, weight: .semibold)
        text.firstMaterial?.diffuse.contents = accent
        let node = SCNNode(geometry: text)
        let bounds = text.boundingBox
        node.pivot = SCNMatrix4MakeTranslation(
            (bounds.max.x - bounds.min.x) / 2,
            (bounds.max.y - bounds.min.y) / 2,
            0
        )
        node.position = SCNVector3(0, 0, -1.5)
        node.constraints = [SCNBillboardConstraint()]
        sceneView.scene.rootNode.addChildNode(node)
    }

    func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
        let renderer = MKPolylineRenderer(overlay: overlay)
        renderer.strokeColor = accent
        renderer.lineWidth = 4
        renderer.lineCap = .round
        return renderer
    }

    @objc private func closePreview() { dismiss(animated: true) }
}

private final class NativeFlightLocationSearchViewController: UIViewController,
    MKLocalSearchCompleterDelegate, UITableViewDataSource, UITableViewDelegate, UITextFieldDelegate {
    private let screenTitle: String
    private let onSelect: (MKMapItem, String?) -> Void
    private let completer = MKLocalSearchCompleter()
    private var completions: [MKLocalSearchCompletion] = []
    private var hasActivatedSearch = false

    private let cancelButton = UIButton(type: .system)
    private let titleLabel = UILabel()
    private let searchContainer = UIView()
    private let searchField = UITextField()
    private let closeButton = UIButton(type: .system)
    private let resultsTable = UITableView(frame: .zero, style: .plain)
    private var initialSearchTop: NSLayoutConstraint!
    private var focusedSearchTop: NSLayoutConstraint!
    private var initialSearchTrailing: NSLayoutConstraint!
    private var focusedSearchTrailing: NSLayoutConstraint!

    init(title: String, onSelect: @escaping (MKMapItem, String?) -> Void) {
        screenTitle = title
        self.onSelect = onSelect
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable) required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.setTitleColor(.label, for: .normal)
        cancelButton.titleLabel?.font = .systemFont(ofSize: 18, weight: .medium)
        cancelButton.backgroundColor = .secondarySystemBackground
        cancelButton.layer.cornerRadius = 22
        cancelButton.addTarget(self, action: #selector(close), for: .touchUpInside)

        titleLabel.text = screenTitle
        titleLabel.font = .systemFont(ofSize: 22, weight: .semibold)
        titleLabel.textAlignment = .center

        searchContainer.backgroundColor = .systemBackground
        searchContainer.layer.cornerRadius = 24
        searchContainer.layer.shadowColor = UIColor.black.cgColor
        searchContainer.layer.shadowOpacity = 0.06
        searchContainer.layer.shadowRadius = 14
        searchContainer.layer.shadowOffset = CGSize(width: 0, height: 7)
        let searchIcon = UIImageView(image: UIImage(systemName: "magnifyingglass"))
        searchIcon.tintColor = .label
        searchIcon.contentMode = .scaleAspectFit
        searchField.placeholder = "City or Airport"
        searchField.font = .systemFont(ofSize: 20)
        searchField.textColor = .label
        searchField.tintColor = AlmidyDesignTokens.Color.goldDark
        searchField.clearButtonMode = .never
        searchField.returnKeyType = .search
        searchField.autocorrectionType = .no
        searchField.autocapitalizationType = .words
        searchField.delegate = self
        searchField.addTarget(self, action: #selector(queryChanged), for: .editingChanged)
        searchField.accessibilityIdentifier = screenTitle == "From" ? "flightDepartureSearchField" : "flightArrivalSearchField"

        closeButton.setImage(UIImage(systemName: "xmark"), for: .normal)
        closeButton.tintColor = .label
        closeButton.backgroundColor = .systemBackground
        closeButton.layer.cornerRadius = 24
        closeButton.layer.shadowColor = UIColor.black.cgColor
        closeButton.layer.shadowOpacity = 0.06
        closeButton.layer.shadowRadius = 14
        closeButton.layer.shadowOffset = CGSize(width: 0, height: 7)
        closeButton.alpha = 0
        closeButton.isHidden = true
        closeButton.accessibilityLabel = "Close location search"
        closeButton.addTarget(self, action: #selector(resetSearch), for: .touchUpInside)

        resultsTable.backgroundColor = .clear
        resultsTable.separatorStyle = .singleLine
        resultsTable.keyboardDismissMode = .interactive
        resultsTable.dataSource = self
        resultsTable.delegate = self
        resultsTable.register(UITableViewCell.self, forCellReuseIdentifier: "LocationResult")

        [cancelButton, titleLabel, searchContainer, searchIcon, searchField, closeButton, resultsTable].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
        }
        view.addSubview(cancelButton)
        view.addSubview(titleLabel)
        view.addSubview(searchContainer)
        searchContainer.addSubview(searchIcon)
        searchContainer.addSubview(searchField)
        view.addSubview(closeButton)
        view.addSubview(resultsTable)

        initialSearchTop = searchContainer.topAnchor.constraint(equalTo: cancelButton.bottomAnchor, constant: 14)
        focusedSearchTop = searchContainer.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 28)
        initialSearchTrailing = searchContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20)
        focusedSearchTrailing = searchContainer.trailingAnchor.constraint(equalTo: closeButton.leadingAnchor, constant: -12)
        focusedSearchTop.isActive = false
        focusedSearchTrailing.isActive = false

        NSLayoutConstraint.activate([
            cancelButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            cancelButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            cancelButton.widthAnchor.constraint(equalToConstant: 90),
            cancelButton.heightAnchor.constraint(equalToConstant: 44),
            titleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: cancelButton.centerYAnchor),
            initialSearchTop,
            searchContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            initialSearchTrailing,
            searchContainer.heightAnchor.constraint(equalToConstant: 48),
            searchIcon.leadingAnchor.constraint(equalTo: searchContainer.leadingAnchor, constant: 16),
            searchIcon.centerYAnchor.constraint(equalTo: searchContainer.centerYAnchor),
            searchIcon.widthAnchor.constraint(equalToConstant: 22),
            searchIcon.heightAnchor.constraint(equalToConstant: 22),
            searchField.leadingAnchor.constraint(equalTo: searchIcon.trailingAnchor, constant: 12),
            searchField.trailingAnchor.constraint(equalTo: searchContainer.trailingAnchor, constant: -14),
            searchField.topAnchor.constraint(equalTo: searchContainer.topAnchor),
            searchField.bottomAnchor.constraint(equalTo: searchContainer.bottomAnchor),
            closeButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            closeButton.centerYAnchor.constraint(equalTo: searchContainer.centerYAnchor),
            closeButton.widthAnchor.constraint(equalToConstant: 48),
            closeButton.heightAnchor.constraint(equalToConstant: 48),
            resultsTable.topAnchor.constraint(equalTo: searchContainer.bottomAnchor, constant: 12),
            resultsTable.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            resultsTable.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            resultsTable.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor)
        ])

        completer.delegate = self
        completer.resultTypes = [.address, .pointOfInterest]
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !hasActivatedSearch else { return }
        hasActivatedSearch = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) { [weak self] in
            self?.activateSearch()
        }
    }

    private func activateSearch() {
        guard !focusedSearchTop.isActive else { return }
        initialSearchTop.isActive = false
        initialSearchTrailing.isActive = false
        focusedSearchTop.isActive = true
        focusedSearchTrailing.isActive = true
        closeButton.isHidden = false
        searchField.becomeFirstResponder()
        UIView.animate(withDuration: 0.24) {
            self.cancelButton.alpha = 0
            self.titleLabel.alpha = 0
            self.closeButton.alpha = 1
            self.view.layoutIfNeeded()
        }
    }

    @objc private func resetSearch() {
        searchField.text = nil
        completer.queryFragment = ""
        completions = []
        resultsTable.reloadData()
        searchField.resignFirstResponder()

        focusedSearchTop.isActive = false
        focusedSearchTrailing.isActive = false
        initialSearchTop.isActive = true
        initialSearchTrailing.isActive = true
        UIView.animate(withDuration: 0.24, animations: {
            self.cancelButton.alpha = 1
            self.titleLabel.alpha = 1
            self.closeButton.alpha = 0
            self.view.layoutIfNeeded()
        }, completion: { _ in
            self.closeButton.isHidden = true
        })
    }

    @objc private func queryChanged() {
        let query = searchField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if query.isEmpty {
            completions = []
            resultsTable.reloadData()
        }
        completer.queryFragment = query
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        completions = completer.results
        resultsTable.reloadData()
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        completions = []
        resultsTable.reloadData()
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { completions.count }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "LocationResult", for: indexPath)
        var content = cell.defaultContentConfiguration()
        let result = completions[indexPath.row]
        content.text = result.title
        content.secondaryText = result.subtitle
        content.image = UIImage(systemName: "mappin.and.ellipse")
        cell.contentConfiguration = content
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let completion = completions[indexPath.row]
        let request = MKLocalSearch.Request(completion: completion)
        MKLocalSearch(request: request).start { [weak self] response, _ in
            guard let self, let item = response?.mapItems.first else { return }
            let airportCode = Self.airportCode(
                in: [completion.title, completion.subtitle, item.name, item.placemark.title]
            )
            self.dismiss(animated: true) { self.onSelect(item, airportCode) }
        }
    }

    private static func airportCode(in values: [String?]) -> String? {
        let expression = try? NSRegularExpression(pattern: "(?:\\(|\\b)([A-Z]{3})(?:\\)|\\b)")
        for value in values.compactMap({ $0 }) {
            let uppercased = value.uppercased()
            let range = NSRange(uppercased.startIndex..., in: uppercased)
            guard let match = expression?.firstMatch(in: uppercased, range: range),
                  match.numberOfRanges > 1,
                  let codeRange = Range(match.range(at: 1), in: uppercased) else { continue }
            return String(uppercased[codeRange])
        }
        return nil
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        if completions.indices.contains(0) { tableView(resultsTable, didSelectRowAt: IndexPath(row: 0, section: 0)) }
        return false
    }

    func textFieldDidBeginEditing(_ textField: UITextField) {
        activateSearch()
    }

    @objc private func close() { dismiss(animated: true) }
}

private final class NativeRouteDestinationSearchViewController: UIViewController,
    MKLocalSearchCompleterDelegate, UITableViewDataSource, UITableViewDelegate, UITextFieldDelegate {
    private let screenTitle: String
    private let accent: UIColor
    private let nearbyCoordinate: CLLocationCoordinate2D
    private let onSelect: (MKMapItem) -> Void
    private let completer = MKLocalSearchCompleter()
    private var completions: [MKLocalSearchCompletion] = []
    private let searchField = UITextField()
    private let tableView = UITableView(frame: .zero, style: .plain)
    private let nearbyButton = UIButton(type: .system)
    private let everywhereButton = UIButton(type: .system)
    private var searchesNearby = false

    init(title: String = "To", accent: UIColor, nearbyCoordinate: CLLocationCoordinate2D, onSelect: @escaping (MKMapItem) -> Void) {
        screenTitle = title
        self.accent = accent
        self.nearbyCoordinate = nearbyCoordinate
        self.onSelect = onSelect
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        completer.delegate = self
        completer.resultTypes = [.address, .pointOfInterest, .query]

        let cancel = UIButton(type: .system)
        cancel.setTitle("Cancel", for: .normal)
        cancel.setTitleColor(.label, for: .normal)
        cancel.titleLabel?.font = .systemFont(ofSize: 18, weight: .medium)
        cancel.backgroundColor = UIColor.secondarySystemBackground.withAlphaComponent(0.82)
        cancel.layer.cornerRadius = 22
        cancel.layer.shadowColor = UIColor.black.cgColor
        cancel.layer.shadowOpacity = 0.08
        cancel.layer.shadowRadius = 10
        cancel.layer.shadowOffset = CGSize(width: 0, height: 4)
        cancel.addTarget(self, action: #selector(cancelSearch), for: .touchUpInside)

        let title = UILabel()
        title.text = screenTitle
        title.font = .systemFont(ofSize: 22, weight: .semibold)
        title.textAlignment = .center

        searchField.placeholder = "Search by a locality"
        searchField.font = .systemFont(ofSize: 17)
        searchField.backgroundColor = .secondarySystemFill
        searchField.layer.cornerRadius = 12
        searchField.clearButtonMode = .whileEditing
        searchField.returnKeyType = .search
        searchField.delegate = self
        searchField.addTarget(self, action: #selector(queryChanged), for: .editingChanged)
        let searchIcon = UIImageView(image: UIImage(systemName: "magnifyingglass"))
        searchIcon.tintColor = .secondaryLabel
        searchIcon.contentMode = .center
        searchIcon.frame = CGRect(x: 0, y: 0, width: 42, height: 44)
        searchField.leftView = searchIcon
        searchField.leftViewMode = .always

        configureScopeButton(nearbyButton, title: "Nearby", action: #selector(selectNearby))
        configureScopeButton(everywhereButton, title: "Everywhere", action: #selector(selectEverywhere))
        let scopeRow = UIStackView(arrangedSubviews: [nearbyButton, everywhereButton, UIView()])
        scopeRow.axis = .horizontal
        scopeRow.spacing = 8
        updateScopeAppearance()

        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "route-destination")
        tableView.dataSource = self
        tableView.delegate = self
        tableView.rowHeight = 76
        tableView.keyboardDismissMode = .interactive
        tableView.tableFooterView = UIView()

        [cancel, title, searchField, scopeRow, tableView].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview($0)
        }
        NSLayoutConstraint.activate([
            cancel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            cancel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            cancel.widthAnchor.constraint(equalToConstant: 92),
            cancel.heightAnchor.constraint(equalToConstant: 44),
            title.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            title.centerYAnchor.constraint(equalTo: cancel.centerYAnchor),
            searchField.topAnchor.constraint(equalTo: cancel.bottomAnchor, constant: 20),
            searchField.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            searchField.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            searchField.heightAnchor.constraint(equalToConstant: 44),
            scopeRow.topAnchor.constraint(equalTo: searchField.bottomAnchor, constant: 12),
            scopeRow.leadingAnchor.constraint(equalTo: searchField.leadingAnchor),
            scopeRow.trailingAnchor.constraint(equalTo: searchField.trailingAnchor),
            scopeRow.heightAnchor.constraint(equalToConstant: 34),
            tableView.topAnchor.constraint(equalTo: scopeRow.bottomAnchor, constant: 8),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        searchField.becomeFirstResponder()
    }

    private func configureScopeButton(_ button: UIButton, title: String, action: Selector) {
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 17, weight: .regular)
        button.addTarget(self, action: action, for: .touchUpInside)
    }

    private func updateScopeAppearance() {
        nearbyButton.setTitleColor(searchesNearby ? accent : .secondaryLabel, for: .normal)
        everywhereButton.setTitleColor(searchesNearby ? .secondaryLabel : accent, for: .normal)
        if searchesNearby {
            completer.region = MKCoordinateRegion(
                center: nearbyCoordinate,
                latitudinalMeters: 50_000,
                longitudinalMeters: 50_000
            )
        } else {
            completer.region = MKCoordinateRegion()
        }
        refreshQuery()
    }

    @objc private func cancelSearch() { dismiss(animated: true) }
    @objc private func selectNearby() { searchesNearby = true; updateScopeAppearance() }
    @objc private func selectEverywhere() { searchesNearby = false; updateScopeAppearance() }
    @objc private func queryChanged() { refreshQuery() }

    private func refreshQuery() {
        let query = searchField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if query.count < 2 {
            completions = []
            tableView.reloadData()
        }
        completer.queryFragment = query
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        completions = Array(completer.results.prefix(8))
        tableView.reloadData()
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        completions = []
        tableView.reloadData()
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { completions.count }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "route-destination", for: indexPath)
        let completion = completions[indexPath.row]
        var content = cell.defaultContentConfiguration()
        content.image = UIImage(systemName: "mappin.and.ellipse")
        content.imageProperties.tintColor = accent
        content.text = completion.title
        content.secondaryText = completion.subtitle
        content.textProperties.font = .systemFont(ofSize: 16, weight: .medium)
        content.textProperties.numberOfLines = 1
        content.secondaryTextProperties.color = .secondaryLabel
        content.secondaryTextProperties.font = .systemFont(ofSize: 15, weight: .regular)
        content.secondaryTextProperties.numberOfLines = 1
        content.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 12)
        cell.contentConfiguration = content
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let completion = completions[indexPath.row]
        searchField.resignFirstResponder()
        let request = MKLocalSearch.Request(completion: completion)
        MKLocalSearch(request: request).start { [weak self] response, _ in
            DispatchQueue.main.async {
                guard let self, let item = response?.mapItems.first else { return }
                self.dismiss(animated: true) { self.onSelect(item) }
            }
        }
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        guard !completions.isEmpty else { return false }
        tableView(tableView, didSelectRowAt: IndexPath(row: 0, section: 0))
        return true
    }
}

final class NativeMapViewController: UIViewController, CLLocationManagerDelegate, MKMapViewDelegate, UISheetPresentationControllerDelegate {
    var activityRouteNearbyCoordinate: CLLocationCoordinate2D { mapView.centerCoordinate }
    private static let populatedGlobeDistance: CLLocationDistance = 90_000_000
    private static let populatedGlobeVerticalOffset: CGFloat = 0
    private static let populatedGlobeLongitude: CLLocationDegrees = -108
    private static let activityDiscoveryDiameter: CLLocationDistance = 30_000
    private static let activityCameraMaximumDistance: CLLocationDistance = 18_000

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
    private let statusBarShadeView = UIView()
    private let statusBarShadeLayer = CAGradientLayer()
    private var activityResultSelectionHandler: ((String?) -> Void)?
    private var activityResolvedPlaceHandler: ((String, MKMapItem) -> Void)?
    private var activitySelectionCameraToRestore: MKMapCamera?
    private var activitySheetDetentToRestore: UISheetPresentationController.Detent.Identifier?
    private var tripOverviewTripIDToRestoreAfterActivity: String?
    private var activityPlaceResolutionGeneration = 0
    private var activityCameraFitGeneration = 0
    private var selectedActivityPlaceID: String?
    private var selectedActivityMapItem: MKMapItem?
    private var activityRouteOverlay: MKPolyline?
    private var transportationRouteOverlays: [MKPolyline] = []
    private var flightRouteOverlays: [MKGeodesicPolyline] = []
    private var itineraryRouteDirections: [MKDirections] = []
    private var itineraryRouteGeneration = 0
    private var suppressedActivitySelectionID: String?
    // Keep the exact collection that backs the results sheet alive for as long
    // as the filter is active. The sheet can transition between detents while
    // MapKit rebuilds its visible annotation views; retaining the model here
    // prevents the search overlay from becoming a camera-only update.
    private var activitySearchAnnotations: [NativeActivitySearchAnnotation] = []

    func setActivityResultSelectionHandler(_ handler: ((String?) -> Void)?) {
        activityResultSelectionHandler = handler
    }

    func setActivityResolvedPlaceHandler(_ handler: ((String, MKMapItem) -> Void)?) {
        activityResolvedPlaceHandler = handler
    }

    func prepareToRestoreTripOverviewAfterActivity(for tripID: String) {
        tripOverviewTripIDToRestoreAfterActivity = tripID
    }

    func cancelTripOverviewRestorationAfterActivity() {
        tripOverviewTripIDToRestoreAfterActivity = nil
    }

    func restoreTripOverviewAfterActivity(for tripID: String) {
        tripOverviewTripIDToRestoreAfterActivity = nil
        guard let trip = trips.first(where: { $0.id == tripID }) else {
            setPrimarySheetHiddenForModalFlow(false)
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self, self.presentedViewController == nil else { return }
            self.presentTripOverview(for: trip)
        }
    }

    var activitySearchRegion: MKCoordinateRegion {
        MKCoordinateRegion(
            center: mapView.region.center,
            latitudinalMeters: Self.activityDiscoveryDiameter,
            longitudinalMeters: Self.activityDiscoveryDiameter
        )
    }

    func activitySearchRegion(for tripID: String) -> MKCoordinateRegion {
        guard let trip = trips.first(where: { $0.id == tripID }),
              let coordinate = trip.coordinate ?? resolvedLegacyTripCoordinates[tripID] else {
            return activitySearchRegion
        }
        return MKCoordinateRegion(
            center: coordinate,
            latitudinalMeters: Self.activityDiscoveryDiameter,
            longitudinalMeters: Self.activityDiscoveryDiameter
        )
    }

    func activitySearchLocality(for tripID: String) -> String? {
        trips.first(where: { $0.id == tripID })?.destination
    }

    var nearbyActivitySearchRegion: MKCoordinateRegion? {
        guard let coordinate = locationManager.location?.coordinate else { return nil }
        return MKCoordinateRegion(
            center: coordinate,
            latitudinalMeters: Self.activityDiscoveryDiameter,
            longitudinalMeters: Self.activityDiscoveryDiameter
        )
    }
    private let locationManager = CLLocationManager()
    private let networkMonitor = NWPathMonitor()
    private let networkMonitorQueue = DispatchQueue(label: "app.almidy.native-map.network-monitor", qos: .utility)
    private let monitorsNetworkConnectivity: Bool
    private var trips: [NativeMapTrip]
    private let tripStore: NativeTripStore?
    private let sourceWebView: WKWebView?
    private lazy var itineraryRequester: NativeItineraryRequesting = NativeItineraryAPIClient(webView: sourceWebView)
    private lazy var placeItineraryClient = NativePlaceItineraryAPIClient(webView: sourceWebView)
    private let sheetView = UIView()
    private let sheetHandle = UIView()
    private let headerStack = UIStackView()
    private let titleButton = UIButton(type: .system)
    private let chevronButton = UIButton(type: .system)
    private let settingsButton = UIButton(type: .system)
    private weak var overviewYearPill: UILabel?
    private let collapsedActions = UIStackView()
    private let expandedScrollView = UIScrollView()
    private let expandedContentStack = UIStackView()
    private var expandedContentWidthConstraint: NSLayoutConstraint?
    private var expandedScrollBottomToActionsConstraint: NSLayoutConstraint?
    private var expandedScrollBottomToSheetConstraint: NSLayoutConstraint?
    private lazy var mapControlStack = NativeMapControlsView(
        onMapStyle: { [weak self] in self?.toggleMapMode() },
        onLocation: { [weak self] in self?.requestCurrentLocation() },
        onOrientation: { [weak self] in self?.resetMapOrientation() }
    )
    private var firstTripCard: UIView?
    private var sheetBottomConstraint: NSLayoutConstraint?
    private var sheetHeightConstraint: NSLayoutConstraint?
    private var sheetLeadingConstraint: NSLayoutConstraint?
    private var sheetTrailingConstraint: NSLayoutConstraint?
    private var mapTopConstraint: NSLayoutConstraint?
    private var mapBottomConstraint: NSLayoutConstraint?
    private var mapControlTopConstraint: NSLayoutConstraint?
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
    private var resolvedLegacyTripCoordinates: [String: CLLocationCoordinate2D] = [:]
    private var resolvingLegacyTripIDs: Set<String> = []
    private var activityFilterSearch: MKLocalSearch?
    private var isRequestingLocationAuthorization = false
    private var shouldCenterRequestedLocation = false
    private var hasRequestedInitialLocation = false
    private var hasCenteredInitialLocation = false
    private var reservationCardVisible = !UserDefaults.standard.bool(forKey: "almidy.native.reservationCardDismissed")

    init(
        trips: [NativeMapTrip],
        monitorsNetworkConnectivity: Bool = true,
        tripStore: NativeTripStore? = nil,
        sourceWebView: WKWebView? = nil
    ) {
        self.trips = NativeMapTrip.scheduled(trips)
        self.monitorsNetworkConnectivity = monitorsNetworkConnectivity
        self.tripStore = tripStore
        self.sourceWebView = sourceWebView
        self.sheetState = .collapsed
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = AlmidyDesignTokens.Color.mapSurface
        trips.forEach { warmTripBackground($0) }
        configureMap()
        configureStatusBarShade()
        configureMapControls()
        configureSheet()
        renderSheetContent()
        addTripPins()
        refreshItineraryRouteOverlays()
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
        statusBarShadeLayer.frame = statusBarShadeView.bounds
        mapControlTopConstraint?.constant = NativeAdaptiveLayout.isCompactHeight(view) ? 14 : 18
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
            let resolvedResult = result.map { $0.usingImageURL(draft.imageURL) }
            if case .success(let trip) = resolvedResult {
                self?.replaceTrip(trip)
            }
            completion(resolvedResult)
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
        let scheduledTrips = NativeMapTrip.scheduled(nextTrips)
        trips = scheduledTrips
        let activeTripIDs = Set(scheduledTrips.map(\.id))
        resolvedLegacyTripCoordinates = resolvedLegacyTripCoordinates.filter { activeTripIDs.contains($0.key) }
        resolvingLegacyTripIDs.formIntersection(activeTripIDs)
        scheduledTrips.forEach { warmTripBackground($0) }
        updateMapFramingForTripAvailability(
            zoomsToPopulatedGlobe: !previouslyHadTrips && !scheduledTrips.isEmpty
        )
        addTripPins()
        refreshItineraryRouteOverlays()
        renderSheetContent()
    }

    deinit {
        networkMonitor.pathUpdateHandler = nil
        networkMonitor.cancel()
    }

    private func configureMap() {
        mapView.translatesAutoresizingMaskIntoConstraints = false
        mapView.delegate = self
        mapView.pointOfInterestFilter = .includingAll
        if #available(iOS 16.0, *) {
            mapView.selectableMapFeatures = [.pointsOfInterest, .territories, .physicalFeatures]
        }
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
                    maxCenterCoordinateDistance: Self.populatedGlobeDistance
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
        mapView.pointOfInterestFilter = .includingAll
        mapControlStack.isHidden = true
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
            guard let self,
                  self.activitySearchAnnotations.isEmpty,
                  self.mapControlStack.isHidden else { return }
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
                let configuration = MKStandardMapConfiguration(
                    elevationStyle: .realistic,
                    emphasisStyle: .default
                )
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

    var usesScaleAwareHybridPresentationForTesting: Bool {
        if #available(iOS 16.0, *) {
            return mapView.preferredConfiguration is MKHybridMapConfiguration
        }
        return mapView.mapType == .hybridFlyover
    }

    var isZoomEnabledForTesting: Bool {
        mapView.isZoomEnabled
    }

    func setMapCameraDistanceForTesting(_ distance: CLLocationDistance) {
        let camera = MKMapCamera(
            lookingAtCenter: mapView.camera.centerCoordinate,
            fromDistance: distance,
            pitch: mapView.camera.pitch,
            heading: mapView.camera.heading
        )
        mapView.setCamera(camera, animated: false)
    }

    var geographicLabelOverlayCountForTesting: Int {
        mapView.annotations.filter { $0 is NativeGeographicLabelAnnotation }.count
    }

    var tripFlagAnchorForTesting: (
        centerOffset: CGPoint,
        badgeCenter: CGPoint,
        badgeSize: CGSize,
        badgeCornerRadius: CGFloat,
        flagClipsToCircle: Bool,
        badgeBackgroundIsClear: Bool,
        flagFontSize: CGFloat,
        canShowCallout: Bool
    )? {
        guard let annotation = mapView.annotations.first(where: { $0 is NativeTripAnnotation }),
              let annotationView = self.mapView(mapView, viewFor: annotation) as? NativeTripFlagAnnotationView else {
            return nil
        }
        let layout = annotationView.anchoredBadgeLayoutForTesting
        return (
            centerOffset: annotationView.centerOffset,
            badgeCenter: layout.badgeCenter,
            badgeSize: layout.badgeSize,
            badgeCornerRadius: layout.badgeCornerRadius,
            flagClipsToCircle: layout.flagClipsToCircle,
            badgeBackgroundIsClear: layout.badgeBackgroundIsClear,
            flagFontSize: layout.flagFontSize,
            canShowCallout: annotationView.canShowCallout
        )
    }

    var expandedHeaderChromeForTesting: (
        settingsSize: CGSize,
        settingsCornerRadius: CGFloat,
        settingsBackground: UIColor?,
        settingsTint: UIColor,
        settingsTranslation: CGPoint,
        yearFontSize: CGFloat,
        yearBackground: UIColor?,
        yearTextColor: UIColor?
    )? {
        view.layoutIfNeeded()
        guard let overviewYearPill else { return nil }
        return (
            settingsSize: settingsButton.bounds.size,
            settingsCornerRadius: settingsButton.layer.cornerRadius,
            settingsBackground: settingsButton.backgroundColor,
            settingsTint: settingsButton.tintColor,
            settingsTranslation: CGPoint(x: settingsButton.transform.tx, y: settingsButton.transform.ty),
            yearFontSize: overviewYearPill.font.pointSize,
            yearBackground: overviewYearPill.backgroundColor,
            yearTextColor: overviewYearPill.textColor
        )
    }

    var tripCollectionMenuForTesting: (
        titles: [String],
        selectedTitle: String?,
        disabledTitles: [String],
        opensAsPrimaryAction: Bool,
        chevronIsInteractive: Bool,
        sheetSupportsPan: Bool,
        titleHasLegacyToggleAction: Bool
    ) {
        let actions = titleButton.menu?.children.compactMap { $0 as? UIAction } ?? []
        return (
            titles: actions.map(\.title),
            selectedTitle: actions.first(where: { $0.state == .on })?.title,
            disabledTitles: actions.filter { $0.attributes.contains(.disabled) }.map(\.title),
            opensAsPrimaryAction: titleButton.showsMenuAsPrimaryAction,
            chevronIsInteractive: chevronButton.showsMenuAsPrimaryAction && chevronButton.menu != nil,
            sheetSupportsPan: (sheetView.gestureRecognizers ?? []).contains { $0 is UIPanGestureRecognizer },
            titleHasLegacyToggleAction: !(titleButton.actions(forTarget: self, forControlEvent: .touchUpInside) ?? []).isEmpty
        )
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
        mapControlStack.isHidden = true
        mapControlStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(mapControlStack)

        mapControlTopConstraint = mapControlStack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 18)
        NSLayoutConstraint.activate([
            mapControlStack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            mapControlTopConstraint!,
            mapControlStack.widthAnchor.constraint(equalToConstant: NativeMapControlsView.controlSize)
        ])
    }

    private func configureStatusBarShade() {
        statusBarShadeView.isUserInteractionEnabled = false
        statusBarShadeView.translatesAutoresizingMaskIntoConstraints = false
        statusBarShadeLayer.colors = [
            UIColor.black.withAlphaComponent(0.72).cgColor,
            UIColor.black.withAlphaComponent(0.40).cgColor,
            UIColor.black.withAlphaComponent(0.12).cgColor,
            UIColor.clear.cgColor,
        ]
        statusBarShadeLayer.locations = [0, 0.38, 0.76, 1]
        statusBarShadeView.layer.addSublayer(statusBarShadeLayer)
        view.addSubview(statusBarShadeView)
        NSLayoutConstraint.activate([
            statusBarShadeView.topAnchor.constraint(equalTo: view.topAnchor),
            statusBarShadeView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            statusBarShadeView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            statusBarShadeView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 64),
        ])
    }

    private func configureSheet() {
        sheetView.translatesAutoresizingMaskIntoConstraints = false
        sheetView.backgroundColor = AlmidyDesignTokens.Color.surface
        sheetView.layer.cornerRadius = AlmidyDesignTokens.Component.Map.globeSheetCornerRadius
        sheetView.layer.maskedCorners = [
            .layerMinXMinYCorner,
            .layerMaxXMinYCorner,
            .layerMinXMaxYCorner,
            .layerMaxXMaxYCorner
        ]
        AlmidyDesignTokens.Elevation.sheet.apply(to: sheetView)
        view.addSubview(sheetView)

        sheetBottomConstraint = sheetView.bottomAnchor.constraint(
            equalTo: view.bottomAnchor,
            constant: -AlmidyDesignTokens.Component.Map.globeSheetBottomInset
        )
        sheetHeightConstraint = sheetView.heightAnchor.constraint(equalToConstant: height(for: sheetState))
        sheetLeadingConstraint = sheetView.leadingAnchor.constraint(
            equalTo: view.leadingAnchor,
            constant: AlmidyDesignTokens.Component.Map.globeSheetHorizontalInset
        )
        sheetTrailingConstraint = sheetView.trailingAnchor.constraint(
            equalTo: view.trailingAnchor,
            constant: -AlmidyDesignTokens.Component.Map.globeSheetHorizontalInset
        )
        NSLayoutConstraint.activate([
            sheetLeadingConstraint!,
            sheetTrailingConstraint!,
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
        titleButton.titleLabel?.font = AlmidyDesignTokens.Font.title(38)
        titleButton.titleLabel?.adjustsFontSizeToFitWidth = true
        titleButton.titleLabel?.minimumScaleFactor = 0.72
        titleButton.contentHorizontalAlignment = .left
        titleButton.accessibilityLabel = "My Trips"
        titleButton.accessibilityHint = "Shows trip collection options"
        let tripCollectionMenu = makeTripCollectionMenu()
        titleButton.menu = tripCollectionMenu
        titleButton.showsMenuAsPrimaryAction = true

        chevronButton.setImage(UIImage(systemName: "chevron.down"), for: .normal)
        chevronButton.tintColor = AlmidyDesignTokens.Color.textSecondary
        chevronButton.imageView?.contentMode = .scaleAspectFit
        chevronButton.accessibilityLabel = "Choose trip collection"
        chevronButton.menu = tripCollectionMenu
        chevronButton.showsMenuAsPrimaryAction = true
        chevronButton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            chevronButton.widthAnchor.constraint(equalToConstant: 32),
            chevronButton.heightAnchor.constraint(equalToConstant: 32)
        ])

        settingsButton.backgroundColor = AlmidyDesignTokens.Color.goldMutedSurface
        settingsButton.tintColor = AlmidyDesignTokens.Color.goldMuted
        settingsButton.layer.cornerRadius = 21
        settingsButton.setImage(NativeLaunchSettingsIcon.image, for: .normal)
        settingsButton.transform = CGAffineTransform(translationX: 0, y: -2)
        settingsButton.accessibilityLabel = "Open Settings"
        settingsButton.addTarget(self, action: #selector(openSettings), for: .touchUpInside)
        settingsButton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            settingsButton.widthAnchor.constraint(equalToConstant: 42),
            settingsButton.heightAnchor.constraint(equalToConstant: 42)
        ])

        let titleGroup = UIStackView(arrangedSubviews: [titleButton, chevronButton])
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
            constant: -32
        )
        expandedContentWidthConstraint.priority = .defaultHigh
        self.expandedContentWidthConstraint = expandedContentWidthConstraint
        let expandedScrollBottomToActionsConstraint = expandedScrollView.bottomAnchor.constraint(
            equalTo: collapsedActions.topAnchor,
            constant: -12
        )
        let expandedScrollBottomToSheetConstraint = expandedScrollView.bottomAnchor.constraint(
            equalTo: sheetView.bottomAnchor
        )
        self.expandedScrollBottomToActionsConstraint = expandedScrollBottomToActionsConstraint
        self.expandedScrollBottomToSheetConstraint = expandedScrollBottomToSheetConstraint

        NSLayoutConstraint.activate([
            sheetHandle.topAnchor.constraint(equalTo: sheetView.topAnchor, constant: 10),
            sheetHandle.centerXAnchor.constraint(equalTo: sheetView.centerXAnchor),
            sheetHandle.widthAnchor.constraint(equalToConstant: 36),
            sheetHandle.heightAnchor.constraint(equalToConstant: 6),

            headerStack.topAnchor.constraint(equalTo: sheetHandle.bottomAnchor, constant: 8),
            headerStack.centerXAnchor.constraint(equalTo: sheetView.centerXAnchor),
            headerStack.leadingAnchor.constraint(greaterThanOrEqualTo: sheetView.leadingAnchor, constant: 12),
            headerStack.trailingAnchor.constraint(lessThanOrEqualTo: sheetView.trailingAnchor, constant: -12),
            headerStack.widthAnchor.constraint(lessThanOrEqualToConstant: NativeAdaptiveLayout.cardMaxWidth),
            NativeAdaptiveLayout.preferredWidth(headerStack, equalTo: sheetView.widthAnchor, constant: -24),

            collapsedActions.centerXAnchor.constraint(equalTo: sheetView.centerXAnchor),
            collapsedActions.leadingAnchor.constraint(greaterThanOrEqualTo: sheetView.leadingAnchor, constant: 24),
            collapsedActions.trailingAnchor.constraint(lessThanOrEqualTo: sheetView.trailingAnchor, constant: -24),
            collapsedActions.widthAnchor.constraint(lessThanOrEqualToConstant: NativeAdaptiveLayout.cardMaxWidth),
            NativeAdaptiveLayout.preferredWidth(collapsedActions, equalTo: sheetView.widthAnchor, constant: -48),
            collapsedActions.bottomAnchor.constraint(equalTo: sheetView.bottomAnchor, constant: -24),
            collapsedActions.heightAnchor.constraint(equalToConstant: 48),

            expandedScrollView.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 8),
            expandedScrollView.leadingAnchor.constraint(equalTo: sheetView.leadingAnchor),
            expandedScrollView.trailingAnchor.constraint(equalTo: sheetView.trailingAnchor),

            expandedContentStack.topAnchor.constraint(equalTo: expandedScrollView.contentLayoutGuide.topAnchor),
            expandedContentStack.centerXAnchor.constraint(equalTo: expandedScrollView.frameLayoutGuide.centerXAnchor),
            expandedContentStack.leadingAnchor.constraint(greaterThanOrEqualTo: expandedScrollView.contentLayoutGuide.leadingAnchor, constant: 16),
            expandedContentStack.trailingAnchor.constraint(lessThanOrEqualTo: expandedScrollView.contentLayoutGuide.trailingAnchor, constant: -16),
            expandedContentStack.bottomAnchor.constraint(equalTo: expandedScrollView.contentLayoutGuide.bottomAnchor, constant: -40),
            expandedContentStack.widthAnchor.constraint(lessThanOrEqualTo: expandedScrollView.frameLayoutGuide.widthAnchor, constant: -32),
            expandedContentStack.widthAnchor.constraint(lessThanOrEqualToConstant: NativeAdaptiveLayout.cardMaxWidth),
            expandedContentWidthConstraint
        ])
        syncExpandedScrollBottomConstraint()
    }

    private func updateExpandedContentWidthPriority(for containerWidth: CGFloat) {
        let compactWidthLimit = NativeAdaptiveLayout.cardMaxWidth + 24
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
        keepActiveMapControlsFrontmost()
    }

    private func renderCollapsedActions() {
        let search = globeSheetIconButton(
            systemName: "magnifyingglass",
            accessibilityLabel: "Search the globe",
            backgroundColor: AlmidyDesignTokens.Color.card,
            tintColor: AlmidyDesignTokens.Color.textPrimary
        )
        search.transform = CGAffineTransform(translationX: -6, y: 0)
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

        let add = globeSheetIconButton(
            systemName: "plus",
            accessibilityLabel: "Create a trip",
            backgroundColor: AlmidyDesignTokens.Color.gold,
            tintColor: .white
        )
        add.transform = CGAffineTransform(translationX: 6, y: 0)
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
        let yearRow = UIView()
        let year = pillLabel(
            overviewYear,
            fontSize: 18,
            textColor: AlmidyDesignTokens.Color.goldMuted,
            backgroundColor: AlmidyDesignTokens.Color.goldMutedSurface
        )
        overviewYearPill = year
        year.translatesAutoresizingMaskIntoConstraints = false
        yearRow.addSubview(year)
        NSLayoutConstraint.activate([
            year.topAnchor.constraint(equalTo: yearRow.topAnchor),
            year.leadingAnchor.constraint(equalTo: yearRow.leadingAnchor),
            year.bottomAnchor.constraint(equalTo: yearRow.bottomAnchor),
            year.trailingAnchor.constraint(lessThanOrEqualTo: yearRow.trailingAnchor)
        ])
        expandedContentStack.addArrangedSubview(yearRow)

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
        expandedContentStack.setCustomSpacing(10, after: upcoming)

        for trip in trips {
            expandedContentStack.addArrangedSubview(tripCard(for: trip))
        }

        if reservationCardVisible {
            expandedContentStack.addArrangedSubview(
                NativeGlobeReservationAutomationView(
                    onOpen: { [weak self] in self?.openManualReservationImporter() },
                    onDismiss: { [weak self] in self?.dismissReservationCard() }
                )
            )
        }
    }

    private func makeTripCollectionMenu() -> UIMenu {
        let myTrips = UIAction(
            title: "My Trips",
            image: UIImage(systemName: "suitcase.fill"),
            state: .on
        ) { _ in }
        let friendsTrips = UIAction(
            title: "Friends' Trips",
            image: UIImage(systemName: "eye"),
            attributes: [.disabled]
        ) { _ in }
        return UIMenu(title: "", children: [myTrips, friendsTrips])
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
        stack.addArrangedSubview(actionButton(title: "Import a Reservation Manually", backgroundColor: AlmidyDesignTokens.Color.stateDisabledFill, textColor: AlmidyDesignTokens.Color.textPrimary, action: #selector(openManualReservationImporter), fontSize: 17, minHeight: 50, cornerRadius: AlmidyDesignTokens.Radius.capsule))
        stack.addArrangedSubview(actionButton(title: "Explore Sample Trip", backgroundColor: AlmidyDesignTokens.Color.stateDisabledFill, textColor: AlmidyDesignTokens.Color.textPrimary, action: #selector(openSampleTripPreview), fontSize: 17, minHeight: 50, cornerRadius: AlmidyDesignTokens.Radius.capsule))

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
        let card = NativeGlobeTripCardView(
            identifier: trip.id,
            title: trip.displayName,
            dates: trip.displayDateRange,
            status: trip.displayStatus,
            height: NativeTripCardLayout.height(for: trip.scheduleState(relativeTo: Date()))
        )
        card.addTarget(self, action: #selector(openTripAction(_:)), for: .touchUpInside)
        card.addInteraction(UIContextMenuInteraction(delegate: self))
        loadTripImage(into: card.mediaView, trip: trip)
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

    private func globeSheetIconButton(
        systemName: String,
        accessibilityLabel: String,
        backgroundColor: UIColor,
        tintColor: UIColor
    ) -> AlmidyIconButton {
        AlmidyIconButton(
            symbol: systemName,
            style: .floating,
            accessibilityLabel: accessibilityLabel,
            overrides: .init(
                diameter: 48,
                foregroundColor: tintColor,
                backgroundColor: backgroundColor,
                elevation: .init(
                    color: AlmidyDesignTokens.Color.shadowBlack,
                    opacity: 0.08,
                    radius: 18,
                    offset: CGSize(width: 0, height: 9)
                )
            )
        )
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
        let label = PaddingLabel(insets: UIEdgeInsets(top: 7, left: 12, bottom: 7, right: 12))
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
        collapsedActions.isHidden = trips.isEmpty
        expandedScrollView.isHidden = sheetState == .collapsed
        firstTripCard?.isHidden = !(trips.isEmpty && sheetState == .collapsed)
        chevronButton.transform = .identity
        syncExpandedScrollBottomConstraint()
    }

    private func syncExpandedScrollBottomConstraint() {
        let pinsToActions = !trips.isEmpty
        expandedScrollBottomToActionsConstraint?.isActive = pinsToActions
        expandedScrollBottomToSheetConstraint?.isActive = !pinsToActions
    }

    private func applySheetState(_ state: SheetState, animated: Bool) {
        sheetState = state
        sheetHeightConstraint?.constant = height(for: state)
        let horizontalInset: CGFloat = state == .expanded ? 0 : 8
        sheetLeadingConstraint?.constant = horizontalInset
        sheetTrailingConstraint?.constant = -horizontalInset
        let changes = {
            self.syncSheetVisibility()
            self.keepActiveMapControlsFrontmost()
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
            // Match UIKit's maximum page-sheet boundary used by Trip Overview
            // and every other full-height native destination. The My Trips
            // surface is custom, so it must account for UIKit's additional
            // top presentation clearance explicitly.
            return fullHeight - view.safeAreaInsets.top - 22
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

    func mapViewDidFinishLoadingMap(_ mapView: MKMapView) {
        if mapFallbackReason == .serviceUnavailable && isConnected != false {
            restoreOnlineMap()
        }

        // A tile/style reload can finish after the activity results arrive.
        // Reconcile the overlay so the collapsed sheet never exposes a
        // correctly framed map without its corresponding result pins.
        let missingAnnotations = activitySearchAnnotations.filter { candidate in
            !mapView.annotations.contains { ($0 as AnyObject) === candidate }
        }
        if !missingAnnotations.isEmpty {
            mapView.addAnnotations(missingAnnotations)
            if selectedActivityPlaceID == nil {
                fitActivitySearchAnnotations(activitySearchAnnotations)
            }
        }
    }

    func mapView(_ mapView: MKMapView, didAdd views: [MKAnnotationView]) {
        for view in views where view.annotation is NativeActivitySearchAnnotation {
            view.isHidden = false
            view.alpha = 1
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

        if let activity = annotation as? NativeActivitySearchAnnotation {
            let identifier = "activity-search-result"
            let annotationView = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) as? NativeActivitySearchAnnotationView
                ?? NativeActivitySearchAnnotationView(annotation: activity, reuseIdentifier: identifier)
            annotationView.annotation = activity
            annotationView.configure(with: activity)
            return annotationView
        }

        guard let tripAnnotation = annotation as? NativeTripAnnotation else { return nil }
        let identifier = "trip-country-flag"
        let annotationView = mapView.dequeueReusableAnnotationView(withIdentifier: identifier) as? NativeTripFlagAnnotationView
            ?? NativeTripFlagAnnotationView(annotation: tripAnnotation, reuseIdentifier: identifier)
        annotationView.annotation = annotation
        annotationView.canShowCallout = false
        annotationView.rightCalloutAccessoryView = nil
        annotationView.configure(with: tripAnnotation.countryPresentation)
        return annotationView
    }

    @available(iOS 18.0, *)
    func mapView(
        _ mapView: MKMapView,
        selectionAccessoryFor annotation: MKAnnotation
    ) -> MKSelectionAccessory? {
        guard annotation is MKMapFeatureAnnotation || annotation is MKMapItemAnnotation else {
            return nil
        }
        return .mapItemDetail(.callout(.full))
    }

    func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
        let renderer = MKPolylineRenderer(overlay: overlay)
        if overlay === activityRouteOverlay {
            renderer.strokeColor = .systemBlue
            renderer.lineWidth = 5
        } else if transportationRouteOverlays.contains(where: { $0 === overlay }) {
            renderer.strokeColor = AlmidyDesignTokens.Color.tripOverviewAccent
            renderer.lineWidth = 4
        } else if flightRouteOverlays.contains(where: { $0 === overlay }) {
            renderer.strokeColor = AlmidyDesignTokens.Color.gold
            renderer.lineWidth = 3
            renderer.lineDashPattern = [8, 6]
        } else {
            return MKOverlayRenderer(overlay: overlay)
        }
        renderer.lineCap = .round
        renderer.lineJoin = .round
        return renderer
    }

    func mapView(_ mapView: MKMapView, didSelect annotation: MKAnnotation) {
        if #available(iOS 16.0, *), let feature = annotation as? MKMapFeatureAnnotation {
            if #available(iOS 18.0, *) {
                // MapKit owns the full Place Card callout through the selection
                // accessory delegate on current systems.
                return
            }
            presentMapFeaturePlaceDetails(feature)
            return
        }
        if let activity = annotation as? NativeActivitySearchAnnotation {
            if suppressedActivitySelectionID == activity.resultID {
                suppressedActivitySelectionID = nil
                return
            }
            selectedActivityPlaceID = activity.resultID
            selectedActivityMapItem = activity.mapItem
            activityResultSelectionHandler?(activity.resultID)
            if activitySelectionCameraToRestore == nil {
                activitySelectionCameraToRestore = mapView.camera.copy() as? MKMapCamera
            }
            mapView.setCamera(
                MKMapCamera(
                    lookingAtCenter: activity.coordinate,
                    fromDistance: 12_000,
                    pitch: 42,
                    heading: mapView.camera.heading
                ),
                animated: true
            )
            presentActivityPlaceDetails(activity)
            return
        }
        guard let tripAnnotation = annotation as? NativeTripAnnotation else { return }
        mapView.deselectAnnotation(tripAnnotation, animated: false)
        presentTripOverview(for: tripAnnotation.trip)
    }

    func mapView(_ mapView: MKMapView, didDeselect annotation: MKAnnotation) {
        if #available(iOS 16.0, *), annotation is MKMapFeatureAnnotation {
            dismissSelectedPlaceDetails(afterDeselecting: annotation)
            return
        }
        guard let activity = annotation as? NativeActivitySearchAnnotation else { return }
        dismissSelectedPlaceDetails(afterDeselecting: activity)
    }

    private func dismissSelectedPlaceDetails(afterDeselecting annotation: MKAnnotation) {
        let selectionID = placeSelectionID(for: annotation)
        DispatchQueue.main.async { [weak self] in
            guard let self,
                  self.selectedActivityPlaceID == selectionID,
                  self.mapView.selectedAnnotations.isEmpty else { return }
            self.selectedActivityPlaceID = nil
            self.selectedActivityMapItem = nil
            self.activityPlaceResolutionGeneration += 1
            let presenter = self.topmostPresentedViewController(from: self)
            if let details = presenter as? NativeActivityPlaceDetailsViewController,
               details.selectionPlaceID == selectionID {
                details.dismiss(animated: true) { [weak self] in
                    self?.restoreActivitySelectionCamera()
                }
            } else {
                self.restoreActivitySelectionCamera()
            }
        }
    }

    private func placeSelectionID(for annotation: MKAnnotation) -> String {
        if let activity = annotation as? NativeActivitySearchAnnotation {
            return activity.resultID
        }
        return String(
            format: "map-feature:%.6f|%.6f",
            annotation.coordinate.latitude,
            annotation.coordinate.longitude
        )
    }

    @available(iOS 16.0, *)
    private func presentMapFeaturePlaceDetails(_ feature: MKMapFeatureAnnotation) {
        let selectionID = placeSelectionID(for: feature)
        selectedActivityPlaceID = selectionID
        if activitySelectionCameraToRestore == nil {
            activitySelectionCameraToRestore = mapView.camera.copy() as? MKMapCamera
        }
        activityPlaceResolutionGeneration += 1
        let generation = activityPlaceResolutionGeneration
        let request = MKMapItemRequest(mapFeatureAnnotation: feature)
        request.getMapItem { [weak self, weak feature] mapItem, _ in
            DispatchQueue.main.async {
                guard let self,
                      let feature,
                      let mapItem,
                      generation == self.activityPlaceResolutionGeneration,
                      self.selectedActivityPlaceID == selectionID,
                      self.mapView.selectedAnnotations.contains(where: { ($0 as AnyObject) === feature }) else { return }
                let presenter = self.topmostPresentedViewController(from: self)
                guard !(presenter is UIActivityViewController) else { return }
                let category = self.activityCategory(for: mapItem, feature: feature)
                self.presentActivityPlaceDetails(
                    mapItem,
                    selectionPlaceID: selectionID,
                    category: category,
                    from: presenter,
                    onSave: { [weak self] completion in
                        self?.savePlaceToActiveItinerary(
                            mapItem,
                            category: category,
                            completion: completion
                        )
                    }
                )
            }
        }
    }

    @available(iOS 16.0, *)
    private func activityCategory(for mapItem: MKMapItem, feature: MKMapFeatureAnnotation) -> NativeActivityCategory {
        let categoryText = (mapItem.pointOfInterestCategory ?? feature.pointOfInterestCategory)?.rawValue.lowercased() ?? ""
        let categories = NativeActivityCatalog.quickItems + NativeActivityCatalog.sections.flatMap(\.items)
        return categories.first { category in
            let words = category.name.lowercased().split(separator: " ")
            return words.allSatisfy { categoryText.contains($0) }
        } ?? NativeActivityCatalog.category(named: "Location")!
    }

    private func presentActivityPlaceDetails(_ annotation: NativeActivitySearchAnnotation) {
        let presenter = topmostPresentedViewController(from: self)
        if let existingDetails = presenter as? NativeActivityPlaceDetailsViewController {
            guard existingDetails.selectionPlaceID != annotation.resultID else { return }
            // MapKit selects the newly tapped annotation before this callback.
            // Replace the existing sheet so its content always comes from that
            // annotation's MKMapItem instead of retaining the previous place.
            existingDetails.dismiss(animated: false) { [weak self] in
                self?.presentActivityPlaceDetails(annotation)
            }
            return
        }
        guard !(presenter is UIActivityViewController) else { return }
        if activitySheetDetentToRestore == nil {
            activitySheetDetentToRestore = presenter.sheetPresentationController?.selectedDetentIdentifier
        }
        activityPlaceResolutionGeneration += 1
        let generation = activityPlaceResolutionGeneration
        NativeActivityPlaceResolver.resolveLatest(annotation.mapItem) { [weak self, weak presenter] mapItem in
            guard let self,
                  let presenter,
                  generation == self.activityPlaceResolutionGeneration,
                  self.selectedActivityPlaceID == annotation.resultID else { return }
            self.activityResolvedPlaceHandler?(annotation.resultID, mapItem)
            self.selectedActivityMapItem = mapItem
            let resolvedAnnotation = self.replaceActivityAnnotation(
                annotation,
                with: mapItem
            )
            self.presentActivityPlaceDetails(
                mapItem,
                selectionPlaceID: resolvedAnnotation.resultID,
                category: resolvedAnnotation.category,
                from: presenter,
                onSave: { [weak self] completion in
                    self?.savePlaceToActiveItinerary(
                        mapItem,
                        category: resolvedAnnotation.category,
                        completion: completion
                    )
                }
            )
        }
    }

    private func replaceActivityAnnotation(
        _ annotation: NativeActivitySearchAnnotation,
        with mapItem: MKMapItem
    ) -> NativeActivitySearchAnnotation {
        let replacement = NativeActivitySearchAnnotation(
            mapItem: mapItem,
            category: annotation.category,
            isFocused: true,
            rank: annotation.rank
        )
        guard let index = activitySearchAnnotations.firstIndex(where: { $0 === annotation }) else {
            return annotation
        }
        activitySearchAnnotations[index] = replacement
        selectedActivityPlaceID = replacement.resultID
        mapView.removeAnnotation(annotation)
        mapView.addAnnotation(replacement)
        suppressedActivitySelectionID = replacement.resultID
        mapView.selectAnnotation(replacement, animated: false)
        mapView.setCamera(
            MKMapCamera(
                lookingAtCenter: replacement.coordinate,
                fromDistance: 12_000,
                pitch: 42,
                heading: mapView.camera.heading
            ),
            animated: true
        )
        return replacement
    }

    private func presentActivityPlaceDetails(
        _ mapItem: MKMapItem,
        selectionPlaceID: String,
        category: NativeActivityCategory,
        from presenter: UIViewController,
        onSave: @escaping (@escaping (Result<NativeSavedPlaceSegment, Error>) -> Void) -> Void
    ) {
        guard presenter.presentedViewController == nil else { return }
        let origin = locationManager.location?.coordinate
            ?? mapView.userLocation.location?.coordinate
            ?? activitySearchRegion.center
        let routeMapItem = selectedActivityMapItem ?? mapItem
        let details = NativeActivityPlaceDetailsViewController(
            mapItem: routeMapItem,
            selectionPlaceID: selectionPlaceID,
            category: category,
            origin: origin
        ) { completion in
            onSave(completion)
        } onSaved: { [weak self] segment in
            self?.presentSavedPlaceDetailsForm(mapItem, category: category, segment: segment)
        } onRouteChanged: { [weak self] routes in
            self?.displayActivityRoute(routes.first)
        } onClose: { [weak self] in
            self?.restoreActivitySelectionCamera()
        }
        NativeActivityPlaceDetailsViewController.sheetConfiguration.apply(to: details)
        details.presentationController?.delegate = self
        presenter.present(details, animated: true)
    }

    private func presentSavedPlaceDetailsForm(
        _ mapItem: MKMapItem,
        category: NativeActivityCategory,
        segment: NativeSavedPlaceSegment
    ) {
        guard let tripID = tripOverviewTripIDToRestoreAfterActivity else { return }
        let presenter = topmostPresentedViewController(from: self)
        let form = NativeManualFlightRouteViewController(
            accent: category.palette.tint,
            isLocation: true,
            nearbyCoordinate: mapItem.placemark.coordinate,
            tripID: tripID,
            initialDepartureDate: segment.startTime.flatMap { value in
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                return formatter.date(from: value)
            },
            initialLocationMapItem: mapItem,
            initialLocationCategory: NativeActivityPurposeRegistry.purpose(for: category).searchToken,
            savedPlaceSegmentID: segment.id,
            onSubmitSavedPlace: { [weak self] draft, completion in
                guard let self else { return }
                self.placeItineraryClient.update(segmentID: segment.id, draft: draft) { result in
                    completion(result.map { _ in () })
                }
            },
            onSavedPlaceUpdated: { [weak self] in
                self?.refreshTripsFromServer()
                self?.refreshItineraryRouteOverlays()
                self?.activityResultSelectionHandler?(NativeActivityPlaceIdentity.value(for: mapItem))
            }
        )
        form.modalPresentationStyle = .pageSheet
        form.modalPresentationCapturesStatusBarAppearance = true
        if let sheet = form.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = 36
            sheet.prefersScrollingExpandsWhenScrolledToEdge = false
        }
        presenter.present(form, animated: true)
    }

    private func savePlaceToActiveItinerary(
        _ mapItem: MKMapItem,
        category: NativeActivityCategory,
        completion: @escaping (Result<NativeSavedPlaceSegment, Error>) -> Void
    ) {
        guard let tripID = tripOverviewTripIDToRestoreAfterActivity,
              let trip = trips.first(where: { $0.id == tripID }) else {
            completion(.failure(NSError(
                domain: "app.almidy.place-card",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "No active trip was found."]
            )))
            return
        }
        placeItineraryClient.save(
            mapItem: mapItem,
            category: category,
            tripID: tripID,
            startAt: itineraryDate(for: trip)
        ) { [weak self] result in
            DispatchQueue.main.async {
                if case .success = result {
                    self?.activityResultSelectionHandler?(NativeActivityPlaceIdentity.value(for: mapItem))
                    self?.refreshItineraryRouteOverlays()
                }
                completion(result)
            }
        }
    }

    private func itineraryDate(for trip: NativeMapTrip) -> Date {
        let parser = DateFormatter()
        parser.calendar = Calendar(identifier: .gregorian)
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = NativeTimeZonePreference.timeZone
        parser.dateFormat = "yyyy-MM-dd"
        guard let start = trip.startDate.flatMap(parser.date) else { return Date() }
        let end = trip.endDate.flatMap(parser.date) ?? start
        let calendar = parser.calendar!
        let today = calendar.startOfDay(for: Date())
        let selectedDay = min(max(today, calendar.startOfDay(for: start)), calendar.startOfDay(for: end))
        return calendar.date(bySettingHour: 12, minute: 0, second: 0, of: selectedDay) ?? selectedDay
    }

    private func restoreActivitySelectionCamera(animated: Bool = true) {
        let camera = activitySelectionCameraToRestore
        activitySelectionCameraToRestore = nil
        selectedActivityPlaceID = nil
        selectedActivityMapItem = nil
        displayActivityRoute(nil)
        suppressedActivitySelectionID = nil
        mapView.selectedAnnotations.forEach { mapView.deselectAnnotation($0, animated: animated) }
        activityResultSelectionHandler?(nil)
        if let camera {
            mapView.setCamera(camera, animated: animated)
        }

        let detent = activitySheetDetentToRestore
        activitySheetDetentToRestore = nil
        guard let detent,
              let sheet = presentedViewController?.sheetPresentationController else { return }
        sheet.animateChanges {
            sheet.selectedDetentIdentifier = detent
        }
    }

    private func displayActivityRoute(_ route: MKRoute?) {
        if let activityRouteOverlay {
            mapView.removeOverlay(activityRouteOverlay)
        }
        activityRouteOverlay = route?.polyline
        if let activityRouteOverlay {
            mapView.addOverlay(activityRouteOverlay, level: .aboveRoads)
            if let selectedActivityPlaceID,
               let destination = activitySearchAnnotations.first(where: { $0.resultID == selectedActivityPlaceID }),
               !mapView.selectedAnnotations.contains(where: { $0 === destination }) {
                mapView.selectAnnotation(destination, animated: false)
            }
            let routeRect = activityRouteOverlay.boundingMapRect
            guard !routeRect.isNull, !routeRect.isEmpty else { return }
            mapView.setVisibleMapRect(
                routeRect,
                edgePadding: UIEdgeInsets(
                    top: max(96, view.safeAreaInsets.top + 56),
                    left: 44,
                    bottom: max(220, view.bounds.height * 0.42),
                    right: 44
                ),
                animated: true
            )
        }
    }

    private func refreshItineraryRouteOverlays() {
        itineraryRouteGeneration += 1
        let generation = itineraryRouteGeneration
        itineraryRouteDirections.forEach { $0.cancel() }
        itineraryRouteDirections.removeAll()
        mapView.removeOverlays(transportationRouteOverlays)
        mapView.removeOverlays(flightRouteOverlays)
        transportationRouteOverlays.removeAll()
        flightRouteOverlays.removeAll()

        for trip in trips {
            itineraryRequester.load(tripID: trip.id) { [weak self] result in
                guard let self, generation == self.itineraryRouteGeneration,
                      case .success(let items) = result else { return }
                items.forEach { self.buildItineraryRoute(for: $0, generation: generation) }
            }
        }
    }

    private func buildItineraryRoute(for item: NativeItineraryItem, generation: Int) {
        guard let departureLatitude = item.departureLatitude,
              let departureLongitude = item.departureLongitude,
              let arrivalLatitude = item.arrivalLatitude,
              let arrivalLongitude = item.arrivalLongitude else { return }
        let departure = CLLocationCoordinate2D(latitude: departureLatitude, longitude: departureLongitude)
        let arrival = CLLocationCoordinate2D(latitude: arrivalLatitude, longitude: arrivalLongitude)
        guard CLLocationCoordinate2DIsValid(departure), CLLocationCoordinate2DIsValid(arrival) else { return }

        if item.kind == .flight {
            let coordinates = [departure, arrival]
            let overlay = MKGeodesicPolyline(coordinates: coordinates, count: coordinates.count)
            flightRouteOverlays.append(overlay)
            applyItineraryRouteVisibility()
            return
        }

        guard let kind = item.kind else { return }
        let request = MKDirections.Request()
        request.source = MKMapItem(placemark: MKPlacemark(coordinate: departure))
        request.destination = MKMapItem(placemark: MKPlacemark(coordinate: arrival))
        request.requestsAlternateRoutes = false
        switch kind {
        case .walk: request.transportType = .walking
        case .bike:
            if #available(iOS 26.0, *) { request.transportType = .cycling }
            else { request.transportType = .walking }
        case .train, .bus, .ferry, .cruise: request.transportType = .transit
        default: request.transportType = .automobile
        }
        let directions = MKDirections(request: request)
        itineraryRouteDirections.append(directions)
        directions.calculate { [weak self, weak directions] response, _ in
            DispatchQueue.main.async {
                guard let self, let directions,
                      generation == self.itineraryRouteGeneration else { return }
                self.itineraryRouteDirections.removeAll { $0 === directions }
                guard let overlay = response?.routes.first?.polyline else { return }
                self.transportationRouteOverlays.append(overlay)
                self.applyItineraryRouteVisibility()
            }
        }
    }

    private func applyItineraryRouteVisibility(
        showsTransportation: Bool? = nil,
        showsFlights: Bool? = nil
    ) {
        let defaults = UserDefaults.standard
        let transportationKey = "almidy.native.map.showsTransportationRoutes"
        let flightKey = "almidy.native.map.showsFlightRoutes"
        let transportationIsVisible = showsTransportation
            ?? (defaults.object(forKey: transportationKey) == nil ? true : defaults.bool(forKey: transportationKey))
        let flightsAreVisible = showsFlights
            ?? (defaults.object(forKey: flightKey) == nil ? true : defaults.bool(forKey: flightKey))

        mapView.removeOverlays(transportationRouteOverlays)
        mapView.removeOverlays(flightRouteOverlays)
        if transportationIsVisible {
            mapView.addOverlays(transportationRouteOverlays, level: .aboveRoads)
        }
        if flightsAreVisible {
            mapView.addOverlays(flightRouteOverlays, level: .aboveLabels)
        }
    }

    func mapView(_ mapView: MKMapView, annotationView view: MKAnnotationView, calloutAccessoryControlTapped control: UIControl) {
        guard let tripAnnotation = view.annotation as? NativeTripAnnotation else { return }
        openTripOverview(tripAnnotation.trip)
    }

    @objc private func toggleMapMode() {
        let defaults = UserDefaults.standard
        let transportationKey = "almidy.native.map.showsTransportationRoutes"
        let flightKey = "almidy.native.map.showsFlightRoutes"
        let showsTransportationRoutes = defaults.object(forKey: transportationKey) == nil
            ? true
            : defaults.bool(forKey: transportationKey)
        let showsFlightRoutes = defaults.object(forKey: flightKey) == nil
            ? true
            : defaults.bool(forKey: flightKey)
        // This preference controls itinerary transportation overlays, not
        // Apple's live congestion layer. Traffic colors would alter the map
        // even when the itinerary has no transportation route to display.
        mapView.showsTraffic = false

        let preferences = NativeMapPreferencesViewController(
            usesHybridMap: mapPresentationMode != .standard,
            showsTransportationRoutes: showsTransportationRoutes,
            showsFlightRoutes: showsFlightRoutes,
            previewCoordinate: mapView.camera.centerCoordinate
        ) { [weak self] usesHybridMap, showsTransportationRoutes, showsFlightRoutes in
            guard let self else { return }
            self.applyMapPresentation(usesHybridMap ? .hybrid : .standard)
            self.mapView.showsTraffic = false
            defaults.set(showsTransportationRoutes, forKey: transportationKey)
            defaults.set(showsFlightRoutes, forKey: flightKey)
            self.applyItineraryRouteVisibility(
                showsTransportation: showsTransportationRoutes,
                showsFlights: showsFlightRoutes
            )
        }

        let presenter = topmostPresentedViewController(from: self)
        NativeMapPreferencesViewController.sheetConfiguration.apply(to: preferences)
        presenter.present(preferences, animated: true)
    }

    private func topmostPresentedViewController(from root: UIViewController) -> UIViewController {
        var top = root
        while let presented = top.presentedViewController, !presented.isBeingDismissed {
            top = presented
        }
        return top
    }

    @objc private func resetMapOrientation() {
        mapView.setCamera(
            MKMapCamera(
                lookingAtCenter: mapView.camera.centerCoordinate,
                fromDistance: mapView.camera.centerCoordinateDistance,
                pitch: 0,
                heading: 0
            ),
            animated: true
        )
    }

    @objc private func requestCurrentLocation() {
        guard !isRequestingLocationAuthorization else { return }
        shouldCenterRequestedLocation = true

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
            shouldCenterRequestedLocation = false
            break
        @unknown default:
            shouldCenterRequestedLocation = false
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
        let explicitlyRequested = shouldCenterRequestedLocation
        shouldCenterRequestedLocation = false
        guard explicitlyRequested || !hasCenteredInitialLocation else { return }
        hasCenteredInitialLocation = true
        mapView.setUserTrackingMode(.none, animated: false)

        // A populated globe has a deliberate launch composition. Location is
        // shown as an annotation, but it must not replace the user's camera or
        // opt the map into follow mode unless the user explicitly asks it to.
        guard explicitlyRequested || trips.isEmpty else { return }
        mapView.setCamera(
            MKMapCamera(
                lookingAtCenter: coordinate,
                fromDistance: explicitlyRequested ? 18_000 : 3_600_000,
                pitch: 0,
                heading: 0
            ),
            animated: true
        )
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}

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
        AlmidySheetConfiguration.utility.apply(to: settings)
        if let sheet = settings.sheetPresentationController {
            // Height and compact-width geometry remain feature-specific; the
            // utility configuration owns the shared presentation chrome.
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
        }
        present(settings, animated: true)
    }

    private func presentNativeAccount() {
        let presentAccount: () -> Void = { [weak self] in
            guard let self else { return }
            let isSignedIn = NativeSessionCoordinator.shared.verifiedUserID != nil
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
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                sheet.prefersGrabberVisible = true
                sheet.preferredCornerRadius = 28
            }
            self.present(account, animated: true)
        }

        presentAccount()
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
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
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
        guard NativeWebRoutePolicy.allows(route) else {
#if DEBUG
            assertionFailure("Attempted to open a route that is not controlled-WebView owned: \(URL(string: route)?.path ?? "invalid")")
#endif
            showUnavailableRouteMessage()
            return
        }
        let previousSheetState = sheetState
        let presentFeature: (NativeAuthSession) -> Void = { [weak self] nativeSession in
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
                nativeSession: nativeSession,
                onAuthFailure: { [weak self] in
                    guard let self, self.presentedViewController == nil else { return }
                    self.presentNativeAuth()
                }
            )
            self.present(feature, animated: true)
        }

        let restoreAndPresent: () -> Void = { [weak self] in
            guard let self else { return }
            NativeSessionCoordinator.shared.validSession { [weak self] result in
                DispatchQueue.main.async {
                    guard let self else { return }
                    switch result {
                    case .success(let session):
                        presentFeature(session)
                    case .failure:
                        self.presentNativeAuth()
                    }
                }
            }
        }

        restoreAndPresent()
    }

    @objc private func openSearch() {
        presentMapSearch(purpose: nil)
    }

    private func openActivitySearch(for category: NativeActivityCategory) {
        if category.name.localizedCaseInsensitiveCompare("Flights") == .orderedSame
            || category.name.localizedCaseInsensitiveCompare("Flight") == .orderedSame {
            let controller = NativeFlightSearchViewController(accent: category.palette.tint)
            controller.modalPresentationStyle = .pageSheet
            if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                sheet.prefersGrabberVisible = false
                sheet.preferredCornerRadius = 36
            }
            present(controller, animated: true)
            return
        }
        if category.name.localizedCaseInsensitiveCompare("Car") == .orderedSame {
            let controller = NativeManualFlightRouteViewController(
                accent: category.palette.tint,
                isCarRoute: true,
                nearbyCoordinate: mapView.centerCoordinate
            )
            controller.modalPresentationStyle = .pageSheet
            if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                sheet.prefersGrabberVisible = false
                sheet.preferredCornerRadius = 34
            }
            present(controller, animated: true)
            return
        }
        if category.name.localizedCaseInsensitiveCompare("Train") == .orderedSame {
            let controller = NativeManualFlightRouteViewController(
                accent: category.palette.tint,
                isTrainRoute: true,
                nearbyCoordinate: mapView.centerCoordinate
            )
            controller.modalPresentationStyle = .pageSheet
            if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                sheet.prefersGrabberVisible = false
                sheet.preferredCornerRadius = 34
            }
            present(controller, animated: true)
            return
        }
        if category.name.localizedCaseInsensitiveCompare("Car Rental") == .orderedSame {
            let controller = NativeManualFlightRouteViewController(
                accent: category.palette.tint,
                isCarRental: true,
                nearbyCoordinate: mapView.centerCoordinate
            )
            controller.modalPresentationStyle = .pageSheet
            if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                sheet.prefersGrabberVisible = false
                sheet.preferredCornerRadius = 34
            }
            present(controller, animated: true)
            return
        }
        if category.name.localizedCaseInsensitiveCompare("Transfer") == .orderedSame {
            let controller = NativeManualFlightRouteViewController(
                accent: category.palette.tint,
                isTransferRoute: true,
                nearbyCoordinate: mapView.centerCoordinate
            )
            controller.modalPresentationStyle = .pageSheet
            if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                sheet.prefersGrabberVisible = false
                sheet.preferredCornerRadius = 34
            }
            present(controller, animated: true)
            return
        }
        if category.name.localizedCaseInsensitiveCompare("Cruise") == .orderedSame {
            let controller = NativeManualFlightRouteViewController(
                accent: category.palette.tint,
                isCruiseRoute: true,
                nearbyCoordinate: mapView.centerCoordinate
            )
            controller.modalPresentationStyle = .pageSheet
            if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                sheet.prefersGrabberVisible = false
                sheet.preferredCornerRadius = 34
            }
            present(controller, animated: true)
            return
        }
        if category.name.localizedCaseInsensitiveCompare("Walk") == .orderedSame {
            let controller = NativeManualFlightRouteViewController(
                accent: category.palette.tint,
                isWalkRoute: true,
                nearbyCoordinate: mapView.centerCoordinate
            )
            controller.modalPresentationStyle = .pageSheet
            if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                sheet.prefersGrabberVisible = false
                sheet.preferredCornerRadius = 34
            }
            present(controller, animated: true)
            return
        }
        if category.name.localizedCaseInsensitiveCompare("Bus") == .orderedSame {
            let controller = NativeManualFlightRouteViewController(
                accent: category.palette.tint,
                isBusRoute: true,
                nearbyCoordinate: mapView.centerCoordinate
            )
            controller.modalPresentationStyle = .pageSheet
            if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                sheet.prefersGrabberVisible = false
                sheet.preferredCornerRadius = 34
            }
            present(controller, animated: true)
            return
        }
        if category.name.localizedCaseInsensitiveCompare("Bike") == .orderedSame {
            let controller = NativeManualFlightRouteViewController(
                accent: category.palette.tint,
                isBikeRoute: true,
                nearbyCoordinate: mapView.centerCoordinate
            )
            controller.modalPresentationStyle = .pageSheet
            if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                sheet.prefersGrabberVisible = false
                sheet.preferredCornerRadius = 34
            }
            present(controller, animated: true)
            return
        }
        if category.name.localizedCaseInsensitiveCompare("Ferry") == .orderedSame {
            let controller = NativeManualFlightRouteViewController(
                accent: category.palette.tint,
                isFerryRoute: true,
                nearbyCoordinate: mapView.centerCoordinate
            )
            controller.modalPresentationStyle = .pageSheet
            if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                sheet.prefersGrabberVisible = false
                sheet.preferredCornerRadius = 34
            }
            present(controller, animated: true)
            return
        }
        if category.name.localizedCaseInsensitiveCompare("Motorcycle") == .orderedSame {
            let controller = NativeManualFlightRouteViewController(
                accent: category.palette.tint,
                isMotorcycleRoute: true,
                nearbyCoordinate: mapView.centerCoordinate
            )
            controller.modalPresentationStyle = .pageSheet
            if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                sheet.prefersGrabberVisible = false
                sheet.preferredCornerRadius = 34
            }
            present(controller, animated: true)
            return
        }
        presentMapSearch(purpose: NativeActivityPurposeRegistry.purpose(for: category))
    }

    private func updateGlobeActivityFilter(
        category: NativeActivityCategory?,
        query: String,
        nearby: Bool,
        selectedResultID: String?,
        searchRegion: MKCoordinateRegion?,
        orderedResults: [MKMapItem]? = nil
    ) {
        activityCameraFitGeneration += 1
        if category == nil {
            // A Place ID lookup may still be in flight when the user clears or
            // dismisses discovery. Invalidate it so a late response cannot
            // reopen place details after that flow has ended.
            activityPlaceResolutionGeneration += 1
            selectedActivityPlaceID = nil
            suppressedActivitySelectionID = nil
        }
        mapControlStack.isHidden = category == nil
        if category != nil {
            view.bringSubviewToFront(mapControlStack)
        }
        activityFilterSearch?.cancel()
        activityFilterSearch = nil
        mapView.removeAnnotations(activitySearchAnnotations)
        // Also remove annotations created before the retained collection was
        // introduced, then atomically replace both the list and globe model.
        mapView.removeAnnotations(mapView.annotations.filter { $0 is NativeActivitySearchAnnotation })
        activitySearchAnnotations = []

        guard let category else { return }
        selectedActivityPlaceID = selectedResultID
        if let orderedResults {
            let annotations = orderedResults.enumerated().map { index, item in
                NativeActivitySearchAnnotation(
                    mapItem: item,
                    category: category,
                    isFocused: NativeActivityPlaceIdentity.value(for: item) == selectedActivityPlaceID,
                    rank: index
                )
            }
            activitySearchAnnotations = annotations
            mapView.addAnnotations(annotations)
            guard !annotations.isEmpty else { return }
            if let selectedResultID,
               let annotation = annotations.first(where: { $0.resultID == selectedResultID }) {
                mapView.setCamera(
                    MKMapCamera(
                        lookingAtCenter: annotation.coordinate,
                        fromDistance: 12_000,
                        pitch: 42,
                        heading: mapView.camera.heading
                    ),
                    animated: true
                )
                mapView.selectAnnotation(annotation, animated: true)
            } else {
                fitActivitySearchAnnotations(annotations)
            }
            return
        }
        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)

        let purpose = NativeActivityPurposeRegistry.purpose(for: category)
        let filter = purpose.queryTerms.first ?? purpose.searchToken
        let request = MKLocalSearch.Request()
        var requestedRegion: MKCoordinateRegion?
        if selectedResultID != nil {
            request.naturalLanguageQuery = trimmedQuery
            request.resultTypes = [.pointOfInterest, .address]
        } else {
            let alreadyContainsFilter = trimmedQuery.localizedCaseInsensitiveContains(filter)
            request.naturalLanguageQuery = trimmedQuery.isEmpty
                ? filter
                : (alreadyContainsFilter ? trimmedQuery : "\(filter) \(trimmedQuery)")
            request.resultTypes = .pointOfInterest
        }
        if let searchRegion {
            // Discovery is deliberately city-scoped. Camera framing is handled
            // independently after MapKit returns the matching annotations.
            request.region = MKCoordinateRegion(
                center: searchRegion.center,
                latitudinalMeters: Self.activityDiscoveryDiameter,
                longitudinalMeters: Self.activityDiscoveryDiameter
            )
            requestedRegion = request.region
        } else {
            request.region = activitySearchRegion
            requestedRegion = request.region
        }

        let search = MKLocalSearch(request: request)
        activityFilterSearch = search
        search.start { [weak self, weak search] response, _ in
            DispatchQueue.main.async {
                guard let self, self.activityFilterSearch === search else { return }
                self.activityFilterSearch = nil
                let returnedItems = response?.mapItems ?? []
                let mapItems: [MKMapItem]
                if selectedResultID == nil,
                   !trimmedQuery.localizedCaseInsensitiveContains(" in "),
                   let requestedRegion {
                    let center = CLLocation(
                        latitude: requestedRegion.center.latitude,
                        longitude: requestedRegion.center.longitude
                    )
                    let north = CLLocation(
                        latitude: requestedRegion.center.latitude + requestedRegion.span.latitudeDelta / 2,
                        longitude: requestedRegion.center.longitude
                    )
                    let east = CLLocation(
                        latitude: requestedRegion.center.latitude,
                        longitude: requestedRegion.center.longitude + requestedRegion.span.longitudeDelta / 2
                    )
                    let radius = max(center.distance(from: north), center.distance(from: east)) * 1.25
                    mapItems = returnedItems.filter {
                        center.distance(from: CLLocation(
                            latitude: $0.placemark.coordinate.latitude,
                            longitude: $0.placemark.coordinate.longitude
                        )) <= radius
                    }
                } else {
                    mapItems = returnedItems
                }
                let selectedTitle = trimmedQuery.split(separator: ",", maxSplits: 1).first.map(String.init)
                let visibleItems: [MKMapItem]
                if selectedResultID != nil {
                    let exactMatch = mapItems.first {
                        guard let name = $0.name, let selectedTitle else { return false }
                        return name.localizedCaseInsensitiveCompare(selectedTitle) == .orderedSame
                    }
                    visibleItems = Array([exactMatch ?? mapItems.first].compactMap { $0 })
                } else {
                    var seen = Set<String>()
                    visibleItems = mapItems.filter { item in
                        let coordinate = item.placemark.coordinate
                        let key = "\(item.name?.lowercased() ?? "")|\(String(format: "%.4f", coordinate.latitude))|\(String(format: "%.4f", coordinate.longitude))"
                        return seen.insert(key).inserted
                    }.prefix(10).map { $0 }
                }
                let annotations = visibleItems.enumerated().map { index, item in
                    NativeActivitySearchAnnotation(
                        mapItem: item,
                        category: category,
                        isFocused: NativeActivityPlaceIdentity.value(for: item) == self.selectedActivityPlaceID,
                        rank: index
                    )
                }
                self.activitySearchAnnotations = annotations
                self.mapView.addAnnotations(Array(annotations))
                guard !annotations.isEmpty else { return }
                if let selectedResultID,
                   let annotation = annotations.first(where: { $0.resultID == selectedResultID }) {
                    self.mapView.setCamera(
                        MKMapCamera(
                            lookingAtCenter: annotation.coordinate,
                            fromDistance: 12_000,
                            pitch: 42,
                            heading: self.mapView.camera.heading
                        ),
                        animated: true
                    )
                    self.mapView.selectAnnotation(annotation, animated: true)
                } else {
                    self.fitActivitySearchAnnotations(annotations)
                }
            }
        }
    }

    private func keepActiveMapControlsFrontmost() {
        guard !mapControlStack.isHidden else { return }
        view.bringSubviewToFront(mapControlStack)
    }

    private func fitActivitySearchAnnotations(_ annotations: [NativeActivitySearchAnnotation]) {
        let generation = activityCameraFitGeneration
        applyActivitySearchFit(annotations, animated: true)

        // Results are published before the New Activity sheet finishes moving
        // to its preview detent. Refit after that transition so edge padding is
        // calculated from the final visible map instead of the expanded sheet.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.55) { [weak self] in
            guard let self,
                  generation == self.activityCameraFitGeneration,
                  self.selectedActivityPlaceID == nil,
                  !self.activitySearchAnnotations.isEmpty else { return }
            self.applyActivitySearchFit(self.activitySearchAnnotations, animated: false)
        }
    }

    private func applyActivitySearchFit(
        _ annotations: [NativeActivitySearchAnnotation],
        animated: Bool
    ) {
        guard !annotations.isEmpty else { return }
        let mapPoints = annotations.map { MKMapPoint($0.coordinate) }
        let bounds = mapPoints.reduce(MKMapRect.null) { rect, point in
            let pointRect = MKMapRect(x: point.x, y: point.y, width: 1, height: 1)
            return rect.isNull ? pointRect : rect.union(pointRect)
        }
        let centerLatitude = annotations
            .map(\.coordinate.latitude)
            .reduce(0, +) / Double(annotations.count)
        let minimumPaddingMeters: CLLocationDistance
        switch annotations.count {
        case 1:
            minimumPaddingMeters = 1_800
        case 2...4:
            minimumPaddingMeters = 1_200
        case 5...10:
            minimumPaddingMeters = 2_200
        default:
            minimumPaddingMeters = 3_200
        }
        let minimumPadding = minimumPaddingMeters * MKMapPointsPerMeterAtLatitude(centerLatitude)
        let expandedBounds = bounds.insetBy(
            dx: -max(bounds.width * 0.25, minimumPadding),
            dy: -max(bounds.height * 0.25, minimumPadding)
        )
        let cameraInsets = activitySearchCameraInsets()
        mapView.setVisibleMapRect(expandedBounds, edgePadding: cameraInsets, animated: animated)

        // setVisibleMapRect may zoom far beyond a useful city view when MapKit
        // returns an outlier. Preserve its fitted center while enforcing a
        // presentation-only maximum distance. Preserve MapKit's padded center;
        // replacing it with the raw result center would put the lower results
        // back underneath the activity sheet.
        DispatchQueue.main.asyncAfter(deadline: .now() + (animated ? 0.45 : 0.05)) { [weak self] in
            guard let self,
                  !self.activitySearchAnnotations.isEmpty,
                  self.selectedActivityPlaceID == nil,
                  self.mapView.camera.centerCoordinateDistance > Self.activityCameraMaximumDistance else { return }
            let paddedCenter = self.mapView.camera.centerCoordinate
            self.mapView.setCamera(
                MKMapCamera(
                    lookingAtCenter: paddedCenter,
                    fromDistance: Self.activityCameraMaximumDistance,
                    pitch: 42,
                    heading: self.mapView.camera.heading
                ),
                animated: animated
            )
        }
    }

    private func activitySearchCameraInsets() -> UIEdgeInsets {
        let availableHeight = max(0, view.bounds.height - view.safeAreaInsets.top)
        var collapsedSheetHeight = NativeActivitySheetMetrics.previewHeight(
            maximumDetentValue: availableHeight,
            screenHeight: view.window?.screen.bounds.height ?? view.bounds.height,
            safeAreaInsets: view.safeAreaInsets
        )
        if #available(iOS 16.0, *),
           let presented = presentedViewController,
           presented.sheetPresentationController?.selectedDetentIdentifier == NativeActivitySheetMetrics.previewIdentifier,
           presented.viewIfLoaded?.window != nil {
            let sheetFrame = view.convert(presented.view.bounds, from: presented.view)
            collapsedSheetHeight = max(0, view.bounds.maxY - sheetFrame.minY)
        }
        // MapKit produces unstable camera centers when vertical edge padding
        // consumes nearly the entire map. The preview is allowed to cover the
        // lower portion of the map, but a useful city-scale canvas must remain.
        let maximumBottomInset = max(0, availableHeight * 0.48)
        let fittedBottomInset = min(collapsedSheetHeight + 24, maximumBottomInset)
        return UIEdgeInsets(
            top: view.safeAreaInsets.top + 32,
            left: 40,
            bottom: fittedBottomInset,
            right: 40
        )
    }

    private func presentMapSearch(purpose: NativeActivityPurpose?) {
        let search = NativeMapSearchViewController(purpose: purpose) { [weak self] coordinate in
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
        NativeMapSearchViewController.sheetConfiguration.apply(to: search)
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
            onSuccessfulSaveDismissed: { [weak self] trip in
                self?.presentTripOverview(for: trip)
            },
            onCreate: { [weak self] draft, completion in
                guard let self else { return }
                self.createTripFromServer(draft) { result in
                    completion(result)
                }
            }
        )
        presentTripForm(form)
    }

    private func addNativeTrip(_ trip: NativeMapTrip) {
        guard !trips.contains(where: { $0.id == trip.id }) else { return }
        trips = NativeMapTrip.scheduled(trips + [trip])
        warmTripBackground(trip)
        addTripPins()
        renderSheetContent()
    }

    @objc private func openTripAction(_ sender: UIButton) {
        guard let id = sender.accessibilityIdentifier,
              let trip = trips.first(where: { $0.id == id }) else { return }
        // Keep trip navigation inside the native globe and wallet. The WebView
        // route can still be opened by dedicated web navigation, but a native
        // wallet card must not dismiss this shell into the legacy trip form.
        openTripOverview(trip)
    }

    @objc private func editTripAction(_ sender: NativeTripActionButton) {
        guard let trip = trips.first(where: { $0.id == sender.tripId }) else { return }
        presentTripEditor(trip)
    }

    private func presentTripEditor(_ trip: NativeMapTrip, focus: NativeTripEditorFocus = .all) {
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
                initialFocus: focus,
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
        confirmTripRemoval(trip)
    }

    private func confirmTripRemoval(_ trip: NativeMapTrip) {
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
            trips.append(updatedTrip)
        }
        trips = NativeMapTrip.scheduled(trips)
        warmTripBackground(updatedTrip)
        addTripPins()
        renderSheetContent()
        refreshTripsFromServer()
    }

    private func presentTripForm(_ form: UIViewController) {
        form.modalPresentationStyle = .pageSheet
        if let sheet = form.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
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
        openTripOverview(trip)
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

    private func openTripOverview(_ trip: NativeMapTrip) {
        // The overview is an informational sheet layered over the user's
        // current globe composition. Only an activity/place selection owns a
        // coordinate-driven camera transition; a trip destination does not.
        presentTripOverview(for: trip)
    }

    private func presentTripOverview(for trip: NativeMapTrip) {
        guard presentedViewController == nil else { return }
        guard let userID = NativeSessionCoordinator.shared.verifiedUserID else {
            presentNativeAuth()
            return
        }

        let seed = NativeTripOverviewSeed(
            tripID: trip.id,
            title: trip.displayName,
            dateRange: trip.displayDateRange,
            imageURL: trip.imageUrl.flatMap(URL.init(string:)),
            fallbackColor: "#6B625B"
        )
        let store = NativeTripOverviewStore(
            requester: NativeTripOverviewAPIClient(webView: nil)
        )
        let overview = NativeTripOverviewViewController(
            userID: userID,
            tripID: trip.id,
            seed: seed,
            seedImage: NativeTripBackgroundImageCache.shared.image(for: trip),
            store: store
        )
        let router = NativeTripOverviewRouter(
            viewController: overview,
            webHandoff: { [weak self, weak overview] url in
                guard NativeWebRoutePolicy.allows(url) else {
                    self?.showUnavailableRouteMessage()
                    return
                }
                overview?.dismiss(animated: true) {
                    self?.presentNativeWebFeature(route: url.almidyRoute, title: "Trip")
                }
            },
            nativeRoute: { [weak self, weak overview] kind, _ in
                overview?.dismiss(animated: true) {
                    switch kind {
                    case .places: self?.openSearch()
                    case .routes: self?.applySheetState(.collapsed, animated: true)
                    default: break
                    }
                }
            },
            activitySearchRoute: { [weak self] category, _ in
                self?.openActivitySearch(for: category)
            },
            activityFilterRoute: { [weak self] category, query, nearby, selectedResultID, region, results in
                self?.updateGlobeActivityFilter(
                    category: category,
                    query: query,
                    nearby: nearby,
                    selectedResultID: selectedResultID,
                    searchRegion: region,
                    orderedResults: results
                )
            },
            authenticationRecovery: { [weak self, weak overview] in
                overview?.dismiss(animated: true) { self?.presentNativeAuth() }
            },
            onClose: { [weak self] in
                self?.setPrimarySheetHiddenForModalFlow(false)
            }
        )
        overview.router = router
        overview.configureForGlobePresentation()
        setPrimarySheetHiddenForModalFlow(true)
        overview.presentationController?.delegate = self
        present(overview, animated: true)
    }

    func setPrimarySheetHiddenForModalFlow(_ isHidden: Bool) {
        UIView.animate(withDuration: 0.2) {
            self.sheetView.alpha = isHidden ? 0 : 1
        }
        sheetView.isUserInteractionEnabled = !isHidden
        sheetView.accessibilityElementsHidden = isHidden
    }

    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        if presentationController.presentedViewController is NativeActivityPlaceDetailsViewController {
            restoreActivitySelectionCamera()
            return
        }
        activityResultSelectionHandler = nil
        activityResolvedPlaceHandler = nil
        updateGlobeActivityFilter(
            category: nil,
            query: "",
            nearby: false,
            selectedResultID: nil,
            searchRegion: nil,
            orderedResults: []
        )
        setPrimarySheetHiddenForModalFlow(false)
        if let tripID = tripOverviewTripIDToRestoreAfterActivity {
            restoreTripOverviewAfterActivity(for: tripID)
        }
    }

    func sheetPresentationControllerDidChangeSelectedDetentIdentifier(
        _ sheetPresentationController: UISheetPresentationController
    ) {
        guard let overview = sheetPresentationController.presentedViewController as? NativeTripOverviewViewController else {
            return
        }
        overview.applySelectedDetent(sheetPresentationController.selectedDetentIdentifier, animated: true)
    }

    private func showUnavailableRouteMessage() {
        let alert = UIAlertController(
            title: "Unable to Open Section",
            message: "This trip section is not available right now.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        (presentedViewController ?? self).present(alert, animated: true)
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

extension NativeMapViewController: UIContextMenuInteractionDelegate {
    func contextMenuInteraction(
        _ interaction: UIContextMenuInteraction,
        configurationForMenuAtLocation location: CGPoint
    ) -> UIContextMenuConfiguration? {
        guard let id = interaction.view?.accessibilityIdentifier,
              let trip = trips.first(where: { $0.id == id }) else { return nil }

        return UIContextMenuConfiguration(identifier: id as NSString, previewProvider: nil) { [weak self] _ in
            guard let self else { return nil }
            let action: (NativeTripCardMenuAction, UIMenuElement.Attributes) -> UIAction = { item, attributes in
                UIAction(
                    title: item.title,
                    image: UIImage(systemName: item.systemImage),
                    attributes: attributes
                ) { [weak self] _ in
                    self?.performTripCardMenuAction(item, trip: trip, sourceView: interaction.view)
                }
            }

            let primary = UIMenu(options: .displayInline, children: [
                action(.shareTrip, []),
                action(.editName, []),
                action(.changeDates, []),
                action(.changeBackground, [])
            ])
            let organization = UIMenu(options: .displayInline, children: [
                action(.duplicateTrip, []),
                action(.mergeTrip, self.trips.count > 1 ? [] : [.disabled])
            ])
            let removal = UIMenu(options: .displayInline, children: [
                action(.removeTrip, [.destructive])
            ])
            return UIMenu(title: trip.displayName, children: [primary, organization, removal])
        }
    }

    private func performTripCardMenuAction(
        _ action: NativeTripCardMenuAction,
        trip: NativeMapTrip,
        sourceView: UIView?
    ) {
        switch action {
        case .shareTrip:
            shareTrip(trip, sourceView: sourceView)
        case .editName:
            presentTripEditor(trip, focus: .name)
        case .changeDates:
            presentTripEditor(trip, focus: .dates)
        case .changeBackground:
            presentTripEditor(trip, focus: .background)
        case .duplicateTrip:
            duplicateTrip(trip)
        case .mergeTrip:
            chooseMergeTarget(for: trip)
        case .removeTrip:
            confirmTripRemoval(trip)
        }
    }

    private func shareTrip(_ trip: NativeMapTrip, sourceView: UIView?) {
        guard let tripStore else {
            showTripMenuError("Share Trip", message: "Sharing is unavailable right now.")
            return
        }
        tripStore.enableTripSharing(id: trip.id) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                switch result {
                case .success:
                    let url = NativeServiceConfiguration.appBaseURL
                        .appendingPathComponent("trip")
                        .appendingPathComponent(trip.id)
                    let activity = UIActivityViewController(
                        activityItems: ["Join my \(trip.displayName) trip on Almidy", url],
                        applicationActivities: nil
                    )
                    activity.popoverPresentationController?.sourceView = sourceView ?? self.view
                    activity.popoverPresentationController?.sourceRect = sourceView?.bounds ?? CGRect(
                        x: self.view.bounds.midX,
                        y: self.view.bounds.midY,
                        width: 1,
                        height: 1
                    )
                    self.present(activity, animated: true)
                case .failure(let error):
                    self.showTripMenuError("Share Trip", message: error.localizedDescription)
                }
            }
        }
    }

    private func duplicateTrip(_ trip: NativeMapTrip) {
        guard let coordinate = trip.coordinate else {
            showTripMenuError("Duplicate Trip", message: "This trip does not have a resolved destination.")
            return
        }
        let draft = NativeTripDraft(
            name: "\(trip.displayName) Copy",
            destination: trip.destination ?? trip.displayName,
            coordinate: coordinate,
            startDate: trip.startDate,
            endDate: trip.endDate,
            imageURL: trip.imageUrl.flatMap(URL.init(string:))
        )
        createTripFromServer(draft) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let duplicate):
                    self?.addNativeTrip(duplicate)
                case .failure(let error):
                    self?.showTripMenuError("Duplicate Trip", message: error.localizedDescription)
                }
            }
        }
    }

    private func chooseMergeTarget(for sourceTrip: NativeMapTrip) {
        let targets = trips.filter { $0.id != sourceTrip.id }
        guard !targets.isEmpty else { return }
        let picker = UIAlertController(
            title: "Merge \(sourceTrip.displayName)",
            message: "Choose the trip that should receive this trip's content.",
            preferredStyle: .actionSheet
        )
        for target in targets {
            picker.addAction(UIAlertAction(title: target.displayName, style: .default) { [weak self] _ in
                self?.showTripMenuError(
                    "Merge Trips",
                    message: "A safe transactional merge is not available yet. Neither trip was changed."
                )
            })
        }
        picker.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        picker.popoverPresentationController?.sourceView = view
        picker.popoverPresentationController?.sourceRect = CGRect(
            x: view.bounds.midX,
            y: view.bounds.midY,
            width: 1,
            height: 1
        )
        present(picker, animated: true)
    }

    private func showTripMenuError(_ title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
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
        let closeButton = AlmidyIconButton(
            symbol: "xmark",
            style: .standard,
            accessibilityLabel: "Close Settings",
            overrides: .init(
                diameter: 52,
                symbolPointSize: 24,
                symbolWeight: .regular,
                foregroundColor: AlmidyDesignTokens.Color.settingsText,
                backgroundColor: AlmidyDesignTokens.Color.settingsCard,
                border: .init(width: 1, color: AlmidyDesignTokens.Color.settingsLine)
            )
        )
        closeButton.addTarget(self, action: #selector(close), for: .touchUpInside)
        let pageHeader = AlmidySheetHeader(
            title: "Settings",
            layout: .largeLeading,
            trailingControl: closeButton,
            metrics: .init(height: 0, horizontalInset: 20, controlSize: 52),
            titleFont: AlmidyDesignTokens.Font.display(38)
        )
        pageHeader.backgroundColor = AlmidyDesignTokens.Color.settingsBackground
        pageHeader.titleLabel.textColor = AlmidyDesignTokens.Color.settingsText

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
        pageHeader.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(pageHeader)
        view.addSubview(tableView)

        NSLayoutConstraint.activate([
            pageHeader.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            pageHeader.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            pageHeader.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.topAnchor.constraint(equalTo: pageHeader.bottomAnchor),
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
        AlmidySurfaceStyle.groupedCard.apply(to: card)
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
        AlmidySurfaceStyle.groupedCard.apply(to: card)

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
        fields.backgroundColor = AlmidyDesignTokens.Color.inputSurface
        fields.layer.cornerRadius = 24
        fields.layer.borderWidth = 1
        fields.layer.borderColor = AlmidyDesignTokens.Color.inputBorder.cgColor
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
            attributes: [.foregroundColor: AlmidyDesignTokens.Color.inputPlaceholder]
        )
        field.font = AlmidyDesignTokens.Font.body(21)
        field.textColor = AlmidyDesignTokens.Color.textPrimary
        field.backgroundColor = AlmidyDesignTokens.Color.inputSurface
        field.setPadding(16)
        field.autocapitalizationType = .none
        field.autocorrectionType = .no
        field.textContentType = contentType
        return field
    }

    private func makeButton(_ title: String, background: UIColor, titleColor: UIColor = .white, border: Bool = false, height: CGFloat = AlmidyDesignTokens.Size.buttonStandard, fontSize: CGFloat = 17, action: Selector) -> UIButton {
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

private final class NativeActivitySearchAnnotation: NSObject, MKAnnotation {
    let mapItem: MKMapItem
    let category: NativeActivityCategory
    let resultID: String
    let coordinate: CLLocationCoordinate2D
    let title: String?
    let subtitle: String?
    let tintColor: UIColor
    let image: UIImage
    let isFocused: Bool
    let rank: Int

    init(mapItem: MKMapItem, category: NativeActivityCategory, isFocused: Bool = false, rank: Int = 0) {
        self.mapItem = mapItem
        self.category = category
        resultID = NativeActivityPlaceIdentity.value(for: mapItem)
        coordinate = mapItem.placemark.coordinate
        title = mapItem.name
        subtitle = mapItem.placemark.title
        tintColor = category.palette.tint
        image = category.image
        self.isFocused = isFocused
        self.rank = rank
        super.init()
    }

    convenience init?(
        title: String,
        coordinate: CLLocationCoordinate2D,
        category: NativeActivityCategory,
        isFocused: Bool = false,
        rank: Int = 0
    ) {
        guard let mapItem = NativeCoordinatePlace.mapItem(title: title, coordinate: coordinate) else {
            return nil
        }
        self.init(mapItem: mapItem, category: category, isFocused: isFocused, rank: rank)
    }
}

private final class NativeActivitySearchAnnotationView: MKAnnotationView {
    private enum Metrics {
        static let width = NativeMapAnnotationPresentation.activityLabelWidth
        static let height: CGFloat = 78
        static let badgeSize = NativeMapAnnotationPresentation.activityBadgeSize
        static let glyphSize = NativeMapAnnotationPresentation.activityGlyphSize
        static let labelHeight = NativeMapAnnotationPresentation.activityLabelHeight
    }

    private let badgeView = UIView()
    private let glyphView = UIImageView()
    private let titleLabel = UILabel()
    private let selectedTailLayer = CAShapeLayer()
    private let selectedAnchorDot = UIView()
    private var keepsTitleVisible = false

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)

        // Only the circular badge participates in collision. The title may
        // extend outside these bounds when selected without causing every
        // nearby result to collide as a 132-point-wide annotation.
        frame = CGRect(x: 0, y: 0, width: Metrics.badgeSize, height: Metrics.badgeSize)
        clipsToBounds = false
        centerOffset = .zero
        collisionMode = .none
        canShowCallout = false
        clusteringIdentifier = nil

        let tailPath = UIBezierPath()
        tailPath.move(to: CGPoint(x: 10, y: 0))
        tailPath.addLine(to: CGPoint(x: 30, y: 0))
        tailPath.addLine(to: CGPoint(x: 20, y: 22))
        tailPath.close()
        selectedTailLayer.path = tailPath.cgPath
        selectedTailLayer.lineJoin = .round
        selectedTailLayer.lineWidth = 2
        selectedTailLayer.strokeColor = UIColor.white.cgColor
        selectedTailLayer.isHidden = true
        selectedTailLayer.frame = CGRect(x: 0, y: 52, width: 40, height: 22)
        layer.addSublayer(selectedTailLayer)

        selectedAnchorDot.frame = CGRect(x: 16.5, y: 71, width: 7, height: 7)
        selectedAnchorDot.layer.cornerRadius = 3.5
        selectedAnchorDot.layer.borderColor = UIColor.white.cgColor
        selectedAnchorDot.layer.borderWidth = 1
        selectedAnchorDot.isHidden = true
        addSubview(selectedAnchorDot)

        badgeView.frame = CGRect(
            x: 0,
            y: 0,
            width: Metrics.badgeSize,
            height: Metrics.badgeSize
        )
        NativeMapAnnotationPresentation.applyActivityBadgeSurface(to: badgeView)
        addSubview(badgeView)

        glyphView.frame = CGRect(
            x: (Metrics.badgeSize - Metrics.glyphSize) / 2,
            y: (Metrics.badgeSize - Metrics.glyphSize) / 2,
            width: Metrics.glyphSize,
            height: Metrics.glyphSize
        )
        glyphView.contentMode = .scaleAspectFit
        glyphView.tintColor = .white
        badgeView.addSubview(glyphView)

        titleLabel.frame = CGRect(
            x: (Metrics.badgeSize - Metrics.width) / 2,
            y: Metrics.badgeSize + 5,
            width: Metrics.width,
            height: Metrics.labelHeight
        )
        titleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 1
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.layer.shadowColor = UIColor.black.cgColor
        titleLabel.layer.shadowOpacity = 1
        titleLabel.layer.shadowRadius = 2
        titleLabel.layer.shadowOffset = .zero
        titleLabel.isHidden = true
        addSubview(titleLabel)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        glyphView.image = nil
        titleLabel.text = nil
        titleLabel.isHidden = true
        keepsTitleVisible = false
        clusteringIdentifier = nil
        detailCalloutAccessoryView = nil
        selectedTailLayer.isHidden = true
        selectedAnchorDot.isHidden = true
        centerOffset = .zero
        badgeView.transform = .identity
        glyphView.transform = .identity
        accessibilityLabel = nil
        accessibilityTraits = .button
    }

    func configure(with annotation: NativeActivitySearchAnnotation) {
        badgeView.backgroundColor = annotation.tintColor
        selectedTailLayer.fillColor = annotation.tintColor.cgColor
        selectedAnchorDot.backgroundColor = annotation.tintColor
        glyphView.image = annotation.image.withRenderingMode(.alwaysTemplate)
        titleLabel.text = annotation.title
        // Keep the highest-value labels readable without drawing every result
        // name over the same dense city block. All pins remain visible and
        // tappable; selecting any pin reveals its title.
        keepsTitleVisible = annotation.isFocused || annotation.rank < 3
        // Search results are the primary content of this globe state. Do not let
        // MapKit discard lower-ranked icons simply because the city is dense.
        collisionMode = .none
        displayPriority = .required
        clusteringIdentifier = nil
        canShowCallout = false
        detailCalloutAccessoryView = nil
        isHidden = false
        alpha = 1
        layer.zPosition = annotation.isFocused ? 10_001 : CGFloat(10_000 - annotation.rank)
        if #available(iOS 14.0, *) {
            zPriority = .max
        }
        titleLabel.isHidden = !keepsTitleVisible
        accessibilityLabel = NativeMapAnnotationPresentation.accessibilityLabel(
            title: annotation.title,
            subtitle: annotation.subtitle
        )
        accessibilityTraits = .button
    }

    override func setSelected(_ selected: Bool, animated: Bool) {
        super.setSelected(selected, animated: animated)
        let presentation = NativeActivityAnnotationSelectionPresentation(
            selected: selected,
            keepsTitleVisible: keepsTitleVisible,
            badgeSize: Metrics.badgeSize
        )
        titleLabel.isHidden = presentation.titleHidden
        selectedTailLayer.isHidden = presentation.tailHidden
        selectedAnchorDot.isHidden = presentation.anchorHidden
        centerOffset = presentation.centerOffset
        titleLabel.frame.origin.y = presentation.titleOriginY
        accessibilityTraits = presentation.accessibilityTraits

        let changes = {
            self.badgeView.transform = CGAffineTransform(
                scaleX: presentation.badgeScale,
                y: presentation.badgeScale
            )
            self.glyphView.transform = CGAffineTransform(
                scaleX: presentation.glyphScale,
                y: presentation.glyphScale
            )
        }
        if animated {
            UIView.animate(
                withDuration: 0.2,
                delay: 0,
                options: [.beginFromCurrentState, .allowUserInteraction],
                animations: changes
            )
        } else {
            changes()
        }
    }
}

private final class NativeActivitySearchDetailView: UIView {
    init(mapItem: MKMapItem) {
        super.init(frame: .zero)

        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .fill
        stack.spacing = 4
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        let name = UILabel()
        name.font = .preferredFont(forTextStyle: .headline)
        name.textColor = .label
        name.numberOfLines = 0
        name.text = mapItem.name ?? "Unnamed place"
        stack.addArrangedSubview(name)

        let detailValues: [(String, String?)] = [
            ("mappin.and.ellipse", mapItem.placemark.title),
            ("phone.fill", mapItem.phoneNumber),
            ("safari.fill", mapItem.url?.absoluteString),
        ]
        for (symbol, rawValue) in detailValues {
            guard let value = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { continue }
            let row = UIStackView()
            row.axis = .horizontal
            row.alignment = .top
            row.spacing = 7

            let icon = UIImageView(image: UIImage(systemName: symbol))
            icon.tintColor = .secondaryLabel
            icon.contentMode = .scaleAspectFit
            icon.widthAnchor.constraint(equalToConstant: 16).isActive = true
            icon.heightAnchor.constraint(equalToConstant: 18).isActive = true

            let label = UILabel()
            label.font = .preferredFont(forTextStyle: .subheadline)
            label.textColor = .secondaryLabel
            label.numberOfLines = 0
            label.lineBreakMode = .byWordWrapping
            label.text = value

            row.addArrangedSubview(icon)
            row.addArrangedSubview(label)
            stack.addArrangedSubview(row)
        }

        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: 250),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 4),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -4),
        ])
        accessibilityLabel = [mapItem.name, mapItem.placemark.title, mapItem.phoneNumber, mapItem.url?.absoluteString]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
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
        NativeMapAnnotationPresentation.applyMapPinElevation(to: self)
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
    private let flagBadgeView = UIView()
    private let flagLabel = UILabel()
    private let countryLabel = UILabel()

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)

        frame = CGRect(x: 0, y: 0, width: 160, height: 78)
        // The badge center, rather than the annotation view's full label stack,
        // is anchored to the trip coordinate.
        centerOffset = CGPoint(x: 0, y: 19)
        collisionMode = .circle
        displayPriority = .required
        if #available(iOS 14.0, *) {
            zPriority = .max
        }

        flagBadgeView.backgroundColor = .white
        flagBadgeView.layer.cornerRadius = 20
        flagBadgeView.layer.borderColor = UIColor.white.cgColor
        flagBadgeView.layer.borderWidth = 3
        NativeMapAnnotationPresentation.applyMapPinElevation(to: flagBadgeView)
        flagBadgeView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(flagBadgeView)

        flagLabel.backgroundColor = .clear
        flagLabel.font = .systemFont(ofSize: 36)
        flagLabel.textAlignment = .center
        flagLabel.layer.cornerRadius = 20
        flagLabel.clipsToBounds = true
        flagLabel.translatesAutoresizingMaskIntoConstraints = false
        flagBadgeView.addSubview(flagLabel)

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
            flagBadgeView.topAnchor.constraint(equalTo: topAnchor),
            flagBadgeView.centerXAnchor.constraint(equalTo: centerXAnchor),
            flagBadgeView.widthAnchor.constraint(equalToConstant: 40),
            flagBadgeView.heightAnchor.constraint(equalToConstant: 40),
            flagLabel.topAnchor.constraint(equalTo: flagBadgeView.topAnchor),
            flagLabel.leadingAnchor.constraint(equalTo: flagBadgeView.leadingAnchor),
            flagLabel.trailingAnchor.constraint(equalTo: flagBadgeView.trailingAnchor),
            flagLabel.bottomAnchor.constraint(equalTo: flagBadgeView.bottomAnchor),
            countryLabel.topAnchor.constraint(equalTo: flagBadgeView.bottomAnchor, constant: 2),
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
        accessibilityTraits = .button
    }

    var anchoredBadgeLayoutForTesting: (
        badgeCenter: CGPoint,
        badgeSize: CGSize,
        badgeCornerRadius: CGFloat,
        flagClipsToCircle: Bool,
        badgeBackgroundIsClear: Bool,
        flagFontSize: CGFloat
    ) {
        layoutIfNeeded()
        return (
            badgeCenter: flagBadgeView.center,
            badgeSize: flagBadgeView.bounds.size,
            badgeCornerRadius: flagBadgeView.layer.cornerRadius,
            flagClipsToCircle: flagLabel.clipsToBounds,
            badgeBackgroundIsClear: flagBadgeView.backgroundColor == .clear,
            flagFontSize: flagLabel.font.pointSize
        )
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

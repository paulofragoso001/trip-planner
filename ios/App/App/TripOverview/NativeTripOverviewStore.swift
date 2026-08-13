import CryptoKit
import Foundation
import WebKit

protocol NativeTripOverviewCaching {
    func load(userID: String, tripID: String) -> NativeTripOverview?
    func save(_ overview: NativeTripOverview, userID: String, tripID: String) throws
    func remove(userID: String, tripID: String)
}

final class NativeTripOverviewDiskCache: NativeTripOverviewCaching {
    private struct Envelope: Codable {
        let cacheVersion: Int
        let savedAt: Date
        let overview: NativeTripOverview
    }

    static let cacheVersion = 1
    private let directory: URL
    private let fileManager: FileManager
    private let queue = DispatchQueue(label: "app.almidy.trip-overview-cache")

    init(directory: URL? = nil, fileManager: FileManager = .default) {
        self.fileManager = fileManager
        self.directory = directory ?? fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("TripOverview", isDirectory: true)
    }

    func load(userID: String, tripID: String) -> NativeTripOverview? {
        queue.sync {
            guard let data = try? Data(contentsOf: cacheURL(userID: userID, tripID: tripID)),
                  let envelope = try? JSONDecoder().decode(Envelope.self, from: data),
                  envelope.cacheVersion == Self.cacheVersion,
                  envelope.overview.version == NativeTripOverview.supportedVersion else { return nil }
            return envelope.overview
        }
    }

    func save(_ overview: NativeTripOverview, userID: String, tripID: String) throws {
        try queue.sync {
            try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
            let data = try JSONEncoder().encode(Envelope(cacheVersion: Self.cacheVersion, savedAt: Date(), overview: overview))
            try data.write(to: cacheURL(userID: userID, tripID: tripID), options: .atomic)
        }
    }

    func remove(userID: String, tripID: String) {
        queue.sync { try? fileManager.removeItem(at: cacheURL(userID: userID, tripID: tripID)) }
    }

    func cacheURL(userID: String, tripID: String) -> URL {
        let key = Data("v\(Self.cacheVersion):\(userID):\(tripID)".utf8)
        let digest = SHA256.hash(data: key).map { String(format: "%02x", $0) }.joined()
        return directory.appendingPathComponent("\(digest).json")
    }
}

protocol NativeTripOverviewRequesting {
    func loadOverview(tripID: String, completion: @escaping (Result<Data, Error>) -> Void)
}

final class NativeTripOverviewAPIClient: NativeTripOverviewRequesting {
    private let client: NativeAuthenticatedHTTPClient

    init(webView: WKWebView?, baseURL: URL = NativeServiceConfiguration.appBaseURL, session: URLSession = .shared) {
        client = NativeAuthenticatedHTTPClient(webView: webView, baseURL: baseURL, session: session)
    }

    func loadOverview(tripID: String, completion: @escaping (Result<Data, Error>) -> Void) {
        client.request(
            path: "/api/trips/\(tripID.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? tripID)/overview",
            method: "GET",
            body: nil,
            completion: completion
        )
    }
}

final class NativeTripOverviewStore {
    typealias StateHandler = (NativeTripOverviewViewState) -> Void

    private let requester: NativeTripOverviewRequesting
    private let cache: NativeTripOverviewCaching
    private let decoder: JSONDecoder

    init(
        requester: NativeTripOverviewRequesting,
        cache: NativeTripOverviewCaching = NativeTripOverviewDiskCache(),
        decoder: JSONDecoder = JSONDecoder()
    ) {
        self.requester = requester
        self.cache = cache
        self.decoder = decoder
    }

    func load(userID: String, tripID: String, onState: @escaping StateHandler) {
        let cached = cache.load(userID: userID, tripID: tripID)
        if let cached {
            onState(.stale(mark(cached, refresh: .refreshing), refresh: .refreshing))
        } else {
            onState(.loading)
        }

        requester.loadOverview(tripID: tripID) { [weak self] result in
            guard let self else { return }
            DispatchQueue.main.async {
                switch result {
                case .success(let data):
                    do {
                        let overview = try self.decoder.decode(NativeTripOverview.self, from: data)
                        try? self.cache.save(overview, userID: userID, tripID: tripID)
                        let failures = self.failedSections(in: overview)
                        onState(failures.isEmpty ? .loaded(overview) : .partial(overview, failedSections: failures))
                    } catch {
                        onState(.recoverableError(message: "Trip details could not be read.", cached: cached, canRetry: true))
                    }
                case .failure(let error):
                    if case NativeTripStoreError.unauthorized = error {
                        onState(.authenticationExpired(cached: cached))
                    } else if let cached {
                        onState(.stale(self.mark(cached, refresh: .failed), refresh: .failed))
                    } else {
                        onState(.recoverableError(message: self.message(for: error), cached: nil, canRetry: true))
                    }
                }
            }
        }
    }

    func clearCache(userID: String, tripID: String) {
        cache.remove(userID: userID, tripID: tripID)
    }

    private func failedSections(in overview: NativeTripOverview) -> [NativeTripOverviewSection] {
        [
            (NativeTripOverviewSection.itinerary, overview.itinerary.status),
            (.documents, overview.documents.status),
            (.expenses, overview.expenses.status),
            (.recentItems, overview.recentItems.status)
        ].compactMap { name, status in status.state == .failed ? name : nil }
    }

    private func mark(_ overview: NativeTripOverview, refresh: NativeTripOverviewRefreshStatus) -> NativeTripOverview {
        func status(_ value: NativeTripOverviewSectionStatus) -> NativeTripOverviewSectionStatus {
            .init(state: value.state, error: value.error, refreshStatus: refresh)
        }
        return .init(
            version: overview.version,
            trip: overview.trip,
            hero: overview.hero,
            itinerary: .init(status: status(overview.itinerary.status), exactCount: overview.itinerary.exactCount, dateRange: overview.itinerary.dateRange, categories: overview.itinerary.categories),
            documents: .init(status: status(overview.documents.status), items: overview.documents.items),
            expenses: .init(status: status(overview.expenses.status), ledger: overview.expenses.ledger, currencies: overview.expenses.currencies),
            recentItems: .init(status: status(overview.recentItems.status), items: overview.recentItems.items),
            actions: overview.actions
        )
    }

    private func message(for error: Error) -> String {
        if let urlError = error as? URLError, [.notConnectedToInternet, .networkConnectionLost, .timedOut].contains(urlError.code) {
            return "You appear to be offline. Try again when your connection returns."
        }
        return "Trip details are temporarily unavailable."
    }
}

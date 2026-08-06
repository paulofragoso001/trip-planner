import Foundation
import WebKit

final class NativeAuthenticatedHTTPClient {
    typealias RequestExecutor = (URLRequest, @escaping (Data?, URLResponse?, Error?) -> Void) -> NativeAuthenticatedTask

    private weak var webView: WKWebView?
    private let baseURL: URL
    private let session: URLSession
    private let coordinator: NativeSessionCoordinator
    private let requestExecutor: RequestExecutor

    init(
        webView: WKWebView?,
        baseURL: URL = NativeServiceConfiguration.appBaseURL,
        session: URLSession = .shared,
        coordinator: NativeSessionCoordinator = .shared,
        requestExecutor: RequestExecutor? = nil
    ) {
        self.webView = webView
        self.baseURL = baseURL
        self.session = session
        self.coordinator = coordinator
        self.requestExecutor = requestExecutor ?? { request, completion in
            session.dataTask(with: request, completionHandler: completion)
        }
    }

    func request(
        path: String,
        method: String,
        body: Data?,
        completion: @escaping (Result<Data, Error>) -> Void
    ) {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            completion(.failure(NativeTripStoreError.invalidResponse))
            return
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        request.setValue(baseURL.originString, forHTTPHeaderField: "Origin")
        request.setValue(baseURL.absoluteString + "/dashboard/trips", forHTTPHeaderField: "Referer")
        authorizeAndPerform(request, retryAfterAuthenticationFailure: true, completion: completion)
    }

    func request(_ request: URLRequest, completion: @escaping (Result<Data, Error>) -> Void) {
        authorizeAndPerform(request, retryAfterAuthenticationFailure: true, completion: completion)
    }

    private func authorizeAndPerform(
        _ request: URLRequest,
        retryAfterAuthenticationFailure: Bool,
        completion: @escaping (Result<Data, Error>) -> Void
    ) {
        coordinator.validSession { [weak self] result in
            guard let self else { return }
            guard let session = try? result.get() else {
                self.finish(.failure(NativeTripStoreError.unauthorized), completion)
                return
            }
            var authorized = request
            authorized.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            self.attachCookies(to: authorized) { requestWithCookies in
                self.perform(
                    requestWithCookies,
                    retryAfterAuthenticationFailure: retryAfterAuthenticationFailure,
                    completion: completion
                )
            }
        }
    }

    private func attachCookies(to request: URLRequest, completion: @escaping (URLRequest) -> Void) {
        guard let webView else { completion(request); return }
        webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { cookies in
            var updated = request
            if let cookieHeader = HTTPCookie.requestHeaderFields(with: cookies)["Cookie"] {
                updated.setValue(cookieHeader, forHTTPHeaderField: "Cookie")
            }
            completion(updated)
        }
    }

    private func perform(
        _ request: URLRequest,
        retryAfterAuthenticationFailure: Bool,
        completion: @escaping (Result<Data, Error>) -> Void
    ) {
        let taskReference = NativeURLSessionTaskReference()
        let task = requestExecutor(request) { [weak self] data, response, error in
            guard let self else { return }
            if let task = taskReference.task { self.coordinator.unregisterAuthenticatedTask(task) }
            if let error {
                self.finish(.failure(error), completion)
                return
            }
            guard let response = response as? HTTPURLResponse else {
                self.finish(.failure(NativeTripStoreError.invalidResponse), completion)
                return
            }
            if let path = request.url?.path, path.hasPrefix("/api/travel-data/") {
                nativeImageryDebug("Image API response path=\(path) httpStatus=\(response.statusCode)")
            }
            if response.statusCode == 401, retryAfterAuthenticationFailure {
                self.coordinator.validSession(forceRefresh: true) { refreshResult in
                    guard refreshResult.isSuccess else {
                        self.finish(.failure(NativeTripStoreError.unauthorized), completion)
                        return
                    }
                    self.authorizeAndPerform(request, retryAfterAuthenticationFailure: false, completion: completion)
                }
                return
            }
            guard (200...299).contains(response.statusCode), let data else {
                let message = data.flatMap { String(data: $0, encoding: .utf8) } ?? "Almidy API request failed."
                self.finish(.failure(response.statusCode == 401 ? NativeTripStoreError.unauthorized : NativeTripStoreError.requestFailed(message)), completion)
                return
            }
            self.finish(.success(data), completion)
        }
        taskReference.task = task
        coordinator.registerAuthenticatedTask(task)
        task.resume()
    }

    private func finish(_ result: Result<Data, Error>, _ completion: @escaping (Result<Data, Error>) -> Void) {
        DispatchQueue.main.async { completion(result) }
    }
}

private final class NativeURLSessionTaskReference: @unchecked Sendable {
    weak var task: NativeAuthenticatedTask?
}

private extension Result {
    var isSuccess: Bool {
        if case .success = self { return true }
        return false
    }
}

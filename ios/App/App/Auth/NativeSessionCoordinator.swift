import AuthenticationServices
import Foundation

private let nativeAuthCallbackURL = URL(string: "app.almidy.premium://auth/callback")!

protocol NativeAuthenticatedTask: AnyObject {
    func resume()
    func cancel()
}

extension URLSessionDataTask: NativeAuthenticatedTask {}

enum NativeWebSessionImportResult: Equatable {
    case imported
    case unchanged
    case rejectedInvalid
    case rejectedStale
    case persistenceFailed

    var isAccepted: Bool {
        self == .imported || self == .unchanged
    }
}

final class NativeSessionCoordinator {
    static let shared = NativeSessionCoordinator()

    private let store: NativeSessionStoring
    private let supabaseURL: URL?
    private let publishableKey: String?
    private let defaultSession: URLSession
    private let lock = NSLock()
    private let sessionMutationLock = NSLock()
    private var refreshWaiters: [(Result<NativeAuthSession, Error>) -> Void] = []
    private var refreshTask: URLSessionDataTask?
    private var authenticatedTasks: [NativeAuthenticatedTask] = []
    private static let revisionQueue = DispatchQueue(label: "app.almidy.auth.revisions")
    private static var lastRevisionId: Int64 = 0

    init(
        service: String = "app.almidy.premium.supabase-session",
        supabaseURL: URL? = NativeServiceConfiguration.supabaseURL,
        publishableKey: String? = NativeServiceConfiguration.supabasePublishableKey,
        store: NativeSessionStoring? = nil,
        urlSession: URLSession = .shared
    ) {
        self.store = store ?? NativeSessionStore(service: service)
        self.supabaseURL = supabaseURL
        self.publishableKey = publishableKey
        self.defaultSession = urlSession
    }

    var session: NativeAuthSession? {
        guard store.loadSignOutMarker() == nil,
              case .valid(let session) = store.loadSession(),
              session.isComplete else { return nil }
        return session
    }

    var state: NativeSessionState {
        if let marker = store.loadSignOutMarker() { return .explicitlySignedOut(marker) }
        switch store.loadSession() {
        case .missing: return .missing
        case .invalid: return .invalid(.corruptStorage)
        case .valid(let session):
            guard !session.accessToken.isEmpty else { return .invalid(.missingAccessToken) }
            guard !(session.refreshToken ?? "").isEmpty else { return .invalid(.missingRefreshToken) }
            guard let expiry = session.expiresAt else { return .invalid(.missingExpiry) }
            guard expiry > 0 else { return .invalid(.invalidExpiry) }
            return session.isExpired() ? .expired(session) : .valid(session)
        }
    }

    var isExpiringSoon: Bool {
        guard let session else { return false }
        return session.isExpired()
    }

    var profile: NativeAuthProfile {
        session.map { NativeJWTClaims.profile(from: $0.accessToken) } ?? NativeAuthProfile(name: "", email: "")
    }

#if DEBUG
    func debugValidateCurrentSession(using urlSession: URLSession = .shared) {
        guard let session,
              let supabaseURL,
              let publishableKey,
              let url = URL(string: "auth/v1/user", relativeTo: supabaseURL) else {
            print("[NativeAuthDebug] configuration/session missing")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue(publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")

        print(
            "[NativeAuthDebug] sessionPresent=true " +
            "expired=\(session.isExpired()) " +
            "expiresAt=\(session.expiresAt)"
        )

        urlSession.dataTask(with: request) { _, response, error in
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            print(
                "[NativeAuthDebug] supabaseUserStatus=\(status) " +
                "error=\(error == nil ? "none" : "network")"
            )
        }.resume()
    }
#endif

    @discardableResult
    func save(_ session: NativeAuthSession, event: NativeAuthSessionEvent = .tokenRefreshed) -> Bool {
        guard session.isComplete else { return false }
        sessionMutationLock.lock()
        let marker = store.loadSignOutMarker()
        if marker == nil,
           case .valid(let storedSession) = store.loadSession(),
           storedSession == session {
            sessionMutationLock.unlock()
            return true
        }
        guard store.saveSession(session) else {
            sessionMutationLock.unlock()
            return false
        }
        store.clearSignOutMarker()
        sessionMutationLock.unlock()
        postChange(event: event, session: session)
        return true
    }

    @discardableResult
    func importWebSession(_ session: NativeAuthSession, revision: Int64) -> NativeWebSessionImportResult {
        guard session.isComplete else { return .rejectedInvalid }
        sessionMutationLock.lock()
        let marker = store.loadSignOutMarker()
        if let marker, revision <= marker.generation {
            sessionMutationLock.unlock()
            return .rejectedStale
        }
        if marker == nil,
           case .valid(let storedSession) = store.loadSession(),
           storedSession == session {
            sessionMutationLock.unlock()
            return .unchanged
        }
        guard store.saveSession(session) else {
            sessionMutationLock.unlock()
            return .persistenceFailed
        }
        store.clearSignOutMarker()
        sessionMutationLock.unlock()
        postChange(event: .signedIn, session: session, generation: revision)
        return .imported
    }

    static func session(fromWebStorageValue rawValue: String) -> NativeAuthSession? {
        guard let data = rawValue.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let accessToken = object["access_token"] as? String,
              let refreshToken = object["refresh_token"] as? String,
              let expiresAt = object["expires_at"] as? Int else { return nil }
        let session = NativeAuthSession(accessToken: accessToken, refreshToken: refreshToken, expiresAt: expiresAt)
        return session.isComplete ? session : nil
    }

    @discardableResult
    func update(from rawValue: String, revision: Int64? = nil) -> Bool {
        guard let session = Self.session(fromWebStorageValue: rawValue) else { return false }
        let authenticationRevision = revision
            ?? NativeJWTClaims.issuedAtMilliseconds(from: session.accessToken)
            ?? 0
        return importWebSession(session, revision: authenticationRevision).isAccepted
    }

    func accessToken(using urlSession: URLSession = .shared, completion: @escaping (String?) -> Void) {
        validSession(using: urlSession) { result in
            DispatchQueue.main.async { completion(try? result.get().accessToken) }
        }
    }

    func validSession(
        forceRefresh: Bool = false,
        using urlSession: URLSession? = nil,
        completion: @escaping (Result<NativeAuthSession, Error>) -> Void
    ) {
        guard let current = session else {
            completion(.failure(NativeAuthError.invalidSession(.missingAccessToken)))
            return
        }
        if !forceRefresh && !current.isExpired() {
            completion(.success(current))
            return
        }
        refresh(using: urlSession ?? defaultSession, completion: completion)
    }

    func refresh(using urlSession: URLSession, completion: @escaping (Bool) -> Void) {
        validSession(forceRefresh: true, using: urlSession) { result in
            DispatchQueue.main.async { completion((try? result.get()) != nil) }
        }
    }

    private func refresh(
        using urlSession: URLSession,
        completion: @escaping (Result<NativeAuthSession, Error>) -> Void
    ) {
        lock.lock()
        refreshWaiters.append(completion)
        if refreshTask != nil {
            lock.unlock()
            return
        }
        guard let current = session,
              let refreshToken = current.refreshToken,
              let supabaseURL,
              let publishableKey,
              let url = URL(string: "auth/v1/token?grant_type=refresh_token", relativeTo: supabaseURL) else {
            let waiters = refreshWaiters
            refreshWaiters.removeAll()
            lock.unlock()
            waiters.forEach { $0(.failure(NativeAuthError.configurationMissing)) }
            return
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])
        let task = urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self else { return }
            let result: Result<NativeAuthSession, Error>
            if let error {
                result = .failure(error)
            } else if let response = response as? HTTPURLResponse,
                      (200...299).contains(response.statusCode),
                      let data,
                      let refreshed = try? JSONDecoder().decode(NativeSupabaseRefreshResponse.self, from: data) {
                let replacement = NativeAuthSession(
                    accessToken: refreshed.accessToken,
                    refreshToken: refreshed.refreshToken ?? refreshToken,
                    expiresAt: refreshed.expiresAt ?? Int(Date().timeIntervalSince1970) + (refreshed.expiresIn ?? 3600)
                )
                self.save(replacement, event: .tokenRefreshed)
                result = .success(replacement)
            } else {
                self.invalidateAfterRefreshRejection()
                result = .failure(NativeAuthError.invalidSession(.refreshRejected))
            }
            self.lock.lock()
            let waiters = self.refreshWaiters
            self.refreshWaiters.removeAll()
            self.refreshTask = nil
            self.lock.unlock()
            waiters.forEach { $0(result) }
        }
        refreshTask = task
        lock.unlock()
        task.resume()
    }

    func clear(emitEvent: Bool = true) { explicitSignOut(emitEvent: emitEvent) }

    @discardableResult
    func explicitSignOut(generation: Int64 = nextRevisionId(), emitEvent: Bool = true) -> Bool {
        sessionMutationLock.lock()
        if store.loadSignOutMarker() != nil,
           case .missing = store.loadSession() {
            sessionMutationLock.unlock()
            return false
        }
        store.clearSession()
        let marker = SignOutMarker(generation: generation, createdAt: Date())
        store.saveSignOutMarker(marker)
        sessionMutationLock.unlock()
        cancelAuthenticatedWork()
        if emitEvent { postChange(event: .signedOut, session: nil, generation: generation) }
        return true
    }

    func discardInvalidState() { store.clearSession() }

    func registerAuthenticatedTask(_ task: NativeAuthenticatedTask) {
        lock.lock(); authenticatedTasks.append(task); lock.unlock()
    }

    func unregisterAuthenticatedTask(_ task: NativeAuthenticatedTask) {
        lock.lock(); authenticatedTasks.removeAll { $0 === task }; lock.unlock()
    }

    func cancelAuthenticatedWork() {
        lock.lock()
        let tasks = authenticatedTasks
        authenticatedTasks.removeAll()
        refreshTask?.cancel()
        refreshTask = nil
        let waiters = refreshWaiters
        refreshWaiters.removeAll()
        lock.unlock()
        tasks.forEach { $0.cancel() }
        waiters.forEach { $0(.failure(CancellationError())) }
        NotificationCenter.default.post(name: .nativeAuthenticatedWorkCancelled, object: nil)
    }

    private func invalidateAfterRefreshRejection() {
        explicitSignOut()
    }

    func updateProfileName(_ name: String, using urlSession: URLSession = .shared, completion: @escaping (Bool) -> Void) {
        validSession(using: urlSession) { [weak self] result in
            guard let self, let session = try? result.get(), let supabaseURL = self.supabaseURL,
                  let publishableKey = self.publishableKey,
                  let url = URL(string: "auth/v1/user", relativeTo: supabaseURL) else {
                DispatchQueue.main.async { completion(false) }; return
            }
            var request = URLRequest(url: url)
            request.httpMethod = "PUT"
            request.setValue(publishableKey, forHTTPHeaderField: "apikey")
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? JSONSerialization.data(withJSONObject: ["data": ["full_name": name]])
            urlSession.dataTask(with: request) { _, response, _ in
                let success = (response as? HTTPURLResponse).map { (200...299).contains($0.statusCode) } ?? false
                DispatchQueue.main.async { completion(success) }
            }.resume()
        }
    }

    func authenticate(
        email: String,
        password: String,
        name: String? = nil,
        signingUp: Bool,
        using urlSession: URLSession = .shared,
        completion: @escaping (Result<NativeAuthSession?, Error>) -> Void
    ) {
        guard let supabaseURL, let publishableKey,
              let url = URL(string: signingUp ? "auth/v1/signup" : "auth/v1/token?grant_type=password", relativeTo: supabaseURL) else {
            completion(.failure(NativeAuthError.configurationMissing)); return
        }
        var body: [String: Any] = ["email": email, "password": password]
        if signingUp, let name, !name.isEmpty { body["data"] = ["full_name": name] }
        performAuthentication(url: url, publishableKey: publishableKey, body: body, using: urlSession) { result in
            completion(result.map(Optional.some))
        }
    }

    func authenticateWithApple(
        identityToken: String,
        nonce: String,
        using urlSession: URLSession = .shared,
        completion: @escaping (Result<NativeAuthSession, Error>) -> Void
    ) {
        guard let supabaseURL, let publishableKey,
              let url = URL(string: "auth/v1/token?grant_type=id_token", relativeTo: supabaseURL) else {
            completion(.failure(NativeAuthError.configurationMissing)); return
        }
        performAuthentication(
            url: url,
            publishableKey: publishableKey,
            body: ["provider": "apple", "id_token": identityToken, "nonce": nonce],
            using: urlSession,
            completion: completion
        )
    }

    private func performAuthentication(
        url: URL,
        publishableKey: String,
        body: [String: Any],
        using urlSession: URLSession,
        completion: @escaping (Result<NativeAuthSession, Error>) -> Void
    ) {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        urlSession.dataTask(with: request) { [weak self] data, response, _ in
            guard let response = response as? HTTPURLResponse, let data else {
                DispatchQueue.main.async { completion(.failure(NativeAuthError.network)) }; return
            }
            guard (200...299).contains(response.statusCode) else {
                let payload = try? JSONDecoder().decode(NativeAuthErrorResponse.self, from: data)
                DispatchQueue.main.async { completion(.failure(NativeAuthError.server(payload?.message ?? payload?.errorDescription ?? "Almidy could not authenticate this account."))) }
                return
            }
            guard let payload = try? JSONDecoder().decode(NativeAuthSessionPayload.self, from: data),
                  let refreshToken = payload.refreshToken else {
                DispatchQueue.main.async { completion(.failure(NativeAuthError.invalidSession(.missingRefreshToken))) }; return
            }
            let session = NativeAuthSession(
                accessToken: payload.accessToken,
                refreshToken: refreshToken,
                expiresAt: payload.expiresAt ?? Int(Date().timeIntervalSince1970) + (payload.expiresIn ?? 3600)
            )
            self?.save(session, event: .signedIn)
            DispatchQueue.main.async { completion(.success(session)) }
        }.resume()
    }

    func authenticateWithGoogle(
        using presentationContext: ASWebAuthenticationPresentationContextProviding,
        completion: @escaping (Result<NativeAuthSession, Error>) -> Void
    ) -> ASWebAuthenticationSession? {
        guard let supabaseURL,
              var components = URLComponents(url: supabaseURL.appendingPathComponent("auth/v1/authorize"), resolvingAgainstBaseURL: false) else {
            completion(.failure(NativeAuthError.configurationMissing)); return nil
        }
        components.queryItems = [
            URLQueryItem(name: "provider", value: "google"),
            URLQueryItem(name: "redirect_to", value: nativeAuthCallbackURL.absoluteString)
        ]
        guard let url = components.url else { completion(.failure(NativeAuthError.configurationMissing)); return nil }
        let authSession = ASWebAuthenticationSession(url: url, callbackURLScheme: nativeAuthCallbackURL.scheme) { [weak self] callbackURL, error in
            if let error { DispatchQueue.main.async { completion(.failure(error)) }; return }
            guard let callbackURL, let session = Self.session(fromOAuthCallback: callbackURL) else {
                DispatchQueue.main.async { completion(.failure(NativeAuthError.invalidSession(.missingRefreshToken))) }; return
            }
            self?.save(session, event: .signedIn)
            DispatchQueue.main.async { completion(.success(session)) }
        }
        authSession.presentationContextProvider = presentationContext
        authSession.prefersEphemeralWebBrowserSession = false
        authSession.start()
        return authSession
    }

    static func session(fromOAuthCallback url: URL, now: Date = Date()) -> NativeAuthSession? {
        guard let values = oauthValues(url),
              let access = values["access_token"] as? String,
              let refresh = values["refresh_token"] as? String,
              let expiry = values["expires_at"] as? Int
                ?? (values["expires_in"] as? Int).map({ Int(now.timeIntervalSince1970) + $0 }) else {
            return nil
        }
        let session = NativeAuthSession(accessToken: access, refreshToken: refresh, expiresAt: expiry)
        return session.isComplete ? session : nil
    }

    private static func oauthValues(_ url: URL) -> [String: Any]? {
        let source = (url.fragment?.isEmpty == false ? url.fragment : url.query) ?? ""
        var values: [String: Any] = [:]
        for pair in source.split(separator: "&") {
            let parts = pair.split(separator: "=", maxSplits: 1).map(String.init)
            guard parts.count == 2, let key = parts[0].removingPercentEncoding,
                  let value = parts[1].removingPercentEncoding else { continue }
            values[key] = ["expires_in", "expires_at"].contains(key) ? Int(value) : value
        }
        return values
    }

    private func postChange(event: NativeAuthSessionEvent, session: NativeAuthSession?, generation: Int64? = nil) {
        let revision = generation ?? Self.nextRevisionId()
        NotificationCenter.default.post(
            name: .nativeAuthSessionChanged,
            object: NativeAuthSessionContract(
                event: event,
                revisionId: revision,
                accessToken: session?.accessToken,
                refreshToken: session?.refreshToken,
                expiresAt: session?.expiresAt,
                isSignedIn: session != nil,
                signOutGeneration: event == .signedOut ? revision : nil
            )
        )
    }

    static func nextRevisionId() -> Int64 {
        revisionQueue.sync {
            let timestamp = Int64(Date().timeIntervalSince1970 * 1000)
            lastRevisionId = max(timestamp, lastRevisionId + 1)
            return lastRevisionId
        }
    }
}

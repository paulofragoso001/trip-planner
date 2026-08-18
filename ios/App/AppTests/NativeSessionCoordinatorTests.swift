import Foundation
import XCTest
#if canImport(Almidy)
@testable import Almidy
#endif

final class NativeSessionCoordinatorTests: XCTestCase {
    private let future = Int(Date().addingTimeInterval(3_600).timeIntervalSince1970)
    private let past = Int(Date().addingTimeInterval(-3_600).timeIntervalSince1970)

    func testPayloadValidationAndExpiryStates() {
        XCTAssertFalse(NativeAuthSession(accessToken: "", refreshToken: "refresh", expiresAt: future).isComplete)
        XCTAssertFalse(NativeAuthSession(accessToken: "access", refreshToken: nil, expiresAt: future).isComplete)
        XCTAssertFalse(NativeAuthSession(accessToken: "access", refreshToken: "refresh", expiresAt: nil).isComplete)

        let validStore = TestSessionStore(session: .valid(session(expiresAt: future)))
        XCTAssertEqual(TestState(coordinator(store: validStore).state), .valid)
        XCTAssertFalse(session(expiresAt: future).isExpired())

        let expiredStore = TestSessionStore(session: .valid(session(expiresAt: past)))
        XCTAssertEqual(TestState(coordinator(store: expiredStore).state), .expired)
        XCTAssertTrue(session(expiresAt: past).isExpired())

        let invalidExpiry = TestSessionStore(session: .valid(session(expiresAt: 0)))
        XCTAssertEqual(TestState(coordinator(store: invalidExpiry).state), .invalid)
    }

    func testCurrentAndLegacyValidContractsNormalizeIdentically() throws {
        let current = try decodeContract(#"{"event":"SIGNED_IN","revisionId":1700000000000,"state":"valid","accessToken":"dummy-access","refreshToken":"dummy-refresh","expiresAt":1900000000,"isSignedIn":true}"#)
        let legacy = try decodeContract(#"{"event":"SIGNED_IN","revisionId":1700000000000,"accessToken":"dummy-access","refreshToken":"dummy-refresh","expiresAt":1900000000,"userId":"ignored-user","isSignedIn":true}"#)

        XCTAssertEqual(current, legacy)
        XCTAssertEqual(legacy.state, .valid)
        XCTAssertNil(legacy.userId, "A non-JWT legacy userId must not become authorization input")
    }

    func testLegacySignedOutAndMissingContractsRemainDistinct() throws {
        let signedOut = try decodeContract(#"{"event":"SIGNED_OUT","revisionId":1700000000001,"isSignedIn":false}"#)
        let missing = try decodeContract(#"{"event":"SIGNED_IN","revisionId":1700000000002,"isSignedIn":false}"#)

        XCTAssertEqual(signedOut.state, .explicitlySignedOut)
        XCTAssertEqual(missing.state, .missing)
        XCTAssertNil(signedOut.signOutGeneration)
    }

    func testLegacySignedInContractRequiresCompleteCredentials() {
        assertContractRejected(#"{"event":"SIGNED_IN","revisionId":1,"refreshToken":"dummy-refresh","expiresAt":1900000000,"isSignedIn":true}"#)
        assertContractRejected(#"{"event":"SIGNED_IN","revisionId":1,"accessToken":"dummy-access","expiresAt":1900000000,"isSignedIn":true}"#)
        assertContractRejected(#"{"event":"SIGNED_IN","revisionId":1,"accessToken":"dummy-access","refreshToken":"dummy-refresh","isSignedIn":true}"#)
    }

    func testLegacyExpiryAcceptsWholeJSONSecondsAndRejectsOtherRepresentations() throws {
        let wholeDouble = try decodeContract(#"{"event":"SIGNED_IN","revisionId":1700000000000.0,"accessToken":"dummy-access","refreshToken":"dummy-refresh","expiresAt":1900000000.0,"isSignedIn":true}"#)
        XCTAssertEqual(wholeDouble.expiresAt, 1_900_000_000)

        assertContractRejected(#"{"event":"SIGNED_IN","revisionId":1,"accessToken":"dummy-access","refreshToken":"dummy-refresh","expiresAt":1900000000000,"isSignedIn":true}"#)
        assertContractRejected(#"{"event":"SIGNED_IN","revisionId":1,"accessToken":"dummy-access","refreshToken":"dummy-refresh","expiresAt":3600,"isSignedIn":true}"#)
        assertContractRejected(#"{"event":"SIGNED_IN","revisionId":1,"accessToken":"dummy-access","refreshToken":"dummy-refresh","expiresAt":"1900000000","isSignedIn":true}"#)
    }

    func testExplicitCurrentStateIsAuthoritativeAndContradictionsAreRejected() throws {
        let signedOut = try decodeContract(#"{"event":"SIGNED_OUT","revisionId":3,"state":"explicitly_signed_out","signOutGeneration":3,"isSignedIn":false}"#)
        XCTAssertEqual(signedOut.state, .explicitlySignedOut)

        assertContractRejected(#"{"event":"SIGNED_OUT","revisionId":3,"state":"valid","accessToken":"dummy-access","refreshToken":"dummy-refresh","expiresAt":1900000000,"isSignedIn":true}"#)
        assertContractRejected(#"{"event":"SIGNED_IN","revisionId":3,"state":"invalid","isSignedIn":false}"#)
        assertContractRejected(#"{"event":"SIGNED_IN","revisionId":3,"state":"valid","accessToken":"dummy-access","refreshToken":"dummy-refresh","expiresAt":1900000000,"isSignedIn":false}"#)
    }

    func testMalformedRevisionAndLegacyCredentialContradictionsAreRejected() {
        assertContractRejected(#"{"event":"SIGNED_IN","revisionId":"bad","isSignedIn":false}"#)
        assertContractRejected(#"{"event":"SIGNED_IN","revisionId":1,"accessToken":"dummy-access","isSignedIn":false}"#)
        assertContractRejected(#"{"event":"SIGNED_OUT","revisionId":1,"accessToken":"dummy-access","refreshToken":"dummy-refresh","expiresAt":1900000000,"isSignedIn":true}"#)
    }

    func testSessionAndContractDescriptionsNeverExposeCredentials() throws {
        let accessSentinel = "ACCESS_TOKEN_MUST_NOT_APPEAR"
        let refreshSentinel = "REFRESH_TOKEN_MUST_NOT_APPEAR"
        let session = NativeAuthSession(
            accessToken: accessSentinel,
            refreshToken: refreshSentinel,
            expiresAt: 1_900_000_000
        )
        let contract = try decodeContract(#"{"event":"SIGNED_IN","revisionId":1700000000000,"state":"valid","accessToken":"ACCESS_TOKEN_MUST_NOT_APPEAR","refreshToken":"REFRESH_TOKEN_MUST_NOT_APPEAR","expiresAt":1900000000,"isSignedIn":true}"#)

        for output in [session.description, session.debugDescription, contract.description, contract.debugDescription] {
            XCTAssertFalse(output.contains(accessSentinel))
            XCTAssertFalse(output.contains(refreshSentinel))
            XCTAssertFalse(output.localizedCaseInsensitiveContains("Bearer "))
        }
    }

    func testReconciliationNeverImportsWebWhenNativeMissingOrInvalid() {
        let webSession = session(expiresAt: future)
        let reconciler = NativeWebSessionReconciler()
        XCTAssertEqual(
            reconciler.reconcile(native: .missing, web: .valid(webSession, revision: 10)),
            [.remainSignedOut]
        )
        XCTAssertEqual(
            reconciler.reconcile(native: .invalid(.corruptStorage), web: .valid(webSession, revision: 10)),
            [.discardInvalidNative, .remainSignedOut]
        )
    }

    func testReconciliationRestoresWebAndHandlesBothMissing() {
        let nativeSession = session(expiresAt: future)
        let reconciler = NativeWebSessionReconciler()
        XCTAssertEqual(reconciler.reconcile(native: .valid(nativeSession), web: .missing), [.restoreWeb(nativeSession)])
        XCTAssertEqual(reconciler.reconcile(native: .missing, web: .missing), [.remainSignedOut])
        XCTAssertEqual(
            reconciler.reconcile(native: .invalid(.corruptStorage), web: .missing),
            [.discardInvalidNative, .remainSignedOut]
        )
    }

    func testReconciliationRefreshesExpiredNativeSession() {
        let expired = session(expiresAt: past)
        XCTAssertEqual(
            NativeWebSessionReconciler().reconcile(native: .expired(expired), web: .missing),
            [.refreshNative(expired)]
        )
    }

    func testExplicitNativeAndWebSignOutClearAll() {
        let marker = SignOutMarker(generation: 20, createdAt: Date(timeIntervalSince1970: 0))
        let reconciler = NativeWebSessionReconciler()
        XCTAssertEqual(
            reconciler.reconcile(native: .explicitlySignedOut(marker), web: .missing),
            [.clearAll(marker), .remainSignedOut]
        )
        guard case .clearAll(let webMarker)? = reconciler.reconcile(
            native: .valid(session(expiresAt: future)),
            web: .explicitlySignedOut(generation: 30)
        ).first else { return XCTFail("Expected explicit Web sign-out to clear all state") }
        XCTAssertEqual(webMarker.generation, 30)
    }

    func testSignOutMarkerSurvivesRelaunchAndWebAuthenticationCannotSupersedeIt() {
        let store = TestSessionStore(session: .valid(session(expiresAt: future)))
        let first = coordinator(store: store)
        first.explicitSignOut(generation: 50, emitEvent: false)
        XCTAssertEqual(TestState(coordinator(store: store).state), .signedOut)
        XCTAssertEqual(first.importWebSession(session(expiresAt: future), revision: 49), .rejectedInvalid)
        XCTAssertEqual(first.importWebSession(session(expiresAt: future), revision: 51), .rejectedInvalid)
        XCTAssertEqual(store.marker?.generation, 50)
        XCTAssertEqual(TestState(first.state), .signedOut)
    }

    func testIdenticalWebImportDoesNotSaveClearMarkerOrEmit() {
        let current = session(expiresAt: future)
        let store = TestSessionStore(session: .valid(current))
        let coordinator = coordinator(store: store)
        var eventCount = 0
        let observer = NotificationCenter.default.addObserver(
            forName: .nativeAuthSessionChanged,
            object: nil,
            queue: nil
        ) { _ in eventCount += 1 }
        defer { NotificationCenter.default.removeObserver(observer) }

        XCTAssertEqual(coordinator.importWebSession(current, revision: 100), .rejectedInvalid)
        XCTAssertEqual(store.saveCount, 0)
        XCTAssertEqual(store.clearMarkerCount, 0)
        XCTAssertEqual(eventCount, 0)
    }

    func testChangedWebSessionFieldsCannotReplaceNativeSession() {
        let original = session(expiresAt: future)
        for changed in [
            NativeAuthSession(accessToken: "changed-access", refreshToken: "refresh", expiresAt: future),
            NativeAuthSession(accessToken: "access", refreshToken: "rotated-refresh", expiresAt: future),
            NativeAuthSession(accessToken: "access", refreshToken: "refresh", expiresAt: future + 60)
        ] {
            let store = TestSessionStore(session: .valid(original))
            let coordinator = coordinator(store: store)
            let revision: Int64 = 500
            var emittedRevision: Int64?
            let observer = NotificationCenter.default.addObserver(
                forName: .nativeAuthSessionChanged,
                object: nil,
                queue: nil
            ) { notification in
                emittedRevision = (notification.object as? NativeAuthSessionContract)?.revisionId
            }
            XCTAssertEqual(coordinator.importWebSession(changed, revision: revision), .rejectedInvalid)
            NotificationCenter.default.removeObserver(observer)
            XCTAssertEqual(store.saveCount, 0)
            XCTAssertNil(emittedRevision)
        }
    }

    func testExplicitSignOutIsNotSwallowedBySessionEquality() {
        let current = session(expiresAt: future)
        let store = TestSessionStore(session: .valid(current))
        let coordinator = coordinator(store: store)
        var signedOutEvents = 0
        let observer = NotificationCenter.default.addObserver(
            forName: .nativeAuthSessionChanged,
            object: nil,
            queue: nil
        ) { notification in
            guard (notification.object as? NativeAuthSessionContract)?.event == .signedOut else { return }
            signedOutEvents += 1
        }
        defer { NotificationCenter.default.removeObserver(observer) }

        coordinator.explicitSignOut(generation: 700)
        XCTAssertEqual(signedOutEvents, 1)
        XCTAssertEqual(store.clearSessionCount, 1)
        XCTAssertEqual(store.marker?.generation, 700)
    }

    func testRepeatedExplicitSignOutAcknowledgementDoesNotEmitAgain() {
        let store = TestSessionStore(session: .valid(session(expiresAt: future)))
        let coordinator = coordinator(store: store)
        var signedOutEvents = 0
        let observer = NotificationCenter.default.addObserver(
            forName: .nativeAuthSessionChanged,
            object: nil,
            queue: nil
        ) { notification in
            guard (notification.object as? NativeAuthSessionContract)?.event == .signedOut else { return }
            signedOutEvents += 1
        }
        defer { NotificationCenter.default.removeObserver(observer) }

        XCTAssertTrue(coordinator.explicitSignOut(generation: 800))
        XCTAssertFalse(coordinator.explicitSignOut(generation: 801))
        XCTAssertEqual(signedOutEvents, 1)
        XCTAssertEqual(store.marker?.generation, 800)
    }

    func testConcurrentIdenticalImportsWriteAndEmitOnlyOnce() async {
        let store = TestSessionStore()
        let coordinator = coordinator(store: store)
        let imported = session(expiresAt: future)
        var eventCount = 0
        let observer = NotificationCenter.default.addObserver(
            forName: .nativeAuthSessionChanged,
            object: nil,
            queue: nil
        ) { _ in
            eventCount += 1
        }
        defer { NotificationCenter.default.removeObserver(observer) }

        let results = await withTaskGroup(
            of: NativeWebSessionImportResult.self,
            returning: [NativeWebSessionImportResult].self
        ) { group in
            for _ in 0..<10 {
                group.addTask {
                    await MainActor.run {
                        coordinator.importWebSession(imported, revision: 900)
                    }
                }
            }
            var collected: [NativeWebSessionImportResult] = []
            for await result in group { collected.append(result) }
            return collected
        }

        XCTAssertEqual(results.count, 10)
        XCTAssertEqual(results.filter { $0 == .rejectedInvalid }.count, 10)
        XCTAssertEqual(store.saveCount, 0)
        XCTAssertEqual(store.clearMarkerCount, 0)
        XCTAssertEqual(eventCount, 0)
    }

    func testMissingNativeStateNeverOverwritesValidWebSession() {
        let actions = NativeWebSessionReconciler().reconcile(
            native: .missing,
            web: .valid(session(expiresAt: future), revision: 100)
        )
        XCTAssertTrue(actions.contains(.remainSignedOut))
        XCTAssertEqual(actions.count, 1)
    }

    func testColdLaunchOrderHonorsSignOutBeforeStoredCredentials() {
        let store = TestSessionStore(
            session: .valid(session(expiresAt: future)),
            marker: SignOutMarker(generation: 100, createdAt: Date())
        )
        XCTAssertEqual(TestState(coordinator(store: store).state), .signedOut)
    }

    func testValidAccessTokenIsReusedAndHeaderIsGenerated() {
        let store = TestSessionStore(session: .valid(session(expiresAt: future)))
        let coordinator = coordinator(store: store)
        let expectation = expectation(description: "request")
        TestURLProtocol.handler = { request in
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer access")
            return (200, Data("ok".utf8))
        }
        let client = client(coordinator: coordinator)
        client.request(path: "/api/test", method: "GET", body: nil) { result in
            XCTAssertEqual(try? result.get(), Data("ok".utf8))
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 2)
        XCTAssertEqual(TestURLProtocol.requestCount, 1)
    }

    func testConcurrentExpiryPerformsOneRefreshAndRotatesToken() {
        let store = TestSessionStore(session: .valid(session(expiresAt: past)))
        let coordinator = coordinator(store: store)
        TestURLProtocol.handler = { request in
            XCTAssertTrue(request.url?.absoluteString.contains("grant_type=refresh_token") == true)
            return (200, Data(#"{"access_token":"new-access","refresh_token":"new-refresh","expires_in":3600}"#.utf8))
        }
        let expectations = (0..<5).map { expectation(description: "refresh-\($0)") }
        for item in expectations {
            coordinator.validSession { result in
                XCTAssertEqual(try? result.get().refreshToken, "new-refresh")
                item.fulfill()
            }
        }
        wait(for: expectations, timeout: 2)
        XCTAssertEqual(TestURLProtocol.requestCount, 1)
        guard case .valid(let stored) = store.stored else { return XCTFail("Expected rotated session") }
        XCTAssertEqual(stored.accessToken, "new-access")
        XCTAssertEqual(stored.refreshToken, "new-refresh")
    }

    func testRefreshRejectionClearsCredentialsAndTransitionsToAuthenticationExpired() {
        let store = TestSessionStore(session: .valid(session(expiresAt: past)))
        let coordinator = coordinator(store: store)
        TestURLProtocol.handler = { _ in (400, Data(#"{"error":"invalid_grant"}"#.utf8)) }
        let expectation = expectation(description: "rejected")
        coordinator.validSession { result in
            if case .failure(let error) = result {
                XCTAssertFalse(error.localizedDescription.contains("access"))
                XCTAssertFalse(error.localizedDescription.contains("refresh"))
            } else {
                XCTFail("Expected refresh rejection")
            }
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 2)
        XCTAssertEqual(TestState(coordinator.state), .invalid)
        XCTAssertEqual(coordinator.authState, .authenticationExpired)
        XCTAssertNil(store.marker)
        XCTAssertNil(coordinator.session)
    }

    func testAuthenticatedClientRetriesOnlyOnceAfter401() {
        let store = TestSessionStore(session: .valid(session(expiresAt: future)))
        let coordinator = coordinator(store: store)
        TestURLProtocol.handler = { request in
            XCTAssertTrue(request.url?.absoluteString.contains("grant_type=refresh_token") == true)
            return (200, Data(#"{"access_token":"replacement","refresh_token":"rotated","expires_in":3600}"#.utf8))
        }
        var apiRequestCount = 0
        let executor: NativeAuthenticatedHTTPClient.RequestExecutor = { request, completion in
            let task = MockURLSessionDataTask()
            task.onResume = {
                apiRequestCount += 1
                let response = HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!
                DispatchQueue.global().async { completion(Data(), response, nil) }
            }
            return task
        }
        let expectation = expectation(description: "one retry")
        let httpClient = client(coordinator: coordinator, executor: executor)
        httpClient.request(path: "/api/test", method: "GET", body: nil) { result in
            guard case .failure = result else { XCTFail("Expected one failed retry"); return }
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 2)
        XCTAssertEqual(apiRequestCount, 2, "Initial request and one retry only")
        XCTAssertEqual(TestURLProtocol.requestCount, 1, "Only one token refresh is allowed")
    }

    func testExplicitSignOutCancelsAuthenticatedRequest() {
        let store = TestSessionStore(session: .valid(session(expiresAt: future)))
        let coordinator = coordinator(store: store)
        let executor: NativeAuthenticatedHTTPClient.RequestExecutor = { _, completion in
            let task = MockURLSessionDataTask()
            task.onCancel = { completion(nil, nil, URLError(.cancelled)) }
            return task
        }
        let expectation = expectation(description: "cancelled")
        let httpClient = client(coordinator: coordinator, executor: executor)
        httpClient.request(path: "/api/test", method: "GET", body: nil) { result in
            guard case .failure = result else { XCTFail("Expected cancellation"); return }
            expectation.fulfill()
        }
        coordinator.explicitSignOut(emitEvent: false)
        wait(for: [expectation], timeout: 2)
        XCTAssertEqual(TestState(coordinator.state), .signedOut)
    }

    func testSessionChangePropagatesForControlledWebRestoration() {
        let store = TestSessionStore()
        let coordinator = coordinator(store: store)
        let expectation = expectation(forNotification: .nativeAuthSessionChanged, object: nil) { notification in
            (notification.object as? NativeAuthSessionContract)?.accessToken == "access"
        }
        coordinator.save(session(expiresAt: future), event: .signedIn)
        wait(for: [expectation], timeout: 1)
    }

    func testEmailLoginHandoffPersistsCompleteNativeSession() throws {
        let store = TestSessionStore()
        let coordinator = coordinator(store: store)
        TestURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/auth/v1/token")
            XCTAssertEqual(request.url?.query, "grant_type=password")
            XCTAssertEqual(request.httpMethod, "POST")
            let body = try request.capturedBody()
            let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
            XCTAssertEqual(json["email"] as? String, "traveler@example.com")
            XCTAssertEqual(json["password"] as? String, "correct-horse")
            return (200, Data(#"{"access_token":"email-access","refresh_token":"email-refresh","expires_at":1900000000}"#.utf8))
        }
        let completed = expectation(description: "email authentication")
        coordinator.authenticate(
            email: "traveler@example.com",
            password: "correct-horse",
            signingUp: false,
            using: testURLSession()
        ) { result in
            guard case .success(let session) = result else {
                XCTFail("Expected email authentication success")
                completed.fulfill()
                return
            }
            XCTAssertEqual(session?.refreshToken, "email-refresh")
            completed.fulfill()
        }
        wait(for: [completed], timeout: 2)
        guard case .valid(let stored) = store.stored else { return XCTFail("Expected persisted email session") }
        XCTAssertEqual(stored.accessToken, "email-access")
    }

    func testAppleLoginHandoffPersistsCompleteNativeSession() throws {
        let store = TestSessionStore()
        let coordinator = coordinator(store: store)
        TestURLProtocol.handler = { request in
            XCTAssertEqual(request.url?.path, "/auth/v1/token")
            XCTAssertEqual(request.url?.query, "grant_type=id_token")
            XCTAssertEqual(request.httpMethod, "POST")
            let body = try request.capturedBody()
            let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
            XCTAssertEqual(json["provider"] as? String, "apple")
            XCTAssertEqual(json["id_token"] as? String, "dummy-identity-token")
            XCTAssertEqual(json["nonce"] as? String, "dummy-nonce")
            return (200, Data(#"{"access_token":"apple-access","refresh_token":"apple-refresh","expires_in":3600}"#.utf8))
        }
        let completed = expectation(description: "apple authentication")
        coordinator.authenticateWithApple(
            identityToken: "dummy-identity-token",
            nonce: "dummy-nonce",
            using: testURLSession()
        ) { result in
            XCTAssertEqual(try? result.get().refreshToken, "apple-refresh")
            completed.fulfill()
        }
        wait(for: [completed], timeout: 2)
        guard case .valid(let stored) = store.stored else { return XCTFail("Expected persisted Apple session") }
        XCTAssertEqual(stored.accessToken, "apple-access")
    }

    func testGoogleCallbackHandoffRequiresAndNormalizesCompleteSession() throws {
        let callback = try XCTUnwrap(URL(
            string: "app.almidy.premium://auth/callback#access_token=google-access&refresh_token=google-refresh&expires_in=3600"
        ))
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let session = try XCTUnwrap(NativeSessionCoordinator.session(fromOAuthCallback: callback, now: now))
        XCTAssertEqual(session.accessToken, "google-access")
        XCTAssertEqual(session.refreshToken, "google-refresh")
        XCTAssertEqual(session.expiresAt, 1_800_003_600)

        let incomplete = try XCTUnwrap(URL(
            string: "app.almidy.premium://auth/callback#access_token=google-access&expires_in=3600"
        ))
        XCTAssertNil(NativeSessionCoordinator.session(fromOAuthCallback: incomplete, now: now))
    }

    override func setUp() {
        super.setUp()
        TestURLProtocol.handler = nil
        TestURLProtocol.requestCount = 0
        TestURLProtocol.responseDelay = 0.01
    }

    override func tearDown() {
        TestURLProtocol.handler = nil
        TestURLProtocol.requestCount = 0
        TestURLProtocol.responseDelay = 0
        super.tearDown()
    }

    private func session(expiresAt: Int) -> NativeAuthSession {
        NativeAuthSession(accessToken: "access", refreshToken: "refresh", expiresAt: expiresAt)
    }

    private func decodeContract(_ json: String) throws -> NativeAuthSessionContract {
        try JSONDecoder().decode(NativeAuthSessionContract.self, from: Data(json.utf8))
    }

    private func assertContractRejected(
        _ json: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertThrowsError(try decodeContract(json), file: file, line: line)
    }

    private func coordinator(store: TestSessionStore) -> NativeSessionCoordinator {
        NativeSessionCoordinator(
            supabaseURL: URL(string: "https://project.supabase.co")!,
            publishableKey: "public-key",
            store: store,
            urlSession: testURLSession()
        )
    }

    private func client(
        coordinator: NativeSessionCoordinator,
        executor: NativeAuthenticatedHTTPClient.RequestExecutor? = nil
    ) -> NativeAuthenticatedHTTPClient {
        NativeAuthenticatedHTTPClient(
            webView: nil,
            baseURL: URL(string: "https://almidy.app")!,
            session: testURLSession(),
            coordinator: coordinator,
            requestExecutor: executor
        )
    }

    private func testURLSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [TestURLProtocol.self]
        return URLSession(configuration: configuration)
    }
}

private final class MockURLSessionDataTask: NativeAuthenticatedTask {
    var onResume: (() -> Void)?
    var onCancel: (() -> Void)?
    func resume() { onResume?() }
    func cancel() { onCancel?() }
}

private enum TestState { case missing, valid, expired, invalid, signedOut }

private extension TestState {
    init(_ state: NativeSessionState) {
        switch state {
        case .missing: self = .missing
        case .valid: self = .valid
        case .expired: self = .expired
        case .invalid: self = .invalid
        case .explicitlySignedOut: self = .signedOut
        }
    }
}

private final class TestSessionStore: NativeSessionStoring {
    var stored: NativeStoredSession
    var marker: SignOutMarker?
    private(set) var saveCount = 0
    private(set) var clearSessionCount = 0
    private(set) var clearMarkerCount = 0

    init(session: NativeStoredSession = .missing, marker: SignOutMarker? = nil) {
        stored = session
        self.marker = marker
    }

    func loadSession() -> NativeStoredSession { stored }
    func saveSession(_ session: NativeAuthSession) -> Bool {
        saveCount += 1
        stored = .valid(session)
        return true
    }
    func clearSession() {
        clearSessionCount += 1
        stored = .missing
    }
    func loadSignOutMarker() -> SignOutMarker? { marker }
    func saveSignOutMarker(_ marker: SignOutMarker) { self.marker = marker }
    func clearSignOutMarker() {
        clearMarkerCount += 1
        marker = nil
    }
}

private final class TestURLProtocol: URLProtocol {
    static var handler: ((URLRequest) throws -> (Int, Data))?
    static var requestCount = 0
    static var responseDelay: TimeInterval = 0
    private var workItem: DispatchWorkItem?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.requestCount += 1
        let item = DispatchWorkItem { [weak self] in
            guard let self else { return }
            do {
                let (status, data) = try XCTUnwrap(Self.handler)(self.request)
                let response = HTTPURLResponse(url: self.request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
                self.client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
                self.client?.urlProtocol(self, didLoad: data)
                self.client?.urlProtocolDidFinishLoading(self)
            } catch {
                self.client?.urlProtocol(self, didFailWithError: error)
            }
        }
        workItem = item
        DispatchQueue.global().asyncAfter(deadline: .now() + Self.responseDelay, execute: item)
    }
    override func stopLoading() { workItem?.cancel() }
}

private extension URLRequest {
    func capturedBody() throws -> Data {
        if let httpBody { return httpBody }
        guard let httpBodyStream else {
            throw TestURLProtocolError.missingRequestBody
        }
        httpBodyStream.open()
        defer { httpBodyStream.close() }
        var body = Data()
        let bufferSize = 4_096
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        while true {
            let count = httpBodyStream.read(buffer, maxLength: bufferSize)
            if count < 0 {
                throw httpBodyStream.streamError ?? TestURLProtocolError.requestBodyReadFailed
            }
            if count == 0 { break }
            body.append(buffer, count: count)
        }
        guard !body.isEmpty else { throw TestURLProtocolError.missingRequestBody }
        return body
    }
}

private enum TestURLProtocolError: Error {
    case missingRequestBody
    case requestBodyReadFailed
}

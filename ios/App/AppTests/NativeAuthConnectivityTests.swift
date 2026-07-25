import Capacitor
import Foundation
import MapKit
import XCTest
@testable import App

@MainActor
final class NativeAuthConnectivityTests: XCTestCase {
    func testKeychainSessionRestoresAndAutomaticallyRefreshesBeforeUse() throws {
        let service = "app.almidy.tests.supabase-session-\(UUID().uuidString)"
        let store = NativeSessionStore(service: service)
        let coordinator = NativeSessionCoordinator(
            service: service,
            supabaseURL: URL(string: "https://supabase.test")!,
            publishableKey: "test-publishable-key",
            store: store
        )
        coordinator.save(NativeAuthSession(
            accessToken: "expired-access-token",
            refreshToken: "refresh-token",
            expiresAt: Int(Date().timeIntervalSince1970) - 1
        ))
        defer {
            store.clearSession()
            store.clearSignOutMarker()
        }

        guard let restoredSession = coordinator.session else {
            throw XCTSkip("The AppTests bundle cannot access Keychain items in this simulator runtime.")
        }
        XCTAssertEqual(restoredSession.accessToken, "expired-access-token")
        XCTAssertTrue(coordinator.isExpiringSoon)

        NativeAuthSessionURLProtocol.handler = { request in
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.value(forHTTPHeaderField: "apikey"), "test-publishable-key")
            let body = try! XCTUnwrap(request.httpBody)
            let json = try! XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
            XCTAssertEqual(json["refresh_token"] as? String, "refresh-token")
            let response = NativeAuthSessionURLProtocol.response(for: request, statusCode: 200)
            let responseBody = """
            {"access_token":"refreshed-access-token","refresh_token":"rotated-refresh-token","expires_in":3600}
            """.data(using: .utf8)!
            return (response, responseBody)
        }
        defer { NativeAuthSessionURLProtocol.handler = nil }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [NativeAuthSessionURLProtocol.self]
        let session = URLSession(configuration: configuration)
        let expectation = expectation(description: "automatic session refresh")

        coordinator.accessToken(using: session) { accessToken in
            XCTAssertEqual(accessToken, "refreshed-access-token")
            XCTAssertEqual(coordinator.session?.refreshToken, "rotated-refresh-token")
            XCTAssertFalse(coordinator.isExpiringSoon)
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 2)
    }

    func testNativeAuthSessionContractCoversSignInRefreshAndSignOut() throws {
        let signedIn = NativeAuthSessionContract(
            event: .signedIn,
            revisionId: 1,
            accessToken: "access-token",
            refreshToken: "refresh-token",
            expiresAt: 1_900_000_000,
            userId: "user-1",
            isSignedIn: true
        )
        let refreshed = NativeAuthSessionContract(
            event: .tokenRefreshed,
            revisionId: 2,
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
            expiresAt: 1_900_003_600,
            userId: "user-1",
            isSignedIn: true
        )
        let signedOut = NativeAuthSessionContract.signedOut(revisionId: 3)

        for contract in [signedIn, refreshed, signedOut] {
            let data = try JSONEncoder().encode(contract)
            let decoded = try JSONDecoder().decode(NativeAuthSessionContract.self, from: data)
            XCTAssertEqual(decoded, contract)
        }
        XCTAssertEqual(signedIn.userId, refreshed.userId)
        XCTAssertFalse(signedOut.isSignedIn)
        XCTAssertNil(signedOut.accessToken)
        XCTAssertNil(signedOut.refreshToken)
    }

    func testEmptyWebAuthStorageDoesNotRepresentASignedInSession() {
        XCTAssertNil(NativeSessionCoordinator.session(fromWebStorageValue: ""))
        XCTAssertNil(NativeSessionCoordinator.session(fromWebStorageValue: "{}"))
        XCTAssertNil(NativeSessionCoordinator.session(fromWebStorageValue: #"{"access_token":""}"#))
    }

    func testWebAuthStorageRequiresANonemptyAccessToken() throws {
        let rawValue = #"{"access_token":"web-access-token","refresh_token":"web-refresh-token","expires_at":1900000000,"user":{"id":"user-1"}}"#
        let session = try XCTUnwrap(NativeSessionCoordinator.session(fromWebStorageValue: rawValue))

        XCTAssertEqual(session.accessToken, "web-access-token")
        XCTAssertEqual(session.refreshToken, "web-refresh-token")
        XCTAssertEqual(session.expiresAt, 1_900_000_000)
    }

}

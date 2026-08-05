import Foundation
import XCTest
@testable import App

func nativeTripStoreSession() -> URLSession {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [NativeTripStoreURLProtocol.self]
    return URLSession(configuration: configuration)
}

func nativeTripStore(baseURL: URL = URL(string: "https://almidy.app")!) -> NativeTripStore {
    NativeTripStore(
        webView: nil,
        baseURL: baseURL,
        session: nativeTripStoreSession(),
        coordinator: NativeSessionCoordinator(store: NativeTripStoreSessionStore())
    )
}

private final class NativeTripStoreSessionStore: NativeSessionStoring {
    private var storedSession = NativeStoredSession.valid(
        NativeAuthSession(
            accessToken: "native-trip-store-test-access-token",
            refreshToken: "native-trip-store-test-refresh-token",
            expiresAt: Int(Date().addingTimeInterval(3_600).timeIntervalSince1970)
        )
    )

    func loadSession() -> NativeStoredSession { storedSession }

    func saveSession(_ session: NativeAuthSession) -> Bool {
        storedSession = .valid(session)
        return true
    }

    func clearSession() { storedSession = .missing }
    func loadSignOutMarker() -> SignOutMarker? { nil }
    func saveSignOutMarker(_ marker: SignOutMarker) {}
    func clearSignOutMarker() {}
}
func nativeRequestBodyData(_ request: URLRequest) -> Data? {
    if let body = request.httpBody {
        return body
    }
    guard let stream = request.httpBodyStream else {
        return nil
    }

    stream.open()
    defer { stream.close() }

    var data = Data()
    var buffer = [UInt8](repeating: 0, count: 1_024)
    while stream.hasBytesAvailable {
        let count = stream.read(&buffer, maxLength: buffer.count)
        guard count >= 0 else { return nil }
        if count == 0 { break }
        data.append(contentsOf: buffer.prefix(count))
    }
    return data
}

final class NativeTripStoreURLProtocol: URLProtocol {
    static var handler: ((URLRequest) -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocolDidFinishLoading(self)
            return
        }
        let (response, body) = handler(request)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    static func response(for request: URLRequest, statusCode: Int) -> HTTPURLResponse {
        HTTPURLResponse(
            url: request.url!,
            statusCode: statusCode,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
    }
}

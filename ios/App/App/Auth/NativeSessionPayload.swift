import Foundation

enum NativeAuthSessionEvent: String, Codable {
    case signedIn = "SIGNED_IN"
    case signedOut = "SIGNED_OUT"
    case tokenRefreshed = "TOKEN_REFRESHED"
}

struct NativeAuthSession: Codable, Equatable, CustomStringConvertible, CustomDebugStringConvertible {
    let accessToken: String
    let refreshToken: String?
    let expiresAt: Int?

    init(accessToken: String, refreshToken: String?, expiresAt: Int?, userId: String? = nil) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
    }

    var userId: String? { NativeJWTClaims.subject(from: accessToken) }

    var isComplete: Bool {
        !accessToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !(refreshToken ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && expiresAt != nil
    }

    func isExpired(at date: Date = Date(), leeway: TimeInterval = 60) -> Bool {
        guard let expiresAt else { return true }
        return date.timeIntervalSince1970 >= Double(expiresAt) - leeway
    }

    var description: String {
        "NativeAuthSession(credentialsPresent: \(isComplete), expiresAt: \(expiresAt.map(String.init) ?? "missing"))"
    }

    var debugDescription: String { description }
}

enum SessionInvalidReason: String, Codable, Equatable {
    case corruptStorage
    case missingAccessToken
    case missingRefreshToken
    case missingExpiry
    case invalidExpiry
    case refreshRejected
}

struct SignOutMarker: Codable, Equatable {
    let generation: Int64
    let createdAt: Date
}

enum NativeSessionState: Equatable {
    case missing
    case valid(NativeAuthSession)
    case expired(NativeAuthSession)
    case invalid(SessionInvalidReason)
    case explicitlySignedOut(SignOutMarker)
}

struct NativeAuthProfile: Equatable {
    let name: String
    let email: String
}

struct NativeUserIdentity: Equatable {
    let id: String
    let profile: NativeAuthProfile
}

enum NativeAuthState: Equatable {
    case loading
    case authenticated(NativeUserIdentity)
    case refreshable
    case authenticationExpired
    case signedOut
}

struct NativeIdentityIsolationBoundary: Equatable {
    private(set) var verifiedUserID: String?

    init(verifiedUserID: String?) { self.verifiedUserID = verifiedUserID }

    mutating func transition(to nextUserID: String?) -> Bool {
        let shouldPurge = verifiedUserID != nextUserID && verifiedUserID != nil
        verifiedUserID = nextUserID
        return shouldPurge
    }
}

struct NativeAuthSessionContract: Codable, Equatable, CustomStringConvertible, CustomDebugStringConvertible {
    enum State: String, Codable {
        case missing
        case valid
        case expired
        case invalid
        case explicitlySignedOut = "explicitly_signed_out"
    }

    let event: NativeAuthSessionEvent
    let revisionId: Int64
    let accessToken: String?
    let refreshToken: String?
    let expiresAt: Int?
    let isSignedIn: Bool
    let signOutGeneration: Int64?
    let state: State

    private enum CodingKeys: String, CodingKey {
        case event
        case revisionId
        case state
        case accessToken
        case refreshToken
        case expiresAt
        case signOutGeneration
        case isSignedIn
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        event = try values.decode(NativeAuthSessionEvent.self, forKey: .event)
        revisionId = try Self.decodeInteger(Int64.self, from: values, forKey: .revisionId, reason: "invalid_revision")
        guard revisionId > 0 else {
            throw Self.invalid("invalid_revision", key: .revisionId, in: values)
        }

        accessToken = try values.decodeIfPresent(String.self, forKey: .accessToken)
        refreshToken = try values.decodeIfPresent(String.self, forKey: .refreshToken)
        expiresAt = try Self.decodeOptionalExpiry(from: values)
        signOutGeneration = try Self.decodeOptionalInteger(Int64.self, from: values, forKey: .signOutGeneration)
        isSignedIn = try values.decode(Bool.self, forKey: .isSignedIn)

        let hasAccessToken = !(accessToken ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasRefreshToken = !(refreshToken ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasAnyCredential = hasAccessToken || hasRefreshToken || expiresAt != nil
        let hasCompleteCredentials = hasAccessToken && hasRefreshToken && expiresAt != nil

        if let explicitState = try values.decodeIfPresent(State.self, forKey: .state) {
            switch explicitState {
            case .valid, .expired:
                guard event != .signedOut, isSignedIn, hasCompleteCredentials else {
                    throw Self.invalid("contradictory_session_flags", key: .state, in: values)
                }
            case .explicitlySignedOut:
                guard event == .signedOut, !isSignedIn, !hasAnyCredential else {
                    throw Self.invalid("contradictory_session_flags", key: .state, in: values)
                }
            case .missing:
                guard event != .signedOut, !isSignedIn, !hasAnyCredential else {
                    throw Self.invalid("contradictory_session_flags", key: .state, in: values)
                }
            case .invalid:
                throw Self.invalid("contradictory_session_flags", key: .state, in: values)
            }
            state = explicitState
            return
        }

        // Compatibility for the deployed Web bridge. A missing state is not a
        // sign-out signal: only an explicit SIGNED_OUT event can create that
        // intent. Legacy userId fields are deliberately ignored.
        if event == .signedOut {
            guard !isSignedIn, !hasAnyCredential else {
                throw Self.invalid("contradictory_session_flags", key: .event, in: values)
            }
            state = .explicitlySignedOut
        } else if isSignedIn {
            guard hasCompleteCredentials else {
                throw Self.invalid("incomplete_signed_in_credentials", key: .isSignedIn, in: values)
            }
            state = .valid
        } else {
            guard !hasAnyCredential else {
                throw Self.invalid("contradictory_session_flags", key: .isSignedIn, in: values)
            }
            state = .missing
        }
    }

    init(
        event: NativeAuthSessionEvent,
        revisionId: Int64,
        accessToken: String?,
        refreshToken: String?,
        expiresAt: Int?,
        userId: String? = nil,
        isSignedIn: Bool,
        signOutGeneration: Int64? = nil,
        state: State? = nil
    ) {
        self.event = event
        self.revisionId = revisionId
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
        self.isSignedIn = isSignedIn
        self.signOutGeneration = signOutGeneration
        self.state = state ?? (event == .signedOut ? .explicitlySignedOut : isSignedIn ? .valid : .missing)
    }

    var userId: String? { accessToken.flatMap(NativeJWTClaims.subject(from:)) }

    static func signedOut(revisionId: Int64) -> NativeAuthSessionContract {
        NativeAuthSessionContract(
            event: .signedOut,
            revisionId: revisionId,
            accessToken: nil,
            refreshToken: nil,
            expiresAt: nil,
            isSignedIn: false,
            signOutGeneration: revisionId,
            state: .explicitlySignedOut
        )
    }

    var description: String {
        "NativeAuthSessionContract(event: \(event.rawValue), state: \(state.rawValue), credentialsPresent: \(isSignedIn && accessToken?.isEmpty == false && refreshToken?.isEmpty == false), expiresAt: \(expiresAt.map(String.init) ?? "missing"), revisionId: \(revisionId), signOutGeneration: \(signOutGeneration.map(String.init) ?? "none"))"
    }

    var debugDescription: String { description }

    private static func decodeOptionalExpiry(
        from values: KeyedDecodingContainer<CodingKeys>
    ) throws -> Int? {
        guard values.contains(.expiresAt), try !values.decodeNil(forKey: .expiresAt) else { return nil }
        let expiry = try decodeInteger(Int.self, from: values, forKey: .expiresAt, reason: "invalid_expiry_type")
        // Unix seconds are currently ten digits. This rejects relative values
        // and millisecond timestamps without performing an ambiguous conversion.
        guard (1_000_000_000..<10_000_000_000).contains(expiry) else {
            throw invalid("invalid_expiry_type", key: .expiresAt, in: values)
        }
        return expiry
    }

    private static func decodeOptionalInteger<T: FixedWidthInteger & Decodable>(
        _ type: T.Type,
        from values: KeyedDecodingContainer<CodingKeys>,
        forKey key: CodingKeys
    ) throws -> T? {
        guard values.contains(key), try !values.decodeNil(forKey: key) else { return nil }
        return try decodeInteger(type, from: values, forKey: key, reason: "invalid_revision")
    }

    private static func decodeInteger<T: FixedWidthInteger & Decodable>(
        _ type: T.Type,
        from values: KeyedDecodingContainer<CodingKeys>,
        forKey key: CodingKeys,
        reason: String
    ) throws -> T {
        if let integer = try? values.decode(T.self, forKey: key) { return integer }
        if let number = try? values.decode(Double.self, forKey: key),
           number.isFinite,
           number.rounded(.towardZero) == number,
           number >= Double(T.min),
           number <= Double(T.max) {
            return T(number)
        }
        throw invalid(reason, key: key, in: values)
    }

    private static func invalid(
        _ reason: String,
        key: CodingKeys,
        in values: KeyedDecodingContainer<CodingKeys>
    ) -> DecodingError {
        DecodingError.dataCorruptedError(forKey: key, in: values, debugDescription: reason)
    }
}

extension Notification.Name {
    static let nativeAuthSessionChanged = Notification.Name("app.almidy.nativeAuthSessionChanged")
    static let nativeAuthExpired = Notification.Name("app.almidy.nativeAuthExpired")
    static let nativeAuthenticatedWorkCancelled = Notification.Name("app.almidy.nativeAuthenticatedWorkCancelled")
}

enum NativeJWTClaims {
    static func subject(from accessToken: String) -> String? {
        payload(accessToken)?["sub"] as? String
    }

    static func profile(from accessToken: String) -> NativeAuthProfile {
        guard let payload = payload(accessToken) else { return NativeAuthProfile(name: "", email: "") }
        let metadata = payload["user_metadata"] as? [String: Any]
        let name = metadata?["full_name"] as? String ?? metadata?["name"] as? String ?? ""
        return NativeAuthProfile(name: name, email: payload["email"] as? String ?? "")
    }

    static func issuedAtMilliseconds(from accessToken: String) -> Int64? {
        guard let issuedAt = payload(accessToken)?["iat"] as? NSNumber else { return nil }
        return issuedAt.int64Value * 1_000
    }

    private static func payload(_ accessToken: String) -> [String: Any]? {
        let parts = accessToken.split(separator: ".")
        guard parts.count >= 2 else { return nil }
        var encoded = String(parts[1]).replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        encoded += String(repeating: "=", count: (4 - encoded.count % 4) % 4)
        guard let data = Data(base64Encoded: encoded),
              let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return payload
    }
}

struct NativeSupabaseRefreshResponse: Decodable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: Int?
    let expiresAt: Int?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case expiresAt = "expires_at"
    }
}

struct NativeAuthSessionPayload: Decodable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: Int?
    let expiresAt: Int?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case expiresAt = "expires_at"
    }
}

enum NativeAuthError: LocalizedError {
    case configurationMissing
    case invalidSession(SessionInvalidReason)
    case network
    case server(String)

    var errorDescription: String? {
        switch self {
        case .configurationMissing: return "Native authentication is not configured yet."
        case .invalidSession: return "Your Almidy session is no longer valid."
        case .network: return "Check your connection and try again."
        case .server(let message): return message
        }
    }
}

struct NativeAuthErrorResponse: Decodable {
    let message: String?
    let errorDescription: String?

    enum CodingKeys: String, CodingKey {
        case message
        case errorDescription = "error_description"
    }
}

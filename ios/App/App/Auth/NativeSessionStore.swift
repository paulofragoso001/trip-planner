import Foundation
import Security

enum NativeStoredSession {
    case missing
    case valid(NativeAuthSession)
    case invalid
}

protocol NativeSessionStoring: AnyObject {
    func loadSession() -> NativeStoredSession
    @discardableResult func saveSession(_ session: NativeAuthSession) -> Bool
    func clearSession()
    func loadSignOutMarker() -> SignOutMarker?
    func saveSignOutMarker(_ marker: SignOutMarker)
    func clearSignOutMarker()
}

final class NativeSessionStore: NativeSessionStoring {
    private let service: String
    private let account: String
    private let markerKey: String
    private let defaults: UserDefaults

    init(
        service: String = "app.almidy.premium.supabase-session",
        account: String = "current",
        defaults: UserDefaults = .standard
    ) {
        self.service = service
        self.account = account
        self.markerKey = service + ".explicit-sign-out"
        self.defaults = defaults
    }

    func loadSession() -> NativeStoredSession {
        guard let data = readData() else { return .missing }
        guard let session = try? JSONDecoder().decode(NativeAuthSession.self, from: data) else { return .invalid }
        return .valid(session)
    }

    @discardableResult
    func saveSession(_ session: NativeAuthSession) -> Bool {
        guard let data = try? JSONEncoder().encode(session) else { return false }
        let query = keychainQuery
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
        }
        return status == errSecSuccess
    }

    func clearSession() { SecItemDelete(keychainQuery as CFDictionary) }

    func loadSignOutMarker() -> SignOutMarker? {
        guard let data = defaults.data(forKey: markerKey) else { return nil }
        return try? JSONDecoder().decode(SignOutMarker.self, from: data)
    }

    func saveSignOutMarker(_ marker: SignOutMarker) {
        defaults.set(try? JSONEncoder().encode(marker), forKey: markerKey)
    }

    func clearSignOutMarker() { defaults.removeObject(forKey: markerKey) }

    private var keychainQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }

    private func readData() -> Data? {
        var query = keychainQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }
}

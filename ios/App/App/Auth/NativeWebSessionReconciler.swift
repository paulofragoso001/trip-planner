import Foundation

enum NativeWebSessionState: Equatable {
    case missing
    case valid(NativeAuthSession, revision: Int64)
    case explicitlySignedOut(generation: Int64)
}

enum NativeSessionReconciliationAction: Equatable {
    @available(*, deprecated, message: "Web sessions are projections and cannot be imported into native auth.")
    case importWeb(NativeAuthSession, revision: Int64)
    case preserveNative(NativeAuthSession)
    case refreshNative(NativeAuthSession)
    case restoreWeb(NativeAuthSession)
    case clearAll(SignOutMarker)
    case discardInvalidNative
    case remainSignedOut
}

struct NativeWebSessionReconciler {
    func reconcile(native: NativeSessionState, web: NativeWebSessionState) -> [NativeSessionReconciliationAction] {
        if case .explicitlySignedOut(let marker) = native {
            return [.clearAll(marker), .remainSignedOut]
        }
        if case .explicitlySignedOut(let generation) = web {
            return [.clearAll(SignOutMarker(generation: generation, createdAt: Date(timeIntervalSince1970: Double(generation) / 1000)))]
        }

        switch (native, web) {
        case (.missing, .valid):
            return [.remainSignedOut]
        case (.valid(let session), .missing):
            return [.restoreWeb(session)]
        case (.expired(let session), _):
            return [.refreshNative(session)]
        case (.invalid, .valid):
            return [.discardInvalidNative, .remainSignedOut]
        case (.invalid, .missing):
            return [.discardInvalidNative, .remainSignedOut]
        case (.missing, .missing):
            return [.remainSignedOut]
        case (.valid(let session), .valid):
            return [.preserveNative(session)]
        default:
            return []
        }
    }
}

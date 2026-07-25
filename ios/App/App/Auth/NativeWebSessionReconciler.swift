import Foundation

enum NativeWebSessionState: Equatable {
    case missing
    case valid(NativeAuthSession, revision: Int64)
    case explicitlySignedOut(generation: Int64)
}

enum NativeSessionReconciliationAction: Equatable {
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
            if case .valid(let session, let revision) = web, revision > marker.generation {
                return [.importWeb(session, revision: revision)]
            }
            return [.clearAll(marker), .remainSignedOut]
        }
        if case .explicitlySignedOut(let generation) = web {
            return [.clearAll(SignOutMarker(generation: generation, createdAt: Date(timeIntervalSince1970: Double(generation) / 1000)))]
        }

        switch (native, web) {
        case (.missing, .valid(let session, let revision)):
            return [.importWeb(session, revision: revision)]
        case (.valid(let session), .missing):
            return [.restoreWeb(session)]
        case (.expired(let session), _):
            return [.refreshNative(session)]
        case (.invalid, .valid(let session, let revision)):
            return [.discardInvalidNative, .importWeb(session, revision: revision)]
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

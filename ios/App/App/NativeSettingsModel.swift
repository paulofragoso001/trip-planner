import Foundation

enum NativeSettingsAction: Equatable {
    case openManualReservationImporter
    case openTrips
    case openTravelBook
    case openHelp
    case openNotificationPreferences
    case selectCurrency
    case selectDistanceUnit
    case shareAlmidy
    case openPublicPage(path: String)
    case composeSupportEmail(address: String)
}

enum NativeCurrency: String, CaseIterable, Codable, Equatable {
    case USD, EUR, GBP, BRL, JPY, CAD
    var label: String {
        switch self {
        case .USD: return "US Dollar (USD)"
        case .EUR: return "Euro (EUR)"
        case .GBP: return "British Pound (GBP)"
        case .BRL: return "Brazilian Real (BRL)"
        case .JPY: return "Japanese Yen (JPY)"
        case .CAD: return "Canadian Dollar (CAD)"
        }
    }
}

enum NativeDistanceUnit: String, CaseIterable, Codable, Equatable {
    case miles, kilometers
    var label: String { self == .miles ? "Miles" : "Kilometers" }
}

struct NativeUserPreferences: Codable, Equatable {
    let defaultCurrency: NativeCurrency
    let distanceUnit: NativeDistanceUnit
    enum CodingKeys: String, CodingKey {
        case defaultCurrency = "default_currency"
        case distanceUnit = "distance_unit"
    }
    static let defaults = NativeUserPreferences(defaultCurrency: .USD, distanceUnit: .miles)
}

enum NativePreferenceViewState: Equatable {
    case signedOut
    case loading
    case loaded(NativeUserPreferences)
    case saving(NativeUserPreferences)
    case failed(NativeUserPreferences?)

    var preferences: NativeUserPreferences? {
        switch self {
        case .loaded(let value), .saving(let value): return value
        case .failed(let value): return value
        case .signedOut, .loading: return nil
        }
    }
}

enum NativeShareContract {
    static let url = URL(string: "https://almidy.app")!
    static let message = "Plan memorable trips with Almidy."
}

struct NativeSettingsRowModel: Equatable {
    let title: String
    let detail: String?
    let systemImageName: String
    let action: NativeSettingsAction?

    var isEnabled: Bool { action != nil }
    var showsDisclosureIndicator: Bool { isEnabled }
}

struct NativeSettingsSectionModel: Equatable {
    let title: String
    let rows: [NativeSettingsRowModel]
}

enum NativeSettingsCatalog {
    static let supportEmail = "support@almidy.app"

    static var sections: [NativeSettingsSectionModel] { sections(preferenceState: .signedOut) }

    static func sections(preferenceState: NativePreferenceViewState) -> [NativeSettingsSectionModel] { [
        NativeSettingsSectionModel(title: "Automations", rows: [
            row("Add Reservations via Email", detail: "Coming soon", icon: "envelope"),
            row("Calendar Feed", detail: "Pro soon", icon: "calendar"),
            row("Connect with Claude / MCP", detail: "Soon", icon: "link"),
            row("Shortcuts", detail: "Soon", icon: "wand.and.rays"),
            row(
                "Manual Reservation Importer",
                icon: "suitcase",
                action: .openManualReservationImporter
            )
        ]),
        NativeSettingsSectionModel(title: "Customize", rows: [
            preferenceRow("Currency", field: .currency, state: preferenceState),
            preferenceRow("Distance Unit", field: .distance, state: preferenceState),
            row("Language", detail: "Soon", icon: "globe"),
            row("Trips Timeline", icon: "timeline.selection", action: .openTrips),
            row("Travel Book", icon: "book.closed", action: .openTravelBook),
            row("Notifications", icon: "bell", action: .openNotificationPreferences),
            row("Widgets", detail: "Soon", icon: "square.grid.2x2"),
            row("Storage and Data", detail: "Soon", icon: "externaldrive")
        ]),
        NativeSettingsSectionModel(title: "Help Center", rows: [
            row("Need help?", icon: "questionmark.circle", action: .openHelp),
            row(
                "Talk to us",
                icon: "message",
                action: .composeSupportEmail(address: supportEmail)
            ),
            row("Review the App", detail: "Soon", icon: "star"),
            row("App Updates", detail: "Unavailable until App Store listing", icon: "arrow.down.app")
        ]),
        NativeSettingsSectionModel(title: "About", rows: [
            row("About Almidy", icon: "info.circle", action: .openPublicPage(path: "/about")),
            row("Terms of Service", icon: "doc.text", action: .openPublicPage(path: "/terms")),
            row("Privacy Policy", icon: "lock", action: .openPublicPage(path: "/privacy")),
            row("Share with a friend", icon: "square.and.arrow.up", action: .shareAlmidy)
        ])
    ] }

    static func row(named title: String) -> NativeSettingsRowModel? {
        sections.lazy.flatMap(\.rows).first { $0.title == title }
    }

    private static func row(
        _ title: String,
        detail: String? = nil,
        icon: String,
        action: NativeSettingsAction? = nil
    ) -> NativeSettingsRowModel {
        NativeSettingsRowModel(
            title: title,
            detail: detail,
            systemImageName: icon,
            action: action
        )
    }

    private enum PreferenceField { case currency, distance }

    private static func preferenceRow(_ title: String, field: PreferenceField, state: NativePreferenceViewState) -> NativeSettingsRowModel {
        let icon = field == .currency ? "banknote" : "ruler"
        switch state {
        case .signedOut: return row(title, detail: "Sign in to manage", icon: icon)
        case .loading: return row(title, detail: "Loading…", icon: icon)
        case .saving(let value):
            let current = field == .currency ? value.defaultCurrency.label : value.distanceUnit.label
            return row(title, detail: current + " · Saving…", icon: icon)
        case .failed(let value):
            let current = value.map { field == .currency ? $0.defaultCurrency.label : $0.distanceUnit.label }
            return row(title, detail: current.map { $0 + " · Offline" } ?? "Unavailable", icon: icon)
        case .loaded(let value):
            return row(title, detail: field == .currency ? value.defaultCurrency.label : value.distanceUnit.label, icon: icon, action: field == .currency ? .selectCurrency : .selectDistanceUnit)
        }
    }
}

enum NativeSettingsAppMetadata {
    static func version(bundle: Bundle = .main) -> String {
        let version = (bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
        let build = (bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
        guard let version else { return "Version Unknown" }
        return build.map { "Version \(version) (\($0))" } ?? "Version \(version)"
    }
}

enum NativeProfileMenuModel {
    static let changePasswordTitle = "Email Password Reset"
    static let isChangePasswordEnabled = true
    static let resetSuccessMessage = "If email delivery succeeds, Almidy will send reset instructions to your verified account email. The link opens Almidy’s secure web reset flow."
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}

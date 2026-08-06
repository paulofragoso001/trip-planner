import Foundation

enum NativeSettingsAction: Equatable {
    case openManualReservationImporter
    case openTrips
    case openTravelBook
    case openHelp
    case openPublicPage(path: String)
    case composeSupportEmail(address: String)
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

    static let sections: [NativeSettingsSectionModel] = [
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
            row("Currency", detail: "Soon", icon: "banknote"),
            row("Distance Unit", detail: "Soon", icon: "ruler"),
            row("Language", detail: "Soon", icon: "globe"),
            row("Trips Timeline", icon: "timeline.selection", action: .openTrips),
            row("Travel Book", icon: "book.closed", action: .openTravelBook),
            row("Notifications", detail: "Soon", icon: "bell"),
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
            row("App Updates", detail: "Soon", icon: "arrow.down.app")
        ]),
        NativeSettingsSectionModel(title: "About", rows: [
            row("About Almidy", icon: "info.circle", action: .openPublicPage(path: "/about")),
            row("Terms of Service", icon: "doc.text", action: .openPublicPage(path: "/terms")),
            row("Privacy Policy", icon: "lock", action: .openPublicPage(path: "/privacy")),
            row("Share to a Friend", detail: "Soon", icon: "square.and.arrow.up")
        ])
    ]

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
}

enum NativeSettingsAppMetadata {
    static func version(bundle: Bundle = .main) -> String {
        let value = bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        return value?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty ?? "Unknown"
    }
}

enum NativeProfileMenuModel {
    static let changePasswordTitle = "Change Password · Soon"
    static let isChangePasswordEnabled = false
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}

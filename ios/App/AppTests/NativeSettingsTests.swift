import XCTest
@testable import App

final class NativeSettingsTests: XCTestCase {
    func testEveryVisibleRowHasTruthfulEnabledAndDisclosureState() {
        let enabledRows: Set<String> = [
            "Manual Reservation Importer",
            "Trips Timeline",
            "Travel Book",
            "Need help?",
            "Talk to us",
            "Notifications",
            "Share with a friend",
            "About Almidy",
            "Terms of Service",
            "Privacy Policy"
        ]

        let rows = NativeSettingsCatalog.sections.flatMap(\.rows)
        XCTAssertEqual(rows.count, 21)
        for row in rows {
            XCTAssertEqual(row.isEnabled, enabledRows.contains(row.title), row.title)
            XCTAssertEqual(row.showsDisclosureIndicator, row.isEnabled, row.title)
            if !row.isEnabled {
                XCTAssertNil(row.action, row.title)
                XCTAssertTrue(
                    row.detail.map(["Soon", "Pro soon", "Coming soon", "Sign in to manage", "Unavailable until App Store listing"].contains) == true,
                    row.title
                )
            }
        }
    }

    func testCanonicalSettingsActionsMapToCorrectDestinations() {
        XCTAssertEqual(action(for: "Manual Reservation Importer"), .openManualReservationImporter)
        XCTAssertEqual(action(for: "Trips Timeline"), .openTrips)
        XCTAssertEqual(action(for: "Travel Book"), .openTravelBook)
        XCTAssertEqual(action(for: "Need help?"), .openHelp)
        XCTAssertEqual(action(for: "Notifications"), .openNotificationPreferences)
        XCTAssertEqual(action(for: "Share with a friend"), .shareAlmidy)
        XCTAssertEqual(
            action(for: "Talk to us"),
            .composeSupportEmail(address: "support@almidy.app")
        )
        XCTAssertEqual(action(for: "About Almidy"), .openPublicPage(path: "/about"))
        XCTAssertEqual(action(for: "Terms of Service"), .openPublicPage(path: "/terms"))
        XCTAssertEqual(action(for: "Privacy Policy"), .openPublicPage(path: "/privacy"))
    }

    func testDeferredCalendarAndEmailForwardingAreDisabled() {
        let calendar = row(named: "Calendar Feed")
        XCTAssertFalse(calendar.isEnabled)
        XCTAssertEqual(calendar.detail, "Pro soon")

        let email = row(named: "Add Reservations via Email")
        XCTAssertFalse(email.isEnabled)
        XCTAssertEqual(email.detail, "Coming soon")
    }

    func testProfilePasswordActionRoutesToVerifiedEmailReset() {
        XCTAssertTrue(NativeProfileMenuModel.isChangePasswordEnabled)
        XCTAssertEqual(NativeProfileMenuModel.changePasswordTitle, "Email Password Reset")
        XCTAssertTrue(NativeProfileMenuModel.resetSuccessMessage.contains("verified account email"))
        XCTAssertTrue(NativeProfileMenuModel.resetSuccessMessage.contains("web reset flow"))
    }

    func testVersionComesFromBundleMetadata() {
        XCTAssertTrue(NativeSettingsAppMetadata.version().hasPrefix("Version "))
        XCTAssertTrue(NativeSettingsAppMetadata.version().contains("("))
    }

    func testPreferenceRowsHaveTruthfulLoadingPersistedSavingAndFailureStates() {
        XCTAssertEqual(row(named: "Currency", state: .loading).detail, "Loading…")
        XCTAssertFalse(row(named: "Currency", state: .loading).isEnabled)
        let preferences = NativeUserPreferences(defaultCurrency: .EUR, distanceUnit: .kilometers)
        XCTAssertEqual(row(named: "Currency", state: .loaded(preferences)).detail, "Euro (EUR)")
        XCTAssertEqual(row(named: "Currency", state: .loaded(preferences)).action, .selectCurrency)
        XCTAssertEqual(row(named: "Distance Unit", state: .loaded(preferences)).detail, "Kilometers")
        XCTAssertEqual(row(named: "Distance Unit", state: .saving(preferences)).detail, "Kilometers · Saving…")
        XCTAssertEqual(row(named: "Distance Unit", state: .failed(preferences)).detail, "Kilometers · Offline")
    }

    func testAppUpdateAndShareContractsAreTruthfulAndIPadSafeInputsAreStable() {
        let updates = row(named: "App Updates")
        XCTAssertFalse(updates.isEnabled)
        XCTAssertEqual(updates.detail, "Unavailable until App Store listing")
        XCTAssertEqual(NativeShareContract.url.absoluteString, "https://almidy.app")
        XCTAssertEqual(NativeShareContract.message, "Plan memorable trips with Almidy.")
    }

    private func row(named title: String) -> NativeSettingsRowModel {
        guard let row = NativeSettingsCatalog.row(named: title) else {
            XCTFail("Missing Settings row: \(title)")
            return NativeSettingsRowModel(title: title, detail: nil, systemImageName: "", action: nil)
        }
        return row
    }

    private func action(for title: String) -> NativeSettingsAction? {
        row(named: title).action
    }

    private func row(named title: String, state: NativePreferenceViewState) -> NativeSettingsRowModel {
        guard let row = NativeSettingsCatalog.sections(preferenceState: state).flatMap(\.rows).first(where: { $0.title == title }) else {
            XCTFail("Missing Settings row: \(title)")
            return NativeSettingsRowModel(title: title, detail: nil, systemImageName: "", action: nil)
        }
        return row
    }
}

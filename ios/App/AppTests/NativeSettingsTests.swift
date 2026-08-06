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
                    row.detail.map(["Soon", "Pro soon", "Coming soon"].contains) == true,
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

    func testProfilePasswordActionIsTruthfullyDisabled() {
        XCTAssertFalse(NativeProfileMenuModel.isChangePasswordEnabled)
        XCTAssertEqual(NativeProfileMenuModel.changePasswordTitle, "Change Password · Soon")
    }

    func testVersionComesFromBundleMetadata() {
        XCTAssertNotEqual(NativeSettingsAppMetadata.version(), "Unknown")
        XCTAssertFalse(NativeSettingsAppMetadata.version().isEmpty)
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
}

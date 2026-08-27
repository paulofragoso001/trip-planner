import XCTest
@testable import Almidy

@MainActor
final class NativeActivityUtilityTests: XCTestCase {
    func testReservationDetailsPreserveFieldOrderInputAndGeometry() throws {
        let view = NativeReservationDetailsView(rows: [
            (label: "Phone", placeholder: "(XXX) XXX-XXXX"),
            (label: "Website", placeholder: "https://almidy.app"),
            (label: "Reservation Code", placeholder: "ABC123")
        ]) {}
        view.frame = CGRect(x: 0, y: 0, width: 353, height: 170)
        view.layoutIfNeeded()

        XCTAssertEqual(view.fields.count, 3)
        XCTAssertEqual(view.fields["Phone"]?.placeholder, "(XXX) XXX-XXXX")
        XCTAssertEqual(view.fields["Website"]?.placeholder, "https://almidy.app")
        XCTAssertEqual(view.fields["Reservation Code"]?.placeholder, "ABC123")
        XCTAssertEqual(view.fields["Phone"]?.font?.pointSize, 17)
        XCTAssertEqual(view.fields["Website"]?.keyboardType, .default)
        XCTAssertEqual(view.bounds.height, 170)

        XCTAssertEqual(NativeReservationDetailsView.rowHeight, 52)
        XCTAssertEqual(NativeReservationDetailsView.labelWidth, 138)
        XCTAssertEqual(NativeReservationDetailsView.rowSpacing, 18)
        XCTAssertEqual(NativeReservationDetailsView.separatorHeight, 0.5)
        XCTAssertEqual(
            NativeReservationDetailsView.contentMargins,
            UIEdgeInsets(top: 6, left: 16, bottom: 6, right: 16)
        )
    }

    func testAirportCodeRetainsCapitalizationAndCorrectionBehavior() throws {
        let view = NativeReservationDetailsView(rows: [
            (label: "Departure Airport Code", placeholder: "IATA")
        ]) {}
        let field = try XCTUnwrap(view.fields["Departure Airport Code"])

        XCTAssertEqual(field.autocapitalizationType, .allCharacters)
        XCTAssertEqual(field.autocorrectionType, .no)
        XCTAssertEqual(field.keyboardType, .default)
    }

    func testReservationEditingInvokesOwnerCallbackWithoutChangingStoredText() throws {
        var changes = 0
        let view = NativeReservationDetailsView(rows: [
            (label: "Seat", placeholder: "3B")
        ]) { changes += 1 }
        let field = try XCTUnwrap(view.fields["Seat"])
        field.text = " 12A "

        field.sendActions(for: .editingChanged)

        XCTAssertEqual(changes, 1)
        XCTAssertEqual(field.text, " 12A ")
    }

    func testLinkAlertPreservesNativeInputConfiguration() throws {
        let alert = NativeLinkInputAlert.make { _, _ in }
        let field = try XCTUnwrap(alert.textFields?.first)

        XCTAssertEqual(alert.title, "Save Link")
        XCTAssertEqual(alert.message, "Add a link to this flight.")
        XCTAssertEqual(alert.actions.map(\.title), ["Cancel", "Save"])
        XCTAssertEqual(field.placeholder, "https://")
        XCTAssertEqual(field.keyboardType, .URL)
        XCTAssertEqual(field.autocapitalizationType, .none)
        XCTAssertEqual(field.autocorrectionType, .no)
    }

    func testLinkValidationPreservesSchemeTrimmingAndDisplayNameRules() throws {
        let result = try XCTUnwrap(NativeLinkInputAlert.validatedLink("  https://www.example.com/path  "))

        XCTAssertEqual(result.0.absoluteString, "https://www.example.com/path")
        XCTAssertEqual(result.1, "example.com")
        XCTAssertNil(NativeLinkInputAlert.validatedLink("example.com"))
        XCTAssertNil(NativeLinkInputAlert.validatedLink("ftp://example.com"))
        XCTAssertNil(NativeLinkInputAlert.validatedLink(""))
    }

    func testAttachmentLauncherPreservesMenuAndMeasuredRow() throws {
        let view = NativeAttachmentActionView(
            onImportDocument: {}, onSaveLink: {}, onChoosePhoto: {}, onTakePhoto: {}
        )
        view.frame = CGRect(x: 0, y: 0, width: 353, height: 64)
        view.layoutIfNeeded()
        let button = try XCTUnwrap(
            view.utilityDescendants(of: UIButton.self).first { $0.accessibilityIdentifier == "native-attachment-action" }
        )

        XCTAssertEqual(view.bounds.height, 64)
        XCTAssertEqual(view.titleLabel.text, "Add File, Photo or Link")
        XCTAssertEqual(view.titleLabel.font.pointSize, 19)
        XCTAssertTrue(button.showsMenuAsPrimaryAction)
        XCTAssertEqual(button.menu?.title, "Add Document")
        XCTAssertEqual(button.menu?.children.compactMap { ($0 as? UIAction)?.title }, [
            "Import Document", "Save Link", "Choose Photo from Library", "Take a Photo"
        ])
        XCTAssertEqual(button.frame, view.bounds)
    }
}

private extension UIView {
    func utilityDescendants<T: UIView>(of type: T.Type) -> [T] {
        var matches = self is T ? [self as! T] : []
        for subview in subviews { matches.append(contentsOf: subview.utilityDescendants(of: type)) }
        return matches
    }
}

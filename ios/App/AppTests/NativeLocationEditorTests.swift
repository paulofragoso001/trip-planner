import XCTest
@testable import Almidy

@MainActor
final class NativeLocationEditorTests: XCTestCase {
    func testDetailsPreserveLocationOwnedFieldsAndGeometry() throws {
        let view = NativeLocationDetailsView {}

        XCTAssertEqual(NativeLocationDetailsView.rows.map(\.label), ["Phone", "Website", "Reservation Code"])
        XCTAssertEqual(view.fields["Phone"]?.placeholder, "(XXX) XXX-XXXX")
        XCTAssertEqual(view.fields["Website"]?.placeholder, "https://almidy.app")
        XCTAssertEqual(view.fields["Reservation Code"]?.placeholder, "ABC123")
        XCTAssertEqual(NativeLocationDetailsView.rowHeight, 52)
        XCTAssertEqual(NativeLocationDetailsView.labelWidth, 138)
        XCTAssertEqual(NativeLocationDetailsView.rowSpacing, 18)
        XCTAssertEqual(NativeLocationDetailsView.separatorHeight, 0.5)
        XCTAssertEqual(NativeLocationDetailsView.contentMargins, UIEdgeInsets(top: 6, left: 16, bottom: 6, right: 16))
    }

    func testDetailsEditingPreservesTextAndNotifiesOwner() throws {
        var changes = 0
        let view = NativeLocationDetailsView { changes += 1 }
        let field = try XCTUnwrap(view.fields["Website"])
        field.text = " https://example.com/place "

        field.sendActions(for: .editingChanged)

        XCTAssertEqual(changes, 1)
        XCTAssertEqual(field.text, " https://example.com/place ")
        XCTAssertEqual(field.keyboardType, .default)
        XCTAssertEqual(field.accessibilityLabel, "Website")
    }

    func testSchedulePreservesControlGeometryAndCallbacks() {
        var dateActions = 0
        var timeActions = 0
        let view = NativeLocationScheduleView(
            title: "Check-in",
            onDate: { dateActions += 1 },
            onTime: { timeActions += 1 }
        )

        view.dateButton.sendActions(for: .touchUpInside)
        view.timeButton.sendActions(for: .touchUpInside)

        XCTAssertEqual(dateActions, 1)
        XCTAssertEqual(timeActions, 1)
        XCTAssertEqual(view.dateButton.title(for: .normal), "Date")
        XCTAssertEqual(view.timeButton.title(for: .normal), "Time")
        XCTAssertEqual(NativeLocationScheduleView.height, 64)
        XCTAssertEqual(NativeLocationScheduleView.minimumControlWidth, 60)
        XCTAssertEqual(NativeLocationScheduleView.contentMargins, UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16))
    }

    func testCategoryPreservesMeasuredPresentationAndActionSemantics() throws {
        var actions = 0
        let view = NativeLocationCategoryView(
            category: "Stay",
            accent: .systemBlue,
            onChangeCategory: { actions += 1 }
        )
        let row = try XCTUnwrap(view.locationDescendants(of: UIStackView.self).first {
            $0.accessibilityIdentifier == "native-location-category"
        })
        XCTAssertTrue(row.accessibilityActivate())

        XCTAssertEqual(actions, 1)
        XCTAssertEqual(row.accessibilityLabel, "Location, Change Category")
        XCTAssertTrue(row.accessibilityTraits.contains(.button))
        XCTAssertEqual(NativeLocationCategoryView.height, 76)
        XCTAssertEqual(NativeLocationCategoryView.iconSize, 48)
        XCTAssertEqual(NativeLocationCategoryView.contentMargins, UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16))
    }
}

private extension UIView {
    func locationDescendants<T: UIView>(of type: T.Type) -> [T] {
        var matches: [T] = []
        if let match = self as? T { matches.append(match) }
        for subview in subviews { matches.append(contentsOf: subview.locationDescendants(of: type)) }
        return matches
    }
}

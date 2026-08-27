import XCTest
@testable import Almidy

@MainActor
final class NativeSavedPlaceEditorTests: XCTestCase {
    func testCompositionReusesLocationSectionsAndPreservesPrimaryFields() throws {
        let editor = makeEditor()

        XCTAssertEqual(Set(editor.primaryFields.keys), Set(["Name", "Address"]))
        XCTAssertEqual(Set(editor.detailFields.keys), Set(["Phone", "Website", "Reservation Code"]))
        XCTAssertEqual(editor.primaryFields["Name"]?.placeholder, "Name")
        XCTAssertEqual(editor.primaryFields["Address"]?.placeholder, "Address")
        XCTAssertEqual(editor.accessibilityIdentifier, "native-saved-place-editor-content")
        XCTAssertEqual(NativeSavedPlaceEditorView.sectionSpacing, 14)
    }

    func testPrimaryAndDetailMutationsNotifyOwnerWithoutNormalization() throws {
        var changes = 0
        let editor = makeEditor(onChange: { changes += 1 })
        let name = try XCTUnwrap(editor.primaryFields["Name"])
        let website = try XCTUnwrap(editor.detailFields["Website"])
        name.text = "  Museum  "
        website.text = " https://example.com "

        name.sendActions(for: .editingChanged)
        website.sendActions(for: .editingChanged)

        XCTAssertEqual(changes, 2)
        XCTAssertEqual(name.text, "  Museum  ")
        XCTAssertEqual(website.text, " https://example.com ")
    }

    func testScheduleCallbacksRemainOwnedByParent() {
        var callbacks: [String] = []
        let editor = makeEditor(
            onCheckInDate: { callbacks.append("check-in-date") },
            onCheckInTime: { callbacks.append("check-in-time") },
            onCheckOutDate: { callbacks.append("check-out-date") },
            onCheckOutTime: { callbacks.append("check-out-time") }
        )

        editor.checkInDateButton.sendActions(for: .touchUpInside)
        editor.checkInTimeButton.sendActions(for: .touchUpInside)
        editor.checkOutDateButton.sendActions(for: .touchUpInside)
        editor.checkOutTimeButton.sendActions(for: .touchUpInside)

        XCTAssertEqual(callbacks, ["check-in-date", "check-in-time", "check-out-date", "check-out-time"])
    }

    func testAutosaveGenerationSupersedesRapidEarlierMutation() {
        let gate = NativeSavedPlaceAutosaveGeneration()

        let mutationA = gate.advance()
        let mutationB = gate.advance()

        XCTAssertFalse(gate.isCurrent(mutationA))
        XCTAssertTrue(gate.isCurrent(mutationB))
        XCTAssertEqual(gate.current, 2)
    }

    private func makeEditor(
        onChange: @escaping () -> Void = {},
        onCheckInDate: @escaping () -> Void = {},
        onCheckInTime: @escaping () -> Void = {},
        onCheckOutDate: @escaping () -> Void = {},
        onCheckOutTime: @escaping () -> Void = {}
    ) -> NativeSavedPlaceEditorView {
        NativeSavedPlaceEditorView(
            category: "Museum",
            accent: .systemBlue,
            costAction: UIView(),
            noteAction: UIView(),
            attachmentAction: UIView(),
            onChangeCategory: {},
            onChange: onChange,
            onCheckInDate: onCheckInDate,
            onCheckInTime: onCheckInTime,
            onCheckOutDate: onCheckOutDate,
            onCheckOutTime: onCheckOutTime
        )
    }
}

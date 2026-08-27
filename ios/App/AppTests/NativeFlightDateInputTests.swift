import XCTest
@testable import Almidy

@MainActor
final class NativeFlightDateInputTests: XCTestCase {
    func testSheetConfigurationPreservesDatePresentationChrome() {
        let configuration = NativeFlightDateInputViewController.sheetConfiguration

        XCTAssertEqual(configuration.role, .editor)
        XCTAssertEqual(configuration.preferredCornerRadius, 34)
        XCTAssertFalse(configuration.prefersGrabberVisible)
        XCTAssertTrue(configuration.prefersScrollingExpandsWhenScrolledToEdge)
        XCTAssertNil(configuration.largestUndimmedDetentIdentifier)
    }

    func testInitialStatePreservesInlineNativeDateContract() throws {
        let controller = NativeFlightDateInputViewController(accent: .systemBlue) { _ in }
        controller.loadViewIfNeeded()
        let picker = try XCTUnwrap(
            controller.view.dateDescendant(withAccessibilityIdentifier: "flightDatePicker") as? UIDatePicker
        )

        XCTAssertEqual(picker.datePickerMode, .date)
        XCTAssertEqual(picker.preferredDatePickerStyle, .inline)
        XCTAssertEqual(Calendar.current.startOfDay(for: picker.date), Calendar.current.startOfDay(for: Date()))
    }

    func testSaveEmitsSelectedCalendarDayAfterDismissal() throws {
        let saved = expectation(description: "date saved after dismissal")
        var received: Date?
        let controller = NativeFlightDateInputViewController(accent: .systemBlue) { date in
            received = date
            saved.fulfill()
        }
        controller.loadViewIfNeeded()
        let picker = try XCTUnwrap(
            controller.view.dateDescendant(withAccessibilityIdentifier: "flightDatePicker") as? UIDatePicker
        )
        let save = try XCTUnwrap(
            controller.view.dateDescendant(withAccessibilityIdentifier: "native-flight-date-save") as? UIButton
        )
        let selected = try XCTUnwrap(Calendar.current.date(from: DateComponents(year: 2028, month: 4, day: 17)))
        picker.setDate(selected, animated: false)
        picker.sendActions(for: .valueChanged)

        save.sendActions(for: .touchUpInside)
        wait(for: [saved], timeout: 1)

        XCTAssertEqual(received, selected)
    }

    func testClearEmitsNil() throws {
        let saved = expectation(description: "date cleared")
        var callbackWasCalled = false
        var received: Date? = Date()
        let controller = NativeFlightDateInputViewController(accent: .systemBlue) { date in
            callbackWasCalled = true
            received = date
            saved.fulfill()
        }
        controller.loadViewIfNeeded()
        let clear = try XCTUnwrap(
            controller.view.dateDescendant(withAccessibilityIdentifier: "native-flight-date-clear") as? UIButton
        )

        clear.sendActions(for: .touchUpInside)
        wait(for: [saved], timeout: 1)

        XCTAssertTrue(callbackWasCalled)
        XCTAssertNil(received)
    }

    func testControlsRetainMeasuredGeometry() throws {
        let controller = NativeFlightDateInputViewController(accent: .systemBlue) { _ in }
        controller.loadViewIfNeeded()
        controller.view.frame = CGRect(x: 0, y: 0, width: 393, height: 852)
        controller.view.layoutIfNeeded()

        let cancel = try XCTUnwrap(
            controller.view.dateDescendant(withAccessibilityIdentifier: "native-flight-date-cancel") as? UIButton
        )
        let save = try XCTUnwrap(
            controller.view.dateDescendant(withAccessibilityIdentifier: "native-flight-date-save") as? UIButton
        )
        let picker = try XCTUnwrap(
            controller.view.dateDescendant(withAccessibilityIdentifier: "flightDatePicker") as? UIDatePicker
        )
        let clear = try XCTUnwrap(
            controller.view.dateDescendant(withAccessibilityIdentifier: "native-flight-date-clear") as? UIButton
        )

        XCTAssertEqual(cancel.bounds.size, CGSize(width: 82, height: 40))
        XCTAssertEqual(save.bounds.size, CGSize(width: 68, height: 40))
        XCTAssertEqual(cancel.frame.minX, 20, accuracy: 0.5)
        XCTAssertEqual(save.frame.maxX, 373, accuracy: 0.5)
        XCTAssertEqual(picker.frame.minX, 18, accuracy: 0.5)
        XCTAssertEqual(picker.frame.maxX, 375, accuracy: 0.5)
        XCTAssertEqual(picker.bounds.height, 405, accuracy: 0.5)
        XCTAssertEqual(clear.bounds.height, 48, accuracy: 0.5)
    }
}

private extension UIView {
    func dateDescendant(withAccessibilityIdentifier identifier: String) -> UIView? {
        if accessibilityIdentifier == identifier { return self }
        for subview in subviews {
            if let match = subview.dateDescendant(withAccessibilityIdentifier: identifier) { return match }
        }
        return nil
    }
}

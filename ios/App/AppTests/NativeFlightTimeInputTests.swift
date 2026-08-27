import XCTest
@testable import Almidy

@MainActor
final class NativeFlightTimeInputTests: XCTestCase {
    func testSheetConfigurationPreservesTimePresentationChrome() {
        let configuration = NativeFlightTimeInputViewController.sheetConfiguration

        XCTAssertEqual(configuration.role, .editor)
        XCTAssertEqual(configuration.preferredCornerRadius, 34)
        XCTAssertFalse(configuration.prefersGrabberVisible)
        XCTAssertTrue(configuration.prefersScrollingExpandsWhenScrolledToEdge)
        XCTAssertNil(configuration.largestUndimmedDetentIdentifier)
    }

    func testInitialStatePreservesNativeWheelAndTimeZoneContracts() throws {
        let initial = try XCTUnwrap(Calendar.current.date(from: DateComponents(year: 2028, month: 4, day: 17, hour: 14, minute: 35)))
        let controller = NativeFlightTimeInputViewController(date: initial, accent: .systemBlue) { _ in }
        controller.loadViewIfNeeded()
        let picker = try XCTUnwrap(
            controller.view.timeDescendant(withAccessibilityIdentifier: "flightTimePicker") as? UIDatePicker
        )
        let timeZone = try XCTUnwrap(
            controller.view.timeDescendant(withAccessibilityIdentifier: "native-flight-time-zone") as? UIButton
        )

        XCTAssertEqual(picker.datePickerMode, .time)
        XCTAssertEqual(picker.preferredDatePickerStyle, .wheels)
        XCTAssertEqual(picker.minuteInterval, 1)
        XCTAssertEqual(picker.date, initial)
        XCTAssertEqual(picker.timeZone, NativeTimeZonePreference.timeZone)
        XCTAssertTrue(timeZone.title(for: .normal)?.hasPrefix("Time Zone: ") == true)
    }

    func testChangingTimePreservesSelectedCalendarDayAndZerosSeconds() throws {
        let initial = try XCTUnwrap(Calendar.current.date(from: DateComponents(year: 2028, month: 4, day: 17, hour: 8, minute: 15)))
        let changed = try XCTUnwrap(Calendar.current.date(from: DateComponents(year: 2031, month: 9, day: 2, hour: 22, minute: 47, second: 31)))
        let saved = expectation(description: "time saved after dismissal")
        var received: Date?
        let controller = NativeFlightTimeInputViewController(date: initial, accent: .systemBlue) { date in
            received = date
            saved.fulfill()
        }
        controller.loadViewIfNeeded()
        let picker = try XCTUnwrap(
            controller.view.timeDescendant(withAccessibilityIdentifier: "flightTimePicker") as? UIDatePicker
        )
        let save = try XCTUnwrap(
            controller.view.timeDescendant(withAccessibilityIdentifier: "native-flight-time-save") as? UIButton
        )
        picker.setDate(changed, animated: false)
        picker.sendActions(for: .valueChanged)

        save.sendActions(for: .touchUpInside)
        wait(for: [saved], timeout: 1)

        let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: try XCTUnwrap(received))
        XCTAssertEqual(components.year, 2028)
        XCTAssertEqual(components.month, 4)
        XCTAssertEqual(components.day, 17)
        XCTAssertEqual(components.hour, 22)
        XCTAssertEqual(components.minute, 47)
        XCTAssertEqual(components.second, 0)
    }

    func testClearEmitsNil() throws {
        let saved = expectation(description: "time cleared")
        var callbackWasCalled = false
        var received: Date? = Date()
        let controller = NativeFlightTimeInputViewController(date: Date(), accent: .systemBlue) { date in
            callbackWasCalled = true
            received = date
            saved.fulfill()
        }
        controller.loadViewIfNeeded()
        let clear = try XCTUnwrap(
            controller.view.timeDescendant(withAccessibilityIdentifier: "native-flight-time-clear") as? UIButton
        )

        clear.sendActions(for: .touchUpInside)
        wait(for: [saved], timeout: 1)

        XCTAssertTrue(callbackWasCalled)
        XCTAssertNil(received)
    }

    func testControlsRetainMeasuredGeometry() throws {
        let controller = NativeFlightTimeInputViewController(date: Date(), accent: .systemBlue) { _ in }
        controller.loadViewIfNeeded()
        controller.view.frame = CGRect(x: 0, y: 0, width: 393, height: 410)
        controller.view.layoutIfNeeded()

        let cancel = try XCTUnwrap(controller.view.timeDescendant(withAccessibilityIdentifier: "native-flight-time-cancel") as? UIButton)
        let save = try XCTUnwrap(controller.view.timeDescendant(withAccessibilityIdentifier: "native-flight-time-save") as? UIButton)
        let picker = try XCTUnwrap(controller.view.timeDescendant(withAccessibilityIdentifier: "flightTimePicker") as? UIDatePicker)
        let timeZone = try XCTUnwrap(controller.view.timeDescendant(withAccessibilityIdentifier: "native-flight-time-zone") as? UIButton)
        let clear = try XCTUnwrap(controller.view.timeDescendant(withAccessibilityIdentifier: "native-flight-time-clear") as? UIButton)

        XCTAssertEqual(cancel.bounds.size, CGSize(width: 78, height: 36))
        XCTAssertEqual(save.bounds.size, CGSize(width: 64, height: 36))
        XCTAssertEqual(cancel.frame.minX, 20, accuracy: 0.5)
        XCTAssertEqual(save.frame.maxX, 373, accuracy: 0.5)
        XCTAssertEqual(picker.bounds.height, 190, accuracy: 0.5)
        XCTAssertEqual(timeZone.frame.minX, 14, accuracy: 0.5)
        XCTAssertEqual(timeZone.frame.maxX, 379, accuracy: 0.5)
        XCTAssertEqual(timeZone.bounds.height, 42, accuracy: 0.5)
        XCTAssertEqual(clear.bounds.height, 42, accuracy: 0.5)
    }
}

private extension UIView {
    func timeDescendant(withAccessibilityIdentifier identifier: String) -> UIView? {
        if accessibilityIdentifier == identifier { return self }
        for subview in subviews {
            if let match = subview.timeDescendant(withAccessibilityIdentifier: identifier) { return match }
        }
        return nil
    }
}

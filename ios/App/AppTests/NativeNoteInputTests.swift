import XCTest
@testable import Almidy

@MainActor
final class NativeNoteInputTests: XCTestCase {
    func testSheetConfigurationPreservesNotePresentationChrome() {
        let configuration = NativeNoteInputViewController.sheetConfiguration

        XCTAssertEqual(configuration.role, .editor)
        XCTAssertEqual(configuration.preferredCornerRadius, 34)
        XCTAssertFalse(configuration.prefersGrabberVisible)
        XCTAssertTrue(configuration.prefersScrollingExpandsWhenScrolledToEdge)
        XCTAssertNil(configuration.largestUndimmedDetentIdentifier)
    }

    func testEmptyNotePreservesNativeMultilineContract() throws {
        let controller = NativeNoteInputViewController(accent: .systemBlue) { _ in }
        controller.loadViewIfNeeded()

        let textView = try XCTUnwrap(
            controller.view.noteDescendant(withAccessibilityIdentifier: "native-flight-note") as? UITextView
        )

        XCTAssertEqual(textView.text, "")
        XCTAssertEqual(textView.font?.pointSize, 18)
        XCTAssertEqual(textView.keyboardType, .default)
        XCTAssertEqual(textView.returnKeyType, .default)
        XCTAssertEqual(textView.textContainerInset, NativeNoteInputViewController.textContainerInset)
        XCTAssertEqual(textView.textContainer.lineFragmentPadding, NativeNoteInputViewController.lineFragmentPadding)
        XCTAssertEqual(textView.accessibilityLabel, "Note")
        XCTAssertTrue(textView.isScrollEnabled)
    }

    func testMultilineSavePreservesNewlinesAndExistingTrimming() throws {
        let saved = expectation(description: "note saved after dismissal")
        var received: String?
        let controller = NativeNoteInputViewController(accent: .systemBlue) { note in
            received = note
            saved.fulfill()
        }
        controller.loadViewIfNeeded()
        let textView = try XCTUnwrap(
            controller.view.noteDescendant(withAccessibilityIdentifier: "native-flight-note") as? UITextView
        )
        let save = try XCTUnwrap(
            controller.view.noteDescendant(withAccessibilityIdentifier: "native-note-save") as? UIButton
        )
        textView.text = "  First line\nSecond line  "

        save.sendActions(for: .touchUpInside)
        wait(for: [saved], timeout: 1)

        XCTAssertEqual(received, "First line\nSecond line")
    }

    func testClearingNoteSavesEmptyString() throws {
        let saved = expectation(description: "empty note saved")
        var received: String?
        let controller = NativeNoteInputViewController(accent: .systemBlue) { note in
            received = note
            saved.fulfill()
        }
        controller.loadViewIfNeeded()
        let textView = try XCTUnwrap(
            controller.view.noteDescendant(withAccessibilityIdentifier: "native-flight-note") as? UITextView
        )
        let save = try XCTUnwrap(
            controller.view.noteDescendant(withAccessibilityIdentifier: "native-note-save") as? UIButton
        )
        textView.text = "  \n  "

        save.sendActions(for: .touchUpInside)
        wait(for: [saved], timeout: 1)

        XCTAssertEqual(received, "")
    }

    func testHeaderAndTextViewRetainMeasuredGeometry() throws {
        let controller = NativeNoteInputViewController(accent: .systemBlue) { _ in }
        controller.loadViewIfNeeded()
        controller.view.frame = CGRect(x: 0, y: 0, width: 393, height: 852)
        controller.view.layoutIfNeeded()

        let cancel = try XCTUnwrap(
            controller.view.noteDescendant(withAccessibilityIdentifier: "native-note-cancel") as? UIButton
        )
        let save = try XCTUnwrap(
            controller.view.noteDescendant(withAccessibilityIdentifier: "native-note-save") as? UIButton
        )
        let textView = try XCTUnwrap(
            controller.view.noteDescendant(withAccessibilityIdentifier: "native-flight-note") as? UITextView
        )

        XCTAssertEqual(cancel.bounds.size, CGSize(width: 76, height: 34))
        XCTAssertEqual(save.bounds.size, CGSize(width: 60, height: 34))
        XCTAssertEqual(cancel.frame.minX, 16, accuracy: 0.5)
        XCTAssertEqual(save.frame.maxX, 377, accuracy: 0.5)
        XCTAssertEqual(cancel.frame.minY, 14, accuracy: 0.5)
        XCTAssertEqual(textView.frame.minX, 16, accuracy: 0.5)
        XCTAssertEqual(textView.frame.maxX, 377, accuracy: 0.5)
        XCTAssertEqual(textView.frame.minY, 66, accuracy: 0.5)
        XCTAssertTrue(save.isEnabled)
    }
}

private extension UIView {
    func noteDescendant(withAccessibilityIdentifier identifier: String) -> UIView? {
        if accessibilityIdentifier == identifier { return self }
        for subview in subviews {
            if let match = subview.noteDescendant(withAccessibilityIdentifier: identifier) { return match }
        }
        return nil
    }
}

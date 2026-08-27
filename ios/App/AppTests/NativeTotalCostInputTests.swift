import XCTest
@testable import Almidy

@MainActor
final class NativeTotalCostInputTests: XCTestCase {
    func testSheetConfigurationPreservesCostPresentationChrome() {
        let configuration = NativeTotalCostInputViewController.sheetConfiguration

        XCTAssertEqual(configuration.role, .editor)
        XCTAssertEqual(configuration.preferredCornerRadius, 34)
        XCTAssertFalse(configuration.prefersGrabberVisible)
        XCTAssertTrue(configuration.prefersScrollingExpandsWhenScrolledToEdge)
        XCTAssertNil(configuration.largestUndimmedDetentIdentifier)
    }

    func testInitialCostStatePreservesInputAndCurrencyContracts() throws {
        let controller = NativeTotalCostInputViewController(accent: .systemBlue) { _, _, _ in }
        controller.loadViewIfNeeded()

        let amount = try XCTUnwrap(
            controller.view.descendant(withAccessibilityIdentifier: "native-flight-total-cost") as? UITextField
        )
        let currency = try XCTUnwrap(
            controller.view.descendant(withAccessibilityIdentifier: "native-total-cost-currency") as? UIButton
        )

        XCTAssertEqual(amount.text, "0.00")
        XCTAssertEqual(amount.keyboardType, .decimalPad)
        XCTAssertEqual(amount.font?.pointSize, 52)
        XCTAssertEqual(amount.minimumFontSize, 34)
        XCTAssertEqual(amount.accessibilityLabel, "Total cost amount")
        XCTAssertEqual(currency.title(for: .normal), "US Dollar (USD)")
        XCTAssertEqual(currency.accessibilityLabel, "Currency, US Dollar")
        XCTAssertTrue(currency.showsMenuAsPrimaryAction)
    }

    func testHeaderRetainsMeasuredTextActionGeometry() throws {
        let controller = NativeTotalCostInputViewController(accent: .systemBlue) { _, _, _ in }
        controller.loadViewIfNeeded()
        controller.view.frame = CGRect(x: 0, y: 0, width: 393, height: 852)
        controller.view.layoutIfNeeded()

        let cancel = try XCTUnwrap(
            controller.view.descendant(withAccessibilityIdentifier: "native-total-cost-cancel") as? UIButton
        )
        let save = try XCTUnwrap(
            controller.view.descendant(withAccessibilityIdentifier: "native-total-cost-save") as? UIButton
        )

        XCTAssertEqual(cancel.bounds.size, CGSize(width: 76, height: 34))
        XCTAssertEqual(save.bounds.size, CGSize(width: 60, height: 34))
        XCTAssertEqual(cancel.frame.minX, 16, accuracy: 0.5)
        XCTAssertEqual(save.frame.maxX, 377, accuracy: 0.5)
        XCTAssertEqual(cancel.frame.minY, 14, accuracy: 0.5)
        XCTAssertEqual(save.isEnabled, true)
    }
}

private extension UIView {
    func descendant(withAccessibilityIdentifier identifier: String) -> UIView? {
        if accessibilityIdentifier == identifier { return self }
        for subview in subviews {
            if let match = subview.descendant(withAccessibilityIdentifier: identifier) { return match }
        }
        return nil
    }
}

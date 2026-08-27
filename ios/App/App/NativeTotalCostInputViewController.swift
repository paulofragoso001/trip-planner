import UIKit

final class NativeTotalCostInputViewController: UIViewController, UITextFieldDelegate {
    private struct Currency {
        let name: String
        let code: String
        let symbol: String
    }

    static var sheetConfiguration: AlmidySheetConfiguration {
        .editor.overriding(
            grabberVisible: false,
            scrollingExpandsWhenScrolledToEdge: true
        )
    }

    private let accent: UIColor
    private let onSave: (Decimal, String, String) -> Void
    private let amountField = UITextField()
    private let currencyButton = UIButton(type: .system)
    private weak var currencySymbolLabel: UILabel?
    private var selectedCurrency = Currency(name: "US Dollar", code: "USD", symbol: "$")
    private let commonCurrencies = [
        Currency(name: "Chinese Yuan", code: "CNY", symbol: "CN¥"),
        Currency(name: "Swiss Franc", code: "CHF", symbol: ""),
        Currency(name: "Canadian Dollar", code: "CAD", symbol: "CA$"),
        Currency(name: "Australian Dollar", code: "AUD", symbol: "A$"),
        Currency(name: "British Pound", code: "GBP", symbol: "£"),
        Currency(name: "Japanese Yen", code: "JPY", symbol: "¥"),
        Currency(name: "Euro", code: "EUR", symbol: "€"),
        Currency(name: "US Dollar", code: "USD", symbol: "$")
    ]
    private let additionalCurrencies = [
        Currency(name: "Saudi Riyal", code: "SAR", symbol: ""),
        Currency(name: "Turkish Lira", code: "TRY", symbol: "₺"),
        Currency(name: "South African Rand", code: "ZAR", symbol: "R"),
        Currency(name: "Russian Ruble", code: "RUB", symbol: "₽"),
        Currency(name: "Brazilian Real", code: "BRL", symbol: "R$"),
        Currency(name: "Indian Rupee", code: "INR", symbol: "₹"),
        Currency(name: "South Korean Won", code: "KRW", symbol: "₩"),
        Currency(name: "Mexican Peso", code: "MXN", symbol: "MX$"),
        Currency(name: "Singapore Dollar", code: "SGD", symbol: "S$"),
        Currency(name: "New Zealand Dollar", code: "NZD", symbol: "NZ$")
    ]

    init(accent: UIColor, onSave: @escaping (Decimal, String, String) -> Void) {
        self.accent = accent
        self.onSave = onSave
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemGroupedBackground

        let cancel = headerButton(title: "Cancel", backgroundColor: .systemBackground, titleColor: .label)
        cancel.accessibilityIdentifier = "native-total-cost-cancel"
        cancel.addTarget(self, action: #selector(close), for: .touchUpInside)
        let save = headerButton(
            title: "Save",
            backgroundColor: AlmidyDesignTokens.Color.goldDark,
            titleColor: .white
        )
        save.accessibilityIdentifier = "native-total-cost-save"
        save.addTarget(self, action: #selector(saveAmount), for: .touchUpInside)
        let header = AlmidySheetHeader(
            title: "Total Cost",
            leadingControl: cancel,
            trailingControl: save,
            metrics: .init(height: 62, horizontalInset: 16, controlSize: 76),
            titleFont: AlmidyDesignTokens.Font.button(18)
        )
        header.backgroundColor = .systemGroupedBackground
        header.titleLabel.textColor = .label

        let currencySymbol = UILabel()
        currencySymbol.text = "$"
        currencySymbol.font = AlmidyDesignTokens.Font.body(52)
        currencySymbol.setContentHuggingPriority(.required, for: .horizontal)
        currencySymbolLabel = currencySymbol
        amountField.text = "0.00"
        amountField.font = AlmidyDesignTokens.Font.body(52)
        amountField.textColor = .label
        amountField.keyboardType = .decimalPad
        amountField.textAlignment = .left
        amountField.adjustsFontSizeToFitWidth = true
        amountField.minimumFontSize = 34
        amountField.delegate = self
        amountField.accessibilityLabel = "Total cost amount"
        amountField.accessibilityIdentifier = "native-flight-total-cost"
        amountField.widthAnchor.constraint(equalToConstant: 125).isActive = true
        let amountRow = UIStackView(arrangedSubviews: [currencySymbol, amountField])
        amountRow.axis = .horizontal
        amountRow.alignment = .firstBaseline
        amountRow.spacing = 2

        currencyButton.setTitleColor(.label, for: .normal)
        currencyButton.titleLabel?.font = AlmidyDesignTokens.Font.button(18)
        AlmidySurfaceStyle(
            backgroundColor: .systemBackground,
            cornerRadius: 20,
            border: nil,
            elevation: nil
        ).apply(to: currencyButton)
        currencyButton.contentEdgeInsets = UIEdgeInsets(top: 8, left: 16, bottom: 8, right: 16)
        currencyButton.accessibilityIdentifier = "native-total-cost-currency"
        currencyButton.accessibilityHint = "Opens the currency menu"
        currencyButton.showsMenuAsPrimaryAction = true
        updateCurrencySelection()

        [header, amountRow, currencyButton].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview($0)
        }
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            header.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            amountRow.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            amountRow.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -160),
            currencyButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            currencyButton.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor, constant: -16),
            currencyButton.heightAnchor.constraint(equalToConstant: 40)
        ])
        amountField.becomeFirstResponder()
        DispatchQueue.main.async { [weak self] in self?.amountField.selectAll(nil) }
    }

    private func headerButton(title: String, backgroundColor: UIColor, titleColor: UIColor) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.setTitleColor(titleColor, for: .normal)
        button.titleLabel?.font = AlmidyDesignTokens.Font.button(16)
        button.backgroundColor = backgroundColor
        button.layer.cornerRadius = 17
        button.contentEdgeInsets = .zero
        button.translatesAutoresizingMaskIntoConstraints = false
        button.widthAnchor.constraint(equalToConstant: title == "Cancel" ? 76 : 60).isActive = true
        button.heightAnchor.constraint(equalToConstant: 34).isActive = true
        return button
    }

    @objc private func close() { dismiss(animated: true) }

    @objc private func saveAmount() {
        let raw = amountField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard let amount = Decimal(string: raw) else {
            let animation = CAKeyframeAnimation(keyPath: "transform.translation.x")
            animation.values = [-8, 8, -6, 6, 0]
            animation.duration = 0.28
            amountField.layer.add(animation, forKey: "invalid-amount")
            UIAccessibility.post(notification: .announcement, argument: "Enter a valid total cost")
            return
        }
        let formatter = NumberFormatter()
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        formatter.numberStyle = .decimal
        let formatted = formatter.string(from: NSDecimalNumber(string: raw)) ?? raw
        let displayAmount = "\(selectedCurrency.symbol)\(formatted)"
        dismiss(animated: true) { [onSave, selectedCurrency] in
            onSave(amount, selectedCurrency.code, displayAmount)
        }
    }

    private func updateCurrencySelection() {
        currencyButton.setTitle("\(selectedCurrency.name) (\(selectedCurrency.code))", for: .normal)
        currencySymbolLabel?.text = selectedCurrency.symbol.isEmpty ? selectedCurrency.code : selectedCurrency.symbol
        currencyButton.accessibilityLabel = "Currency, \(selectedCurrency.name)"
        currencyButton.menu = makeCurrencyMenu()
    }

    private func makeCurrencyMenu() -> UIMenu {
        let commonActions = commonCurrencies.map(makeCurrencyAction)
        let allActions = additionalCurrencies
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            .map(makeCurrencyAction)
        let allCurrencies = UIMenu(title: "All Currencies", children: allActions)
        return UIMenu(children: [allCurrencies] + commonActions)
    }

    private func makeCurrencyAction(_ currency: Currency) -> UIAction {
        let subtitle = currency.symbol.isEmpty ? currency.code : "\(currency.code) (\(currency.symbol))"
        return UIAction(
            title: currency.name,
            subtitle: subtitle,
            state: currency.code == selectedCurrency.code ? .on : .off
        ) { [weak self] _ in
            self?.selectedCurrency = currency
            self?.updateCurrencySelection()
        }
    }
}

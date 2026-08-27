import UIKit

final class NativeGlobeTripCardView: UIButton {
    static let cornerRadius: CGFloat = 36
    static let horizontalTextInset: CGFloat = 24
    static let bottomTextInset: CGFloat = 42
    static let gradientLocations: [NSNumber] = [0.40, 1.0]

    let overlayGradient = CAGradientLayer()
    let mediaView = UIImageView()
    private let tripTitleLabel = UILabel()
    private let datesLabel = UILabel()
    private let statusLabel = UILabel()

    init(
        identifier: String,
        title: String,
        dates: String,
        status: String,
        height: CGFloat
    ) {
        super.init(frame: .zero)

        layer.cornerRadius = Self.cornerRadius
        clipsToBounds = true
        backgroundColor = AlmidyDesignTokens.Color.card
        accessibilityIdentifier = identifier
        accessibilityLabel = [title, dates, status].filter { !$0.isEmpty }.joined(separator: ", ")
        accessibilityHint = "Double tap to open. Touch and hold for trip actions."
        accessibilityTraits = .button

        mediaView.contentMode = .scaleAspectFill
        mediaView.isUserInteractionEnabled = false
        mediaView.isAccessibilityElement = false
        mediaView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(mediaView)

        overlayGradient.colors = [
            AlmidyDesignTokens.Color.tripCardGradientStart.cgColor,
            AlmidyDesignTokens.Color.tripCardGradientEnd.cgColor
        ]
        overlayGradient.locations = Self.gradientLocations
        layer.addSublayer(overlayGradient)

        tripTitleLabel.text = title
        tripTitleLabel.textColor = AlmidyDesignTokens.Color.tripCardTextPrimary
        tripTitleLabel.font = AlmidyDesignTokens.Font.title(NativeTripCardLayout.titleFontSize)
        tripTitleLabel.adjustsFontSizeToFitWidth = true
        tripTitleLabel.minimumScaleFactor = 0.72

        datesLabel.text = dates
        datesLabel.textColor = AlmidyDesignTokens.Color.tripCardTextSecondary
        datesLabel.font = AlmidyDesignTokens.Font.body(NativeTripCardLayout.dateFontSize)

        statusLabel.text = status
        statusLabel.textColor = AlmidyDesignTokens.Color.tripCardTextTertiary
        statusLabel.font = AlmidyDesignTokens.Font.body(NativeTripCardLayout.statusFontSize)

        let textStack = UIStackView(arrangedSubviews: [tripTitleLabel, datesLabel, statusLabel])
        textStack.axis = .vertical
        textStack.alignment = .leading
        textStack.spacing = 3
        textStack.isUserInteractionEnabled = false
        textStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(textStack)

        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: height),
            mediaView.topAnchor.constraint(equalTo: topAnchor),
            mediaView.leadingAnchor.constraint(equalTo: leadingAnchor),
            mediaView.trailingAnchor.constraint(equalTo: trailingAnchor),
            mediaView.bottomAnchor.constraint(equalTo: bottomAnchor),
            textStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: Self.horizontalTextInset),
            textStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -Self.horizontalTextInset),
            textStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -Self.bottomTextInset)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        overlayGradient.frame = bounds
    }

    override func accessibilityActivate() -> Bool {
        guard isEnabled else { return false }
        sendActions(for: .touchUpInside)
        return true
    }
}

final class NativeGlobeReservationAutomationView: UIView {
    static let contentInset: CGFloat = 18
    static let contentSpacing: CGFloat = 8
    static let dismissSize: CGFloat = 36
    static let actionMinimumHeight: CGFloat = 46

    private let onOpen: () -> Void
    private let onDismiss: () -> Void

    init(onOpen: @escaping () -> Void, onDismiss: @escaping () -> Void) {
        self.onOpen = onOpen
        self.onDismiss = onDismiss
        super.init(frame: .zero)

        backgroundColor = AlmidyDesignTokens.Color.card
        layer.cornerRadius = AlmidyDesignTokens.Radius.card
        layer.borderWidth = 1
        layer.borderColor = UIColor.systemGray4.cgColor
        accessibilityElements = []

        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = Self.contentSpacing
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        let dismiss = UIButton(type: .system)
        dismiss.setImage(UIImage(systemName: "xmark"), for: .normal)
        dismiss.accessibilityLabel = "Dismiss reservation suggestion"
        dismiss.tintColor = .systemGray
        dismiss.addAction(UIAction { [weak self] _ in self?.onDismiss() }, for: .touchUpInside)
        dismiss.translatesAutoresizingMaskIntoConstraints = false
        addSubview(dismiss)

        let eyebrow = UILabel()
        eyebrow.text = "IMPORT"
        eyebrow.textColor = AlmidyDesignTokens.Color.goldSoft
        eyebrow.font = AlmidyDesignTokens.Font.semibold(13)

        let title = UILabel()
        title.text = "Manual Reservation Importer"
        title.font = AlmidyDesignTokens.Font.title(22)
        title.textColor = AlmidyDesignTokens.Color.textPrimary
        title.numberOfLines = 0

        let body = UILabel()
        body.text = "Add reservation details from the importer while email forwarding remains unavailable."
        body.font = AlmidyDesignTokens.Font.body(16)
        body.textColor = .systemGray
        body.numberOfLines = 0

        let action = UIButton(type: .system)
        action.setTitle("Open Reservation Importer", for: .normal)
        action.setTitleColor(AlmidyDesignTokens.Color.settingsText, for: .normal)
        action.titleLabel?.font = AlmidyDesignTokens.Font.button(17)
        action.backgroundColor = AlmidyDesignTokens.Color.gold
        action.layer.cornerRadius = AlmidyDesignTokens.Radius.capsule
        var configuration = UIButton.Configuration.plain()
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 10, leading: 14, bottom: 10, trailing: 14)
        configuration.baseForegroundColor = AlmidyDesignTokens.Color.settingsText
        action.configuration = configuration
        action.addAction(UIAction { [weak self] _ in self?.onOpen() }, for: .touchUpInside)
        action.heightAnchor.constraint(greaterThanOrEqualToConstant: Self.actionMinimumHeight).isActive = true

        stack.addArrangedSubview(eyebrow)
        stack.addArrangedSubview(title)
        stack.addArrangedSubview(body)
        stack.addArrangedSubview(action)
        accessibilityElements = [eyebrow, title, body, action, dismiss]

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor, constant: Self.contentInset),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: Self.contentInset),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -Self.contentInset),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -Self.contentInset),
            dismiss.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            dismiss.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            dismiss.widthAnchor.constraint(equalToConstant: Self.dismissSize),
            dismiss.heightAnchor.constraint(equalToConstant: Self.dismissSize)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

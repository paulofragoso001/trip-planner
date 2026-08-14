import UIKit

enum NativeTripOverviewCategoryCatalog {
    struct Presentation {
        let symbol: String
        let color: UIColor
        let background: UIColor
    }

    static func presentation(key: String, suggestedSymbol: String? = nil) -> Presentation {
        let normalized = key.lowercased()
        let definition: (String, UIColor)
        switch normalized {
        case let value where value.contains("flight") || value.contains("air"): definition = ("airplane", AlmidyDesignTokens.Color.info)
        case let value where value.contains("stay") || value.contains("lodg") || value.contains("hotel"): definition = ("bed.double.fill", AlmidyDesignTokens.Color.generatedTripGradientStart)
        case let value where value.contains("restaurant") || value.contains("food") || value.contains("dining"): definition = ("fork.knife", AlmidyDesignTokens.Color.goldDeep)
        case let value where value.contains("bar") || value.contains("drink"): definition = ("wineglass.fill", AlmidyDesignTokens.Color.danger)
        case let value where value.contains("route") || value.contains("transport"): definition = ("point.topleft.down.to.point.bottomright.curvepath", AlmidyDesignTokens.Color.info)
        case let value where value.contains("shop"): definition = ("bag.fill", AlmidyDesignTokens.Color.goldMuted)
        case let value where value.contains("place") || value.contains("activity"): definition = ("mappin", AlmidyDesignTokens.Color.brandGoldDeep)
        default: definition = ("ellipsis", AlmidyDesignTokens.Color.textTertiary)
        }
        let symbol = suggestedSymbol.flatMap { UIImage(systemName: $0) == nil ? nil : $0 } ?? definition.0
        return Presentation(symbol: symbol, color: definition.1, background: definition.1.withAlphaComponent(0.12))
    }
}

class NativeTripOverviewCard: UIControl, UIGestureRecognizerDelegate {
    let contentStack = UIStackView()
    let stateLabel = UILabel()
    private var contentTopConstraint: NSLayoutConstraint!
    private var contentBottomConstraint: NSLayoutConstraint!
    var onOpen: (() -> Void)?
    var onRetry: (() -> Void)?
    private(set) var verticalContentInset = AlmidyDesignTokens.TripOverview.cardVerticalInset
    var hasRetryAction: Bool { contentStack.arrangedSubviews.contains { ($0 as? UIButton)?.title(for: .normal) == "Retry this section" } }

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = AlmidyDesignTokens.Color.surface
        layer.cornerRadius = AlmidyDesignTokens.Radius.card
        layer.cornerCurve = .continuous
        accessibilityTraits.insert(.button)
        isAccessibilityElement = false
        shouldGroupAccessibilityChildren = true
        accessibilityContainerType = .semanticGroup
        contentStack.axis = .vertical
        contentStack.spacing = AlmidyDesignTokens.TripOverview.cardContentGap
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        stateLabel.font = UIFontMetrics(forTextStyle: .caption1).scaledFont(for: AlmidyDesignTokens.Font.body(13))
        stateLabel.adjustsFontForContentSizeCategory = true
        stateLabel.textColor = AlmidyDesignTokens.Color.overviewMetadata
        stateLabel.numberOfLines = 0
        contentStack.addArrangedSubview(stateLabel)
        addSubview(contentStack)
        addTarget(self, action: #selector(open), for: .touchUpInside)
        let openGesture = UITapGestureRecognizer(target: self, action: #selector(open))
        openGesture.delegate = self
        addGestureRecognizer(openGesture)
        contentTopConstraint = contentStack.topAnchor.constraint(equalTo: topAnchor, constant: AlmidyDesignTokens.TripOverview.cardVerticalInset)
        contentBottomConstraint = contentStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -AlmidyDesignTokens.TripOverview.cardVerticalInset)
        NSLayoutConstraint.activate([
            contentStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: AlmidyDesignTokens.TripOverview.cardHorizontalInset),
            contentStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -AlmidyDesignTokens.TripOverview.cardHorizontalInset),
            contentTopConstraint,
            contentBottomConstraint,
            heightAnchor.constraint(greaterThanOrEqualToConstant: 44)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    @objc private func open() { onOpen?() }

    func setVerticalContentInset(_ inset: CGFloat) {
        verticalContentInset = inset
        contentTopConstraint.constant = inset
        contentBottomConstraint.constant = -inset
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        var touchedView: UIView? = touch.view
        while let view = touchedView, view !== self {
            if view is UIControl { return false }
            touchedView = view.superview
        }
        return true
    }

    func apply(_ status: NativeTripOverviewSectionStatus) {
        stateLabel.text = status.error ?? (status.refreshStatus == .refreshing ? "Refreshing…" : nil)
        stateLabel.isHidden = stateLabel.text == nil
        isEnabled = status.state != .failed
        if status.state == .failed {
            let retry = UIButton(type: .system); retry.setTitle("Retry this section", for: .normal)
            retry.tintColor = AlmidyDesignTokens.Color.goldDark
            retry.accessibilityHint = "Refreshes the unavailable section"
            retry.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
            retry.addAction(UIAction { [weak self] _ in self?.onRetry?() }, for: .touchUpInside)
            contentStack.addArrangedSubview(retry)
        }
    }

    func reset(after header: UIView) {
        while contentStack.arrangedSubviews.count > 2 {
            contentStack.arrangedSubviews.last?.removeFromSuperview()
        }
    }
}

final class NativeTripOverviewItineraryCard: NativeTripOverviewCard {
    var onNewActivity: (() -> Void)?
    private let header = NativeTripOverviewCardHeader(
        icon: "calendar",
        title: "Itinerary",
        accentColor: AlmidyDesignTokens.Color.goldMuted,
        titleFont: AlmidyDesignTokens.Font.regular(17)
    )
    private(set) var renderedCategoryKeys: [String] = []
    private(set) var overflowCount = 0
    private(set) var totalText: String?
    private(set) var renderedDateRange: String?
    private(set) var isUsingCompactEmptyInsets = false
    var hasAddFirstActivityAction: Bool {
        contentStack.arrangedSubviews.contains { ($0 as? UIButton)?.title(for: .normal) == "Add First Activity" }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        accessibilityIdentifier = "overview-itinerary-card"
        contentStack.spacing = AlmidyDesignTokens.TripOverview.cardContentGap
        contentStack.insertArrangedSubview(header, at: 0)
        accessibilityLabel = "Itinerary"
        accessibilityHint = "Opens the complete itinerary"
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func render(_ itinerary: NativeTripOverview.Itinerary, newActivityAvailable: Bool) {
        reset(after: header); apply(itinerary.status)
        renderedDateRange = itinerary.dateRange
            .replacingOccurrences(of: " – ", with: " → ")
            .replacingOccurrences(of: " - ", with: " → ")
        header.trailingText = renderedDateRange
        renderedCategoryKeys = []
        overflowCount = 0
        totalText = "\(itinerary.exactCount) \(itinerary.exactCount == 1 ? "activity" : "activities")"
        isUsingCompactEmptyInsets = itinerary.activityMode == .empty
        setVerticalContentInset(
            isUsingCompactEmptyInsets
                ? AlmidyDesignTokens.TripOverview.compactCardVerticalInset
                : AlmidyDesignTokens.TripOverview.cardVerticalInset
        )
        contentStack.addArrangedSubview(NativeTripOverviewDivider())
        if itinerary.status.state == .failed {
            accessibilityValue = "Temporarily unavailable"
            return
        }
        if itinerary.activityMode == .empty {
            let emptyRow = NativeTripOverviewEmptyTimelineRow()
            contentStack.addArrangedSubview(emptyRow)
            if newActivityAvailable {
                let add = UIButton(type: .system)
                add.setTitle("Add First Activity", for: .normal)
                add.setTitleColor(AlmidyDesignTokens.Color.goldDeep, for: .normal)
                add.titleLabel?.font = UIFontMetrics(forTextStyle: .callout).scaledFont(for: AlmidyDesignTokens.Font.medium(14))
                add.titleLabel?.adjustsFontForContentSizeCategory = true
                add.contentHorizontalAlignment = .leading
                add.accessibilityHint = "Opens the new activity form"
                add.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
                add.addAction(UIAction { [weak self] _ in self?.onNewActivity?() }, for: .touchUpInside)
                contentStack.addArrangedSubview(NativeTripOverviewDivider())
                contentStack.addArrangedSubview(add)
            }
            accessibilityValue = "Empty"
            return
        }

        let categoryRow = UIStackView(); categoryRow.axis = .horizontal; categoryRow.spacing = -5; categoryRow.alignment = .center
        let visible = Array(itinerary.categories.filter { $0.count > 0 }.prefix(5))
        renderedCategoryKeys = visible.map(\.key)
        visible.forEach { category in
            categoryRow.addArrangedSubview(NativeTripOverviewCategoryBubble(key: category.key, symbol: category.icon, accessibilityText: "\(category.label), \(category.count)"))
        }
        overflowCount = max(0, itinerary.categories.filter { $0.count > 0 }.count - visible.count)
        if overflowCount > 0 { categoryRow.addArrangedSubview(NativeTripOverviewOverflowBubble(count: overflowCount)) }
        categoryRow.addArrangedSubview(UIView())
        let total = UILabel.almidyBody(totalText ?? "")
        total.textAlignment = .right
        categoryRow.addArrangedSubview(total)
        contentStack.addArrangedSubview(categoryRow)
        accessibilityValue = totalText
    }
}

final class NativeTripOverviewDocumentsCard: NativeTripOverviewCard {
    private let header = NativeTripOverviewCardHeader(icon: "folder.fill", title: NativeTripOverviewReleaseScope.importedItemsTitle)
    private(set) var renderedDocumentIDs: [String] = []

    override init(frame: CGRect) {
        super.init(frame: frame); accessibilityIdentifier = "overview-documents-card"; contentStack.insertArrangedSubview(header, at: 0)
        accessibilityLabel = NativeTripOverviewReleaseScope.importedItemsTitle
        accessibilityHint = "Opens imported trip documents"
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func render(_ documents: NativeTripOverview.Documents) {
        reset(after: header); apply(documents.status)
        renderedDocumentIDs = documents.items.map(\.id)
        contentStack.addArrangedSubview(NativeTripOverviewDivider())
        guard !documents.items.isEmpty else {
            contentStack.addArrangedSubview(NativeTripOverviewIllustrationRow(items: [
                ("envelope.fill", AlmidyDesignTokens.Color.goldMuted),
                ("photo.on.rectangle.angled", AlmidyDesignTokens.Color.info),
                ("doc.text.fill", AlmidyDesignTokens.Color.textSecondary),
                ("link", AlmidyDesignTokens.Color.goldMuted)
            ], accessibilityLabel: "Reservation email, photo, note, and link types"))
            let explanation = UILabel.almidyBody("Reservation emails, photos, notes, and links imported for this trip will appear here.")
            explanation.textColor = AlmidyDesignTokens.Color.textSecondary
            explanation.textAlignment = .center
            contentStack.addArrangedSubview(NativeTripOverviewCenteredContent(explanation, maximumWidth: 290))
            accessibilityValue = "No imported items"
            return
        }
        documents.items.forEach { document in
            contentStack.addArrangedSubview(NativeTripOverviewDocumentRow(document: document))
        }
        accessibilityValue = "\(documents.items.count) imported \(documents.items.count == 1 ? "item" : "items")"
    }
}

final class NativeTripOverviewExpensesCard: NativeTripOverviewCard {
    private let header = NativeTripOverviewCardHeader(icon: "creditcard.fill", title: "Expenses")
    private let preferenceKey = "almidy.trip-overview.expenses-hidden"
    private var expenses: NativeTripOverview.Expenses?
    private(set) var renderedCurrencies: [String] = []
    private(set) var amountsHidden: Bool

    override init(frame: CGRect) {
        amountsHidden = UserDefaults.standard.bool(forKey: preferenceKey)
        super.init(frame: frame); accessibilityIdentifier = "overview-expenses-card"; contentStack.insertArrangedSubview(header, at: 0)
        header.setAction(symbol: amountsHidden ? "eye.slash" : "eye", label: amountsHidden ? "Reveal expense amounts" : "Hide expense amounts") { [weak self] in self?.toggleAmounts() }
        accessibilityLabel = "Expenses"
        accessibilityHint = "Opens the detailed trip budget"
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func render(_ expenses: NativeTripOverview.Expenses) {
        self.expenses = expenses; reset(after: header); apply(expenses.status)
        renderedCurrencies = expenses.currencies.map { $0.total.currency }
        contentStack.addArrangedSubview(NativeTripOverviewDivider())
        guard !expenses.currencies.isEmpty else {
            contentStack.addArrangedSubview(NativeTripOverviewIllustrationRow(items: [
                ("creditcard.fill", AlmidyDesignTokens.Color.goldMuted),
                ("bed.double.fill", AlmidyDesignTokens.Color.generatedTripGradientStart),
                ("fork.knife", AlmidyDesignTokens.Color.goldMuted),
                ("dollarsign.circle.fill", AlmidyDesignTokens.Color.textSecondary)
            ], accessibilityLabel: "Payment, stay, dining, and other expense categories"))
            let explanation = UILabel.almidyBody("Costs added from activities or the trip budget will appear here, grouped by category and currency.")
            explanation.textColor = AlmidyDesignTokens.Color.textSecondary
            explanation.textAlignment = .center
            contentStack.addArrangedSubview(NativeTripOverviewCenteredContent(explanation, maximumWidth: 300))
            contentStack.addArrangedSubview(NativeTripOverviewDivider())
            let budgetAffordance = UILabel.almidyAction("View Budget")
            contentStack.addArrangedSubview(budgetAffordance)
            accessibilityValue = "No expenses recorded"
            return
        }
        if expenses.currencies.count > 1 {
            let note = UILabel.almidyCaption("Amounts are separated by currency. No conversion applied.")
            contentStack.addArrangedSubview(note)
        }
        expenses.currencies.forEach { currency in
            contentStack.addArrangedSubview(NativeTripOverviewCurrencyGroup(currency: currency, hidden: amountsHidden))
        }
        accessibilityValue = amountsHidden ? "Amounts hidden" : "\(expenses.currencies.count) currency totals"
    }

    private func toggleAmounts() {
        amountsHidden.toggle(); UserDefaults.standard.set(amountsHidden, forKey: preferenceKey)
        header.setAction(symbol: amountsHidden ? "eye.slash" : "eye", label: amountsHidden ? "Reveal expense amounts" : "Hide expense amounts") { [weak self] in self?.toggleAmounts() }
        if let expenses { render(expenses) }
    }
}

final class NativeTripOverviewRecentCard: NativeTripOverviewCard {
    private let header = NativeTripOverviewCardHeader(icon: "arrow.down.square.fill", title: "Latest Added")
    private(set) var renderedItemIDs: [String] = []

    override init(frame: CGRect) {
        super.init(frame: frame)
        accessibilityIdentifier = "overview-latest-added-card"
        accessibilityLabel = "Latest Added"
        accessibilityTraits.remove(.button)
        shouldGroupAccessibilityChildren = true; accessibilityContainerType = .semanticGroup
        contentStack.insertArrangedSubview(header, at: 0)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func render(_ recent: NativeTripOverview.RecentItems) {
        reset(after: header)
        contentStack.addArrangedSubview(NativeTripOverviewDivider())
        let sorted = recent.items.sorted {
            let lhs = ISO8601DateFormatter.almidy.date(from: $0.createdAt) ?? .distantPast
            let rhs = ISO8601DateFormatter.almidy.date(from: $1.createdAt) ?? .distantPast
            // `createdAt` is populated from the schema's `inserted_at` value.
            // Keep ID ascending as the deterministic tie-breaker.
            return lhs == rhs ? $0.id < $1.id : lhs > rhs
        }
        let visible = Array(sorted.prefix(5)); renderedItemIDs = visible.map(\.id)
        if let error = recent.status.error { contentStack.addArrangedSubview(UILabel.almidyCaption(error)) }
        if recent.status.state == .failed {
            let retry = UIButton(type: .system); retry.setTitle("Retry this section", for: .normal)
            retry.tintColor = AlmidyDesignTokens.Color.goldDark
            retry.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
            retry.addAction(UIAction { [weak self] _ in self?.onRetry?() }, for: .touchUpInside)
            contentStack.addArrangedSubview(retry)
        }
        if visible.isEmpty && recent.status.state != .failed {
            let empty = UILabel.almidyBody("No recently added activities.")
            empty.textColor = AlmidyDesignTokens.Color.overviewMetadata
            empty.textAlignment = .center
            contentStack.addArrangedSubview(empty)
        }
        visible.forEach { contentStack.addArrangedSubview(NativeTripOverviewRecentRow(item: $0)) }
        isHidden = false
    }
}

private final class NativeTripOverviewCardHeader: UIView {
    private let iconSurface = UIView()
    private let iconView = UIImageView()
    private let titleLabel = UILabel()
    private let trailingLabel = UILabel()
    private let actionButton = UIButton(type: .system)
    private var action: (() -> Void)?
    var trailingText: String? { get { trailingLabel.text } set { trailingLabel.text = newValue; trailingLabel.isHidden = newValue == nil } }

    init(
        icon: String,
        title: String,
        accentColor: UIColor = AlmidyDesignTokens.Color.goldMuted,
        titleFont: UIFont = AlmidyDesignTokens.Font.medium(17)
    ) {
        super.init(frame: .zero)
        iconSurface.backgroundColor = AlmidyDesignTokens.Color.goldMutedSurface
        iconSurface.layer.cornerRadius = AlmidyDesignTokens.TripOverview.headerIconSurface / 2
        iconSurface.layer.cornerCurve = .continuous
        iconSurface.translatesAutoresizingMaskIntoConstraints = false
        iconView.image = UIImage(systemName: icon)
        iconView.tintColor = accentColor
        iconView.contentMode = .scaleAspectFit
        titleLabel.text = title
        titleLabel.font = UIFontMetrics(forTextStyle: .headline).scaledFont(
            for: titleFont
        )
        titleLabel.adjustsFontForContentSizeCategory = true
        titleLabel.accessibilityTraits.insert(.header)
        titleLabel.numberOfLines = 2; titleLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        trailingLabel.font = UIFontMetrics(forTextStyle: .caption1).scaledFont(for: AlmidyDesignTokens.Font.body(13))
        trailingLabel.textColor = AlmidyDesignTokens.Color.overviewMetadata
        trailingLabel.adjustsFontForContentSizeCategory = true
        trailingLabel.numberOfLines = 2; trailingLabel.textAlignment = .right
        actionButton.isHidden = true
        actionButton.tintColor = AlmidyDesignTokens.Color.goldDark
        actionButton.addTarget(self, action: #selector(runAction), for: .touchUpInside)
        addSubview(iconSurface)
        iconSurface.addSubview(iconView)
        [titleLabel, trailingLabel, actionButton].forEach { $0.translatesAutoresizingMaskIntoConstraints = false; addSubview($0) }
        iconView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.headerHeight),
            iconSurface.leadingAnchor.constraint(equalTo: leadingAnchor), iconSurface.centerYAnchor.constraint(equalTo: centerYAnchor),
            iconSurface.widthAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.headerIconSurface), iconSurface.heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.headerIconSurface),
            iconView.centerXAnchor.constraint(equalTo: iconSurface.centerXAnchor), iconView.centerYAnchor.constraint(equalTo: iconSurface.centerYAnchor),
            iconView.widthAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.headerIcon), iconView.heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.headerIcon),
            titleLabel.leadingAnchor.constraint(equalTo: iconSurface.trailingAnchor, constant: 10), titleLabel.centerYAnchor.constraint(equalTo: centerYAnchor),
            trailingLabel.leadingAnchor.constraint(greaterThanOrEqualTo: titleLabel.trailingAnchor, constant: 8), trailingLabel.centerYAnchor.constraint(equalTo: centerYAnchor),
            actionButton.leadingAnchor.constraint(greaterThanOrEqualTo: trailingLabel.trailingAnchor, constant: 4), actionButton.trailingAnchor.constraint(equalTo: trailingAnchor),
            actionButton.centerYAnchor.constraint(equalTo: centerYAnchor), actionButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 44),
            actionButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44), trailingLabel.trailingAnchor.constraint(lessThanOrEqualTo: actionButton.leadingAnchor)
        ])
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    func setAction(symbol: String, label: String, action: @escaping () -> Void) {
        self.action = action; actionButton.setImage(UIImage(systemName: symbol), for: .normal)
        actionButton.tintColor = AlmidyDesignTokens.Color.goldDark
        actionButton.accessibilityLabel = label; actionButton.isHidden = false
    }
    @objc private func runAction() { action?() }
}

private final class NativeTripOverviewDivider: UIView {
    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = AlmidyDesignTokens.Color.line
        directionalLayoutMargins = NSDirectionalEdgeInsets(
            top: 0,
            leading: AlmidyDesignTokens.TripOverview.separatorInset,
            bottom: 0,
            trailing: AlmidyDesignTokens.TripOverview.separatorInset
        )
        heightAnchor.constraint(equalToConstant: 1 / UIScreen.main.scale).isActive = true
        isAccessibilityElement = false
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

private final class NativeTripOverviewEmptyTimelineRow: UIView {
    override init(frame: CGRect) {
        super.init(frame: frame)
        let iconSurface = UIView()
        iconSurface.backgroundColor = AlmidyDesignTokens.Color.goldMutedSurface
        iconSurface.layer.cornerRadius = 18
        iconSurface.translatesAutoresizingMaskIntoConstraints = false
        let icon = UIImageView(image: UIImage(systemName: "plus"))
        icon.tintColor = AlmidyDesignTokens.Color.goldMuted
        icon.translatesAutoresizingMaskIntoConstraints = false
        let label = UILabel.almidyBody("Start organizing your itinerary")
        label.textColor = AlmidyDesignTokens.Color.overviewMetadata
        let row = UIStackView(arrangedSubviews: [iconSurface, label])
        row.axis = .horizontal; row.spacing = 12; row.alignment = .center
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row); iconSurface.addSubview(icon)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(greaterThanOrEqualToConstant: 48),
            iconSurface.widthAnchor.constraint(equalToConstant: 36), iconSurface.heightAnchor.constraint(equalToConstant: 36),
            icon.centerXAnchor.constraint(equalTo: iconSurface.centerXAnchor), icon.centerYAnchor.constraint(equalTo: iconSurface.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 18), icon.heightAnchor.constraint(equalToConstant: 18),
            row.leadingAnchor.constraint(equalTo: leadingAnchor), row.trailingAnchor.constraint(equalTo: trailingAnchor),
            row.topAnchor.constraint(equalTo: topAnchor), row.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        isAccessibilityElement = true
        accessibilityLabel = "Start organizing your itinerary"
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

private final class NativeTripOverviewIllustrationRow: UIView {
    init(items: [(symbol: String, color: UIColor)], accessibilityLabel: String) {
        super.init(frame: .zero)
        let stack = UIStackView()
        stack.axis = .horizontal
        stack.alignment = .center
        stack.distribution = .equalCentering
        stack.spacing = -7
        stack.translatesAutoresizingMaskIntoConstraints = false

        for item in items {
            let surface = UIView()
            surface.backgroundColor = item.color.withAlphaComponent(0.12)
            surface.layer.cornerRadius = 22
            surface.layer.cornerCurve = .continuous
            surface.translatesAutoresizingMaskIntoConstraints = false
            let image = UIImageView(image: UIImage(systemName: item.symbol))
            image.tintColor = item.color
            image.contentMode = .scaleAspectFit
            image.translatesAutoresizingMaskIntoConstraints = false
            surface.addSubview(image)
            NSLayoutConstraint.activate([
                surface.widthAnchor.constraint(equalToConstant: 44),
                surface.heightAnchor.constraint(equalToConstant: 44),
                image.centerXAnchor.constraint(equalTo: surface.centerXAnchor),
                image.centerYAnchor.constraint(equalTo: surface.centerYAnchor),
                image.widthAnchor.constraint(equalToConstant: 21),
                image.heightAnchor.constraint(equalToConstant: 21)
            ])
            stack.addArrangedSubview(surface)
        }

        addSubview(stack)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(greaterThanOrEqualToConstant: 54),
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor)
        ])
        isAccessibilityElement = true
        self.accessibilityLabel = accessibilityLabel
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

private final class NativeTripOverviewCenteredContent: UIView {
    init(_ content: UIView, maximumWidth: CGFloat) {
        super.init(frame: .zero)
        content.translatesAutoresizingMaskIntoConstraints = false
        addSubview(content)
        NSLayoutConstraint.activate([
            content.topAnchor.constraint(equalTo: topAnchor),
            content.bottomAnchor.constraint(equalTo: bottomAnchor),
            content.centerXAnchor.constraint(equalTo: centerXAnchor),
            content.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 12),
            content.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -12),
            content.widthAnchor.constraint(lessThanOrEqualToConstant: maximumWidth)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

private final class NativeTripOverviewCategoryBubble: UIView {
    init(key: String, symbol: String?, accessibilityText: String) {
        super.init(frame: .zero)
        let presentation = NativeTripOverviewCategoryCatalog.presentation(key: key, suggestedSymbol: symbol)
        backgroundColor = presentation.background; layer.cornerRadius = 22
        let image = UIImageView(image: UIImage(systemName: presentation.symbol)); image.tintColor = presentation.color
        image.contentMode = .scaleAspectFit; image.translatesAutoresizingMaskIntoConstraints = false; addSubview(image)
        isAccessibilityElement = true; accessibilityLabel = accessibilityText
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: 44), heightAnchor.constraint(equalToConstant: 44),
            image.centerXAnchor.constraint(equalTo: centerXAnchor), image.centerYAnchor.constraint(equalTo: centerYAnchor),
            image.widthAnchor.constraint(equalToConstant: 22), image.heightAnchor.constraint(equalToConstant: 22)
        ])
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

private final class NativeTripOverviewOverflowBubble: UILabel {
    init(count: Int) {
        super.init(frame: .zero); text = "+\(count)"; textAlignment = .center
        font = AlmidyDesignTokens.Font.body(15)
        textColor = AlmidyDesignTokens.Color.textSecondary
        backgroundColor = AlmidyDesignTokens.Color.textTertiary.withAlphaComponent(0.12)
        layer.cornerRadius = 22; layer.masksToBounds = true; accessibilityLabel = "\(count) more categories"
        widthAnchor.constraint(equalToConstant: 44).isActive = true; heightAnchor.constraint(equalToConstant: 44).isActive = true
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

private final class NativeTripOverviewDocumentRow: UIView {
    init(document: NativeTripOverview.Document) {
        super.init(frame: .zero)
        let presentation = Self.presentation(for: document.type)
        let icon = UIImageView(image: UIImage(systemName: presentation.symbol)); icon.tintColor = presentation.color; icon.contentMode = .scaleAspectFit
        let title = UILabel.almidyBody(document.title); title.numberOfLines = 2
        let metadata = UILabel.almidyCaption([presentation.label, Self.displayDate(document.date)].compactMap { $0 }.joined(separator: " · "))
        let labels = UIStackView(arrangedSubviews: [title, metadata]); labels.axis = .vertical; labels.spacing = 2
        let row = UIStackView(arrangedSubviews: [icon, labels]); row.axis = .horizontal; row.spacing = 12; row.alignment = .center
        row.translatesAutoresizingMaskIntoConstraints = false; addSubview(row)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(greaterThanOrEqualToConstant: 52), icon.widthAnchor.constraint(equalToConstant: 28), icon.heightAnchor.constraint(equalToConstant: 28),
            row.leadingAnchor.constraint(equalTo: leadingAnchor), row.trailingAnchor.constraint(equalTo: trailingAnchor), row.topAnchor.constraint(equalTo: topAnchor), row.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        isAccessibilityElement = true; accessibilityLabel = [presentation.label, document.title, Self.displayDate(document.date)].compactMap { $0 }.joined(separator: ", ")
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    private static func presentation(for type: String) -> (symbol: String, label: String, color: UIColor) {
        let value = type.lowercased()
        if value.contains("link") || value.contains("url") { return ("link", "Link", AlmidyDesignTokens.Color.goldMuted) }
        if value.contains("photo") || value.contains("image") { return ("photo", "Photo", AlmidyDesignTokens.Color.info) }
        if value.contains("reservation") || value.contains("booking") || value.contains("email") {
            return ("checkmark.rectangle", "Reservation", AlmidyDesignTokens.Color.goldMuted)
        }
        return ("doc.text", "Document", AlmidyDesignTokens.Color.textSecondary)
    }
    private static func displayDate(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        if let date = ISO8601DateFormatter.almidy.date(from: value) { return DateFormatter.almidyMedium.string(from: date) }
        if let date = DateFormatter.almidyISODate.date(from: value) { return DateFormatter.almidyMedium.string(from: date) }
        return value
    }
}

private final class NativeTripOverviewCurrencyGroup: UIView {
    init(currency: NativeTripOverview.ExpenseCurrency, hidden: Bool) {
        super.init(frame: .zero)
        let stack = UIStackView(); stack.axis = .vertical; stack.spacing = 9; stack.translatesAutoresizingMaskIntoConstraints = false
        currency.categories.forEach { category in
            let presentation = NativeTripOverviewCategoryCatalog.presentation(key: category.key)
            let icon = UIImageView(image: UIImage(systemName: presentation.symbol)); icon.tintColor = presentation.color; icon.contentMode = .scaleAspectFit
            let label = UILabel.almidyBody(category.label)
            let amount = UILabel.almidyBody(hidden ? "••••" : NativeTripOverviewMoneyFormatter.string(category.money)); amount.textAlignment = .right
            let row = UIStackView(arrangedSubviews: [icon, label, amount]); row.axis = .horizontal; row.spacing = 10; row.alignment = .center
            row.isAccessibilityElement = true
            row.accessibilityLabel = category.label
            row.accessibilityValue = hidden ? "Amount hidden" : NativeTripOverviewMoneyFormatter.spoken(category.money)
            icon.widthAnchor.constraint(equalToConstant: 24).isActive = true; icon.heightAnchor.constraint(equalToConstant: 24).isActive = true
            stack.addArrangedSubview(row)
        }
        let totalLabel = UILabel.almidyBody("Total \(currency.total.currency)"); totalLabel.font = AlmidyDesignTokens.Font.section(17)
        let totalAmount = UILabel.almidyBody(hidden ? "••••" : NativeTripOverviewMoneyFormatter.string(currency.total)); totalAmount.font = AlmidyDesignTokens.Font.section(17); totalAmount.textAlignment = .right
        let total = UIStackView(arrangedSubviews: [totalLabel, totalAmount]); total.axis = .horizontal; stack.addArrangedSubview(total)
        total.isAccessibilityElement = true; total.accessibilityLabel = "Total"
        total.accessibilityValue = hidden ? "Amount hidden" : NativeTripOverviewMoneyFormatter.spoken(currency.total)
        addSubview(stack); NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor), stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.topAnchor.constraint(equalTo: topAnchor), stack.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

private final class NativeTripOverviewRecentRow: UIView {
    init(item: NativeTripOverview.RecentItem) {
        super.init(frame: .zero)
        let presentation = NativeTripOverviewCategoryCatalog.presentation(key: item.category, suggestedSymbol: item.icon)
        let icon = UIImageView(image: UIImage(systemName: presentation.symbol)); icon.tintColor = presentation.color; icon.contentMode = .scaleAspectFit
        let title = UILabel.almidyBody(item.title); title.numberOfLines = 2
        let category = UILabel.almidyCaption(item.category)
        let labels = UIStackView(arrangedSubviews: [title, category]); labels.axis = .vertical; labels.spacing = 2
        let row = UIStackView(arrangedSubviews: [icon, labels]); row.axis = .horizontal; row.spacing = 12; row.alignment = .center; row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row); NSLayoutConstraint.activate([
            heightAnchor.constraint(greaterThanOrEqualToConstant: 52), icon.widthAnchor.constraint(equalToConstant: 30), icon.heightAnchor.constraint(equalToConstant: 30),
            row.leadingAnchor.constraint(equalTo: leadingAnchor), row.trailingAnchor.constraint(equalTo: trailingAnchor), row.topAnchor.constraint(equalTo: topAnchor), row.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        isAccessibilityElement = true; accessibilityLabel = "\(item.title), \(item.category)"
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

private extension UILabel {
    static func almidyBody(_ text: String) -> UILabel {
        let label = UILabel(); label.text = text
        label.font = UIFontMetrics(forTextStyle: .body).scaledFont(for: AlmidyDesignTokens.Font.body(15))
        label.textColor = AlmidyDesignTokens.Color.textPrimary
        label.adjustsFontForContentSizeCategory = true; label.numberOfLines = 0; return label
    }
    static func almidyCaption(_ text: String) -> UILabel {
        let label = UILabel.almidyBody(text)
        label.font = UIFontMetrics(forTextStyle: .caption1).scaledFont(for: AlmidyDesignTokens.Font.body(12))
        label.textColor = AlmidyDesignTokens.Color.textSecondary
        return label
    }
    static func almidyAction(_ text: String) -> UILabel {
        let label = UILabel.almidyBody(text)
        label.font = UIFontMetrics(forTextStyle: .callout).scaledFont(for: AlmidyDesignTokens.Font.semibold(15))
        label.textColor = AlmidyDesignTokens.Color.goldDark
        label.textAlignment = .left
        label.accessibilityTraits.insert(.link)
        return label
    }
}

private extension ISO8601DateFormatter {
    static let almidy = ISO8601DateFormatter()
}

private extension DateFormatter {
    static let almidyMedium: DateFormatter = { let value = DateFormatter(); value.dateStyle = .medium; value.timeStyle = .none; return value }()
    static let almidyISODate: DateFormatter = { let value = DateFormatter(); value.locale = Locale(identifier: "en_US_POSIX"); value.dateFormat = "yyyy-MM-dd"; return value }()
}

final class NativeTripOverviewActionsView: UIView {
    static let populatedCircleDiameter: CGFloat = 52
    static let populatedMinimumTarget: CGFloat = 88
    var onAction: ((NativeTripOverviewAction) -> Void)?
    private let scrollView = UIScrollView()
    private let actionStack = UIStackView()
    private var stackWidthConstraint: NSLayoutConstraint!
    private var renderedActions: [NativeTripOverviewAction] = []
    var renderedActionKinds: [NativeTripOverviewActionKind] {
        renderedActions.map(\.kind)
    }
    var isUsingDedicatedEmptyAction: Bool {
        actionStack.arrangedSubviews.first is NativeTripOverviewEmptyActivityAction
    }
    var usesHorizontalScrolling: Bool { scrollView.isScrollEnabled }
    var renderedAccessibilityValues: [String] {
        actionStack.arrangedSubviews.compactMap { $0.accessibilityValue }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.alwaysBounceHorizontal = false
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        actionStack.axis = .horizontal
        actionStack.spacing = 18
        actionStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(scrollView)
        scrollView.addSubview(actionStack)
        stackWidthConstraint = actionStack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor)
        NSLayoutConstraint.activate([
            scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
            scrollView.topAnchor.constraint(equalTo: topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),
            actionStack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            actionStack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            actionStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            actionStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            actionStack.heightAnchor.constraint(equalTo: scrollView.frameLayoutGuide.heightAnchor),
            heightAnchor.constraint(greaterThanOrEqualToConstant: 104)
        ])
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(contentSizeCategoryDidChange),
            name: UIContentSizeCategory.didChangeNotification,
            object: nil
        )
        updateLargeTextLayout()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    deinit { NotificationCenter.default.removeObserver(self) }

    func render(actions: [NativeTripOverviewAction], activityMode: TripOverviewActivityMode?) {
        actionStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        renderedActions = NativeTripOverviewActivityPresentation.visibleActions(from: actions, mode: activityMode)

        if activityMode == .empty, let action = renderedActions.first(where: { $0.kind == .newActivity }) {
            let emptyAction = NativeTripOverviewEmptyActivityAction(action: action)
            emptyAction.addTarget(self, action: #selector(activateEmptyAction(_:)), for: .touchUpInside)
            actionStack.addArrangedSubview(emptyAction)
        } else {
            renderedActions.forEach { action in
                let button = NativeTripOverviewActionButton(
                    action: action,
                    displayLabel: NativeTripOverviewActivityPresentation.label(for: action, mode: activityMode)
                )
                button.addTarget(self, action: #selector(activate(_:)), for: .touchUpInside)
                actionStack.addArrangedSubview(button)
            }
        }
        isHidden = actionStack.arrangedSubviews.isEmpty
        updateLargeTextLayout()
    }

    @objc private func contentSizeCategoryDidChange() { updateLargeTextLayout() }

    private func updateLargeTextLayout() {
        let usesScrolling = traitCollection.preferredContentSizeCategory.isAccessibilityCategory
        scrollView.isScrollEnabled = usesScrolling
        scrollView.alwaysBounceHorizontal = usesScrolling && actionStack.arrangedSubviews.count > 2
        stackWidthConstraint.isActive = !usesScrolling
        actionStack.distribution = usesScrolling ? .fill : .fillEqually
    }

    @objc private func activate(_ sender: NativeTripOverviewActionButton) { onAction?(sender.action) }
    @objc private func activateEmptyAction(_ sender: NativeTripOverviewEmptyActivityAction) { onAction?(sender.action) }
}

private final class NativeTripOverviewEmptyActivityAction: UIControl {
    let action: NativeTripOverviewAction
    private let materialView = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterialDark))
    private let materialWash = UIView()
    private let iconView = UIImageView()
    private let actionLabel = UILabel()

    init(action: NativeTripOverviewAction) {
        self.action = action
        super.init(frame: .zero)

        materialView.isUserInteractionEnabled = false
        materialView.clipsToBounds = true
        materialView.layer.cornerRadius = 38
        materialView.layer.cornerCurve = .continuous
        materialView.layer.borderWidth = 1
        materialView.layer.borderColor = UIColor.white.withAlphaComponent(0.24).cgColor
        materialView.translatesAutoresizingMaskIntoConstraints = false

        materialWash.backgroundColor = UIColor.white.withAlphaComponent(0.14)
        materialWash.isUserInteractionEnabled = false
        materialWash.translatesAutoresizingMaskIntoConstraints = false

        let symbol = UIImage.SymbolConfiguration(pointSize: 30, weight: .regular)
        iconView.image = UIImage(systemName: "plus", withConfiguration: symbol)
        iconView.tintColor = AlmidyDesignTokens.Color.tripOverviewActionIcon
        iconView.contentMode = .scaleAspectFit
        iconView.isUserInteractionEnabled = false
        iconView.translatesAutoresizingMaskIntoConstraints = false

        actionLabel.text = "Add First Activity"
        actionLabel.font = UIFontMetrics(forTextStyle: .callout).scaledFont(for: AlmidyDesignTokens.Font.body(15))
        actionLabel.adjustsFontForContentSizeCategory = true
        actionLabel.textColor = AlmidyDesignTokens.Color.tripOverviewActionLabel
        actionLabel.textAlignment = .center
        actionLabel.numberOfLines = 0
        actionLabel.isUserInteractionEnabled = false
        actionLabel.translatesAutoresizingMaskIntoConstraints = false

        addSubview(materialView)
        materialView.contentView.addSubview(materialWash)
        materialView.contentView.addSubview(iconView)
        addSubview(actionLabel)

        NSLayoutConstraint.activate([
            materialView.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            materialView.centerXAnchor.constraint(equalTo: centerXAnchor),
            materialView.widthAnchor.constraint(equalToConstant: 76),
            materialView.heightAnchor.constraint(equalToConstant: 76),
            materialWash.leadingAnchor.constraint(equalTo: materialView.contentView.leadingAnchor),
            materialWash.trailingAnchor.constraint(equalTo: materialView.contentView.trailingAnchor),
            materialWash.topAnchor.constraint(equalTo: materialView.contentView.topAnchor),
            materialWash.bottomAnchor.constraint(equalTo: materialView.contentView.bottomAnchor),
            iconView.centerXAnchor.constraint(equalTo: materialView.contentView.centerXAnchor),
            iconView.centerYAnchor.constraint(equalTo: materialView.contentView.centerYAnchor),
            iconView.widthAnchor.constraint(equalToConstant: 34),
            iconView.heightAnchor.constraint(equalToConstant: 34),
            actionLabel.topAnchor.constraint(equalTo: materialView.bottomAnchor, constant: 9),
            actionLabel.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 8),
            actionLabel.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -8),
            actionLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            actionLabel.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
            widthAnchor.constraint(greaterThanOrEqualToConstant: 160),
            heightAnchor.constraint(greaterThanOrEqualToConstant: 122)
        ])

        isAccessibilityElement = true
        accessibilityTraits = [.button]
        accessibilityLabel = "Add First Activity"
        accessibilityHint = "Opens the new activity form for this trip"
        accessibilityIdentifier = "trip-overview-empty-add-activity"
        accessibilityValue = "Available"
    }

    override var isHighlighted: Bool {
        didSet {
            let transform = isHighlighted ? CGAffineTransform(scaleX: 0.96, y: 0.96) : .identity
            UIView.animate(withDuration: 0.14) {
                self.materialView.transform = transform
                self.materialView.alpha = self.isHighlighted ? 0.78 : 1
            }
        }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

private final class NativeTripOverviewActionButton: UIButton {
    let action: NativeTripOverviewAction
    private let iconSurface = UIView()
    private let iconView = UIImageView()
    private let actionLabel = UILabel()

    init(action: NativeTripOverviewAction, displayLabel: String) {
        self.action = action
        super.init(frame: .zero)
        backgroundColor = .clear

        iconSurface.backgroundColor = AlmidyDesignTokens.Color.tripOverviewActionSurface
        iconSurface.layer.cornerRadius = NativeTripOverviewActionsView.populatedCircleDiameter / 2
        iconSurface.layer.cornerCurve = .continuous
        iconSurface.isUserInteractionEnabled = false
        iconSurface.translatesAutoresizingMaskIntoConstraints = false

        let symbol = UIImage.SymbolConfiguration(pointSize: 20, weight: .medium)
        iconView.image = UIImage(systemName: Self.symbolName(for: action.kind), withConfiguration: symbol)
        iconView.tintColor = AlmidyDesignTokens.Color.tripOverviewActionIcon
        iconView.contentMode = .scaleAspectFit
        iconView.isUserInteractionEnabled = false
        iconView.translatesAutoresizingMaskIntoConstraints = false

        actionLabel.text = displayLabel
        actionLabel.font = UIFontMetrics(forTextStyle: .caption2).scaledFont(for: AlmidyDesignTokens.Font.body(11))
        actionLabel.adjustsFontForContentSizeCategory = true
        actionLabel.textColor = AlmidyDesignTokens.Color.tripOverviewActionLabel
        actionLabel.textAlignment = .center
        actionLabel.numberOfLines = 2
        actionLabel.isUserInteractionEnabled = false
        actionLabel.translatesAutoresizingMaskIntoConstraints = false

        addSubview(iconSurface)
        iconSurface.addSubview(iconView)
        addSubview(actionLabel)
        NSLayoutConstraint.activate([
            iconSurface.topAnchor.constraint(equalTo: topAnchor, constant: 4),
            iconSurface.centerXAnchor.constraint(equalTo: centerXAnchor),
            iconSurface.widthAnchor.constraint(equalToConstant: NativeTripOverviewActionsView.populatedCircleDiameter),
            iconSurface.heightAnchor.constraint(equalToConstant: NativeTripOverviewActionsView.populatedCircleDiameter),
            iconView.centerXAnchor.constraint(equalTo: iconSurface.centerXAnchor),
            iconView.centerYAnchor.constraint(equalTo: iconSurface.centerYAnchor),
            iconView.widthAnchor.constraint(equalToConstant: 22),
            iconView.heightAnchor.constraint(equalToConstant: 22),
            actionLabel.topAnchor.constraint(equalTo: iconSurface.bottomAnchor, constant: 6),
            actionLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            actionLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            actionLabel.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor, constant: -2)
        ])
        accessibilityLabel = displayLabel
        accessibilityIdentifier = "trip-action-\(action.kind.rawValue)"
        accessibilityValue = "Available"
        switch action.destination {
        case .webHandoff: accessibilityHint = "Opens the authenticated trip workspace"
        case .nativePlaces: accessibilityHint = "Opens places for this trip"
        case .nativeRoutes: accessibilityHint = "Shows this trip on the map"
        case nil: accessibilityValue = "Unavailable"
        }
        accessibilityTraits.insert(.button)
        widthAnchor.constraint(greaterThanOrEqualToConstant: NativeTripOverviewActionsView.populatedMinimumTarget).isActive = true
        heightAnchor.constraint(greaterThanOrEqualToConstant: 96).isActive = true
    }

    private static func symbolName(for kind: NativeTripOverviewActionKind) -> String {
        switch kind {
        case .newActivity: return "plus"
        case .places: return "mappin.and.ellipse"
        case .routes: return "point.topleft.down.to.point.bottomright.curvepath"
        case .flights: return "airplane"
        case .stays: return "bed.double.fill"
        }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

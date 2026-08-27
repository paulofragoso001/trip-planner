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
        AlmidySurfaceStyle(
            backgroundColor: AlmidyDesignTokens.Color.surface,
            cornerRadius: AlmidyDesignTokens.Component.TripOverview.cardCornerRadius,
            border: nil,
            elevation: nil
        ).apply(to: self)
        layer.cornerCurve = .continuous
        accessibilityTraits.insert(.button)
        isAccessibilityElement = false
        shouldGroupAccessibilityChildren = true
        accessibilityContainerType = .semanticGroup
        contentStack.axis = .vertical
        contentStack.spacing = AlmidyDesignTokens.TripOverview.cardContentGap
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        stateLabel.font = UIFontMetrics(forTextStyle: .caption1).scaledFont(for: AlmidyDesignTokens.TripOverview.metadataFont)
        stateLabel.adjustsFontForContentSizeCategory = true
        stateLabel.textColor = AlmidyDesignTokens.Color.tripOverviewNeutralText
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
        accentColor: AlmidyDesignTokens.Color.tripOverviewAccent,
        surfaceColor: AlmidyDesignTokens.Color.tripOverviewAccentSurface,
        titleFont: AlmidyDesignTokens.TripOverview.headingFont
    )
    private(set) var renderedCategoryKeys: [String] = []
    private(set) var overflowCount = 0
    private(set) var totalText: String?
    private(set) var renderedDateRange: String?
    private(set) var isUsingCompactEmptyInsets = false
    private(set) var isUsingCompactPresentation = false
    var hasAddFirstActivityAction: Bool {
        contentStack.arrangedSubviews.contains { ($0 as? UIButton)?.title(for: .normal) == "Add First Activity" }
    }
    var hasViewAllDaysAction: Bool {
        contentStack.arrangedSubviews.contains { ($0 as? UIButton)?.title(for: .normal) == "View All Days" }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        accessibilityIdentifier = "overview-itinerary-card"
        contentStack.spacing = AlmidyDesignTokens.TripOverview.itineraryContentGap
        contentStack.insertArrangedSubview(header, at: 0)
        accessibilityLabel = "Itinerary"
        accessibilityHint = "Opens the complete itinerary"
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setCompactPresentation(_ isCompact: Bool) {
        isUsingCompactPresentation = isCompact
        contentStack.arrangedSubviews.forEach { view in
            switch view.accessibilityIdentifier {
            case "trip-overview-measure-itinerary-divider-action",
                 "trip-overview-measure-itinerary-action":
                view.isHidden = isCompact
            default:
                break
            }
        }
    }

    func render(
        _ itinerary: NativeTripOverview.Itinerary,
        trip: NativeTripOverview.Trip? = nil,
        newActivityAvailable: Bool,
        now: Date = Date(),
        timeZone: TimeZone = .current,
        locale: Locale = .current
    ) {
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
                ? AlmidyDesignTokens.TripOverview.itineraryCardVerticalInset
                : AlmidyDesignTokens.TripOverview.cardVerticalInset
        )
        contentStack.addArrangedSubview(NativeTripOverviewDivider(
            identifier: "trip-overview-measure-itinerary-divider-primary",
            extendsThroughCardInsets: true
        ))
        if itinerary.status.state == .failed {
            accessibilityValue = "Temporarily unavailable"
            return
        }
        if itinerary.activityMode == .empty {
            let emptyRow = NativeTripOverviewEmptyTimelineRow()
            emptyRow.accessibilityIdentifier = "trip-overview-measure-itinerary-empty-row"
            contentStack.addArrangedSubview(emptyRow)
            if newActivityAvailable {
                let add = UIButton(type: .system)
                add.setTitle("Add First Activity", for: .normal)
                add.setTitleColor(AlmidyDesignTokens.Color.tripOverviewAccent, for: .normal)
                add.titleLabel?.font = UIFontMetrics(forTextStyle: .callout).scaledFont(for: AlmidyDesignTokens.TripOverview.actionFont)
                add.titleLabel?.adjustsFontForContentSizeCategory = true
                add.contentHorizontalAlignment = .leading
                add.accessibilityHint = "Opens the new activity form"
                add.accessibilityIdentifier = "trip-overview-measure-itinerary-action"
                add.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
                add.addAction(UIAction { [weak self] _ in self?.onNewActivity?() }, for: .touchUpInside)
                contentStack.addArrangedSubview(NativeTripOverviewDivider(
                    identifier: "trip-overview-measure-itinerary-divider-action",
                    extendsThroughCardInsets: true
                ))
                contentStack.addArrangedSubview(add)
                setCompactPresentation(isUsingCompactPresentation)
            }
            accessibilityValue = "Empty"
            return
        }

        // The overview contract currently supplies activity totals and trip dates,
        // but not a trustworthy count of distinct itinerary days. Do not infer a
        // multi-day itinerary from the trip duration or present "View All Days"
        // until that day-level contract and a working destination are available.
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
    private let header = NativeTripOverviewCardHeader(
        icon: "folder.fill",
        title: NativeTripOverviewReleaseScope.importedItemsTitle,
        titleFont: AlmidyDesignTokens.TripOverview.importedItemsHeadingFont,
        height: AlmidyDesignTokens.TripOverview.importedItemsHeaderHeight,
        iconSurfaceDiameter: AlmidyDesignTokens.TripOverview.importedItemsHeaderIconSurface,
        iconDiameter: AlmidyDesignTokens.TripOverview.importedItemsHeaderIcon
    )
    private(set) var renderedDocumentIDs: [String] = []
    private var emptyMinimumHeightConstraint: NSLayoutConstraint?

    override init(frame: CGRect) {
        super.init(frame: frame)
        accessibilityIdentifier = "overview-documents-card"
        contentStack.spacing = AlmidyDesignTokens.TripOverview.importedItemsContentGap
        setVerticalContentInset(AlmidyDesignTokens.TripOverview.importedItemsCardVerticalInset)
        contentStack.insertArrangedSubview(header, at: 0)
        accessibilityLabel = NativeTripOverviewReleaseScope.importedItemsTitle
        accessibilityHint = "Opens imported trip documents"
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func render(_ documents: NativeTripOverview.Documents) {
        reset(after: header); apply(documents.status)
        emptyMinimumHeightConstraint?.isActive = false
        emptyMinimumHeightConstraint = nil
        renderedDocumentIDs = documents.items.map(\.id)
        contentStack.addArrangedSubview(NativeTripOverviewDivider(identifier: "trip-overview-measure-documents-divider"))
        guard !documents.items.isEmpty else {
            let minimumHeight = heightAnchor.constraint(
                greaterThanOrEqualToConstant: AlmidyDesignTokens.TripOverview.importedItemsEmptyMinimumHeight
            )
            minimumHeight.priority = .defaultHigh
            minimumHeight.isActive = true
            emptyMinimumHeightConstraint = minimumHeight
            let illustration = NativeTripOverviewIllustrationRow(items: [
                ("envelope.fill", AlmidyDesignTokens.Color.goldMuted),
                ("photo.on.rectangle.angled", AlmidyDesignTokens.Color.info),
                ("doc.text.fill", AlmidyDesignTokens.Color.tripOverviewNeutralIcon),
                ("link", AlmidyDesignTokens.Color.goldMuted)
            ], accessibilityLabel: "Reservation email, photo, note, and link types",
               diameter: AlmidyDesignTokens.TripOverview.importedItemsIconClusterDiameter,
               iconDiameter: AlmidyDesignTokens.TripOverview.importedItemsIconClusterIcon,
               overlap: AlmidyDesignTokens.TripOverview.importedItemsIconClusterOverlap,
               rowHeight: AlmidyDesignTokens.TripOverview.importedItemsIconRowHeight)
            illustration.accessibilityIdentifier = "trip-overview-measure-documents-icons"
            let explanation = UILabel.almidyImportedItemsBody("Reservation emails, photos, notes, and links imported for this trip will appear here.")
            let body = NativeTripOverviewCenteredContent(
                explanation,
                maximumWidth: AlmidyDesignTokens.TripOverview.importedItemsBodyMaximumWidth
            )
            body.accessibilityIdentifier = "trip-overview-measure-documents-body"
            let action = UIButton.almidyEmptyStateAction(NativeTripOverviewReleaseScope.importedItemsEmptyActionTitle)
            action.accessibilityHint = "Opens imported trip documents"
            action.accessibilityIdentifier = "trip-overview-measure-documents-action"
            action.addAction(UIAction { [weak self] _ in self?.onOpen?() }, for: .touchUpInside)
            contentStack.addArrangedSubview(NativeTripOverviewEmptyStateContent(
                views: [illustration, body, action],
                spacing: AlmidyDesignTokens.TripOverview.importedItemsEmptyContentGap
            ))
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
    private let header = NativeTripOverviewCardHeader(
        icon: "creditcard.fill",
        title: "Expenses",
        titleFont: AlmidyDesignTokens.TripOverview.expensesHeadingFont,
        height: AlmidyDesignTokens.TripOverview.expensesHeaderHeight,
        iconSurfaceDiameter: AlmidyDesignTokens.TripOverview.expensesHeaderIconSurface,
        iconDiameter: AlmidyDesignTokens.TripOverview.expensesHeaderIcon
    )
    private let preferenceKey = "almidy.trip-overview.expenses-hidden"
    private var expenses: NativeTripOverview.Expenses?
    private(set) var renderedCurrencies: [String] = []
    private(set) var amountsHidden: Bool
    private var emptyMinimumHeightConstraint: NSLayoutConstraint?

    override init(frame: CGRect) {
        amountsHidden = UserDefaults.standard.bool(forKey: preferenceKey)
        super.init(frame: frame)
        accessibilityIdentifier = "overview-expenses-card"
        contentStack.spacing = AlmidyDesignTokens.TripOverview.expensesContentGap
        setVerticalContentInset(AlmidyDesignTokens.TripOverview.expensesCardVerticalInset)
        contentStack.insertArrangedSubview(header, at: 0)
        header.setAction(symbol: amountsHidden ? "eye.slash" : "eye", label: amountsHidden ? "Reveal expense amounts" : "Hide expense amounts") { [weak self] in self?.toggleAmounts() }
        accessibilityLabel = "Expenses"
        accessibilityHint = "Opens the detailed trip budget"
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func render(_ expenses: NativeTripOverview.Expenses) {
        self.expenses = expenses; reset(after: header); apply(expenses.status)
        emptyMinimumHeightConstraint?.isActive = false
        emptyMinimumHeightConstraint = nil
        renderedCurrencies = expenses.currencies.map { $0.total.currency }
        contentStack.addArrangedSubview(NativeTripOverviewDivider(identifier: "trip-overview-measure-expenses-divider-primary"))
        guard !expenses.currencies.isEmpty else {
            let minimumHeight = heightAnchor.constraint(
                greaterThanOrEqualToConstant: AlmidyDesignTokens.TripOverview.expensesEmptyMinimumHeight
            )
            minimumHeight.priority = .defaultHigh
            minimumHeight.isActive = true
            emptyMinimumHeightConstraint = minimumHeight
            let illustration = NativeTripOverviewIllustrationRow(items: [
                ("creditcard.fill", AlmidyDesignTokens.Color.goldMuted),
                ("bed.double.fill", AlmidyDesignTokens.Color.generatedTripGradientStart),
                ("fork.knife", AlmidyDesignTokens.Color.goldMuted),
                ("dollarsign.circle.fill", AlmidyDesignTokens.Color.tripOverviewNeutralIcon)
            ], accessibilityLabel: "Payment, stay, dining, and other expense categories",
               diameter: AlmidyDesignTokens.TripOverview.expensesIconClusterDiameter,
               iconDiameter: AlmidyDesignTokens.TripOverview.expensesIconClusterIcon,
               overlap: AlmidyDesignTokens.TripOverview.expensesIconClusterOverlap,
               rowHeight: AlmidyDesignTokens.TripOverview.expensesIconRowHeight)
            illustration.accessibilityIdentifier = "trip-overview-measure-expenses-icons"
            let explanation = UILabel.almidyExpensesBody("Costs added from activities or the trip budget will appear here, grouped by category and currency.")
            let body = NativeTripOverviewCenteredContent(
                explanation,
                maximumWidth: AlmidyDesignTokens.TripOverview.expensesBodyMaximumWidth
            )
            body.accessibilityIdentifier = "trip-overview-measure-expenses-body"
            let budgetAffordance = UIButton.almidyEmptyStateAction(NativeTripOverviewReleaseScope.expensesEmptyActionTitle)
            budgetAffordance.accessibilityHint = "Opens the detailed trip budget"
            budgetAffordance.accessibilityIdentifier = "trip-overview-measure-expenses-action"
            budgetAffordance.addAction(UIAction { [weak self] _ in self?.onOpen?() }, for: .touchUpInside)
            contentStack.addArrangedSubview(NativeTripOverviewEmptyStateContent(
                views: [illustration, body, budgetAffordance],
                spacing: AlmidyDesignTokens.TripOverview.expensesEmptyContentGap
            ))
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

final class NativeTripOverviewEmailForwardingCard: UIView {
    var onManage: (() -> Void)?
    var onDismiss: (() -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        accessibilityIdentifier = "overview-email-forwarding-card"
        backgroundColor = AlmidyDesignTokens.Color.surface
        layer.cornerRadius = AlmidyDesignTokens.TripOverview.cardCornerRadius
        layer.cornerCurve = .continuous

        let icon = UIImageView(image: UIImage(systemName: "envelope.fill"))
        icon.tintColor = AlmidyDesignTokens.Color.tripOverviewNeutralIcon
        icon.contentMode = .scaleAspectFit
        icon.translatesAutoresizingMaskIntoConstraints = false

        let title = UILabel.almidyBody("Email Forwarding")
        title.font = UIFontMetrics(forTextStyle: .headline).scaledFont(for: AlmidyDesignTokens.TripOverview.headingFont)
        title.accessibilityTraits.insert(.header)

        let dismiss = UIButton(type: .system)
        dismiss.setImage(UIImage(systemName: "xmark"), for: .normal)
        dismiss.tintColor = AlmidyDesignTokens.Color.tripOverviewNeutralIcon
        dismiss.accessibilityLabel = "Hide Email Forwarding"
        dismiss.addAction(UIAction { [weak self] _ in self?.onDismiss?() }, for: .touchUpInside)
        dismiss.translatesAutoresizingMaskIntoConstraints = false

        let header = UIStackView(arrangedSubviews: [icon, title, UIView(), dismiss])
        header.axis = .horizontal
        header.alignment = .center
        header.spacing = 12

        let body = UILabel.almidyBody("Forward reservation emails into this trip when email forwarding becomes available. You can continue adding reservation details from Imported items.")
        body.textColor = AlmidyDesignTokens.Color.tripOverviewNeutralText
        body.numberOfLines = 0

        let manage = UIButton(type: .system)
        manage.setTitle("Manage Imports", for: .normal)
        manage.setTitleColor(AlmidyDesignTokens.Color.tripOverviewAccent, for: .normal)
        manage.titleLabel?.font = UIFontMetrics(forTextStyle: .callout).scaledFont(for: AlmidyDesignTokens.TripOverview.actionFont)
        manage.contentHorizontalAlignment = .leading
        manage.accessibilityHint = "Opens imported trip documents"
        manage.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        manage.addAction(UIAction { [weak self] _ in self?.onManage?() }, for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [header, body, manage])
        stack.axis = .vertical
        stack.spacing = AlmidyDesignTokens.TripOverview.utilityCardContentGap
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            icon.widthAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.utilityCardIcon),
            icon.heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.utilityCardIcon),
            dismiss.widthAnchor.constraint(greaterThanOrEqualToConstant: 44),
            dismiss.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: AlmidyDesignTokens.TripOverview.cardHorizontalInset),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -AlmidyDesignTokens.TripOverview.cardHorizontalInset),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: AlmidyDesignTokens.TripOverview.utilityCardVerticalInset),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -AlmidyDesignTokens.TripOverview.utilityCardVerticalInset),
            heightAnchor.constraint(greaterThanOrEqualToConstant: AlmidyDesignTokens.TripOverview.utilityCardMinimumHeight)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

final class NativeTripOverviewInviteGuestsCard: UIView {
    var onShare: (() -> Void)?
    var onDismiss: (() -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        accessibilityIdentifier = "overview-invite-guests-card"
        backgroundColor = AlmidyDesignTokens.Color.surface
        layer.cornerRadius = AlmidyDesignTokens.TripOverview.cardCornerRadius
        layer.cornerCurve = .continuous

        let icon = UIImageView(image: UIImage(systemName: "person.crop.circle.badge.plus"))
        icon.tintColor = AlmidyDesignTokens.Color.tripOverviewNeutralIcon
        icon.contentMode = .scaleAspectFit
        icon.translatesAutoresizingMaskIntoConstraints = false

        let title = UILabel.almidyBody("Invite Guests")
        title.font = UIFontMetrics(forTextStyle: .headline).scaledFont(for: AlmidyDesignTokens.TripOverview.headingFont)
        title.accessibilityTraits.insert(.header)

        let dismiss = UIButton(type: .system)
        dismiss.setImage(UIImage(systemName: "xmark"), for: .normal)
        dismiss.tintColor = AlmidyDesignTokens.Color.tripOverviewNeutralIcon
        dismiss.accessibilityLabel = "Hide Invite Guests"
        dismiss.addAction(UIAction { [weak self] _ in self?.onDismiss?() }, for: .touchUpInside)
        dismiss.translatesAutoresizingMaskIntoConstraints = false

        let header = UIStackView(arrangedSubviews: [icon, title, UIView(), dismiss])
        header.axis = .horizontal
        header.alignment = .center
        header.spacing = 12

        let body = UILabel.almidyBody("Add frequent guests. They can view, add, edit, and remove trip items while you remain the admin.")
        body.textColor = AlmidyDesignTokens.Color.tripOverviewNeutralText
        body.numberOfLines = 0

        let share = UIButton(type: .system)
        share.setTitle("Share Trip", for: .normal)
        share.setTitleColor(AlmidyDesignTokens.Color.tripOverviewAccent, for: .normal)
        share.titleLabel?.font = UIFontMetrics(forTextStyle: .callout).scaledFont(for: AlmidyDesignTokens.TripOverview.actionFont)
        share.contentHorizontalAlignment = .leading
        share.accessibilityHint = "Opens the system share sheet for this trip"
        share.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        share.addAction(UIAction { [weak self] _ in self?.onShare?() }, for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [header, body, share])
        stack.axis = .vertical
        stack.spacing = AlmidyDesignTokens.TripOverview.utilityCardContentGap
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            icon.widthAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.utilityCardIcon),
            icon.heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.utilityCardIcon),
            dismiss.widthAnchor.constraint(greaterThanOrEqualToConstant: 44),
            dismiss.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: AlmidyDesignTokens.TripOverview.cardHorizontalInset),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -AlmidyDesignTokens.TripOverview.cardHorizontalInset),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: AlmidyDesignTokens.TripOverview.utilityCardVerticalInset),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -AlmidyDesignTokens.TripOverview.utilityCardVerticalInset),
            heightAnchor.constraint(greaterThanOrEqualToConstant: AlmidyDesignTokens.TripOverview.utilityCardMinimumHeight)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
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
            accessibilityValue = "Temporarily unavailable"
        }
        if visible.isEmpty && recent.status.state != .failed {
            let empty = UILabel.almidyBody("No recently added activities.")
            empty.textColor = AlmidyDesignTokens.Color.overviewMetadata
            empty.textAlignment = .center
            contentStack.addArrangedSubview(empty)
            accessibilityValue = "No recently added activities"
        }
        visible.forEach { contentStack.addArrangedSubview(NativeTripOverviewRecentRow(item: $0)) }
        if !visible.isEmpty {
            accessibilityValue = "\(visible.count) recently added \(visible.count == 1 ? "activity" : "activities")"
        }
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
    private var trailingToEdgeConstraint: NSLayoutConstraint!
    private var trailingToActionConstraint: NSLayoutConstraint!
    private var actionAfterMetadataConstraint: NSLayoutConstraint!
    var trailingText: String? { get { trailingLabel.text } set { trailingLabel.text = newValue; trailingLabel.isHidden = newValue == nil } }

    init(
        icon: String,
        title: String,
        accentColor: UIColor = AlmidyDesignTokens.Color.tripOverviewNeutralIcon,
        surfaceColor: UIColor = AlmidyDesignTokens.Color.tripOverviewNeutralSurface,
        titleFont: UIFont = AlmidyDesignTokens.TripOverview.headingFont,
        height: CGFloat = AlmidyDesignTokens.TripOverview.headerHeight,
        iconSurfaceDiameter: CGFloat = AlmidyDesignTokens.TripOverview.headerIconSurface,
        iconDiameter: CGFloat = AlmidyDesignTokens.TripOverview.headerIcon
    ) {
        super.init(frame: .zero)
        let measurementName = title.lowercased().replacingOccurrences(of: " ", with: "-")
        accessibilityIdentifier = "trip-overview-measure-\(measurementName)-header"
        iconSurface.accessibilityIdentifier = "trip-overview-measure-\(measurementName)-header-icon"
        titleLabel.accessibilityIdentifier = "trip-overview-measure-\(measurementName)-title"
        trailingLabel.accessibilityIdentifier = "trip-overview-measure-\(measurementName)-metadata"
        actionButton.accessibilityIdentifier = "trip-overview-measure-\(measurementName)-header-action"
        iconSurface.backgroundColor = surfaceColor
        iconSurface.layer.cornerRadius = iconSurfaceDiameter / 2
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
        trailingLabel.font = UIFontMetrics(forTextStyle: .caption1).scaledFont(for: AlmidyDesignTokens.TripOverview.metadataFont)
        trailingLabel.textColor = AlmidyDesignTokens.Color.tripOverviewNeutralText
        trailingLabel.adjustsFontForContentSizeCategory = true
        trailingLabel.numberOfLines = 2; trailingLabel.textAlignment = .right
        actionButton.isHidden = true
        actionButton.tintColor = AlmidyDesignTokens.Color.tripOverviewAccent
        actionButton.addTarget(self, action: #selector(runAction), for: .touchUpInside)
        addSubview(iconSurface)
        iconSurface.addSubview(iconView)
        [titleLabel, trailingLabel, actionButton].forEach { $0.translatesAutoresizingMaskIntoConstraints = false; addSubview($0) }
        iconView.translatesAutoresizingMaskIntoConstraints = false
        trailingToEdgeConstraint = trailingLabel.trailingAnchor.constraint(equalTo: trailingAnchor)
        trailingToActionConstraint = trailingLabel.trailingAnchor.constraint(lessThanOrEqualTo: actionButton.leadingAnchor)
        actionAfterMetadataConstraint = actionButton.leadingAnchor.constraint(greaterThanOrEqualTo: trailingLabel.trailingAnchor, constant: 4)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: height),
            iconSurface.leadingAnchor.constraint(equalTo: leadingAnchor), iconSurface.centerYAnchor.constraint(equalTo: centerYAnchor),
            iconSurface.widthAnchor.constraint(equalToConstant: iconSurfaceDiameter), iconSurface.heightAnchor.constraint(equalToConstant: iconSurfaceDiameter),
            iconView.centerXAnchor.constraint(equalTo: iconSurface.centerXAnchor), iconView.centerYAnchor.constraint(equalTo: iconSurface.centerYAnchor),
            iconView.widthAnchor.constraint(equalToConstant: iconDiameter), iconView.heightAnchor.constraint(equalToConstant: iconDiameter),
            titleLabel.leadingAnchor.constraint(equalTo: iconSurface.trailingAnchor, constant: AlmidyDesignTokens.TripOverview.headerTitleGap), titleLabel.centerYAnchor.constraint(equalTo: centerYAnchor),
            trailingLabel.leadingAnchor.constraint(greaterThanOrEqualTo: titleLabel.trailingAnchor, constant: AlmidyDesignTokens.TripOverview.headerMetadataGap), trailingLabel.centerYAnchor.constraint(equalTo: centerYAnchor),
            trailingToEdgeConstraint,
            actionButton.trailingAnchor.constraint(equalTo: trailingAnchor),
            actionButton.centerYAnchor.constraint(equalTo: centerYAnchor), actionButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 44),
            actionButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44)
        ])
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    func setAction(symbol: String, label: String, action: @escaping () -> Void) {
        self.action = action; actionButton.setImage(UIImage(systemName: symbol), for: .normal)
        actionButton.tintColor = AlmidyDesignTokens.Color.tripOverviewAccent
        actionButton.accessibilityLabel = label; actionButton.isHidden = false
        trailingToEdgeConstraint.isActive = false
        NSLayoutConstraint.activate([trailingToActionConstraint, actionAfterMetadataConstraint])
    }
    @objc private func runAction() { action?() }
}

private final class NativeTripOverviewDivider: UIView {
    init(identifier: String? = nil, extendsThroughCardInsets: Bool = false) {
        super.init(frame: .zero)
        accessibilityIdentifier = identifier
        clipsToBounds = false
        let line = AlmidyDivider(
            thickness: AlmidyDesignTokens.Border.hairline.width,
            color: AlmidyDesignTokens.Color.tripOverviewDivider
        )
        line.translatesAutoresizingMaskIntoConstraints = false
        addSubview(line)
        let extensionAmount = extendsThroughCardInsets ? AlmidyDesignTokens.TripOverview.cardHorizontalInset : 0
        directionalLayoutMargins = NSDirectionalEdgeInsets(
            top: 0,
            leading: AlmidyDesignTokens.TripOverview.separatorInset,
            bottom: 0,
            trailing: AlmidyDesignTokens.TripOverview.separatorInset
        )
        heightAnchor.constraint(equalToConstant: line.thickness).isActive = true
        NSLayoutConstraint.activate([
            line.topAnchor.constraint(equalTo: topAnchor),
            line.bottomAnchor.constraint(equalTo: bottomAnchor),
            line.leadingAnchor.constraint(equalTo: leadingAnchor, constant: -extensionAmount),
            line.trailingAnchor.constraint(equalTo: trailingAnchor, constant: extensionAmount)
        ])
        isAccessibilityElement = false
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

private final class NativeTripOverviewEmptyTimelineRow: UIView {
    override init(frame: CGRect) {
        super.init(frame: frame)
        let iconSurface = UIView()
        iconSurface.backgroundColor = AlmidyDesignTokens.Color.tripOverviewAccentSurface
        iconSurface.layer.cornerRadius = AlmidyDesignTokens.TripOverview.headerIconSurface / 2
        iconSurface.translatesAutoresizingMaskIntoConstraints = false
        let icon = UIImageView(image: UIImage(systemName: "plus"))
        icon.tintColor = AlmidyDesignTokens.Color.tripOverviewAccent
        icon.translatesAutoresizingMaskIntoConstraints = false
        let label = UILabel.almidyBody("Start organizing your itinerary")
        label.textColor = AlmidyDesignTokens.Color.tripOverviewNeutralText
        let row = UIStackView(arrangedSubviews: [iconSurface, label])
        row.axis = .horizontal; row.spacing = 12; row.alignment = .center
        row.translatesAutoresizingMaskIntoConstraints = false
        let connector = UIView()
        connector.accessibilityIdentifier = "trip-overview-measure-itinerary-timeline-connector"
        connector.backgroundColor = AlmidyDesignTokens.Color.tripOverviewDivider
        connector.layer.cornerRadius = AlmidyDesignTokens.TripOverview.itineraryTimelineConnectorWidth / 2
        connector.translatesAutoresizingMaskIntoConstraints = false
        addSubview(connector)
        addSubview(row); iconSurface.addSubview(icon)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.itineraryRowHeight),
            iconSurface.widthAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.headerIconSurface), iconSurface.heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.headerIconSurface),
            icon.centerXAnchor.constraint(equalTo: iconSurface.centerXAnchor), icon.centerYAnchor.constraint(equalTo: iconSurface.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.headerIcon), icon.heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.headerIcon),
            connector.centerXAnchor.constraint(equalTo: iconSurface.centerXAnchor),
            connector.bottomAnchor.constraint(equalTo: iconSurface.topAnchor, constant: -2),
            connector.widthAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.itineraryTimelineConnectorWidth),
            connector.heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.itineraryTimelineConnectorHeight),
            row.leadingAnchor.constraint(equalTo: leadingAnchor), row.trailingAnchor.constraint(equalTo: trailingAnchor),
            row.topAnchor.constraint(equalTo: topAnchor), row.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        isAccessibilityElement = true
        accessibilityLabel = "Start organizing your itinerary"
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

private final class NativeTripOverviewIllustrationRow: UIView {
    init(
        items: [(symbol: String, color: UIColor)],
        accessibilityLabel: String,
        diameter: CGFloat = AlmidyDesignTokens.TripOverview.iconClusterDiameter,
        iconDiameter: CGFloat = AlmidyDesignTokens.TripOverview.iconClusterIcon,
        overlap: CGFloat = AlmidyDesignTokens.TripOverview.iconClusterOverlap,
        rowHeight: CGFloat = 54
    ) {
        super.init(frame: .zero)
        let stack = UIStackView()
        stack.axis = .horizontal
        stack.alignment = .center
        stack.distribution = .equalCentering
        stack.spacing = overlap
        stack.translatesAutoresizingMaskIntoConstraints = false

        for item in items {
            let surface = UIView()
            surface.backgroundColor = item.color.withAlphaComponent(0.12)
            surface.layer.cornerRadius = diameter / 2
            surface.layer.cornerCurve = .continuous
            surface.translatesAutoresizingMaskIntoConstraints = false
            let image = UIImageView(image: UIImage(systemName: item.symbol))
            image.tintColor = item.color
            image.contentMode = .scaleAspectFit
            image.translatesAutoresizingMaskIntoConstraints = false
            surface.addSubview(image)
            NSLayoutConstraint.activate([
                surface.widthAnchor.constraint(equalToConstant: diameter),
                surface.heightAnchor.constraint(equalToConstant: diameter),
                image.centerXAnchor.constraint(equalTo: surface.centerXAnchor),
                image.centerYAnchor.constraint(equalTo: surface.centerYAnchor),
                image.widthAnchor.constraint(equalToConstant: iconDiameter),
                image.heightAnchor.constraint(equalToConstant: iconDiameter)
            ])
            stack.addArrangedSubview(surface)
        }

        addSubview(stack)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: rowHeight),
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

private final class NativeTripOverviewEmptyStateContent: UIView {
    init(views: [UIView], spacing: CGFloat) {
        super.init(frame: .zero)
        let stack = UIStackView(arrangedSubviews: views)
        stack.axis = .vertical
        stack.alignment = .fill
        stack.spacing = spacing
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.topAnchor.constraint(greaterThanOrEqualTo: topAnchor),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

private final class NativeTripOverviewCategoryBubble: UIView {
    init(key: String, symbol: String?, accessibilityText: String) {
        super.init(frame: .zero)
        let presentation = NativeTripOverviewCategoryCatalog.presentation(key: key, suggestedSymbol: symbol)
        backgroundColor = presentation.background; layer.cornerRadius = 18
        let image = UIImageView(image: UIImage(systemName: presentation.symbol)); image.tintColor = presentation.color
        image.contentMode = .scaleAspectFit; image.translatesAutoresizingMaskIntoConstraints = false; addSubview(image)
        isAccessibilityElement = true; accessibilityLabel = accessibilityText
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: 36), heightAnchor.constraint(equalToConstant: 36),
            image.centerXAnchor.constraint(equalTo: centerXAnchor), image.centerYAnchor.constraint(equalTo: centerYAnchor),
            image.widthAnchor.constraint(equalToConstant: 19), image.heightAnchor.constraint(equalToConstant: 19)
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
        layer.cornerRadius = 18; layer.masksToBounds = true; accessibilityLabel = "\(count) more categories"
        widthAnchor.constraint(equalToConstant: 36).isActive = true; heightAnchor.constraint(equalToConstant: 36).isActive = true
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
        label.font = UIFontMetrics(forTextStyle: .body).scaledFont(for: AlmidyDesignTokens.TripOverview.bodyFont)
        label.textColor = AlmidyDesignTokens.Color.textPrimary
        label.adjustsFontForContentSizeCategory = true; label.numberOfLines = 0; return label
    }
    static func almidyCaption(_ text: String) -> UILabel {
        let label = UILabel.almidyBody(text)
        label.font = UIFontMetrics(forTextStyle: .caption1).scaledFont(for: AlmidyDesignTokens.TripOverview.captionFont)
        label.textColor = AlmidyDesignTokens.Color.tripOverviewNeutralText
        return label
    }
    static func almidyImportedItemsBody(_ text: String) -> UILabel {
        let label = UILabel.almidyBody(text)
        label.font = UIFontMetrics(forTextStyle: .body).scaledFont(
            for: AlmidyDesignTokens.TripOverview.importedItemsBodyFont
        )
        label.textColor = AlmidyDesignTokens.Color.tripOverviewNeutralText
        label.textAlignment = .center
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        paragraph.lineSpacing = AlmidyDesignTokens.TripOverview.importedItemsBodyLineSpacing
        label.attributedText = NSAttributedString(
            string: text,
            attributes: [.font: label.font as Any, .paragraphStyle: paragraph]
        )
        return label
    }
    static func almidyExpensesBody(_ text: String) -> UILabel {
        let label = UILabel.almidyBody(text)
        label.font = UIFontMetrics(forTextStyle: .body).scaledFont(
            for: AlmidyDesignTokens.TripOverview.expensesBodyFont
        )
        label.textColor = AlmidyDesignTokens.Color.tripOverviewNeutralText
        label.textAlignment = .center
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        paragraph.lineSpacing = AlmidyDesignTokens.TripOverview.expensesBodyLineSpacing
        label.attributedText = NSAttributedString(
            string: text,
            attributes: [.font: label.font as Any, .paragraphStyle: paragraph]
        )
        return label
    }
    static func almidyAction(_ text: String) -> UILabel {
        let label = UILabel.almidyBody(text)
        label.font = UIFontMetrics(forTextStyle: .callout).scaledFont(for: AlmidyDesignTokens.TripOverview.actionFont)
        label.textColor = AlmidyDesignTokens.Color.tripOverviewAccent
        label.textAlignment = .left
        label.accessibilityTraits.insert(.link)
        return label
    }
}

private extension UIButton {
    static func almidyEmptyStateAction(_ title: String) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.accessibilityLabel = title
        button.titleLabel?.font = UIFontMetrics(forTextStyle: .callout).scaledFont(
            for: AlmidyDesignTokens.TripOverview.actionFont
        )
        button.titleLabel?.adjustsFontForContentSizeCategory = true
        button.tintColor = AlmidyDesignTokens.Color.tripOverviewAccent
        button.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        return button
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
    static let populatedCircleDiameter = AlmidyDesignTokens.Component.TripOverview.populatedActionCircleDiameter
    static let populatedMinimumTarget = AlmidyDesignTokens.Component.TripOverview.populatedActionMinimumTarget
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
    func accessibilityActivateActionForTesting(at index: Int) -> Bool {
        guard actionStack.arrangedSubviews.indices.contains(index) else { return false }
        return actionStack.arrangedSubviews[index].accessibilityActivate()
    }
    var emptyActionCircleDiameter: CGFloat? {
        (actionStack.arrangedSubviews.first as? NativeTripOverviewEmptyActivityAction)?.circleDiameter
    }
    var emptyActionLabelGap: CGFloat? {
        (actionStack.arrangedSubviews.first as? NativeTripOverviewEmptyActivityAction)?.labelGap
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.alwaysBounceHorizontal = false
        // The compact empty-state circle slightly crosses the action region's
        // visual boundary. Keep the scroll mechanics but do not crop its top arc.
        scrollView.clipsToBounds = false
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        actionStack.axis = .horizontal
        actionStack.spacing = 8
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
            heightAnchor.constraint(greaterThanOrEqualToConstant: 116)
        ])
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(contentSizeCategoryDidChange),
            name: UIContentSizeCategory.didChangeNotification,
            object: nil
        )
        updateLargeTextLayout()
    }

    func updateTransition(progress: CGFloat) {
        (actionStack.arrangedSubviews.first as? NativeTripOverviewEmptyActivityAction)?
            .updateTransition(progress: progress)
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
    private let materialView = UIVisualEffectView(effect: nil)
    private let materialWash = UIView()
    private let iconView = UIImageView()
    private let actionLabel = UILabel()
    private var circleWidthConstraint: NSLayoutConstraint!
    private var circleHeightConstraint: NSLayoutConstraint!
    private var labelTopConstraint: NSLayoutConstraint!
    private(set) var circleDiameter = AlmidyDesignTokens.TripOverview.emptyActionCircleDiameter
    private(set) var labelGap = AlmidyDesignTokens.TripOverview.emptyActionLabelGap

    init(action: NativeTripOverviewAction) {
        self.action = action
        super.init(frame: .zero)
        accessibilityIdentifier = "trip-overview-measure-empty-action-group"

        materialView.isUserInteractionEnabled = false
        materialView.clipsToBounds = true
        materialView.backgroundColor = AlmidyDesignTokens.Color.tripOverviewNeutralSurface.withAlphaComponent(0.94)
        materialView.layer.cornerRadius = circleDiameter / 2
        materialView.layer.cornerCurve = .continuous
        materialView.layer.borderWidth = 1
        materialView.layer.borderColor = AlmidyDesignTokens.Color.tripOverviewAccent.withAlphaComponent(0.28).cgColor
        materialView.translatesAutoresizingMaskIntoConstraints = false
        materialView.accessibilityIdentifier = "trip-overview-measure-empty-action-circle"

        materialWash.backgroundColor = UIColor.white.withAlphaComponent(0.10)
        materialWash.isUserInteractionEnabled = false
        materialWash.translatesAutoresizingMaskIntoConstraints = false

        let symbol = UIImage.SymbolConfiguration(pointSize: 30, weight: .regular)
        iconView.image = UIImage(systemName: "plus", withConfiguration: symbol)
        iconView.tintColor = AlmidyDesignTokens.Color.tripOverviewAccent
        iconView.contentMode = .scaleAspectFit
        iconView.isUserInteractionEnabled = false
        iconView.translatesAutoresizingMaskIntoConstraints = false
        iconView.accessibilityIdentifier = "trip-overview-measure-empty-action-icon"

        actionLabel.text = "Add First Activity"
        actionLabel.font = UIFontMetrics(forTextStyle: .callout).scaledFont(for: AlmidyDesignTokens.Font.body(15))
        actionLabel.adjustsFontForContentSizeCategory = true
        actionLabel.textColor = AlmidyDesignTokens.Color.tripOverviewActionLabel
        actionLabel.textAlignment = .center
        actionLabel.numberOfLines = 0
        actionLabel.isUserInteractionEnabled = false
        actionLabel.translatesAutoresizingMaskIntoConstraints = false
        actionLabel.accessibilityIdentifier = "trip-overview-measure-empty-action-label"

        addSubview(materialView)
        materialView.contentView.addSubview(materialWash)
        materialView.contentView.addSubview(iconView)
        addSubview(actionLabel)

        circleWidthConstraint = materialView.widthAnchor.constraint(equalToConstant: circleDiameter)
        circleHeightConstraint = materialView.heightAnchor.constraint(equalToConstant: circleDiameter)
        labelTopConstraint = actionLabel.topAnchor.constraint(equalTo: materialView.bottomAnchor, constant: labelGap)

        NSLayoutConstraint.activate([
            materialView.topAnchor.constraint(equalTo: topAnchor, constant: AlmidyDesignTokens.TripOverview.emptyActionTopInset),
            materialView.centerXAnchor.constraint(equalTo: centerXAnchor),
            circleWidthConstraint,
            circleHeightConstraint,
            materialWash.leadingAnchor.constraint(equalTo: materialView.contentView.leadingAnchor),
            materialWash.trailingAnchor.constraint(equalTo: materialView.contentView.trailingAnchor),
            materialWash.topAnchor.constraint(equalTo: materialView.contentView.topAnchor),
            materialWash.bottomAnchor.constraint(equalTo: materialView.contentView.bottomAnchor),
            iconView.centerXAnchor.constraint(equalTo: materialView.contentView.centerXAnchor),
            iconView.centerYAnchor.constraint(equalTo: materialView.contentView.centerYAnchor),
            iconView.widthAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.emptyActionIconDiameter),
            iconView.heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.emptyActionIconDiameter),
            labelTopConstraint,
            actionLabel.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 8),
            actionLabel.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -8),
            actionLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            actionLabel.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -AlmidyDesignTokens.TripOverview.emptyActionBottomInset),
            widthAnchor.constraint(greaterThanOrEqualToConstant: 160),
            widthAnchor.constraint(greaterThanOrEqualToConstant: AlmidyDesignTokens.TripOverview.minimumInteractiveTarget),
            heightAnchor.constraint(greaterThanOrEqualToConstant: AlmidyDesignTokens.TripOverview.minimumInteractiveTarget)
        ])

        isAccessibilityElement = true
        accessibilityTraits = [.button]
        accessibilityLabel = "Add First Activity"
        accessibilityHint = "Opens the new activity form for this trip"
        accessibilityIdentifier = "trip-overview-empty-add-activity"
        accessibilityValue = "Available"
    }

    func updateTransition(progress: CGFloat) {
        let clamped = min(max(progress, 0), 1)
        let collapsed = AlmidyDesignTokens.TripOverview.CollapsedComposition.self
        circleDiameter = AlmidyDesignTokens.TripOverview.emptyActionCircleDiameter
            + (collapsed.activityCircleDiameter - AlmidyDesignTokens.TripOverview.emptyActionCircleDiameter) * clamped
        labelGap = AlmidyDesignTokens.TripOverview.emptyActionLabelGap
            + (collapsed.activityCircleToLabelGap - AlmidyDesignTokens.TripOverview.emptyActionLabelGap) * clamped
        circleWidthConstraint.constant = circleDiameter
        circleHeightConstraint.constant = circleDiameter
        labelTopConstraint.constant = labelGap
        materialView.layer.cornerRadius = circleDiameter / 2
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

    override func accessibilityActivate() -> Bool {
        guard isEnabled else { return false }
        sendActions(for: .touchUpInside)
        return true
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

        let symbol = UIImage.SymbolConfiguration(
            pointSize: AlmidyDesignTokens.Component.TripOverview.populatedActionIconDiameter - 2,
            weight: .medium
        )
        iconView.image = UIImage(systemName: Self.symbolName(for: action.kind), withConfiguration: symbol)
        iconView.tintColor = AlmidyDesignTokens.Color.tripOverviewActionIcon
        iconView.contentMode = .scaleAspectFit
        iconView.isUserInteractionEnabled = false
        iconView.translatesAutoresizingMaskIntoConstraints = false

        actionLabel.text = displayLabel
        actionLabel.font = UIFontMetrics(forTextStyle: .caption1).scaledFont(for: AlmidyDesignTokens.Font.body(13))
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
            iconView.widthAnchor.constraint(equalToConstant: AlmidyDesignTokens.Component.TripOverview.populatedActionIconDiameter),
            iconView.heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.Component.TripOverview.populatedActionIconDiameter),
            actionLabel.topAnchor.constraint(equalTo: iconSurface.bottomAnchor, constant: AlmidyDesignTokens.Component.TripOverview.populatedActionLabelGap),
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
        heightAnchor.constraint(greaterThanOrEqualToConstant: 112).isActive = true
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

    override func accessibilityActivate() -> Bool {
        guard isEnabled else { return false }
        sendActions(for: .touchUpInside)
        return true
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

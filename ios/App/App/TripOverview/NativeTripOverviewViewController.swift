import UIKit

enum NativeActivitySheetMetrics {
    static let previewIdentifier = UISheetPresentationController.Detent.Identifier("activity-preview")

    static func previewHeight(
        maximumDetentValue: CGFloat,
        screenHeight: CGFloat = UIScreen.main.bounds.height,
        safeAreaInsets: UIEdgeInsets = activeSafeAreaInsets
    ) -> CGFloat {
        let safeHeight = max(0, screenHeight - safeAreaInsets.top - safeAreaInsets.bottom)
        // Keep the preview low enough to expose the map while scaling naturally
        // across compact and tall phones. Include the home-indicator inset so the
        // visible content height remains stable on every device family.
        let proposedHeight = safeHeight * 0.37 + safeAreaInsets.bottom
        return min(maximumDetentValue, max(320, min(360, proposedHeight)))
    }

    static func applySharedChrome(to sheet: UISheetPresentationController) {
        AlmidySheetConfiguration.overview.apply(to: sheet)
    }

    /// Full-height child sheets use the same expanded geometry as the My Trips
    /// surface. Keeping this in one place prevents individual destinations from
    /// acquiring slightly different heights as their presentation code evolves.
    static func applyMyTripsExpandedHeight(to sheet: UISheetPresentationController) {
        sheet.detents = [UISheetPresentationController.Detent.large()]
        sheet.selectedDetentIdentifier = .large
        sheet.prefersEdgeAttachedInCompactHeight = true
        sheet.widthFollowsPreferredContentSizeWhenEdgeAttached = true
    }

    private static var activeSafeAreaInsets: UIEdgeInsets {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)
            ?? scenes.flatMap(\.windows).first
        return window?.safeAreaInsets ?? .zero
    }
}

private final class NativeActivityNavigationController: UINavigationController {
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override var childForStatusBarStyle: UIViewController? { nil }
}

final class NativeTripOverviewViewController: UIViewController, UIScrollViewDelegate {
    static let collapsedDetentIdentifier = UISheetPresentationController.Detent.Identifier("trip-overview-collapsed")
    static let fullyCollapsedDetentIdentifier = UISheetPresentationController.Detent.Identifier("trip-overview-fully-collapsed")

    private let userID: String
    private let tripID: String
    private let seed: NativeTripOverviewSeed?
    private let seedImage: UIImage?
    private let store: NativeTripOverviewStore
    private lazy var tripManager = NativeTripStore(webView: nil)
    private lazy var transportationClient = NativeTransportationActivityAPIClient(webView: nil)
    var router: NativeTripOverviewRouting?

    private var expandedHeaderHeight: CGFloat {
        traitCollection.preferredContentSizeCategory.isAccessibilityCategory
            ? AlmidyDesignTokens.TripOverview.accessibilityExpandedHeaderHeight
            : AlmidyDesignTokens.TripOverview.expandedHeaderHeight
    }
    private var compactHeaderHeight: CGFloat {
        traitCollection.preferredContentSizeCategory.isAccessibilityCategory
            ? AlmidyDesignTokens.TripOverview.accessibilityCompactHeaderHeight
            : AlmidyDesignTokens.TripOverview.compactHeaderHeight
    }
    private let backgroundGradient = CAGradientLayer()
    private let heroBackdropView = UIView()
    private let heroBackdropImageView = NativeTripOverviewFocalImageView()
    private let heroBackdropGradientView = NativeTripOverviewGradientView()
    private let heroBackdropTerminalView = UIView()
    private let headerView = NativeTripOverviewHeaderView()
    private let scrollView = UIScrollView()
    private let scrollOcclusionMask = CAGradientLayer()
    private let contentStack = UIStackView()
    private let heroSpacer = UIView()
    private let actionsView = NativeTripOverviewActionsView()
    private let itineraryView = NativeTripOverviewItineraryCard()
    private let documentsView = NativeTripOverviewDocumentsCard()
    private let expensesView = NativeTripOverviewExpensesCard()
    private let emailForwardingView = NativeTripOverviewEmailForwardingCard()
    private let inviteGuestsView = NativeTripOverviewInviteGuestsCard()
    private let recentView = NativeTripOverviewRecentCard()
    private let customizeContainer = UIView()
    private let customizeButton = UIButton(type: .system)
    private let statusLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let retryButton = UIButton(type: .system)
    private let signInButton = UIButton(type: .system)
    private var headerHeightConstraint: NSLayoutConstraint!
    private var heroSpacerHeightConstraint: NSLayoutConstraint!
    private var actionsRegionHeightConstraint: NSLayoutConstraint!
    private var contentLeadingConstraint: NSLayoutConstraint!
    private var contentTrailingConstraint: NSLayoutConstraint!
    private var contentWidthConstraint: NSLayoutConstraint!
    private var latestOverview: NativeTripOverview?
    private var shouldRestoreOverviewFocus = true
    private var hasUserScrolledOverview = false
    private var expandedTitleInitialCenterY: CGFloat?
    private var compactTitleTargetCenterY: CGFloat?
    private lazy var customization = NativeTripOverviewCustomizationStore.load(tripID: tripID)
    var tripOverviewID: String { tripID }

    init(userID: String, tripID: String, seed: NativeTripOverviewSeed? = nil, seedImage: UIImage? = nil, store: NativeTripOverviewStore) {
        self.userID = userID; self.tripID = tripID; self.seed = seed; self.seedImage = seedImage; self.store = store
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()
        reload()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        backgroundGradient.frame = view.bounds
        updateScrollOcclusionMask()
        let geometry = headerView.stableTransitionGeometry(expandedHeaderHeight: expandedHeaderHeight)
        expandedTitleInitialCenterY = geometry.expandedCenterY
        compactTitleTargetCenterY = geometry.compactCenterY
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        applyUnifiedSheetChrome()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        headerView.setGrabberHidden(false)
        // UISheetPresentationController can finish installing its container chrome
        // after viewWillAppear. Reassert the full-bleed, single-grabber contract
        // against the final presentation controller so it cannot reserve a white
        // system-grabber band above the hero.
        applyUnifiedSheetChrome()
        applySelectedDetent(sheetPresentationController?.selectedDetentIdentifier, animated: false)
        guard shouldRestoreOverviewFocus else { return }
        shouldRestoreOverviewFocus = false
        UIAccessibility.post(notification: .screenChanged, argument: headerView.closeButton)
    }

    func configureForGlobePresentation() {
        modalPresentationStyle = .pageSheet
        modalPresentationCapturesStatusBarAppearance = true
        guard let sheet = sheetPresentationController else { return }
        let detents: [UISheetPresentationController.Detent]
        if #available(iOS 16.0, *) {
            let fullyCollapsed = UISheetPresentationController.Detent.custom(
                identifier: Self.fullyCollapsedDetentIdentifier
            ) { context in
            // The resolver height excludes part of the sheet container's
            // bottom chrome. About 196pt produces the compact ~224pt card
            // shown in the reference on home-indicator devices.
            min(context.maximumDetentValue, max(182, min(200, context.maximumDetentValue * 0.218)))
            }
            let collapsed = UISheetPresentationController.Detent.custom(
                identifier: Self.collapsedDetentIdentifier
            ) { context in
                // Keep the itinerary preview visible without letting the sheet
                // grow into a second medium-sized presentation.
                min(context.maximumDetentValue, max(339, min(365, context.maximumDetentValue * 0.41)))
            }
            detents = [fullyCollapsed, collapsed, .large()]
        } else {
            // iOS 15 does not expose custom detents; retain a useful compact
            // overview with its system medium detent.
            detents = [.medium(), .large()]
        }
        // The header owns a persistent luminance-adaptive grabber; UIKit's sheet
        // grabber cannot be tinted through public API.
        AlmidySheetConfiguration.overview.overriding(
            detents: detents,
            selectedDetentIdentifier: .large,
            largestUndimmedDetentIdentifier: .large
        ).apply(to: sheet)
    }

    func applySelectedDetent(
        _ identifier: UISheetPresentationController.Detent.Identifier?,
        animated: Bool
    ) {
        guard isViewLoaded else { return }
        let isExpanded = identifier == nil || identifier == .large
        let isFullyCollapsed = identifier == Self.fullyCollapsedDetentIdentifier
        let compactOffset = max(0, expandedHeaderHeight - compactHeaderHeight)
        let targetOffset = CGPoint(x: 0, y: isExpanded ? 0 : compactOffset)

        // Compact sheet sizes use the same condensed overview composition. The
        // detent height decides whether the itinerary preview is also visible.
        scrollView.isScrollEnabled = isExpanded
        itineraryView.setCompactPresentation(!isExpanded)
        // Preserve the card in the stack so compact offset geometry remains
        // stable, but do not render even its rounded top edge in the smallest
        // header-and-action-only detent.
        itineraryView.alpha = NativeTripOverviewDetentVisibility.itineraryAlpha(
            isFullyCollapsed: isFullyCollapsed
        )
        itineraryView.isUserInteractionEnabled = !isFullyCollapsed
        itineraryView.accessibilityElementsHidden = isFullyCollapsed
        [documentsView, expensesView, recentView].forEach {
            // Keep the arranged views in the stack so the scroll view retains
            // enough content height to hold its compact header offset. Removing
            // them from layout makes UIKit clamp the offset back to zero and
            // exposes the expanded hero in a compact detent.
            $0.isHidden = false
            $0.alpha = isExpanded ? 1 : 0
            $0.isUserInteractionEnabled = isExpanded
            $0.accessibilityElementsHidden = !isExpanded
        }
        guard scrollView.contentOffset != targetOffset else {
            scrollViewDidScroll(scrollView)
            return
        }
        if animated {
            UIView.animate(
                withDuration: 0.24,
                delay: 0,
                options: [.beginFromCurrentState, .curveEaseInOut]
            ) {
                self.scrollView.contentOffset = targetOffset
                self.scrollViewDidScroll(self.scrollView)
                self.view.layoutIfNeeded()
            }
        } else {
            scrollView.contentOffset = targetOffset
            scrollViewDidScroll(scrollView)
        }
    }

    var currentHeaderHeight: CGFloat { headerHeightConstraint?.constant ?? expandedHeaderHeight }
    var currentHeroSpacerHeight: CGFloat { heroSpacerHeightConstraint?.constant ?? expandedHeaderHeight }
    // The action region is transparent by design and inherits this effective
    // surface from the unified overview canvas.
    var currentActivitySurfaceColor: UIColor? { view.backgroundColor }
    var isActivityRegionTransparentForVerification: Bool { actionsView.backgroundColor == .clear }
    var currentCompactHeaderSurfaceColorForVerification: UIColor { headerView.compactSurfaceColorForVerification }
    var currentSheetSurfaceColorForVerification: UIColor { headerView.sheetSurfaceColorForVerification }
    var customGrabberCountForVerification: Int { headerView.customGrabberCount }
    var controlMinimumHitTargetsForVerification: [CGSize] { headerView.controlMinimumHitTargets }
    var headerAccessibilityReadingOrderForVerification: [String] { headerView.accessibilityReadingOrderLabels }
    var accessibleHeaderTitleCountForVerification: Int { headerView.accessibleTitleContainerCount }
    var expandedHeaderContentAlphaForVerification: CGFloat { headerView.expandedContentAlpha }
    var compactHeaderContentAlphaForVerification: CGFloat { headerView.compactContentAlpha }
    var currentScrollOffset: CGPoint { scrollView.contentOffset }
    var hasSignInRecovery: Bool { signInButton.superview != nil }
    var renderedHeroImageForVerification: UIImage? { headerView.renderedHeroImage }
    var visualVerificationSnapshot: NativeTripOverviewVisualVerificationSnapshot {
        view.layoutIfNeeded()
        return .init(
            statusBarStyle: preferredStatusBarStyle,
            headerSummary: headerView.activeSummaryAccessibilityLabel,
            actionKinds: actionsView.renderedActionKinds,
            itineraryValue: itineraryView.accessibilityValue,
            importedItemsValue: documentsView.accessibilityValue,
            expensesValue: expensesView.accessibilityValue,
            latestAddedValue: recentView.accessibilityValue,
            statusMessage: statusLabel.text,
            headerHeight: currentHeaderHeight,
            headerFrame: headerView.frame,
            scrollFrame: scrollView.frame,
            contentFrame: contentStack.frame,
            measuredFrames: measuredFramesForVerification()
        )
    }

    private func measuredFramesForVerification() -> [String: CGRect] {
        var frames: [String: CGRect] = [
            "trip-overview-measure-header": headerView.convert(headerView.bounds, to: view),
            "trip-overview-measure-header-image-focal-point": CGRect(
                origin: headerView.convert(headerView.heroFocalPointInBounds, to: view),
                size: .zero
            ),
            "trip-overview-measure-itinerary-card": itineraryView.convert(itineraryView.bounds, to: view),
            "trip-overview-measure-documents-card": documentsView.convert(documentsView.bounds, to: view),
            "trip-overview-measure-expenses-card": expensesView.convert(expensesView.bounds, to: view),
            "trip-overview-measure-latest-added-card": recentView.convert(recentView.bounds, to: view)
        ]
        func collect(_ candidate: UIView) {
            if let identifier = candidate.accessibilityIdentifier,
               identifier.hasPrefix("trip-overview-measure-") {
                frames[identifier] = candidate.convert(candidate.bounds, to: view)
            }
            candidate.subviews.forEach(collect)
        }
        collect(view)
        return frames
    }

    func setScrollOffsetForTesting(_ offset: CGPoint) {
        scrollView.contentOffset = offset
        scrollViewDidScroll(scrollView)
    }

    func renderForTesting(_ state: NativeTripOverviewViewState) { render(state) }

    func refreshAfterHandoff() {
        shouldRestoreOverviewFocus = true
        reload()
    }

    private func configureView() {
        view.accessibilityIdentifier = "trip-overview-sheet"
        view.layer.cornerRadius = AlmidyDesignTokens.Component.TripOverview.sheetCornerRadius
        view.layer.cornerCurve = .continuous
        view.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        view.layer.masksToBounds = true
        view.backgroundColor = AlmidyDesignTokens.Color.generatedTripImageBase
        backgroundGradient.colors = [
            AlmidyDesignTokens.Color.generatedTripGradientStart.cgColor,
            AlmidyDesignTokens.Color.generatedTripGradientEnd.cgColor
        ]
        backgroundGradient.startPoint = CGPoint(x: 0.5, y: 0); backgroundGradient.endPoint = CGPoint(x: 0.5, y: 1)
        view.layer.insertSublayer(backgroundGradient, at: 0)

        scrollView.delegate = self; scrollView.alwaysBounceVertical = true
        scrollView.showsVerticalScrollIndicator = false
        scrollView.accessibilityIdentifier = "trip-overview-scroll-view"
        scrollView.contentInsetAdjustmentBehavior = .never
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollOcclusionMask.colors = [
            UIColor.clear.cgColor,
            UIColor.clear.cgColor,
            UIColor.white.cgColor,
            UIColor.white.cgColor,
        ]
        scrollOcclusionMask.startPoint = CGPoint(x: 0.5, y: 0)
        scrollOcclusionMask.endPoint = CGPoint(x: 0.5, y: 1)
        scrollView.layer.mask = scrollOcclusionMask
        contentStack.axis = .vertical
        contentStack.spacing = AlmidyDesignTokens.TripOverview.interCardGap
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        heroSpacer.translatesAutoresizingMaskIntoConstraints = false
        contentStack.addArrangedSubview(heroSpacer)
        contentStack.addArrangedSubview(statusLabel); contentStack.addArrangedSubview(spinner)
        contentStack.addArrangedSubview(actionsView); contentStack.addArrangedSubview(itineraryView)
        contentStack.addArrangedSubview(documentsView); contentStack.addArrangedSubview(expensesView)
        contentStack.addArrangedSubview(emailForwardingView); contentStack.addArrangedSubview(inviteGuestsView)
        contentStack.addArrangedSubview(recentView)
        contentStack.addArrangedSubview(customizeContainer)
        view.addSubview(scrollView); scrollView.addSubview(contentStack)

        headerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(headerView)
        headerHeightConstraint = headerView.heightAnchor.constraint(equalToConstant: expandedHeaderHeight)
        heroSpacerHeightConstraint = heroSpacer.heightAnchor.constraint(equalToConstant: expandedHeaderHeight)
        actionsRegionHeightConstraint = actionsView.heightAnchor.constraint(
            equalToConstant: AlmidyDesignTokens.TripOverview.expandedActionRegionHeight
        )
        // Accessibility text may legitimately require more height; standard sizes
        // stay locked to the approved sheet-to-Itinerary composition budget.
        actionsRegionHeightConstraint.priority = .defaultHigh
        retryButton.setTitle("Try Again", for: .normal); retryButton.addTarget(self, action: #selector(reload), for: .touchUpInside)
        retryButton.tintColor = AlmidyDesignTokens.Color.gold
        retryButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        signInButton.setTitle("Sign In", for: .normal); signInButton.addTarget(self, action: #selector(recoverAuthentication), for: .touchUpInside)
        signInButton.tintColor = AlmidyDesignTokens.Color.gold
        signInButton.accessibilityHint = "Signs in and refreshes this trip overview"
        signInButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        statusLabel.numberOfLines = 0; statusLabel.textAlignment = .center; statusLabel.textColor = .white
        statusLabel.accessibilityIdentifier = "trip-overview-status"
        headerView.closeButton.addTarget(self, action: #selector(close), for: .touchUpInside)
        headerView.searchButton.addTarget(self, action: #selector(search), for: .touchUpInside)
        headerView.moreButton.menu = makeMoreMenu()
        headerView.moreButton.showsMenuAsPrimaryAction = true
        headerView.onBackgroundColor = { [weak self] color in self?.applyBackground(color) }
        headerView.onHeroContinuation = { [weak self] image, transition, sheet in
            guard let self else { return }
            heroBackdropImageView.setHeroImage(image)
            heroBackdropGradientView.colors = NativeTripOverviewHeroGradient.colors(
                transition: transition,
                sheet: sheet,
                increasedContrast: traitCollection.accessibilityContrast == .high
            )
            heroBackdropTerminalView.backgroundColor = sheet
        }
        actionsView.onAction = { [weak self] action in
            if action.kind == .newActivity {
                self?.presentNewActivity()
            } else {
                self?.router?.route(action)
            }
        }
        itineraryView.onOpen = { [weak self] in self?.presentItinerary() }
        itineraryView.onNewActivity = { [weak self] in
            self?.presentNewActivity()
        }
        documentsView.onOpen = { [weak self] in self?.routeCard(.importedItems) }
        expensesView.onOpen = { [weak self] in self?.routeCard(.expenses) }
        emailForwardingView.onManage = { [weak self] in self?.routeCard(.importedItems) }
        emailForwardingView.onDismiss = { [weak self] in self?.emailForwardingView.isHidden = true }
        inviteGuestsView.onShare = { [weak self] in self?.performTripMenuAction(.shareTrip) }
        inviteGuestsView.onDismiss = { [weak self] in self?.inviteGuestsView.isHidden = true }
        [itineraryView, documentsView, expensesView].forEach { $0.onRetry = { [weak self] in self?.reload() } }
        recentView.onRetry = { [weak self] in self?.reload() }
        configureCustomizeButton()

        contentLeadingConstraint = contentStack.leadingAnchor.constraint(
            equalTo: scrollView.contentLayoutGuide.leadingAnchor,
            constant: AlmidyDesignTokens.TripOverview.outerHorizontalInset
        )
        contentTrailingConstraint = contentStack.trailingAnchor.constraint(
            equalTo: scrollView.contentLayoutGuide.trailingAnchor,
            constant: -AlmidyDesignTokens.TripOverview.outerHorizontalInset
        )
        contentWidthConstraint = contentStack.widthAnchor.constraint(
            equalTo: scrollView.frameLayoutGuide.widthAnchor,
            constant: -(AlmidyDesignTokens.TripOverview.outerHorizontalInset * 2)
        )
        NSLayoutConstraint.activate([
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor), scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.topAnchor.constraint(equalTo: view.topAnchor), scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            contentLeadingConstraint,
            contentTrailingConstraint,
            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -AlmidyDesignTokens.TripOverview.bottomBreathingRoom),
            contentWidthConstraint,
            heroSpacerHeightConstraint,
            actionsRegionHeightConstraint,
            headerView.leadingAnchor.constraint(equalTo: view.leadingAnchor), headerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerView.topAnchor.constraint(equalTo: view.topAnchor), headerHeightConstraint
        ])
        contentStack.setCustomSpacing(0, after: heroSpacer)
        configureContinuousHeroBackdrop()
        view.bringSubviewToFront(headerView)
        if let seed { headerView.render(seed: seed, image: seedImage) }
        applyCustomization()
    }

    private func configureCustomizeButton() {
        customizeContainer.translatesAutoresizingMaskIntoConstraints = false
        customizeContainer.heightAnchor.constraint(equalToConstant: 116).isActive = true
        customizeButton.translatesAutoresizingMaskIntoConstraints = false
        var configuration = UIButton.Configuration.gray()
        configuration.title = "Customize"
        configuration.image = UIImage(systemName: "slider.horizontal.3")
        configuration.imagePadding = 10
        configuration.cornerStyle = .capsule
        configuration.baseForegroundColor = .label
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 13, leading: 22, bottom: 13, trailing: 22)
        customizeButton.configuration = configuration
        customizeButton.titleLabel?.font = .preferredFont(forTextStyle: .title3)
        customizeButton.accessibilityIdentifier = "trip-overview-customize"
        customizeButton.addTarget(self, action: #selector(presentCustomization), for: .touchUpInside)
        customizeContainer.addSubview(customizeButton)
        NSLayoutConstraint.activate([
            customizeButton.centerXAnchor.constraint(equalTo: customizeContainer.centerXAnchor),
            customizeButton.topAnchor.constraint(equalTo: customizeContainer.topAnchor, constant: 18),
            customizeButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 52)
        ])
    }

    @objc private func presentCustomization() {
        let controller = NativeTripOverviewCustomizeViewController(customization: customization)
        controller.onSave = { [weak self, weak controller] customization in
            guard let self else { return }
            self.customization = customization
            NativeTripOverviewCustomizationStore.save(customization, tripID: self.tripID)
            self.applyCustomization()
            controller?.dismiss(animated: true)
        }
        controller.modalPresentationStyle = .pageSheet
        if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
            sheet.prefersGrabberVisible = false
            sheet.preferredCornerRadius = 34
        }
        present(controller, animated: true)
    }

    private func applyCustomization() {
        headerView.setShowsCountryFlag(customization.showsCountryFlags)
        let views: [NativeTripOverviewWidget: UIView] = [
            .nextActivity: actionsView,
            .itinerary: itineraryView,
            .documents: documentsView,
            .expenses: expensesView,
            .latestAdded: recentView
        ]
        views.values.forEach { contentStack.removeArrangedSubview($0); $0.removeFromSuperview() }
        var insertionIndex = (contentStack.arrangedSubviews.firstIndex(of: spinner) ?? 2) + 1
        customization.widgets.forEach { widget in
            guard let widgetView = views[widget] else { return }
            contentStack.insertArrangedSubview(widgetView, at: insertionIndex)
            insertionIndex += 1
        }
    }

    private func configureContinuousHeroBackdrop() {
        heroBackdropView.isUserInteractionEnabled = false
        heroBackdropView.accessibilityIdentifier = "trip-overview-measure-continuous-hero"
        heroBackdropView.translatesAutoresizingMaskIntoConstraints = false
        heroBackdropImageView.translatesAutoresizingMaskIntoConstraints = false
        heroBackdropGradientView.translatesAutoresizingMaskIntoConstraints = false
        heroBackdropView.addSubview(heroBackdropImageView)
        heroBackdropView.addSubview(heroBackdropGradientView)
        heroBackdropView.insertSubview(heroBackdropTerminalView, at: 0)
        heroBackdropTerminalView.translatesAutoresizingMaskIntoConstraints = false
        view.insertSubview(heroBackdropView, belowSubview: scrollView)
        NSLayoutConstraint.activate([
            heroBackdropView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            heroBackdropView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            heroBackdropView.topAnchor.constraint(equalTo: view.topAnchor),
            heroBackdropView.heightAnchor.constraint(
                equalToConstant: AlmidyDesignTokens.TripOverview.expandedItineraryTopBaseline + 8
            ),
            heroBackdropImageView.leadingAnchor.constraint(equalTo: heroBackdropView.leadingAnchor),
            heroBackdropImageView.trailingAnchor.constraint(equalTo: heroBackdropView.trailingAnchor),
            heroBackdropImageView.topAnchor.constraint(equalTo: heroBackdropView.topAnchor),
            // Preserve the approved image crop. Only the opaque terminal wash
            // continues through the gap and beneath the Itinerary card.
            heroBackdropImageView.heightAnchor.constraint(
                equalToConstant: AlmidyDesignTokens.TripOverview.expandedItineraryTopBaseline
                    - AlmidyDesignTokens.TripOverview.interCardGap
            ),
            heroBackdropGradientView.leadingAnchor.constraint(equalTo: heroBackdropView.leadingAnchor),
            heroBackdropGradientView.trailingAnchor.constraint(equalTo: heroBackdropView.trailingAnchor),
            heroBackdropGradientView.topAnchor.constraint(equalTo: heroBackdropView.topAnchor),
            heroBackdropGradientView.heightAnchor.constraint(
                equalToConstant: AlmidyDesignTokens.TripOverview.expandedItineraryTopBaseline
                    - AlmidyDesignTokens.TripOverview.interCardGap
            ),
            heroBackdropTerminalView.leadingAnchor.constraint(equalTo: heroBackdropView.leadingAnchor),
            heroBackdropTerminalView.trailingAnchor.constraint(equalTo: heroBackdropView.trailingAnchor),
            heroBackdropTerminalView.topAnchor.constraint(equalTo: heroBackdropGradientView.bottomAnchor),
            heroBackdropTerminalView.bottomAnchor.constraint(equalTo: heroBackdropView.bottomAnchor)
        ])
        headerView.setUsesExternalHeroBackdrop(true)
    }

    private func applyUnifiedSheetChrome() {
        guard let sheet = sheetPresentationController else { return }
        // UIKit's grabber would create a second chrome band above the hero. The
        // luminance-aware handle inside the header is the single source of truth.
        sheet.prefersGrabberVisible = false
        sheet.preferredCornerRadius = AlmidyDesignTokens.TripOverview.sheetCornerRadius
        guard let container = presentationController?.containerView else { return }
        container.backgroundColor = .clear
        // Changing grabber visibility after UIKit has installed the final sheet
        // hierarchy does not always invalidate its reserved chrome immediately.
        // Force that public container through a layout pass so the presented view
        // reclaims the former grabber band and the hero reaches the rounded edge.
        UIView.performWithoutAnimation {
            container.setNeedsLayout()
            container.layoutIfNeeded()
            view.setNeedsLayout()
            view.layoutIfNeeded()
        }
    }

    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        updateScrollOcclusionMask()
        let distance = expandedHeaderHeight - compactHeaderHeight
        let offset = max(0, scrollView.contentOffset.y)
        let selectedDetent = sheetPresentationController?.selectedDetentIdentifier
        let isExpandedDetent = selectedDetent == nil || selectedDetent == .large
        // One deterministic master timeline comes from the untransformed title's
        // travel to the fixed compact-title position. Compact detents are explicit
        // endpoint compositions and do not depend on their synthetic scroll offset.
        let rawProgress: CGFloat
        if isExpandedDetent,
           let expandedTitleInitialCenterY,
           let compactTitleTargetCenterY {
            rawProgress = NativeTripOverviewTitleCollisionTransition.progress(
                offset: offset,
                initialCenterY: expandedTitleInitialCenterY,
                targetCenterY: compactTitleTargetCenterY
            )
        } else {
            rawProgress = isExpandedDetent ? min(1, offset / max(distance, 1)) : 1
        }
        let transition = NativeTripOverviewHeaderTransition(
            progress: rawProgress,
            reduceMotion: UIAccessibility.isReduceMotionEnabled
        )
        // Scrolling in the large detent is purely a presentation transition. The
        // header keeps stable layout coordinates; only a sheet detent change is
        // allowed to alter its physical height.
        headerHeightConstraint.constant = NativeTripOverviewHeaderStructure.height(
            expandedHeight: expandedHeaderHeight,
            compactHeight: compactHeaderHeight,
            isExpandedDetent: isExpandedDetent
        )
        let collapsedDownshift = AlmidyDesignTokens.TripOverview.CollapsedComposition
            .contentFlowDownshift(for: max(view.bounds.width, 1))
        // Normal expanded-sheet scrolling owns card movement; changing this
        // spacer at the same time counteracts the gesture and makes the Itinerary
        // appear to resist moving toward the header. Compact detents retain their
        // separately tuned downshift composition.
        heroSpacerHeightConstraint.constant = NativeTripOverviewHeroSpacer.height(
            expandedHeight: expandedHeaderHeight,
            compactDownshift: collapsedDownshift,
            transitionProgress: transition.easedProgress,
            isExpandedDetent: isExpandedDetent
        )
        // Cards keep their expanded composition during ordinary scrolling. Only
        // a compact sheet detent is allowed to apply the alternate card chrome.
        let contentChromeProgress = NativeTripOverviewContentChrome.progress(
            transitionProgress: transition.easedProgress,
            isExpandedDetent: isExpandedDetent
        )
        let expandedActionHeight = AlmidyDesignTokens.TripOverview.expandedActionRegionHeight
        let collapsedActionHeight = AlmidyDesignTokens.TripOverview.CollapsedComposition.activityRegionHeight
        actionsRegionHeightConstraint.constant = expandedActionHeight
            + (collapsedActionHeight - expandedActionHeight) * contentChromeProgress
        let expandedInset = AlmidyDesignTokens.TripOverview.outerHorizontalInset
        let collapsedInset = AlmidyDesignTokens.TripOverview.CollapsedComposition.outerHorizontalInset
        let currentInset = expandedInset + (collapsedInset - expandedInset) * contentChromeProgress
        contentLeadingConstraint.constant = currentInset
        contentTrailingConstraint.constant = -currentInset
        contentWidthConstraint.constant = -(currentInset * 2)
        let expandedRadius = AlmidyDesignTokens.TripOverview.cardCornerRadius
        let collapsedRadius = AlmidyDesignTokens.TripOverview.CollapsedComposition.cardCornerRadius
        let currentRadius = expandedRadius + (collapsedRadius - expandedRadius) * contentChromeProgress
        [
            itineraryView,
            documentsView,
            expensesView,
            recentView,
            emailForwardingView,
            inviteGuestsView,
        ].forEach {
            $0.layer.cornerRadius = currentRadius
        }
        headerView.updateTransition(
            progress: rawProgress,
            expandedContentOffset: isExpandedDetent ? offset : 0
        )
        actionsView.updateTransition(progress: contentChromeProgress)
        let washProgress = NativeTripOverviewHeroGradient.washProgress(progress: rawProgress)
        heroBackdropGradientView.locations = NativeTripOverviewHeroGradient.locations(progress: washProgress)
        // Fade only the photograph. The gradient and terminal surface must remain
        // fully present after the image ghosts out or the sheet background leaks
        // through and the reference's neutral wash disappears with the photo.
        heroBackdropView.alpha = 1
        heroBackdropImageView.alpha = NativeTripOverviewHeroGradient.imageAlpha(progress: rawProgress)
        let collisionDistance = NativeTripOverviewTitleCollisionTransition.distance(
            initialCenterY: expandedTitleInitialCenterY ?? expandedHeaderHeight,
            targetCenterY: compactTitleTargetCenterY ?? compactHeaderHeight
        )
        heroBackdropImageView.transform = .identity
        heroBackdropImageView.setVerticalContentTranslation(NativeTripOverviewHeroParallax.translation(
            offset: offset,
            collapseDistance: collisionDistance,
            reduceMotion: UIAccessibility.isReduceMotionEnabled
        ))
    }

    private func updateScrollOcclusionMask() {
        guard scrollView.bounds.height > 0 else { return }
        // UIScrollView changes its bounds origin while scrolling. Following that
        // origin keeps this fade fixed to the visible sheet instead of letting it
        // travel with the cards it is masking.
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        scrollOcclusionMask.frame = scrollView.bounds
        scrollOcclusionMask.locations = NativeTripOverviewScrollOcclusion.locations(
            viewportHeight: scrollView.bounds.height
        )
        CATransaction.commit()
    }

    func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
        hasUserScrolledOverview = true
    }

    @objc private func reload() {
        store.load(userID: userID, tripID: tripID) { [weak self] state in self?.render(state) }
    }

    @objc private func close() { router?.close() }
    @objc private func recoverAuthentication() { router?.recoverAuthentication() }

    private func presentItinerary() {
        guard presentedViewController == nil,
              let peerPresenter = presentingViewController,
              let overview = latestOverview,
              let startDate = tripDate(overview.trip.startDate),
              let endDate = tripDate(overview.trip.endDate) ?? tripDate(overview.trip.startDate) else { return }
        weak var itinerarySheet: NativeItineraryViewController?
        let controller = NativeItineraryViewController(
            tripID: tripID,
            tripTitle: overview.trip.title,
            startDate: startDate,
            endDate: endDate,
            onAddActivity: { [weak self] in
                guard let self, let itinerarySheet else { return }
                itinerarySheet.dismiss(animated: true) {
                    // New Activity still originates from Trip Overview. Restore
                    // that coordinator without animation, then continue into
                    // the activity flow without visually stacking sheets.
                    peerPresenter.present(self, animated: false) {
                        self.presentNewActivity()
                    }
                }
            },
            onEditFlight: { [weak self] item in
                guard let self, let itinerarySheet else { return }
                var draft = item.draft
                draft.tripID = self.tripID
                weak var editor: NativeManualFlightRouteViewController?
                let form = NativeManualFlightRouteViewController(
                    accent: AlmidyDesignTokens.Color.goldDark,
                    transportKind: draft.kind,
                    tripID: self.tripID,
                    initialDraft: draft,
                    onSubmitFlight: { [weak self] updatedDraft, completion in
                        guard let self else { return }
                        self.transportationClient.update(updatedDraft, itemID: item.id) { [weak self] result in
                            if case .success = result, let self {
                                self.store.clearCache(userID: self.userID, tripID: self.tripID)
                                self.reload()
                            }
                            completion(result)
                        }
                    },
                    onFlightSaved: {
                        editor?.dismiss(animated: true) { itinerarySheet.reload() }
                    }
                )
                editor = form
                form.modalPresentationStyle = .pageSheet
                if let sheet = form.sheetPresentationController {
                    NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                    sheet.prefersGrabberVisible = false
                    sheet.preferredCornerRadius = AlmidyDesignTokens.TripOverview.sheetCornerRadius
                }
                itinerarySheet.present(form, animated: true)
            },
            onClose: { [weak self, weak peerPresenter] in
                guard let self, let peerPresenter,
                      peerPresenter.presentedViewController == nil else { return }
                // Itinerary is a peer sheet, but closing it returns to the
                // originating Trip Overview instead of ending the whole trip
                // flow on the bare globe.
                peerPresenter.present(self, animated: true)
            }
        )
        itinerarySheet = controller
        controller.retainedSourceController = self
        controller.modalPresentationStyle = .pageSheet
        controller.modalPresentationCapturesStatusBarAppearance = true
        if let sheet = controller.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = AlmidyDesignTokens.TripOverview.sheetCornerRadius
            sheet.prefersScrollingExpandsWhenScrolledToEdge = false
        }
        controller.presentationController?.delegate = controller
        dismiss(animated: true) {
            peerPresenter.present(controller, animated: true)
        }
    }

    private func tripDate(_ value: String?) -> Date? {
        guard let value else { return nil }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = NativeTimeZonePreference.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value)
    }

    @objc private func search() {
        guard let overview = latestOverview else { return }
        let search = NativeTripSavedSearchViewController(
            tripID: tripID,
            overview: overview,
            onOpenItem: { [weak self] url in
                let action = NativeTripOverviewAction(
                    kind: .places,
                    label: "Open saved item",
                    destination: .webHandoff(url)
                )
                self?.router?.route(action)
            },
            onAddActivity: { [weak self] in
                self?.presentNewActivity()
            }
        )
        search.modalPresentationStyle = .pageSheet
        search.modalPresentationCapturesStatusBarAppearance = true
        if let sheet = search.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = AlmidyDesignTokens.TripOverview.sheetCornerRadius
            sheet.prefersScrollingExpandsWhenScrolledToEdge = false
        }
        present(search, animated: true)
    }

    private func presentNewActivity() {
        guard presentedViewController == nil else { return }
        guard let router else { return }
        guard latestOverview?.actions.contains(where: {
            $0.kind == .newActivity && $0.isAvailable
        }) == true else { return }
        let presenter = presentingViewController
        let mapPresenter = presenter as? NativeMapViewController
        weak var pickerToDismiss: UIViewController?
        weak var activityPicker: NativeNewActivityViewController?
        let picker = NativeNewActivityViewController(
            tripID: tripID,
            onSelect: { category in
                let submitTransportation: NativeFlightDraftSubmission = { [weak self] draft, completion in
                    guard let self else { return }
                    self.transportationClient.save(draft) { [weak self] result in
                        if case .success = result, let self {
                            self.store.clearCache(userID: self.userID, tripID: self.tripID)
                            self.reload()
                        }
                        completion(result)
                    }
                }
                let finishTransportation: () -> Void = {
                    pickerToDismiss?.dismiss(animated: true)
                }
                if category.name.localizedCaseInsensitiveCompare("Flights") == .orderedSame
                    || category.name.localizedCaseInsensitiveCompare("Flight") == .orderedSame {
                    let flightSearch = NativeFlightSearchViewController(
                        accent: category.palette.tint,
                        tripID: self.tripID,
                        onSubmitFlight: submitTransportation,
                        onFlightSaved: finishTransportation
                    )
                    flightSearch.modalPresentationStyle = .pageSheet
                    flightSearch.modalPresentationCapturesStatusBarAppearance = true
                    if let sheet = flightSearch.sheetPresentationController {
                        NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                        sheet.prefersGrabberVisible = false
                        sheet.preferredCornerRadius = 36
                        sheet.prefersScrollingExpandsWhenScrolledToEdge = false
                    }
                    pickerToDismiss?.present(flightSearch, animated: true)
                    return
                }
                if category.name.localizedCaseInsensitiveCompare("Car") == .orderedSame {
                    let carRoute = NativeManualFlightRouteViewController(
                        accent: category.palette.tint,
                        isCarRoute: true,
                        nearbyCoordinate: mapPresenter?.activityRouteNearbyCoordinate,
                        tripID: self.tripID,
                        onSubmitFlight: submitTransportation,
                        onFlightSaved: finishTransportation
                    )
                    carRoute.modalPresentationStyle = .pageSheet
                    carRoute.modalPresentationCapturesStatusBarAppearance = true
                    if let sheet = carRoute.sheetPresentationController {
                        NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                        sheet.prefersGrabberVisible = false
                        sheet.preferredCornerRadius = 34
                        sheet.prefersScrollingExpandsWhenScrolledToEdge = false
                    }
                    pickerToDismiss?.present(carRoute, animated: true)
                    return
                }
                if category.name.localizedCaseInsensitiveCompare("Train") == .orderedSame {
                    let trainRoute = NativeManualFlightRouteViewController(
                        accent: category.palette.tint,
                        isTrainRoute: true,
                        nearbyCoordinate: mapPresenter?.activityRouteNearbyCoordinate,
                        tripID: self.tripID,
                        onSubmitFlight: submitTransportation,
                        onFlightSaved: finishTransportation
                    )
                    trainRoute.modalPresentationStyle = .pageSheet
                    trainRoute.modalPresentationCapturesStatusBarAppearance = true
                    if let sheet = trainRoute.sheetPresentationController {
                        NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                        sheet.prefersGrabberVisible = false
                        sheet.preferredCornerRadius = 34
                        sheet.prefersScrollingExpandsWhenScrolledToEdge = false
                    }
                    pickerToDismiss?.present(trainRoute, animated: true)
                    return
                }
                if category.name.localizedCaseInsensitiveCompare("Car Rental") == .orderedSame {
                    let carRental = NativeManualFlightRouteViewController(
                        accent: category.palette.tint,
                        isCarRental: true,
                        nearbyCoordinate: mapPresenter?.activityRouteNearbyCoordinate,
                        tripID: self.tripID,
                        onSubmitFlight: submitTransportation,
                        onFlightSaved: finishTransportation
                    )
                    carRental.modalPresentationStyle = .pageSheet
                    carRental.modalPresentationCapturesStatusBarAppearance = true
                    if let sheet = carRental.sheetPresentationController {
                        NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                        sheet.prefersGrabberVisible = false
                        sheet.preferredCornerRadius = 34
                        sheet.prefersScrollingExpandsWhenScrolledToEdge = false
                    }
                    pickerToDismiss?.present(carRental, animated: true)
                    return
                }
                if category.name.localizedCaseInsensitiveCompare("Transfer") == .orderedSame {
                    let transferRoute = NativeManualFlightRouteViewController(
                        accent: category.palette.tint,
                        isTransferRoute: true,
                        nearbyCoordinate: mapPresenter?.activityRouteNearbyCoordinate,
                        tripID: self.tripID,
                        onSubmitFlight: submitTransportation,
                        onFlightSaved: finishTransportation
                    )
                    transferRoute.modalPresentationStyle = .pageSheet
                    transferRoute.modalPresentationCapturesStatusBarAppearance = true
                    if let sheet = transferRoute.sheetPresentationController {
                        NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                        sheet.prefersGrabberVisible = false
                        sheet.preferredCornerRadius = 34
                        sheet.prefersScrollingExpandsWhenScrolledToEdge = false
                    }
                    pickerToDismiss?.present(transferRoute, animated: true)
                    return
                }
                if category.name.localizedCaseInsensitiveCompare("Cruise") == .orderedSame {
                    let cruiseRoute = NativeManualFlightRouteViewController(
                        accent: category.palette.tint,
                        isCruiseRoute: true,
                        nearbyCoordinate: mapPresenter?.activityRouteNearbyCoordinate,
                        tripID: self.tripID,
                        onSubmitFlight: submitTransportation,
                        onFlightSaved: finishTransportation
                    )
                    cruiseRoute.modalPresentationStyle = .pageSheet
                    cruiseRoute.modalPresentationCapturesStatusBarAppearance = true
                    if let sheet = cruiseRoute.sheetPresentationController {
                        NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                        sheet.prefersGrabberVisible = false
                        sheet.preferredCornerRadius = 34
                        sheet.prefersScrollingExpandsWhenScrolledToEdge = false
                    }
                    pickerToDismiss?.present(cruiseRoute, animated: true)
                    return
                }
                if category.name.localizedCaseInsensitiveCompare("Walk") == .orderedSame {
                    let walkRoute = NativeManualFlightRouteViewController(
                        accent: category.palette.tint,
                        isWalkRoute: true,
                        nearbyCoordinate: mapPresenter?.activityRouteNearbyCoordinate,
                        tripID: self.tripID,
                        onSubmitFlight: submitTransportation,
                        onFlightSaved: finishTransportation
                    )
                    walkRoute.modalPresentationStyle = .pageSheet
                    walkRoute.modalPresentationCapturesStatusBarAppearance = true
                    if let sheet = walkRoute.sheetPresentationController {
                        NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                        sheet.prefersGrabberVisible = false
                        sheet.preferredCornerRadius = 34
                        sheet.prefersScrollingExpandsWhenScrolledToEdge = false
                    }
                    pickerToDismiss?.present(walkRoute, animated: true)
                    return
                }
                if category.name.localizedCaseInsensitiveCompare("Bus") == .orderedSame {
                    let busRoute = NativeManualFlightRouteViewController(
                        accent: category.palette.tint,
                        isBusRoute: true,
                        nearbyCoordinate: mapPresenter?.activityRouteNearbyCoordinate,
                        tripID: self.tripID,
                        onSubmitFlight: submitTransportation,
                        onFlightSaved: finishTransportation
                    )
                    busRoute.modalPresentationStyle = .pageSheet
                    busRoute.modalPresentationCapturesStatusBarAppearance = true
                    if let sheet = busRoute.sheetPresentationController {
                        NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                        sheet.prefersGrabberVisible = false
                        sheet.preferredCornerRadius = 34
                        sheet.prefersScrollingExpandsWhenScrolledToEdge = false
                    }
                    pickerToDismiss?.present(busRoute, animated: true)
                    return
                }
                if category.name.localizedCaseInsensitiveCompare("Bike") == .orderedSame {
                    let bikeRoute = NativeManualFlightRouteViewController(
                        accent: category.palette.tint,
                        isBikeRoute: true,
                        nearbyCoordinate: mapPresenter?.activityRouteNearbyCoordinate,
                        tripID: self.tripID,
                        onSubmitFlight: submitTransportation,
                        onFlightSaved: finishTransportation
                    )
                    bikeRoute.modalPresentationStyle = .pageSheet
                    bikeRoute.modalPresentationCapturesStatusBarAppearance = true
                    if let sheet = bikeRoute.sheetPresentationController {
                        NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                        sheet.prefersGrabberVisible = false
                        sheet.preferredCornerRadius = 34
                        sheet.prefersScrollingExpandsWhenScrolledToEdge = false
                    }
                    pickerToDismiss?.present(bikeRoute, animated: true)
                    return
                }
                if category.name.localizedCaseInsensitiveCompare("Ferry") == .orderedSame {
                    let ferryRoute = NativeManualFlightRouteViewController(
                        accent: category.palette.tint,
                        isFerryRoute: true,
                        nearbyCoordinate: mapPresenter?.activityRouteNearbyCoordinate,
                        tripID: self.tripID,
                        onSubmitFlight: submitTransportation,
                        onFlightSaved: finishTransportation
                    )
                    ferryRoute.modalPresentationStyle = .pageSheet
                    ferryRoute.modalPresentationCapturesStatusBarAppearance = true
                    if let sheet = ferryRoute.sheetPresentationController {
                        NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                        sheet.prefersGrabberVisible = false
                        sheet.preferredCornerRadius = 34
                        sheet.prefersScrollingExpandsWhenScrolledToEdge = false
                    }
                    pickerToDismiss?.present(ferryRoute, animated: true)
                    return
                }
                if category.name.localizedCaseInsensitiveCompare("Motorcycle") == .orderedSame {
                    let motorcycleRoute = NativeManualFlightRouteViewController(
                        accent: category.palette.tint,
                        isMotorcycleRoute: true,
                        nearbyCoordinate: mapPresenter?.activityRouteNearbyCoordinate,
                        tripID: self.tripID,
                        onSubmitFlight: submitTransportation,
                        onFlightSaved: finishTransportation
                    )
                    motorcycleRoute.modalPresentationStyle = .pageSheet
                    motorcycleRoute.modalPresentationCapturesStatusBarAppearance = true
                    if let sheet = motorcycleRoute.sheetPresentationController {
                        NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                        sheet.prefersGrabberVisible = false
                        sheet.preferredCornerRadius = 34
                        sheet.prefersScrollingExpandsWhenScrolledToEdge = false
                    }
                    pickerToDismiss?.present(motorcycleRoute, animated: true)
                    return
                }
                mapPresenter?.cancelTripOverviewRestorationAfterActivity()
                pickerToDismiss?.dismiss(animated: true) {
                    router.route(category, tripID: self.tripID)
                }
            },
            onFilterChange: { category, query, nearby, region, results in
                router.filterGlobe(for: category, query: query, nearby: nearby, region: region, results: results)
            },
            onFilterClear: {
                router.clearGlobeActivityFilter()
            },
            onSelectFilteredResult: { category, query, nearby, region, results, selectedResultID in
                router.focusGlobeResult(
                    for: category,
                    query: query,
                    nearby: nearby,
                    region: region,
                    results: results,
                    selectedResultID: selectedResultID
                )
            },
            onEnterManually: {
                let location = NativeManualFlightRouteViewController(
                    accent: AlmidyDesignTokens.Color.goldDark,
                    isLocation: true,
                    nearbyCoordinate: mapPresenter?.activityRouteNearbyCoordinate
                )
                location.modalPresentationStyle = .pageSheet
                location.modalPresentationCapturesStatusBarAppearance = true
                if let sheet = location.sheetPresentationController {
                    NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
                    sheet.prefersGrabberVisible = false
                    sheet.preferredCornerRadius = 34
                    sheet.prefersScrollingExpandsWhenScrolledToEdge = false
                }
                pickerToDismiss?.present(location, animated: true)
            },
            onDismiss: {
                mapPresenter?.setActivityResultSelectionHandler(nil)
                mapPresenter?.setActivityResolvedPlaceHandler(nil)
                mapPresenter?.restoreTripOverviewAfterActivity(for: self.tripID)
            },
            initialSearchRegion: mapPresenter?.activitySearchRegion(for: tripID),
            nearbySearchRegion: mapPresenter?.nearbyActivitySearchRegion,
            initialSearchLocality: latestOverview?.trip.destination
                ?? mapPresenter?.activitySearchLocality(for: tripID)
        )
        let navigation = NativeActivityNavigationController(rootViewController: picker)
        activityPicker = picker
        mapPresenter?.setActivityResultSelectionHandler { resultID in
            if let resultID {
                activityPicker?.selectResult(withID: resultID)
            } else {
                activityPicker?.clearSelectedResult()
            }
        }
        mapPresenter?.setActivityResolvedPlaceHandler { resultID, mapItem in
            activityPicker?.replaceResult(withID: resultID, mapItem: mapItem)
        }
        mapPresenter?.prepareToRestoreTripOverviewAfterActivity(for: tripID)
        pickerToDismiss = navigation
        navigation.modalPresentationStyle = .pageSheet
        navigation.modalPresentationCapturesStatusBarAppearance = true
        if let sheet = navigation.sheetPresentationController {
            if #available(iOS 16.0, *) {
                let preview = UISheetPresentationController.Detent.custom(
                    identifier: NativeActivitySheetMetrics.previewIdentifier
                ) { context in
                    NativeActivitySheetMetrics.previewHeight(maximumDetentValue: context.maximumDetentValue)
                }
                sheet.detents = [preview, .large()]
            } else {
                sheet.detents = [.medium(), .large()]
            }
            sheet.selectedDetentIdentifier = .large
            // Keep the exposed globe live at both the preview and expanded
            // detents so gestures, controls, and result annotations receive taps.
            sheet.largestUndimmedDetentIdentifier = .large
            sheet.prefersGrabberVisible = true
            sheet.prefersScrollingExpandsWhenScrolledToEdge = false
            NativeActivitySheetMetrics.applySharedChrome(to: sheet)
        }
        navigation.presentationController?.delegate = mapPresenter
        guard let presenter else {
            present(navigation, animated: true)
            return
        }
        dismiss(animated: true) {
            presenter.present(navigation, animated: true)
        }
    }

    private func makeMoreMenu() -> UIMenu {
        func item(_ action: NativeTripOverviewMenuAction) -> UIAction {
            UIAction(
                title: action.title,
                image: UIImage(systemName: action.systemImage),
                attributes: action.isAvailable ? [] : [.disabled]
            ) { [weak self] _ in
                guard let self else { return }
                self.performTripMenuAction(action)
            }
        }

        let sections: [[NativeTripOverviewMenuAction]] = [
            [.shareTrip, .manageGuests],
            [.editName, .changeDates, .changeBackground],
            [.duplicateTrip, .mergeTrip],
            [.turnOffNotifications],
        ]
        return UIMenu(
            title: "Trip options",
            children: sections.map { section in
                UIMenu(options: .displayInline, children: section.map(item))
            }
        )
    }

    private func routeCard(_ destination: NativeTripOverviewMoreDestination) {
        router?.route(destination, tripID: tripID)
    }

    private func performTripMenuAction(_ action: NativeTripOverviewMenuAction) {
        switch action {
        case .manageGuests:
            // The sharing screen is already keyed by this overview's immutable
            // trip ID, so it is the one menu handoff that remains web-backed.
            router?.route(action, tripID: tripID)
        case .shareTrip, .editName, .changeDates, .changeBackground,
             .duplicateTrip, .mergeTrip, .turnOffNotifications:
            loadCurrentTrip { [weak self] trip, allTrips in
                self?.performTripMenuAction(action, trip: trip, allTrips: allTrips)
            }
        }
    }

    private func loadCurrentTrip(
        completion: @escaping (NativeMapTrip, [NativeMapTrip]) -> Void
    ) {
        tripManager.loadTrips { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                switch result {
                case .success(let trips):
                    guard let trip = trips.first(where: { $0.id == self.tripID }) else {
                        self.showTripMenuMessage(
                            "Trip Options",
                            message: "This trip could not be found. Refresh the overview and try again."
                        )
                        return
                    }
                    completion(trip, trips)
                case .failure(let error):
                    self.showTripMenuMessage("Trip Options", message: error.localizedDescription)
                }
            }
        }
    }

    private func performTripMenuAction(
        _ action: NativeTripOverviewMenuAction,
        trip: NativeMapTrip,
        allTrips: [NativeMapTrip]
    ) {
        // Guard the invariant at the mutation boundary as well as at lookup.
        guard trip.id == tripID else { return }
        switch action {
        case .shareTrip:
            share(trip)
        case .manageGuests:
            router?.route(action, tripID: trip.id)
        case .editName:
            presentEditor(for: trip, focus: .name)
        case .changeDates:
            presentEditor(for: trip, focus: .dates)
        case .changeBackground:
            presentEditor(for: trip, focus: .background)
        case .duplicateTrip:
            duplicate(trip)
        case .mergeTrip:
            chooseMergeTarget(for: trip, from: allTrips)
        case .turnOffNotifications:
            showTripMenuMessage(
                "Turn Off Notifications",
                message: "Trip-specific notification controls are not available yet. Notifications for \(trip.displayName) were not changed."
            )
        }
    }

    private func share(_ trip: NativeMapTrip) {
        tripManager.enableTripSharing(id: trip.id) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                switch result {
                case .success:
                    let url = NativeServiceConfiguration.appBaseURL
                        .appendingPathComponent("trip")
                        .appendingPathComponent(trip.id)
                    let activity = UIActivityViewController(
                        activityItems: ["Join my \(trip.displayName) trip on Almidy", url],
                        applicationActivities: nil
                    )
                    activity.popoverPresentationController?.sourceView = self.headerView.moreButton
                    activity.popoverPresentationController?.sourceRect = self.headerView.moreButton.bounds
                    self.present(activity, animated: true)
                case .failure(let error):
                    self.showTripMenuMessage("Share Trip", message: error.localizedDescription)
                }
            }
        }
    }

    private func presentEditor(for trip: NativeMapTrip, focus: NativeTripEditorFocus) {
        let form = NativeCreateTripViewController(
            existingTrip: trip,
            onResolveBackground: { [weak self] query, completion in
                self?.tripManager.resolveDestinationHeroImage(
                    query: query,
                    minimumPixelDimension: 1400,
                    completion: completion
                )
            },
            onResolveBackgroundBank: { [weak self] query, completion in
                self?.tripManager.resolveDestinationImageBank(query: query, completion: completion)
            },
            onSuccessfulSaveDismissed: { [weak self] updatedTrip in
                guard let self, updatedTrip.id == self.tripID else { return }
                self.store.clearCache(userID: self.userID, tripID: self.tripID)
                self.reload()
            },
            initialFocus: focus,
            onCreate: { [weak self] draft, completion in
                guard let self else { return }
                self.tripManager.updateTrip(id: self.tripID, draft: draft, completion: completion)
            }
        )
        form.modalPresentationStyle = .pageSheet
        if let sheet = form.sheetPresentationController {
            NativeActivitySheetMetrics.applyMyTripsExpandedHeight(to: sheet)
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = 28
        }
        present(form, animated: true)
    }

    private func duplicate(_ trip: NativeMapTrip) {
        guard let coordinate = trip.coordinate else {
            showTripMenuMessage(
                "Duplicate Trip",
                message: "This trip does not have a resolved destination and cannot be duplicated."
            )
            return
        }
        let draft = NativeTripDraft(
            name: "\(trip.displayName) Copy",
            destination: trip.destination ?? trip.displayName,
            coordinate: coordinate,
            startDate: trip.startDate,
            endDate: trip.endDate,
            imageURL: trip.imageUrl.flatMap(URL.init(string:))
        )
        tripManager.createTrip(draft) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                switch result {
                case .success(let duplicate):
                    self.showTripMenuMessage(
                        "Trip Duplicated",
                        message: "\(duplicate.displayName) was created from \(trip.displayName)."
                    )
                case .failure(let error):
                    self.showTripMenuMessage("Duplicate Trip", message: error.localizedDescription)
                }
            }
        }
    }

    private func chooseMergeTarget(for sourceTrip: NativeMapTrip, from trips: [NativeMapTrip]) {
        let targets = trips.filter { $0.id != sourceTrip.id }
        guard !targets.isEmpty else {
            showTripMenuMessage("Merge Trips", message: "There is no other trip to merge into.")
            return
        }
        let picker = UIAlertController(
            title: "Merge \(sourceTrip.displayName)",
            message: "Choose the trip that should receive this trip's content.",
            preferredStyle: .actionSheet
        )
        targets.forEach { target in
            picker.addAction(UIAlertAction(title: target.displayName, style: .default) { [weak self] _ in
                self?.showTripMenuMessage(
                    "Merge Trips",
                    message: "A safe transactional merge is not available yet. Neither \(sourceTrip.displayName) nor \(target.displayName) was changed."
                )
            })
        }
        picker.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        picker.popoverPresentationController?.sourceView = headerView.moreButton
        picker.popoverPresentationController?.sourceRect = headerView.moreButton.bounds
        present(picker, animated: true)
    }

    private func showTripMenuMessage(_ title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    private func render(_ state: NativeTripOverviewViewState) {
        let hadRenderedOverview = latestOverview != nil
        let preservedOffset = scrollView.contentOffset
        retryButton.removeFromSuperview()
        signInButton.removeFromSuperview()
        switch state {
        case .loading:
            spinner.startAnimating(); statusLabel.text = "Loading trip details"
        case .loaded(let overview):
            spinner.stopAnimating(); statusLabel.text = nil; render(overview, stale: false)
        case .stale(let overview, let refresh):
            spinner.stopAnimating()
            statusLabel.text = refresh == .failed ? "Showing saved details · Refresh failed" : "Showing saved details · Refreshing"
            render(overview, stale: true)
        case .partial(let overview, let failures):
            spinner.stopAnimating(); statusLabel.text = "Some sections are unavailable: \(failures.map(\.rawValue).joined(separator: ", "))"
            render(overview, stale: false)
        case .authenticationExpired(let cached):
            spinner.stopAnimating(); statusLabel.text = "Your session expired. Sign in again to refresh this trip."
            if let cached { render(cached, stale: true) }
            contentStack.insertArrangedSubview(signInButton, at: 3)
            UIAccessibility.post(notification: .layoutChanged, argument: signInButton)
        case .recoverableError(let message, let cached, let canRetry):
            spinner.stopAnimating(); statusLabel.text = message
            if let cached { render(cached, stale: true) }
            if canRetry { contentStack.insertArrangedSubview(retryButton, at: 3) }
        }
        if let message = statusLabel.text, !message.isEmpty {
            UIAccessibility.post(notification: .announcement, argument: message)
        }
        statusLabel.isHidden = statusLabel.text?.isEmpty != false
        view.layoutIfNeeded()
        let selectedDetent = sheetPresentationController?.selectedDetentIdentifier
        let isExpandedDetent = selectedDetent == nil || selectedDetent == .large
        let shouldResetInitialExpandedOverview = latestOverview != nil
            && isExpandedDetent
            && (!hadRenderedOverview || !hasUserScrolledOverview)
        scrollView.setContentOffset(
            NativeTripOverviewScrollPosition.restored(
                preservedOffset,
                contentHeight: scrollView.contentSize.height,
                viewportHeight: scrollView.bounds.height,
                resetToTop: shouldResetInitialExpandedOverview
            ),
            animated: false
        )
        scrollViewDidScroll(scrollView)
    }

    private func render(_ overview: NativeTripOverview, stale: Bool) {
        latestOverview = overview
        headerView.render(hero: overview.hero, trip: overview.trip, stale: stale)
        headerView.setShowsCountryFlag(customization.showsCountryFlags)
        actionsView.render(actions: overview.actions, activityMode: overview.itinerary.activityMode)
        itineraryView.render(
            overview.itinerary,
            trip: overview.trip,
            newActivityAvailable: overview.actions.contains { $0.kind == .newActivity && $0.isAvailable }
        )
        documentsView.render(overview.documents)
        expensesView.render(overview.expenses)
        recentView.render(overview.recentItems)
    }

    private func applyBackground(_ color: UIColor) {
        view.backgroundColor = color
        // Painting the arranged action view itself creates an inset rectangle.
        // Let it inherit the image-derived terminal surface from the canvas.
        actionsView.backgroundColor = .clear
        // The hero fog already performs the visual transition. Keep the overview
        // canvas uniformly on its terminal color so card gaps and the regions
        // above/below Itinerary cannot reveal separate horizontal bands.
        backgroundGradient.colors = [color.cgColor, color.cgColor]
        setNeedsStatusBarAppearanceUpdate()
    }
}

struct NativeTripOverviewVisualVerificationSnapshot: Equatable {
    let statusBarStyle: UIStatusBarStyle
    let headerSummary: String?
    let actionKinds: [NativeTripOverviewActionKind]
    let itineraryValue: String?
    let importedItemsValue: String?
    let expensesValue: String?
    let latestAddedValue: String?
    let statusMessage: String?
    let headerHeight: CGFloat
    let headerFrame: CGRect
    let scrollFrame: CGRect
    let contentFrame: CGRect
    let measuredFrames: [String: CGRect]

    var normalizedMeasuredFrames: [String: CGRect] {
        guard headerFrame.width > 0, headerFrame.height > 0 else { return [:] }
        return measuredFrames.mapValues { frame in
            CGRect(
                x: (frame.minX - headerFrame.minX) / headerFrame.width,
                y: (frame.minY - headerFrame.minY) / headerFrame.height,
                width: frame.width / headerFrame.width,
                height: frame.height / headerFrame.height
            )
        }
    }

    var measuredFrameReport: String {
        measuredFrames.keys.sorted().compactMap { key in
            measuredFrames[key].map { frame in
                "\(key),\(Self.number(frame.minX)),\(Self.number(frame.minY)),\(Self.number(frame.width)),\(Self.number(frame.height))"
            }
        }.joined(separator: "\n")
    }

    var normalizedMeasuredFrameReport: String {
        normalizedMeasuredFrames.keys.sorted().compactMap { key in
            normalizedMeasuredFrames[key].map { frame in
                "\(key),\(Self.number(frame.minX)),\(Self.number(frame.minY)),\(Self.number(frame.width)),\(Self.number(frame.height))"
            }
        }.joined(separator: "\n")
    }

    private static func number(_ value: CGFloat) -> String {
        String(format: "%.2f", Double(value))
    }
}

enum NativeTripOverviewScrollPosition {
    static func restored(
        _ preserved: CGPoint,
        contentHeight: CGFloat,
        viewportHeight: CGFloat,
        resetToTop: Bool = false
    ) -> CGPoint {
        if resetToTop {
            return CGPoint(x: preserved.x, y: 0)
        }
        let maximumY = max(0, contentHeight - viewportHeight)
        return CGPoint(x: preserved.x, y: min(max(0, preserved.y), maximumY))
    }
}

enum NativeTripOverviewTitleCollisionTransition {
    static func distance(initialCenterY: CGFloat, targetCenterY: CGFloat) -> CGFloat {
        max(initialCenterY - targetCenterY, 1)
    }

    static func progress(offset: CGFloat, initialCenterY: CGFloat, targetCenterY: CGFloat) -> CGFloat {
        min(1, max(0, offset / distance(initialCenterY: initialCenterY, targetCenterY: targetCenterY)))
    }
}

enum NativeTripOverviewHeroParallax {
    /// The photograph's crop moves inside a stationary, clipped hero viewport.
    /// This preserves the downward subject drift without moving the image edge.
    static func translation(
        offset: CGFloat,
        collapseDistance: CGFloat,
        reduceMotion: Bool
    ) -> CGFloat {
        guard !reduceMotion else { return 0 }
        let distance = max(collapseDistance, 1)
        let progress = min(1, max(0, offset / distance))
        let eased = 1 - pow(1 - progress, 2)
        return distance * 0.24 * eased
    }
}

enum NativeTripOverviewScrollOcclusion {
    // The reference clips content shortly below the controls, not at the bottom
    // of the 100pt structural header. Duplicate gradient stops produce a true
    // cutoff with no interpolated pixels that could read as shadow or fog.
    static let boundary: CGFloat =
        AlmidyDesignTokens.TripOverview.headerControlTopInset
        + AlmidyDesignTokens.TripOverview.headerControlDiameter
        + 20
    static let fadeStart: CGFloat = boundary
    static let fadeEnd: CGFloat = boundary

    static func locations(viewportHeight: CGFloat) -> [NSNumber] {
        let height = max(viewportHeight, 1)
        return [
            0,
            NSNumber(value: Double(min(1, max(0, fadeStart / height)))),
            NSNumber(value: Double(min(1, max(0, fadeEnd / height)))),
            1,
        ]
    }
}

enum NativeTripOverviewDetentVisibility {
    static func itineraryAlpha(isFullyCollapsed: Bool) -> CGFloat {
        isFullyCollapsed ? 0 : 1
    }
}

enum NativeTripOverviewHeaderStructure {
    static func height(expandedHeight: CGFloat, compactHeight: CGFloat, isExpandedDetent: Bool) -> CGFloat {
        isExpandedDetent ? expandedHeight : compactHeight
    }
}

private enum NativeTripOverviewShortcut: String, Codable, CaseIterable {
    case flights, stays, places, routes, carRental

    var title: String {
        switch self {
        case .flights: return "Flights"
        case .stays: return "Stays"
        case .places: return "Places"
        case .routes: return "Routes"
        case .carRental: return "Car Rental"
        }
    }

    var symbol: String {
        switch self {
        case .flights: return "airplane"
        case .stays: return "bed.double.fill"
        case .places: return "mappin.and.ellipse"
        case .routes: return "point.topleft.down.to.point.bottomright.curvepath"
        case .carRental: return "car.fill"
        }
    }

    var tint: UIColor {
        NativeTripOverviewCategoryCatalog.presentation(key: title, suggestedSymbol: symbol).color
    }
}

private enum NativeTripOverviewWidget: String, Codable, CaseIterable {
    case nextActivity, itinerary, documents, expenses, latestAdded

    var title: String {
        switch self {
        case .nextActivity: return "Next Activity"
        case .itinerary: return "Itinerary"
        case .documents: return "Documents"
        case .expenses: return "Expenses"
        case .latestAdded: return "Latest Added"
        }
    }

    var symbol: String {
        switch self {
        case .nextActivity: return "airplane"
        case .itinerary: return "calendar"
        case .documents: return "doc.fill"
        case .expenses: return "creditcard.fill"
        case .latestAdded: return "arrow.down.to.line.compact"
        }
    }

    var iconPresentation: NativeTripOverviewCategoryCatalog.Presentation {
        switch self {
        case .nextActivity:
            return NativeTripOverviewCategoryCatalog.presentation(key: "Flights", suggestedSymbol: symbol)
        case .itinerary:
            return .init(
                symbol: symbol,
                color: AlmidyDesignTokens.Color.tripOverviewAccent,
                background: AlmidyDesignTokens.Color.tripOverviewAccentSurface
            )
        case .documents:
            return .init(
                symbol: symbol,
                color: AlmidyDesignTokens.Color.settingsSecondary,
                background: AlmidyDesignTokens.Color.settingsSecondary.withAlphaComponent(0.14)
            )
        case .expenses:
            return .init(
                symbol: symbol,
                color: AlmidyDesignTokens.Color.goldDeep,
                background: AlmidyDesignTokens.Color.goldMutedSurface
            )
        case .latestAdded:
            return .init(
                symbol: symbol,
                color: AlmidyDesignTokens.Color.settingsSecondary,
                background: AlmidyDesignTokens.Color.settingsSecondary.withAlphaComponent(0.12)
            )
        }
    }
}

private struct NativeTripOverviewCustomization: Codable, Equatable {
    var showsCountryFlags: Bool
    var shortcuts: [NativeTripOverviewShortcut]
    var widgets: [NativeTripOverviewWidget]

    static let standard = NativeTripOverviewCustomization(
        showsCountryFlags: true,
        shortcuts: NativeTripOverviewShortcut.allCases,
        widgets: NativeTripOverviewWidget.allCases
    )
}

private enum NativeTripOverviewCustomizationStore {
    static func load(tripID: String) -> NativeTripOverviewCustomization {
        guard let data = UserDefaults.standard.data(forKey: key(tripID)),
              let value = try? JSONDecoder().decode(NativeTripOverviewCustomization.self, from: data)
        else { return .standard }
        return value
    }

    static func save(_ customization: NativeTripOverviewCustomization, tripID: String) {
        guard let data = try? JSONEncoder().encode(customization) else { return }
        UserDefaults.standard.set(data, forKey: key(tripID))
    }

    private static func key(_ tripID: String) -> String { "native-trip-overview-customization-\(tripID)" }
}

private final class NativeTripOverviewCustomizeViewController: UIViewController, UITableViewDataSource, UITableViewDelegate {
    var onSave: ((NativeTripOverviewCustomization) -> Void)?

    private var draft: NativeTripOverviewCustomization
    private let scrollView = UIScrollView()
    private let contentStack = UIStackView()
    private let shortcutsStack = UIStackView()
    private let widgetsTable = UITableView(frame: .zero, style: .plain)
    private let flagsSwitch = UISwitch()

    init(customization: NativeTripOverviewCustomization) {
        draft = customization
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = AlmidyDesignTokens.Color.settingsBackground
        configureLayout()
        rebuildShortcuts()
    }

    private func configureLayout() {
        let header = UIView()
        let title = UILabel()
        title.text = "Customize Overview"
        title.font = .systemFont(ofSize: 20, weight: .semibold)
        title.textAlignment = .center

        let cancel = capsuleButton(title: "Cancel", action: #selector(cancelTapped))
        let save = capsuleButton(title: "Save", action: #selector(saveTapped))
        [header, title, cancel, save].forEach { $0.translatesAutoresizingMaskIntoConstraints = false }
        header.addSubview(title); header.addSubview(cancel); header.addSubview(save)

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.showsVerticalScrollIndicator = false
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.axis = .vertical
        contentStack.spacing = 12
        scrollView.addSubview(contentStack)
        view.addSubview(header); view.addSubview(scrollView)

        let flagsCard = UIView()
        flagsCard.backgroundColor = AlmidyDesignTokens.Color.settingsCard
        flagsCard.layer.cornerRadius = 24
        let flagsLabel = UILabel()
        flagsLabel.text = "Show Country Flags"
        flagsLabel.font = .systemFont(ofSize: 18, weight: .semibold)
        flagsSwitch.isOn = draft.showsCountryFlags
        flagsSwitch.onTintColor = AlmidyDesignTokens.Color.goldDeep
        flagsSwitch.addTarget(self, action: #selector(flagsChanged), for: .valueChanged)
        [flagsLabel, flagsSwitch].forEach { $0.translatesAutoresizingMaskIntoConstraints = false; flagsCard.addSubview($0) }
        NSLayoutConstraint.activate([
            flagsCard.heightAnchor.constraint(equalToConstant: 60),
            flagsLabel.leadingAnchor.constraint(equalTo: flagsCard.leadingAnchor, constant: 18),
            flagsLabel.centerYAnchor.constraint(equalTo: flagsCard.centerYAnchor),
            flagsSwitch.trailingAnchor.constraint(equalTo: flagsCard.trailingAnchor, constant: -18),
            flagsSwitch.centerYAnchor.constraint(equalTo: flagsCard.centerYAnchor),
            flagsLabel.trailingAnchor.constraint(lessThanOrEqualTo: flagsSwitch.leadingAnchor, constant: -16)
        ])
        contentStack.addArrangedSubview(flagsCard)
        let flagNote = sectionNote("The countries are automatically detected as you add activities to your trip")
        contentStack.addArrangedSubview(flagNote)
        contentStack.setCustomSpacing(28, after: flagNote)

        contentStack.addArrangedSubview(sectionTitle("Shortcuts"))
        let shortcutCard = UIView()
        shortcutCard.backgroundColor = AlmidyDesignTokens.Color.settingsCard
        shortcutCard.layer.cornerRadius = 26
        let shortcutsScroll = UIScrollView()
        shortcutsScroll.showsHorizontalScrollIndicator = false
        shortcutsScroll.translatesAutoresizingMaskIntoConstraints = false
        shortcutsStack.axis = .horizontal; shortcutsStack.spacing = 4
        shortcutsStack.distribution = .fillEqually
        shortcutsStack.alignment = .top; shortcutsStack.translatesAutoresizingMaskIntoConstraints = false
        shortcutsScroll.addSubview(shortcutsStack); shortcutCard.addSubview(shortcutsScroll)
        let addShortcut = UIButton(type: .system)
        var addConfiguration = UIButton.Configuration.plain()
        addConfiguration.title = "Add New Shortcut"
        addConfiguration.image = UIImage(systemName: "plus")
        addConfiguration.imagePadding = 14
        addConfiguration.baseForegroundColor = AlmidyDesignTokens.Color.settingsGold
        addConfiguration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
            var outgoing = incoming
            outgoing.font = .systemFont(ofSize: 18, weight: .semibold)
            return outgoing
        }
        addShortcut.configuration = addConfiguration
        addShortcut.addTarget(self, action: #selector(addShortcutTapped), for: .touchUpInside)
        addShortcut.translatesAutoresizingMaskIntoConstraints = false
        shortcutCard.addSubview(addShortcut)
        let divider = UIView(); divider.backgroundColor = AlmidyDesignTokens.Color.settingsLine; divider.translatesAutoresizingMaskIntoConstraints = false; shortcutCard.addSubview(divider)
        NSLayoutConstraint.activate([
            shortcutCard.heightAnchor.constraint(equalToConstant: 186),
            shortcutsScroll.leadingAnchor.constraint(equalTo: shortcutCard.leadingAnchor, constant: 12), shortcutsScroll.trailingAnchor.constraint(equalTo: shortcutCard.trailingAnchor, constant: -12),
            shortcutsScroll.topAnchor.constraint(equalTo: shortcutCard.topAnchor, constant: 20), shortcutsScroll.heightAnchor.constraint(equalToConstant: 108),
            shortcutsStack.leadingAnchor.constraint(equalTo: shortcutsScroll.contentLayoutGuide.leadingAnchor), shortcutsStack.trailingAnchor.constraint(equalTo: shortcutsScroll.contentLayoutGuide.trailingAnchor),
            shortcutsStack.topAnchor.constraint(equalTo: shortcutsScroll.contentLayoutGuide.topAnchor), shortcutsStack.bottomAnchor.constraint(equalTo: shortcutsScroll.contentLayoutGuide.bottomAnchor),
            shortcutsStack.widthAnchor.constraint(equalTo: shortcutsScroll.frameLayoutGuide.widthAnchor),
            shortcutsStack.heightAnchor.constraint(equalTo: shortcutsScroll.frameLayoutGuide.heightAnchor),
            divider.leadingAnchor.constraint(equalTo: shortcutCard.leadingAnchor, constant: 18), divider.trailingAnchor.constraint(equalTo: shortcutCard.trailingAnchor, constant: -18), divider.topAnchor.constraint(equalTo: shortcutsScroll.bottomAnchor), divider.heightAnchor.constraint(equalToConstant: 1 / UIScreen.main.scale),
            addShortcut.leadingAnchor.constraint(equalTo: shortcutCard.leadingAnchor, constant: 12), addShortcut.topAnchor.constraint(equalTo: divider.bottomAnchor, constant: 4), addShortcut.heightAnchor.constraint(equalToConstant: 52)
        ])
        contentStack.addArrangedSubview(shortcutCard)
        contentStack.setCustomSpacing(28, after: shortcutCard)

        contentStack.addArrangedSubview(sectionTitle("Widgets"))
        widgetsTable.translatesAutoresizingMaskIntoConstraints = false
        widgetsTable.backgroundColor = AlmidyDesignTokens.Color.settingsCard
        widgetsTable.layer.cornerRadius = 26
        widgetsTable.isScrollEnabled = false
        widgetsTable.dataSource = self; widgetsTable.delegate = self
        widgetsTable.register(UITableViewCell.self, forCellReuseIdentifier: "Widget")
        widgetsTable.rowHeight = 56
        widgetsTable.isEditing = true
        widgetsTable.separatorColor = AlmidyDesignTokens.Color.settingsLine
        widgetsTable.heightAnchor.constraint(equalToConstant: CGFloat(draft.widgets.count) * 56).isActive = true
        contentStack.addArrangedSubview(widgetsTable)

        NSLayoutConstraint.activate([
            header.leadingAnchor.constraint(equalTo: view.leadingAnchor), header.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            header.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor), header.heightAnchor.constraint(equalToConstant: 74),
            cancel.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 18), cancel.centerYAnchor.constraint(equalTo: header.centerYAnchor), cancel.widthAnchor.constraint(equalToConstant: 92),
            save.trailingAnchor.constraint(equalTo: header.trailingAnchor, constant: -18), save.centerYAnchor.constraint(equalTo: header.centerYAnchor), save.widthAnchor.constraint(greaterThanOrEqualToConstant: 76),
            title.centerXAnchor.constraint(equalTo: header.centerXAnchor), title.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            title.leadingAnchor.constraint(greaterThanOrEqualTo: cancel.trailingAnchor, constant: 12), title.trailingAnchor.constraint(lessThanOrEqualTo: save.leadingAnchor, constant: -12),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor), scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor), scrollView.topAnchor.constraint(equalTo: header.bottomAnchor), scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: 20), contentStack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -20),
            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 8), contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -60),
            contentStack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor, constant: -40)
        ])
    }

    private func capsuleButton(title: String, action: Selector) -> UIButton {
        let button = UIButton(type: .system)
        var configuration = UIButton.Configuration.filled()
        configuration.title = title
        configuration.cornerStyle = .capsule
        configuration.baseForegroundColor = AlmidyDesignTokens.Color.settingsText
        configuration.baseBackgroundColor = AlmidyDesignTokens.Color.settingsCard
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 10, leading: 10, bottom: 10, trailing: 10)
        configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
            var outgoing = incoming
            outgoing.font = .systemFont(ofSize: 18, weight: .medium)
            return outgoing
        }
        button.configuration = configuration
        button.titleLabel?.numberOfLines = 1
        button.titleLabel?.lineBreakMode = .byClipping
        button.addTarget(self, action: action, for: .touchUpInside)
        return button
    }

    private func sectionTitle(_ text: String) -> UILabel {
        let label = UILabel(); label.text = text; label.textColor = .secondaryLabel
        label.font = .systemFont(ofSize: 16, weight: .semibold)
        return label
    }

    private func sectionNote(_ text: String) -> UILabel {
        let label = UILabel(); label.text = text; label.textColor = AlmidyDesignTokens.Color.settingsSecondary; label.numberOfLines = 0
        label.font = .systemFont(ofSize: 15)
        return label
    }

    private func rebuildShortcuts() {
        shortcutsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for (index, shortcut) in draft.shortcuts.enumerated() {
            let item = UIView(); item.translatesAutoresizingMaskIntoConstraints = false
            let circle = UIView(); circle.backgroundColor = shortcut.tint.withAlphaComponent(0.12); circle.layer.cornerRadius = 32
            let image = UIImageView(image: UIImage(systemName: shortcut.symbol)); image.tintColor = shortcut.tint; image.contentMode = .scaleAspectFit
            let label = UILabel(); label.text = shortcut.title; label.font = .systemFont(ofSize: 13); label.textAlignment = .center; label.textColor = AlmidyDesignTokens.Color.settingsSecondary; label.adjustsFontSizeToFitWidth = true; label.minimumScaleFactor = 0.72
            let remove = UIButton(type: .system); remove.setImage(UIImage(systemName: "minus", withConfiguration: UIImage.SymbolConfiguration(pointSize: 10, weight: .bold)), for: .normal); remove.tintColor = .white; remove.backgroundColor = AlmidyDesignTokens.Color.danger; remove.layer.cornerRadius = 10; remove.tag = index
            remove.addTarget(self, action: #selector(removeShortcut(_:)), for: .touchUpInside)
            [circle, image, label, remove].forEach { $0.translatesAutoresizingMaskIntoConstraints = false; item.addSubview($0) }
            let preferredCircleWidth = circle.widthAnchor.constraint(equalToConstant: 64)
            preferredCircleWidth.priority = .defaultHigh
            NSLayoutConstraint.activate([
                preferredCircleWidth, circle.widthAnchor.constraint(lessThanOrEqualTo: item.widthAnchor, constant: -4), circle.heightAnchor.constraint(equalTo: circle.widthAnchor), circle.topAnchor.constraint(equalTo: item.topAnchor, constant: 4), circle.centerXAnchor.constraint(equalTo: item.centerXAnchor),
                image.centerXAnchor.constraint(equalTo: circle.centerXAnchor), image.centerYAnchor.constraint(equalTo: circle.centerYAnchor), image.widthAnchor.constraint(equalToConstant: 32), image.heightAnchor.constraint(equalToConstant: 32),
                remove.widthAnchor.constraint(equalToConstant: 20), remove.heightAnchor.constraint(equalToConstant: 20), remove.topAnchor.constraint(equalTo: circle.topAnchor, constant: -3), remove.trailingAnchor.constraint(equalTo: circle.trailingAnchor, constant: 1),
                label.topAnchor.constraint(equalTo: circle.bottomAnchor, constant: 6), label.leadingAnchor.constraint(equalTo: item.leadingAnchor), label.trailingAnchor.constraint(equalTo: item.trailingAnchor), label.bottomAnchor.constraint(lessThanOrEqualTo: item.bottomAnchor)
            ])
            shortcutsStack.addArrangedSubview(item)
        }
    }

    @objc private func cancelTapped() { dismiss(animated: true) }
    @objc private func saveTapped() { onSave?(draft) }
    @objc private func flagsChanged() { draft.showsCountryFlags = flagsSwitch.isOn }
    @objc private func removeShortcut(_ sender: UIButton) {
        guard draft.shortcuts.indices.contains(sender.tag) else { return }
        draft.shortcuts.remove(at: sender.tag); rebuildShortcuts()
    }
    @objc private func addShortcutTapped() {
        let choices = NativeTripOverviewShortcut.allCases.filter { !draft.shortcuts.contains($0) }
        guard !choices.isEmpty else { return }
        let alert = UIAlertController(title: "Add Shortcut", message: nil, preferredStyle: .actionSheet)
        choices.forEach { shortcut in
            alert.addAction(UIAlertAction(title: shortcut.title, style: .default) { [weak self] _ in
                self?.draft.shortcuts.append(shortcut); self?.rebuildShortcuts()
            })
        }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        if let popover = alert.popoverPresentationController { popover.sourceView = view; popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 80, width: 1, height: 1) }
        present(alert, animated: true)
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { draft.widgets.count }
    func tableView(_ tableView: UITableView, canMoveRowAt indexPath: IndexPath) -> Bool { true }
    func tableView(_ tableView: UITableView, editingStyleForRowAt indexPath: IndexPath) -> UITableViewCell.EditingStyle { .none }
    func tableView(_ tableView: UITableView, shouldIndentWhileEditingRowAt indexPath: IndexPath) -> Bool { false }
    func tableView(_ tableView: UITableView, moveRowAt sourceIndexPath: IndexPath, to destinationIndexPath: IndexPath) {
        let widget = draft.widgets.remove(at: sourceIndexPath.row)
        draft.widgets.insert(widget, at: destinationIndexPath.row)
    }
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "Widget", for: indexPath)
        let widget = draft.widgets[indexPath.row]
        var content = cell.defaultContentConfiguration()
        content.text = widget.title
        content.image = widgetIcon(for: widget)
        content.imageProperties.maximumSize = CGSize(width: 36, height: 36)
        content.imageProperties.reservedLayoutSize = CGSize(width: 48, height: 36)
        content.textProperties.font = .systemFont(ofSize: 18, weight: .semibold)
        cell.contentConfiguration = content
        cell.backgroundColor = .clear
        cell.showsReorderControl = true
        cell.selectionStyle = .none
        return cell
    }

    private func widgetIcon(for widget: NativeTripOverviewWidget) -> UIImage? {
        let presentation = widget.iconPresentation
        let size = CGSize(width: 36, height: 36)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { _ in
            presentation.background.setFill()
            UIBezierPath(ovalIn: CGRect(origin: .zero, size: size)).fill()

            guard let symbol = UIImage(
                systemName: presentation.symbol,
                withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .medium)
            )?.withTintColor(presentation.color, renderingMode: .alwaysOriginal) else { return }
            let origin = CGPoint(
                x: (size.width - symbol.size.width) / 2,
                y: (size.height - symbol.size.height) / 2
            )
            symbol.draw(at: origin)
        }.withRenderingMode(.alwaysOriginal)
    }
}

enum NativeTripOverviewContentChrome {
    static func progress(transitionProgress: CGFloat, isExpandedDetent: Bool) -> CGFloat {
        guard !isExpandedDetent else { return 0 }
        return min(1, max(0, transitionProgress))
    }
}

enum NativeTripOverviewHeroSpacer {
    static func height(
        expandedHeight: CGFloat,
        compactDownshift: CGFloat,
        transitionProgress: CGFloat,
        isExpandedDetent: Bool
    ) -> CGFloat {
        guard !isExpandedDetent else { return expandedHeight }
        let progress = min(1, max(0, transitionProgress))
        return expandedHeight + compactDownshift * progress
    }
}

private extension UIColor {
    var darkerForAlmidy: UIColor {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        guard getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return AlmidyDesignTokens.Color.generatedTripImageBase }
        return UIColor(red: red * 0.78, green: green * 0.78, blue: blue * 0.78, alpha: 1)
    }
}

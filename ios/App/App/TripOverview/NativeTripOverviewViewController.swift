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
        let proposedHeight = safeHeight * 0.40 + safeAreaInsets.bottom
        return min(maximumDetentValue, max(320, min(390, proposedHeight)))
    }

    static func applySharedChrome(to sheet: UISheetPresentationController) {
        sheet.preferredCornerRadius = AlmidyDesignTokens.TripOverview.sheetCornerRadius
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

final class NativeTripOverviewViewController: UIViewController, UIScrollViewDelegate {
    private let userID: String
    private let tripID: String
    private let seed: NativeTripOverviewSeed?
    private let seedImage: UIImage?
    private let store: NativeTripOverviewStore
    private lazy var tripManager = NativeTripStore(webView: nil)
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
    private let contentStack = UIStackView()
    private let heroSpacer = UIView()
    private let actionsView = NativeTripOverviewActionsView()
    private let itineraryView = NativeTripOverviewItineraryCard()
    private let documentsView = NativeTripOverviewDocumentsCard()
    private let expensesView = NativeTripOverviewExpensesCard()
    private let recentView = NativeTripOverviewRecentCard()
    private let statusLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let retryButton = UIButton(type: .system)
    private let signInButton = UIButton(type: .system)
    private var headerHeightConstraint: NSLayoutConstraint!
    private var heroSpacerHeightConstraint: NSLayoutConstraint!
    private var actionsRegionHeightConstraint: NSLayoutConstraint!
    private var latestOverview: NativeTripOverview?
    private var shouldRestoreOverviewFocus = true
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
        guard shouldRestoreOverviewFocus else { return }
        shouldRestoreOverviewFocus = false
        UIAccessibility.post(notification: .screenChanged, argument: headerView.closeButton)
    }

    func configureForGlobePresentation() {
        modalPresentationStyle = .pageSheet
        modalPresentationCapturesStatusBarAppearance = true
        guard let sheet = sheetPresentationController else { return }
        sheet.detents = [.large()]
        sheet.selectedDetentIdentifier = .large
        // The header owns a persistent luminance-adaptive grabber; UIKit's sheet
        // grabber cannot be tinted through public API.
        sheet.prefersGrabberVisible = false
        sheet.preferredCornerRadius = AlmidyDesignTokens.TripOverview.sheetCornerRadius
        sheet.largestUndimmedDetentIdentifier = .large
        sheet.prefersScrollingExpandsWhenScrolledToEdge = false
        sheet.prefersEdgeAttachedInCompactHeight = true
        sheet.widthFollowsPreferredContentSizeWhenEdgeAttached = true
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
        view.layer.cornerRadius = AlmidyDesignTokens.TripOverview.sheetCornerRadius
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
        scrollView.accessibilityIdentifier = "trip-overview-scroll-view"
        scrollView.contentInsetAdjustmentBehavior = .never
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        contentStack.axis = .vertical
        contentStack.spacing = AlmidyDesignTokens.TripOverview.interCardGap
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        heroSpacer.translatesAutoresizingMaskIntoConstraints = false
        contentStack.addArrangedSubview(heroSpacer)
        contentStack.addArrangedSubview(statusLabel); contentStack.addArrangedSubview(spinner)
        contentStack.addArrangedSubview(actionsView); contentStack.addArrangedSubview(itineraryView)
        contentStack.addArrangedSubview(documentsView); contentStack.addArrangedSubview(expensesView); contentStack.addArrangedSubview(recentView)
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
        itineraryView.onOpen = { [weak self] in self?.routeCard(.itinerary) }
        itineraryView.onNewActivity = { [weak self] in
            self?.presentNewActivity()
        }
        documentsView.onOpen = { [weak self] in self?.routeCard(.importedItems) }
        expensesView.onOpen = { [weak self] in self?.routeCard(.expenses) }
        [itineraryView, documentsView, expensesView].forEach { $0.onRetry = { [weak self] in self?.reload() } }
        recentView.onRetry = { [weak self] in self?.reload() }

        NSLayoutConstraint.activate([
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor), scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.topAnchor.constraint(equalTo: view.topAnchor), scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: AlmidyDesignTokens.TripOverview.outerHorizontalInset),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -AlmidyDesignTokens.TripOverview.outerHorizontalInset),
            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -AlmidyDesignTokens.TripOverview.bottomBreathingRoom),
            contentStack.widthAnchor.constraint(
                equalTo: scrollView.frameLayoutGuide.widthAnchor,
                constant: -(AlmidyDesignTokens.TripOverview.outerHorizontalInset * 2)
            ),
            heroSpacerHeightConstraint,
            actionsRegionHeightConstraint,
            headerView.leadingAnchor.constraint(equalTo: view.leadingAnchor), headerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerView.topAnchor.constraint(equalTo: view.topAnchor), headerHeightConstraint
        ])
        contentStack.setCustomSpacing(0, after: heroSpacer)
        configureContinuousHeroBackdrop()
        view.bringSubviewToFront(headerView)
        if let seed { headerView.render(seed: seed, image: seedImage) }
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
        let distance = expandedHeaderHeight - compactHeaderHeight
        let offset = max(0, scrollView.contentOffset.y)
        let rawProgress = min(1, offset / distance)
        let transition = NativeTripOverviewHeaderTransition(
            progress: rawProgress,
            reduceMotion: UIAccessibility.isReduceMotionEnabled
        )
        headerHeightConstraint.constant = transition.headerHeight(
            expanded: expandedHeaderHeight,
            compact: compactHeaderHeight
        )
        // The spacer remains part of the vertical stack, so increasing its
        // collapsed budget moves the activity group and Itinerary together while
        // preserving their internal spacing and normal content-flow relationship.
        let collapsedDownshift = AlmidyDesignTokens.TripOverview.CollapsedComposition
            .contentFlowDownshift(for: max(view.bounds.width, 1))
        heroSpacerHeightConstraint.constant = expandedHeaderHeight
            + collapsedDownshift * transition.easedProgress
        headerView.updateTransition(progress: rawProgress)
        actionsView.updateTransition(progress: transition.easedProgress)
        // Synchronize the external image continuation with the compact surface's
        // own crossfade. This avoids a flat-color flash at midpoint and guarantees
        // that the image is fully gone at the defined compact-header boundary.
        heroBackdropView.alpha = 1 - transition.compactBackgroundAlpha
    }

    @objc private func reload() {
        store.load(userID: userID, tripID: tripID) { [weak self] state in self?.render(state) }
    }

    @objc private func close() { router?.close() }
    @objc private func recoverAuthentication() { router?.recoverAuthentication() }

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
            sheet.detents = [.large()]
            sheet.selectedDetentIdentifier = .large
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = AlmidyDesignTokens.TripOverview.sheetCornerRadius
            sheet.prefersScrollingExpandsWhenScrolledToEdge = false
        }
        present(search, animated: true)
    }

    private func presentNewActivity() {
        guard presentedViewController == nil else { return }
        guard let router else { return }
        guard let action = latestOverview?.actions.first(where: {
            $0.kind == .newActivity && $0.isAvailable
        }) else { return }
        let presenter = presentingViewController
        let mapPresenter = presenter as? NativeMapViewController
        weak var pickerToDismiss: UIViewController?
        weak var activityPicker: NativeNewActivityViewController?
        let picker = NativeNewActivityViewController(
            tripID: tripID,
            onSelect: { category in
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
                pickerToDismiss?.dismiss(animated: true) {
                    router.route(action)
                    mapPresenter?.setPrimarySheetHiddenForModalFlow(false)
                }
            },
            onDismiss: {
                mapPresenter?.setActivityResultSelectionHandler(nil)
                mapPresenter?.setPrimarySheetHiddenForModalFlow(false)
            },
            initialSearchRegion: mapPresenter?.activitySearchRegion(for: tripID),
            nearbySearchRegion: mapPresenter?.nearbyActivitySearchRegion,
            initialSearchLocality: latestOverview?.trip.destination
                ?? mapPresenter?.activitySearchLocality(for: tripID)
        )
        let navigation = UINavigationController(rootViewController: picker)
        activityPicker = picker
        mapPresenter?.setActivityResultSelectionHandler { resultID in
            activityPicker?.selectResult(withID: resultID)
        }
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
            sheet.detents = [.large()]
            sheet.selectedDetentIdentifier = .large
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
        scrollView.setContentOffset(
            NativeTripOverviewScrollPosition.restored(
                preservedOffset,
                contentHeight: scrollView.contentSize.height,
                viewportHeight: scrollView.bounds.height
            ),
            animated: false
        )
        scrollViewDidScroll(scrollView)
    }

    private func render(_ overview: NativeTripOverview, stale: Bool) {
        latestOverview = overview
        headerView.render(hero: overview.hero, trip: overview.trip, stale: stale)
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
    static func restored(_ preserved: CGPoint, contentHeight: CGFloat, viewportHeight: CGFloat) -> CGPoint {
        let maximumY = max(0, contentHeight - viewportHeight)
        return CGPoint(x: preserved.x, y: min(max(0, preserved.y), maximumY))
    }
}

private extension UIColor {
    var darkerForAlmidy: UIColor {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        guard getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return AlmidyDesignTokens.Color.generatedTripImageBase }
        return UIColor(red: red * 0.78, green: green * 0.78, blue: blue * 0.78, alpha: 1)
    }
}

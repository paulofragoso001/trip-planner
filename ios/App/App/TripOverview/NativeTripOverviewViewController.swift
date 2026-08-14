import UIKit

final class NativeTripOverviewViewController: UIViewController, UIScrollViewDelegate {
    private let userID: String
    private let tripID: String
    private let seed: NativeTripOverviewSeed?
    private let seedImage: UIImage?
    private let store: NativeTripOverviewStore
    var router: NativeTripOverviewRouting?

    private var expandedHeaderHeight: CGFloat { traitCollection.preferredContentSizeCategory.isAccessibilityCategory ? 430 : 340 }
    private var compactHeaderHeight: CGFloat { traitCollection.preferredContentSizeCategory.isAccessibilityCategory ? 144 : 112 }
    private let backgroundGradient = CAGradientLayer()
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

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
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
        sheet.preferredCornerRadius = 34
        sheet.largestUndimmedDetentIdentifier = .large
        sheet.prefersScrollingExpandsWhenScrolledToEdge = false
        sheet.prefersEdgeAttachedInCompactHeight = true
        sheet.widthFollowsPreferredContentSizeWhenEdgeAttached = true
    }

    var currentHeaderHeight: CGFloat { headerHeightConstraint?.constant ?? expandedHeaderHeight }
    var currentScrollOffset: CGPoint { scrollView.contentOffset }
    var hasSignInRecovery: Bool { signInButton.superview != nil }
    var renderedHeroImageForVerification: UIImage? { headerView.renderedHeroImage }
    var visualVerificationSnapshot: NativeTripOverviewVisualVerificationSnapshot {
        .init(
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
            contentFrame: contentStack.frame
        )
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
        headerView.moreButton.addTarget(self, action: #selector(showMore), for: .touchUpInside)
        headerView.onBackgroundColor = { [weak self] color in self?.applyBackground(color) }
        actionsView.onAction = { [weak self] action in self?.router?.route(action) }
        itineraryView.onOpen = { [weak self] in self?.routeCard(.itinerary) }
        itineraryView.onNewActivity = { [weak self] in
            guard let action = self?.latestOverview?.actions.first(where: { $0.kind == .newActivity && $0.isAvailable }) else { return }
            self?.router?.route(action)
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
            heroSpacer.heightAnchor.constraint(equalToConstant: expandedHeaderHeight),
            headerView.leadingAnchor.constraint(equalTo: view.leadingAnchor), headerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerView.topAnchor.constraint(equalTo: view.topAnchor), headerHeightConstraint
        ])
        view.bringSubviewToFront(headerView)
        if let seed { headerView.render(seed: seed, image: seedImage) }
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
        headerView.updateTransition(progress: rawProgress)
    }

    @objc private func reload() {
        store.load(userID: userID, tripID: tripID) { [weak self] state in self?.render(state) }
    }

    @objc private func close() { router?.close() }
    @objc private func recoverAuthentication() { router?.recoverAuthentication() }

    @objc private func search() {
        guard let action = latestOverview?.actions.first(where: { $0.kind == .places && $0.isAvailable }) else { return }
        router?.route(action)
    }

    @objc private func showMore() {
        let menu = UIAlertController(title: "Trip options", message: nil, preferredStyle: .actionSheet)
        NativeTripOverviewMoreDestination.allCases.forEach { destination in
            menu.addAction(UIAlertAction(title: destination.title, style: .default) { [weak self] _ in
                guard let self else { return }
                self.router?.route(destination, tripID: self.tripID)
            })
        }
        menu.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        if let popover = menu.popoverPresentationController {
            popover.sourceView = headerView.moreButton
            popover.sourceRect = headerView.moreButton.bounds
        }
        present(menu, animated: true)
    }

    private func routeCard(_ destination: NativeTripOverviewMoreDestination) {
        router?.route(destination, tripID: tripID)
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
        itineraryView.render(overview.itinerary, newActivityAvailable: overview.actions.contains { $0.kind == .newActivity && $0.isAvailable })
        documentsView.render(overview.documents)
        expensesView.render(overview.expenses)
        recentView.render(overview.recentItems)
    }

    private func applyBackground(_ color: UIColor) {
        view.backgroundColor = color
        backgroundGradient.colors = [color.cgColor, color.darkerForAlmidy.cgColor]
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

import CoreImage
import UIKit

final class NativeTripOverviewHeaderView: UIView {
    let moreButton = NativeTripOverviewMinimumHitButton(type: .system)
    let searchButton = NativeTripOverviewMinimumHitButton(type: .system)
    let closeButton = NativeTripOverviewMinimumHitButton(type: .system)
    var onBackgroundColor: ((UIColor) -> Void)?
    var onHeroContinuation: ((UIImage?, UIColor, UIColor) -> Void)?

    private let imageView = NativeTripOverviewFocalImageView()
    private let gradientView = NativeTripOverviewGradientView()
    private let compactBackground = NativeTripOverviewCompactSurfaceView()
    private let imagePlaceholder = UIImageView(image: UIImage(systemName: "photo"))
    private let imageLoadingIndicator = UIActivityIndicatorView(style: .medium)
    private let grabberView = UIView()
    private let flagLabel = UILabel()
    private var showsCountryFlag = true
    private let titleLabel = UILabel()
    private let timingLabel = UILabel()
    private let dateLabel = UILabel()
    private let attributionLabel = UILabel()
    private let expandedLabels = UIStackView()
    private let compactTitleLabel = UILabel()
    private let compactDateLabel = UILabel()
    private let compactLabels = UIStackView()
    private var imageTask: URLSessionDataTask?
    private var displayedImageURL: URL?
    private var seedImageURL: URL?
    private var seedImage: UIImage?
    private var heroTintColor = NativeTripOverviewHeroColorProcessor.guardrailSurface
    private var sheetTintColor = NativeTripOverviewHeroColorProcessor.guardrailSurface
    private var compactTintColor = NativeTripOverviewHeroColorProcessor.guardrailCompactSurface
    private var controlMaterialViews: [UIVisualEffectView] = []
    private var usesExternalHeroBackdrop = false
    private var expandedContentScrollOffset: CGFloat = 0
    private(set) var transitionProgress: CGFloat = 0

    // Test-visible presentation values keep the contract verifiable without exposing mutable labels.
    var displayedFlag: String? { flagLabel.text }
    var isCountryFlagVisible: Bool { !flagLabel.isHidden }
    var countryFlagFrame: CGRect { flagLabel.frame }

    func setShowsCountryFlag(_ showsCountryFlag: Bool) {
        self.showsCountryFlag = showsCountryFlag
        flagLabel.isHidden = !showsCountryFlag || flagLabel.text == nil
    }
    var displayedTiming: String? { timingLabel.text }
    var displayedAttribution: String? { attributionLabel.text }
    var compactContentAlpha: CGFloat { compactLabels.alpha }
    var heroPlaceholderAccessibilityLabel: String? { imagePlaceholder.accessibilityLabel }
    var honorsReducedMotion: Bool { UIAccessibility.isReduceMotionEnabled }
    var expandedTitlePointSize: CGFloat { titleLabel.font.pointSize }
    var expandedTitleWeight: UIFont.Weight { titleLabel.font.almidyWeight }
    var expandedTitleMaximumLines: Int { titleLabel.numberOfLines }
    var expandedTimingPointSize: CGFloat { timingLabel.font.pointSize }
    var expandedTitleBottomInset: CGFloat { 6 }
    var heroImageAlpha: CGFloat { imageView.alpha }
    var heroGradientAlpha: CGFloat { gradientView.alpha }
    var compactBackgroundAlpha: CGFloat { compactBackground.alpha }
    var compactBackgroundFrame: CGRect { compactBackground.frame }
    var compactSurfaceColorForVerification: UIColor { compactTintColor }
    var sheetSurfaceColorForVerification: UIColor { sheetTintColor }
    var expandedContentAlpha: CGFloat { expandedLabels.alpha }
    var grabberAlpha: CGFloat { grabberView.alpha }
    var grabberFrame: CGRect { grabberView.frame }
    var grabberColor: UIColor? { grabberView.backgroundColor }

    func setGrabberHidden(_ hidden: Bool) {
        grabberView.isHidden = hidden
    }
    var expandedContentTransform: CGAffineTransform { expandedLabels.transform }
    var compactContentTransform: CGAffineTransform { compactLabels.transform }
    var compactDestinationFrame: CGRect { compactLabels.frame }
    var compactTitleFrame: CGRect { compactTitleLabel.frame }
    var compactDateFrame: CGRect { compactDateLabel.frame }
    var compactDestinationSpacing: CGFloat { compactLabels.spacing }
    var compactTitleMaximumLines: Int { compactTitleLabel.numberOfLines }
    var compactTitleLineBreakMode: NSLineBreakMode { compactTitleLabel.lineBreakMode }
    var compactLabelsUseDynamicType: Bool {
        compactTitleLabel.adjustsFontForContentSizeCategory
            && compactDateLabel.adjustsFontForContentSizeCategory
    }
    var activeSummaryAccessibilityLabel: String? {
        transitionProgress < 0.5 ? expandedLabels.accessibilityLabel : compactLabels.accessibilityLabel
    }
    var controlAccessibilityHints: [String?] {
        [moreButton, searchButton, closeButton].map(\.accessibilityHint)
    }
    var controlBorderWidths: [CGFloat] { [moreButton, searchButton, closeButton].map(\.layer.borderWidth) }
    var controlBackgroundColors: [UIColor?] { [moreButton, searchButton, closeButton].map(\.backgroundColor) }
    var controlMaterialAlphas: [CGFloat] { controlMaterialViews.map(\.alpha) }
    var controlMinimumHitTargets: [CGSize] { [moreButton, searchButton, closeButton].map(\.minimumHitTarget) }
    var accessibilityReadingOrderLabels: [String] {
        (accessibilityElements as? [UIView] ?? []).compactMap { element in
            guard !element.isHidden, !element.accessibilityElementsHidden else { return nil }
            return element.accessibilityLabel
        }
    }
    var accessibleTitleContainerCount: Int {
        [expandedLabels, compactLabels].filter { !$0.accessibilityElementsHidden }.count
    }
    var renderedHeroImage: UIImage? { imageView.image }
    var heroSourceCropRect: CGRect { imageView.sourceCropRect }
    var heroVerticalFocalPosition: CGFloat { imageView.verticalFocalPosition }
    /// `scaleAspectFill` currently uses UIKit's centered crop. Recording this
    /// anchor makes a later subject-aware focal adjustment measurable.
    var heroFocalPointInBounds: CGPoint {
        CGPoint(
            x: imageView.frame.midX,
            y: imageView.frame.minY + (imageView.frame.height * imageView.verticalFocalPosition)
        )
    }
    var isShowingHeroLoadingState: Bool { imageLoadingIndicator.isAnimating }
    var topCornerRadius: CGFloat { layer.cornerRadius }
    var topCornerMask: CACornerMask { layer.maskedCorners }
    var heroImageFrame: CGRect { imageView.frame }
    var heroFadeFrame: CGRect { gradientView.frame }
    func stableTransitionGeometry(expandedHeaderHeight: CGFloat) -> (expandedCenterY: CGFloat, compactCenterY: CGFloat) {
        layoutIfNeeded()
        // Measure the two destination labels themselves. Convert each label's
        // untransformed stack-local center into stable header coordinates rather
        // than using the center of its entire metadata stack.
        let expandedStackCenterY = expandedHeaderHeight
            - AlmidyDesignTokens.TripOverview.destinationBlockBottomInset
            - expandedLabels.bounds.height / 2
        let expandedTitleCenterY = expandedStackCenterY
            + titleLabel.center.y
            - expandedLabels.bounds.midY
        let compactTitleCenterY = moreButton.center.y
            + NativeTripOverviewHeaderTransition.compactToolbarVerticalOffset
            + compactTitleLabel.center.y
            - compactLabels.bounds.midY
        return (expandedTitleCenterY, compactTitleCenterY)
    }
    var customGrabberCount: Int {
        subviews.filter { $0.accessibilityIdentifier == "trip-overview-measure-header-grabber" }.count
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        accessibilityIdentifier = "trip-overview-header"
        layer.cornerRadius = AlmidyDesignTokens.TripOverview.sheetCornerRadius
        layer.cornerCurve = .continuous
        layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        layer.masksToBounds = true
        configureContent()
        configureControls()
        configureLayout()
        NotificationCenter.default.addObserver(self, selector: #selector(accessibilitySettingsDidChange), name: UIAccessibility.darkerSystemColorsStatusDidChangeNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(accessibilitySettingsDidChange), name: UIAccessibility.reduceMotionStatusDidChangeNotification, object: nil)
        updateTransition(progress: 0)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    deinit { imageTask?.cancel(); NotificationCenter.default.removeObserver(self) }

    func render(hero: NativeTripOverview.Hero, trip: NativeTripOverview.Trip, stale: Bool) {
        let timing = Self.timingText(relativeTiming: trip.relativeTiming, durationDays: trip.durationDays, stale: stale)
        let attribution = Self.attributionText(source: hero.sourceLabel, attribution: hero.attribution)
        render(
            title: trip.title,
            countryCode: trip.countryCode,
            dateRange: trip.dateRange,
            timing: timing,
            attribution: attribution,
            // The seed is the exact image already rendered by My Trips. Prefer it so
            // opening the overview never swaps a proven image for a stale API URL.
            imageURL: seedImageURL ?? hero.imageURL,
            fallbackColor: hero.fallbackColor
        )
    }

    func render(seed: NativeTripOverviewSeed, image: UIImage? = nil) {
        seedImageURL = seed.imageURL
        seedImage = image
        render(
            title: seed.title,
            countryCode: nil,
            dateRange: seed.dateRange,
            timing: nil,
            attribution: nil,
            imageURL: seed.imageURL,
            fallbackColor: seed.fallbackColor
        )
    }

    func updateTransition(progress: CGFloat, expandedContentOffset: CGFloat? = nil) {
        if let expandedContentOffset {
            expandedContentScrollOffset = max(0, expandedContentOffset)
        }
        let state = NativeTripOverviewHeaderTransition(
            progress: progress,
            reduceMotion: UIAccessibility.isReduceMotionEnabled
        )
        transitionProgress = state.progress

        // The fixed toolbar surface sits above the moving expanded identity. Its
        // earlier wash masks that identity as it passes beneath the controls;
        // the compact identity does not appear until that clipping is nearly done.
        imageView.alpha = usesExternalHeroBackdrop ? 0 : state.imageAlpha
        gradientView.alpha = usesExternalHeroBackdrop ? 0 : state.gradientAlpha
        // The continuous hero backdrop already resolves into the exact compact
        // sheet surface. Layering a second translucent field over it creates a
        // visible fog band across cards as they pass beneath the toolbar.
        compactBackground.alpha = usesExternalHeroBackdrop ? 0 : state.compactBackgroundAlpha
        expandedLabels.alpha = state.expandedAlpha
        compactLabels.alpha = state.compactAlpha
        // Expanded metadata belongs to the photographic content, so it follows
        // the same upward travel as the Add Activity group. Compact metadata is
        // independently pinned and takes over during the crossfade.
        expandedLabels.transform = CGAffineTransform(
            translationX: 0,
            y: -expandedContentScrollOffset
        )
        compactLabels.transform = state.compactTransform.translatedBy(
            x: 0,
            y: state.toolbarVerticalOffset
        )
        let controlTransform = CGAffineTransform(
            translationX: 0,
            y: state.toolbarVerticalOffset
        )
        [moreButton, searchButton, closeButton].forEach { $0.transform = controlTransform }
        let compactMetadataIsPrimary = state.compactAlpha >= state.expandedAlpha
        expandedLabels.accessibilityElementsHidden = compactMetadataIsPrimary
        compactLabels.accessibilityElementsHidden = !compactMetadataIsPrimary
        grabberView.alpha = 1

        applyControlStyle(state)
    }

    func setUsesExternalHeroBackdrop(_ enabled: Bool) {
        usesExternalHeroBackdrop = enabled
        if enabled { backgroundColor = .clear }
        updateTransition(progress: transitionProgress)
    }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        // In the large detent this view intentionally remains hero-height while
        // cards scroll beneath it. Only fixed controls retain hit regions; every
        // transparent/header-label area passes gestures through to the scroll view.
        [moreButton, searchButton, closeButton].contains { control in
            guard !control.isHidden, control.alpha > 0.01 else { return false }
            let hitBounds = control.bounds.insetBy(dx: -8, dy: -8)
            return control.convert(hitBounds, to: self).contains(point)
        }
    }

    private func configureContent() {
        grabberView.accessibilityIdentifier = "trip-overview-measure-header-grabber"
        imageView.accessibilityIdentifier = "trip-overview-measure-header-image-region"
        gradientView.accessibilityIdentifier = "trip-overview-measure-header-fade-region"
        imageView.clipsToBounds = true
        imageView.accessibilityIgnoresInvertColors = true
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imagePlaceholder.isHidden = true
        imagePlaceholder.isAccessibilityElement = false
        imagePlaceholder.accessibilityLabel = nil
        imageLoadingIndicator.color = .white; imageLoadingIndicator.hidesWhenStopped = true
        imageLoadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        imageLoadingIndicator.isAccessibilityElement = true; imageLoadingIndicator.accessibilityLabel = "Loading trip photo"
        grabberView.backgroundColor = UIColor.white.withAlphaComponent(0.58)
        grabberView.layer.cornerRadius = 2.5
        grabberView.translatesAutoresizingMaskIntoConstraints = false
        grabberView.isUserInteractionEnabled = false
        applyContrast()
        gradientView.translatesAutoresizingMaskIntoConstraints = false
        compactBackground.translatesAutoresizingMaskIntoConstraints = false

        flagLabel.font = UIFontMetrics(forTextStyle: .title2).scaledFont(
            for: AlmidyDesignTokens.TripOverview.countryFlagFont
        )
        flagLabel.adjustsFontForContentSizeCategory = true
        flagLabel.textAlignment = .center
        flagLabel.backgroundColor = UIColor.white.withAlphaComponent(0.92)
        flagLabel.layer.cornerRadius = AlmidyDesignTokens.TripOverview.countryFlagDiameter / 2
        flagLabel.layer.cornerCurve = .continuous
        flagLabel.layer.borderWidth = AlmidyDesignTokens.TripOverview.countryFlagBorderWidth
        flagLabel.layer.borderColor = UIColor.label.withAlphaComponent(0.28).cgColor
        flagLabel.layer.masksToBounds = true
        flagLabel.isAccessibilityElement = false
        flagLabel.widthAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.countryFlagDiameter).isActive = true
        flagLabel.heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.countryFlagDiameter).isActive = true

        configureLabel(titleLabel, font: AlmidyDesignTokens.Font.semibold(30), textStyle: .title1, color: AlmidyDesignTokens.Color.tripCardTextPrimary)
        titleLabel.accessibilityIdentifier = "trip-overview-measure-header-title"
        titleLabel.numberOfLines = 2
        titleLabel.lineBreakMode = .byWordWrapping
        configureLabel(timingLabel, font: AlmidyDesignTokens.Font.body(14), textStyle: .subheadline, color: AlmidyDesignTokens.Color.tripOverviewMetadataPrimary)
        timingLabel.accessibilityIdentifier = "trip-overview-measure-header-timing"
        configureLabel(dateLabel, font: AlmidyDesignTokens.Font.body(13), textStyle: .caption1, color: AlmidyDesignTokens.Color.tripOverviewMetadataSecondary)
        dateLabel.accessibilityIdentifier = "trip-overview-measure-header-date"
        configureLabel(attributionLabel, font: AlmidyDesignTokens.Font.body(11), textStyle: .caption2, color: AlmidyDesignTokens.Color.tripCardTextTertiary)
        attributionLabel.numberOfLines = 2

        expandedLabels.axis = .vertical
        expandedLabels.accessibilityIdentifier = "trip-overview-measure-header-expanded-labels"
        expandedLabels.spacing = 2
        expandedLabels.alignment = .center
        expandedLabels.translatesAutoresizingMaskIntoConstraints = false
        expandedLabels.isAccessibilityElement = true
        expandedLabels.accessibilityTraits = [.header]
        [flagLabel, titleLabel, timingLabel, dateLabel, attributionLabel].forEach(expandedLabels.addArrangedSubview)
        expandedLabels.setCustomSpacing(AlmidyDesignTokens.TripOverview.countryFlagTitleGap, after: flagLabel)
        expandedLabels.setCustomSpacing(4, after: dateLabel)

        configureLabel(compactTitleLabel, font: AlmidyDesignTokens.TripOverview.headingFont, textStyle: .headline, color: AlmidyDesignTokens.Color.tripCardTextPrimary)
        compactTitleLabel.numberOfLines = 2
        compactTitleLabel.accessibilityIdentifier = "trip-overview-measure-header-compact-title"
        compactTitleLabel.lineBreakMode = .byTruncatingTail
        configureLabel(compactDateLabel, font: AlmidyDesignTokens.TripOverview.metadataFont, textStyle: .caption1, color: AlmidyDesignTokens.Color.tripCardTextTertiary)
        compactDateLabel.numberOfLines = 2
        compactDateLabel.accessibilityIdentifier = "trip-overview-measure-header-compact-date"
        compactLabels.axis = .vertical
        compactLabels.spacing = 0
        compactLabels.alignment = .center
        compactLabels.accessibilityIdentifier = "trip-overview-measure-header-compact-labels"
        compactLabels.translatesAutoresizingMaskIntoConstraints = false
        compactLabels.isAccessibilityElement = true
        compactLabels.accessibilityTraits = [.header]
        compactLabels.addArrangedSubview(compactTitleLabel)
        compactLabels.addArrangedSubview(compactDateLabel)
    }

    private func configureControls() {
        configureButton(moreButton, systemName: "ellipsis", label: "More trip options", hint: "Shows additional actions for this trip")
        configureButton(
            searchButton,
            systemName: "magnifyingglass",
            label: "Search saved activities and documents",
            hint: "Searches items saved to this trip"
        )
        configureButton(closeButton, systemName: "xmark", label: "Close trip overview", hint: "Returns to the globe")
        moreButton.accessibilityIdentifier = "trip-overview-measure-header-more"
        searchButton.accessibilityIdentifier = "trip-overview-measure-header-search"
        closeButton.accessibilityIdentifier = "trip-overview-measure-header-close"
    }

    private func configureLayout() {
        compactBackground.accessibilityIdentifier = "trip-overview-measure-header-compact-background"
        // `compactBackground` must be above `expandedLabels`: it is the fixed
        // toolbar mask that the scrolling title travels underneath. Keeping the
        // compact labels and controls above both preserves the pinned identity.
        [imageView, gradientView, expandedLabels, compactBackground, compactLabels, imageLoadingIndicator, moreButton, searchButton, closeButton, grabberView].forEach(addSubview)
        accessibilityElements = [moreButton, searchButton, closeButton, expandedLabels, compactLabels, imageLoadingIndicator]
        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: topAnchor), imageView.leadingAnchor.constraint(equalTo: leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: trailingAnchor), imageView.bottomAnchor.constraint(equalTo: bottomAnchor),
            imageLoadingIndicator.centerXAnchor.constraint(equalTo: centerXAnchor), imageLoadingIndicator.centerYAnchor.constraint(equalTo: centerYAnchor),
            grabberView.centerXAnchor.constraint(equalTo: centerXAnchor),
            // This fixed anchor is shared by expanded, midpoint, and compact states.
            // Five points matches the lower reference placement without allowing
            // the handle to drift as the header height collapses.
            grabberView.topAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor, constant: 5),
            grabberView.widthAnchor.constraint(equalToConstant: 38),
            grabberView.heightAnchor.constraint(equalToConstant: 5),
            gradientView.topAnchor.constraint(equalTo: topAnchor), gradientView.leadingAnchor.constraint(equalTo: leadingAnchor),
            gradientView.trailingAnchor.constraint(equalTo: trailingAnchor), gradientView.bottomAnchor.constraint(equalTo: bottomAnchor),
            // The compact contrast field belongs to the persistent top header,
            // not the entire expanded hero. Filling the changing header height
            // creates a hard rectangular veil across the destination image as
            // soon as the pinned title begins to appear.
            compactBackground.topAnchor.constraint(equalTo: topAnchor), compactBackground.leadingAnchor.constraint(equalTo: leadingAnchor),
            compactBackground.trailingAnchor.constraint(equalTo: trailingAnchor),
            compactBackground.heightAnchor.constraint(equalToConstant: NativeTripOverviewCompactGradient.surfaceHeight),

            moreButton.leadingAnchor.constraint(
                equalTo: leadingAnchor,
                constant: AlmidyDesignTokens.TripOverview.headerControlSideInset
            ),
            moreButton.topAnchor.constraint(
                equalTo: safeAreaLayoutGuide.topAnchor,
                constant: AlmidyDesignTokens.TripOverview.headerControlTopInset
            ),
            searchButton.leadingAnchor.constraint(
                equalTo: moreButton.trailingAnchor,
                constant: AlmidyDesignTokens.TripOverview.headerControlGap
            ),
            searchButton.topAnchor.constraint(equalTo: moreButton.topAnchor),
            closeButton.trailingAnchor.constraint(
                equalTo: trailingAnchor,
                constant: -AlmidyDesignTokens.TripOverview.headerControlSideInset
            ),
            closeButton.topAnchor.constraint(equalTo: moreButton.topAnchor),
            moreButton.widthAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.headerControlDiameter),
            moreButton.heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.headerControlDiameter),
            searchButton.widthAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.headerControlDiameter),
            searchButton.heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.headerControlDiameter),
            closeButton.widthAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.headerControlDiameter),
            closeButton.heightAnchor.constraint(equalToConstant: AlmidyDesignTokens.TripOverview.headerControlDiameter),

            expandedLabels.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 24),
            expandedLabels.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -24),
            expandedLabels.centerXAnchor.constraint(equalTo: centerXAnchor),
            expandedLabels.bottomAnchor.constraint(
                equalTo: bottomAnchor,
                constant: -AlmidyDesignTokens.TripOverview.destinationBlockBottomInset
            ),
            // Keep the compact destination on the sheet's horizontal axis. The
            // inequalities protect it from both controls and provide the width
            // needed for a long title to wrap/truncate without shifting left.
            compactLabels.centerXAnchor.constraint(equalTo: centerXAnchor),
            compactLabels.leadingAnchor.constraint(greaterThanOrEqualTo: searchButton.trailingAnchor, constant: 12),
            compactLabels.trailingAnchor.constraint(lessThanOrEqualTo: closeButton.leadingAnchor, constant: -12),
            compactLabels.centerYAnchor.constraint(equalTo: moreButton.centerYAnchor)
        ])
    }

    private func render(
        title: String,
        countryCode: String?,
        dateRange: String,
        timing: String?,
        attribution: String?,
        imageURL: URL?,
        fallbackColor: String
    ) {
        titleLabel.text = title
        compactTitleLabel.text = title
        let displayedDateRange = Self.displayDateRange(dateRange)
        dateLabel.text = displayedDateRange
        compactDateLabel.text = displayedDateRange
        timingLabel.text = timing
        timingLabel.isHidden = timing == nil
        attributionLabel.text = attribution
        attributionLabel.isHidden = attribution == nil
        flagLabel.text = Self.flagEmoji(countryCode: countryCode)
        flagLabel.isHidden = !showsCountryFlag || flagLabel.text == nil
        let expandedSummary = [title, timing, displayedDateRange, attribution].compactMap { $0 }.joined(separator: ", ")
        expandedLabels.accessibilityLabel = expandedSummary
        compactLabels.accessibilityLabel = [title, displayedDateRange].joined(separator: ", ")
        accessibilityLabel = expandedSummary

        let fallback = UIColor(almidyHex: fallbackColor) ?? AlmidyDesignTokens.Color.generatedTripImageBase
        let fallbackPalette = NativeTripOverviewHeroColorProcessor.palette(
            top: fallback,
            bottom: fallback,
            dominant: fallback
        )
        heroTintColor = fallbackPalette.transition
        sheetTintColor = fallbackPalette.sheet
        compactTintColor = fallbackPalette.compact
        backgroundColor = usesExternalHeroBackdrop ? .clear : fallbackPalette.sheet
        grabberView.backgroundColor = NativeTripOverviewHeroColorProcessor.compactGrabberColor(
            for: fallbackPalette.compact
        )
        applyContrast()
        onBackgroundColor?(fallbackPalette.sheet)

        let resolvedURL = imageURL.flatMap {
            URL(string: $0.relativeString, relativeTo: NativeServiceConfiguration.appBaseURL)?.absoluteURL
        }
        let retainedImage = seedImage ?? (resolvedURL == displayedImageURL ? imageView.image : nil)
        onHeroContinuation?(retainedImage, fallbackPalette.transition, fallbackPalette.sheet)
        imageTask?.cancel()
        imageView.setHeroImage(retainedImage)
        imagePlaceholder.isHidden = true
        imagePlaceholder.accessibilityLabel = nil
        imageLoadingIndicator.stopAnimating()

        if let image = retainedImage {
            displayedImageURL = resolvedURL
            applyHeroColors(from: image)
            return
        }

        displayedImageURL = nil
        guard let url = resolvedURL else { return }
        imageLoadingIndicator.startAnimating()
        imageTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self else { return }
            DispatchQueue.main.async {
                self.imageLoadingIndicator.stopAnimating()
                guard let data, let image = UIImage(data: data) else {
                    return
                }
                self.displayedImageURL = url
                self.imageView.setHeroImage(image)
                self.imagePlaceholder.isHidden = true
                self.applyHeroColors(from: image)
            }
        }
        imageTask?.resume()
    }

    private func applyHeroColors(from image: UIImage) {
        guard let dominant = image.almidyAverageColor else { return }
        let palette = NativeTripOverviewHeroColorProcessor.palette(
            top: image.almidyTopBandColor,
            bottom: image.almidyBottomBandColor,
            dominant: dominant
        )
        heroTintColor = palette.transition
        sheetTintColor = palette.sheet
        compactTintColor = palette.compact
        grabberView.backgroundColor = NativeTripOverviewHeroColorProcessor.compactGrabberColor(
            for: palette.compact
        )
        applyContrast()
        onBackgroundColor?(palette.sheet)
        onHeroContinuation?(image, palette.transition, palette.sheet)
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if previousTraitCollection?.accessibilityContrast != traitCollection.accessibilityContrast { applyContrast() }
    }

    private func applyContrast() {
        let increased = traitCollection.accessibilityContrast == .high || UIAccessibility.isDarkerSystemColorsEnabled
        gradientView.colors = NativeTripOverviewHeroGradient.colors(
            transition: heroTintColor,
            sheet: sheetTintColor,
            increasedContrast: increased
        )
        compactBackground.colors = NativeTripOverviewCompactGradient.colors(
            compact: compactTintColor,
            sheet: sheetTintColor,
            increasedContrast: increased
        )
        applyControlStyle(
            NativeTripOverviewHeaderTransition(
                progress: transitionProgress,
                reduceMotion: UIAccessibility.isReduceMotionEnabled
            )
        )
    }

    private func applyControlStyle(_ state: NativeTripOverviewHeaderTransition) {
        let increased = traitCollection.accessibilityContrast == .high || UIAccessibility.isDarkerSystemColorsEnabled
        controlMaterialViews.forEach { $0.alpha = state.controlMaterialAlpha }
        [moreButton, searchButton, closeButton].forEach {
            $0.tintColor = .label
            $0.imageView?.alpha = 1
            $0.backgroundColor = UIColor.white.withAlphaComponent(state.controlFillAlpha)
            $0.layer.borderColor = UIColor.label.withAlphaComponent(
                increased ? max(0.30, state.controlBorderAlpha) : state.controlBorderAlpha
            ).cgColor
            $0.layer.borderWidth = increased
                ? max(1.25, state.controlBorderWidth)
                : state.controlBorderWidth
        }
    }

    @objc private func accessibilitySettingsDidChange() {
        applyContrast(); updateTransition(progress: transitionProgress)
    }

    private func configureLabel(_ label: UILabel, font: UIFont, textStyle: UIFont.TextStyle, color: UIColor) {
        label.font = UIFontMetrics(forTextStyle: textStyle).scaledFont(for: font)
        label.adjustsFontForContentSizeCategory = true
        label.textColor = color
        label.textAlignment = .center
    }

    private func configureButton(_ button: UIButton, systemName: String, label: String, hint: String) {
        let symbol = UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold)
        button.setImage(UIImage(systemName: systemName, withConfiguration: symbol), for: .normal)
        button.tintColor = .label
        button.backgroundColor = .clear
        button.layer.cornerRadius = AlmidyDesignTokens.TripOverview.headerControlDiameter / 2
        button.layer.cornerCurve = .continuous
        button.layer.borderWidth = 1
        button.layer.borderColor = UIColor.label.withAlphaComponent(0.28).cgColor
        button.clipsToBounds = true

        let material = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterialLight))
        material.isUserInteractionEnabled = false
        material.translatesAutoresizingMaskIntoConstraints = false
        button.insertSubview(material, at: 0)
        NSLayoutConstraint.activate([
            material.leadingAnchor.constraint(equalTo: button.leadingAnchor),
            material.trailingAnchor.constraint(equalTo: button.trailingAnchor),
            material.topAnchor.constraint(equalTo: button.topAnchor),
            material.bottomAnchor.constraint(equalTo: button.bottomAnchor)
        ])
        controlMaterialViews.append(material)
        button.accessibilityLabel = label
        button.accessibilityHint = hint
        button.accessibilityTraits.insert(.button)
        button.translatesAutoresizingMaskIntoConstraints = false
    }

    private static func timingText(relativeTiming: String?, durationDays: Int?, stale: Bool) -> String? {
        let timing = stale ? "Saved details" : relativeTiming
        let duration = durationDays.map { "\($0)-day trip" }
        return [timing, duration].compactMap { $0 }.joined(separator: " • ").nilIfEmpty
    }

    private static func displayDateRange(_ value: String) -> String {
        value
            .replacingOccurrences(of: " – ", with: " → ")
            .replacingOccurrences(of: " - ", with: " → ")
    }

    private static func attributionText(source: String?, attribution: String?) -> String? {
        var values: [String] = []
        for value in [source, attribution].compactMap({ $0?.trimmingCharacters(in: .whitespacesAndNewlines) }) where !value.isEmpty {
            // Resolver/source identifiers are internal provenance, not photo credits.
            // Existing trips may already contain this value in persisted metadata, so
            // filter it at the final presentation boundary as well as on the server.
            guard !isInternalAttributionIdentifier(value) else { continue }
            if !values.contains(where: { $0.caseInsensitiveCompare(value) == .orderedSame }) { values.append(value) }
        }
        guard !values.isEmpty else { return nil }
        return "Photo: " + values.joined(separator: " · ")
    }

    private static func isInternalAttributionIdentifier(_ value: String) -> Bool {
        let normalized = value.lowercased().replacingOccurrences(of: "-", with: "_")
        return normalized == "native_destination_resolver" || normalized.hasPrefix("internal_")
    }

    private static func flagEmoji(countryCode: String?) -> String? {
        guard let code = countryCode?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(), code.count == 2,
              code.unicodeScalars.allSatisfy({ (65...90).contains($0.value) }) else { return nil }
        return code.unicodeScalars.compactMap { UnicodeScalar(127397 + $0.value).map(String.init) }.joined()
    }
}

/// Aspect-fill image view with a stable center-biased focal rule. The expanded
/// hero retains a larger source window while this anchor favors enough lower-image
/// content to keep a landmark's base visible along with its upper subject.
final class NativeTripOverviewFocalImageView: UIImageView {
    static let defaultVerticalFocalPosition: CGFloat = 0.48
    let verticalFocalPosition: CGFloat
    private(set) var sourceCropRect = CGRect(x: 0, y: 0, width: 1, height: 1)
    private var verticalContentTranslation: CGFloat = 0

    init(verticalFocalPosition: CGFloat = defaultVerticalFocalPosition) {
        self.verticalFocalPosition = min(max(verticalFocalPosition, 0), 1)
        super.init(frame: .zero)
        contentMode = .scaleToFill
        layer.contentsGravity = .resize
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setHeroImage(_ image: UIImage?) {
        self.image = image
        updateSourceCrop()
    }

    /// Moves the photograph's subject inside this fixed hero viewport. Keeping
    /// the image view itself stationary prevents its lower edge from travelling
    /// behind later overview cards during the parallax transition.
    func setVerticalContentTranslation(_ translation: CGFloat) {
        verticalContentTranslation = max(0, translation)
        updateSourceCrop()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        updateSourceCrop()
    }

    static func sourceCropRect(
        imageSize: CGSize,
        containerSize: CGSize,
        verticalFocalPosition: CGFloat = defaultVerticalFocalPosition,
        verticalContentTranslation: CGFloat = 0
    ) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0,
              containerSize.width > 0, containerSize.height > 0 else {
            return CGRect(x: 0, y: 0, width: 1, height: 1)
        }
        let imageAspect = imageSize.width / imageSize.height
        let containerAspect = containerSize.width / containerSize.height
        if imageAspect >= containerAspect {
            let width = containerAspect / imageAspect
            return CGRect(x: (1 - width) / 2, y: 0, width: width, height: 1)
        }
        let height = imageAspect / containerAspect
        let focal = min(max(verticalFocalPosition, 0), 1)
        // Moving the crop upward in source coordinates makes the visible subject
        // drift downward while the viewport continues to cover the same bounds.
        let translatedSourceDistance = max(0, verticalContentTranslation)
            / containerSize.height
            * height
        let originY = min(
            max(focal - (height / 2) - translatedSourceDistance, 0),
            1 - height
        )
        return CGRect(x: 0, y: originY, width: 1, height: height)
    }

    private func updateSourceCrop() {
        sourceCropRect = Self.sourceCropRect(
            imageSize: image?.size ?? .zero,
            containerSize: bounds.size,
            verticalFocalPosition: verticalFocalPosition,
            verticalContentTranslation: verticalContentTranslation
        )
        layer.contentsRect = sourceCropRect
    }
}

final class NativeTripOverviewMinimumHitButton: UIButton {
    let minimumHitTarget = CGSize(
        width: AlmidyDesignTokens.Component.TripOverview.minimumInteractiveTarget,
        height: AlmidyDesignTokens.Component.TripOverview.minimumInteractiveTarget
    )

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        let horizontal = max(0, (minimumHitTarget.width - bounds.width) / 2)
        let vertical = max(0, (minimumHitTarget.height - bounds.height) / 2)
        return bounds.insetBy(dx: -horizontal, dy: -vertical).contains(point)
    }


    override func accessibilityActivate() -> Bool {
        guard isEnabled else { return false }
        sendActions(for: .touchUpInside)
        return true
    }
}

struct NativeTripOverviewHeaderTransition: Equatable {
    static let compactToolbarVerticalOffset: CGFloat =
        AlmidyDesignTokens.Component.TripOverview.CollapsedComposition.controlTopInset
        - AlmidyDesignTokens.Component.TripOverview.headerControlTopInset

    let progress: CGFloat
    let easedProgress: CGFloat
    let imageAlpha: CGFloat
    let externalHeroAlpha: CGFloat
    let gradientAlpha: CGFloat
    let compactBackgroundAlpha: CGFloat
    let expandedAlpha: CGFloat
    let compactAlpha: CGFloat
    let compactTransform: CGAffineTransform
    let controlMaterialAlpha: CGFloat
    let controlFillAlpha: CGFloat
    let controlBorderAlpha: CGFloat
    let controlBorderWidth: CGFloat
    let toolbarVerticalOffset: CGFloat

    init(progress: CGFloat, reduceMotion: Bool) {
        let clamped = min(1, max(0, progress))
        let eased = reduceMotion ? clamped : clamped * clamped * (3 - 2 * clamped)
        self.progress = clamped
        self.easedProgress = eased
        imageAlpha = NativeTripOverviewHeroGradient.imageAlpha(progress: clamped)
        // Keep the continuation alive throughout collapse. The lower opaque hero
        // gradient moves upward to conceal the photograph; fading this whole view
        // would incorrectly wash out the image from every edge at once.
        externalHeroAlpha = 1
        gradientAlpha = 1 - eased * 0.10
        // The expanded identity primarily disappears by travelling under the
        // fixed toolbar mask. Alpha only finishes that exit near collision. The
        // compact identity starts afterward, keeping both titles from becoming
        // simultaneously readable.
        expandedAlpha = 1 - Self.smoothStep(from: 0.74, to: 0.94, value: clamped)
        compactAlpha = Self.smoothStep(from: 0.86, to: 1.0, value: clamped)
        // Do not reveal a rectangular toolbar band while the photograph is
        // still legible. The fixed surface only resolves during the identity
        // handoff, after the moving title has nearly reached its destination.
        compactBackgroundAlpha = Self.smoothStep(from: 0.86, to: 1.0, value: clamped)
        // Expanded controls retain their photographic material. During collapse,
        // that material recedes while a darker translucent fill takes over; the
        // border simultaneously becomes quieter instead of forming a bright ring.
        controlMaterialAlpha = 0.72 - eased * 0.15
        controlFillAlpha = 0.72 + eased * 0.08
        controlBorderAlpha = 0.28 - eased * 0.08
        controlBorderWidth = 1
        toolbarVerticalOffset = Self.compactToolbarVerticalOffset * eased

        // The compact identity is already pinned to its final toolbar geometry;
        // only opacity participates in the handoff seen in the reference video.
        compactTransform = .identity
    }

    private static func smoothStep(from lowerBound: CGFloat, to upperBound: CGFloat, value: CGFloat) -> CGFloat {
        guard upperBound > lowerBound else { return value >= upperBound ? 1 : 0 }
        let normalized = min(1, max(0, (value - lowerBound) / (upperBound - lowerBound)))
        return normalized * normalized * (3 - 2 * normalized)
    }
}

final class NativeTripOverviewGradientView: UIView {
    override class var layerClass: AnyClass { CAGradientLayer.self }
    var colors: [UIColor] = [] { didSet { gradient.colors = colors.map(\.cgColor) } }
    var locations: [NSNumber] = NativeTripOverviewHeroGradient.locations {
        didSet { gradient.locations = locations }
    }
    private var gradient: CAGradientLayer { layer as! CAGradientLayer }
    override init(frame: CGRect) {
        super.init(frame: frame)
        gradient.startPoint = CGPoint(x: 0.5, y: 0)
        gradient.endPoint = CGPoint(x: 0.5, y: 1)
        gradient.locations = NativeTripOverviewHeroGradient.locations
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

final class NativeTripOverviewCompactSurfaceView: UIView {
    override class var layerClass: AnyClass { CAGradientLayer.self }
    var colors: [UIColor] = [] { didSet { gradient.colors = colors.map(\.cgColor) } }
    private var gradient: CAGradientLayer { layer as! CAGradientLayer }

    override init(frame: CGRect) {
        super.init(frame: frame)
        gradient.startPoint = CGPoint(x: 0.5, y: 0)
        gradient.endPoint = CGPoint(x: 0.5, y: 1)
        gradient.locations = NativeTripOverviewCompactGradient.locations
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

enum NativeTripOverviewCompactGradient {
    // The compact header is a fixed surface above the scrolling hero. Its lower
    // edge dissolves so the pinned controls never expose a hard panel boundary.
    static let locations: [NSNumber] = [0.0, 0.44, 0.76, 1.0]
    // Continue well below the controls so the tint dissolves over a broad field
    // instead of producing a dark horizontal seam at the toolbar boundary.
    static let surfaceHeight: CGFloat =
        AlmidyDesignTokens.TripOverview.headerControlTopInset
        + AlmidyDesignTokens.TripOverview.headerControlDiameter
        + 68

    static func colors(compact: UIColor, sheet: UIColor, increasedContrast: Bool) -> [UIColor] {
        [
            compact.withAlphaComponent(increasedContrast ? 0.76 : 0.56),
            compact.withAlphaComponent(increasedContrast ? 0.62 : 0.44),
            compact.withAlphaComponent(increasedContrast ? 0.34 : 0.20),
            .clear
        ]
    }
}

enum NativeTripOverviewHeroGradient {
    // A broad neutral wash creates the reference's fog-like transition: the upper
    // photograph remains clear, detail softens around the destination metadata,
    // and the lower action region resolves into the exact sheet surface.
    static let locations: [NSNumber] = [0.0, 0.36, 0.50, 0.62, 0.74, 0.88]
    private static let collapsedLocations: [CGFloat] = [0.0, 0.20, 0.32, 0.46, 0.62, 0.82]

    static func locations(progress: CGFloat) -> [NSNumber] {
        let progress = min(1, max(0, progress))
        return zip(locations.map(\.doubleValue), collapsedLocations).map { expanded, collapsed in
            NSNumber(value: expanded + (Double(collapsed) - expanded) * Double(progress))
        }
    }

    static func imageAlpha(progress: CGFloat) -> CGFloat {
        1 - smoothStep(edge0: 0.14, edge1: 0.98, value: progress)
    }

    static func washProgress(progress: CGFloat) -> CGFloat {
        smoothStep(edge0: 0.08, edge1: 0.94, value: progress)
    }

    private static func smoothStep(edge0: CGFloat, edge1: CGFloat, value: CGFloat) -> CGFloat {
        guard edge1 > edge0 else { return value >= edge1 ? 1 : 0 }
        let normalized = min(1, max(0, (value - edge0) / (edge1 - edge0)))
        return normalized * normalized * (3 - 2 * normalized)
    }

    static func colors(transition: UIColor, sheet: UIColor, increasedContrast: Bool) -> [UIColor] {
        [
            .clear,
            transition.withAlphaComponent(increasedContrast ? 0.12 : 0.08),
            transition.withAlphaComponent(increasedContrast ? 0.40 : 0.32),
            transition.withAlphaComponent(increasedContrast ? 0.80 : 0.72),
            sheet,
            sheet
        ]
    }

}

struct NativeTripOverviewHeroPalette {
    let topContrast: UIColor
    let transition: UIColor
    let sheet: UIColor
    let compact: UIColor
}

enum NativeTripOverviewHeroColorProcessor {
    static let guardrailSurface = AlmidyDesignTokens.Color.generatedTripImageBase
    static let guardrailCompactSurface = compactSurface(from: guardrailSurface)

    static func palette(top: UIColor?, bottom: UIColor?, dominant: UIColor?) -> NativeTripOverviewHeroPalette {
        // The terminal surface visually grows out of the photograph's lower edge.
        // Prefer that region over the whole-image average, which can be dominated
        // by a large sky and incorrectly turn a warm destination neutral gray.
        let source = bottom ?? dominant ?? top ?? guardrailSurface
        return NativeTripOverviewHeroPalette(
            topContrast: (top ?? source).almidyGrabberColor,
            transition: mutedSurface(from: bottom ?? source, burgundyBias: 0.04),
            sheet: mutedSurface(from: source, burgundyBias: 0.02),
            compact: compactSurface(from: source)
        )
    }

    static func compactSurface(from color: UIColor) -> UIColor {
        var hue: CGFloat = 0, saturation: CGFloat = 0, brightness: CGFloat = 0, alpha: CGFloat = 0
        guard color.getHue(&hue, saturation: &saturation, brightness: &brightness, alpha: &alpha) else {
            return UIColor(red: 0.20, green: 0.20, blue: 0.21, alpha: 1)
        }
        // Retain enough of the photograph's hue to make the compact surface belong
        // to the trip, but cap luminance for dependable white-label contrast.
        let derived = UIColor(
            hue: hue,
            saturation: min(0.28, max(0.08, saturation * 0.42)),
            brightness: min(0.34, max(0.24, brightness * 0.48)),
            alpha: 1
        )
        return derived.scaledToMaximumRelativeLuminance(0.09)
    }

    static func compactGrabberColor(for surface: UIColor) -> UIColor {
        surface.almidyCompactGrabberColor
    }

    static func mutedSurface(from color: UIColor, burgundyBias: CGFloat) -> UIColor {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        guard color.getRed(&red, green: &green, blue: &blue, alpha: &alpha) else {
            return guardrailSurface
        }

        let source = UIColor(red: red, green: green, blue: blue, alpha: 1)
        var hue: CGFloat = 0, saturation: CGFloat = 0, brightness: CGFloat = 0
        guard source.getHue(&hue, saturation: &saturation, brightness: &brightness, alpha: &alpha) else {
            return guardrailSurface
        }

        // Preserve the destination hue while keeping white metadata comfortably
        // readable. Only low-chroma inputs receive a small saturation lift.
        let safeSaturation = min(0.18, max(0.04, saturation * 0.30))
        let safeBrightness = min(0.52, max(0.42, brightness * 0.80))
        let huePreserving = UIColor(hue: hue, saturation: safeSaturation, brightness: safeBrightness, alpha: 1)
        let burgundy = UIColor(red: 0.30, green: 0.17, blue: 0.22, alpha: 1)
        let biased = huePreserving.blended(with: burgundy, fraction: burgundyBias) ?? huePreserving
        return biased.scaledToMaximumRelativeLuminance(0.18)
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

private extension UIColor {
    convenience init?(almidyHex value: String) {
        let text = value.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        guard text.count == 6, let number = UInt64(text, radix: 16) else { return nil }
        self.init(red: CGFloat((number >> 16) & 0xff) / 255, green: CGFloat((number >> 8) & 0xff) / 255, blue: CGFloat(number & 0xff) / 255, alpha: 1)
    }

    var almidyGrabberColor: UIColor {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        guard getRed(&red, green: &green, blue: &blue, alpha: &alpha) else {
            return UIColor.white.withAlphaComponent(0.58)
        }
        let luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
        return luminance > 0.58
            ? UIColor.black.withAlphaComponent(0.68)
            : UIColor.white.withAlphaComponent(0.82)
    }

    var almidyCompactGrabberColor: UIColor {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        guard getRed(&red, green: &green, blue: &blue, alpha: &alpha) else {
            return UIColor.black.withAlphaComponent(0.72)
        }
        func linear(_ component: CGFloat) -> CGFloat {
            component <= 0.04045 ? component / 12.92 : pow((component + 0.055) / 1.055, 2.4)
        }
        let luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
        // The reference uses a charcoal handle whenever the adaptive compact
        // surface is light enough to support it; only truly dark surfaces invert.
        return luminance > 0.055
            ? UIColor.black.withAlphaComponent(0.72)
            : UIColor.white.withAlphaComponent(0.80)
    }

    var almidyControlHighlight: UIColor {
        var hue: CGFloat = 0, saturation: CGFloat = 0, brightness: CGFloat = 0, alpha: CGFloat = 0
        guard getHue(&hue, saturation: &saturation, brightness: &brightness, alpha: &alpha) else {
            return UIColor.white
        }
        return UIColor(
            hue: hue,
            saturation: min(max(saturation * 0.55, 0.10), 0.34),
            brightness: max(brightness, 0.96),
            alpha: 1
        )
    }

    func blended(with other: UIColor, fraction: CGFloat) -> UIColor? {
        var r1: CGFloat = 0, g1: CGFloat = 0, b1: CGFloat = 0, a1: CGFloat = 0
        var r2: CGFloat = 0, g2: CGFloat = 0, b2: CGFloat = 0, a2: CGFloat = 0
        guard getRed(&r1, green: &g1, blue: &b1, alpha: &a1),
              other.getRed(&r2, green: &g2, blue: &b2, alpha: &a2) else { return nil }
        let amount = min(1, max(0, fraction))
        return UIColor(
            red: r1 + (r2 - r1) * amount,
            green: g1 + (g2 - g1) * amount,
            blue: b1 + (b2 - b1) * amount,
            alpha: a1 + (a2 - a1) * amount
        )
    }

    func scaledToMaximumRelativeLuminance(_ maximum: CGFloat) -> UIColor {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        guard getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return self }
        func linear(_ component: CGFloat) -> CGFloat {
            component <= 0.04045 ? component / 12.92 : pow((component + 0.055) / 1.055, 2.4)
        }
        let luminance = 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
        guard luminance > maximum else { return self }
        let scale = sqrt(maximum / luminance)
        return UIColor(red: red * scale, green: green * scale, blue: blue * scale, alpha: alpha)
    }
}

private extension UIFont {
    var almidyWeight: UIFont.Weight {
        let traits = fontDescriptor.object(forKey: .traits) as? [UIFontDescriptor.TraitKey: Any]
        let value = (traits?[.weight] as? NSNumber)?.doubleValue ?? Double(UIFont.Weight.regular.rawValue)
        return UIFont.Weight(rawValue: CGFloat(value))
    }
}

private extension UIImage {
    var almidyAverageColor: UIColor? {
        almidyAverageColor(in: nil)
    }

    var almidyTopBandColor: UIColor? {
        guard let input = CIImage(image: self), !input.extent.isEmpty else { return nil }
        let band = CGRect(
            x: input.extent.minX,
            y: input.extent.maxY - input.extent.height * 0.16,
            width: input.extent.width,
            height: input.extent.height * 0.16
        )
        return almidyAverageColor(in: band)
    }

    var almidyBottomBandColor: UIColor? {
        guard let input = CIImage(image: self), !input.extent.isEmpty else { return nil }
        let band = CGRect(
            x: input.extent.minX,
            y: input.extent.minY,
            width: input.extent.width,
            height: input.extent.height * 0.28
        )
        return almidyAverageColor(in: band)
    }

    private func almidyAverageColor(in sampleRect: CGRect?) -> UIColor? {
        guard let input = CIImage(image: self), let filter = CIFilter(name: "CIAreaAverage") else { return nil }
        filter.setValue(input, forKey: kCIInputImageKey)
        filter.setValue(CIVector(cgRect: sampleRect ?? input.extent), forKey: kCIInputExtentKey)
        guard let output = filter.outputImage else { return nil }
        var bitmap = [UInt8](repeating: 0, count: 4)
        CIContext(options: [.workingColorSpace: NSNull()]).render(output, toBitmap: &bitmap, rowBytes: 4, bounds: CGRect(x: 0, y: 0, width: 1, height: 1), format: .RGBA8, colorSpace: nil)
        return UIColor(red: CGFloat(bitmap[0]) / 255, green: CGFloat(bitmap[1]) / 255, blue: CGFloat(bitmap[2]) / 255, alpha: 1)
    }
}

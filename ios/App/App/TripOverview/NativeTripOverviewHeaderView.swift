import CoreImage
import UIKit

final class NativeTripOverviewHeaderView: UIView {
    let moreButton = UIButton(type: .system)
    let searchButton = UIButton(type: .system)
    let closeButton = UIButton(type: .system)
    var onBackgroundColor: ((UIColor) -> Void)?

    private let imageView = UIImageView()
    private let gradientView = NativeTripOverviewGradientView()
    private let compactBackground = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterialDark))
    private let imagePlaceholder = UIImageView(image: UIImage(systemName: "photo"))
    private let imageLoadingIndicator = UIActivityIndicatorView(style: .medium)
    private let grabberView = UIView()
    private let flagLabel = UILabel()
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
    private var controlMaterialViews: [UIVisualEffectView] = []
    private(set) var transitionProgress: CGFloat = 0

    // Test-visible presentation values keep the contract verifiable without exposing mutable labels.
    var displayedFlag: String? { flagLabel.text }
    var displayedTiming: String? { timingLabel.text }
    var displayedAttribution: String? { attributionLabel.text }
    var compactContentAlpha: CGFloat { compactLabels.alpha }
    var heroPlaceholderAccessibilityLabel: String? { imagePlaceholder.accessibilityLabel }
    var honorsReducedMotion: Bool { UIAccessibility.isReduceMotionEnabled }
    var expandedTitlePointSize: CGFloat { titleLabel.font.pointSize }
    var expandedTitleWeight: UIFont.Weight { titleLabel.font.almidyWeight }
    var expandedTitleMaximumLines: Int { titleLabel.numberOfLines }
    var expandedTimingPointSize: CGFloat { timingLabel.font.pointSize }
    var expandedTitleBottomInset: CGFloat { 10 }
    var heroImageAlpha: CGFloat { imageView.alpha }
    var heroGradientAlpha: CGFloat { gradientView.alpha }
    var compactBackgroundAlpha: CGFloat { compactBackground.alpha }
    var expandedContentAlpha: CGFloat { expandedLabels.alpha }
    var grabberAlpha: CGFloat { grabberView.alpha }
    var expandedContentTransform: CGAffineTransform { expandedLabels.transform }
    var compactContentTransform: CGAffineTransform { compactLabels.transform }

    override init(frame: CGRect) {
        super.init(frame: frame)
        accessibilityIdentifier = "trip-overview-header"
        clipsToBounds = true
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

    func updateTransition(progress: CGFloat) {
        let state = NativeTripOverviewHeaderTransition(
            progress: progress,
            reduceMotion: UIAccessibility.isReduceMotionEnabled
        )
        transitionProgress = state.progress

        // Keep the hero visually continuous as its container collapses. The compact
        // material supplies contrast without replacing the image with a black panel.
        imageView.alpha = state.imageAlpha
        gradientView.alpha = state.gradientAlpha
        compactBackground.alpha = state.compactBackgroundAlpha
        expandedLabels.alpha = state.expandedAlpha
        compactLabels.alpha = state.compactAlpha
        expandedLabels.transform = state.expandedTransform
        compactLabels.transform = state.compactTransform
        expandedLabels.accessibilityElementsHidden = state.progress >= 0.5
        compactLabels.accessibilityElementsHidden = state.progress < 0.5
        grabberView.alpha = 1

        controlMaterialViews.forEach { $0.alpha = state.controlMaterialAlpha }
        let borderAlpha = state.controlBorderAlpha
        let highlight = heroTintColor.almidyControlHighlight
        [moreButton, searchButton, closeButton].forEach {
            $0.tintColor = .white
            $0.imageView?.alpha = 1
            $0.layer.borderColor = highlight.withAlphaComponent(borderAlpha).cgColor
        }
    }

    private func configureContent() {
        imageView.contentMode = .scaleAspectFill
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

        flagLabel.font = .systemFont(ofSize: 30)
        flagLabel.textAlignment = .center
        flagLabel.backgroundColor = UIColor.white.withAlphaComponent(0.92)
        flagLabel.layer.cornerRadius = 25
        flagLabel.layer.masksToBounds = true
        flagLabel.isAccessibilityElement = false
        flagLabel.widthAnchor.constraint(equalToConstant: 50).isActive = true
        flagLabel.heightAnchor.constraint(equalToConstant: 50).isActive = true

        configureLabel(titleLabel, font: AlmidyDesignTokens.Font.semibold(34), textStyle: .largeTitle, color: AlmidyDesignTokens.Color.tripCardTextPrimary)
        titleLabel.numberOfLines = 2
        titleLabel.lineBreakMode = .byWordWrapping
        configureLabel(timingLabel, font: AlmidyDesignTokens.Font.body(15), textStyle: .subheadline, color: AlmidyDesignTokens.Color.tripOverviewMetadataPrimary)
        configureLabel(dateLabel, font: AlmidyDesignTokens.Font.body(14), textStyle: .subheadline, color: AlmidyDesignTokens.Color.tripOverviewMetadataSecondary)
        configureLabel(attributionLabel, font: AlmidyDesignTokens.Font.body(11), textStyle: .caption2, color: AlmidyDesignTokens.Color.tripCardTextTertiary)
        attributionLabel.numberOfLines = 2

        expandedLabels.axis = .vertical
        expandedLabels.spacing = 3
        expandedLabels.alignment = .center
        expandedLabels.translatesAutoresizingMaskIntoConstraints = false
        [flagLabel, titleLabel, timingLabel, dateLabel, attributionLabel].forEach(expandedLabels.addArrangedSubview)
        expandedLabels.setCustomSpacing(10, after: flagLabel)
        expandedLabels.setCustomSpacing(7, after: dateLabel)

        configureLabel(compactTitleLabel, font: AlmidyDesignTokens.Font.semibold(17), textStyle: .headline, color: AlmidyDesignTokens.Color.tripCardTextPrimary)
        compactTitleLabel.numberOfLines = 2
        compactTitleLabel.accessibilityIdentifier = "trip-overview-compact-title"
        compactTitleLabel.lineBreakMode = .byTruncatingTail
        configureLabel(compactDateLabel, font: AlmidyDesignTokens.Font.body(13), textStyle: .caption1, color: AlmidyDesignTokens.Color.tripCardTextTertiary)
        compactDateLabel.numberOfLines = 2
        compactLabels.axis = .vertical
        compactLabels.spacing = 2
        compactLabels.alignment = .fill
        compactLabels.translatesAutoresizingMaskIntoConstraints = false
        compactLabels.addArrangedSubview(compactTitleLabel)
        compactLabels.addArrangedSubview(compactDateLabel)
    }

    private func configureControls() {
        configureButton(moreButton, systemName: "ellipsis", label: "More trip options")
        configureButton(searchButton, systemName: "magnifyingglass", label: "Search trip places")
        configureButton(closeButton, systemName: "xmark", label: "Close trip overview")
    }

    private func configureLayout() {
        [imageView, gradientView, compactBackground, expandedLabels, compactLabels, imageLoadingIndicator, moreButton, searchButton, closeButton, grabberView].forEach(addSubview)
        accessibilityElements = [moreButton, searchButton, closeButton, expandedLabels, compactLabels, imageLoadingIndicator]
        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: topAnchor), imageView.leadingAnchor.constraint(equalTo: leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: trailingAnchor), imageView.bottomAnchor.constraint(equalTo: bottomAnchor),
            imageLoadingIndicator.centerXAnchor.constraint(equalTo: centerXAnchor), imageLoadingIndicator.centerYAnchor.constraint(equalTo: centerYAnchor),
            grabberView.centerXAnchor.constraint(equalTo: centerXAnchor),
            grabberView.topAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor, constant: 5),
            grabberView.widthAnchor.constraint(equalToConstant: 38),
            grabberView.heightAnchor.constraint(equalToConstant: 5),
            gradientView.topAnchor.constraint(equalTo: topAnchor), gradientView.leadingAnchor.constraint(equalTo: leadingAnchor),
            gradientView.trailingAnchor.constraint(equalTo: trailingAnchor), gradientView.bottomAnchor.constraint(equalTo: bottomAnchor),
            compactBackground.topAnchor.constraint(equalTo: topAnchor), compactBackground.leadingAnchor.constraint(equalTo: leadingAnchor),
            compactBackground.trailingAnchor.constraint(equalTo: trailingAnchor), compactBackground.bottomAnchor.constraint(equalTo: bottomAnchor),

            moreButton.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            moreButton.topAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor, constant: 8),
            searchButton.leadingAnchor.constraint(equalTo: moreButton.trailingAnchor, constant: 8),
            searchButton.topAnchor.constraint(equalTo: moreButton.topAnchor),
            closeButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            closeButton.topAnchor.constraint(equalTo: moreButton.topAnchor),
            moreButton.widthAnchor.constraint(equalToConstant: 44), moreButton.heightAnchor.constraint(equalToConstant: 44),
            searchButton.widthAnchor.constraint(equalToConstant: 44), searchButton.heightAnchor.constraint(equalToConstant: 44),
            closeButton.widthAnchor.constraint(equalToConstant: 44), closeButton.heightAnchor.constraint(equalToConstant: 44),

            expandedLabels.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 24),
            expandedLabels.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -24),
            expandedLabels.centerXAnchor.constraint(equalTo: centerXAnchor),
            expandedLabels.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -10),
            compactLabels.leadingAnchor.constraint(equalTo: searchButton.trailingAnchor, constant: 12),
            compactLabels.trailingAnchor.constraint(equalTo: closeButton.leadingAnchor, constant: -12),
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
        flagLabel.isHidden = flagLabel.text == nil
        accessibilityLabel = [title, timing, dateRange, attribution].compactMap { $0 }.joined(separator: ", ")

        let fallback = UIColor(almidyHex: fallbackColor) ?? AlmidyDesignTokens.Color.generatedTripImageBase
        let fallbackPalette = NativeTripOverviewHeroColorProcessor.palette(
            top: fallback,
            bottom: fallback,
            dominant: fallback
        )
        heroTintColor = fallbackPalette.transition
        sheetTintColor = fallbackPalette.sheet
        backgroundColor = fallbackPalette.sheet
        grabberView.backgroundColor = fallbackPalette.topContrast
        applyContrast()
        onBackgroundColor?(fallbackPalette.sheet)

        let resolvedURL = imageURL.flatMap {
            URL(string: $0.relativeString, relativeTo: NativeServiceConfiguration.appBaseURL)?.absoluteURL
        }
        let retainedImage = seedImage ?? (resolvedURL == displayedImageURL ? imageView.image : nil)
        imageTask?.cancel()
        imageView.image = retainedImage
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
                self.imageView.image = image
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
        grabberView.backgroundColor = palette.topContrast
        applyContrast()
        onBackgroundColor?(palette.sheet)
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
        let borderAlpha: CGFloat = increased ? 0.72 : 0.46
        let highlight = heroTintColor.almidyControlHighlight
        [moreButton, searchButton, closeButton].forEach {
            $0.tintColor = .white
            $0.imageView?.alpha = 1
            $0.layer.borderColor = highlight.withAlphaComponent(borderAlpha).cgColor
            $0.layer.borderWidth = increased ? 1.5 : 1
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

    private func configureButton(_ button: UIButton, systemName: String, label: String) {
        let symbol = UIImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
        button.setImage(UIImage(systemName: systemName, withConfiguration: symbol), for: .normal)
        button.tintColor = .white
        button.backgroundColor = .clear
        button.layer.cornerRadius = 22
        button.layer.cornerCurve = .continuous
        button.layer.borderWidth = 1
        button.layer.borderColor = UIColor.white.withAlphaComponent(0.46).cgColor
        button.clipsToBounds = true

        let material = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterialDark))
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
            if !values.contains(where: { $0.caseInsensitiveCompare(value) == .orderedSame }) { values.append(value) }
        }
        guard !values.isEmpty else { return nil }
        return "Photo: " + values.joined(separator: " · ")
    }

    private static func flagEmoji(countryCode: String?) -> String? {
        guard let code = countryCode?.uppercased(), code.count == 2,
              code.unicodeScalars.allSatisfy({ (65...90).contains($0.value) }) else { return nil }
        return code.unicodeScalars.compactMap { UnicodeScalar(127397 + $0.value).map(String.init) }.joined()
    }
}

struct NativeTripOverviewHeaderTransition: Equatable {
    let progress: CGFloat
    let easedProgress: CGFloat
    let imageAlpha: CGFloat
    let gradientAlpha: CGFloat
    let compactBackgroundAlpha: CGFloat
    let expandedAlpha: CGFloat
    let compactAlpha: CGFloat
    let expandedTransform: CGAffineTransform
    let compactTransform: CGAffineTransform
    let controlMaterialAlpha: CGFloat
    let controlBorderAlpha: CGFloat

    func headerHeight(expanded: CGFloat, compact: CGFloat) -> CGFloat {
        expanded - easedProgress * max(0, expanded - compact)
    }

    init(progress: CGFloat, reduceMotion: Bool) {
        let clamped = min(1, max(0, progress))
        let eased = reduceMotion ? clamped : clamped * clamped * (3 - 2 * clamped)
        self.progress = clamped
        self.easedProgress = eased
        // The image never disappears. At the compact endpoint it remains visible
        // behind the material, so collapse reads as one continuous surface.
        imageAlpha = 1 - eased * 0.42
        gradientAlpha = 1 - eased * 0.10
        compactBackgroundAlpha = max(0, min(1, (eased - 0.18) / 0.82)) * 0.94
        expandedAlpha = max(0, 1 - eased * 1.55)
        compactAlpha = max(0, min(1, (eased - 0.34) / 0.54))
        controlMaterialAlpha = 0.94 + eased * 0.06
        controlBorderAlpha = 0.42 + eased * 0.10

        if reduceMotion {
            // Reduce Motion uses only a short linear position change plus crossfade;
            // it deliberately omits the scale interpolation used in normal motion.
            expandedTransform = CGAffineTransform(translationX: 0, y: -clamped * 4)
            compactTransform = CGAffineTransform(translationX: 0, y: (1 - clamped) * 4)
        } else {
            expandedTransform = CGAffineTransform(translationX: 0, y: -eased * 18)
                .scaledBy(x: 1 - eased * 0.08, y: 1 - eased * 0.08)
            compactTransform = CGAffineTransform(translationX: 0, y: (1 - eased) * 12)
        }
    }
}

private final class NativeTripOverviewGradientView: UIView {
    override class var layerClass: AnyClass { CAGradientLayer.self }
    var colors: [UIColor] = [] { didSet { gradient.colors = colors.map(\.cgColor) } }
    private var gradient: CAGradientLayer { layer as! CAGradientLayer }
    override init(frame: CGRect) {
        super.init(frame: frame)
        gradient.startPoint = CGPoint(x: 0.5, y: 0)
        gradient.endPoint = CGPoint(x: 0.5, y: 1)
        gradient.locations = NativeTripOverviewHeroGradient.locations
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

enum NativeTripOverviewHeroGradient {
    static let locations: [NSNumber] = [0.0, 0.62, 0.84, 1.0]

    static func colors(transition: UIColor, sheet: UIColor, increasedContrast: Bool) -> [UIColor] {
        [
            .clear,
            UIColor.black.withAlphaComponent(increasedContrast ? 0.10 : 0.07),
            transition.withAlphaComponent(increasedContrast ? 0.60 : 0.52),
            sheet.withAlphaComponent(increasedContrast ? 1.00 : 0.98)
        ]
    }

}

struct NativeTripOverviewHeroPalette {
    let topContrast: UIColor
    let transition: UIColor
    let sheet: UIColor
}

enum NativeTripOverviewHeroColorProcessor {
    static let guardrailSurface = AlmidyDesignTokens.Color.generatedTripImageBase

    static func palette(top: UIColor?, bottom: UIColor?, dominant: UIColor?) -> NativeTripOverviewHeroPalette {
        let source = dominant ?? bottom ?? top ?? guardrailSurface
        return NativeTripOverviewHeroPalette(
            topContrast: (top ?? source).almidyGrabberColor,
            transition: mutedSurface(from: bottom ?? source, burgundyBias: 0.04),
            sheet: mutedSurface(from: source, burgundyBias: 0.10)
        )
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
        let safeSaturation = min(0.52, max(0.10, saturation * 0.72))
        let safeBrightness = min(0.34, max(0.20, brightness * 0.62))
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

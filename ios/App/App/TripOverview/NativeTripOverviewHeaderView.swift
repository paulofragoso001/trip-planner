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
    private var seedImageURL: URL?
    private var seedImage: UIImage?
    private var heroTintColor = NativeTripOverviewHeroGradient.surfaceColor(from: AlmidyDesignTokens.Color.generatedTripImageBase)
    private var controlMaterialViews: [UIVisualEffectView] = []
    private(set) var transitionProgress: CGFloat = 0

    // Test-visible presentation values keep the contract verifiable without exposing mutable labels.
    var displayedFlag: String? { flagLabel.text }
    var displayedTiming: String? { timingLabel.text }
    var displayedAttribution: String? { attributionLabel.text }
    var compactContentAlpha: CGFloat { compactLabels.alpha }
    var heroPlaceholderAccessibilityLabel: String? { imagePlaceholder.accessibilityLabel }
    var honorsReducedMotion: Bool { UIAccessibility.isReduceMotionEnabled }

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
        let rawValue = min(1, max(0, progress))
        transitionProgress = rawValue
        let reduceMotion = UIAccessibility.isReduceMotionEnabled
        let value = reduceMotion ? rawValue : rawValue * rawValue * (3 - 2 * rawValue)

        // Keep the hero visually continuous as its container collapses. The compact
        // material supplies contrast without replacing the image with a black panel.
        imageView.alpha = 1 - value * 0.42
        gradientView.alpha = 1 - value * 0.10
        compactBackground.alpha = max(0, min(1, (value - 0.18) / 0.82)) * 0.94

        let expandedFade = max(0, 1 - value * 1.55)
        let compactFade = max(0, min(1, (value - 0.34) / 0.54))
        expandedLabels.alpha = expandedFade
        compactLabels.alpha = compactFade
        if reduceMotion {
            expandedLabels.transform = .identity
            compactLabels.transform = .identity
        } else {
            expandedLabels.transform = CGAffineTransform(translationX: 0, y: -value * 18)
                .scaledBy(x: 1 - value * 0.08, y: 1 - value * 0.08)
            compactLabels.transform = CGAffineTransform(translationX: 0, y: (1 - value) * 12)
        }
        expandedLabels.accessibilityElementsHidden = rawValue >= 0.5
        compactLabels.accessibilityElementsHidden = rawValue < 0.5

        controlMaterialViews.forEach { $0.alpha = 0.94 + value * 0.06 }
        let borderAlpha: CGFloat = 0.42 + value * 0.10
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

        configureLabel(titleLabel, font: AlmidyDesignTokens.Font.semibold(37), textStyle: .largeTitle, color: AlmidyDesignTokens.Color.tripCardTextPrimary)
        titleLabel.numberOfLines = 2
        titleLabel.lineBreakMode = .byWordWrapping
        configureLabel(timingLabel, font: AlmidyDesignTokens.Font.body(16), textStyle: .subheadline, color: AlmidyDesignTokens.Color.tripOverviewMetadataPrimary)
        configureLabel(dateLabel, font: AlmidyDesignTokens.Font.body(15), textStyle: .subheadline, color: AlmidyDesignTokens.Color.tripOverviewMetadataSecondary)
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
            expandedLabels.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -18),
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
        backgroundColor = fallback
        heroTintColor = NativeTripOverviewHeroGradient.surfaceColor(from: fallback)
        grabberView.backgroundColor = fallback.almidyGrabberColor
        applyContrast()
        onBackgroundColor?(fallback)

        imageTask?.cancel()
        imageView.image = seedImage
        imagePlaceholder.isHidden = true
        imagePlaceholder.accessibilityLabel = nil
        imageLoadingIndicator.stopAnimating()

        if let image = seedImage {
            applyHeroColors(from: image)
            return
        }

        guard let rawURL = imageURL,
              let url = URL(string: rawURL.relativeString, relativeTo: NativeServiceConfiguration.appBaseURL)?.absoluteURL else { return }
        imageLoadingIndicator.startAnimating()
        imageTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self else { return }
            DispatchQueue.main.async {
                self.imageLoadingIndicator.stopAnimating()
                guard let data, let image = UIImage(data: data) else {
                    return
                }
                self.imageView.image = image
                self.imagePlaceholder.isHidden = true
                self.applyHeroColors(from: image)
            }
        }
        imageTask?.resume()
    }

    private func applyHeroColors(from image: UIImage) {
        guard let color = image.almidyAverageColor else { return }
        // Match the continuation color to the part of the photo that actually
        // meets the sheet, avoiding an unrelated whole-image tint.
        let transitionColor = image.almidyBottomBandColor ?? color
        heroTintColor = NativeTripOverviewHeroGradient.surfaceColor(from: transitionColor)
        // The grabber sits at the top of the hero, so derive its contrast from
        // that exact image band instead of the image-wide average.
        grabberView.backgroundColor = (image.almidyTopBandColor ?? color).almidyGrabberColor
        applyContrast()
        onBackgroundColor?(transitionColor)
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if previousTraitCollection?.accessibilityContrast != traitCollection.accessibilityContrast { applyContrast() }
    }

    private func applyContrast() {
        let increased = traitCollection.accessibilityContrast == .high || UIAccessibility.isDarkerSystemColorsEnabled
        gradientView.colors = NativeTripOverviewHeroGradient.colors(surface: heroTintColor, increasedContrast: increased)
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

    static func colors(surface: UIColor, increasedContrast: Bool) -> [UIColor] {
        [
            .clear,
            UIColor.black.withAlphaComponent(increasedContrast ? 0.10 : 0.07),
            surface.withAlphaComponent(increasedContrast ? 0.60 : 0.52),
            surface.withAlphaComponent(increasedContrast ? 1.00 : 0.98)
        ]
    }

    static func surfaceColor(from color: UIColor) -> UIColor {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        guard color.getRed(&red, green: &green, blue: &blue, alpha: &alpha) else {
            return AlmidyDesignTokens.Color.generatedTripImageBase
        }
        let luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
        let scale: CGFloat = luminance > 0.42 ? 0.58 : 0.82
        let warmth: CGFloat = 0.025
        return UIColor(
            red: min(0.42, red * scale + warmth),
            green: min(0.34, green * scale),
            blue: min(0.36, blue * scale + warmth * 0.45),
            alpha: 1
        )
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

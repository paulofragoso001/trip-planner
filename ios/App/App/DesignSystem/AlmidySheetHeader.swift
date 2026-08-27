import UIKit

final class AlmidySheetHeader: UIView {
    enum Size { case standard, prominent }
    enum Layout { case centered, largeLeading }

    struct Metrics {
        var height: CGFloat
        var horizontalInset: CGFloat
        var controlSize: CGFloat

        static let standard = Metrics(
            height: 68,
            horizontalInset: AlmidyDesignTokens.Spacing.nativeContent,
            controlSize: AlmidyDesignTokens.Size.headerControlStandard
        )
        static let prominent = Metrics(
            height: 76,
            horizontalInset: AlmidyDesignTokens.Spacing.nativeContent,
            controlSize: AlmidyDesignTokens.Size.headerControlProminent
        )
    }

    struct LargeLeadingMetrics {
        var controlTopInset: CGFloat
        var titleSpacing: CGFloat
        var titleHorizontalInset: CGFloat
        var bottomInset: CGFloat

        static let standard = LargeLeadingMetrics(
            controlTopInset: AlmidyDesignTokens.Spacing.safeTop,
            titleSpacing: AlmidyDesignTokens.Spacing.lg,
            titleHorizontalInset: AlmidyDesignTokens.Spacing.lg,
            bottomInset: AlmidyDesignTokens.Spacing.nativeContent
        )
    }

    let titleLabel = UILabel()
    let subtitleLabel = UILabel()
    let divider: AlmidyDivider?
    let metrics: Metrics

    init(
        title: String,
        subtitle: String? = nil,
        size: Size = .standard,
        layout: Layout = .centered,
        leadingControl: UIView? = nil,
        trailingControl: UIView? = nil,
        showsDivider: Bool = false,
        metrics overrideMetrics: Metrics? = nil,
        dividerOverride: AlmidyDivider? = nil,
        titleFont: UIFont? = nil,
        subtitleFont: UIFont? = nil
    ) {
        metrics = overrideMetrics ?? (size == .standard ? .standard : .prominent)
        divider = dividerOverride ?? (showsDivider ? AlmidyDivider() : nil)
        super.init(frame: .zero)
        backgroundColor = AlmidyDesignTokens.Color.surface

        titleLabel.text = title
        titleLabel.textAlignment = layout == .centered ? .center : .natural
        titleLabel.textColor = AlmidyDesignTokens.Color.textPrimary
        titleLabel.numberOfLines = 1
        titleLabel.lineBreakMode = .byTruncatingTail
        if let titleFont {
            titleLabel.font = titleFont
            titleLabel.adjustsFontForContentSizeCategory = false
        } else {
            AlmidyDesignTokens.Typography.sheetTitle.apply(to: titleLabel)
        }

        subtitleLabel.text = subtitle
        subtitleLabel.textAlignment = layout == .centered ? .center : .natural
        subtitleLabel.textColor = AlmidyDesignTokens.Color.textSecondary
        subtitleLabel.numberOfLines = 1
        subtitleLabel.isHidden = subtitle == nil
        if let subtitleFont {
            subtitleLabel.font = subtitleFont
            subtitleLabel.adjustsFontForContentSizeCategory = false
        } else {
            AlmidyDesignTokens.Typography.bodyCompact.apply(to: subtitleLabel)
        }

        let labels = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
        labels.axis = .vertical
        labels.spacing = 1
        labels.alignment = .fill
        labels.translatesAutoresizingMaskIntoConstraints = false
        addSubview(labels)

        var constraints: [NSLayoutConstraint]
        switch layout {
        case .centered:
            constraints = [
                heightAnchor.constraint(equalToConstant: metrics.height),
                labels.centerXAnchor.constraint(equalTo: centerXAnchor),
                labels.centerYAnchor.constraint(equalTo: centerYAnchor),
                labels.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: metrics.horizontalInset + metrics.controlSize + AlmidyDesignTokens.Spacing.xs),
                labels.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -(metrics.horizontalInset + metrics.controlSize + AlmidyDesignTokens.Spacing.xs))
            ]
        case .largeLeading:
            let largeMetrics = LargeLeadingMetrics.standard
            constraints = [
                labels.leadingAnchor.constraint(equalTo: leadingAnchor, constant: largeMetrics.titleHorizontalInset),
                labels.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -largeMetrics.titleHorizontalInset),
                labels.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -largeMetrics.bottomInset)
            ]
        }

        if let leadingControl {
            leadingControl.translatesAutoresizingMaskIntoConstraints = false
            addSubview(leadingControl)
            constraints.append(leadingControl.leadingAnchor.constraint(equalTo: leadingAnchor, constant: metrics.horizontalInset))
            switch layout {
            case .centered:
                constraints += [
                    leadingControl.centerYAnchor.constraint(equalTo: centerYAnchor),
                    labels.leadingAnchor.constraint(greaterThanOrEqualTo: leadingControl.trailingAnchor, constant: AlmidyDesignTokens.Spacing.xs)
                ]
            case .largeLeading:
                constraints += [
                    leadingControl.topAnchor.constraint(equalTo: topAnchor, constant: LargeLeadingMetrics.standard.controlTopInset),
                    labels.topAnchor.constraint(equalTo: leadingControl.bottomAnchor, constant: LargeLeadingMetrics.standard.titleSpacing)
                ]
            }
        }
        if let trailingControl {
            trailingControl.translatesAutoresizingMaskIntoConstraints = false
            addSubview(trailingControl)
            constraints.append(trailingControl.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -metrics.horizontalInset))
            switch layout {
            case .centered:
                constraints += [
                    trailingControl.centerYAnchor.constraint(equalTo: centerYAnchor),
                    labels.trailingAnchor.constraint(lessThanOrEqualTo: trailingControl.leadingAnchor, constant: -AlmidyDesignTokens.Spacing.xs)
                ]
            case .largeLeading:
                constraints += [
                    trailingControl.topAnchor.constraint(equalTo: topAnchor, constant: LargeLeadingMetrics.standard.controlTopInset),
                    labels.topAnchor.constraint(equalTo: trailingControl.bottomAnchor, constant: LargeLeadingMetrics.standard.titleSpacing)
                ]
            }
        }
        if let divider {
            divider.translatesAutoresizingMaskIntoConstraints = false
            addSubview(divider)
            constraints += [
                divider.leadingAnchor.constraint(equalTo: leadingAnchor),
                divider.trailingAnchor.constraint(equalTo: trailingAnchor),
                divider.bottomAnchor.constraint(equalTo: bottomAnchor)
            ]
        }
        NSLayoutConstraint.activate(constraints)
        isAccessibilityElement = false
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setSubtitle(_ subtitle: String?) {
        subtitleLabel.text = subtitle
        subtitleLabel.isHidden = subtitle == nil
    }
}

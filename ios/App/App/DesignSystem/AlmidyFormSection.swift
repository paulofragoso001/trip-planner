import UIKit

final class AlmidyFormSection: UIView {
    private let surfaceStyle = AlmidySurfaceStyle(
        backgroundColor: AlmidyDesignTokens.Color.surface,
        cornerRadius: AlmidyDesignTokens.Radius.control,
        border: AlmidyDesignTokens.Border.outline,
        elevation: nil
    )
    private let stack = UIStackView()
    private(set) var separators: [AlmidyDivider] = []

    init(rows: [UIView] = []) {
        super.init(frame: .zero)
        surfaceStyle.apply(to: self)
        layer.masksToBounds = true
        stack.axis = .vertical
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        rows.forEach(addRow)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        guard previousTraitCollection?.hasDifferentColorAppearance(comparedTo: traitCollection) == true else { return }
        surfaceStyle.apply(to: self)
        layer.masksToBounds = true
    }

    func addRow(_ row: UIView) {
        if !stack.arrangedSubviews.isEmpty {
            let divider = AlmidyDivider(style: .inset(AlmidyDesignTokens.Spacing.md))
            separators.append(divider)
            stack.addArrangedSubview(divider)
        }
        stack.addArrangedSubview(row)
    }
}

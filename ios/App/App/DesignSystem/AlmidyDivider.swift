import UIKit

final class AlmidyDivider: UIView {
    enum Style {
        case full
        case inset(CGFloat)
    }

    let semanticStyle: Style
    let thickness: CGFloat
    private let line = UIView()

    init(
        style: Style = .full,
        thickness: CGFloat = AlmidyDesignTokens.Border.hairline.width,
        color: UIColor = AlmidyDesignTokens.Color.dividerSubtle
    ) {
        semanticStyle = style
        self.thickness = thickness
        super.init(frame: .zero)
        isAccessibilityElement = false
        backgroundColor = .clear
        line.backgroundColor = color
        line.translatesAutoresizingMaskIntoConstraints = false
        addSubview(line)
        let inset: CGFloat
        switch style {
        case .full: inset = 0
        case .inset(let value): inset = value
        }
        NSLayoutConstraint.activate([
            line.leadingAnchor.constraint(equalTo: leadingAnchor, constant: inset),
            line.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -inset),
            line.centerYAnchor.constraint(equalTo: centerYAnchor),
            line.heightAnchor.constraint(equalToConstant: thickness)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: thickness)
    }
}

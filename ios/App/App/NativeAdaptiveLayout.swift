import UIKit

enum NativeAdaptiveLayout {
    static let formMaxWidth: CGFloat = 620
    static let cardMaxWidth: CGFloat = 720

    static func isCompactHeight(_ view: UIView) -> Bool {
        view.bounds.height < 700 || view.bounds.width > view.bounds.height
    }

    static func preferredWidth(
        _ view: UIView,
        equalTo dimension: NSLayoutDimension,
        constant: CGFloat
    ) -> NSLayoutConstraint {
        let constraint = view.widthAnchor.constraint(equalTo: dimension, constant: constant)
        constraint.priority = .defaultHigh
        return constraint
    }
}

final class NativeGradientButton: UIButton {
    let overlayGradient = CAGradientLayer()

    override func layoutSubviews() {
        super.layoutSubviews()
        overlayGradient.frame = bounds
    }
}

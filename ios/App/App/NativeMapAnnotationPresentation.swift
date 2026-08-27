import UIKit

struct NativeActivityAnnotationSelectionPresentation: Equatable {
    let titleHidden: Bool
    let tailHidden: Bool
    let anchorHidden: Bool
    let centerOffset: CGPoint
    let titleOriginY: CGFloat
    let badgeScale: CGFloat
    let glyphScale: CGFloat
    let accessibilityTraits: UIAccessibilityTraits

    init(selected: Bool, keepsTitleVisible: Bool, badgeSize: CGFloat) {
        titleHidden = !(selected || keepsTitleVisible)
        tailHidden = !selected
        anchorHidden = !selected
        centerOffset = selected ? CGPoint(x: 0, y: -54) : .zero
        titleOriginY = selected ? 82 : badgeSize + 5
        badgeScale = selected ? 1.72 : 1
        glyphScale = selected ? 1.12 : 1
        accessibilityTraits = selected ? [.button, .selected] : .button
    }
}

enum NativeMapAnnotationPresentation {
    static let activityBadgeSize: CGFloat = 40
    static let activityGlyphSize: CGFloat = 20
    static let activityLabelWidth: CGFloat = 132
    static let activityLabelHeight: CGFloat = 22

    static func accessibilityLabel(title: String?, subtitle: String?) -> String {
        [title, subtitle]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }

    static func applyActivityBadgeSurface(to view: UIView) {
        view.layer.cornerRadius = activityBadgeSize / 2
        view.layer.borderColor = UIColor.white.cgColor
        view.layer.borderWidth = 2
        view.layer.shadowColor = UIColor.black.cgColor
        view.layer.shadowOpacity = 0.20
        view.layer.shadowRadius = 3
        view.layer.shadowOffset = CGSize(width: 0, height: 1.5)
    }

    static func applyMapPinElevation(to view: UIView) {
        AlmidyDesignTokens.Elevation.mapPin.apply(to: view)
    }
}

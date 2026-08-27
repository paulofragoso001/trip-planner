import UIKit

struct AlmidySheetConfiguration {
    enum Role { case utility, editor, prominent, overview }

    let role: Role
    var detents: [UISheetPresentationController.Detent]?
    var selectedDetentIdentifier: UISheetPresentationController.Detent.Identifier?
    var preferredCornerRadius: CGFloat
    var prefersGrabberVisible: Bool
    var prefersScrollingExpandsWhenScrolledToEdge: Bool
    var largestUndimmedDetentIdentifier: UISheetPresentationController.Detent.Identifier?
    var prefersEdgeAttachedInCompactHeight: Bool
    var widthFollowsPreferredContentSizeWhenEdgeAttached: Bool

    static let utility = AlmidySheetConfiguration(
        role: .utility,
        detents: nil,
        selectedDetentIdentifier: nil,
        preferredCornerRadius: AlmidyDesignTokens.Radius.sheetUtility,
        prefersGrabberVisible: true,
        prefersScrollingExpandsWhenScrolledToEdge: true,
        largestUndimmedDetentIdentifier: nil,
        prefersEdgeAttachedInCompactHeight: false,
        widthFollowsPreferredContentSizeWhenEdgeAttached: false
    )

    static let editor = AlmidySheetConfiguration(
        role: .editor,
        detents: nil,
        selectedDetentIdentifier: nil,
        preferredCornerRadius: AlmidyDesignTokens.Radius.sheetEditor,
        prefersGrabberVisible: true,
        prefersScrollingExpandsWhenScrolledToEdge: false,
        largestUndimmedDetentIdentifier: nil,
        prefersEdgeAttachedInCompactHeight: false,
        widthFollowsPreferredContentSizeWhenEdgeAttached: false
    )

    static let prominent = AlmidySheetConfiguration(
        role: .prominent,
        detents: nil,
        selectedDetentIdentifier: nil,
        preferredCornerRadius: AlmidyDesignTokens.Radius.sheetProminent,
        prefersGrabberVisible: true,
        prefersScrollingExpandsWhenScrolledToEdge: false,
        largestUndimmedDetentIdentifier: nil,
        prefersEdgeAttachedInCompactHeight: false,
        widthFollowsPreferredContentSizeWhenEdgeAttached: false
    )

    static let overview = AlmidySheetConfiguration(
        role: .overview,
        detents: nil,
        selectedDetentIdentifier: nil,
        preferredCornerRadius: AlmidyDesignTokens.Component.TripOverview.sheetCornerRadius,
        prefersGrabberVisible: false,
        prefersScrollingExpandsWhenScrolledToEdge: false,
        largestUndimmedDetentIdentifier: nil,
        prefersEdgeAttachedInCompactHeight: true,
        widthFollowsPreferredContentSizeWhenEdgeAttached: true
    )

    func overriding(
        detents: [UISheetPresentationController.Detent]? = nil,
        selectedDetentIdentifier: UISheetPresentationController.Detent.Identifier? = nil,
        cornerRadius: CGFloat? = nil,
        grabberVisible: Bool? = nil,
        scrollingExpandsWhenScrolledToEdge: Bool? = nil,
        largestUndimmedDetentIdentifier: UISheetPresentationController.Detent.Identifier? = nil
    ) -> Self {
        var copy = self
        if let detents { copy.detents = detents }
        if let selectedDetentIdentifier { copy.selectedDetentIdentifier = selectedDetentIdentifier }
        if let cornerRadius { copy.preferredCornerRadius = cornerRadius }
        if let grabberVisible { copy.prefersGrabberVisible = grabberVisible }
        if let scrollingExpandsWhenScrolledToEdge {
            copy.prefersScrollingExpandsWhenScrolledToEdge = scrollingExpandsWhenScrolledToEdge
        }
        if let largestUndimmedDetentIdentifier {
            copy.largestUndimmedDetentIdentifier = largestUndimmedDetentIdentifier
        }
        return copy
    }

    func apply(to sheet: UISheetPresentationController) {
        if let detents { sheet.detents = detents }
        sheet.selectedDetentIdentifier = selectedDetentIdentifier
        sheet.preferredCornerRadius = preferredCornerRadius
        sheet.prefersGrabberVisible = prefersGrabberVisible
        sheet.prefersScrollingExpandsWhenScrolledToEdge = prefersScrollingExpandsWhenScrolledToEdge
        sheet.largestUndimmedDetentIdentifier = largestUndimmedDetentIdentifier
        sheet.prefersEdgeAttachedInCompactHeight = prefersEdgeAttachedInCompactHeight
        sheet.widthFollowsPreferredContentSizeWhenEdgeAttached = widthFollowsPreferredContentSizeWhenEdgeAttached
    }

    func apply(to viewController: UIViewController) {
        viewController.modalPresentationStyle = .pageSheet
        guard let sheet = viewController.sheetPresentationController else { return }
        apply(to: sheet)
    }
}

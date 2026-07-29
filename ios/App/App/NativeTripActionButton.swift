import UIKit

final class NativeTripActionButton: UIButton {
    let tripId: String

    init(tripId: String, systemName: String) {
        self.tripId = tripId
        super.init(frame: .zero)
        backgroundColor = AlmidyDesignTokens.Color.modalDimmingBackground
        tintColor = AlmidyDesignTokens.Color.tripCardTextPrimary
        layer.cornerRadius = 21
        setImage(UIImage(systemName: systemName), for: .normal)
        accessibilityLabel = systemName == "trash" ? "Delete trip" : "Edit trip"
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

import UIKit

struct AlmidyInputStyle {
    enum State { case normal, focused, error, disabled }

    let fillColor: UIColor
    let textColor: UIColor
    let placeholderColor: UIColor
    let cornerRadius: CGFloat
    let border: AlmidyDesignTokens.Border.Configuration

    static let standard = AlmidyInputStyle(
        fillColor: AlmidyDesignTokens.Color.surface,
        textColor: AlmidyDesignTokens.Color.textPrimary,
        placeholderColor: AlmidyDesignTokens.Color.inputPlaceholder,
        cornerRadius: AlmidyDesignTokens.Radius.field,
        border: AlmidyDesignTokens.Border.outline
    )
    static let grouped = AlmidyInputStyle(
        fillColor: AlmidyDesignTokens.Color.surfaceNeutral,
        textColor: AlmidyDesignTokens.Color.textPrimary,
        placeholderColor: AlmidyDesignTokens.Color.inputPlaceholder,
        cornerRadius: AlmidyDesignTokens.Radius.field,
        border: AlmidyDesignTokens.Border.Configuration(width: 0, color: .clear)
    )
    static let search = AlmidyInputStyle(
        fillColor: AlmidyDesignTokens.Color.inputSurface,
        textColor: AlmidyDesignTokens.Color.textPrimary,
        placeholderColor: AlmidyDesignTokens.Color.inputPlaceholder,
        cornerRadius: AlmidyDesignTokens.Radius.control,
        border: AlmidyDesignTokens.Border.Configuration(
            width: 1,
            color: AlmidyDesignTokens.Color.inputBorder
        )
    )

    func apply(to textField: UITextField, state: State = .normal) {
        AlmidyDesignTokens.Typography.body.apply(to: textField)
        textField.adjustsFontForContentSizeCategory = true
        textField.layer.cornerRadius = cornerRadius
        textField.textColor = state == .disabled
            ? AlmidyDesignTokens.Color.stateDisabledText
            : textColor
        textField.backgroundColor = state == .disabled
            ? AlmidyDesignTokens.Color.stateDisabledFill
            : fillColor
        textField.isEnabled = state != .disabled

        switch state {
        case .normal, .disabled: border.apply(to: textField)
        case .focused: AlmidyDesignTokens.Border.selected.apply(to: textField)
        case .error:
            AlmidyDesignTokens.Border.Configuration(
                width: AlmidyDesignTokens.Border.selected.width,
                color: AlmidyDesignTokens.Color.danger
            ).apply(to: textField)
        }

        if let placeholder = textField.placeholder ?? textField.attributedPlaceholder?.string {
            let color = state == .disabled
                ? AlmidyDesignTokens.Color.stateDisabledText
                : placeholderColor
            textField.attributedPlaceholder = NSAttributedString(
                string: placeholder,
                attributes: [.foregroundColor: color]
            )
        }
    }
}

private extension AlmidyDesignTokens.Typography.Style {
    func apply(to textField: UITextField) {
        textField.font = scaledFont(compatibleWith: textField.traitCollection)
    }
}

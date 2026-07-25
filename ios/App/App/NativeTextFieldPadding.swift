import UIKit

extension UITextField {
    func setPadding(_ padding: CGFloat) {
        let left = UIView(frame: CGRect(x: 0, y: 0, width: padding, height: 1))
        let right = UIView(frame: CGRect(x: 0, y: 0, width: padding, height: 1))
        leftView = left
        rightView = right
        leftViewMode = .always
        rightViewMode = .always
    }
}

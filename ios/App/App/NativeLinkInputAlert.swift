import UIKit

enum NativeLinkInputAlert {
    static func make(onSave: @escaping (_ url: URL, _ displayName: String) -> Void) -> UIAlertController {
        let alert = UIAlertController(
            title: "Save Link",
            message: "Add a link to this flight.",
            preferredStyle: .alert
        )
        alert.addTextField { field in
            field.placeholder = "https://"
            field.keyboardType = .URL
            field.autocapitalizationType = .none
            field.autocorrectionType = .no
            field.accessibilityLabel = "Link URL"
            field.accessibilityIdentifier = "native-attachment-link-url"
        }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Save", style: .default) { [weak alert] _ in
            let value = alert?.textFields?.first?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard let (url, displayName) = validatedLink(value) else { return }
            onSave(url, displayName)
        })
        return alert
    }

    static func validatedLink(_ value: String) -> (URL, String)? {
        let value = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: value),
              ["http", "https"].contains(url.scheme?.lowercased()) else { return nil }
        return (url, url.host?.replacingOccurrences(of: "www.", with: "") ?? "Link")
    }
}

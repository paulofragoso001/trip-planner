import UIKit

final class NativeNoteInputViewController: UIViewController {
    static var sheetConfiguration: AlmidySheetConfiguration {
        .editor.overriding(
            grabberVisible: false,
            scrollingExpandsWhenScrolledToEdge: true
        )
    }

    static let textContainerInset = UIEdgeInsets(top: 8, left: 0, bottom: 8, right: 0)
    static let lineFragmentPadding: CGFloat = 5

    private let accent: UIColor
    private let onSave: (String) -> Void
    private let textView = UITextView()

    init(accent: UIColor, onSave: @escaping (String) -> Void) {
        self.accent = accent
        self.onSave = onSave
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let cancel = headerButton(title: "Cancel", background: .secondarySystemBackground, color: .label)
        cancel.accessibilityIdentifier = "native-note-cancel"
        cancel.addTarget(self, action: #selector(close), for: .touchUpInside)
        let save = headerButton(title: "Save", background: accent, color: .white)
        save.accessibilityIdentifier = "native-note-save"
        save.addTarget(self, action: #selector(saveNote), for: .touchUpInside)
        let header = AlmidySheetHeader(
            title: "New Note",
            leadingControl: cancel,
            trailingControl: save,
            metrics: .init(height: 62, horizontalInset: 16, controlSize: 76),
            titleFont: AlmidyDesignTokens.Font.button(18)
        )
        header.backgroundColor = .systemBackground
        header.titleLabel.textColor = .label

        textView.font = AlmidyDesignTokens.Font.body(18)
        textView.textColor = .label
        textView.tintColor = accent
        textView.backgroundColor = .clear
        textView.textContainerInset = Self.textContainerInset
        textView.textContainer.lineFragmentPadding = Self.lineFragmentPadding
        textView.accessibilityLabel = "Note"
        textView.accessibilityIdentifier = "native-flight-note"

        [header, textView].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview($0)
        }
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            header.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            textView.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 4),
            textView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            textView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            textView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor, constant: -8)
        ])
        textView.becomeFirstResponder()
    }

    private func headerButton(title: String, background: UIColor, color: UIColor) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.setTitleColor(color, for: .normal)
        button.titleLabel?.font = AlmidyDesignTokens.Font.button(16)
        button.backgroundColor = background
        button.layer.cornerRadius = 17
        button.contentEdgeInsets = .zero
        button.translatesAutoresizingMaskIntoConstraints = false
        button.widthAnchor.constraint(equalToConstant: title == "Cancel" ? 76 : 60).isActive = true
        button.heightAnchor.constraint(equalToConstant: 34).isActive = true
        return button
    }

    @objc private func close() { dismiss(animated: true) }

    @objc private func saveNote() {
        let note = textView.text.trimmingCharacters(in: .whitespacesAndNewlines)
        dismiss(animated: true) { [onSave] in onSave(note) }
    }
}

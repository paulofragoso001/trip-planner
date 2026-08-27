import UIKit

final class NativeAttachmentActionView: UIView {
    let titleLabel = UILabel()

    init(
        onImportDocument: @escaping () -> Void,
        onSaveLink: @escaping () -> Void,
        onChoosePhoto: @escaping () -> Void,
        onTakePhoto: @escaping () -> Void
    ) {
        super.init(frame: .zero)

        let icon = UIImageView(image: UIImage(systemName: "folder.badge.plus"))
        icon.tintColor = .secondaryLabel
        icon.contentMode = .scaleAspectFit
        icon.isAccessibilityElement = false
        icon.widthAnchor.constraint(equalToConstant: 28).isActive = true
        icon.heightAnchor.constraint(equalToConstant: 28).isActive = true

        titleLabel.text = "Add File, Photo or Link"
        titleLabel.textColor = .secondaryLabel
        titleLabel.font = .systemFont(ofSize: 19, weight: .semibold)

        let row = UIStackView(arrangedSubviews: [icon, titleLabel])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 18
        row.backgroundColor = .systemBackground
        row.layer.cornerRadius = 18
        row.isLayoutMarginsRelativeArrangement = true
        row.layoutMargins = UIEdgeInsets(top: 15, left: 18, bottom: 15, right: 18)
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)

        let button = UIButton(type: .system)
        button.accessibilityLabel = "Add File, Photo or Link"
        button.accessibilityIdentifier = "native-attachment-action"
        button.showsMenuAsPrimaryAction = true
        button.menu = UIMenu(title: "Add Document", children: [
            UIAction(title: "Import Document", image: UIImage(systemName: "doc")) { _ in onImportDocument() },
            UIAction(title: "Save Link", image: UIImage(systemName: "link")) { _ in onSaveLink() },
            UIAction(title: "Choose Photo from Library", image: UIImage(systemName: "photo")) { _ in onChoosePhoto() },
            UIAction(title: "Take a Photo", image: UIImage(systemName: "camera")) { _ in onTakePhoto() }
        ])
        button.translatesAutoresizingMaskIntoConstraints = false
        addSubview(button)

        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: 64),
            row.topAnchor.constraint(equalTo: topAnchor),
            row.leadingAnchor.constraint(equalTo: leadingAnchor),
            row.trailingAnchor.constraint(equalTo: trailingAnchor),
            row.bottomAnchor.constraint(equalTo: bottomAnchor),
            button.topAnchor.constraint(equalTo: topAnchor),
            button.leadingAnchor.constraint(equalTo: leadingAnchor),
            button.trailingAnchor.constraint(equalTo: trailingAnchor),
            button.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    @available(*, unavailable) required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

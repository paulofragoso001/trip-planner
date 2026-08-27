import UIKit

final class AlmidyActionRow: UIView {
    let row: AlmidyListRow
    let semanticHeight = AlmidyDesignTokens.Size.rowAction

    init(title: String, value: String? = nil, symbol: String, showsChevron: Bool = true) {
        row = AlmidyListRow(
            title: title,
            symbol: symbol,
            value: value,
            showsChevron: showsChevron,
            style: .action
        )
        super.init(frame: .zero)
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(greaterThanOrEqualToConstant: semanticHeight),
            row.topAnchor.constraint(equalTo: topAnchor),
            row.leadingAnchor.constraint(equalTo: leadingAnchor),
            row.trailingAnchor.constraint(equalTo: trailingAnchor),
            row.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

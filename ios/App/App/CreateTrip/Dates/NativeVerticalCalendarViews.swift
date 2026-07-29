import UIKit

final class NativeVerticalCalendarDayCell: UICollectionViewCell {
    static let reuseIdentifier = "NativeVerticalCalendarDayCell"

    private let selectionBackground = UIView()
    private let dayLabel = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        selectionBackground.isUserInteractionEnabled = false
        selectionBackground.layer.cornerCurve = .continuous
        selectionBackground.layer.masksToBounds = true
        selectionBackground.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(selectionBackground)

        dayLabel.font = AlmidyDesignTokens.Font.body(17)
        dayLabel.textAlignment = .center
        dayLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(dayLabel)

        let fillSelectionWidth = selectionBackground.widthAnchor.constraint(
            equalTo: contentView.widthAnchor,
            constant: -4
        )
        fillSelectionWidth.priority = .defaultHigh

        NSLayoutConstraint.activate([
            selectionBackground.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            selectionBackground.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            selectionBackground.widthAnchor.constraint(equalTo: selectionBackground.heightAnchor),
            selectionBackground.widthAnchor.constraint(lessThanOrEqualToConstant: 44),
            fillSelectionWidth,
            dayLabel.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            dayLabel.centerYAnchor.constraint(equalTo: contentView.centerYAnchor)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        contentView.layoutIfNeeded()
        selectionBackground.layer.cornerRadius = selectionBackground.bounds.height / 2
    }

    func configure(
        day: Int?,
        date: Date?,
        isRangeEndpoint: Bool,
        isInsideRange: Bool,
        calendar: Calendar
    ) {
        guard let day, let date else {
            dayLabel.text = nil
            selectionBackground.backgroundColor = .clear
            selectionBackground.layer.borderWidth = 0
            isAccessibilityElement = false
            isUserInteractionEnabled = false
            return
        }

        dayLabel.text = String(day)
        isUserInteractionEnabled = true
        isAccessibilityElement = true
        accessibilityLabel = DateFormatter.localizedString(from: date, dateStyle: .full, timeStyle: .none)

        if isRangeEndpoint {
            selectionBackground.backgroundColor = AlmidyDesignTokens.Color.gold
            selectionBackground.layer.borderWidth = 0
            dayLabel.textColor = .white
            accessibilityTraits = [.button, .selected]
        } else if isInsideRange {
            selectionBackground.backgroundColor = AlmidyDesignTokens.Color.gold.withAlphaComponent(0.16)
            selectionBackground.layer.borderWidth = 0
            dayLabel.textColor = AlmidyDesignTokens.Color.goldDark
            accessibilityTraits = [.button, .selected]
        } else if calendar.isDateInToday(date) {
            selectionBackground.backgroundColor = AlmidyDesignTokens.Color.gold.withAlphaComponent(0.10)
            selectionBackground.layer.borderColor = AlmidyDesignTokens.Color.gold.cgColor
            selectionBackground.layer.borderWidth = 1.5
            dayLabel.textColor = AlmidyDesignTokens.Color.goldDark
            accessibilityTraits = .button
        } else {
            selectionBackground.backgroundColor = .clear
            selectionBackground.layer.borderWidth = 0
            dayLabel.textColor = AlmidyDesignTokens.Color.textPrimary
            accessibilityTraits = .button
        }

        if calendar.isDateInToday(date) {
            accessibilityValue = isRangeEndpoint || isInsideRange ? "Today, selected" : "Today"
        } else {
            accessibilityValue = isRangeEndpoint || isInsideRange ? "Selected" : nil
        }
    }
}
enum NativeVerticalCalendarMetrics {
    static let horizontalInset: CGFloat = 24
}

final class NativeVerticalCalendarMonthHeader: UICollectionReusableView {
    static let reuseIdentifier = "NativeVerticalCalendarMonthHeader"

    private let titleLabel = UILabel()
    private let weekdayStack = UIStackView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        titleLabel.font = AlmidyDesignTokens.Font.title(22)
        titleLabel.textColor = AlmidyDesignTokens.Color.textPrimary
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(titleLabel)

        weekdayStack.axis = .horizontal
        weekdayStack.distribution = .fillEqually
        weekdayStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(weekdayStack)

        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 10),
            titleLabel.leadingAnchor.constraint(
                equalTo: leadingAnchor,
                constant: NativeVerticalCalendarMetrics.horizontalInset
            ),
            weekdayStack.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 14),
            weekdayStack.leadingAnchor.constraint(
                equalTo: leadingAnchor,
                constant: NativeVerticalCalendarMetrics.horizontalInset
            ),
            weekdayStack.trailingAnchor.constraint(
                equalTo: trailingAnchor,
                constant: -NativeVerticalCalendarMetrics.horizontalInset
            ),
            weekdayStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -6)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func configure(title: String, weekdaySymbols: [String]) {
        titleLabel.text = title
        weekdayStack.arrangedSubviews.forEach {
            weekdayStack.removeArrangedSubview($0)
            $0.removeFromSuperview()
        }
        weekdaySymbols.forEach { symbol in
            let label = UILabel()
            label.font = AlmidyDesignTokens.Font.body(12)
            label.textColor = AlmidyDesignTokens.Color.textSecondary
            label.textAlignment = .center
            label.text = symbol.uppercased()
            weekdayStack.addArrangedSubview(label)
        }
    }
}

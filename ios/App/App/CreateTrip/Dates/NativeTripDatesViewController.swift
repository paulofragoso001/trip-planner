import UIKit

final class NativeTripDatesViewController: UIViewController {
    private struct Month {
        let firstDate: Date
        let dayCount: Int
        let leadingBlankCount: Int
        let title: String
    }

    private let onSave: (Date, Date) -> Void
    private let headerStack = UIStackView()
    private let summaryLabel = UILabel()
    private let confirmButton = UIButton(type: .system)
    private let calendar = Calendar.current
    private var months: [Month] = []
    private lazy var calendarCollectionView: UICollectionView = {
        let layout = UICollectionViewFlowLayout()
        layout.scrollDirection = .vertical
        layout.minimumLineSpacing = 4
        layout.minimumInteritemSpacing = 0
        layout.sectionInset = UIEdgeInsets(
            top: 4,
            left: NativeVerticalCalendarMetrics.horizontalInset,
            bottom: 20,
            right: NativeVerticalCalendarMetrics.horizontalInset
        )
        layout.headerReferenceSize = CGSize(width: 1, height: 82)

        let collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.backgroundColor = AlmidyDesignTokens.Color.surface
        collectionView.alwaysBounceVertical = true
        collectionView.contentInsetAdjustmentBehavior = .never
        collectionView.showsVerticalScrollIndicator = false
        collectionView.keyboardDismissMode = .interactive
        collectionView.contentInset = UIEdgeInsets(top: 0, left: 0, bottom: 20, right: 0)
        collectionView.dataSource = self
        collectionView.delegate = self
        collectionView.register(
            NativeVerticalCalendarDayCell.self,
            forCellWithReuseIdentifier: NativeVerticalCalendarDayCell.reuseIdentifier
        )
        collectionView.register(
            NativeVerticalCalendarMonthHeader.self,
            forSupplementaryViewOfKind: UICollectionView.elementKindSectionHeader,
            withReuseIdentifier: NativeVerticalCalendarMonthHeader.reuseIdentifier
        )
        collectionView.accessibilityLabel = "Trip date calendar"
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        return collectionView
    }()
    private var selectedStartDate: Date?
    private var selectedEndDate: Date?
    private var isAwaitingEndDate = false
    private var didScrollToInitialMonth = false

    init(startDate: Date?, endDate: Date?, onSave: @escaping (Date, Date) -> Void) {
        self.onSave = onSave
        selectedStartDate = startDate.map { Calendar.current.startOfDay(for: $0) }
        selectedEndDate = endDate.map { Calendar.current.startOfDay(for: $0) }
        isAwaitingEndDate = selectedStartDate != nil && selectedEndDate == nil
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = AlmidyDesignTokens.Color.surface
        configureHeader()
        buildMonths()
        configureVerticalCalendar()
        updateSummary()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        scrollToInitialMonthIfNeeded()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        calendarCollectionView.collectionViewLayout.invalidateLayout()
    }

    private func configureHeader() {
        let cancel = UIButton(type: .system)
        var cancelConfiguration = UIButton.Configuration.filled()
        cancelConfiguration.title = "Cancel"
        cancelConfiguration.baseForegroundColor = AlmidyDesignTokens.Color.textPrimary
        cancelConfiguration.baseBackgroundColor = AlmidyDesignTokens.Color.card
        cancelConfiguration.cornerStyle = .capsule
        cancelConfiguration.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 18, bottom: 0, trailing: 18)
        cancelConfiguration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
            var outgoing = incoming
            outgoing.font = AlmidyDesignTokens.Font.button(17)
            return outgoing
        }
        cancel.configuration = cancelConfiguration
        cancel.addTarget(self, action: #selector(cancelDates), for: .touchUpInside)
        cancel.accessibilityLabel = "Cancel date selection"

        summaryLabel.font = AlmidyDesignTokens.Font.button(18)
        summaryLabel.textColor = AlmidyDesignTokens.Color.textPrimary
        summaryLabel.textAlignment = .center
        summaryLabel.adjustsFontSizeToFitWidth = true
        summaryLabel.minimumScaleFactor = 0.75
        summaryLabel.accessibilityLabel = "Selected trip dates"

        var confirmConfiguration = UIButton.Configuration.filled()
        confirmConfiguration.title = "Confirm"
        confirmConfiguration.baseForegroundColor = .white
        confirmConfiguration.baseBackgroundColor = AlmidyDesignTokens.Color.gold
        confirmConfiguration.cornerStyle = .capsule
        confirmConfiguration.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 18, bottom: 0, trailing: 18)
        confirmConfiguration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
            var outgoing = incoming
            outgoing.font = AlmidyDesignTokens.Font.button(17)
            return outgoing
        }
        confirmButton.configuration = confirmConfiguration
        confirmButton.addTarget(self, action: #selector(saveDates), for: .touchUpInside)
        confirmButton.accessibilityLabel = "Confirm trip dates"

        headerStack.addArrangedSubview(cancel)
        headerStack.addArrangedSubview(summaryLabel)
        headerStack.addArrangedSubview(confirmButton)
        headerStack.axis = .horizontal
        headerStack.alignment = .center
        headerStack.distribution = .fill
        headerStack.spacing = 12
        headerStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(headerStack)

        NSLayoutConstraint.activate([
            headerStack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 14),
            headerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            headerStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            headerStack.heightAnchor.constraint(greaterThanOrEqualToConstant: 48),
            cancel.heightAnchor.constraint(equalToConstant: 48),
            confirmButton.heightAnchor.constraint(equalToConstant: 48),
            cancel.widthAnchor.constraint(greaterThanOrEqualToConstant: 104),
            confirmButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 112)
        ])
    }

    private func buildMonths() {
        let today = Calendar.current.startOfDay(for: Date())
        let earliest = Calendar.current.date(byAdding: .year, value: -5, to: today) ?? today
        let latest = Calendar.current.date(byAdding: .year, value: 10, to: today) ?? today
        let startMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: earliest)) ?? earliest
        let endMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: latest)) ?? latest
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.setLocalizedDateFormatFromTemplate("MMMM yyyy")

        months.removeAll(keepingCapacity: true)
        var month = startMonth
        while month <= endMonth {
            let dayRange = calendar.range(of: .day, in: .month, for: month) ?? 1..<2
            let weekday = calendar.component(.weekday, from: month)
            let leadingBlankCount = (weekday - calendar.firstWeekday + 7) % 7
            months.append(
                Month(
                    firstDate: month,
                    dayCount: dayRange.count,
                    leadingBlankCount: leadingBlankCount,
                    title: formatter.string(from: month)
                )
            )
            guard let nextMonth = calendar.date(byAdding: .month, value: 1, to: month) else { break }
            month = nextMonth
        }
    }

    private func configureVerticalCalendar() {
        view.addSubview(calendarCollectionView)

        NSLayoutConstraint.activate([
            calendarCollectionView.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 18),
            calendarCollectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            calendarCollectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            calendarCollectionView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        refreshCalendarSelection(animated: false)
    }

    private func scrollToInitialMonthIfNeeded() {
        guard !didScrollToInitialMonth, !months.isEmpty else { return }
        didScrollToInitialMonth = true
        let visibleDate = selectedStartDate ?? calendar.startOfDay(for: Date())
        guard let section = months.firstIndex(where: { calendar.isDate($0.firstDate, equalTo: visibleDate, toGranularity: .month) }) else {
            return
        }
        calendarCollectionView.layoutIfNeeded()
        let headerIndexPath = IndexPath(item: 0, section: section)
        if let attributes = calendarCollectionView.layoutAttributesForSupplementaryElement(
            ofKind: UICollectionView.elementKindSectionHeader,
            at: headerIndexPath
        ) {
            let topInset = calendarCollectionView.adjustedContentInset.top
            calendarCollectionView.setContentOffset(
                CGPoint(x: 0, y: max(-topInset, attributes.frame.minY - topInset)),
                animated: false
            )
        }
    }

    private var orderedWeekdaySymbols: [String] {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        let symbols = formatter.veryShortStandaloneWeekdaySymbols ?? formatter.veryShortWeekdaySymbols ?? []
        guard symbols.count == 7 else { return ["S", "M", "T", "W", "T", "F", "S"] }
        let start = max(0, min(6, calendar.firstWeekday - 1))
        return Array(symbols[start...] + symbols[..<start])
    }

    private func date(at indexPath: IndexPath) -> Date? {
        let month = months[indexPath.section]
        let day = indexPath.item - month.leadingBlankCount + 1
        guard day >= 1, day <= month.dayCount else { return nil }
        return calendar.date(byAdding: .day, value: day - 1, to: month.firstDate).map {
            calendar.startOfDay(for: $0)
        }
    }

    private func select(_ date: Date) {
        if !isAwaitingEndDate || selectedStartDate == nil {
            selectedStartDate = date
            selectedEndDate = nil
            isAwaitingEndDate = true
        } else if let start = selectedStartDate {
            selectedStartDate = min(start, date)
            selectedEndDate = max(start, date)
            isAwaitingEndDate = false
        }
        refreshCalendarSelection(animated: true)
        updateSummary()
    }

    private func refreshCalendarSelection(animated: Bool) {
        calendarCollectionView.reloadData()
    }

    private static let compactDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM dd"
        return formatter
    }()

    private func updateSummary() {
        guard let selectedStartDate else {
            summaryLabel.text = "No date set"
            summaryLabel.accessibilityValue = "No date set"
            confirmButton.isEnabled = false
            confirmButton.alpha = 0.48
            return
        }
        let start = Self.compactDateFormatter.string(from: selectedStartDate)
        if let selectedEndDate, !Calendar.current.isDate(selectedStartDate, inSameDayAs: selectedEndDate) {
            let summary = "\(start) → \(Self.compactDateFormatter.string(from: selectedEndDate))"
            summaryLabel.text = summary
            summaryLabel.accessibilityValue = summary
        } else {
            summaryLabel.text = start
            summaryLabel.accessibilityValue = start
        }
        confirmButton.isEnabled = true
        confirmButton.alpha = 1
    }

    @objc private func saveDates() {
        guard let selectedStartDate else { return }
        onSave(selectedStartDate, max(selectedStartDate, selectedEndDate ?? selectedStartDate))
        dismiss(animated: true)
    }

    @objc private func cancelDates() {
        dismiss(animated: true)
    }
}
extension NativeTripDatesViewController: UICollectionViewDataSource, UICollectionViewDelegateFlowLayout {
    func numberOfSections(in collectionView: UICollectionView) -> Int {
        months.count
    }

    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        let month = months[section]
        let occupiedDays = month.leadingBlankCount + month.dayCount
        return Int(ceil(Double(occupiedDays) / 7.0)) * 7
    }

    func collectionView(
        _ collectionView: UICollectionView,
        cellForItemAt indexPath: IndexPath
    ) -> UICollectionViewCell {
        guard let cell = collectionView.dequeueReusableCell(
            withReuseIdentifier: NativeVerticalCalendarDayCell.reuseIdentifier,
            for: indexPath
        ) as? NativeVerticalCalendarDayCell else {
            return UICollectionViewCell()
        }
        let date = date(at: indexPath)
        let day = date.map { calendar.component(.day, from: $0) }
        let isStart: Bool
        if let date, let selectedStartDate {
            isStart = calendar.isDate(date, inSameDayAs: selectedStartDate)
        } else {
            isStart = false
        }
        let isEnd: Bool
        if let date, let selectedEndDate {
            isEnd = calendar.isDate(date, inSameDayAs: selectedEndDate)
        } else {
            isEnd = false
        }
        let isInsideRange: Bool
        if let date, let start = selectedStartDate, let end = selectedEndDate {
            isInsideRange = date > start && date < end
        } else {
            isInsideRange = false
        }
        cell.configure(
            day: day,
            date: date,
            isRangeEndpoint: isStart || isEnd,
            isInsideRange: isInsideRange,
            calendar: calendar
        )
        return cell
    }

    func collectionView(
        _ collectionView: UICollectionView,
        viewForSupplementaryElementOfKind kind: String,
        at indexPath: IndexPath
    ) -> UICollectionReusableView {
        guard kind == UICollectionView.elementKindSectionHeader,
              let header = collectionView.dequeueReusableSupplementaryView(
                ofKind: kind,
                withReuseIdentifier: NativeVerticalCalendarMonthHeader.reuseIdentifier,
                for: indexPath
              ) as? NativeVerticalCalendarMonthHeader else {
            return UICollectionReusableView()
        }
        header.configure(title: months[indexPath.section].title, weekdaySymbols: orderedWeekdaySymbols)
        return header
    }

    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        guard let date = date(at: indexPath) else { return }
        select(date)
    }

    func collectionView(
        _ collectionView: UICollectionView,
        layout collectionViewLayout: UICollectionViewLayout,
        sizeForItemAt indexPath: IndexPath
    ) -> CGSize {
        let horizontalInset: CGFloat
        if let flowLayout = collectionViewLayout as? UICollectionViewFlowLayout {
            horizontalInset = flowLayout.sectionInset.left + flowLayout.sectionInset.right
        } else {
            horizontalInset = NativeVerticalCalendarMetrics.horizontalInset * 2
        }
        let availableWidth = max(0, collectionView.bounds.width - horizontalInset)
        let width = availableWidth / 7
        return CGSize(width: width, height: 52)
    }

    func collectionView(
        _ collectionView: UICollectionView,
        layout collectionViewLayout: UICollectionViewLayout,
        referenceSizeForHeaderInSection section: Int
    ) -> CGSize {
        CGSize(width: collectionView.bounds.width, height: 82)
    }
}

import MapKit
import UIKit

struct NativeItineraryItem: Decodable, Equatable, Identifiable {
    let id: String
    let title: String
    let segmentType: String
    let transportKind: String?
    let company: String?
    let transportNumber: String?
    let departureLocation: String?
    let departureAddress: String?
    let departureLatitude: Double?
    let departureLongitude: Double?
    let arrivalLocation: String?
    let arrivalAddress: String?
    let arrivalLatitude: Double?
    let arrivalLongitude: Double?
    let startAt: Date?
    let endAt: Date?
    let notes: String?
    let confirmationCode: String?
    let reservationDetails: [String: String]

    private enum CodingKeys: String, CodingKey {
        case id, title, company, notes
        case segmentType = "segment_type"
        case transportKind = "transport_kind"
        case transportNumber = "transport_number"
        case departureLocation = "departure_location"
        case departureAddress = "departure_address"
        case departureLatitude = "departure_lat"
        case departureLongitude = "departure_lng"
        case arrivalLocation = "arrival_location"
        case arrivalAddress = "arrival_address"
        case arrivalLatitude = "arrival_lat"
        case arrivalLongitude = "arrival_lng"
        case startAt = "date_time"
        case endAt = "end_time"
        case confirmationCode = "confirmation_code"
        case reservationDetails = "reservation_details"
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        title = try values.decode(String.self, forKey: .title)
        segmentType = try values.decodeIfPresent(String.self, forKey: .segmentType) ?? "activity"
        transportKind = try values.decodeIfPresent(String.self, forKey: .transportKind)
        company = try values.decodeIfPresent(String.self, forKey: .company)
        transportNumber = try values.decodeIfPresent(String.self, forKey: .transportNumber)
        departureLocation = try values.decodeIfPresent(String.self, forKey: .departureLocation)
        departureAddress = try values.decodeIfPresent(String.self, forKey: .departureAddress)
        departureLatitude = try values.decodeIfPresent(Double.self, forKey: .departureLatitude)
        departureLongitude = try values.decodeIfPresent(Double.self, forKey: .departureLongitude)
        arrivalLocation = try values.decodeIfPresent(String.self, forKey: .arrivalLocation)
        arrivalAddress = try values.decodeIfPresent(String.self, forKey: .arrivalAddress)
        arrivalLatitude = try values.decodeIfPresent(Double.self, forKey: .arrivalLatitude)
        arrivalLongitude = try values.decodeIfPresent(Double.self, forKey: .arrivalLongitude)
        notes = try values.decodeIfPresent(String.self, forKey: .notes)
        confirmationCode = try values.decodeIfPresent(String.self, forKey: .confirmationCode)
        reservationDetails = try values.decodeIfPresent([String: String].self, forKey: .reservationDetails) ?? [:]
        startAt = Self.decodeDate(values, key: .startAt)
        endAt = Self.decodeDate(values, key: .endAt)
    }

    private static func decodeDate(_ values: KeyedDecodingContainer<CodingKeys>, key: CodingKeys) -> Date? {
        guard let value = try? values.decode(String.self, forKey: key) else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    var kind: TransportationActivityDraft.Kind? {
        TransportationActivityDraft.Kind(rawValue: transportKind ?? segmentType)
    }

    var draft: TransportationActivityDraft {
        TransportationActivityDraft(
            tripID: "",
            kind: kind ?? .flight,
            title: title,
            company: company,
            transportNumber: transportNumber,
            departure: location(name: departureLocation, address: departureAddress, latitude: departureLatitude, longitude: departureLongitude),
            arrival: location(name: arrivalLocation, address: arrivalAddress, latitude: arrivalLatitude, longitude: arrivalLongitude),
            startAt: startAt,
            endAt: endAt,
            reservation: .init(
                confirmationCode: confirmationCode ?? reservationDetails["confirmationCode"],
                seat: reservationDetails["seat"],
                seatClass: reservationDetails["seatClass"],
                coachNumber: reservationDetails["coachNumber"],
                vehicle: reservationDetails["vehicle"],
                serviceType: reservationDetails["serviceType"],
                phone: reservationDetails["phone"],
                website: reservationDetails["website"].flatMap(URL.init(string:))
            ),
            note: notes
        )
    }

    private func location(name: String?, address: String?, latitude: Double?, longitude: Double?) -> TransportationActivityDraft.Location? {
        guard let name, !name.isEmpty else { return nil }
        return .init(name: name, address: address, latitude: latitude, longitude: longitude)
    }
}

protocol NativeItineraryRequesting {
    func load(tripID: String, completion: @escaping (Result<[NativeItineraryItem], Error>) -> Void)
}

final class NativeItineraryAPIClient: NativeItineraryRequesting {
    private struct Envelope: Decodable {
        struct Payload: Decodable { let itinerary: [NativeItineraryItem] }
        let data: Payload
    }

    private let client: NativeAuthenticatedHTTPClient
    init(webView: AnyObject? = nil, baseURL: URL = NativeServiceConfiguration.appBaseURL, session: URLSession = .shared) {
        client = NativeAuthenticatedHTTPClient(webView: webView, baseURL: baseURL, session: session)
    }

    func load(tripID: String, completion: @escaping (Result<[NativeItineraryItem], Error>) -> Void) {
        let encoded = tripID.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? tripID
        client.request(path: "/api/itinerary?tripId=\(encoded)", method: "GET", body: nil) { result in
            DispatchQueue.main.async {
                completion(result.flatMap { data in
                    do { return .success(try JSONDecoder().decode(Envelope.self, from: data).data.itinerary) }
                    catch { return .failure(error) }
                })
            }
        }
    }
}

final class NativeItineraryViewController: UIViewController, UITableViewDataSource, UITableViewDelegate {
    private enum LayoutStyle { case small, large }

    private struct Day {
        let date: Date
        let items: [NativeItineraryItem]
    }

    private let tripID: String
    private let tripTitle: String
    private let startDate: Date
    private let endDate: Date
    private let requester: NativeItineraryRequesting
    private let onAddActivity: () -> Void
    private let onEditFlight: (NativeItineraryItem) -> Void
    private let onClose: () -> Void
    /// Keeps the originating overview coordinator alive while Itinerary is
    /// presented as a peer of that sheet rather than as its child.
    var retainedSourceController: UIViewController?
    private let tableView = UITableView(frame: .zero, style: .plain)
    private let statusLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let dayRail = UIStackView()
    private let dayRailScrollView = UIScrollView()
    private var dayButtons: [NativeItineraryDayButton] = []
    private var days: [Day] = []
    private var allItems: [NativeItineraryItem] = []
    private var selectedDayIndex = 0
    private var hasInitiallyCenteredDayRail = false
    private var layoutStyle: LayoutStyle = .large
    private var selectedGuestFilter: String?
    private weak var timelineButton: UIButton?
    private weak var moreButton: UIButton?
    private var isLeavingForActivityFlow = false
    private var hasCompletedClose = false

    init(
        tripID: String,
        tripTitle: String,
        startDate: Date,
        endDate: Date,
        requester: NativeItineraryRequesting = NativeItineraryAPIClient(),
        onAddActivity: @escaping () -> Void,
        onEditFlight: @escaping (NativeItineraryItem) -> Void,
        onClose: @escaping () -> Void = {}
    ) {
        self.tripID = tripID
        self.tripTitle = tripTitle
        self.startDate = startDate
        self.endDate = endDate
        self.requester = requester
        self.onAddActivity = onAddActivity
        self.onEditFlight = onEditFlight
        self.onClose = onClose
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        configureHeader()
        configureTable()
        configureFloatingControls()
        reload()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        guard !hasInitiallyCenteredDayRail, !dayButtons.isEmpty else { return }
        hasInitiallyCenteredDayRail = true
        centerDayInRail(selectedDayIndex, animated: false)
    }

    private func configureHeader() {
        let month = UILabel()
        let formatter = DateFormatter(); formatter.dateFormat = "MMMM yyyy"
        month.text = formatter.string(from: startDate)
        month.font = AlmidyDesignTokens.Font.semibold(17)
        month.textColor = AlmidyDesignTokens.Color.textSecondary
        let title = UILabel()
        title.text = tripTitle
        title.font = AlmidyDesignTokens.Font.bold(32)
        title.textColor = AlmidyDesignTokens.Color.textPrimary
        let close = UIButton(type: .system)
        close.setImage(UIImage(systemName: "xmark"), for: .normal)
        close.tintColor = .label
        close.backgroundColor = AlmidyDesignTokens.Color.surface
        close.layer.cornerRadius = 25
        AlmidyDesignTokens.Elevation.controlRaised.apply(to: close)
        close.addTarget(self, action: #selector(closeSheet), for: .touchUpInside)
        close.accessibilityLabel = "Close itinerary"

        let headerText = UIStackView(arrangedSubviews: [month, title])
        headerText.axis = .vertical; headerText.spacing = 2
        dayRail.axis = .horizontal; dayRail.spacing = 4; dayRail.alignment = .center
        dayRailScrollView.showsHorizontalScrollIndicator = false
        dayRailScrollView.alwaysBounceHorizontal = true
        dayRailScrollView.decelerationRate = .fast
        dayRailScrollView.addSubview(dayRail); dayRail.translatesAutoresizingMaskIntoConstraints = false
        [headerText, close, dayRailScrollView].forEach { $0.translatesAutoresizingMaskIntoConstraints = false; view.addSubview($0) }
        NSLayoutConstraint.activate([
            headerText.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 14),
            headerText.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            close.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            close.centerYAnchor.constraint(equalTo: headerText.centerYAnchor),
            close.widthAnchor.constraint(equalToConstant: 50), close.heightAnchor.constraint(equalToConstant: 50),
            dayRailScrollView.topAnchor.constraint(equalTo: headerText.bottomAnchor, constant: 14),
            dayRailScrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor), dayRailScrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            dayRailScrollView.heightAnchor.constraint(equalToConstant: 72),
            dayRail.leadingAnchor.constraint(equalTo: dayRailScrollView.contentLayoutGuide.leadingAnchor, constant: 16),
            dayRail.trailingAnchor.constraint(equalTo: dayRailScrollView.contentLayoutGuide.trailingAnchor, constant: -16),
            dayRail.topAnchor.constraint(equalTo: dayRailScrollView.contentLayoutGuide.topAnchor),
            dayRail.bottomAnchor.constraint(equalTo: dayRailScrollView.contentLayoutGuide.bottomAnchor),
            dayRail.heightAnchor.constraint(equalTo: dayRailScrollView.frameLayoutGuide.heightAnchor)
        ])
        buildDayRail()
    }

    private func configureTable() {
        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.dataSource = self; tableView.delegate = self
        tableView.separatorStyle = .none
        tableView.sectionHeaderTopPadding = 0
        tableView.contentInset = UIEdgeInsets(top: 0, left: 0, bottom: 122, right: 0)
        tableView.scrollIndicatorInsets = UIEdgeInsets(top: 0, left: 0, bottom: 104, right: 0)
        tableView.backgroundColor = AlmidyDesignTokens.Color.surface
        tableView.register(NativeItineraryTimelineCell.self, forCellReuseIdentifier: NativeItineraryTimelineCell.reuseIdentifier)
        tableView.register(NativeItineraryCalendarPromoCell.self, forCellReuseIdentifier: NativeItineraryCalendarPromoCell.reuseIdentifier)
        tableView.accessibilityIdentifier = "native-itinerary-list"
        view.addSubview(tableView)
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: dayRailScrollView.bottomAnchor, constant: 4),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor), tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        statusLabel.textAlignment = .center; statusLabel.textColor = .secondaryLabel; statusLabel.numberOfLines = 0
        tableView.backgroundView = statusLabel
    }

    private func configureFloatingControls() {
        let timeline = floatingButton(symbol: "line.3.horizontal.decrease", accessibilityLabel: "Itinerary navigation")
        timelineButton = timeline
        configureTimelineMenu(for: timeline)
        let more = floatingButton(symbol: "ellipsis", accessibilityLabel: "More itinerary options")
        moreButton = more
        configureMoreMenu(for: more)
        let today = UIButton(type: .system)
        var todayConfiguration = UIButton.Configuration.plain()
        todayConfiguration.image = UIImage(systemName: "calendar")
        todayConfiguration.imagePadding = 7
        todayConfiguration.title = "Today"
        today.configuration = todayConfiguration
        today.tintColor = AlmidyDesignTokens.Color.textPrimary
        today.titleLabel?.font = AlmidyDesignTokens.Font.semibold(17)
        today.backgroundColor = AlmidyDesignTokens.Color.surface; today.layer.cornerRadius = 25
        AlmidyDesignTokens.Elevation.floating.apply(to: today)
        today.addTarget(self, action: #selector(scrollToToday), for: .touchUpInside)
        let add = UIButton(type: .system)
        add.setImage(UIImage(systemName: "plus", withConfiguration: UIImage.SymbolConfiguration(pointSize: 27, weight: .regular)), for: .normal)
        add.tintColor = .white; add.backgroundColor = AlmidyDesignTokens.Color.gold; add.layer.cornerRadius = 31
        AlmidyDesignTokens.Elevation.floating.apply(to: add)
        add.addTarget(self, action: #selector(addActivity), for: .touchUpInside)
        add.accessibilityLabel = "Add activity"
        [timeline, more, today, add].forEach { $0.translatesAutoresizingMaskIntoConstraints = false; view.addSubview($0) }
        NSLayoutConstraint.activate([
            today.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -10),
            today.centerXAnchor.constraint(equalTo: view.centerXAnchor), today.widthAnchor.constraint(equalToConstant: 112), today.heightAnchor.constraint(equalToConstant: 50),
            timeline.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 18), timeline.centerYAnchor.constraint(equalTo: today.centerYAnchor),
            timeline.widthAnchor.constraint(equalToConstant: 50), timeline.heightAnchor.constraint(equalToConstant: 50),
            more.leadingAnchor.constraint(equalTo: timeline.trailingAnchor, constant: 8), more.centerYAnchor.constraint(equalTo: today.centerYAnchor),
            more.widthAnchor.constraint(equalToConstant: 50), more.heightAnchor.constraint(equalToConstant: 50),
            add.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20), add.centerYAnchor.constraint(equalTo: today.centerYAnchor),
            add.widthAnchor.constraint(equalToConstant: 62), add.heightAnchor.constraint(equalToConstant: 62)
        ])
    }

    private func floatingButton(symbol: String, accessibilityLabel: String) -> UIButton {
        AlmidyIconButton(
            symbol: symbol,
            style: .floating,
            accessibilityLabel: accessibilityLabel,
            overrides: .init(diameter: 50)
        )
    }

    private func configureTimelineMenu(for button: UIButton) {
        let clearFilters = UIAction(
            title: "Clear Filters",
            image: UIImage(systemName: "minus.circle"),
            attributes: .destructive
        ) { [weak self] _ in
            self?.clearItineraryFilters()
        }
        let everyone = UIAction(title: "Everyone") { [weak self] _ in
            self?.setAssignedGuestFilter(nil)
        }
        everyone.state = selectedGuestFilter == nil ? .on : .off
        let guestActions = assignedGuestNames().map { guest in
            let action = UIAction(title: guest) { [weak self] _ in
                self?.setAssignedGuestFilter(guest)
            }
            action.state = selectedGuestFilter == guest ? .on : .off
            return action
        }
        let assignedGuest = UIMenu(
            title: "Assigned Guest\n\(selectedGuestFilter ?? "Everyone")",
            image: UIImage(systemName: "person.2"),
            options: .singleSelection,
            children: guestActions + [everyone]
        )
        let goToDate = UIAction(
            title: "Go to Date",
            image: UIImage(systemName: "calendar")
        ) { [weak self] _ in
            self?.presentGoToDatePicker()
        }
        button.menu = UIMenu(children: [clearFilters, assignedGuest, goToDate])
        button.showsMenuAsPrimaryAction = true
    }

    private func configureMoreMenu(for button: UIButton) {
        let small = UIAction(
            title: "Small",
            image: UIImage(systemName: "list.bullet")
        ) { [weak self] _ in self?.setLayoutStyle(.small) }
        small.state = layoutStyle == .small ? .on : .off
        let large = UIAction(
            title: "Large",
            image: UIImage(systemName: "list.bullet.circle")
        ) { [weak self] _ in self?.setLayoutStyle(.large) }
        large.state = layoutStyle == .large ? .on : .off

        let layoutOptions: UIMenu.Options
        if #available(iOS 17.0, *) {
            layoutOptions = [.displayInline, .singleSelection, .displayAsPalette]
        } else {
            layoutOptions = [.displayInline, .singleSelection]
        }
        let layout = UIMenu(title: "Layout Style", options: layoutOptions, children: [small, large])
        let preferences = UIAction(
            title: "Preferences",
            image: UIImage(systemName: "gearshape")
        ) { [weak self] _ in self?.presentItineraryPreferences() }
        let selectItems = UIAction(
            title: "Select Items",
            image: UIImage(systemName: "checkmark.circle")
        ) { [weak self] _ in self?.beginSelectingItems() }
        let export = UIAction(
            title: "Export CSV",
            image: UIImage(systemName: "tablecells")
        ) { [weak self] _ in self?.exportItineraryCSV() }
        button.menu = UIMenu(children: [layout, preferences, selectItems, export])
        button.showsMenuAsPrimaryAction = true
    }

    private func buildDayRail() {
        let calendar = Calendar.current
        let dates = tripDates()
        // The list opens at the first trip day, so the rail must begin in the
        // same state. The dedicated Today control performs the explicit jump.
        selectedDayIndex = 0
        for (index, date) in dates.enumerated() {
            let button = NativeItineraryDayButton(date: date, calendar: calendar)
            button.tag = index
            button.addTarget(self, action: #selector(selectDay(_:)), for: .touchUpInside)
            button.widthAnchor.constraint(equalToConstant: 48).isActive = true
            dayRail.addArrangedSubview(button)
            dayButtons.append(button)
        }
        updateSelectedDay(selectedDayIndex, centerRail: false)
    }

    func reload() {
        spinner.startAnimating(); statusLabel.text = "Loading itinerary…"
        requester.load(tripID: tripID) { [weak self] result in
            guard let self else { return }
            spinner.stopAnimating()
            switch result {
            case .success(let items):
                allItems = items
                rebuildFilteredDays()
                statusLabel.text = nil; tableView.reloadData()
                if let timelineButton { configureTimelineMenu(for: timelineButton) }
                updateSelectedDay(selectedDayIndex, centerRail: true)
            case .failure:
                statusLabel.text = "The itinerary couldn’t be loaded.\nPull down or reopen this sheet to retry."
            }
        }
    }

    private func tripDates() -> [Date] {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: startDate), end = calendar.startOfDay(for: endDate)
        var values: [Date] = [], cursor = start
        while cursor <= end { values.append(cursor); cursor = calendar.date(byAdding: .day, value: 1, to: cursor) ?? end.addingTimeInterval(1) }
        return values
    }

    func numberOfSections(in tableView: UITableView) -> Int { days.count }
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        let items = days[section].items
        if !items.isEmpty { return items.count }
        let entireTripIsEmpty = !days.contains { !$0.items.isEmpty }
        return section == 0 && entireTripIsEmpty ? 2 : 0
    }
    func tableView(_ tableView: UITableView, heightForHeaderInSection section: Int) -> CGFloat {
        layoutStyle == .small ? 48 : 64
    }
    func tableView(_ tableView: UITableView, viewForHeaderInSection section: Int) -> UIView? {
        NativeItineraryDayHeaderView(date: days[section].date, ordinal: ordinal(section + 1))
    }
    func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        let items = days[indexPath.section].items
        if items.isEmpty {
            if indexPath.row == 0 { return layoutStyle == .small ? 88 : 104 }
            return layoutStyle == .small ? 82 : 108
        }
        return layoutStyle == .small ? 60 : 82
    }
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let items = days[indexPath.section].items
        guard !items.isEmpty else {
            if indexPath.row == 0 {
                return tableView.dequeueReusableCell(withIdentifier: NativeItineraryCalendarPromoCell.reuseIdentifier, for: indexPath)
            }
            guard let cell = tableView.dequeueReusableCell(withIdentifier: NativeItineraryTimelineCell.reuseIdentifier, for: indexPath) as? NativeItineraryTimelineCell else { return UITableViewCell() }
            cell.configureEmpty(showsAddPrompt: true)
            return cell
        }
        guard let cell = tableView.dequeueReusableCell(withIdentifier: NativeItineraryTimelineCell.reuseIdentifier, for: indexPath) as? NativeItineraryTimelineCell else {
            return UITableViewCell()
        }
        let item = items[indexPath.row]
        cell.configure(
            title: item.title,
            detail: detail(for: item),
            symbol: symbol(for: item),
            connectsAbove: indexPath.row > 0,
            connectsBelow: indexPath.row < items.count - 1,
            editable: item.kind != nil
        )
        return cell
    }
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let items = days[indexPath.section].items
        if items.isEmpty {
            if indexPath.section == 0 && indexPath.row == 1 { beginAddActivityFlow() }
            return
        }
        if items[indexPath.row].kind != nil { onEditFlight(items[indexPath.row]) }
    }

    private func detail(for item: NativeItineraryItem) -> String {
        let formatter = DateFormatter(); formatter.timeStyle = .short
        let time = item.startAt.map(formatter.string(from:)) ?? "Time not set"
        let route = [item.departureLocation, item.arrivalLocation].compactMap { $0 }.joined(separator: " → ")
        return route.isEmpty ? time : "\(time) · \(route)"
    }
    private func symbol(for item: NativeItineraryItem) -> String {
        switch item.kind { case .flight: return "airplane"; case .train: return "tram.fill"; case .car, .carRental, .transfer: return "car.fill"; case .bus: return "bus.fill"; case .ferry, .cruise: return "ferry.fill"; case .walk: return "figure.walk"; case .bike: return "bicycle"; case .motorcycle: return "scooter"; case nil: return "mappin.and.ellipse" }
    }
    private func ordinal(_ value: Int) -> String {
        let formatter = NumberFormatter(); formatter.numberStyle = .ordinal
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }
    @objc private func closeSheet() {
        dismiss(animated: true) { self.completeCloseIfNeeded() }
    }
    @objc private func addActivity() { beginAddActivityFlow() }
    private func beginAddActivityFlow() {
        isLeavingForActivityFlow = true
        onAddActivity()
    }
    private func completeCloseIfNeeded() {
        guard !isLeavingForActivityFlow, !hasCompletedClose else { return }
        hasCompletedClose = true
        // Keep the dismissed overview alive through its weak onClose capture
        // until the map-level presenter owns it again.
        let sourceController = retainedSourceController
        onClose()
        retainedSourceController = nil
        _ = sourceController
    }
    @objc private func selectDay(_ sender: UIButton) {
        scrollToDay(sender.tag, animated: true)
    }
    @objc private func scrollToToday() {
        let calendar = Calendar.current
        let index = days.firstIndex { calendar.isDateInToday($0.date) } ?? 0
        scrollToDay(index, animated: true)
    }
    private func clearItineraryFilters() {
        setAssignedGuestFilter(nil)
        if !days.isEmpty { scrollToDay(0, animated: true) }
    }

    private func assignedGuestNames() -> [String] {
        Array(Set(allItems.compactMap(assignedGuestName))).sorted {
            $0.localizedCaseInsensitiveCompare($1) == .orderedAscending
        }
    }

    private func assignedGuestName(for item: NativeItineraryItem) -> String? {
        let candidate = item.reservationDetails["assignedGuest"]
            ?? item.reservationDetails["assigned_guest"]
            ?? item.reservationDetails["assignedTo"]
            ?? item.reservationDetails["assignee"]
        let value = candidate?.trimmingCharacters(in: .whitespacesAndNewlines)
        return value?.isEmpty == false ? value : nil
    }

    private func setAssignedGuestFilter(_ guest: String?) {
        selectedGuestFilter = guest
        rebuildFilteredDays()
        tableView.reloadData()
        if let timelineButton { configureTimelineMenu(for: timelineButton) }
        if !days.isEmpty { scrollToDay(min(selectedDayIndex, days.count - 1), animated: false) }
    }

    private func rebuildFilteredDays() {
        let calendar = Calendar.current
        let visibleItems = selectedGuestFilter.map { selected in
            allItems.filter { assignedGuestName(for: $0) == selected }
        } ?? allItems
        days = tripDates().map { date in
            Day(date: date, items: visibleItems.filter { item in
                item.startAt.map { calendar.isDate($0, inSameDayAs: date) } ?? false
            })
        }
    }

    private func presentGoToDatePicker() {
        if #available(iOS 16.0, *) {
            let selectedDate = days.indices.contains(selectedDayIndex) ? days[selectedDayIndex].date : startDate
            let picker = NativeItineraryDatePickerViewController(
                selectedDate: selectedDate,
                startDate: startDate,
                endDate: endDate
            ) { [weak self] date in
                guard let self else { return }
                let calendar = Calendar.current
                let index = self.days.firstIndex { calendar.isDate($0.date, inSameDayAs: date) } ?? 0
                self.scrollToDay(index, animated: true)
            }
            let calendarDetentID = UISheetPresentationController.Detent.Identifier("itinerary-calendar")
            let calendarDetent = UISheetPresentationController.Detent.custom(identifier: calendarDetentID) { context in
                context.maximumDetentValue * 0.67
            }
            AlmidySheetConfiguration.utility.overriding(
                detents: [calendarDetent],
                selectedDetentIdentifier: calendarDetentID,
                cornerRadius: 30,
                scrollingExpandsWhenScrolledToEdge: false
            ).apply(to: picker)
            present(picker, animated: true)
            return
        }

        let picker = UIDatePicker()
        picker.datePickerMode = .date
        picker.preferredDatePickerStyle = .inline
        picker.minimumDate = startDate
        picker.maximumDate = endDate
        picker.date = days.indices.contains(selectedDayIndex) ? days[selectedDayIndex].date : startDate
        picker.translatesAutoresizingMaskIntoConstraints = false

        let alert = UIAlertController(title: "Go to Date", message: "\n\n\n\n\n\n\n\n\n\n\n", preferredStyle: .alert)
        alert.view.addSubview(picker)
        NSLayoutConstraint.activate([
            picker.leadingAnchor.constraint(equalTo: alert.view.leadingAnchor, constant: 12),
            picker.trailingAnchor.constraint(equalTo: alert.view.trailingAnchor, constant: -12),
            picker.topAnchor.constraint(equalTo: alert.view.topAnchor, constant: 50),
            picker.heightAnchor.constraint(equalToConstant: 300)
        ])
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Go", style: .default) { [weak self, weak picker] _ in
            guard let self, let date = picker?.date else { return }
            let calendar = Calendar.current
            let index = self.days.firstIndex { calendar.isDate($0.date, inSameDayAs: date) } ?? 0
            self.scrollToDay(index, animated: true)
        })
        present(alert, animated: true)
    }
    private func setLayoutStyle(_ style: LayoutStyle) {
        layoutStyle = style
        if let moreButton { configureMoreMenu(for: moreButton) }
        tableView.performBatchUpdates(nil)
    }

    private func presentItineraryPreferences() {
        let alert = UIAlertController(
            title: "Itinerary Preferences",
            message: "Calendar events and activity display preferences can be managed here.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Refresh Activities", style: .default) { [weak self] _ in self?.reload() })
        alert.addAction(UIAlertAction(title: "Done", style: .cancel))
        present(alert, animated: true)
    }

    private func beginSelectingItems() {
        tableView.allowsMultipleSelectionDuringEditing = true
        tableView.setEditing(true, animated: true)
        let alert = UIAlertController(
            title: "Select Items",
            message: "Choose one or more activities in the itinerary.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Done", style: .default) { [weak self] _ in
            self?.tableView.setEditing(false, animated: true)
        })
        present(alert, animated: true)
    }

    private func exportItineraryCSV() {
        let formatter = ISO8601DateFormatter()
        var rows = ["title,type,start,departure,arrival"]
        for item in days.flatMap(\.items) {
            let values = [
                item.title,
                item.kind?.rawValue ?? "activity",
                item.startAt.map(formatter.string(from:)) ?? "",
                item.departureLocation ?? "",
                item.arrivalLocation ?? ""
            ].map(csvEscaped)
            rows.append(values.joined(separator: ","))
        }
        let safeTitle = tripTitle.replacingOccurrences(of: "/", with: "-")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(safeTitle)-itinerary.csv")
        do {
            try rows.joined(separator: "\n").write(to: url, atomically: true, encoding: .utf8)
            let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            share.popoverPresentationController?.sourceView = moreButton
            share.popoverPresentationController?.sourceRect = moreButton?.bounds ?? .zero
            present(share, animated: true)
        } catch {
            let alert = UIAlertController(title: "Export Failed", message: "The itinerary CSV couldn’t be created.", preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            present(alert, animated: true)
        }
    }

    private func csvEscaped(_ value: String) -> String {
        "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
    }

    private func scrollToDay(_ index: Int, animated: Bool) {
        guard days.indices.contains(index) else { return }
        updateSelectedDay(index, centerRail: true)
        tableView.scrollToRow(at: IndexPath(row: 0, section: index), at: .top, animated: animated)
    }

    private func updateSelectedDay(_ index: Int, centerRail: Bool) {
        guard dayButtons.indices.contains(index) else { return }
        selectedDayIndex = index
        for (buttonIndex, button) in dayButtons.enumerated() {
            button.setSelected(buttonIndex == index)
        }
        if centerRail { centerDayInRail(index, animated: true) }
    }

    private func centerDayInRail(_ index: Int, animated: Bool) {
        guard dayButtons.indices.contains(index), dayRailScrollView.bounds.width > 0 else { return }
        let button = dayButtons[index]
        let frame = button.convert(button.bounds, to: dayRailScrollView)
        let maximumOffset = max(0, dayRailScrollView.contentSize.width - dayRailScrollView.bounds.width)
        let target = min(max(0, frame.midX - dayRailScrollView.bounds.width / 2), maximumOffset)
        dayRailScrollView.setContentOffset(CGPoint(x: target, y: 0), animated: animated)
    }

    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        guard scrollView === tableView,
              let section = tableView.indexPathsForVisibleRows?.map(\.section).min(),
              section != selectedDayIndex else { return }
        updateSelectedDay(section, centerRail: true)
    }
}

extension NativeItineraryViewController: UIAdaptivePresentationControllerDelegate {
    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        completeCloseIfNeeded()
    }
}

@available(iOS 16.0, *)
private final class NativeItineraryDatePickerViewController: UIViewController, UICalendarSelectionSingleDateDelegate {
    private let selectedDate: Date
    private let startDate: Date
    private let endDate: Date
    private let onSelect: (Date) -> Void
    private let calendarView = UICalendarView()
    private var sheetHeader: AlmidySheetHeader?

    init(selectedDate: Date, startDate: Date, endDate: Date, onSelect: @escaping (Date) -> Void) {
        self.selectedDate = selectedDate
        self.startDate = startDate
        self.endDate = endDate
        self.onSelect = onSelect
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = AlmidyDesignTokens.Color.surface

        let cancel = UIButton(type: .system)
        cancel.setTitle("Cancel", for: .normal)
        cancel.setTitleColor(AlmidyDesignTokens.Color.goldDark, for: .normal)
        cancel.titleLabel?.font = AlmidyDesignTokens.Font.title(17)
        cancel.backgroundColor = AlmidyDesignTokens.Color.surface
        cancel.layer.cornerRadius = 22
        AlmidyDesignTokens.Elevation.controlSubtle.apply(to: cancel)
        cancel.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)

        cancel.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            cancel.widthAnchor.constraint(equalToConstant: 82),
            cancel.heightAnchor.constraint(equalToConstant: 44)
        ])
        let header = AlmidySheetHeader(
            title: "Choose a Date",
            subtitle: formattedSubtitle(selectedDate),
            leadingControl: cancel,
            metrics: .init(height: 67, horizontalInset: 20, controlSize: 82),
            dividerOverride: AlmidyDivider(
                thickness: 1,
                color: AlmidyDesignTokens.Color.tripOverviewDivider
            ),
            titleFont: AlmidyDesignTokens.Font.bold(18),
            subtitleFont: AlmidyDesignTokens.Font.body(15)
        )
        sheetHeader = header

        calendarView.calendar = Calendar.current
        calendarView.locale = Locale.current
        calendarView.fontDesign = .rounded
        calendarView.tintColor = AlmidyDesignTokens.Color.gold
        calendarView.availableDateRange = DateInterval(
            start: Calendar.current.startOfDay(for: startDate),
            end: Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: endDate)) ?? endDate
        )
        let selection = UICalendarSelectionSingleDate(delegate: self)
        selection.setSelected(Calendar.current.dateComponents([.calendar, .year, .month, .day], from: selectedDate), animated: false)
        calendarView.selectionBehavior = selection
        calendarView.setVisibleDateComponents(
            Calendar.current.dateComponents([.calendar, .year, .month], from: selectedDate),
            animated: false
        )

        [header, calendarView].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview($0)
        }
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            header.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            calendarView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 18),
            calendarView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -18),
            calendarView.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 10),
            calendarView.heightAnchor.constraint(equalToConstant: 430),
            calendarView.bottomAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20)
        ])
    }

    func dateSelection(_ selection: UICalendarSelectionSingleDate, didSelectDate dateComponents: DateComponents?) {
        guard let components = dateComponents, let date = Calendar.current.date(from: components) else { return }
        sheetHeader?.setSubtitle(formattedSubtitle(date))
        onSelect(date)
        dismiss(animated: true)
    }

    func dateSelection(_ selection: UICalendarSelectionSingleDate, canSelectDate dateComponents: DateComponents?) -> Bool {
        guard let components = dateComponents, let date = Calendar.current.date(from: components) else { return false }
        return date >= Calendar.current.startOfDay(for: startDate) && date <= Calendar.current.startOfDay(for: endDate)
    }

    private func formattedSubtitle(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d"
        return formatter.string(from: date)
    }

    @objc private func cancelTapped() { dismiss(animated: true) }
}

private final class NativeItineraryDayButton: UIControl {
    private let weekdayLabel = UILabel()
    private let numberLabel = UILabel()

    init(date: Date, calendar: Calendar) {
        super.init(frame: .zero)
        let weekdayFormatter = DateFormatter(); weekdayFormatter.dateFormat = "EEE"
        weekdayLabel.text = weekdayFormatter.string(from: date).uppercased()
        weekdayLabel.font = AlmidyDesignTokens.Font.semibold(12)
        weekdayLabel.textAlignment = .center
        weekdayLabel.textColor = AlmidyDesignTokens.Color.textSecondary
        numberLabel.text = "\(calendar.component(.day, from: date))"
        numberLabel.font = AlmidyDesignTokens.Font.body(19)
        numberLabel.textAlignment = .center
        numberLabel.layer.cornerRadius = 20
        numberLabel.clipsToBounds = true
        numberLabel.translatesAutoresizingMaskIntoConstraints = false
        let stack = UIStackView(arrangedSubviews: [weekdayLabel, numberLabel])
        stack.axis = .vertical; stack.spacing = 5; stack.isUserInteractionEnabled = false
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            numberLabel.widthAnchor.constraint(equalToConstant: 40), numberLabel.heightAnchor.constraint(equalToConstant: 40),
            stack.centerXAnchor.constraint(equalTo: centerXAnchor), stack.centerYAnchor.constraint(equalTo: centerYAnchor)
        ])
        accessibilityLabel = DateFormatter.localizedString(from: date, dateStyle: .full, timeStyle: .none)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setSelected(_ selected: Bool) {
        isSelected = selected
        numberLabel.backgroundColor = selected ? AlmidyDesignTokens.Color.gold : .clear
        numberLabel.textColor = selected ? .white : AlmidyDesignTokens.Color.textPrimary
        accessibilityTraits = selected ? [.button, .selected] : .button
    }
}

private final class NativeItineraryDayHeaderView: UIView {
    init(date: Date, ordinal: String) {
        super.init(frame: .zero)
        backgroundColor = AlmidyDesignTokens.Color.surface
        let formatter = DateFormatter(); formatter.dateFormat = "EEE, MMMM d"
        let dateLabel = UILabel(); dateLabel.text = formatter.string(from: date).uppercased()
        dateLabel.font = AlmidyDesignTokens.Font.semibold(17)
        dateLabel.textColor = AlmidyDesignTokens.Color.textSecondary
        let ordinalLabel = UILabel(); ordinalLabel.text = ordinal
        ordinalLabel.font = AlmidyDesignTokens.Font.body(16)
        ordinalLabel.textColor = Calendar.current.isDateInToday(date) ? AlmidyDesignTokens.Color.goldDark : AlmidyDesignTokens.Color.textSecondary
        let divider = UIView(); divider.backgroundColor = AlmidyDesignTokens.Color.tripOverviewDivider
        [dateLabel, ordinalLabel, divider].forEach { $0.translatesAutoresizingMaskIntoConstraints = false; addSubview($0) }
        NSLayoutConstraint.activate([
            dateLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20), dateLabel.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -1),
            ordinalLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20), ordinalLabel.centerYAnchor.constraint(equalTo: dateLabel.centerYAnchor),
            divider.leadingAnchor.constraint(equalTo: leadingAnchor), divider.trailingAnchor.constraint(equalTo: trailingAnchor), divider.bottomAnchor.constraint(equalTo: bottomAnchor), divider.heightAnchor.constraint(equalToConstant: 1)
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

private final class NativeItineraryCalendarPromoCell: UITableViewCell {
    static let reuseIdentifier = "native-itinerary-calendar-promo-cell"

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        backgroundColor = AlmidyDesignTokens.Color.surface
        selectionStyle = .none

        let card = UIView()
        card.backgroundColor = AlmidyDesignTokens.Color.tripOverviewNeutralSurface
        card.layer.cornerRadius = 20

        let icon = UIImageView(image: UIImage(systemName: "calendar"))
        icon.tintColor = AlmidyDesignTokens.Color.textSecondary
        icon.contentMode = .scaleAspectFit

        let title = UILabel()
        title.text = "Calendar Events"
        title.font = AlmidyDesignTokens.Font.semibold(17)
        title.textColor = AlmidyDesignTokens.Color.textPrimary

        let pro = UILabel()
        pro.text = "PRO"
        pro.font = AlmidyDesignTokens.Font.bold(11)
        pro.textColor = .white
        pro.textAlignment = .center
        pro.backgroundColor = AlmidyDesignTokens.Color.textTertiary
        pro.layer.cornerRadius = 5
        pro.clipsToBounds = true

        let message = UILabel()
        message.text = "Events from your personal calendar can be shown alongside your trip itineraries."
        message.font = AlmidyDesignTokens.Font.body(14)
        message.textColor = AlmidyDesignTokens.Color.textSecondary
        message.numberOfLines = 2

        let dismiss = UIImageView(image: UIImage(systemName: "xmark"))
        dismiss.tintColor = AlmidyDesignTokens.Color.textTertiary
        dismiss.contentMode = .scaleAspectFit

        let titleRow = UIStackView(arrangedSubviews: [title, pro])
        titleRow.axis = .horizontal
        titleRow.spacing = 7
        titleRow.alignment = .center

        let copy = UIStackView(arrangedSubviews: [titleRow, message])
        copy.axis = .vertical
        copy.spacing = 4

        [card, icon, copy, dismiss].forEach { $0.translatesAutoresizingMaskIntoConstraints = false }
        contentView.addSubview(card)
        card.addSubview(icon)
        card.addSubview(copy)
        card.addSubview(dismiss)

        NSLayoutConstraint.activate([
            card.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            card.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            card.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            card.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -8),
            icon.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            icon.topAnchor.constraint(equalTo: card.topAnchor, constant: 17),
            icon.widthAnchor.constraint(equalToConstant: 30),
            icon.heightAnchor.constraint(equalToConstant: 30),
            dismiss.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            dismiss.topAnchor.constraint(equalTo: card.topAnchor, constant: 17),
            dismiss.widthAnchor.constraint(equalToConstant: 18),
            dismiss.heightAnchor.constraint(equalToConstant: 18),
            copy.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 14),
            copy.trailingAnchor.constraint(equalTo: dismiss.leadingAnchor, constant: -12),
            copy.centerYAnchor.constraint(equalTo: card.centerYAnchor),
            pro.widthAnchor.constraint(equalToConstant: 31),
            pro.heightAnchor.constraint(equalToConstant: 20)
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

private final class NativeItineraryTimelineCell: UITableViewCell {
    static let reuseIdentifier = "native-itinerary-timeline-cell"
    private let topLine = UIView(), bottomLine = UIView(), node = UIView(), iconView = UIImageView()
    private let title = UILabel(), detail = UILabel(), chevron = UIImageView(image: UIImage(systemName: "chevron.right"))

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        backgroundColor = AlmidyDesignTokens.Color.surface
        topLine.backgroundColor = AlmidyDesignTokens.Color.tripOverviewDivider
        bottomLine.backgroundColor = AlmidyDesignTokens.Color.tripOverviewDivider
        node.backgroundColor = AlmidyDesignTokens.Color.goldMutedSurface
        node.layer.cornerRadius = 20
        iconView.tintColor = AlmidyDesignTokens.Color.goldDark; iconView.contentMode = .scaleAspectFit
        title.font = AlmidyDesignTokens.Font.semibold(17); title.textColor = AlmidyDesignTokens.Color.textPrimary
        detail.font = AlmidyDesignTokens.Font.body(14); detail.textColor = AlmidyDesignTokens.Color.textSecondary; detail.numberOfLines = 2
        chevron.tintColor = AlmidyDesignTokens.Color.textTertiary; chevron.contentMode = .scaleAspectFit
        let text = UIStackView(arrangedSubviews: [title, detail]); text.axis = .vertical; text.spacing = 3
        [topLine, bottomLine, node, iconView, text, chevron].forEach { $0.translatesAutoresizingMaskIntoConstraints = false; contentView.addSubview($0) }
        NSLayoutConstraint.activate([
            node.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20), node.centerYAnchor.constraint(equalTo: contentView.centerYAnchor), node.widthAnchor.constraint(equalToConstant: 40), node.heightAnchor.constraint(equalToConstant: 40),
            iconView.centerXAnchor.constraint(equalTo: node.centerXAnchor), iconView.centerYAnchor.constraint(equalTo: node.centerYAnchor), iconView.widthAnchor.constraint(equalToConstant: 20), iconView.heightAnchor.constraint(equalToConstant: 20),
            topLine.centerXAnchor.constraint(equalTo: node.centerXAnchor), topLine.topAnchor.constraint(equalTo: contentView.topAnchor), topLine.bottomAnchor.constraint(equalTo: node.topAnchor), topLine.widthAnchor.constraint(equalToConstant: 2),
            bottomLine.centerXAnchor.constraint(equalTo: node.centerXAnchor), bottomLine.topAnchor.constraint(equalTo: node.bottomAnchor), bottomLine.bottomAnchor.constraint(equalTo: contentView.bottomAnchor), bottomLine.widthAnchor.constraint(equalToConstant: 2),
            text.leadingAnchor.constraint(equalTo: node.trailingAnchor, constant: 16), text.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            text.trailingAnchor.constraint(lessThanOrEqualTo: chevron.leadingAnchor, constant: -10),
            chevron.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20), chevron.centerYAnchor.constraint(equalTo: contentView.centerYAnchor), chevron.widthAnchor.constraint(equalToConstant: 9), chevron.heightAnchor.constraint(equalToConstant: 16)
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func prepareForReuse() {
        super.prepareForReuse()
        title.text = nil; detail.text = nil; iconView.image = nil
        topLine.isHidden = true; bottomLine.isHidden = true; chevron.isHidden = true
    }

    func configure(title: String, detail: String, symbol: String, connectsAbove: Bool, connectsBelow: Bool, editable: Bool) {
        self.title.text = title; self.detail.text = detail
        iconView.image = UIImage(systemName: symbol)
        iconView.tintColor = AlmidyDesignTokens.Color.goldDark
        node.backgroundColor = AlmidyDesignTokens.Color.goldMutedSurface
        node.isHidden = false; topLine.isHidden = !connectsAbove; bottomLine.isHidden = !connectsBelow
        chevron.isHidden = !editable; selectionStyle = editable ? .default : .none
    }

    func configureEmpty(showsAddPrompt: Bool) {
        title.text = showsAddPrompt ? "Add your first activity" : "No activities"
        detail.text = showsAddPrompt ? "Search for restaurants, places, transportation and more" : nil
        iconView.image = UIImage(systemName: showsAddPrompt ? "plus" : "circle.fill")
        iconView.tintColor = showsAddPrompt ? AlmidyDesignTokens.Color.goldDark : AlmidyDesignTokens.Color.textTertiary
        node.backgroundColor = showsAddPrompt ? AlmidyDesignTokens.Color.goldMutedSurface : AlmidyDesignTokens.Color.tripOverviewNeutralSurface
        node.isHidden = false; topLine.isHidden = true; bottomLine.isHidden = true; chevron.isHidden = true
        selectionStyle = showsAddPrompt ? .default : .none
    }
}

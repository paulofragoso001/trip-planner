import Foundation

enum NativeTripOverviewSectionState: String, Codable, Equatable {
    case available
    case empty
    case failed
}

enum NativeTripOverviewSection: String, Codable, Equatable {
    case itinerary
    case documents
    case expenses
    case recentItems
}

enum NativeTripOverviewRefreshStatus: String, Codable, Equatable {
    case idle
    case refreshing
    case refreshed
    case failed
}

struct NativeTripOverviewSectionStatus: Codable, Equatable {
    let state: NativeTripOverviewSectionState
    let error: String?
    let refreshStatus: NativeTripOverviewRefreshStatus

    init(
        state: NativeTripOverviewSectionState,
        error: String? = nil,
        refreshStatus: NativeTripOverviewRefreshStatus = .idle
    ) {
        self.state = state
        self.error = error
        self.refreshStatus = refreshStatus
    }

    func refreshing() -> Self {
        Self(state: state, error: error, refreshStatus: .refreshing)
    }
}

struct NativeTripOverviewMoney: Codable, Equatable {
    let currency: String
    let amount: Decimal

    init(currency: String, amount: Decimal) {
        self.currency = currency.uppercased()
        self.amount = amount
    }
}

enum NativeTripOverviewMoneyFormatter {
    static func string(_ money: NativeTripOverviewMoney, locale: Locale = .current) -> String {
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .currency
        formatter.currencyCode = money.currency
        return formatter.string(from: money.amount as NSDecimalNumber) ?? "\(money.currency) \(money.amount)"
    }

    static func spoken(_ money: NativeTripOverviewMoney, locale: Locale = .current) -> String {
        let name = locale.localizedString(forCurrencyCode: money.currency) ?? money.currency
        return "\(money.amount) \(name)"
    }
}

enum NativeTripOverviewDateCalculator {
    static func inclusiveDurationDays(startDate: String?, endDate: String?, timeZone: TimeZone) -> Int? {
        guard let startDate, let endDate else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        guard let start = formatter.date(from: startDate), let end = formatter.date(from: endDate), end >= start,
              let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: start), to: calendar.startOfDay(for: end)).day else { return nil }
        return days + 1
    }

    static func relativeTiming(startDate: String?, endDate: String?, now: Date, timeZone: TimeZone) -> String? {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let formatter = DateFormatter()
        formatter.calendar = calendar; formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone; formatter.dateFormat = "yyyy-MM-dd"
        let today = calendar.startOfDay(for: now)
        let start = startDate.flatMap(formatter.date).map(calendar.startOfDay)
        let end = endDate.flatMap(formatter.date).map(calendar.startOfDay)
        if let start, start > today {
            let days = calendar.dateComponents([.day], from: today, to: start).day ?? 0
            return days == 1 ? "Starts tomorrow" : "Starts in \(days) days"
        }
        if let start, let end, start <= today, end >= today { return "Happening now" }
        if let end, end < today {
            let days = calendar.dateComponents([.day], from: end, to: today).day ?? 0
            return days == 1 ? "Ended yesterday" : "Ended \(days) days ago"
        }
        return nil
    }
}

struct NativeTripOverviewSeed: Equatable {
    let tripID: String
    let title: String
    let dateRange: String
    let imageURL: URL?
    let fallbackColor: String
}

enum NativeTripOverviewActionKind: String, Codable, Equatable {
    case newActivity
    case places
    case routes
    case flights
    case stays
}

enum NativeTripOverviewActionDestination: Codable, Equatable {
    case webHandoff(URL)
    case nativePlaces(URL)
    case nativeRoutes(URL)

    private enum CodingKeys: String, CodingKey { case kind, url }
    private enum Kind: String, Codable { case webHandoff, nativePlaces, nativeRoutes }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        let url = try values.decode(URL.self, forKey: .url)
        switch try values.decode(Kind.self, forKey: .kind) {
        case .webHandoff: self = .webHandoff(url)
        case .nativePlaces: self = .nativePlaces(url)
        case .nativeRoutes: self = .nativeRoutes(url)
        }
    }

    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .webHandoff(let url):
            try values.encode(Kind.webHandoff, forKey: .kind); try values.encode(url, forKey: .url)
        case .nativePlaces(let url):
            try values.encode(Kind.nativePlaces, forKey: .kind); try values.encode(url, forKey: .url)
        case .nativeRoutes(let url):
            try values.encode(Kind.nativeRoutes, forKey: .kind); try values.encode(url, forKey: .url)
        }
    }
}

struct NativeTripOverviewAction: Codable, Equatable {
    let kind: NativeTripOverviewActionKind
    let label: String
    let destination: NativeTripOverviewActionDestination?

    var isAvailable: Bool { destination != nil }
}

struct NativeTripOverview: Codable, Equatable {
    static let supportedVersion = 1

    let version: Int
    let trip: Trip
    let hero: Hero
    let itinerary: Itinerary
    let documents: Documents
    let expenses: Expenses
    let recentItems: RecentItems
    let actions: [NativeTripOverviewAction]

    init(
        version: Int,
        trip: Trip,
        hero: Hero,
        itinerary: Itinerary,
        documents: Documents,
        expenses: Expenses,
        recentItems: RecentItems,
        actions: [NativeTripOverviewAction]
    ) {
        self.version = version; self.trip = trip; self.hero = hero; self.itinerary = itinerary
        self.documents = documents; self.expenses = expenses; self.recentItems = recentItems; self.actions = actions
    }

    struct Trip: Codable, Equatable {
        let id: String
        let title: String
        let destination: String
        let countryCode: String?
        let startDate: String?
        let endDate: String?
        let dateRange: String
        let relativeTiming: String?
        let durationDays: Int?
        let status: String
    }

    struct Hero: Codable, Equatable {
        let imageURL: URL?
        let alt: String
        let attribution: String?
        let sourceLabel: String?
        let fallbackColor: String
    }

    struct ItineraryCategory: Codable, Equatable {
        let key: String; let label: String; let count: Int; let icon: String
    }

    struct Itinerary: Codable, Equatable {
        let status: NativeTripOverviewSectionStatus
        let exactCount: Int
        let dateRange: String
        let categories: [ItineraryCategory]
    }

    struct Document: Codable, Equatable {
        let id: String; let title: String; let type: String; let date: String?; let url: URL
    }

    struct Documents: Codable, Equatable {
        let status: NativeTripOverviewSectionStatus
        let items: [Document]
    }

    struct ExpenseCategory: Codable, Equatable {
        let key: String; let label: String; let money: NativeTripOverviewMoney
    }

    struct ExpenseCurrency: Codable, Equatable {
        let total: NativeTripOverviewMoney
        let categories: [ExpenseCategory]
    }

    struct Expenses: Codable, Equatable {
        let status: NativeTripOverviewSectionStatus
        let ledger: String
        let currencies: [ExpenseCurrency]
    }

    struct RecentItem: Codable, Equatable {
        let id: String; let title: String; let category: String; let icon: String; let createdAt: String; let url: URL
    }

    struct RecentItems: Codable, Equatable {
        let status: NativeTripOverviewSectionStatus
        let items: [RecentItem]
    }

    private enum CodingKeys: String, CodingKey {
        case version, trip, hero, itinerarySummary, documentsPreview, expenseSummary, recentItems, supportedActions
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        version = try values.decode(Int.self, forKey: .version)
        guard version == Self.supportedVersion else {
            throw DecodingError.dataCorruptedError(forKey: .version, in: values, debugDescription: "Unsupported trip overview version")
        }
        trip = try values.decode(Trip.self, forKey: .trip)
        hero = try values.decode(HeroWire.self, forKey: .hero).model
        itinerary = try values.decode(ItineraryWire.self, forKey: .itinerarySummary).model
        documents = try values.decode(DocumentsWire.self, forKey: .documentsPreview).model
        expenses = try values.decode(ExpensesWire.self, forKey: .expenseSummary).model
        recentItems = try values.decode(RecentItemsWire.self, forKey: .recentItems).model
        actions = try values.decode([ActionWire].self, forKey: .supportedActions).map(\.model)
    }

    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(version, forKey: .version)
        try values.encode(trip, forKey: .trip)
        try values.encode(HeroWire(model: hero), forKey: .hero)
        try values.encode(ItineraryWire(model: itinerary), forKey: .itinerarySummary)
        try values.encode(DocumentsWire(model: documents), forKey: .documentsPreview)
        try values.encode(ExpensesWire(model: expenses), forKey: .expenseSummary)
        try values.encode(RecentItemsWire(model: recentItems), forKey: .recentItems)
        try values.encode(actions.map(ActionWire.init(model:)), forKey: .supportedActions)
    }
}

enum NativeTripOverviewViewState: Equatable {
    case loading
    case loaded(NativeTripOverview)
    case stale(NativeTripOverview, refresh: NativeTripOverviewRefreshStatus)
    case partial(NativeTripOverview, failedSections: [NativeTripOverviewSection])
    case authenticationExpired(cached: NativeTripOverview?)
    case recoverableError(message: String, cached: NativeTripOverview?, canRetry: Bool)
}

private struct HeroWire: Codable {
    let imageUrl: URL?; let alt: String; let attribution: String?; let sourceLabel: String?; let fallbackColor: String
    var model: NativeTripOverview.Hero { .init(imageURL: imageUrl, alt: alt, attribution: attribution, sourceLabel: sourceLabel, fallbackColor: fallbackColor) }
    init(model: NativeTripOverview.Hero) { imageUrl = model.imageURL; alt = model.alt; attribution = model.attribution; sourceLabel = model.sourceLabel; fallbackColor = model.fallbackColor }
}

private struct StatusWire: Codable {
    let state: NativeTripOverviewSectionState; let error: String?
    var model: NativeTripOverviewSectionStatus { .init(state: state, error: error) }
    init(model: NativeTripOverviewSectionStatus) { state = model.state; error = model.error }
}

private struct ItineraryWire: Codable {
    let state: NativeTripOverviewSectionState; let error: String?; let exactCount: Int; let dateRange: String
    let categories: [NativeTripOverview.ItineraryCategory]
    var model: NativeTripOverview.Itinerary { .init(status: .init(state: state, error: error), exactCount: exactCount, dateRange: dateRange, categories: categories) }
    init(model: NativeTripOverview.Itinerary) { state = model.status.state; error = model.status.error; exactCount = model.exactCount; dateRange = model.dateRange; categories = model.categories }
}

private struct DocumentsWire: Codable {
    struct Item: Codable { let id: String; let title: String; let type: String; let date: String?; let href: URL }
    let state: NativeTripOverviewSectionState; let error: String?; let items: [Item]
    var model: NativeTripOverview.Documents { .init(status: .init(state: state, error: error), items: items.map { .init(id: $0.id, title: $0.title, type: $0.type, date: $0.date, url: $0.href) }) }
    init(model: NativeTripOverview.Documents) { state = model.status.state; error = model.status.error; items = model.items.map { Item(id: $0.id, title: $0.title, type: $0.type, date: $0.date, href: $0.url) } }
}

private struct ExpensesWire: Codable {
    struct Category: Codable { let key: String; let label: String; let amount: Decimal; let amountLabel: String? }
    struct Currency: Codable { let currency: String; let total: Decimal; let totalLabel: String?; let categories: [Category] }
    let state: NativeTripOverviewSectionState; let error: String?; let ledger: String; let currencies: [Currency]
    var model: NativeTripOverview.Expenses {
        .init(status: .init(state: state, error: error), ledger: ledger, currencies: currencies.map { value in
            .init(total: .init(currency: value.currency, amount: value.total), categories: value.categories.map {
                .init(key: $0.key, label: $0.label, money: .init(currency: value.currency, amount: $0.amount))
            })
        })
    }
    init(model: NativeTripOverview.Expenses) {
        state = model.status.state; error = model.status.error; ledger = model.ledger
        currencies = model.currencies.map { value in
            Currency(currency: value.total.currency, total: value.total.amount, totalLabel: nil, categories: value.categories.map {
                Category(key: $0.key, label: $0.label, amount: $0.money.amount, amountLabel: nil)
            })
        }
    }
}

private struct RecentItemsWire: Codable {
    struct Item: Codable { let id: String; let title: String; let category: String; let icon: String; let createdAt: String; let href: URL }
    let state: NativeTripOverviewSectionState; let error: String?; let items: [Item]
    var model: NativeTripOverview.RecentItems { .init(status: .init(state: state, error: error), items: items.map { .init(id: $0.id, title: $0.title, category: $0.category, icon: $0.icon, createdAt: $0.createdAt, url: $0.href) }) }
    init(model: NativeTripOverview.RecentItems) { state = model.status.state; error = model.status.error; items = model.items.map { Item(id: $0.id, title: $0.title, category: $0.category, icon: $0.icon, createdAt: $0.createdAt, href: $0.url) } }
}

private struct ActionWire: Codable {
    let key: NativeTripOverviewActionKind; let label: String; let available: Bool; let href: URL?; let handoff: String?
    var model: NativeTripOverviewAction {
        let destination: NativeTripOverviewActionDestination?
        switch (available, key, handoff, href) {
        case (true, .newActivity, "web", .some(let url)),
             (true, .places, "web", .some(let url)): destination = .webHandoff(url)
        case (true, .places, "native-route", .some(let url)): destination = .nativePlaces(url)
        case (true, .routes, "native-route", .some(let url)): destination = .nativeRoutes(url)
        default: destination = nil
        }
        return .init(kind: key, label: label, destination: destination)
    }
    init(model: NativeTripOverviewAction) {
        key = model.kind; label = model.label; available = model.isAvailable
        switch model.destination {
        case .webHandoff(let url): href = url; handoff = "web"
        case .nativePlaces(let url): href = url; handoff = "native-route"
        case .nativeRoutes(let url): href = url; handoff = "native-route"
        case nil: href = nil; handoff = nil
        }
    }
}

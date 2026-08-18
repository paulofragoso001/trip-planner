import MapKit
import UIKit

struct NativeActivityCategory: Equatable {
    enum Palette: Equatable {
        case accommodation, transportation, food, entertainment, location
        case study, outdoor, sport, service, health, shopping
        case custom(String)

        var tint: UIColor {
            switch self {
            case .accommodation: return AlmidyDesignTokens.Color.generatedTripGradientStart
            case .transportation: return AlmidyDesignTokens.Color.info
            case .food: return AlmidyDesignTokens.Color.goldMuted
            case .entertainment: return AlmidyDesignTokens.Color.goldDeep
            case .location: return AlmidyDesignTokens.Color.tripOverviewAccent
            case .study: return AlmidyDesignTokens.Color.goldMuted
            case .outdoor: return AlmidyDesignTokens.Color.success
            case .sport: return AlmidyDesignTokens.Color.generatedTripGradientStart
            case .service: return AlmidyDesignTokens.Color.tripOverviewNeutralIcon
            case .health: return AlmidyDesignTokens.Color.danger
            case .shopping: return AlmidyDesignTokens.Color.goldDeep
            case let .custom(hex): return UIColor(almidyHex: hex)
            }
        }

        var surface: UIColor {
            switch self {
            case .food, .entertainment, .location, .study, .shopping:
                return AlmidyDesignTokens.Color.tripOverviewAccentSurface
            case .service:
                return AlmidyDesignTokens.Color.tripOverviewNeutralSurface
            case .custom:
                return tint.withAlphaComponent(0.12)
            default:
                return tint.withAlphaComponent(0.12)
            }
        }
    }

    let name: String
    let symbols: [String]
    let palette: Palette

    var image: UIImage {
        symbols.lazy.compactMap { UIImage(systemName: $0) }.first
            ?? UIImage(systemName: "circle.fill")!
    }
}

private extension UIColor {
    convenience init(almidyHex: String) {
        let value = UInt64(almidyHex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0xA58A50
        self.init(
            red: CGFloat((value >> 16) & 0xff) / 255,
            green: CGFloat((value >> 8) & 0xff) / 255,
            blue: CGFloat(value & 0xff) / 255,
            alpha: 1
        )
    }
}

private struct NativeCustomActivityCategoryRecord: Codable, Equatable {
    let name: String
    let symbol: String
    let colorHex: String

    var category: NativeActivityCategory {
        .init(name: name, symbols: [symbol], palette: .custom(colorHex))
    }
}

struct NativeActivityCategorySection: Equatable {
    let title: String
    let items: [NativeActivityCategory]
}

enum NativeActivityCatalog {
    static let quickNames = [
        "Flight", "Stay", "Restaurant", "Tour", "Car",
        "Train", "Shopping", "Museum", "Event", "Car Rental", "Park",
    ]

    static let sections: [NativeActivityCategorySection] = [
        .init(title: "Stays and Other Accommodation", items: [
            item("Stays", "bed.double.fill", .accommodation),
            item("Campground", ["tent.2.fill", "tent.fill"], .outdoor),
        ]),
        .init(title: "Transportation", items: [
            item("Flights", "airplane", .transportation), item("Car", "car.fill", .transportation),
            item("Train", ["train.side.front.car", "tram.fill"], .transportation),
            item("Car Rental", ["car.2.fill", "car.side.fill"], .transportation),
            item("Transfer", "car.fill", .transportation),
            item("Cruise", ["cruise.ship.fill", "ferry.fill"], .transportation),
            item("Walk", "figure.walk", .transportation), item("Bus", "bus.fill", .transportation),
            item("Bike", "bicycle", .transportation), item("Ferry", ["ferry.fill", "water.waves"], .transportation),
            item("Motorcycle", "motorcycle.fill", .transportation),
        ]),
        .init(title: "Food & Drink", items: [
            item("Bakery", ["croissant.fill", "birthday.cake.fill"], .food),
            item("Bar & Party", "martini.glass.fill", .food),
            item("Brewery", ["mug.fill", "cup.and.saucer.fill"], .food), item("Cafe", "cup.and.saucer.fill", .food),
            item("Pizza", ["pizza.slice.fill", "takeoutbag.and.cup.and.straw.fill"], .food),
            item("Restaurant", "fork.knife", .food),
            item("Winery", "wineglass.fill", .food),
        ]),
        .init(title: "Art & Fun", items: [
            item("Amusement Park", "ferriswheel", .entertainment), item("Concert", "music.note", .entertainment),
            item("Event", ["ticket.fill", "star.square.fill"], .entertainment),
            item("Kids", ["teddybear.fill", "figure.2.and.child.holdinghands"], .entertainment),
            item("Movie Theater", ["film.stack.fill", "film.fill"], .entertainment),
            item("Museum", "building.columns.fill", .entertainment),
            item("Nightlife", ["disco.ball.fill", "sparkles"], .entertainment),
            item("Theater", "theatermasks.fill", .entertainment),
            item("Tour", "map.fill", .entertainment),
        ]),
        .init(title: "Locations", items: [item("Location", ["mappin", "mappin.circle.fill"], .location)]),
        .init(title: "Work & Study", items: [
            item("Library", ["book.fill", "books.vertical.fill"], .study),
            item("Meeting", ["rectangle.inset.filled.and.person.filled", "person.3.fill"], .study),
            item("School", "pencil.and.ruler.fill", .study), item("University", "graduationcap.fill", .study),
        ]),
        .init(title: "Outdoor", items: [
            item("Beach", "beach.umbrella.fill", .outdoor),
            item("National Park", ["shield.fill", "tree.fill"], .outdoor),
            item("Park", ["bench.fill", "tree.fill"], .outdoor),
            item("Relax", ["camera.macro", "leaf.fill"], .outdoor),
        ]),
        .init(title: "Sports", items: [
            item("Fitness", "dumbbell.fill", .sport), item("Stadium", "sportscourt.fill", .sport),
        ]),
        .init(title: "Services", items: [
            item("ATM", "banknote.fill", .service), item("Bank", "building.columns.fill", .service),
            item("EV Charger", ["ev.charger.fill", "bolt.car.fill"], .service),
            item("Fire Station", ["fire.extinguisher.fill", "flame.fill"], .service),
            item("Gas Station", "fuelpump.fill", .service), item("Laundry", "washer.fill", .service),
            item("Marina", "anchor", .service), item("Parking", "parkingsign", .service),
            item("Police", ["police.badge.fill", "shield.lefthalf.filled.badge.checkmark"], .service),
            item("Post Office", ["stamp.fill", "envelope.fill"], .service),
            item("Public Transport", ["figure.wave", "cablecar.fill"], .service),
        ]),
        .init(title: "Health", items: [
            item("Hospital", "cross.case.fill", .health), item("Pharmacy", "pills.fill", .health),
        ]),
        .init(title: "Shopping", items: [
            item("Food Market", "storefront.fill", .shopping), item("Shopping", "bag.fill", .shopping),
        ]),
    ]

    static let quickItems: [NativeActivityCategory] = [
        item("Flight", "airplane", .transportation), item("Stay", "bed.double.fill", .accommodation),
        item("Restaurant", "fork.knife", .food), item("Tour", "map.fill", .entertainment),
        item("Car", "car.fill", .transportation),
        item("Train", ["train.side.front.car", "tram.fill"], .transportation),
        item("Shopping", "bag.fill", .shopping),
        item("Museum", "building.columns.fill", .entertainment),
        item("Event", ["ticket.fill", "star.square.fill"], .entertainment),
        item("Car Rental", ["car.2.fill", "car.side.fill"], .transportation),
        item("Park", ["bench.fill", "tree.fill"], .outdoor),
    ]

    static var allNames: [String] { sections.flatMap(\.items).map(\.name) }

    static func category(named name: String) -> NativeActivityCategory? {
        quickItems.first { $0.name == name }
            ?? sections.flatMap(\.items).first { $0.name == name }
    }

    private static func item(_ name: String, _ symbol: String, _ palette: NativeActivityCategory.Palette) -> NativeActivityCategory {
        item(name, [symbol], palette)
    }

    private static func item(_ name: String, _ symbols: [String], _ palette: NativeActivityCategory.Palette) -> NativeActivityCategory {
        .init(name: name, symbols: symbols, palette: palette)
    }
}

enum NativeActivitySearchDomain: String, CaseIterable {
    case accommodation
    case transportation
    case foodAndDrink
    case entertainment
    case location
    case education
    case outdoor
    case sports
    case services
    case health
    case shopping
    case custom
}

enum NativeActivityMapPlaceKind: String, CaseIterable {
    case lodging, campground
    case airport, car, railwayStation, carRental, transfer, cruiseTerminal, pedestrian, busStop, bicycle, ferryTerminal, motorcycle
    case bakery, bar, brewery, cafe, pizzeria, restaurant, winery
    case amusementPark, concertVenue, eventVenue, childFriendly, movieTheater, museum, nightlife, theater, tour
    case place, library, meetingVenue, school, university
    case beach, nationalPark, park, relaxation
    case fitnessCenter, stadium
    case atm, bank, evCharger, fireStation, gasStation, laundry, marina, parking, police, postOffice, publicTransit
    case hospital, pharmacy, foodMarket, store, generic
}

struct NativeActivityPurpose: Equatable {
    let canonicalName: String
    let aliases: [String]
    let searchToken: String
    let searchPlaceholder: String
    let queryTerms: [String]
    let mapPlaceKinds: [NativeActivityMapPlaceKind]
    let domain: NativeActivitySearchDomain

    var opensDedicatedActivityForm: Bool { domain == .transportation }
}

enum NativeActivityPurposeRegistry {
    static let all: [NativeActivityPurpose] = [
        make("Stays", aliases: ["Stay"], token: "Stay", placeholder: "Hotel name or address", terms: ["hotel", "lodging", "hostel", "resort", "motel", "inn"], kinds: [.lodging], domain: .accommodation),
        make("Campground", placeholder: "Campground or park name", terms: ["campground", "camping", "RV park"], kinds: [.campground], domain: .accommodation),

        make("Flights", aliases: ["Flight"], token: "Flight", placeholder: "Airport or flight location", terms: ["airport", "airline", "terminal"], kinds: [.airport], domain: .transportation),
        make("Car", placeholder: "Car destination or address", terms: ["car", "driving", "road"], kinds: [.car], domain: .transportation),
        make("Train", placeholder: "Train station or route", terms: ["train station", "railway", "rail"], kinds: [.railwayStation], domain: .transportation),
        make("Car Rental", placeholder: "Car rental agency", terms: ["car rental", "rental car"], kinds: [.carRental], domain: .transportation),
        make("Transfer", placeholder: "Transfer pickup or destination", terms: ["transfer", "shuttle", "taxi"], kinds: [.transfer], domain: .transportation),
        make("Cruise", placeholder: "Cruise port or terminal", terms: ["cruise terminal", "cruise port"], kinds: [.cruiseTerminal], domain: .transportation),
        make("Walk", placeholder: "Walking destination", terms: ["walking", "pedestrian"], kinds: [.pedestrian], domain: .transportation),
        make("Bus", placeholder: "Bus stop or station", terms: ["bus stop", "bus station"], kinds: [.busStop], domain: .transportation),
        make("Bike", placeholder: "Bike destination or rental", terms: ["bicycle", "bike rental"], kinds: [.bicycle], domain: .transportation),
        make("Ferry", placeholder: "Ferry terminal or route", terms: ["ferry terminal", "ferry"], kinds: [.ferryTerminal], domain: .transportation),
        make("Motorcycle", placeholder: "Motorcycle destination", terms: ["motorcycle", "motorbike"], kinds: [.motorcycle], domain: .transportation),

        make("Bakery", placeholder: "Bakery name or address", terms: ["bakery", "pastry"], kinds: [.bakery], domain: .foodAndDrink),
        make("Bar & Party", aliases: ["Bar and Party"], placeholder: "Bar, club, or party venue", terms: ["bar", "club", "party venue"], kinds: [.bar, .nightlife], domain: .foodAndDrink),
        make("Brewery", placeholder: "Brewery name or address", terms: ["brewery", "beer"], kinds: [.brewery], domain: .foodAndDrink),
        make("Cafe", placeholder: "Cafe name or address", terms: ["cafe", "coffee shop"], kinds: [.cafe], domain: .foodAndDrink),
        make("Pizza", placeholder: "Pizzeria name or address", terms: ["pizza", "pizzeria"], kinds: [.pizzeria], domain: .foodAndDrink),
        make("Restaurant", placeholder: "Restaurant name or address", terms: ["restaurant", "food"], kinds: [.restaurant], domain: .foodAndDrink),
        make("Winery", placeholder: "Winery name or address", terms: ["winery", "vineyard"], kinds: [.winery], domain: .foodAndDrink),

        make("Amusement Park", placeholder: "Amusement park name", terms: ["amusement park", "theme park"], kinds: [.amusementPark], domain: .entertainment),
        make("Concert", placeholder: "Concert or music venue", terms: ["concert", "music venue"], kinds: [.concertVenue], domain: .entertainment),
        make("Event", placeholder: "Event or venue name", terms: ["event", "event venue"], kinds: [.eventVenue], domain: .entertainment),
        make("Kids", placeholder: "Kid-friendly activity", terms: ["kids activity", "child friendly"], kinds: [.childFriendly], domain: .entertainment),
        make("Movie Theater", placeholder: "Movie theater name", terms: ["movie theater", "cinema"], kinds: [.movieTheater], domain: .entertainment),
        make("Museum", placeholder: "Museum name or address", terms: ["museum", "gallery"], kinds: [.museum], domain: .entertainment),
        make("Nightlife", placeholder: "Nightlife venue", terms: ["nightlife", "nightclub"], kinds: [.nightlife], domain: .entertainment),
        make("Theater", placeholder: "Theater name or address", terms: ["theater", "performing arts"], kinds: [.theater], domain: .entertainment),
        make("Tour", placeholder: "Tour or attraction", terms: ["tour", "sightseeing"], kinds: [.tour], domain: .entertainment),

        make("Location", placeholder: "Place name or address", terms: ["place", "location", "address"], kinds: [.place], domain: .location),
        make("Library", placeholder: "Library name or address", terms: ["library"], kinds: [.library], domain: .education),
        make("Meeting", placeholder: "Meeting venue or address", terms: ["meeting venue", "conference room"], kinds: [.meetingVenue], domain: .education),
        make("School", placeholder: "School name or address", terms: ["school"], kinds: [.school], domain: .education),
        make("University", placeholder: "University name or address", terms: ["university", "college"], kinds: [.university], domain: .education),

        make("Beach", placeholder: "Beach name or location", terms: ["beach"], kinds: [.beach], domain: .outdoor),
        make("National Park", placeholder: "National park name", terms: ["national park"], kinds: [.nationalPark], domain: .outdoor),
        make("Park", placeholder: "Park name or address", terms: ["park", "public park"], kinds: [.park], domain: .outdoor),
        make("Relax", placeholder: "Spa or relaxing place", terms: ["spa", "relaxation", "wellness"], kinds: [.relaxation], domain: .outdoor),
        make("Fitness", placeholder: "Gym or fitness center", terms: ["gym", "fitness center"], kinds: [.fitnessCenter], domain: .sports),
        make("Stadium", placeholder: "Stadium or arena", terms: ["stadium", "arena"], kinds: [.stadium], domain: .sports),

        make("ATM", placeholder: "ATM location", terms: ["ATM", "cash machine"], kinds: [.atm], domain: .services),
        make("Bank", placeholder: "Bank name or address", terms: ["bank"], kinds: [.bank], domain: .services),
        make("EV Charger", placeholder: "EV charging station", terms: ["EV charger", "electric vehicle charging"], kinds: [.evCharger], domain: .services),
        make("Fire Station", placeholder: "Fire station", terms: ["fire station"], kinds: [.fireStation], domain: .services),
        make("Gas Station", placeholder: "Gas station", terms: ["gas station", "fuel station"], kinds: [.gasStation], domain: .services),
        make("Laundry", placeholder: "Laundry or laundromat", terms: ["laundry", "laundromat"], kinds: [.laundry], domain: .services),
        make("Marina", placeholder: "Marina name or address", terms: ["marina", "boat harbor"], kinds: [.marina], domain: .services),
        make("Parking", placeholder: "Parking location", terms: ["parking", "parking garage"], kinds: [.parking], domain: .services),
        make("Police", placeholder: "Police station", terms: ["police station"], kinds: [.police], domain: .services),
        make("Post Office", placeholder: "Post office", terms: ["post office", "mail"], kinds: [.postOffice], domain: .services),
        make("Public Transport", placeholder: "Public transit stop", terms: ["public transit", "public transport"], kinds: [.publicTransit], domain: .services),
        make("Hospital", placeholder: "Hospital name or address", terms: ["hospital", "medical center"], kinds: [.hospital], domain: .health),
        make("Pharmacy", placeholder: "Pharmacy name or address", terms: ["pharmacy", "drugstore"], kinds: [.pharmacy], domain: .health),
        make("Food Market", placeholder: "Food market or grocery", terms: ["food market", "grocery store"], kinds: [.foodMarket], domain: .shopping),
        make("Shopping", placeholder: "Store or shopping center", terms: ["shopping", "store", "shopping mall"], kinds: [.store], domain: .shopping)
    ]

    private static let lookup: [String: NativeActivityPurpose] = {
        var values: [String: NativeActivityPurpose] = [:]
        for purpose in all {
            for name in [purpose.canonicalName] + purpose.aliases {
                values[normalized(name)] = purpose
            }
        }
        return values
    }()

    static var unresolvedCatalogNames: [String] {
        NativeActivityCatalog.allNames.filter { purpose(named: $0) == nil }
    }

    static func purpose(named name: String) -> NativeActivityPurpose? {
        lookup[normalized(name)]
    }

    static func purpose(for category: NativeActivityCategory) -> NativeActivityPurpose {
        purpose(named: category.name) ?? NativeActivityPurpose(
            canonicalName: category.name,
            aliases: [],
            searchToken: category.name,
            searchPlaceholder: "Search activities and places",
            queryTerms: [category.name],
            mapPlaceKinds: [.generic],
            domain: .custom
        )
    }

    private static func make(
        _ name: String,
        aliases: [String] = [],
        token: String? = nil,
        placeholder: String,
        terms: [String],
        kinds: [NativeActivityMapPlaceKind],
        domain: NativeActivitySearchDomain
    ) -> NativeActivityPurpose {
        NativeActivityPurpose(
            canonicalName: name,
            aliases: aliases,
            searchToken: token ?? name,
            searchPlaceholder: placeholder,
            queryTerms: terms,
            mapPlaceKinds: kinds,
            domain: domain
        )
    }

    private static func normalized(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "en_US_POSIX"))
            .replacingOccurrences(of: "&", with: "and")
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .joined()
    }
}

private final class NativeNonFloatingHeaderTableView: UITableView {
    override func layoutSubviews() {
        super.layoutSubviews()

        for section in 0..<numberOfSections {
            guard let header = headerView(forSection: section) else { continue }
            let naturalFrame = rectForHeader(inSection: section)
            guard naturalFrame.height > 0, header.frame != naturalFrame else { continue }
            header.frame = naturalFrame
        }
    }
}

final class NativeNewActivityViewController: UIViewController, UITableViewDataSource, UITableViewDelegate {
    fileprivate enum Typography {
        static let title = UIFont.systemFont(ofSize: 38, weight: .bold)
        static let search = UIFontMetrics(forTextStyle: .body).scaledFont(
            for: .systemFont(ofSize: 16), maximumPointSize: 17
        )
        static let section = UIFontMetrics(forTextStyle: .headline).scaledFont(
            for: .systemFont(ofSize: 15, weight: .semibold), maximumPointSize: 16
        )
        static let row = UIFontMetrics(forTextStyle: .body).scaledFont(
            for: .systemFont(ofSize: 16, weight: .semibold), maximumPointSize: 17
        )
        static let quick = UIFontMetrics(forTextStyle: .caption1).scaledFont(
            for: .systemFont(ofSize: 13), maximumPointSize: 14
        )
        static let footerPrompt = UIFontMetrics(forTextStyle: .body).scaledFont(
            for: .systemFont(ofSize: 16), maximumPointSize: 17
        )
        static let footerAction = UIFontMetrics(forTextStyle: .headline).scaledFont(
            for: .systemFont(ofSize: 17, weight: .semibold), maximumPointSize: 18
        )
    }

    private let tripID: String
    private let onSelect: (NativeActivityCategory) -> Void
    private let onFilterChange: (NativeActivityCategory, String, Bool, MKCoordinateRegion?, [MKMapItem]) -> Void
    private let onFilterClear: () -> Void
    private let onSelectFilteredResult: (NativeActivityCategory, String, Bool, MKCoordinateRegion?, [MKMapItem], String) -> Void
    private let onEnterManually: () -> Void
    private let onDismiss: () -> Void
    private let initialSearchRegion: MKCoordinateRegion?
    private let nearbySearchRegion: MKCoordinateRegion?
    private let sheetBlurView = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterial))
    private let sheetReadabilityVeil = UIView()
    private let headerResultsDivider = UIView()
    private let tableView = NativeNonFloatingHeaderTableView(frame: .zero, style: .plain)
    private let searchField = UISearchTextField()
    private let filterPromptLabel = UILabel()
    private var filterPromptLeadingConstraint: NSLayoutConstraint!
    private let nearbyButton = UIButton(type: .system)
    private let everywhereButton = UIButton(type: .system)
    private let scopeStack = UIStackView()
    private var scopeHeightConstraint: NSLayoutConstraint!
    private let filteredManualStack = UIStackView()
    private var filteredManualTopConstraint: NSLayoutConstraint!
    private var filteredManualHeightConstraint: NSLayoutConstraint!
    private let regionGeocoder = CLGeocoder()
    private var placeSearch: MKLocalSearch?
    private var searchGeneration = 0
    private var visibleSections = NativeActivityCatalog.sections
    private var placeResults: [MKMapItem] = []
    private var selectedResultID: String?
    private var implicitRegionLocality: String?
    private var activeSearchCategory: NativeActivityCategory?
    private var searchesNearby = false
    private var searchLocality: String?
    private var selectedSearchRegion: MKCoordinateRegion?
    private var hasCollapsedForSearchResults = false
    private static let customCategoryDefaultsKey = "almidy.native.customActivityCategories.v2"
    private static let legacyCustomCategoryDefaultsKey = "almidy.native.customActivityCategories"
    private static let quickCategoryDefaultsKey = "almidy.native.quickActivityCategories.v1"

    private var resolvedSearchRegion: MKCoordinateRegion? {
        if searchesNearby {
            return nearbySearchRegion ?? initialSearchRegion
        }
        return selectedSearchRegion ?? initialSearchRegion
    }

    private var quickCategories: [NativeActivityCategory] {
        let storedNames = UserDefaults.standard.stringArray(forKey: Self.quickCategoryDefaultsKey)
            ?? NativeActivityCatalog.quickNames
        let resolved = storedNames.compactMap(NativeActivityCatalog.category(named:))
        return resolved.isEmpty ? NativeActivityCatalog.quickItems : resolved
    }

    private var customCategories: [NativeCustomActivityCategoryRecord] {
        get {
            if let data = UserDefaults.standard.data(forKey: Self.customCategoryDefaultsKey),
               let records = try? JSONDecoder().decode([NativeCustomActivityCategoryRecord].self, from: data) {
                return records
            }
            return (UserDefaults.standard.stringArray(forKey: Self.legacyCustomCategoryDefaultsKey) ?? []).map {
                .init(name: $0, symbol: "bookmark.fill", colorHex: "A58A50")
            }
        }
        set {
            if let data = try? JSONEncoder().encode(newValue) {
                UserDefaults.standard.set(data, forKey: Self.customCategoryDefaultsKey)
            }
        }
    }

    private var availableSections: [NativeActivityCategorySection] {
        let customItems = customCategories.map(\.category)
        guard !customItems.isEmpty else { return NativeActivityCatalog.sections }
        return [.init(title: "Custom Categories", items: customItems)] + NativeActivityCatalog.sections
    }

    init(
        tripID: String,
        onSelect: @escaping (NativeActivityCategory) -> Void,
        onFilterChange: @escaping (NativeActivityCategory, String, Bool, MKCoordinateRegion?, [MKMapItem]) -> Void = { _, _, _, _, _ in },
        onFilterClear: @escaping () -> Void = {},
        onSelectFilteredResult: @escaping (NativeActivityCategory, String, Bool, MKCoordinateRegion?, [MKMapItem], String) -> Void = { _, _, _, _, _, _ in },
        onEnterManually: @escaping () -> Void,
        onDismiss: @escaping () -> Void = {},
        initialSearchRegion: MKCoordinateRegion? = nil,
        nearbySearchRegion: MKCoordinateRegion? = nil,
        initialSearchLocality: String? = nil
    ) {
        self.tripID = tripID
        self.onSelect = onSelect
        self.onFilterChange = onFilterChange
        self.onFilterClear = onFilterClear
        self.onSelectFilteredResult = onSelectFilteredResult
        self.onEnterManually = onEnterManually
        self.onDismiss = onDismiss
        self.initialSearchRegion = initialSearchRegion
        self.nearbySearchRegion = nearbySearchRegion
        self.implicitRegionLocality = initialSearchLocality
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        visibleSections = availableSections
        if let initialSearchRegion {
            resolveImplicitRegionLocality(for: initialSearchRegion)
        }
        configureReadableSheetSurface()
        configureNavigation()
        configureSearch()
        configureScope()
        configureFilteredManualAction()
        configureTable()
    }

    private func configureReadableSheetSurface() {
        view.backgroundColor = .clear

        sheetBlurView.translatesAutoresizingMaskIntoConstraints = false
        sheetBlurView.isUserInteractionEnabled = false
        view.addSubview(sheetBlurView)

        sheetReadabilityVeil.translatesAutoresizingMaskIntoConstraints = false
        sheetReadabilityVeil.isUserInteractionEnabled = false
        sheetReadabilityVeil.backgroundColor = UIColor { traits in
            let neutral: UIColor = traits.userInterfaceStyle == .dark ? .black : .white
            return neutral.withAlphaComponent(0.84)
        }
        view.addSubview(sheetReadabilityVeil)

        NSLayoutConstraint.activate([
            sheetBlurView.topAnchor.constraint(equalTo: view.topAnchor),
            sheetBlurView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            sheetBlurView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            sheetBlurView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            sheetReadabilityVeil.topAnchor.constraint(equalTo: view.topAnchor),
            sheetReadabilityVeil.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            sheetReadabilityVeil.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            sheetReadabilityVeil.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    private func configureNavigation() {
        title = "New Activity"
        navigationItem.largeTitleDisplayMode = .always
        navigationController?.navigationBar.prefersLargeTitles = true
        navigationController?.navigationBar.largeTitleTextAttributes = [
            .font: Typography.title,
            .foregroundColor: UIColor.label,
        ]
        let appearance = UINavigationBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.backgroundEffect = UIBlurEffect(style: .systemChromeMaterial)
        appearance.backgroundColor = UIColor { traits in
            let neutral: UIColor = traits.userInterfaceStyle == .dark ? .black : .white
            return neutral.withAlphaComponent(0.84)
        }
        appearance.shadowColor = .clear
        appearance.largeTitleTextAttributes = navigationController?.navigationBar.largeTitleTextAttributes ?? [:]
        navigationController?.navigationBar.standardAppearance = appearance
        navigationController?.navigationBar.scrollEdgeAppearance = appearance
        navigationController?.navigationBar.compactAppearance = appearance
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            image: UIImage(systemName: "xmark"), style: .plain, target: self, action: #selector(close)
        )
        navigationItem.rightBarButtonItem?.accessibilityLabel = "Close New Activity"
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            image: UIImage(systemName: "ellipsis"), menu: UIMenu(children: [
                UIAction(title: "Custom Categories", image: UIImage(systemName: "gearshape.2")) { [weak self] _ in
                    self?.showCustomCategories()
                },
                UIAction(title: "Edit Pins", image: UIImage(systemName: "pin")) { [weak self] _ in
                    self?.showCategoryEditor()
                },
                UIAction(title: "New Category", image: UIImage(systemName: "plus")) { [weak self] _ in
                    self?.showNewCategoryPrompt()
                },
            ])
        )
        navigationItem.leftBarButtonItem?.accessibilityLabel = "More New Activity options"
    }

    private func configureSearch() {
        searchField.placeholder = "Search activities and places"
        searchField.accessibilityLabel = "Search activity categories"
        searchField.font = Typography.search
        searchField.adjustsFontForContentSizeCategory = true
        searchField.backgroundColor = .secondarySystemFill
        searchField.borderStyle = .none
        searchField.layer.cornerRadius = 11
        searchField.clipsToBounds = true
        searchField.clearButtonMode = .never
        searchField.tintColor = AlmidyDesignTokens.Color.tripOverviewAccent
        searchField.returnKeyType = .search
        searchField.autocorrectionType = .no
        searchField.addTarget(self, action: #selector(searchTextChanged), for: .editingChanged)
        searchField.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(searchField)
        filterPromptLabel.font = Typography.search
        filterPromptLabel.textColor = .placeholderText
        filterPromptLabel.numberOfLines = 1
        filterPromptLabel.lineBreakMode = .byTruncatingTail
        filterPromptLabel.isUserInteractionEnabled = false
        filterPromptLabel.isHidden = true
        filterPromptLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(filterPromptLabel)
        filterPromptLeadingConstraint = filterPromptLabel.leadingAnchor.constraint(
            equalTo: searchField.leadingAnchor,
            constant: 66
        )
        NSLayoutConstraint.activate([
            // Keep the field fully below the large-title navigation bar at
            // every detent so its icon, token, and placeholder are not clipped.
            searchField.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 4),
            searchField.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            searchField.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            searchField.heightAnchor.constraint(equalToConstant: 36),
            filterPromptLeadingConstraint,
            filterPromptLabel.centerYAnchor.constraint(equalTo: searchField.centerYAnchor),
            filterPromptLabel.trailingAnchor.constraint(lessThanOrEqualTo: searchField.trailingAnchor, constant: -44),
        ])
    }

    private func configureScope() {
        nearbyButton.setTitle("Nearby", for: .normal)
        everywhereButton.setTitle("Everywhere", for: .normal)
        [nearbyButton, everywhereButton].forEach {
            $0.titleLabel?.font = Typography.search
            $0.contentHorizontalAlignment = .leading
            $0.addTarget(self, action: #selector(scopeChanged(_:)), for: .touchUpInside)
        }
        scopeStack.axis = .horizontal
        scopeStack.spacing = 8
        scopeStack.alignment = .center
        scopeStack.translatesAutoresizingMaskIntoConstraints = false
        scopeStack.addArrangedSubview(nearbyButton)
        scopeStack.addArrangedSubview(everywhereButton)
        scopeStack.isHidden = true
        view.addSubview(scopeStack)
        scopeHeightConstraint = scopeStack.heightAnchor.constraint(equalToConstant: 0)
        NSLayoutConstraint.activate([
            scopeStack.topAnchor.constraint(equalTo: searchField.bottomAnchor, constant: 6),
            scopeStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            scopeHeightConstraint,
        ])
        refreshScopeAppearance()
    }

    private func configureFilteredManualAction() {
        let prompt = UILabel()
        prompt.text = "Unable to find what you want?"
        prompt.font = Typography.footerPrompt
        prompt.textColor = .secondaryLabel
        prompt.adjustsFontForContentSizeCategory = true

        let button = UIButton(type: .system)
        button.setTitle("Enter manually", for: .normal)
        button.titleLabel?.font = Typography.footerAction
        button.titleLabel?.adjustsFontForContentSizeCategory = true
        button.tintColor = AlmidyDesignTokens.Color.tripOverviewAccent
        button.addTarget(self, action: #selector(finishManually), for: .touchUpInside)

        filteredManualStack.axis = .horizontal
        filteredManualStack.alignment = .center
        filteredManualStack.distribution = .equalSpacing
        filteredManualStack.isHidden = true
        filteredManualStack.addArrangedSubview(prompt)
        filteredManualStack.addArrangedSubview(button)
        filteredManualStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(filteredManualStack)
        filteredManualTopConstraint = filteredManualStack.topAnchor.constraint(equalTo: scopeStack.bottomAnchor)
        filteredManualHeightConstraint = filteredManualStack.heightAnchor.constraint(equalToConstant: 0)
        NSLayoutConstraint.activate([
            filteredManualTopConstraint,
            filteredManualStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            filteredManualStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            filteredManualHeightConstraint,
        ])
    }

    private func configureTable() {
        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.dataSource = self
        tableView.delegate = self
        tableView.contentInsetAdjustmentBehavior = .never
        tableView.separatorInset = UIEdgeInsets(top: 0, left: 56, bottom: 0, right: 0)
        tableView.rowHeight = 56
        tableView.sectionHeaderHeight = UITableView.automaticDimension
        tableView.estimatedSectionHeaderHeight = 52
        tableView.backgroundColor = .clear
        tableView.register(NativeActivityCategoryCell.self, forCellReuseIdentifier: NativeActivityCategoryCell.reuseIdentifier)
        tableView.tableHeaderView = makeQuickHeader()
        tableView.tableFooterView = makeManualFooter()
        view.addSubview(tableView)
        headerResultsDivider.translatesAutoresizingMaskIntoConstraints = false
        headerResultsDivider.isUserInteractionEnabled = false
        headerResultsDivider.backgroundColor = .separator
        view.addSubview(headerResultsDivider)
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: filteredManualStack.bottomAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            headerResultsDivider.topAnchor.constraint(equalTo: tableView.topAnchor),
            headerResultsDivider.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            headerResultsDivider.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            headerResultsDivider.heightAnchor.constraint(equalToConstant: 1 / UIScreen.main.scale),
        ])
    }

    private func makeQuickHeader() -> UIView {
        let header = UIView(frame: CGRect(x: 0, y: 0, width: view.bounds.width, height: 102))
        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.alwaysBounceHorizontal = true
        scrollView.isDirectionalLockEnabled = true
        scrollView.decelerationRate = .fast

        let stack = UIStackView()
        stack.axis = .horizontal
        stack.distribution = .fill
        stack.alignment = .top
        stack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(stack)
        header.addSubview(scrollView)

        let itemWidth = max(1, (view.bounds.width - 16) / 5)
        quickCategories.forEach { category in
            let button = NativeActivityQuickButton(category: category)
            button.addAction(UIAction { [weak self] _ in self?.select(category) }, for: .touchUpInside)
            button.widthAnchor.constraint(equalToConstant: itemWidth).isActive = true
            stack.addArrangedSubview(button)
        }

        let editCategory = NativeActivityCategory(name: "Edit", symbols: ["pencil"], palette: .service)
        let editButton = NativeActivityQuickButton(category: editCategory)
        editButton.addAction(UIAction { [weak self] _ in self?.showCategoryEditor() }, for: .touchUpInside)
        editButton.widthAnchor.constraint(equalToConstant: itemWidth).isActive = true
        stack.addArrangedSubview(editButton)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: header.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 8),
            scrollView.trailingAnchor.constraint(equalTo: header.trailingAnchor, constant: -8),
            scrollView.bottomAnchor.constraint(equalTo: header.bottomAnchor),
            stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 4),
            stack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -4),
            stack.heightAnchor.constraint(equalTo: scrollView.frameLayoutGuide.heightAnchor, constant: -8),
        ])
        return header
    }

    private func makeManualFooter() -> UIView {
        let footer = UIView(frame: CGRect(x: 0, y: 0, width: view.bounds.width, height: 92))
        let prompt = UILabel()
        prompt.text = "Unable to find what you want?"
        prompt.font = Typography.footerPrompt
        prompt.adjustsFontForContentSizeCategory = true
        prompt.textColor = .secondaryLabel
        let button = UIButton(type: .system)
        button.setTitle("Enter manually", for: .normal)
        button.titleLabel?.font = Typography.footerAction
        button.titleLabel?.adjustsFontForContentSizeCategory = true
        button.tintColor = AlmidyDesignTokens.Color.tripOverviewAccent
        button.addTarget(self, action: #selector(finishManually), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [prompt, button])
        stack.axis = .horizontal
        stack.alignment = .center
        stack.distribution = .equalSpacing
        stack.translatesAutoresizingMaskIntoConstraints = false
        footer.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: footer.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: footer.trailingAnchor, constant: -20),
            stack.topAnchor.constraint(equalTo: footer.topAnchor, constant: 20),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: footer.bottomAnchor, constant: -20),
        ])
        return footer
    }

    func numberOfSections(in tableView: UITableView) -> Int {
        activeSearchCategory == nil ? visibleSections.count : 1
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        activeSearchCategory == nil ? visibleSections[section].items.count : placeResults.count
    }

    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        activeSearchCategory == nil ? visibleSections[section].title : nil
    }

    func tableView(_ tableView: UITableView, willDisplayHeaderView view: UIView, forSection section: Int) {
        guard let header = view as? UITableViewHeaderFooterView else { return }
        header.textLabel?.font = Typography.section
        header.textLabel?.adjustsFontForContentSizeCategory = true
        header.textLabel?.textColor = .secondaryLabel
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: NativeActivityCategoryCell.reuseIdentifier, for: indexPath)
        if activeSearchCategory == nil {
            (cell as? NativeActivityCategoryCell)?.render(visibleSections[indexPath.section].items[indexPath.row])
        } else if let category = activeSearchCategory {
            let mapItem = placeResults[indexPath.row]
            (cell as? NativeActivityCategoryCell)?.renderSearchResult(mapItem, category: category)
        }
        return cell
    }

    func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        activeSearchCategory == nil ? NativeActivityCategoryCell.categoryRowHeight : NativeActivityCategoryCell.searchResultRowHeight
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        if let category = activeSearchCategory {
            let mapItem = placeResults[indexPath.row]
            let resultID = NativeActivityPlaceIdentity.value(for: mapItem)
            selectedResultID = resultID
            let query = searchField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            onSelectFilteredResult(category, query, searchesNearby, resolvedSearchRegion, placeResults, resultID)
            collapseForGlobeResultsIfNeeded()
        } else {
            tableView.deselectRow(at: indexPath, animated: true)
            select(visibleSections[indexPath.section].items[indexPath.row])
        }
    }

    @objc private func searchTextChanged() {
        let query = searchField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        updateClearButtonVisibility(for: query)
        if let category = activeSearchCategory {
            guard !searchField.tokens.isEmpty else {
                clearSearchFilter(query: query)
                return
            }
            filterPromptLabel.isHidden = !query.isEmpty
            setFilteredManualVisible(query.isEmpty)
            refreshFilteredSearch(category: category, query: query)
            return
        }
        guard !query.isEmpty else {
            visibleSections = availableSections
            tableView.reloadData()
            return
        }
        visibleSections = availableSections.compactMap { section in
            let matches = section.items.filter { $0.name.localizedCaseInsensitiveContains(query) }
            return matches.isEmpty ? nil : .init(title: section.title, items: matches)
        }
        tableView.reloadData()
    }

    @objc private func scopeChanged(_ sender: UIButton) {
        if sender === everywhereButton {
            presentLocationInput()
            return
        }
        searchesNearby = true
        searchLocality = nil
        selectedSearchRegion = nil
        refreshScopeAppearance()
        guard let category = activeSearchCategory else { return }
        let query = searchField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        refreshFilteredSearch(category: category, query: query)
    }

    private func presentLocationInput() {
        let controller = NativeActivityLocationViewController { [weak self] locality, region in
            guard let self else { return }
            self.searchesNearby = false
            self.searchLocality = locality
            self.selectedSearchRegion = region
            self.refreshScopeAppearance()
            let query = self.searchField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            self.refreshFilteredSearch(category: self.activeSearchCategory, query: query)
        }
        let navigation = UINavigationController(rootViewController: controller)
        navigation.modalPresentationStyle = .pageSheet
        if let sheet = navigation.sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = false
            NativeActivitySheetMetrics.applySharedChrome(to: sheet)
        }
        present(navigation, animated: true)
    }

    private func refreshFilteredSearch(category: NativeActivityCategory?, query: String) {
        guard let category else { return }
        let scopedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        // Clear the old snapshot before launching the replacement search. Rows
        // and annotations now transition together instead of briefly describing
        // different queries or locations.
        replacePlaceResults([], category: category, query: scopedQuery)
        let purpose = NativeActivityPurposeRegistry.purpose(for: category)
        placeSearch?.cancel()
        searchGeneration += 1
        let generation = searchGeneration
        let searchTerms = discoveryQueries(for: purpose, userQuery: scopedQuery)
        runPlaceDiscovery(
            searchTerms,
            index: 0,
            accumulated: [],
            generation: generation,
            category: category,
            purpose: purpose,
            query: scopedQuery,
            region: resolvedSearchRegion
        )
    }

    private func discoveryQueries(for purpose: NativeActivityPurpose, userQuery: String) -> [String] {
        let terms = purpose.queryTerms.isEmpty ? [purpose.searchToken] : purpose.queryTerms
        var queries: [String] = []
        for term in terms.prefix(4) {
            let value: String
            if userQuery.isEmpty || userQuery.localizedCaseInsensitiveContains(term) {
                value = userQuery.isEmpty ? term : userQuery
            } else {
                value = "\(term) \(userQuery)"
            }
            if !queries.contains(where: { $0.localizedCaseInsensitiveCompare(value) == .orderedSame }) {
                queries.append(value)
            }
        }
        return queries.isEmpty ? [userQuery.isEmpty ? purpose.searchToken : userQuery] : queries
    }

    private func runPlaceDiscovery(
        _ queries: [String],
        index: Int,
        accumulated: [MKMapItem],
        generation: Int,
        category: NativeActivityCategory,
        purpose: NativeActivityPurpose,
        query: String,
        region: MKCoordinateRegion?
    ) {
        guard generation == searchGeneration else { return }
        guard index < queries.count else {
            let results = rankPlaceResults(accumulated, category: category, purpose: purpose, region: region)
            replacePlaceResults(results, category: category, query: query)
            collapseForGlobeResultsIfNeeded()
            return
        }

        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = queries[index]
        request.resultTypes = .pointOfInterest
        if let region { request.region = region }
        let search = MKLocalSearch(request: request)
        placeSearch = search
        search.start { [weak self, weak search] response, _ in
            DispatchQueue.main.async {
                guard let self,
                      generation == self.searchGeneration,
                      self.placeSearch === search else { return }
                let combined = accumulated + (response?.mapItems ?? [])
                let ranked = self.rankPlaceResults(combined, category: category, purpose: purpose, region: region)
                // Publish the first usable snapshot immediately so the list and
                // globe populate together; subsequent category terms enrich the
                // same ordered collection without making the user wait.
                if !ranked.isEmpty {
                    self.replacePlaceResults(ranked, category: category, query: query)
                    self.collapseForGlobeResultsIfNeeded()
                }
                if ranked.count >= 12 || index + 1 == queries.count {
                    self.placeSearch = nil
                    if ranked.isEmpty {
                        self.replacePlaceResults([], category: category, query: query)
                    }
                } else {
                    self.runPlaceDiscovery(
                        queries,
                        index: index + 1,
                        accumulated: combined,
                        generation: generation,
                        category: category,
                        purpose: purpose,
                        query: query,
                        region: region
                    )
                }
            }
        }
    }

    private func replacePlaceResults(_ results: [MKMapItem], category: NativeActivityCategory, query: String) {
        placeResults = results
        selectedResultID = nil
        setFilteredManualVisible(results.isEmpty)
        tableView.reloadData()
        onFilterChange(category, query, searchesNearby, resolvedSearchRegion, results)
    }

    func selectResult(withID resultID: String) {
        guard activeSearchCategory != nil,
              let row = placeResults.firstIndex(where: { NativeActivityPlaceIdentity.value(for: $0) == resultID }) else { return }
        selectedResultID = resultID
        tableView.selectRow(
            at: IndexPath(row: row, section: 0),
            animated: true,
            scrollPosition: .middle
        )
    }

    private func rankPlaceResults(
        _ items: [MKMapItem],
        category: NativeActivityCategory,
        purpose: NativeActivityPurpose,
        region: MKCoordinateRegion?
    ) -> [MKMapItem] {
        let origin = region.map {
            CLLocation(latitude: $0.center.latitude, longitude: $0.center.longitude)
        }
        let metroRadius: CLLocationDistance? = region.map {
            let north = CLLocation(
                latitude: $0.center.latitude + $0.span.latitudeDelta / 2,
                longitude: $0.center.longitude
            )
            let east = CLLocation(
                latitude: $0.center.latitude,
                longitude: $0.center.longitude + $0.span.longitudeDelta / 2
            )
            return max(origin?.distance(from: north) ?? 0, origin?.distance(from: east) ?? 0) * 1.35
        }
        let genericNames = Set(
            ([purpose.searchToken, purpose.canonicalName, category.name] + purpose.queryTerms)
                .map { normalizedPlaceName($0) }
        )

        let candidates = items.compactMap { item -> (MKMapItem, CLLocationDistance)? in
            let coordinate = item.placemark.coordinate
            guard CLLocationCoordinate2DIsValid(coordinate),
                  let rawName = item.name?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !rawName.isEmpty else { return nil }
            let distance = origin?.distance(from: CLLocation(
                latitude: coordinate.latitude,
                longitude: coordinate.longitude
            )) ?? 0
            if let metroRadius, distance > metroRadius { return nil }
            let normalizedName = normalizedPlaceName(rawName)
            let hasSpecificAddress = item.placemark.thoroughfare != nil
                || item.placemark.subThoroughfare != nil
            if genericNames.contains(normalizedName) && !hasSpecificAddress { return nil }
            return (item, distance)
        }.sorted {
            if abs($0.1 - $1.1) > 1 { return $0.1 < $1.1 }
            return ($0.0.name ?? "").localizedCaseInsensitiveCompare($1.0.name ?? "") == .orderedAscending
        }

        var accepted: [(MKMapItem, CLLocationDistance)] = []
        for candidate in candidates {
            let candidateName = normalizedPlaceName(candidate.0.name ?? "")
            let candidateLocation = CLLocation(
                latitude: candidate.0.placemark.coordinate.latitude,
                longitude: candidate.0.placemark.coordinate.longitude
            )
            let isDuplicate = accepted.contains { existing in
                guard normalizedPlaceName(existing.0.name ?? "") == candidateName else { return false }
                let existingLocation = CLLocation(
                    latitude: existing.0.placemark.coordinate.latitude,
                    longitude: existing.0.placemark.coordinate.longitude
                )
                return candidateLocation.distance(from: existingLocation) < 250
            }
            if !isDuplicate { accepted.append(candidate) }
            if accepted.count == 20 { break }
        }
        return accepted.map(\.0)
    }

    private func normalizedPlaceName(_ value: String) -> String {
        value.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            .lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    private func resolveImplicitRegionLocality(for region: MKCoordinateRegion) {
        regionGeocoder.reverseGeocodeLocation(CLLocation(
            latitude: region.center.latitude,
            longitude: region.center.longitude
        )) { [weak self] placemarks, _ in
            DispatchQueue.main.async {
                guard let self,
                      self.searchLocality == nil,
                      self.implicitRegionLocality == nil,
                      let placemark = placemarks?.first else { return }
                let localityParts = [placemark.locality, placemark.administrativeArea]
                    .compactMap { $0 }
                    .filter { !$0.isEmpty }
                guard !localityParts.isEmpty else { return }
                self.implicitRegionLocality = localityParts.joined(separator: ", ")
                if let category = self.activeSearchCategory {
                    let query = self.searchField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                    self.refreshFilteredSearch(category: category, query: query)
                }
            }
        }
    }

    private func refreshScopeAppearance() {
        nearbyButton.setTitleColor(
            searchesNearby ? AlmidyDesignTokens.Color.tripOverviewAccent : .secondaryLabel,
            for: .normal
        )
        everywhereButton.setTitleColor(
            searchesNearby ? .secondaryLabel : AlmidyDesignTokens.Color.tripOverviewAccent,
            for: .normal
        )
        nearbyButton.accessibilityTraits = searchesNearby ? [.button, .selected] : .button
        everywhereButton.accessibilityTraits = searchesNearby ? .button : [.button, .selected]
        everywhereButton.accessibilityLabel = searchLocality.map { "Everywhere, location \($0)" } ?? "Everywhere"
    }

    private func clearSearchFilter(query: String = "") {
        activeSearchCategory = nil
        placeSearch?.cancel()
        placeSearch = nil
        searchGeneration += 1
        placeResults = []
        selectedResultID = nil
        searchLocality = nil
        hasCollapsedForSearchResults = false
        searchField.placeholder = "Search activities and places"
        searchField.accessibilityLabel = "Search activity categories"
        searchField.tokenBackgroundColor = .secondarySystemFill
        updateClearButtonVisibility(for: query)
        filterPromptLabel.text = nil
        filterPromptLabel.isHidden = true
        scopeStack.isHidden = true
        scopeHeightConstraint.constant = 0
        filteredManualStack.isHidden = true
        filteredManualTopConstraint.constant = 0
        filteredManualHeightConstraint.constant = 0
        onFilterClear()
        tableView.tableHeaderView = makeQuickHeader()
        tableView.tableFooterView = makeManualFooter()
        visibleSections = availableSections
        if !query.isEmpty {
            visibleSections = availableSections.compactMap { section in
                let matches = section.items.filter { $0.name.localizedCaseInsensitiveContains(query) }
                return matches.isEmpty ? nil : .init(title: section.title, items: matches)
            }
        }
        tableView.reloadData()
    }

    private func showCustomCategories() {
        let controller = NativeCustomCategoriesViewController(
            categories: customCategories,
            onSave: { [weak self] record in
                guard let self else { return [] }
                self.saveCustomCategory(record)
                return self.customCategories
            },
            onSelect: { [weak self] record in
                self?.select(record.category)
            }
        )
        let navigation = UINavigationController(rootViewController: controller)
        navigation.modalPresentationStyle = .pageSheet
        if let sheet = navigation.sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = true
            NativeActivitySheetMetrics.applySharedChrome(to: sheet)
        }
        present(navigation, animated: true)
    }

    private func showCategoryEditor() {
        let controller = NativeActivityCategoriesEditorViewController(
            selectedNames: quickCategories.map(\.name)
        ) { [weak self] names in
            guard let self else { return }
            UserDefaults.standard.set(names, forKey: Self.quickCategoryDefaultsKey)
            self.tableView.tableHeaderView = self.makeQuickHeader()
        }
        let navigation = UINavigationController(rootViewController: controller)
        navigation.modalPresentationStyle = .pageSheet
        if let sheet = navigation.sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = true
            NativeActivitySheetMetrics.applySharedChrome(to: sheet)
        }
        present(navigation, animated: true)
    }

    private func showNewCategoryPrompt() {
        let controller = NativeCustomCategoryViewController { [weak self] record in
            self?.saveCustomCategory(record)
        }
        let navigation = UINavigationController(rootViewController: controller)
        navigation.modalPresentationStyle = .pageSheet
        if let sheet = navigation.sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = true
            NativeActivitySheetMetrics.applySharedChrome(to: sheet)
        }
        present(navigation, animated: true)
    }

    private func saveCustomCategory(_ record: NativeCustomActivityCategoryRecord) {
        var categories = customCategories.filter {
            $0.name.localizedCaseInsensitiveCompare(record.name) != .orderedSame
        }
        categories.append(record)
        customCategories = categories.sorted {
            $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
        searchTextChanged()
    }

    @objc private func close() {
        onFilterClear()
        dismiss(animated: true, completion: onDismiss)
    }

    private func select(_ category: NativeActivityCategory) {
        let purpose = NativeActivityPurposeRegistry.purpose(for: category)
        guard !purpose.opensDedicatedActivityForm else {
            finish(category)
            return
        }
        activateSearchFilter(category, purpose: purpose)
    }

    private func activateSearchFilter(_ category: NativeActivityCategory, purpose: NativeActivityPurpose) {
        activeSearchCategory = category
        hasCollapsedForSearchResults = false
        placeResults = []
        selectedResultID = nil
        searchField.text = nil
        searchField.tokens = [makeSearchToken(category, purpose: purpose)]
        searchField.text = " "
        updateClearButtonVisibility(for: "")
        searchField.tokenBackgroundColor = category.palette.tint
        // UISearchTextField does not consistently render its native placeholder
        // after a token, so draw the prompt explicitly beside the token.
        searchField.placeholder = nil
        filterPromptLabel.text = purpose.searchPlaceholder
        let tokenTextWidth = ceil(
            (purpose.searchToken as NSString).size(withAttributes: [.font: Typography.search]).width
        )
        filterPromptLeadingConstraint.constant = 58 + tokenTextWidth
        filterPromptLabel.isHidden = false
        view.bringSubviewToFront(filterPromptLabel)
        searchField.accessibilityLabel = "\(purpose.canonicalName) filter. \(purpose.searchPlaceholder)"
        searchesNearby = false
        searchLocality = nil
        selectedSearchRegion = nil
        refreshScopeAppearance()
        scopeStack.isHidden = false
        scopeHeightConstraint.constant = 28
        setFilteredManualVisible(true)
        tableView.tableHeaderView = nil
        tableView.tableFooterView = nil
        tableView.reloadData()
        refreshFilteredSearch(category: category, query: "")
        searchField.becomeFirstResponder()
        UIAccessibility.post(
            notification: .announcement,
            argument: "\(purpose.canonicalName) filter selected. \(purpose.searchPlaceholder)"
        )
    }

    private func makeSearchToken(
        _ category: NativeActivityCategory,
        purpose: NativeActivityPurpose
    ) -> UISearchToken {
        let token = UISearchToken(icon: nil, text: purpose.searchToken)
        token.representedObject = category.name
        return token
    }

    private func setFilteredManualVisible(_ isVisible: Bool) {
        filteredManualStack.isHidden = !isVisible
        filteredManualTopConstraint.constant = isVisible ? 8 : 0
        filteredManualHeightConstraint.constant = isVisible ? 40 : 0
    }

    private func updateClearButtonVisibility(for query: String) {
        let hasVisibleQuery = !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        searchField.clearButtonMode = (hasVisibleQuery || activeSearchCategory != nil) ? .always : .never
    }

    private func collapseForGlobeResultsIfNeeded() {
        guard !placeResults.isEmpty,
              !hasCollapsedForSearchResults,
              let sheet = navigationController?.sheetPresentationController else { return }
        hasCollapsedForSearchResults = true
        sheet.animateChanges {
            if #available(iOS 16.0, *) {
                sheet.selectedDetentIdentifier = NativeActivitySheetMetrics.previewIdentifier
            } else {
                sheet.selectedDetentIdentifier = .medium
            }
        }
    }

    private func finish(_ category: NativeActivityCategory) {
        dismiss(animated: true) { [onSelect] in onSelect(category) }
    }

    @objc private func finishManually() {
        dismiss(animated: true, completion: onEnterManually)
    }
}

private final class NativeActivityLocationViewController: UIViewController,
    CLLocationManagerDelegate, MKLocalSearchCompleterDelegate, UITableViewDataSource, UITableViewDelegate {
    private let onSelect: (String, MKCoordinateRegion) -> Void
    private let locationManager = CLLocationManager()
    private let completer = MKLocalSearchCompleter()
    private let searchField = UISearchTextField()
    private let tableView = UITableView(frame: .zero, style: .plain)
    private var completions: [MKLocalSearchCompletion] = []
    private var currentLocality: String?
    private var currentCoordinate: CLLocationCoordinate2D?

    init(onSelect: @escaping (String, MKCoordinateRegion) -> Void) {
        self.onSelect = onSelect
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Location"
        view.backgroundColor = .systemBackground
        navigationItem.largeTitleDisplayMode = .never
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            title: "Cancel", style: .plain, target: self, action: #selector(cancel)
        )

        searchField.placeholder = "Search by a locality"
        searchField.accessibilityLabel = "Search by a locality"
        searchField.font = UIFont.systemFont(ofSize: 17)
        searchField.backgroundColor = .secondarySystemFill
        searchField.layer.cornerRadius = 11
        searchField.clipsToBounds = true
        searchField.returnKeyType = .search
        searchField.addTarget(self, action: #selector(queryChanged), for: .editingChanged)

        tableView.dataSource = self
        tableView.delegate = self
        tableView.rowHeight = 68
        tableView.separatorInset = UIEdgeInsets(top: 0, left: 74, bottom: 0, right: 16)
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "ActivityLocationCell")

        [searchField, tableView].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview($0)
        }
        NSLayoutConstraint.activate([
            searchField.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 18),
            searchField.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            searchField.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            searchField.heightAnchor.constraint(equalToConstant: 44),
            tableView.topAnchor.constraint(equalTo: searchField.bottomAnchor, constant: 14),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        completer.delegate = self
        completer.resultTypes = [.address, .pointOfInterest, .query]
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        requestCurrentLocationIfNeeded()
        searchField.becomeFirstResponder()
    }

    private func requestCurrentLocationIfNeeded() {
        switch locationManager.authorizationStatus {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            locationManager.requestLocation()
        default:
            break
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse {
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        currentCoordinate = location.coordinate
        CLGeocoder().reverseGeocodeLocation(location) { [weak self] placemarks, _ in
            DispatchQueue.main.async {
                guard let self, let placemark = placemarks?.first else { return }
                self.currentLocality = [placemark.locality, placemark.administrativeArea, placemark.country]
                    .compactMap { $0 }
                    .joined(separator: ", ")
                self.tableView.reloadData()
            }
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        tableView.reloadData()
    }

    @objc private func queryChanged() {
        let query = searchField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        completions = []
        tableView.reloadData()
        completer.queryFragment = query.count >= 2 ? query : ""
    }

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        completions = Array(completer.results.prefix(8))
        tableView.reloadData()
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        completions = []
        tableView.reloadData()
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        completions.count + (currentLocality == nil ? 0 : 1)
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "ActivityLocationCell", for: indexPath)
        var content = cell.defaultContentConfiguration()
        if indexPath.row == 0, let currentLocality {
            content.text = currentLocality
            content.secondaryText = "Current location"
            content.image = UIImage(systemName: "location.fill")
            content.imageProperties.tintColor = AlmidyDesignTokens.Color.info
        } else {
            let offset = currentLocality == nil ? 0 : 1
            let completion = completions[indexPath.row - offset]
            content.text = completion.title
            content.secondaryText = completion.subtitle
            content.image = UIImage(systemName: "mappin")
            content.imageProperties.tintColor = AlmidyDesignTokens.Color.tripOverviewAccent
        }
        content.textProperties.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
        content.secondaryTextProperties.font = UIFont.systemFont(ofSize: 14)
        content.secondaryTextProperties.color = .secondaryLabel
        cell.contentConfiguration = content
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        if indexPath.row == 0, let currentLocality, let currentCoordinate {
            finish(
                locality: currentLocality,
                coordinate: currentCoordinate
            )
        } else {
            let offset = currentLocality == nil ? 0 : 1
            let completion = completions[indexPath.row - offset]
            let locality = [completion.title, completion.subtitle].filter { !$0.isEmpty }.joined(separator: ", ")
            let request = MKLocalSearch.Request(completion: completion)
            MKLocalSearch(request: request).start { [weak self] response, _ in
                guard let self,
                      let coordinate = response?.mapItems.first?.placemark.coordinate else { return }
                DispatchQueue.main.async {
                    self.finish(locality: locality, coordinate: coordinate)
                }
            }
        }
    }

    private func finish(locality: String, coordinate: CLLocationCoordinate2D) {
        let region = MKCoordinateRegion(
            center: coordinate,
            latitudinalMeters: 30_000,
            longitudinalMeters: 30_000
        )
        dismiss(animated: true) { [onSelect] in onSelect(locality, region) }
    }

    @objc private func cancel() { dismiss(animated: true) }
}

private final class NativeActivityCategoriesEditorViewController: UITableViewController {
    private enum Section {
        case selected
        case available(NativeActivityCategorySection)
    }

    private let onSave: ([String]) -> Void
    private var selected: [NativeActivityCategory]
    private var sections: [Section] = []

    init(selectedNames: [String], onSave: @escaping ([String]) -> Void) {
        self.selected = selectedNames.compactMap(NativeActivityCatalog.category(named:))
        self.onSave = onSave
        super.init(style: .insetGrouped)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Edit Pins"
        configureAppearance()
        rebuildSections()
    }

    private func configureAppearance() {
        let surface = AlmidyDesignTokens.Color.tripOverviewNeutralSurface
        view.backgroundColor = surface
        tableView.backgroundColor = surface
        tableView.rowHeight = 56
        tableView.separatorInset = UIEdgeInsets(top: 0, left: 92, bottom: 0, right: 20)
        tableView.sectionHeaderTopPadding = 24
        tableView.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 0, leading: 18, bottom: 0, trailing: 18)
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "ActivityPinCell")
        tableView.isEditing = true
        tableView.allowsSelectionDuringEditing = true

        navigationItem.largeTitleDisplayMode = .never
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            title: "Cancel", style: .plain, target: self, action: #selector(cancel)
        )
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            title: "Save", style: .done, target: self, action: #selector(save)
        )
        navigationItem.rightBarButtonItem?.tintColor = AlmidyDesignTokens.Color.tripOverviewAccent

        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = surface
        appearance.shadowColor = .clear
        appearance.titleTextAttributes = [
            .font: UIFont.systemFont(ofSize: 18, weight: .semibold),
            .foregroundColor: UIColor.label,
        ]
        navigationController?.navigationBar.standardAppearance = appearance
        navigationController?.navigationBar.scrollEdgeAppearance = appearance
        navigationController?.navigationBar.tintColor = .label
    }

    private func rebuildSections() {
        let selectedNames = Set(selected.map(selectionIdentity(for:)))
        sections = [.selected] + NativeActivityCatalog.sections.compactMap { section in
            let available = section.items.filter { !selectedNames.contains(selectionIdentity(for: $0)) }
            return available.isEmpty ? nil : .available(.init(title: section.title, items: available))
        }
        tableView.reloadData()
    }

    private func selectionIdentity(for category: NativeActivityCategory) -> String {
        NativeActivityPurposeRegistry.purpose(named: category.name)?.canonicalName ?? category.name
    }

    override func numberOfSections(in tableView: UITableView) -> Int { sections.count }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        switch sections[section] {
        case .selected: return selected.count
        case let .available(group): return group.items.count
        }
    }

    override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        if case let .available(group) = sections[section] { return group.title }
        return nil
    }

    override func tableView(_ tableView: UITableView, willDisplayHeaderView view: UIView, forSection section: Int) {
        guard let header = view as? UITableViewHeaderFooterView else { return }
        header.textLabel?.font = UIFont.systemFont(ofSize: 18, weight: .semibold)
        header.textLabel?.textColor = .secondaryLabel
        header.textLabel?.text = header.textLabel?.text?.localizedCapitalized
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "ActivityPinCell", for: indexPath)
        let category: NativeActivityCategory
        let selectedRow: Bool
        switch sections[indexPath.section] {
        case .selected:
            category = selected[indexPath.row]
            selectedRow = true
        case let .available(group):
            category = group.items[indexPath.row]
            selectedRow = false
        }

        var content = cell.defaultContentConfiguration()
        content.text = category.name
        content.textProperties.font = UIFont.systemFont(ofSize: 18)
        content.image = category.image.withConfiguration(
            UIImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
        )
        content.imageProperties.tintColor = category.palette.tint
        content.imageProperties.maximumSize = CGSize(width: 30, height: 30)
        content.imageToTextPadding = 18
        cell.contentConfiguration = content
        cell.backgroundColor = .systemBackground
        cell.selectionStyle = .none
        cell.accessibilityLabel = "\(selectedRow ? "Remove" : "Add") \(category.name) pin"
        cell.accessibilityHint = selectedRow ? "Removes this pin from the quick list" : "Adds this pin to the quick list"
        return cell
    }

    override func tableView(
        _ tableView: UITableView,
        editingStyleForRowAt indexPath: IndexPath
    ) -> UITableViewCell.EditingStyle {
        if case .selected = sections[indexPath.section] { return .delete }
        return .insert
    }

    override func tableView(_ tableView: UITableView, canMoveRowAt indexPath: IndexPath) -> Bool {
        if case .selected = sections[indexPath.section] { return true }
        return false
    }

    override func tableView(
        _ tableView: UITableView,
        targetIndexPathForMoveFromRowAt sourceIndexPath: IndexPath,
        toProposedIndexPath proposedDestinationIndexPath: IndexPath
    ) -> IndexPath {
        guard proposedDestinationIndexPath.section == 0 else {
            return IndexPath(row: max(0, selected.count - 1), section: 0)
        }
        return proposedDestinationIndexPath
    }

    override func tableView(
        _ tableView: UITableView,
        moveRowAt sourceIndexPath: IndexPath,
        to destinationIndexPath: IndexPath
    ) {
        let category = selected.remove(at: sourceIndexPath.row)
        selected.insert(category, at: destinationIndexPath.row)
    }

    override func tableView(
        _ tableView: UITableView,
        commit editingStyle: UITableViewCell.EditingStyle,
        forRowAt indexPath: IndexPath
    ) {
        switch (editingStyle, sections[indexPath.section]) {
        case (.delete, .selected):
            selected.remove(at: indexPath.row)
        case let (.insert, .available(group)):
            selected.append(group.items[indexPath.row])
        default:
            return
        }
        rebuildSections()
    }

    @objc private func cancel() { dismiss(animated: true) }

    @objc private func save() {
        let names = selected.map(\.name)
        dismiss(animated: true) { [onSave] in onSave(names) }
    }
}

private final class NativeCustomCategoriesViewController: UITableViewController {
    private let onSave: (NativeCustomActivityCategoryRecord) -> [NativeCustomActivityCategoryRecord]
    private let onSelect: (NativeCustomActivityCategoryRecord) -> Void
    private var categories: [NativeCustomActivityCategoryRecord]

    init(
        categories: [NativeCustomActivityCategoryRecord],
        onSave: @escaping (NativeCustomActivityCategoryRecord) -> [NativeCustomActivityCategoryRecord],
        onSelect: @escaping (NativeCustomActivityCategoryRecord) -> Void
    ) {
        self.categories = categories
        self.onSave = onSave
        self.onSelect = onSelect
        super.init(style: .insetGrouped)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Custom Categories"
        let surfaceColor = AlmidyDesignTokens.Color.tripOverviewNeutralSurface
        view.backgroundColor = surfaceColor
        tableView.backgroundColor = surfaceColor
        tableView.rowHeight = 58
        tableView.separatorStyle = .none
        tableView.sectionHeaderHeight = .leastNormalMagnitude
        tableView.sectionFooterHeight = 14
        tableView.sectionHeaderTopPadding = 0
        tableView.contentInset.top = 8
        tableView.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20)
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "CustomCategoryCell")

        navigationItem.largeTitleDisplayMode = .never
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            title: "Cancel",
            style: .plain,
            target: self,
            action: #selector(cancel)
        )
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = surfaceColor
        appearance.shadowColor = .clear
        appearance.titleTextAttributes = [
            .font: UIFont.systemFont(ofSize: 18, weight: .semibold),
            .foregroundColor: UIColor.label,
        ]
        navigationController?.navigationBar.standardAppearance = appearance
        navigationController?.navigationBar.scrollEdgeAppearance = appearance
        navigationController?.navigationBar.compactAppearance = appearance
        navigationController?.navigationBar.tintColor = .label
    }

    override func numberOfSections(in tableView: UITableView) -> Int {
        categories.isEmpty ? 1 : 2
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        section == 0 ? 1 : categories.count
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "CustomCategoryCell", for: indexPath)
        var content = cell.defaultContentConfiguration()
        content.textProperties.font = UIFont.systemFont(ofSize: 18, weight: .regular)
        content.imageToTextPadding = 18

        if indexPath.section == 0 {
            content.text = "New Category"
            content.image = UIImage(systemName: "plus")?.withConfiguration(
                UIImage.SymbolConfiguration(pointSize: 21, weight: .regular)
            )
            content.imageProperties.tintColor = AlmidyDesignTokens.Color.tripOverviewNeutralIcon
            content.imageProperties.maximumSize = CGSize(width: 28, height: 28)
            cell.accessibilityHint = "Creates a custom activity category"
        } else {
            let record = categories[indexPath.row]
            content.text = record.name
            content.image = UIImage(systemName: record.symbol)?.withConfiguration(
                UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold)
            )
            content.imageProperties.tintColor = UIColor(almidyHex: record.colorHex)
            content.imageProperties.maximumSize = CGSize(width: 28, height: 28)
            cell.accessibilityHint = "Adds an activity using this category"
        }

        cell.contentConfiguration = content
        cell.backgroundColor = .clear
        cell.contentView.backgroundColor = .clear
        var background = UIBackgroundConfiguration.clear()
        background.backgroundColor = UIColor.white
        background.cornerRadius = 24
        background.backgroundInsets = NSDirectionalEdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0)
        cell.backgroundConfiguration = background
        cell.selectionStyle = .default
        cell.accessoryType = indexPath.section == 0 ? .none : .disclosureIndicator
        cell.accessibilityLabel = content.text
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        if indexPath.section == 0 {
            showNewCategory()
        } else {
            let record = categories[indexPath.row]
            dismiss(animated: true) { [onSelect] in onSelect(record) }
        }
    }

    private func showNewCategory() {
        let controller = NativeCustomCategoryViewController { [weak self] record in
            guard let self else { return }
            self.categories = self.onSave(record)
            self.tableView.reloadData()
        }
        let navigation = UINavigationController(rootViewController: controller)
        navigation.modalPresentationStyle = .pageSheet
        if let sheet = navigation.sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = true
            NativeActivitySheetMetrics.applySharedChrome(to: sheet)
        }
        present(navigation, animated: true)
    }

    @objc private func cancel() { dismiss(animated: true) }
}

private final class NativeCustomCategoryViewController: UIViewController, UITextFieldDelegate {
    private static let colors = [
        "D9A441", "C88A36", "A873B8", "7967A8", "5F8FA8", "6380A6",
        "A85F67", "B46A83", "B8665E", "6F9578", "A58A68", "77736F",
    ]

    private static let symbolCandidates = [
        "bookmark.fill", "building.2.fill", "camera.fill", "laptopcomputer", "house.fill", "list.bullet",
        "telescope", "binoculars.fill", "signpost.right.fill", "star.fill", "heart.fill", "flag.fill",
        "leaf.fill", "moon.fill", "mountain.2.fill", "sun.max.fill", "balloon.2.fill", "birthday.cake.fill",
        "party.popper.fill", "gift.fill", "figure.dance", "paintbrush.fill", "paintpalette.fill", "scribble.variable",
        "shoe.fill", "figure.walk", "sunglasses.fill", "sofa.fill", "football.fill", "figure.archery",
        "baseball.fill", "basketball.fill", "tennisball.fill", "volleyball.fill", "figure.run", "figure.hockey",
        "figure.roll", "figure.run", "bicycle", "bandage.fill", "pills.fill", "cross.case.fill",
        "soccerball", "figure.tennis", "figure.pool.swim", "figure.skiing.downhill", "sailboat.fill", "figure.sailing",
        "ferriswheel", "ticket.fill", "banknote.fill", "croissant.fill", "building.columns.fill", "martini.glass.fill",
        "takeoutbag.and.cup.and.straw.fill", "beach.umbrella.fill", "bicycle", "mug.fill", "bus.fill", "cup.and.saucer.fill",
        "tent.2.fill", "car.fill", "film.stack.fill", "music.note", "cruise.ship.fill", "motorcycle.fill",
        "ev.charger.fill", "star.square.fill", "ferry.fill", "fire.extinguisher.fill", "dumbbell.fill", "airplane",
        "storefront.fill", "fuelpump.fill", "cross.case.fill", "teddybear.fill", "washer.fill", "book.fill",
        "mappin", "bed.double.fill", "anchor", "message.fill", "rectangle.inset.filled.and.person.filled", "motorcycle.fill",
        "building.columns.fill", "shield.fill", "disco.ball.fill", "bench.fill", "parkingsign", "pawprint.fill",
        "pills.fill", "police.badge.fill", "stamp.fill", "figure.wave", "figure.golf", "camera.macro",
        "fork.knife", "cable.connector", "backpack.fill", "pencil.and.ruler.fill", "bag.fill", "sportscourt.fill",
        "theatermasks.fill", "map.fill", "train.side.front.car", "graduationcap.fill", "figure.walk", "wineglass.fill",
        "checkmark.seal.fill", "figure.hiking", "book.closed.fill", "person.2.fill", "checkerboard.rectangle", "trophy.fill",
    ]

    // The symbol catalog varies by iOS release. Only display symbols that can
    // actually be rendered on the running OS so the picker never contains an
    // empty circle.
    private static let symbols = symbolCandidates.filter { UIImage(systemName: $0) != nil }

    private let onSave: (NativeCustomActivityCategoryRecord) -> Void
    private let nameField = UITextField()
    private var selectedColor = colors[0]
    private var selectedSymbol = symbols[0]
    private var colorButtons: [UIButton] = []
    private var iconButtons: [UIButton] = []

    init(onSave: @escaping (NativeCustomActivityCategoryRecord) -> Void) {
        self.onSave = onSave
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = AlmidyDesignTokens.Color.tripOverviewNeutralSurface
        configureNavigation()
        configureContent()
    }

    private func configureNavigation() {
        title = "Custom Category"
        navigationItem.leftBarButtonItem = UIBarButtonItem(title: "Cancel", style: .plain, target: self, action: #selector(cancel))
        navigationItem.rightBarButtonItem = UIBarButtonItem(title: "Save", style: .done, target: self, action: #selector(save))
        navigationItem.rightBarButtonItem?.isEnabled = false
        navigationController?.navigationBar.titleTextAttributes = [
            .font: UIFont.systemFont(ofSize: 18, weight: .semibold),
            .foregroundColor: UIColor.label,
        ]
        navigationController?.navigationBar.tintColor = AlmidyDesignTokens.Color.tripOverviewAccent
    }

    private func configureContent() {
        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.keyboardDismissMode = .interactive
        view.addSubview(scrollView)

        let content = UIStackView()
        content.axis = .vertical
        content.spacing = 18
        content.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(content)

        nameField.placeholder = "Name"
        nameField.backgroundColor = .systemBackground
        nameField.layer.cornerRadius = 24
        nameField.font = UIFont.systemFont(ofSize: 17)
        nameField.autocapitalizationType = .words
        nameField.returnKeyType = .done
        nameField.delegate = self
        nameField.addTarget(self, action: #selector(nameChanged), for: .editingChanged)
        let nameContainer = UIView()
        nameContainer.addSubview(nameField)
        nameField.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            nameField.leadingAnchor.constraint(equalTo: nameContainer.leadingAnchor),
            nameField.trailingAnchor.constraint(equalTo: nameContainer.trailingAnchor),
            nameField.topAnchor.constraint(equalTo: nameContainer.topAnchor),
            nameField.bottomAnchor.constraint(equalTo: nameContainer.bottomAnchor),
            nameField.heightAnchor.constraint(equalToConstant: 58),
        ])
        nameField.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 20, height: 1))
        nameField.leftViewMode = .always
        content.addArrangedSubview(nameContainer)

        content.addArrangedSubview(sectionLabel("Choose a color"))
        content.addArrangedSubview(makeGrid(items: Self.colors, columns: 6, buttonSize: 40, isColorGrid: true))
        content.addArrangedSubview(sectionLabel("Choose an icon"))
        content.addArrangedSubview(makeGrid(items: Self.symbols, columns: 6, buttonSize: 40, isColorGrid: false))

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            content.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 30),
            content.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 20),
            content.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -20),
            content.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -30),
        ])
        refreshSelections()
    }

    private func sectionLabel(_ text: String) -> UILabel {
        let label = UILabel()
        label.text = text
        label.font = UIFont.systemFont(ofSize: 19, weight: .semibold)
        label.textColor = .secondaryLabel
        return label
    }

    private func makeGrid(items: [String], columns: Int, buttonSize: CGFloat, isColorGrid: Bool) -> UIView {
        let card = UIStackView()
        card.axis = .vertical
        card.spacing = 16
        card.backgroundColor = .systemBackground
        card.layer.cornerRadius = 24
        card.isLayoutMarginsRelativeArrangement = true
        card.layoutMargins = UIEdgeInsets(top: 18, left: 16, bottom: 18, right: 16)

        for start in stride(from: 0, to: items.count, by: columns) {
            let row = UIStackView()
            row.axis = .horizontal
            row.distribution = .equalSpacing
            let end = min(start + columns, items.count)
            for index in start..<end {
                let value = items[index]
                let button = UIButton(type: .system)
                button.tag = index
                button.translatesAutoresizingMaskIntoConstraints = false
                button.layer.cornerRadius = buttonSize / 2
                button.layer.borderWidth = 0
                button.widthAnchor.constraint(equalToConstant: buttonSize).isActive = true
                button.heightAnchor.constraint(equalToConstant: buttonSize).isActive = true
                if isColorGrid {
                    button.backgroundColor = UIColor(almidyHex: value)
                    button.accessibilityLabel = "Color \(index + 1)"
                    button.addAction(UIAction { [weak self] _ in
                        self?.selectedColor = value
                        self?.refreshSelections()
                    }, for: .touchUpInside)
                    colorButtons.append(button)
                } else {
                    button.backgroundColor = AlmidyDesignTokens.Color.tripOverviewNeutralSurface
                    button.setImage(
                        UIImage(systemName: value)?.withConfiguration(
                            UIImage.SymbolConfiguration(pointSize: 15, weight: .semibold)
                        ),
                        for: .normal
                    )
                    button.tintColor = AlmidyDesignTokens.Color.tripOverviewNeutralIcon
                    button.imageView?.contentMode = .scaleAspectFit
                    button.accessibilityLabel = value
                    button.addAction(UIAction { [weak self] _ in
                        self?.selectedSymbol = value
                        self?.refreshSelections()
                    }, for: .touchUpInside)
                    iconButtons.append(button)
                }
                row.addArrangedSubview(button)
            }
            while row.arrangedSubviews.count < columns {
                let spacer = UIView()
                spacer.widthAnchor.constraint(equalToConstant: buttonSize).isActive = true
                row.addArrangedSubview(spacer)
            }
            card.addArrangedSubview(row)
        }
        return card
    }

    private func refreshSelections() {
        for (index, button) in colorButtons.enumerated() {
            let selected = Self.colors[index] == selectedColor
            button.layer.borderWidth = selected ? 3 : 0
            button.layer.borderColor = selected
                ? AlmidyDesignTokens.Color.tripOverviewNeutralIcon.cgColor
                : UIColor.clear.cgColor
        }
        for (index, button) in iconButtons.enumerated() {
            let selected = Self.symbols[index] == selectedSymbol
            button.layer.borderWidth = selected ? 3 : 0
            button.layer.borderColor = selected ? AlmidyDesignTokens.Color.tripOverviewNeutralIcon.cgColor : UIColor.clear.cgColor
            button.tintColor = selected ? UIColor(almidyHex: selectedColor) : AlmidyDesignTokens.Color.tripOverviewNeutralIcon
        }
    }

    @objc private func nameChanged() {
        navigationItem.rightBarButtonItem?.isEnabled = !(nameField.text ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    @objc private func cancel() { dismiss(animated: true) }

    @objc private func save() {
        let name = (nameField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        onSave(.init(name: name, symbol: selectedSymbol, colorHex: selectedColor))
        dismiss(animated: true)
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        return true
    }
}

private final class NativeActivityCategoryCell: UITableViewCell {
    static let reuseIdentifier = "NativeActivityCategoryCell"
    static let categoryRowHeight: CGFloat = 56
    static let searchResultRowHeight: CGFloat = 76

    private let iconContainer = UIView()
    private let iconView = UIImageView()
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let labelsStack = UIStackView()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)

        iconContainer.translatesAutoresizingMaskIntoConstraints = false
        iconContainer.isUserInteractionEnabled = false
        iconContainer.layer.cornerRadius = 24

        iconView.translatesAutoresizingMaskIntoConstraints = false
        iconView.contentMode = .scaleAspectFit
        iconView.isUserInteractionEnabled = false
        iconContainer.addSubview(iconView)

        titleLabel.font = NativeNewActivityViewController.Typography.row
        titleLabel.textColor = .label
        titleLabel.numberOfLines = 1
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.adjustsFontForContentSizeCategory = true

        subtitleLabel.font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(
            for: .systemFont(ofSize: 15), maximumPointSize: 16
        )
        subtitleLabel.textColor = .secondaryLabel
        subtitleLabel.numberOfLines = 1
        subtitleLabel.lineBreakMode = .byTruncatingTail
        subtitleLabel.adjustsFontForContentSizeCategory = true

        labelsStack.translatesAutoresizingMaskIntoConstraints = false
        labelsStack.axis = .vertical
        labelsStack.alignment = .fill
        labelsStack.distribution = .fill
        labelsStack.spacing = 2
        labelsStack.addArrangedSubview(titleLabel)
        labelsStack.addArrangedSubview(subtitleLabel)

        contentView.addSubview(iconContainer)
        contentView.addSubview(labelsStack)
        NSLayoutConstraint.activate([
            iconContainer.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            iconContainer.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            iconContainer.widthAnchor.constraint(equalToConstant: 48),
            iconContainer.heightAnchor.constraint(equalToConstant: 48),
            iconView.centerXAnchor.constraint(equalTo: iconContainer.centerXAnchor),
            iconView.centerYAnchor.constraint(equalTo: iconContainer.centerYAnchor),
            iconView.widthAnchor.constraint(equalToConstant: 22),
            iconView.heightAnchor.constraint(equalToConstant: 22),
            labelsStack.leadingAnchor.constraint(equalTo: iconContainer.trailingAnchor, constant: 16),
            labelsStack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            labelsStack.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
        ])

        backgroundColor = .systemBackground
        separatorInset = UIEdgeInsets(top: 0, left: 80, bottom: 0, right: 16)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func prepareForReuse() {
        super.prepareForReuse()
        titleLabel.text = nil
        subtitleLabel.text = nil
        subtitleLabel.isHidden = false
        iconView.image = nil
        iconView.tintColor = nil
        iconView.isHidden = false
        iconContainer.isHidden = false
        iconContainer.backgroundColor = .clear
        accessoryType = .none
        selectionStyle = .default
        accessibilityLabel = nil
        accessibilityHint = nil
    }

    func render(_ category: NativeActivityCategory) {
        titleLabel.text = category.name
        subtitleLabel.text = nil
        subtitleLabel.isHidden = true
        iconContainer.backgroundColor = .clear
        iconView.image = category.image
        iconView.tintColor = category.palette.tint
        accessoryType = .disclosureIndicator
        accessibilityLabel = category.name
        accessibilityHint = "Opens the activity form for this trip"
    }

    func renderSearchResult(_ mapItem: MKMapItem, category: NativeActivityCategory) {
        let title = mapItem.name?.trimmingCharacters(in: .whitespacesAndNewlines)
        let address = mapItem.placemark.title?.trimmingCharacters(in: .whitespacesAndNewlines)
        titleLabel.text = (title?.isEmpty == false ? title : nil) ?? "Unnamed place"
        subtitleLabel.text = (address?.isEmpty == false ? address : nil) ?? "Location unavailable"
        subtitleLabel.isHidden = false
        iconContainer.backgroundColor = category.palette.surface
        iconView.image = category.image
        iconView.tintColor = category.palette.tint
        accessoryType = .none
        accessibilityLabel = [titleLabel.text, subtitleLabel.text]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
        accessibilityHint = "Shows this place on the globe"
    }
}

private final class NativeActivityQuickButton: UIControl {
    init(category: NativeActivityCategory) {
        super.init(frame: .zero)
        let circle = UIView()
        circle.translatesAutoresizingMaskIntoConstraints = false
        circle.backgroundColor = category.palette.surface
        circle.layer.cornerRadius = 36
        circle.isUserInteractionEnabled = false

        let imageView = UIImageView(image: category.image)
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.tintColor = category.palette.tint
        imageView.contentMode = .scaleAspectFit
        circle.addSubview(imageView)

        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.text = category.name
        label.font = NativeNewActivityViewController.Typography.quick
        label.adjustsFontForContentSizeCategory = true
        label.textColor = .secondaryLabel
        label.textAlignment = .center
        label.numberOfLines = 1
        label.minimumScaleFactor = 0.75
        label.adjustsFontSizeToFitWidth = true

        addSubview(circle)
        addSubview(label)
        NSLayoutConstraint.activate([
            circle.topAnchor.constraint(equalTo: topAnchor),
            circle.centerXAnchor.constraint(equalTo: centerXAnchor),
            circle.widthAnchor.constraint(equalToConstant: 72),
            circle.heightAnchor.constraint(equalToConstant: 72),
            imageView.centerXAnchor.constraint(equalTo: circle.centerXAnchor),
            imageView.centerYAnchor.constraint(equalTo: circle.centerYAnchor),
            imageView.widthAnchor.constraint(equalToConstant: 36),
            imageView.heightAnchor.constraint(equalToConstant: 36),
            label.topAnchor.constraint(equalTo: circle.bottomAnchor, constant: 7),
            label.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 1),
            label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -1),
            label.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
        accessibilityLabel = category.name
        accessibilityHint = "Opens the activity form for this trip"
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

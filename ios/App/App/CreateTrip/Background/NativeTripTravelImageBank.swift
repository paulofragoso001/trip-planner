import UIKit

final class NativeTripTravelImageBank {
    static let shared = NativeTripTravelImageBank(
        identifiers: [
            "WonderGreatWall",
            "WonderPetra",
            "WonderChristRedeemer",
            "WonderMachuPicchu",
            "WonderChichenItza",
            "WonderColosseum",
            "WonderTajMahal",
            "WonderAmazon",
            "WonderHaLongBay",
            "WonderIguazuFalls",
            "WonderJejuIsland",
            "WonderKomodoIsland",
            "WonderPuertoPrincesa",
            "WonderTableMountain"
        ],
        imageLoader: { UIImage(named: $0) },
        globeFallback: UIImage(named: "AlmidyOfflineGlobe")
    )

    let identifiers: [String]

    private let imageLoader: (String) -> UIImage?
    private let globeFallback: UIImage?
    private let randomIndex: (Int) -> Int
    private let lock = NSLock()
    private var previousIdentifier: String?

    init(
        identifiers: [String],
        imageLoader: @escaping (String) -> UIImage?,
        globeFallback: UIImage?,
        randomIndex: @escaping (Int) -> Int = { Int.random(in: 0..<$0) }
    ) {
        self.identifiers = identifiers
        self.imageLoader = imageLoader
        self.globeFallback = globeFallback
        self.randomIndex = randomIndex
    }

    func selectForPresentation() -> NativeTripTravelImageSelection {
        lock.lock()
        defer { lock.unlock() }

        let available = identifiers.compactMap { identifier in
            imageLoader(identifier).map { (identifier, $0) }
        }
        guard !available.isEmpty else {
            previousIdentifier = nil
            return NativeTripTravelImageSelection(
                identifier: nil,
                image: globeFallback,
                isUsingGlobeFallback: true
            )
        }

        let candidates: [(String, UIImage)]
        if available.count > 1, let previousIdentifier {
            candidates = available.filter { $0.0 != previousIdentifier }
        } else {
            candidates = available
        }
        let selectedIndex = min(max(randomIndex(candidates.count), 0), candidates.count - 1)
        let selected = candidates[selectedIndex]
        previousIdentifier = selected.0
        return NativeTripTravelImageSelection(
            identifier: selected.0,
            image: selected.1,
            isUsingGlobeFallback: false
        )
    }

    func selectForDestination(_ destination: String) -> NativeTripTravelImageSelection? {
        let normalized = destination
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            .lowercased()
        let words = Set(normalized
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty })
        let identifier: String?
        if words.contains("amazon") {
            identifier = "WonderAmazon"
        } else if words.contains("iguazu") {
            identifier = "WonderIguazuFalls"
        } else if !words.isDisjoint(with: ["brazil", "rio"]) {
            identifier = "WonderChristRedeemer"
        } else if !words.isDisjoint(with: ["italy", "rome", "roma"]) {
            identifier = "WonderColosseum"
        } else if normalized.contains("great wall") || !words.isDisjoint(with: ["china", "beijing"]) {
            identifier = "WonderGreatWall"
        } else if words.contains("jordan") || words.contains("petra") {
            identifier = "WonderPetra"
        } else if !words.isDisjoint(with: ["peru", "machu"]) {
            identifier = "WonderMachuPicchu"
        } else if words.contains("mexico") || words.contains("chichen") {
            identifier = "WonderChichenItza"
        } else if !words.isDisjoint(with: ["india", "agra"]) {
            identifier = "WonderTajMahal"
        } else if words.contains("vietnam") || normalized.contains("ha long") {
            identifier = "WonderHaLongBay"
        } else if !words.isDisjoint(with: ["korea", "jeju"]) {
            identifier = "WonderJejuIsland"
        } else if !words.isDisjoint(with: ["indonesia", "komodo"]) {
            identifier = "WonderKomodoIsland"
        } else if !words.isDisjoint(with: ["philippines", "palawan"]) {
            identifier = "WonderPuertoPrincesa"
        } else if normalized.contains("south africa") || normalized.contains("cape town") {
            identifier = "WonderTableMountain"
        } else {
            identifier = nil
        }
        guard let identifier, let image = imageLoader(identifier) else { return nil }
        return NativeTripTravelImageSelection(
            identifier: identifier,
            image: image,
            isUsingGlobeFallback: false
        )
    }
}

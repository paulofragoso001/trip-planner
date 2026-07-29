import PhotosUI
import UIKit

private final class NativeTripBackgroundCell: UICollectionViewCell {
    static let reuseIdentifier = "NativeTripBackgroundCell"
    private let imageView = UIImageView()
    private let titleLabel = UILabel()
    private let attributionLabel = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        contentView.layer.cornerRadius = 12
        contentView.layer.masksToBounds = true
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = AlmidyDesignTokens.Font.body(14)
        titleLabel.textColor = .white
        titleLabel.numberOfLines = 1
        titleLabel.layer.shadowColor = UIColor.black.cgColor
        titleLabel.layer.shadowOpacity = 0.8
        titleLabel.layer.shadowRadius = 3
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        attributionLabel.font = AlmidyDesignTokens.Font.body(9)
        attributionLabel.textColor = UIColor.white.withAlphaComponent(0.82)
        attributionLabel.numberOfLines = 1
        attributionLabel.layer.shadowColor = UIColor.black.cgColor
        attributionLabel.layer.shadowOpacity = 0.9
        attributionLabel.layer.shadowRadius = 2
        attributionLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(imageView)
        contentView.addSubview(titleLabel)
        contentView.addSubview(attributionLabel)
        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: contentView.topAnchor),
            imageView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            imageView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 8),
            titleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -6),
            titleLabel.bottomAnchor.constraint(equalTo: attributionLabel.topAnchor, constant: -2),
            attributionLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 8),
            attributionLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -6),
            attributionLabel.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -6)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func configure(with option: NativeTripBackgroundOption) {
        imageView.image = option.image
        titleLabel.text = option.title
        attributionLabel.text = option.attribution
        attributionLabel.isHidden = option.attribution == nil
        accessibilityLabel = "Use \(option.title) background"
    }
}

final class NativeTripBackgroundPickerViewController: UIViewController, UICollectionViewDataSource, UICollectionViewDelegateFlowLayout, UITextFieldDelegate, PHPickerViewControllerDelegate {
    private let initialQuery: String
    private let resolveImageBank: (String, @escaping ([NativeDestinationImageChoice]) -> Void) -> Void
    private let onSelect: (UIImage) -> Void
    private var imageOptions: [NativeTripBackgroundOption] = []
    private var rankedImageOptions = NativeRankedBackgroundSlots(count: 0)
    private var searchRevision = 0
    private var searchWorkItem: DispatchWorkItem?
    private var galleryImageTasks: [URLSessionDataTask] = []
    private let searchField = UITextField()
    private let segment = UISegmentedControl(items: ["Images", "Colors"])
    private let loadingIndicator = UIActivityIndicatorView(style: .large)
    private let emptyLabel = UILabel()
    private lazy var collectionView = UICollectionView(frame: .zero, collectionViewLayout: makeLayout())
    private lazy var colorOptions: [NativeTripBackgroundOption] = NativeTripColorBank.options()

    init(
        query: String,
        resolveImageBank: @escaping (String, @escaping ([NativeDestinationImageChoice]) -> Void) -> Void,
        onSelect: @escaping (UIImage) -> Void
    ) {
        initialQuery = query
        self.resolveImageBank = resolveImageBank
        self.onSelect = onSelect
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    deinit { cancelGalleryWork() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Self.color(0x1B1B1D)

        let cancelButton = UIButton(type: .system)
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.setTitleColor(.white, for: .normal)
        cancelButton.titleLabel?.font = AlmidyDesignTokens.Font.button(17)
        cancelButton.layer.cornerRadius = 23
        cancelButton.layer.borderWidth = 1
        cancelButton.layer.borderColor = UIColor.white.withAlphaComponent(0.14).cgColor
        cancelButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)

        let titleLabel = UILabel()
        titleLabel.text = "Choose Image"
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.font = AlmidyDesignTokens.Font.semibold(20)

        let addButton = UIButton(type: .system)
        addButton.setImage(UIImage(systemName: "plus", withConfiguration: UIImage.SymbolConfiguration(pointSize: 25, weight: .regular)), for: .normal)
        addButton.tintColor = .white
        addButton.layer.cornerRadius = 23
        addButton.layer.borderWidth = 1
        addButton.layer.borderColor = UIColor.white.withAlphaComponent(0.14).cgColor
        addButton.accessibilityLabel = "Choose photo from library"
        addButton.addTarget(self, action: #selector(addPhoto), for: .touchUpInside)

        let header = UIStackView(arrangedSubviews: [cancelButton, titleLabel, addButton])
        header.axis = .horizontal
        header.alignment = .center
        header.distribution = .equalCentering
        [cancelButton, addButton].forEach { $0.widthAnchor.constraint(equalToConstant: $0 === cancelButton ? 98 : 48).isActive = true }
        cancelButton.heightAnchor.constraint(equalToConstant: 48).isActive = true
        addButton.heightAnchor.constraint(equalToConstant: 48).isActive = true

        segment.selectedSegmentIndex = 0
        segment.selectedSegmentTintColor = UIColor.white.withAlphaComponent(0.34)
        segment.setTitleTextAttributes([.foregroundColor: UIColor.white, .font: AlmidyDesignTokens.Font.button(15)], for: .normal)
        segment.addTarget(self, action: #selector(segmentChanged), for: .valueChanged)

        searchField.text = initialQuery
        searchField.placeholder = "Search destination images"
        searchField.attributedPlaceholder = NSAttributedString(
            string: "Search destination images",
            attributes: [.foregroundColor: UIColor.white.withAlphaComponent(0.42)]
        )
        searchField.textColor = .white
        searchField.tintColor = AlmidyDesignTokens.Color.gold
        searchField.font = AlmidyDesignTokens.Font.body(18)
        searchField.backgroundColor = UIColor.white.withAlphaComponent(0.08)
        searchField.layer.cornerRadius = 12
        setSearchFieldPadding(48)
        searchField.clearButtonMode = .whileEditing
        searchField.returnKeyType = .search
        searchField.delegate = self
        searchField.addTarget(self, action: #selector(searchChanged), for: .editingChanged)
        let searchIcon = UIImageView(image: UIImage(systemName: "magnifyingglass"))
        searchIcon.tintColor = UIColor.white.withAlphaComponent(0.55)
        searchIcon.frame = CGRect(x: 15, y: 13, width: 24, height: 24)
        searchField.addSubview(searchIcon)

        collectionView.backgroundColor = .clear
        collectionView.dataSource = self
        collectionView.delegate = self
        collectionView.register(NativeTripBackgroundCell.self, forCellWithReuseIdentifier: NativeTripBackgroundCell.reuseIdentifier)

        loadingIndicator.color = UIColor.white.withAlphaComponent(0.7)
        loadingIndicator.hidesWhenStopped = true
        emptyLabel.text = "No destination images found"
        emptyLabel.textColor = UIColor.white.withAlphaComponent(0.56)
        emptyLabel.textAlignment = .center
        emptyLabel.font = AlmidyDesignTokens.Font.body(16)
        emptyLabel.isHidden = true

        let stack = UIStackView(arrangedSubviews: [header, segment, searchField, collectionView])
        stack.axis = .vertical
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        loadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        emptyLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(loadingIndicator)
        view.addSubview(emptyLabel)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 18),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            stack.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            header.heightAnchor.constraint(equalToConstant: 52),
            segment.heightAnchor.constraint(equalToConstant: 34),
            searchField.heightAnchor.constraint(equalToConstant: 48),
            loadingIndicator.centerXAnchor.constraint(equalTo: collectionView.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: collectionView.centerYAnchor),
            emptyLabel.centerXAnchor.constraint(equalTo: collectionView.centerXAnchor),
            emptyLabel.centerYAnchor.constraint(equalTo: collectionView.centerYAnchor)
        ])
        loadImages(for: initialQuery)
    }

    private func setSearchFieldPadding(_ padding: CGFloat) {
        let left = UIView(frame: CGRect(x: 0, y: 0, width: padding, height: 1))
        let right = UIView(frame: CGRect(x: 0, y: 0, width: padding, height: 1))
        searchField.leftView = left
        searchField.rightView = right
        searchField.leftViewMode = .always
        searchField.rightViewMode = .always
    }

    private func makeLayout() -> UICollectionViewFlowLayout {
        let layout = UICollectionViewFlowLayout()
        layout.minimumInteritemSpacing = 8
        layout.minimumLineSpacing = 8
        return layout
    }

    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        segment.selectedSegmentIndex == 0 ? imageOptions.count : colorOptions.count
    }

    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: NativeTripBackgroundCell.reuseIdentifier, for: indexPath) as! NativeTripBackgroundCell
        let options = segment.selectedSegmentIndex == 0 ? imageOptions : colorOptions
        cell.configure(with: options[indexPath.item])
        return cell
    }

    func collectionView(_ collectionView: UICollectionView, layout: UICollectionViewLayout, sizeForItemAt indexPath: IndexPath) -> CGSize {
        let width = floor((collectionView.bounds.width - 24) / 4)
        return CGSize(width: width, height: width * 1.42)
    }

    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        let options = segment.selectedSegmentIndex == 0 ? imageOptions : colorOptions
        onSelect(options[indexPath.item].image)
        dismiss(animated: true)
    }

    @objc private func segmentChanged() {
        searchField.isHidden = segment.selectedSegmentIndex == 1
        emptyLabel.isHidden = true
        collectionView.reloadData()
    }

    @objc private func searchChanged() {
        searchWorkItem?.cancel()
        let query = searchField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let item = DispatchWorkItem { [weak self] in self?.loadImages(for: query) }
        searchWorkItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45, execute: item)
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        searchWorkItem?.cancel()
        loadImages(for: textField.text ?? "")
        return true
    }

    private func loadImages(for rawQuery: String) {
        cancelGalleryWork()
        let query = rawQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        let bankQuery = query.count >= 2 ? query : "iconic world travel landmark"
        searchRevision += 1
        let revision = searchRevision
        imageOptions = []
        rankedImageOptions = NativeRankedBackgroundSlots(count: 0)
        collectionView.reloadData()
        emptyLabel.isHidden = true
        loadingIndicator.startAnimating()
        resolveImageBank(bankQuery) { [weak self] choices in
            guard let self, revision == self.searchRevision else { return }
            guard !choices.isEmpty else {
                self.finishLoadingImages()
                return
            }
            self.rankedImageOptions = NativeRankedBackgroundSlots(count: choices.count)
            var remaining = choices.count
            for (index, choice) in choices.enumerated() {
                let task = URLSession.shared.dataTask(with: choice.url) { [weak self] data, _, _ in
                    DispatchQueue.main.async {
                        guard let self, revision == self.searchRevision else { return }
                        if let data, let image = UIImage(data: data) {
                            self.rankedImageOptions.insert(NativeTripBackgroundOption(
                                title: choice.title,
                                image: image,
                                attribution: choice.attribution
                            ), at: index)
                            self.imageOptions = self.rankedImageOptions.loadedOptionsInServerOrder
                            self.collectionView.reloadData()
                        }
                        remaining -= 1
                        if remaining == 0 { self.finishLoadingImages() }
                    }
                }
                self.galleryImageTasks.append(task)
                task.resume()
            }
        }
    }

    private func cancelGalleryWork() {
        searchRevision += 1
        searchWorkItem?.cancel()
        searchWorkItem = nil
        galleryImageTasks.forEach { $0.cancel() }
        galleryImageTasks.removeAll()
    }

    private func finishLoadingImages() {
        loadingIndicator.stopAnimating()
        emptyLabel.isHidden = !imageOptions.isEmpty
    }

    @objc private func cancel() {
        cancelGalleryWork()
        dismiss(animated: true)
    }

    @objc private func addPhoto() {
        var configuration = PHPickerConfiguration(photoLibrary: .shared())
        configuration.filter = .images
        configuration.selectionLimit = 1
        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = self
        present(picker, animated: true)
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let provider = results.first?.itemProvider, provider.canLoadObject(ofClass: UIImage.self) else { return }
        provider.loadObject(ofClass: UIImage.self) { [weak self] object, _ in
            guard let self, let image = object as? UIImage else { return }
            DispatchQueue.main.async {
                self.onSelect(image)
                self.dismiss(animated: true)
            }
        }
    }

    private static func makeColorOptions() -> [NativeTripBackgroundOption] {
        var definitions: [(String, UIColor, UIColor)] = []
        definitions.append(("Sunrise", color(0xE92CEB), color(0xFF7043)))
        definitions.append(("Sunset", color(0xFFC43D), color(0xFF5A2A)))
        definitions.append(("Sea", color(0x4268F5), color(0x00D4E8)))
        definitions.append(("Island", color(0xE8D70B), color(0x2ED1A2)))
        definitions.append(("Desert", color(0xFF9435), color(0xFFD438)))
        definitions.append(("Snow", color(0x10D9E7), color(0x387AF5)))
        definitions.append(("Grove", color(0xF4AE5D), color(0xDDF000)))
        definitions.append(("Road", color(0xC8B8B8), color(0x57494B)))
        definitions.append(("Mountain", color(0xB76E3C), color(0x4778B5)))
        definitions.append(("Rooftop", color(0xB72DE4), color(0xFF5722)))
        definitions.append(("Metropolis", color(0xEEA15E), color(0xE91E63)))
        definitions.append(("City Light", color(0x35C9E9), color(0xC21FEB)))
        return definitions.map { NativeTripBackgroundOption(title: $0.0, image: gradientImage(start: $0.1, end: $0.2)) }
    }

    private static func color(_ hex: UInt32) -> UIColor {
        UIColor(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }

    private static func gradientImage(start: UIColor, end: UIColor) -> UIImage {
        let size = CGSize(width: 420, height: 620)
        return UIGraphicsImageRenderer(size: size).image { context in
            let colors = [start.cgColor, end.cgColor] as CFArray
            let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1])!
            context.cgContext.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: size.width, y: size.height), options: [])
        }
    }
}

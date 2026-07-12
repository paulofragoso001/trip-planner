import Capacitor
import Network
import WebKit

enum NativeWebRoutePolicy {
    static let allowedPrefixes = [
        "/dashboard/imports/",
        "/dashboard/help",
        "/dashboard/account/",
    ]

    static func allows(_ route: String) -> Bool {
        guard route.hasPrefix("/") && !route.hasPrefix("//"),
              let url = URL(string: route) else {
            return false
        }
        return allows(url)
    }

    static func allows(_ url: URL) -> Bool {
        guard url.host == nil || url.host == "almidy.app",
              url.path.hasPrefix("/dashboard/") else {
            return false
        }
        return allowedPrefixes.contains { url.path.hasPrefix($0) }
    }
}

final class MainViewController: CAPBridgeViewController {
    private var didInstallLocationOverlayBlocker = false
    private var nativeDashboardController: NativeMapViewController?
    private var didPresentNativeDashboard = false
    private var nativeTripStore: NativeTripStore?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        // Preserve the mobile signal used by the server route guard while
        // adding a stable marker for native-only wallet presentation.
        bridge?.webView?.customUserAgent = "AlmidyNativeApp/1.0 Mobile iPhone"
        installLocationOverlayBlocker()
        let mapGatewayPlugin = MapGatewayPlugin()
        let nativeMapPlugin = NativeMapPlugin()
        nativeMapPlugin.mapGatewayPlugin = mapGatewayPlugin
        nativeTripStore = NativeTripStore(webView: bridge?.webView)
        bridge?.registerPluginInstance(mapGatewayPlugin)
        bridge?.registerPluginInstance(nativeMapPlugin)
        bridge?.registerPluginInstance(AppleCalendarPlugin())
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        installLocationOverlayBlocker()
        applyLocationOverlayBlocker()
        presentNativeDashboardIfNeeded()
    }

    private func presentNativeDashboardIfNeeded() {
        guard !didPresentNativeDashboard,
              presentedViewController == nil,
              bridge != nil else { return }

        didPresentNativeDashboard = true
        let dashboard = NativeMapViewController(trips: [], tripStore: nativeTripStore) { [weak self] route in
            self?.openWebRouteFromNativeDashboard(route)
        }
        dashboard.modalPresentationStyle = .fullScreen
        nativeDashboardController = dashboard
        present(dashboard, animated: false)
    }

    private func openWebRouteFromNativeDashboard(_ route: String) {
        guard NativeWebRoutePolicy.allows(route) else {
            assertionFailure("Blocked native WebView route: \(route)")
            return
        }

        nativeDashboardController?.dismiss(animated: true) { [weak self] in
            self?.nativeDashboardController = nil
            let escapedRoute = route
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "'", with: "\\'")
            self?.bridge?.webView?.evaluateJavaScript("window.location.assign('\(escapedRoute)')")
        }
    }

    private func installLocationOverlayBlocker() {
        guard !didInstallLocationOverlayBlocker, let webView = bridge?.webView else { return }

        let script = WKUserScript(
            source: locationOverlayBlockerSource,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        webView.configuration.userContentController.addUserScript(script)
        didInstallLocationOverlayBlocker = true
        applyLocationOverlayBlocker()
    }

    private func applyLocationOverlayBlocker() {
        bridge?.webView?.evaluateJavaScript(locationOverlayBlockerSource)
    }

    private var locationOverlayBlockerSource: String {
        """
        (() => {
            if (!document.documentElement) {
                return;
            }

            const removeLocationOverlay = () => {
                const selectors = [
                    "[data-testid='launch-location-permission']",
                    "[aria-labelledby='launch-location-title']",
                    "#launch-location-title"
                ];

                for (const selector of selectors) {
                    document.querySelectorAll(selector).forEach((element) => {
                        const overlay = element.closest("[data-testid='launch-location-permission'], [role='dialog'], section") || element;
                        overlay.remove();
                    });
                }

                document.querySelectorAll("section,div").forEach((element) => {
                    const text = element.textContent || "";
                    if (
                        text.includes('Allow "Almidy" to use your location?') &&
                        text.includes("Show your location on the globe")
                    ) {
                        element.remove();
                    }
                });
            };

            if (!document.getElementById("almidy-location-overlay-blocker")) {
                const style = document.createElement("style");
                style.id = "almidy-location-overlay-blocker";
                style.textContent = [
                    "[data-testid='launch-location-permission']",
                    "[aria-labelledby='launch-location-title']"
                ].join(",") + "{display:none!important;pointer-events:none!important;}";
                document.documentElement.appendChild(style);
            }

            if (!window.__almidyLocationOverlayBlockerInstalled) {
                window.__almidyLocationOverlayBlockerInstalled = true;
                window.addEventListener("wayline:home-use-current-location", (event) => {
                    event.stopImmediatePropagation();
                    event.preventDefault();
                    removeLocationOverlay();
                }, true);

                new MutationObserver(removeLocationOverlay).observe(document.documentElement, {
                    childList: true,
                    subtree: true
                });
            }

            removeLocationOverlay();
        })();
        """
    }

    @available(iOS 15.0, *)
    func webView(
        _ webView: WKWebView,
        requestGeolocationPermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        decisionHandler(.deny)
    }
}

final class NativeWebFeatureViewController: UIViewController, WKNavigationDelegate {
    private let route: String
    private let featureTitle: String
    private let onFinish: () -> Void
    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "app.almidy.native-web-feature.network")
    private let webView: WKWebView
    private let loadingView = UIActivityIndicatorView(style: .medium)
    private let statusLabel = UILabel()
    private let retryButton = UIButton(type: .system)
    private var isOffline = false

    init(route: String, title: String, onFinish: @escaping () -> Void = {}) {
        self.route = route
        self.featureTitle = title
        self.onFinish = onFinish
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        self.webView = WKWebView(frame: .zero, configuration: configuration)
        super.init(nibName: nil, bundle: nil)
    }

    static func wrapped(route: String, title: String, onFinish: @escaping () -> Void = {}) -> UINavigationController {
        let controller = NativeWebFeatureViewController(route: route, title: title, onFinish: onFinish)
        let navigationController = UINavigationController(rootViewController: controller)
        navigationController.modalPresentationStyle = .pageSheet
        if let sheet = navigationController.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = 28
        }
        return navigationController
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        configureNavigation()
        configureWebView()
        configureStateViews()
        startNetworkMonitoring()
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if isBeingDismissed || navigationController?.isBeingDismissed == true {
            monitor.cancel()
            onFinish()
        }
    }

    private func configureNavigation() {
        title = featureTitle
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .close,
            target: self,
            action: #selector(close)
        )
    }

    private func configureWebView() {
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func configureStateViews() {
        loadingView.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        retryButton.translatesAutoresizingMaskIntoConstraints = false

        statusLabel.textAlignment = .center
        statusLabel.font = .systemFont(ofSize: 16, weight: .medium)
        statusLabel.textColor = .secondaryLabel
        statusLabel.numberOfLines = 0
        statusLabel.isHidden = true

        retryButton.setTitle("Retry", for: .normal)
        retryButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        retryButton.addTarget(self, action: #selector(retry), for: .touchUpInside)
        retryButton.isHidden = true

        view.addSubview(loadingView)
        view.addSubview(statusLabel)
        view.addSubview(retryButton)
        NSLayoutConstraint.activate([
            loadingView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            statusLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            statusLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -24),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32),
            retryButton.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 16),
            retryButton.centerXAnchor.constraint(equalTo: view.centerXAnchor)
        ])
    }

    private func startNetworkMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                guard let self else { return }
                self.isOffline = path.status != .satisfied
                if self.isOffline {
                    self.showState("You’re offline. This page needs an internet connection.", loading: false, retry: false)
                } else if self.webView.url == nil {
                    self.loadRoute()
                }
            }
        }
        monitor.start(queue: monitorQueue)
    }

    private func loadRoute() {
        guard NativeWebRoutePolicy.allows(route), !isOffline else { return }
        guard let url = URL(string: route, relativeTo: URL(string: "https://almidy.app")) else {
            showState("This page could not be opened.", loading: false, retry: false)
            return
        }
        showState(nil, loading: true, retry: false)
        webView.load(URLRequest(url: url))
    }

    private func showState(_ message: String?, loading: Bool, retry: Bool) {
        loadingView.isHidden = !loading
        if loading {
            loadingView.startAnimating()
        } else {
            loadingView.stopAnimating()
        }
        statusLabel.text = message
        statusLabel.isHidden = message == nil
        retryButton.isHidden = !retry
        webView.isHidden = loading || message != nil
    }

    @objc private func close() {
        if webView.canGoBack {
            webView.goBack()
        } else {
            dismiss(animated: true)
        }
    }

    @objc private func retry() {
        loadRoute()
    }

    private func showSessionExpired() {
        showState("Your Almidy session has expired. Sign in again to continue.", loading: false, retry: false)
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        showState(nil, loading: true, retry: false)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        showState(nil, loading: false, retry: false)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showState("This page could not be loaded.", loading: false, retry: true)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        showState("This page could not be loaded.", loading: false, retry: true)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if url.path == "/login" {
            showSessionExpired()
            decisionHandler(.cancel)
            return
        }
        guard url.host == nil || url.host == "almidy.app" else {
            decisionHandler(.cancel)
            return
        }
        decisionHandler(NativeWebRoutePolicy.allows(url) ? .allow : .cancel)
    }
}

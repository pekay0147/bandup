import SwiftUI
import WebKit

// 밴드업 웹앱(GitHub Pages)을 그대로 감싼 아이폰 앱.
// bandup:// 주소로 열 수 있어서, 단축어의 마지막 동작을 'URL 열기 → bandup://'로 두면
// 뒷면 탭 → 화면 저장 → 이 앱이 바로 열리고 방금 찍은 화면으로 이동해요.
//   bandup://              앱 열기(새로 찍은 화면을 바로 가져와요)
//   bandup://u/<회원코드>   다른 회원 앱으로 바꾸기 (예: bandup://u/eunsu-c7g3)

@main
struct BandupApp: App {
    @StateObject private var web = WebModel()
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            WebView(webView: web.webView)
                .ignoresSafeArea()
                .background(Color(red: 0.961, green: 0.957, blue: 0.980))
                .onOpenURL { web.open($0) }
                .onChange(of: phase) { p in if p == .active { web.becameActive() } }
        }
    }
}

struct WebView: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

final class WebModel: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    static let base = URL(string: "https://pekay0147.github.io/bandup/")!
    let webView: WKWebView

    private var slug: String {
        get {
            UserDefaults.standard.string(forKey: "slug")
                ?? (Bundle.main.object(forInfoDictionaryKey: "BandupSlug") as? String)
                ?? "eunsu-c7g3"
        }
        set { UserDefaults.standard.set(newValue, forKey: "slug") }
    }
    private var startURL: URL { WebModel.base.appendingPathComponent("u/\(slug)/") }

    override init() {
        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true                 // 유튜브가 전체 화면으로 튀지 않게
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.websiteDataStore = .default()                    // 단어장·기록(localStorage) 유지
        webView = WKWebView(frame: .zero, configuration: cfg)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.961, green: 0.957, blue: 0.980, alpha: 1)
        webView.scrollView.contentInsetAdjustmentBehavior = .never   // 페이지가 safe-area를 직접 처리
        webView.allowsBackForwardNavigationGestures = false
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        webView.load(URLRequest(url: startURL))
    }

    // bandup:// 로 열렸을 때
    func open(_ url: URL) {
        if url.host == "u", let s = url.pathComponents.dropFirst().first, !s.isEmpty, s != slug {
            slug = s
            webView.load(URLRequest(url: startURL))
            return
        }
        pull()
    }

    func becameActive() { pull() }

    // 페이지에 "새로 찍은 화면 가져와" 신호
    private func pull() {
        webView.evaluateJavaScript("window.dispatchEvent(new Event('bandup-open'))", completionHandler: nil)
    }

    // 밴드업 밖으로 나가는 링크는 사파리로
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let u = action.request.url else { decisionHandler(.allow); return }
        if let scheme = u.scheme, scheme != "http", scheme != "https", scheme != "about", scheme != "blob", scheme != "data" {
            UIApplication.shared.open(u); decisionHandler(.cancel); return
        }
        let mainFrame = action.targetFrame?.isMainFrame ?? true
        if mainFrame, action.navigationType == .linkActivated, u.host != WebModel.base.host {
            UIApplication.shared.open(u); decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }

    // target=_blank / window.open → 사파리
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let u = action.request.url { UIApplication.shared.open(u) }
        return nil
    }

    // 마이크(녹음) 허용
    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }

    // alert / confirm
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        present(UIAlertController(title: nil, message: message, preferredStyle: .alert), actions: [("확인", true)]) { _ in completionHandler() }
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        present(UIAlertController(title: nil, message: message, preferredStyle: .alert), actions: [("취소", false), ("확인", true)]) { completionHandler($0) }
    }
    private func present(_ ac: UIAlertController, actions: [(String, Bool)], done: @escaping (Bool) -> Void) {
        for (t, v) in actions { ac.addAction(UIAlertAction(title: t, style: v ? .default : .cancel) { _ in done(v) }) }
        let root = UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first?.rootViewController
        if let root { root.present(ac, animated: true) } else { done(false) }
    }

    // 웹 화면이 메모리 부족으로 꺼지면 다시 불러오기
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}

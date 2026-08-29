import UIKit
import Capacitor
import Network

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private let relayServer = LocalVideoRelayServer()

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        relayServer.start()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        relayServer.stop()
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

/// Local loopback relay for `<video>` playback on iOS — the iOS counterpart of
/// `LocalVideoRelayServer.java` on Android (see that file for the full rationale).
///
/// WKWebView enforces the W3C mixed-content spec directly on `<video src>` loads, and unlike
/// Android's WebView there is no public API to relax it — the `NSAppTransportSecurity` /
/// `NSAllowsArbitraryLoads` exception in Info.plist only tells iOS to permit the underlying
/// http:// *connection*; it says nothing about WebKit's separate policy of refusing to load an
/// http:// subresource on an https:// page (Capacitor's WKWebView reports a synthetic
/// `https://localhost` origin), so a direct video load just hangs/fails silently instead.
///
/// 127.0.0.1 is a "potentially trustworthy" origin per that same mixed-content spec, so relaying
/// through here sidesteps the restriction entirely: this fetches the real stream with ordinary
/// `URLSession` networking (the same native networking CapacitorHttp already uses for API calls,
/// unaffected by WebKit's page-level policy) and re-serves it locally, forwarding the `Range`
/// header both ways so seeking/buffering behave normally. HLS playback is unaffected — hls.js
/// does its own fetching, which CapacitorHttp already covers.
///
/// Implemented on Apple's built-in `Network` framework rather than a third-party HTTP server
/// library so this needs no new Swift Package Manager dependency wired into the Xcode project.
final class LocalVideoRelayServer {
    static let port: UInt16 = 8098

    private var listener: NWListener?
    private let queue = DispatchQueue(label: "com.lunivo.iptv.relay")
    private var activeConnections = Set<RelayConnection>()

    func start() {
        guard listener == nil, let port = NWEndpoint.Port(rawValue: Self.port) else { return }

        let params = NWParameters.tcp
        // Restricts the listener to the loopback interface only — the equivalent of binding to
        // 127.0.0.1 specifically rather than 0.0.0.0, so this never becomes reachable from the
        // local network the device is on.
        params.requiredInterfaceType = .loopback
        params.allowLocalEndpointReuse = true

        do {
            let listener = try NWListener(using: params, on: port)
            listener.newConnectionHandler = { [weak self] connection in
                self?.accept(connection)
            }
            listener.stateUpdateHandler = { state in
                if case .failed(let error) = state {
                    NSLog("LocalVideoRelay: listener failed: \(error)")
                }
            }
            listener.start(queue: queue)
            self.listener = listener
        } catch {
            NSLog("LocalVideoRelay: failed to start: \(error)")
        }
    }

    func stop() {
        listener?.cancel()
        listener = nil
        for connection in activeConnections {
            connection.cancel()
        }
        activeConnections.removeAll()
    }

    private func accept(_ connection: NWConnection) {
        connection.start(queue: queue)
        var relay: RelayConnection!
        relay = RelayConnection(connection: connection, queue: queue) { [weak self] in
            self?.activeConnections.remove(relay)
        }
        activeConnections.insert(relay)
        relay.begin()
    }
}

/// Handles exactly one relayed request end-to-end: reads the raw HTTP request off the socket,
/// fetches the target URL, and streams the upstream response back as it arrives (rather than
/// buffering the whole file in memory) so large video responses don't balloon memory use.
/// NSObject subclass (required for URLSessionDataDelegate) — already Hashable by identity via
/// Foundation's default NSObject bridging, so no custom Hashable conformance is needed here.
private final class RelayConnection: NSObject {
    private let connection: NWConnection
    private let queue: DispatchQueue
    private let onFinish: () -> Void

    private var headerBuffer = Data()
    private var urlSession: URLSession?
    private var targetURL: URL?
    private var didSendHeaders = false
    private var isHeadRequest = false
    /** True when the `Range: bytes=0-0` sent upstream was our own probe, not something the client asked for. */
    private var usedSyntheticRange = false
    private var finished = false
    private var bytesForwarded = 0
    /// False once the client (AVFoundation/WKWebView) has closed or reset its side of the socket.
    /// AVFoundation routinely opens a short-lived probe connection and cancels it as soon as it has
    /// what it needs, then opens a separate connection for the real range it wants — without this
    /// flag, a response arriving after that cancel would still be written to the dead socket (a
    /// silently-swallowed failed write) and, worse, the matching upstream `URLSession` request would
    /// keep running against the real server instead of being cancelled immediately. That matters a
    /// lot here: the account this relay talks to allows only one concurrent connection, so a
    /// dangling upstream request from an already-abandoned probe can make the *next*, real playback
    /// request get rejected by the server for exceeding that limit.
    private var clientConnectionAlive = true

    init(connection: NWConnection, queue: DispatchQueue, onFinish: @escaping () -> Void) {
        self.connection = connection
        self.queue = queue
        self.onFinish = onFinish
    }

    func cancel() {
        urlSession?.invalidateAndCancel()
        connection.cancel()
    }

    func begin() {
        connection.stateUpdateHandler = { [weak self] state in
            switch state {
            case .failed, .cancelled:
                self?.handleClientDisconnect()
            default:
                break
            }
        }
        receiveHeaders()
    }

    /// The client dropped its side of the socket. Tear down the matching upstream request right
    /// away instead of letting it run to completion against a peer that's no longer listening.
    private func handleClientDisconnect() {
        clientConnectionAlive = false
        guard !finished else { return }
        finished = true
        urlSession?.invalidateAndCancel()
        onFinish()
    }

    private func receiveHeaders() {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, isComplete, error in
            guard let self else { return }
            if let data, !data.isEmpty {
                self.headerBuffer.append(data)
            }
            if let range = self.headerBuffer.range(of: Data("\r\n\r\n".utf8)) {
                self.handleRequest(self.headerBuffer[..<range.lowerBound])
                return
            }
            if isComplete || error != nil || self.headerBuffer.count > 16_384 {
                self.finish()
                return
            }
            self.receiveHeaders()
        }
    }

    private func handleRequest(_ headerData: Data) {
        guard let headerText = String(data: headerData, encoding: .utf8) else {
            sendSimple(status: "400 Bad Request", body: "Malformed request")
            return
        }

        let lines = headerText.components(separatedBy: "\r\n")
        let requestLineParts = lines.first?.split(separator: " ") ?? []
        guard requestLineParts.count >= 2 else {
            sendSimple(status: "400 Bad Request", body: "Malformed request")
            return
        }
        let method = String(requestLineParts[0])
        let target = String(requestLineParts[1])

        if method == "OPTIONS" {
            sendPreflight()
            return
        }
        // AVFoundation's HTTP media loader (what actually fetches <video src> under WKWebView)
        // commonly probes with HEAD before issuing ranged GETs — reject it like Android's relay
        // rejects nothing here, and playback never gets past the probe.
        guard method == "GET" || method == "HEAD" else {
            sendSimple(status: "405 Method Not Allowed", body: "Only GET/HEAD/OPTIONS are supported")
            return
        }

        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            guard let colon = line.firstIndex(of: ":") else { continue }
            let key = line[line.startIndex..<colon].trimmingCharacters(in: .whitespaces).lowercased()
            let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            headers[key] = value
        }

        guard let components = URLComponents(string: "http://127.0.0.1\(target)"),
              let decoded = components.queryItems?.first(where: { $0.name == "url" })?.value,
              !decoded.isEmpty else {
            sendSimple(status: "400 Bad Request", body: "Missing url param")
            return
        }
        guard decoded.hasPrefix("http://") || decoded.hasPrefix("https://"), let targetURL = URL(string: decoded) else {
            sendSimple(status: "400 Bad Request", body: "Only http/https targets are allowed")
            return
        }
        self.targetURL = targetURL

        // Always issue a real GET upstream, even for an inbound HEAD — this provider (like several
        // Xtream panels) answers genuine HEAD requests with `Content-Length: 0`, which would tell
        // AVFoundation the file is empty and make it abort. A single-byte range GET gets the real
        // total size via Content-Range instead, and the body is dropped before it reaches the client.
        var request = URLRequest(url: targetURL, timeoutInterval: 15)
        isHeadRequest = method == "HEAD"
        if let range = headers["range"] {
            request.setValue(range, forHTTPHeaderField: "Range")
        } else if isHeadRequest {
            request.setValue("bytes=0-0", forHTTPHeaderField: "Range")
            usedSyntheticRange = true
        }
        request.setValue(headers["user-agent"] ?? "Mozilla/5.0", forHTTPHeaderField: "User-Agent")

        NSLog("LocalVideoRelay: -> \(method) \(targetURL.absoluteString) range=\(request.value(forHTTPHeaderField: "Range") ?? "none")")

        let session = URLSession(configuration: .ephemeral, delegate: self, delegateQueue: nil)
        urlSession = session
        session.dataTask(with: request).resume()
    }

    private func sendPreflight() {
        send(statusLine: "204 No Content", extraHeaders: [
            "Access-Control-Allow-Methods: GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers: Range, Content-Type",
            "Access-Control-Max-Age: 86400",
        ], body: nil)
        finish()
    }

    private func sendSimple(status: String, body: String) {
        NSLog("LocalVideoRelay: <- \(status) (\(body))")
        send(statusLine: status, extraHeaders: [], body: body.data(using: .utf8))
        finish()
    }

    private func send(statusLine: String, extraHeaders: [String], body: Data?) {
        var lines = ["HTTP/1.1 \(statusLine)"]
        if let body {
            lines.append("Content-Type: text/plain")
            lines.append("Content-Length: \(body.count)")
        }
        lines.append("Access-Control-Allow-Origin: *")
        lines.append(contentsOf: extraHeaders)
        lines.append("Connection: close")
        lines.append("")
        lines.append("")

        var payload = lines.joined(separator: "\r\n").data(using: .utf8) ?? Data()
        if let body {
            payload.append(body)
        }
        connection.send(content: payload, completion: .contentProcessed { _ in })
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        urlSession?.finishTasksAndInvalidate()
        guard clientConnectionAlive else {
            connection.cancel()
            onFinish()
            return
        }
        connection.send(content: nil, isComplete: true, completion: .contentProcessed { [weak self] _ in
            self?.connection.cancel()
            self?.onFinish()
        })
    }
}

extension RelayConnection: URLSessionDataDelegate {
    func urlSession(
        _ session: URLSession,
        dataTask: URLSessionDataTask,
        didReceive response: URLResponse,
        completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
    ) {
        guard clientConnectionAlive else {
            completionHandler(.cancel)
            finish()
            return
        }
        guard let http = response as? HTTPURLResponse else {
            completionHandler(.cancel)
            finish()
            return
        }

        var status = http.statusCode
        var length = http.value(forHTTPHeaderField: "Content-Length")
        var range = http.value(forHTTPHeaderField: "Content-Range")

        // Our own bytes=0-0 probe, not something the client asked for — report it as an ordinary
        // whole-resource HEAD reply (200 + the real total size) rather than leaking the internal
        // 206/1-byte partial response, which some HTTP media loaders may not expect from a HEAD.
        if usedSyntheticRange, let contentRange = range, let total = contentRange.split(separator: "/").last, total != "*" {
            status = 200
            length = String(total)
            range = nil
        }

        let reason = status == 206 ? "Partial Content" : HTTPURLResponse.localizedString(forStatusCode: status)
        var lines = ["HTTP/1.1 \(status) \(reason)"]
        lines.append("Content-Type: \(http.value(forHTTPHeaderField: "Content-Type") ?? "video/mp4")")
        if let length {
            lines.append("Content-Length: \(length)")
        }
        if let range {
            lines.append("Content-Range: \(range)")
        }
        lines.append("Accept-Ranges: bytes")
        lines.append("Access-Control-Allow-Origin: *")
        lines.append("Access-Control-Expose-Headers: Content-Range, Accept-Ranges, Content-Length")
        lines.append("Connection: close")
        lines.append("")
        lines.append("")

        NSLog("LocalVideoRelay: <- \(status) for \(targetURL?.absoluteString ?? "?") (upstream was \(http.statusCode))")

        didSendHeaders = true
        connection.send(content: lines.joined(separator: "\r\n").data(using: .utf8), completion: .contentProcessed { _ in })
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        bytesForwarded += data.count
        guard clientConnectionAlive else {
            dataTask.cancel()
            return
        }
        // A well-behaved upstream sends no body for HEAD; this guards against one that ignores
        // that and sends the full stream anyway, wasting upstream bandwidth for no reason.
        guard !isHeadRequest else { return }
        connection.send(content: data, completion: .contentProcessed { _ in })
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error, !didSendHeaders {
            NSLog("LocalVideoRelay: upstream request failed for \(targetURL?.absoluteString ?? "?"): \(error.localizedDescription)")
            sendSimple(status: "502 Bad Gateway", body: "Upstream request failed: \(error.localizedDescription)")
            return
        }
        if let error {
            NSLog("LocalVideoRelay: done for \(targetURL?.absoluteString ?? "?"), \(bytesForwarded) bytes forwarded, ended with error: \(error.localizedDescription)")
        } else {
            NSLog("LocalVideoRelay: done for \(targetURL?.absoluteString ?? "?"), \(bytesForwarded) bytes forwarded")
        }
        finish()
    }
}

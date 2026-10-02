import Foundation

/// Files shared with the Electron app (`electron/main.ts`), so both apps read and write the same
/// OpenChamber config, Ember settings and model stats.
public struct EmberPaths: Sendable, Equatable {
  public var openchamberSettings: URL
  public var emberSettings: URL
  public var modelStats: URL

  public init(
    home: URL = FileManager.default.homeDirectoryForCurrentUser,
    environment: [String: String] = ProcessInfo.processInfo.environment
  ) {
    let config = home.appending(path: ".config", directoryHint: .isDirectory)
    if let dataDir = environment["OPENCHAMBER_DATA_DIR"], !dataDir.isEmpty {
      openchamberSettings = URL(filePath: dataDir, directoryHint: .isDirectory)
        .appending(path: "settings.json")
    } else {
      openchamberSettings = config.appending(path: "openchamber/settings.json")
    }
    emberSettings = config.appending(path: "ember/settings.json")
    modelStats = config.appending(path: "ember/model-stats.json")
  }
}

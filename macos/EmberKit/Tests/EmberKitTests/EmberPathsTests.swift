import Foundation
import Testing

@testable import EmberKit

struct EmberPathsTests {
  let home = URL(filePath: "/Users/test", directoryHint: .isDirectory)

  @Test func defaultsMatchElectron() {
    let paths = EmberPaths(home: home, environment: [:])
    #expect(paths.openchamberSettings.path == "/Users/test/.config/openchamber/settings.json")
    #expect(paths.emberSettings.path == "/Users/test/.config/ember/settings.json")
    #expect(paths.modelStats.path == "/Users/test/.config/ember/model-stats.json")
  }

  @Test func honoursOpenchamberDataDir() {
    let paths = EmberPaths(home: home, environment: ["OPENCHAMBER_DATA_DIR": "/srv/oc"])
    #expect(paths.openchamberSettings.path == "/srv/oc/settings.json")
    #expect(paths.emberSettings.path == "/Users/test/.config/ember/settings.json")
  }

  @Test func ignoresEmptyDataDir() {
    let paths = EmberPaths(home: home, environment: ["OPENCHAMBER_DATA_DIR": ""])
    #expect(paths.openchamberSettings.path == "/Users/test/.config/openchamber/settings.json")
  }
}

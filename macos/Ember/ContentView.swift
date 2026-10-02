import EmberKit
import SwiftUI

struct ContentView: View {
  private let paths = EmberPaths()

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Ember").font(.largeTitle.bold())
      Text("Native macOS client — scaffold").foregroundStyle(.secondary)
      Divider()
      PathRow(label: "OpenChamber settings", url: paths.openchamberSettings)
      PathRow(label: "Ember settings", url: paths.emberSettings)
      PathRow(label: "Model stats", url: paths.modelStats)
    }
    .padding(32)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

private struct PathRow: View {
  let label: String
  let url: URL

  var body: some View {
    let exists = FileManager.default.fileExists(atPath: url.path)
    LabeledContent(label) {
      Label(url.path, systemImage: exists ? "checkmark.circle" : "questionmark.circle")
        .foregroundStyle(exists ? .primary : .secondary)
        .textSelection(.enabled)
    }
  }
}

#Preview {
  ContentView()
}

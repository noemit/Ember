#!/usr/bin/env bash
# Format lint + EmberKit tests + app build. Run before committing Swift changes.
set -euo pipefail
cd "$(dirname "$0")/.."

xcodegen generate --quiet
xcrun swift-format lint --strict --recursive EmberKit/Package.swift EmberKit/Sources EmberKit/Tests Ember
swift test --package-path EmberKit
xcodebuild -project Ember.xcodeproj -scheme Ember -configuration Debug \
  -destination "platform=macOS,arch=$(uname -m)" -derivedDataPath build/DerivedData -quiet build

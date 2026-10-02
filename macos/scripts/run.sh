#!/usr/bin/env bash
# Build the Debug app and launch it.
set -euo pipefail
cd "$(dirname "$0")/.."

xcodegen generate --quiet
xcodebuild -project Ember.xcodeproj -scheme Ember -configuration Debug \
  -destination "platform=macOS,arch=$(uname -m)" -derivedDataPath build/DerivedData -quiet build
open build/DerivedData/Build/Products/Debug/Ember.app

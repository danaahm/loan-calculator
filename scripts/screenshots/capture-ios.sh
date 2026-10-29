#!/usr/bin/env bash
# Takes the App Store screenshots on one iOS simulator.
#
#   APP_PATH=<built .app> scripts/screenshots/capture-ios.sh <device regex> <output dir>
#
# Picks the newest available simulator whose name matches the regex, gives it
# Apple's marketing status bar (9:41, full battery), installs the app, writes
# the sample data from seed.mjs straight into AsyncStorage, and runs the
# Maestro tour, which saves each screen into the output directory.
set -euo pipefail

pattern=$1
out=$2
bundle=com.danaa.loancalculator
here=$(cd "$(dirname "$0")" && pwd)

# Newest runtime first, then the highest model number among matching names.
udid=$(xcrun simctl list devices available -j | node -e '
  const re = new RegExp(`^${process.argv[1]}`);
  const { devices } = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const version = (runtime) => (runtime.match(/iOS-([\d-]+)$/)?.[1] ?? "0").split("-").map(Number);
  const newer = (a, b) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if ((a[i] ?? 0) !== (b[i] ?? 0)) return (b[i] ?? 0) - (a[i] ?? 0);
    }
    return 0;
  };
  const found = Object.entries(devices)
    .filter(([runtime]) => runtime.includes("SimRuntime.iOS-"))
    .flatMap(([runtime, list]) => list.map((d) => ({ ...d, version: version(runtime) })))
    .filter((d) => re.test(d.name))
    .sort((a, b) => newer(a.version, b.version) || b.name.localeCompare(a.name, "en", { numeric: true }));
  if (found.length === 0) {
    console.error(`No available simulator matches ${re}`);
    process.exit(1);
  }
  console.error(`Using ${found[0].name} (iOS ${found[0].version.join(".")})`);
  console.log(found[0].udid);
' "$pattern")

xcrun simctl boot "$udid" 2>/dev/null || true
xcrun simctl bootstatus "$udid" -b
xcrun simctl ui "$udid" appearance light
xcrun simctl status_bar "$udid" override \
  --time "9:41" \
  --dataNetwork wifi --wifiMode active --wifiBars 3 \
  --cellularMode active --cellularBars 4 \
  --batteryState charged --batteryLevel 100

xcrun simctl install "$udid" "$APP_PATH"

# AsyncStorage on iOS keeps every key in this manifest, so writing it before
# the first launch is the same as the app having saved the data itself.
data=$(xcrun simctl get_app_container "$udid" "$bundle" data)
storage="$data/Library/Application Support/$bundle/RCTAsyncLocalStorage_V1"
mkdir -p "$storage"
node "$here/seed.mjs" > "$storage/manifest.json"

mkdir -p "$out"
maestro --device "$udid" test --env OUT="$PWD/$out" "$here/tour.yaml"

xcrun simctl shutdown "$udid"
ls -l "$out"

// The app locks to portrait ("orientation": "portrait" in app.json), which
// writes android:screenOrientation="portrait" onto the main activity. Google
// Play reads that as an implied requirement for the
// android.hardware.screen.portrait feature and filters the app away from
// devices that don't report it (some tablets, Chromebooks, Android XR), and
// Play Console flags it when a release is sent for review.
//
// The app works in either orientation, so declare the feature optional. The
// orientation lock itself is unchanged.
const { withAndroidManifest } = require('expo/config-plugins');

const FEATURE = 'android.hardware.screen.portrait';

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const features = (manifest['uses-feature'] ??= []);
    const existing = features.find((f) => f.$?.['android:name'] === FEATURE);
    if (existing) {
      existing.$['android:required'] = 'false';
    } else {
      features.push({ $: { 'android:name': FEATURE, 'android:required': 'false' } });
    }
    return config;
  });
};

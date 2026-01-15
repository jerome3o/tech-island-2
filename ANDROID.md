# Android App

Tech Island is available as a native Android app built using Trusted Web Activities (TWA). This wraps the PWA in a native Android container, providing better notification support and a more native experience.

## Download

The Android APK is automatically built on every push to `main` via GitHub Actions.

**To download the APK:**

1. Go to the [Actions tab](https://github.com/jerome3o/tech-island-2/actions)
2. Click on the latest "Build Android APK" workflow run
3. Scroll down to "Artifacts" section
4. Download `tech-island-apk`
5. Extract the ZIP and install the APK on your Android device

## Installation

1. Download the APK as described above
2. Transfer it to your Android device (via USB, email, etc.)
3. Open the APK file on your device
4. You may need to enable "Install from unknown sources" in Settings
5. Follow the installation prompts
6. Launch "Tech Island" from your app drawer

## Notifications

The Android app supports full push notifications, unlike the PWA which has limited support on Android Chrome. Notifications will work properly once the app is installed.

## Building Locally

If you want to build the APK yourself:

```bash
# Install Bubblewrap CLI
npm install -g @bubblewrap/cli

# Generate a debug keystore (if you don't have one)
keytool -genkey -v -keystore android.keystore -alias android \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass android -keypass android \
  -dname "CN=Tech Island, OU=Development, O=Towerhouse, L=London, ST=London, C=UK"

# Initialize the TWA project
bubblewrap init --manifest twa-manifest.json

# Build the APK
bubblewrap build
```

The APK will be output in the current directory.

## Configuration

The TWA configuration is in `twa-manifest.json`. Key settings:

- **Package ID**: `london.towerhouse.app`
- **Host**: `app.towerhouse.london`
- **Notifications**: Enabled
- **Min SDK**: 21 (Android 5.0+)
- **Target SDK**: 34 (Android 14)

## Production Release

For production releases to Google Play Store:

1. Create a proper release keystore (not the debug one)
2. Update `twa-manifest.json` with the new keystore path
3. Add your keystore credentials as GitHub Secrets:
   - `ANDROID_KEYSTORE_BASE64` - Base64 encoded keystore file
   - `ANDROID_KEYSTORE_PASSWORD` - Keystore password
   - `ANDROID_KEY_ALIAS` - Key alias
   - `ANDROID_KEY_PASSWORD` - Key password
4. Update the GitHub Actions workflow to use the release keystore
5. Follow [Google's TWA documentation](https://developer.chrome.com/docs/android/trusted-web-activity/) for Play Store submission

## Troubleshooting

**APK won't install**: Make sure you've enabled "Install from unknown sources" in your Android settings.

**Notifications not working**: Check that notification permissions are granted in app settings.

**App shows "Site not available"**: Ensure `app.towerhouse.london` is accessible from your device.

## Future: Self-Hosted APK

In the future, the APK will be served directly from the app at `/android/download` so users can easily install it without GitHub.

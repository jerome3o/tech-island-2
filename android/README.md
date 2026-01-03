# Android API Demo

A demonstration Android app showcasing various Android APIs and capabilities.

## Features

This app demonstrates the following Android APIs:

- 📷 **Camera** - Camera hardware information and capabilities
- 📍 **Location/GPS** - Location services and GPS positioning
- 📱 **Sensors** - Device sensors (accelerometer, gyroscope, light sensor, etc.)
- 🔔 **Notifications** - Push notifications and notification channels
- 💾 **Storage** - File system operations and storage info
- 📊 **Device Info** - Hardware and software information
- 📳 **Vibration** - Vibration patterns and haptic feedback
- 🌐 **Network/HTTP** - Network connectivity and HTTP requests

## Building

### Prerequisites

- JDK 17 or later
- Android SDK (API 34)
- Gradle 8.4

### Build locally

```bash
cd android
./gradlew assembleDebug
```

The APK will be generated at: `app/build/outputs/apk/debug/app-debug.apk`

### Build in CI

The app automatically builds in GitHub Actions when changes are pushed to the `android/` directory.

To download the APK:
1. Go to the Actions tab in GitHub
2. Find the latest "Android Build" workflow run
3. Download the `android-api-demo-debug` artifact
4. Extract the ZIP file to get the APK

## Installing on Android

### Method 1: Download from GitHub Actions

1. Download the APK artifact from GitHub Actions (see above)
2. Transfer the APK to your Android device
3. Enable "Install from Unknown Sources" in your device settings
4. Open the APK file and install

### Method 2: ADB Install

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

## Permissions

The app requests the following permissions to demonstrate various APIs:

- Camera
- Location (Fine and Coarse)
- Vibrate
- Internet
- Post Notifications (Android 13+)
- Bluetooth
- WiFi State
- Record Audio

All permissions are requested at runtime when you try to use the corresponding feature.

## Requirements

- **Minimum SDK:** API 24 (Android 7.0)
- **Target SDK:** API 34 (Android 14)
- **Compile SDK:** API 34

## Project Structure

```
android/
├── app/
│   ├── src/main/
│   │   ├── java/com/techisland/apidemo/
│   │   │   ├── MainActivity.java          # Main activity with demo list
│   │   │   ├── CameraActivity.java        # Camera demo
│   │   │   ├── LocationActivity.java      # Location demo
│   │   │   ├── SensorActivity.java        # Sensor demo
│   │   │   ├── NotificationActivity.java  # Notification demo
│   │   │   ├── StorageActivity.java       # Storage demo
│   │   │   ├── DeviceInfoActivity.java    # Device info demo
│   │   │   ├── VibrateActivity.java       # Vibration demo
│   │   │   └── NetworkActivity.java       # Network demo
│   │   ├── res/
│   │   │   ├── layout/                    # XML layouts
│   │   │   └── values/                    # Strings and resources
│   │   └── AndroidManifest.xml
│   └── build.gradle
├── build.gradle
├── settings.gradle
└── gradlew
```

## License

This is a demo application for educational purposes.

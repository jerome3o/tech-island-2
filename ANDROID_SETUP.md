# Android App Setup Instructions

Due to limitations with Bubblewrap's CLI (interactive prompts that can't be automated), we need to generate the Android project structure once and commit it to the repository.

## Option 1: Using PWABuilder (Recommended - Easiest)

1. Go to [PWABuilder.com](https://www.pwabuilder.com/)
2. Enter your PWA URL: `https://app.towerhouse.london`
3. Click "Start" and let it analyze your PWA
4. Click on the "Android" platform tab
5. Configure your app settings (they should auto-fill from your manifest)
6. Click "Generate Package"
7. Download the generated package
8. Extract the ZIP file
9. Copy the contents to `/home/user/tech-island-2/android/` in this repo
10. Commit and push the `android/` directory

## Option 2: Using Bubblewrap CLI Locally

If you prefer using Bubblewrap on your local machine:

```bash
# Install Bubblewrap CLI
npm install -g @bubblewrap/cli

# Generate the Android project (this will be interactive)
bubblewrap init --manifest=https://app.towerhouse.london/manifest.json --directory=android

# Answer the prompts:
# - JDK installation: Choose "No" if you have JDK 17 installed, or "Yes" to let it install
# - Provide your JDK path if you said "No"
# - Android SDK: Let it auto-detect or provide the path

# The android/ directory is now created
# Commit it to the repo
git add android/
git commit -m "Add Android TWA project structure"
git push
```

## After Setup

Once the `android/` directory is committed:

1. The GitHub Actions workflow (`.github/workflows/build-android.yml`) will automatically build the APK on every push
2. Download the APK from the Actions artifacts
3. Install it on your Android device

## Why This Approach?

Bubblewrap's `init` command has interactive prompts that cannot be bypassed via command-line flags or environment variables, making it impossible to run in CI/CD. This is a [known limitation](https://github.com/GoogleChromeLabs/bubblewrap/issues/806).

By generating the project once and committing it, we:
- Avoid the interactive prompt problem
- Follow standard Android development practices (committed project structure)
- Enable automated builds in CI
- Can still update the project by running `bubblewrap update` locally when needed

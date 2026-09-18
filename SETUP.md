# Market Calculator - Setup Guide

This guide explains how to set up and run the Market Calculator Android app on a new Windows computer.

## 1. Project Information

- App Name: Market Calculator
- Android Package: com.deva.marketcalculator
- Framework: React Native + Expo
- Repository: https://github.com/Dnikalje001/market-calculator-app
- Repository Visibility: Private

## 2. Working Environment Versions

The following versions are confirmed working with this project:

- Node.js: v24.20.0
- pnpm: 11.25.0
- Java / OpenJDK: 21.0.12.1 LTS
- Android Studio: Quail 4 | 2026.1.4

## 3. Required Software

Install the following on the new Windows computer:

1. Git for Windows
2. Node.js v24.20.0
3. pnpm 11.25.0
4. Java / OpenJDK 21 LTS
5. Android Studio
6. Android SDK and required Android build tools

## 4. Clone the Private GitHub Repository

Open PowerShell and go to the folder where you want to keep the project.

Example:

    cd C:\

Clone the repository:

    git clone https://github.com/Dnikalje001/market-calculator-app.git

Then enter the project folder:

    cd C:\market-calculator-app

GitHub authentication may be required because this is a private repository.

## 5. Install Project Dependencies

From the project root:

    pnpm.cmd install

If normal `pnpm` works in PowerShell, this can also be used:

    pnpm install

The project uses:

    pnpm-workspace.yaml

with the hoisted node linker configuration required by the current working setup.

## 6. Open Project in Android Studio

Open Android Studio.

Open this folder:

    C:\market-calculator-app\android

Allow Gradle sync to complete.

Make sure Android SDK and Java/JDK are configured correctly.

## 7. Development Build

Connect an Android phone using USB and enable USB Debugging.

Check the connected device:

    & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices

From the project root:

    cd C:\market-calculator-app

Run:

    npx expo run:android

For Metro development server:

    npx expo start --dev-client --clear

If required, enable ADB reverse:

    & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:8081 tcp:8081

## 8. Build Release APK

Do not run `gradlew clean` unless required.

Go to:

    cd C:\market-calculator-app\android

Build the release APK:

    .\gradlew assembleRelease

After a successful build, the APK will be located at:

    C:\market-calculator-app\android\app\build\outputs\apk\release\app-release.apk

## 9. Install Release APK Using USB

With the Android phone connected:

    & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r "C:\market-calculator-app\android\app\build\outputs\apk\release\app-release.apk"

Expected result:

    Success

After installation, the release app can run normally without USB or the computer.

## 10. Save Future Changes to GitHub

After making and testing changes:

    git status

Then:

    git add .

Create a commit:

    git commit -m "Describe the changes here"

Upload the changes:

    git push

Always test important changes before committing and pushing them to GitHub.

## 11. Important Notes

- Do not upload `node_modules` to GitHub.
- Do not upload temporary build folders.
- `.gitignore` handles these unnecessary files.
- Keep the GitHub repository Private.
- The APK alone is not a replacement for the source code.
- GitHub contains the source code required for future development.
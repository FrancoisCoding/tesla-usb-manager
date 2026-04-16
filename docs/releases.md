# Releases and Downloads

This page explains how users download Tesla USB Manager and how maintainers
publish clean GitHub Releases with installable Windows assets.

## For Users

Use GitHub Releases when you want to install the app without a development
environment. Release installers include the desktop app, Tauri runtime bundle,
and FFmpeg sidecars used for audio conversion.

You do not need:

- Node.js
- Rust
- Tauri CLI
- A local frontend dev server
- Separate FFmpeg or FFprobe executables

## Which Asset to Download

| Asset | Use it when | Notes |
| --- | --- | --- |
| `.exe` installer | You are installing on your own Windows PC | Recommended for most users. |
| `.msi` package | You need managed Windows deployment | Useful for IT-managed installs. |
| `windows-portable.zip` | You want a portable folder instead of an installer | Keep the app and sidecars together after extraction. |
| `.sha256` file | You want to verify a download | Match it to the installer file name. |

Download from the **Assets** section of the latest GitHub Release. The release
body is intentionally short: download choice, install steps, included runtime
components, and checksum verification.

## Install Steps

1. Open the latest release on GitHub.
2. Download either the Windows `.exe` installer or the portable ZIP from **Assets**.
3. If you chose the installer, run it and follow the Windows prompts.
4. If you chose the portable ZIP, extract it and keep the included files together.
5. Launch Tesla USB Manager.
6. Insert a USB drive and complete Step 1 before using Marketplace.

Windows SmartScreen may warn on unsigned community builds. Confirm that the
installer came from this repository's release assets before continuing.

Portable ZIP builds also require Microsoft Edge WebView2 Runtime to already be
installed on Windows.

## Verify a Download

Each release publishes a `.sha256` file next to every installer and ZIP asset.
On Windows, compare the downloaded file hash with PowerShell:

```powershell
Get-FileHash ".\Tesla USB Manager*.exe" -Algorithm SHA256
Get-FileHash ".\Tesla-USB-Manager-*-windows-portable.zip" -Algorithm SHA256
```

The hash value should match the first value inside the matching `.sha256` file.

## What the Installer Includes

Release builds package:

- Tesla USB Manager desktop app.
- Production Vite frontend from `dist/`.
- Tauri Windows runtime bundle.
- `ffmpeg-x86_64-pc-windows-msvc.exe`.
- `ffprobe-x86_64-pc-windows-msvc.exe`.
- Portable ZIP containing `tesla-usb-manager.exe`, `ffmpeg.exe`, `ffprobe.exe`,
  and a small README.

The FFmpeg sidecars are required for audio conversion and Marketplace install
flows. They are downloaded during the GitHub Release workflow and copied into
`src-tauri/binaries` with Tauri's target-specific naming convention.

## Publishing a Release

Use semantic version tags. The release workflow runs only when a tag matching
`v*.*.*` is pushed.

1. Update versions in:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`
2. Run local verification:

```bash
npm test
npm run build
```

3. Create and push the tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

4. Watch the **Release** workflow in GitHub Actions.
5. Open the generated GitHub Release and confirm that Assets contains:
   - A Windows `.exe` installer.
   - A Windows `.msi` package.
   - A Windows portable `.zip`.
   - Matching `.sha256` files.

## Release Workflow

The workflow in `.github/workflows/release.yml` performs these steps:

1. Checks out the repository.
2. Installs Node.js 20 and the stable Rust toolchain.
3. Runs `npm ci`.
4. Downloads the Windows FFmpeg essentials archive.
5. Copies `ffmpeg.exe` and `ffprobe.exe` to Tauri sidecar names.
6. Runs `npm test`.
7. Builds NSIS and MSI installers with `npm run tauri build`.
8. Copies installer assets into `release-assets/`.
9. Builds a portable ZIP from the release executable and sidecars.
10. Generates SHA-256 checksum files.
11. Publishes a GitHub Release with a clean install-focused body.

## Clean Release Page Standard

Every release page should answer five questions quickly:

- **What do I download?** Use the `.exe` installer unless you specifically want the portable ZIP or need MSI.
- **What is included?** App, runtime bundle, FFmpeg, and FFprobe.
- **What do I need locally?** Nothing beyond Windows and a USB drive.
- **What if I want portable?** Extract the ZIP and keep the sidecars next to the app executable.
- **How do I verify it?** Compare the installer hash with the `.sha256` file.

Avoid putting maintainer-only implementation detail at the top of the GitHub
Release body. Keep detailed publishing notes in this document instead.

## Troubleshooting Releases

If no installer assets are created, check the Tauri build logs for missing
Windows bundler dependencies or sidecar naming errors.

If audio conversion fails in an installed build, confirm that the Release
workflow copied both target-specific sidecars before packaging.

If the Release workflow fails while downloading FFmpeg, retry the workflow after
confirming the upstream archive URL is still available.

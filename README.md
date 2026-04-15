# Tesla USB Manager

Tesla USB Manager is a desktop utility for preparing Tesla-compatible USB
drives and installing Marketplace media. It guides users through drive setup
first, then unlocks audio and light show installation once the selected drive
has the expected Tesla folders.

## Download

Most users do not need Node.js, Rust, the Tauri CLI, or separate executable
dependencies. Download the latest Windows installer from the repository's
GitHub Releases page, run the `.exe`, and launch Tesla USB Manager from the
Start menu.

Release assets include:

- A Windows `.exe` installer for normal desktop installs.
- A Windows `.msi` package for managed deployment.
- SHA-256 checksum files for verifying downloads.
- Bundled FFmpeg and FFprobe sidecars for Marketplace audio conversion.

For the full download, verification, and publishing process, see
[`docs/releases.md`](docs/releases.md).

## What It Does

- Detects removable USB drives and shows capacity, filesystem, and mount path.
- Creates the expected Tesla media folders: `TeslaCam`, `Sentry`, `Music`, and
  `LIGHTSHOW`.
- Keeps Marketplace disabled until Step 1 confirms the selected USB drive is
  ready.
- Installs Marketplace audio as either a horn sound or a lock chime.
- Imports custom audio files and converts them with FFmpeg for Tesla use.
- Installs `.tas` light show packages into the Tesla `LIGHTSHOW` folder.

## User Workflow

1. Insert the USB drive you want to prepare.
2. Open Tesla USB Manager and select the drive in Step 1.
3. Review the mount path, capacity, filesystem, and setup status.
4. Apply the Tesla folder layout if the drive is missing required folders.
5. Continue to Marketplace after the drive reports as configured.
6. Install Marketplace audio, custom audio, or light shows to the selected USB
   drive.

See [`docs/user-guide.md`](docs/user-guide.md) for detailed usage notes,
destination paths, and troubleshooting steps.

## Safety Notes

Tesla USB Manager writes folders and media files to the selected USB drive.
Always confirm the mount path before applying setup or installing media. Custom
horn sounds must comply with local traffic laws and should be used responsibly.

## Open Source

This repository is open source under the MIT License. See [`LICENSE`](LICENSE).

## Developer Prerequisites

You only need the following tools if you are building the app from source:

- Node.js 20+
- Rust stable toolchain
- Tauri prerequisites for your OS:
  <https://tauri.app/start/prerequisites/>

End users should install from GitHub Releases instead of setting up this
toolchain.

## Local Development

```bash
npm install
npm run tauri dev
```

The Tauri dev command starts the Vite frontend and launches the desktop shell.
Use this mode when working on Rust commands, USB drive detection, Marketplace
integration, or desktop-specific behavior.

## Frontend Build

```bash
npm run build
```

This validates TypeScript and writes the Vite production build to `dist/`.

## Tests

```bash
npm test
```

Vitest covers the frontend helpers for USB setup status, Marketplace filtering,
install destination mapping, audio processing helpers, and light show pipeline
behavior.

Rust tests can be run from the Tauri crate:

```bash
cd src-tauri
cargo test
```

## Release Builds

Release publishing is automated by `.github/workflows/release.yml`.

To publish a downloadable release:

1. Update the app version in `package.json`, `src-tauri/Cargo.toml`, and
   `src-tauri/tauri.conf.json`.
2. Run `npm test` and `npm run build`.
3. Create and push a semantic version tag, for example `v0.1.0`.
4. Wait for the Release workflow to build the Windows installer and publish
   GitHub Release assets.

The release workflow downloads Windows FFmpeg sidecars, builds NSIS and MSI
installers, generates checksums, and creates a clean GitHub Release body.

## Sidecar Setup

Tauri packages FFmpeg and FFprobe as sidecar binaries. Local release builds
must place target-specific binaries in `src-tauri/binaries` before packaging.
The GitHub Release workflow performs this setup automatically for Windows.

See [`src-tauri/binaries/README.md`](src-tauri/binaries/README.md) for naming
conventions and manual packaging details.

## Continuous Integration

GitHub Actions workflow: `.github/workflows/tauri-build.yml`

- Runs on `macos-latest` and `windows-latest`.
- Installs Node and Rust.
- Validates the frontend build.
- Validates Tauri compile with `--no-bundle`.

The compile workflow is intentionally lighter than release publishing. It
checks source health on pushes and pull requests without producing installer
assets.

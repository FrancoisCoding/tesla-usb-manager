# User Guide

This guide explains how to prepare a Tesla USB drive and install media with
Tesla USB Manager.

## Before You Start

You need:

- A Windows PC with Tesla USB Manager installed from GitHub Releases.
- A USB drive that you intend to use with your Tesla.
- Enough free space for dashcam, Sentry Mode, music, and light show files.
- Network access when loading Marketplace content.

Back up important files before preparing a drive. The app focuses on Tesla
folder setup and media installation, but you should still confirm the selected
drive before writing changes.

## Step 1: USB Setup

Step 1 detects removable USB drives and shows key information:

- Display name.
- Mount path.
- Capacity and free space.
- Recommended filesystem label.
- Tesla folder setup status.

Select the drive you want to use. If the app reports that required Tesla
folders are missing, choose **Format, Configure & Apply** and confirm the safety
prompt. The app creates the standard folders used by Tesla media features:

| Folder | Purpose |
| --- | --- |
| `TeslaCam/` | Dashcam recording storage. |
| `Sentry/` | Sentry Mode clip storage. |
| `Music/` | General audio storage. |
| `LIGHTSHOW/` | Light show package storage. |

When the folder check passes, the app enables Step 2: Marketplace.

## Step 2: Marketplace

Marketplace is locked until Step 1 confirms a Tesla-ready USB drive. The mount
path shown in Step 2 is read-only and comes from the selected drive in Step 1.

Use the top tabs to switch between:

- **Music** for Marketplace audio and custom audio installs.
- **Light Shows** for `.tas` light show packages.

## Installing Marketplace Audio

The Music tab lets you browse, search, preview, and install audio. When you
choose **Install**, the app asks where the audio should go:

| Target | Destination |
| --- | --- |
| Horn | `Boombox/Horn.wav` |
| Lock Chime | `LockChime/LockChime.wav` |

The app downloads the selected audio, converts it with FFmpeg, normalizes the
audio level, and writes the converted `.wav` file to the selected USB drive.

## Importing Custom Audio

Use **Import Custom Audio** when you already have a local audio file. Supported
source formats are:

- MP3
- WAV
- OGG
- FLAC

Drop the file into the upload area, choose **Horn** or **Lock Chime**, then
confirm the destination. The installed output is converted to Tesla-compatible
WAV settings.

Custom horn sounds must comply with local traffic laws. Avoid using sounds that
could be confused with emergency vehicles or other regulated signals.

## Installing Light Shows

The Light Shows tab handles Tesla `.tas` packages. The app checks that a package
contains required sequence and audio assets before installation. Valid light
show packages are copied to:

```text
LIGHTSHOW/<show-name>.tas
```

If a destination already exists, the install flow requires explicit overwrite
permission before replacing it.

## Troubleshooting

### No Drives Detected

Unplug and reinsert the USB drive, then choose **Refresh**. If the drive still
does not appear, confirm that Windows can see it in File Explorer.

### Marketplace Is Disabled

Marketplace stays disabled until Step 1 confirms the selected drive has the
expected Tesla folders. Complete USB setup first, or select a drive that is
already configured.

### Audio Install Fails

Check the error message shown on the audio card or custom import panel. Common
causes include unsupported file types, missing USB drive access, or a full
drive.

Installed release builds include FFmpeg and FFprobe. If you built locally, make
sure the sidecar binaries exist in `src-tauri/binaries` before packaging.

### Light Show Package Fails Inspection

The `.tas` archive must include a sequence file and companion audio. Re-download
the package or choose another light show if inspection reports missing assets.

### Windows Warns During Install

Unsigned community builds can trigger Windows SmartScreen. Verify that the
installer was downloaded from this repository's GitHub Releases page and compare
the SHA-256 checksum before continuing.

## File Destinations

Tesla USB Manager writes media to these paths relative to the selected USB
mount path:

| Feature | Relative path |
| --- | --- |
| Horn audio | `Boombox/Horn.wav` |
| Lock chime audio | `LockChime/LockChime.wav` |
| Light show packages | `LIGHTSHOW/<show-name>.tas` |
| Music folder | `Music/` |
| Dashcam folder | `TeslaCam/` |
| Sentry folder | `Sentry/` |

Review the mount path before confirming any operation that writes to the USB
drive.

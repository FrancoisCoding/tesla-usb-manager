# FFmpeg Sidecar Binaries

Tesla USB Manager uses FFmpeg and FFprobe as Tauri sidecars for audio
conversion and health checks. Release builds must include target-specific
sidecar files in this directory before packaging.

The Tauri config references the logical base names:

- `binaries/ffmpeg`
- `binaries/ffprobe`

Tauri resolves those names to target-suffixed files during packaging.

## Required Names

Use Tauri's target-specific sidecar naming convention:

| Platform | FFmpeg | FFprobe |
| --- | --- | --- |
| Windows x64 | `ffmpeg-x86_64-pc-windows-msvc.exe` | `ffprobe-x86_64-pc-windows-msvc.exe` |
| macOS Apple silicon | `ffmpeg-aarch64-apple-darwin` | `ffprobe-aarch64-apple-darwin` |
| macOS Intel | `ffmpeg-x86_64-apple-darwin` | `ffprobe-x86_64-apple-darwin` |

At runtime, Rust launches the sidecar by logical name, for example
`app.shell().sidecar("ffmpeg")`.

## GitHub Release Builds

The Release workflow downloads the Windows FFmpeg essentials archive, extracts
`ffmpeg.exe` and `ffprobe.exe`, and copies them to the Windows x64 sidecar names
before running `npm run tauri build`.

That means users who install from GitHub Releases do not need separate FFmpeg
executables.

## Local Packaging

For manual packaging, place the sidecars in this directory before running:

```bash
npm run tauri build -- --bundles nsis,msi
```

If the sidecars are missing or named incorrectly, Tauri packaging can fail, or
installed audio conversion can fail at runtime.

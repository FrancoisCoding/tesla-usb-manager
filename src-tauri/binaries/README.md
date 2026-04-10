# FFmpeg Sidecar Placeholders

Drop target-specific FFmpeg binaries here for release packaging.

The Tauri config references base names:

- `binaries/ffmpeg`
- `binaries/ffprobe`

Use target-suffixed files per Tauri sidecar conventions, for example:

- `ffmpeg-x86_64-pc-windows-msvc.exe`
- `ffprobe-x86_64-pc-windows-msvc.exe`
- `ffmpeg-aarch64-apple-darwin`
- `ffprobe-aarch64-apple-darwin`

At runtime, Rust launches the sidecar by logical name (`ffmpeg`).

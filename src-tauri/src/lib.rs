use serde::{Deserialize, Serialize};
use std::{
    fs,
    fs::File,
    io::{Read, Seek},
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri_plugin_shell::ShellExt;
use zip::ZipArchive;
mod marketplace;
mod usb;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SystemHealth {
    platform: String,
    ffmpeg_sidecar: String,
    ffprobe_sidecar: String,
    notes: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
enum AudioTarget {
    LockChime,
    Horn,
}

impl AudioTarget {
    fn converted_file_name(&self) -> &'static str {
        match self {
            Self::LockChime => "LockChime.wav",
            Self::Horn => "Horn.wav",
        }
    }

    fn install_relative_path(&self) -> PathBuf {
        match self {
            Self::LockChime => PathBuf::from("LockChime.wav"),
            Self::Horn => PathBuf::from("Boombox").join("Horn.wav"),
        }
    }

    fn slug(&self) -> &'static str {
        match self {
            Self::LockChime => "lock-chime",
            Self::Horn => "horn",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AudioPipelineRequest {
    source_path: String,
    usb_mount_path: String,
    target: AudioTarget,
    normalize: bool,
    ffmpeg_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AudioPipelineResult {
    source_path: String,
    converted_path: String,
    installed_path: String,
    ffmpeg_args: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TasInspectionRequest {
    source_path: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TasInspectionResult {
    source_path: String,
    show_name: String,
    entry_count: usize,
    entries: Vec<String>,
    total_uncompressed_bytes: u64,
    has_sequence_file: bool,
    has_audio_file: bool,
    has_matching_show_pair: bool,
    has_preview_video: bool,
    warnings: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LightShowInstallRequest {
    source_path: String,
    usb_mount_path: String,
    show_name: Option<String>,
    overwrite_existing: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LightShowInstallResult {
    source_path: String,
    installed_path: String,
    show_name: String,
    overwritten: bool,
    inspection: TasInspectionResult,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistUploadedAudioRequest {
    file_name: String,
    bytes: Vec<u8>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PersistUploadedAudioResult {
    source_path: String,
    file_name: String,
    size_bytes: usize,
}

fn current_platform() -> String {
    format!("{}-{}", std::env::consts::ARCH, std::env::consts::OS)
}

fn expected_sidecar_name(base: &str) -> String {
    let extension = if cfg!(target_os = "windows") {
        ".exe"
    } else {
        ""
    };
    format!("{base}{}", extension)
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn sanitize_audio_file_name(raw: &str) -> String {
    let mut output = String::with_capacity(raw.len());

    for char in raw.chars() {
        if char.is_ascii_alphanumeric() || char == '.' || char == '-' || char == '_' {
            output.push(char);
        } else if char.is_whitespace() {
            output.push('_');
        }

        if output.len() >= 96 {
            break;
        }
    }

    output.trim_matches('.').trim_matches('_').to_string()
}

fn validate_supported_audio_extension(file_name: &str) -> Result<(), String> {
    let extension = Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| "Audio file name must include an extension.".to_string())?;

    let allowed = ["mp3", "wav", "ogg", "flac"];
    if allowed.contains(&extension.as_str()) {
        Ok(())
    } else {
        Err("Supported formats: MP3, WAV, OGG, FLAC.".to_string())
    }
}

fn build_temp_audio_path(prefix: &str, file_name: &str) -> Result<PathBuf, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("System clock error: {error}"))?
        .as_millis();

    let safe_file_name = sanitize_audio_file_name(file_name);
    if safe_file_name.is_empty() {
        return Err("Audio file name could not be sanitized.".to_string());
    }

    validate_supported_audio_extension(&safe_file_name)?;

    let folder = std::env::temp_dir().join("tesla-usb-manager").join(prefix);
    fs::create_dir_all(&folder)
        .map_err(|error| format!("Failed to create temporary folder: {error}"))?;
    Ok(folder.join(format!("{timestamp}-{safe_file_name}")))
}

fn validate_source_audio(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!(
            "Source audio file was not found: {}",
            path_to_string(path)
        ));
    }

    if !path.is_file() {
        return Err(format!(
            "Source path is not a file: {}",
            path_to_string(path)
        ));
    }

    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| "Source file must include an extension.".to_string())?;

    let supported = ["mp3", "wav", "ogg", "flac"];
    if !supported.contains(&extension.as_str()) {
        return Err(
            "Unsupported source format. Supported formats: MP3, WAV, OGG, FLAC.".to_string(),
        );
    }

    Ok(())
}

fn validate_source_lightshow_package(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!(
            "Source light show file was not found: {}",
            path_to_string(path)
        ));
    }

    if !path.is_file() {
        return Err(format!(
            "Source light show path is not a file: {}",
            path_to_string(path)
        ));
    }

    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| "Source file must include an extension.".to_string())?;

    if extension != "tas" && extension != "zip" {
        return Err(
            "Unsupported source format. Only .tas and .zip files are supported.".to_string(),
        );
    }

    Ok(())
}

fn sanitize_show_name(raw: &str) -> String {
    let mut value = String::with_capacity(raw.len());
    let mut last_was_separator = false;

    for char in raw.chars() {
        if char.is_ascii_alphanumeric() {
            value.push(char);
            last_was_separator = false;
        } else if !last_was_separator {
            value.push('_');
            last_was_separator = true;
        }

        if value.len() >= 64 {
            break;
        }
    }

    let trimmed = value.trim_matches('_').to_string();
    if trimmed.is_empty() {
        "LightShow".to_string()
    } else {
        trimmed
    }
}

fn derive_show_name_from_path(path: &Path) -> String {
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("LightShow");
    sanitize_show_name(stem)
}

fn is_lightshow_audio_extension(extension: &str) -> bool {
    extension == "mp3" || extension == "wav"
}

fn entry_file_stem(name: &str) -> Option<String> {
    Path::new(name)
        .file_stem()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string())
}

fn entry_file_extension(name: &str) -> Option<String> {
    Path::new(name)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
}

fn find_lightshow_pair<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
) -> Result<(String, String, String), String> {
    let mut sequences = Vec::new();
    let mut audio_files = Vec::new();

    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|error| format!("Failed to inspect light show package entry: {error}"))?;
        if entry.is_dir() {
            continue;
        }

        let name = entry.name().to_string();
        let stem = match entry_file_stem(&name) {
            Some(value) if !value.is_empty() => value,
            _ => continue,
        };
        let extension = match entry_file_extension(&name) {
            Some(value) => value,
            None => continue,
        };

        if extension == "fseq" {
            sequences.push((stem, name));
        } else if is_lightshow_audio_extension(&extension) {
            audio_files.push((stem, name, extension));
        }
    }

    for (sequence_stem, sequence_name) in sequences {
        if let Some((_, audio_name, audio_extension)) = audio_files
            .iter()
            .find(|(audio_stem, _, _)| audio_stem == &sequence_stem)
        {
            return Ok((sequence_name, audio_name.clone(), audio_extension.clone()));
        }
    }

    Err("Light show package must contain matching .fseq and .mp3/.wav files.".to_string())
}

fn read_tas_inspection(source_path: &Path) -> Result<TasInspectionResult, String> {
    let file = File::open(source_path)
        .map_err(|error| format!("Failed to open light show package: {error}"))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| format!("The light show package is invalid or corrupted: {error}"))?;

    if archive.len() == 0 {
        return Err("The light show package is empty and cannot be installed.".to_string());
    }

    let mut has_sequence_file = false;
    let mut has_audio_file = false;
    let mut has_preview_video = false;
    let mut entries = Vec::with_capacity(archive.len());
    let mut total_uncompressed_bytes = 0_u64;

    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|error| format!("Failed to inspect .tas archive entry: {error}"))?;
        let name = entry.name().to_string();
        let lower_name = name.to_ascii_lowercase();
        total_uncompressed_bytes = total_uncompressed_bytes.saturating_add(entry.size());

        if lower_name.ends_with(".fseq") {
            has_sequence_file = true;
        }
        if lower_name.ends_with(".mp3") || lower_name.ends_with(".wav") {
            has_audio_file = true;
        }
        if lower_name.ends_with(".mp4") || lower_name.ends_with(".webm") {
            has_preview_video = true;
        }

        entries.push(name);
    }

    let has_matching_show_pair = find_lightshow_pair(&mut archive).is_ok();
    let mut warnings = Vec::new();
    if !has_sequence_file {
        warnings.push("No .fseq sequence file was found in the light show package.".to_string());
    }
    if !has_audio_file {
        warnings.push(
            "No companion audio file (.mp3/.wav) was found in the light show package.".to_string(),
        );
    }
    if !has_matching_show_pair {
        warnings.push("The .fseq file name must match a .mp3 or .wav file name.".to_string());
    }

    Ok(TasInspectionResult {
        source_path: path_to_string(source_path),
        show_name: derive_show_name_from_path(source_path),
        entry_count: entries.len(),
        entries,
        total_uncompressed_bytes,
        has_sequence_file,
        has_audio_file,
        has_matching_show_pair,
        has_preview_video,
        warnings,
    })
}

fn lightshow_folder_path(usb_mount_path: &Path) -> PathBuf {
    usb_mount_path.join("LightShow")
}

fn validate_lightshow_usb_root(usb_mount_path: &Path) -> Result<(), String> {
    if usb_mount_path.join("TeslaCam").exists() {
        return Err(
            "Tesla Light Show USB drives must not contain a base-level TeslaCam folder."
                .to_string(),
        );
    }

    for entry in fs::read_dir(usb_mount_path)
        .map_err(|error| format!("Failed to inspect USB root: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Failed to inspect USB root entry: {error}"))?;
        let file_name = entry.file_name().to_string_lossy().to_ascii_lowercase();
        let suspicious_update_file = file_name.contains("firmware")
            || file_name.contains("map")
            || file_name.contains("update");
        if entry.path().is_file() && suspicious_update_file {
            return Err(
                "Tesla Light Show USB drives must not contain map or firmware update files."
                    .to_string(),
            );
        }
    }

    Ok(())
}

fn build_lightshow_install_paths(
    usb_mount_path: &Path,
    show_name: &str,
    audio_extension: &str,
) -> (PathBuf, PathBuf) {
    let lightshow_dir = lightshow_folder_path(usb_mount_path);
    (
        lightshow_dir.join(format!("{show_name}.fseq")),
        lightshow_dir.join(format!("{show_name}.{audio_extension}")),
    )
}

fn build_ffmpeg_args(
    input: &Path,
    output: &Path,
    normalize: bool,
    target: &AudioTarget,
) -> Vec<String> {
    let mut args = vec!["-y".to_string(), "-i".to_string(), path_to_string(input)];

    if matches!(target, AudioTarget::LockChime) {
        args.push("-t".to_string());
        args.push("5".to_string());
    }

    if normalize {
        args.push("-af".to_string());
        args.push("loudnorm=I=-16:TP=-1.5:LRA=11".to_string());
    }

    args.push("-ac".to_string());
    args.push(
        if matches!(target, AudioTarget::LockChime) {
            "1"
        } else {
            "2"
        }
        .to_string(),
    );
    args.push("-ar".to_string());
    args.push("44100".to_string());
    args.push("-c:a".to_string());
    args.push("pcm_s16le".to_string());
    args.push(path_to_string(output));
    args
}

fn build_work_output_path(target: &AudioTarget) -> Result<PathBuf, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("System clock error: {error}"))?
        .as_millis();

    Ok(std::env::temp_dir()
        .join("tesla-usb-manager")
        .join(format!("{}-{timestamp}", target.slug()))
        .join(target.converted_file_name()))
}

fn run_ffmpeg(binary: &str, args: &[String]) -> Result<(), String> {
    let output = Command::new(binary)
        .args(args)
        .output()
        .map_err(|error| format!("Failed to run FFmpeg command '{binary}': {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let detail = if stderr.is_empty() {
            "No stderr output captured.".to_string()
        } else {
            stderr
        };

        return Err(format!(
            "FFmpeg exited with status {:?}. {}",
            output.status.code(),
            detail
        ));
    }

    Ok(())
}

#[tauri::command]
fn system_health() -> SystemHealth {
    SystemHealth {
        platform: current_platform(),
        ffmpeg_sidecar: expected_sidecar_name("ffmpeg"),
        ffprobe_sidecar: expected_sidecar_name("ffprobe"),
        notes: vec![
            "Place platform binaries in src-tauri/binaries before release builds.".into(),
            "Sidecars are packaged via tauri.conf.json bundle.externalBin.".into(),
        ],
    }
}

#[tauri::command]
async fn probe_ffmpeg_sidecar(app: tauri::AppHandle) -> Result<String, String> {
    let sidecar = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|error| format!("FFmpeg sidecar is not configured: {error}"))?;

    let output = sidecar
        .args(["-version"])
        .output()
        .await
        .map_err(|error| format!("Failed to execute ffmpeg sidecar: {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "FFmpeg sidecar exited with status {:?}",
            output.status.code()
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let first_line = stdout.lines().next().unwrap_or("ffmpeg sidecar responded");
    Ok(first_line.to_string())
}

#[tauri::command]
fn persist_uploaded_audio(
    request: PersistUploadedAudioRequest,
) -> Result<PersistUploadedAudioResult, String> {
    if request.bytes.is_empty() {
        return Err("Uploaded file is empty.".to_string());
    }

    let output_path = build_temp_audio_path("uploads", &request.file_name)?;
    fs::write(&output_path, &request.bytes)
        .map_err(|error| format!("Failed to persist uploaded audio file: {error}"))?;

    Ok(PersistUploadedAudioResult {
        source_path: path_to_string(&output_path),
        file_name: output_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("uploaded-audio.wav")
            .to_string(),
        size_bytes: request.bytes.len(),
    })
}

#[tauri::command]
fn process_audio_pipeline(request: AudioPipelineRequest) -> Result<AudioPipelineResult, String> {
    let source_path = PathBuf::from(&request.source_path);
    validate_source_audio(&source_path)?;

    let usb_mount_path = PathBuf::from(&request.usb_mount_path);
    if !usb_mount_path.exists() {
        return Err(format!(
            "USB mount path does not exist: {}",
            request.usb_mount_path
        ));
    }
    if !usb_mount_path.is_dir() {
        return Err(format!(
            "USB mount path is not a directory: {}",
            request.usb_mount_path
        ));
    }

    let converted_path = build_work_output_path(&request.target)?;
    if let Some(parent) = converted_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create temp output directory: {error}"))?;
    }

    let ffmpeg_binary = request.ffmpeg_path.as_deref().unwrap_or("ffmpeg");
    let ffmpeg_args = build_ffmpeg_args(
        &source_path,
        &converted_path,
        request.normalize,
        &request.target,
    );
    run_ffmpeg(ffmpeg_binary, &ffmpeg_args)?;

    let install_path = usb_mount_path.join(request.target.install_relative_path());
    if let Some(parent) = install_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to prepare Tesla destination directories: {error}"))?;
    }

    fs::copy(&converted_path, &install_path)
        .map_err(|error| format!("Failed to install converted audio to USB: {error}"))?;

    Ok(AudioPipelineResult {
        source_path: path_to_string(&source_path),
        converted_path: path_to_string(&converted_path),
        installed_path: path_to_string(&install_path),
        ffmpeg_args,
    })
}

#[tauri::command]
fn inspect_tas_file(request: TasInspectionRequest) -> Result<TasInspectionResult, String> {
    let source_path = PathBuf::from(&request.source_path);
    validate_source_lightshow_package(&source_path)?;
    read_tas_inspection(&source_path)
}

#[tauri::command]
fn install_lightshow(request: LightShowInstallRequest) -> Result<LightShowInstallResult, String> {
    let source_path = PathBuf::from(&request.source_path);
    validate_source_lightshow_package(&source_path)?;

    let usb_mount_path = PathBuf::from(&request.usb_mount_path);
    if !usb_mount_path.exists() {
        return Err(format!(
            "USB mount path does not exist: {}",
            request.usb_mount_path
        ));
    }
    if !usb_mount_path.is_dir() {
        return Err(format!(
            "USB mount path is not a directory: {}",
            request.usb_mount_path
        ));
    }
    validate_lightshow_usb_root(&usb_mount_path)?;

    let inspection = read_tas_inspection(&source_path)?;
    if !inspection.has_matching_show_pair {
        return Err(
            "Light show package is missing matching .fseq and .mp3/.wav files.".to_string(),
        );
    }

    let show_name = request
        .show_name
        .as_deref()
        .map(sanitize_show_name)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| inspection.show_name.clone());

    let file = File::open(&source_path)
        .map_err(|error| format!("Failed to open light show package: {error}"))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| format!("The light show package is invalid or corrupted: {error}"))?;
    let (sequence_entry, audio_entry, audio_extension) = find_lightshow_pair(&mut archive)?;
    let (sequence_path, audio_path) =
        build_lightshow_install_paths(&usb_mount_path, &show_name, &audio_extension);
    let lightshow_dir = lightshow_folder_path(&usb_mount_path);
    fs::create_dir_all(&lightshow_dir)
        .map_err(|error| format!("Failed to prepare LightShow destination: {error}"))?;

    let already_exists = sequence_path.exists() || audio_path.exists();
    if already_exists && !request.overwrite_existing {
        return Err(format!(
            "Destination already exists and overwrite is disabled: {}",
            path_to_string(&lightshow_dir)
        ));
    }

    let mut sequence_file = archive
        .by_name(&sequence_entry)
        .map_err(|error| format!("Failed to read .fseq from light show package: {error}"))?;
    let mut sequence_bytes = Vec::new();
    sequence_file
        .read_to_end(&mut sequence_bytes)
        .map_err(|error| format!("Failed to read .fseq content: {error}"))?;
    drop(sequence_file);

    let mut audio_file = archive
        .by_name(&audio_entry)
        .map_err(|error| format!("Failed to read audio from light show package: {error}"))?;
    let mut audio_bytes = Vec::new();
    audio_file
        .read_to_end(&mut audio_bytes)
        .map_err(|error| format!("Failed to read audio content: {error}"))?;

    fs::write(&sequence_path, sequence_bytes)
        .map_err(|error| format!("Failed to install .fseq file to USB: {error}"))?;
    fs::write(&audio_path, audio_bytes)
        .map_err(|error| format!("Failed to install light show audio to USB: {error}"))?;

    Ok(LightShowInstallResult {
        source_path: path_to_string(&source_path),
        installed_path: format!(
            "{} + {}",
            path_to_string(&sequence_path),
            path_to_string(&audio_path)
        ),
        show_name,
        overwritten: already_exists,
        inspection,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            system_health,
            probe_ffmpeg_sidecar,
            persist_uploaded_audio,
            process_audio_pipeline,
            inspect_tas_file,
            install_lightshow,
            marketplace::fetch_marketplace_catalog,
            marketplace::download_marketplace_audio,
            marketplace::fetch_lightshows,
            marketplace::download_install_lightshow,
            usb::list_usb_drives,
            usb::build_tesla_format_plan,
            usb::prepare_tesla_usb_layout
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Cursor, Write};
    use zip::write::SimpleFileOptions;

    fn build_zip(entries: &[(&str, &[u8])]) -> Vec<u8> {
        let cursor = Cursor::new(Vec::new());
        let mut writer = zip::ZipWriter::new(cursor);
        let options = SimpleFileOptions::default();

        for (name, bytes) in entries {
            writer.start_file(name, options).unwrap();
            writer.write_all(bytes).unwrap();
        }

        writer.finish().unwrap().into_inner()
    }

    #[test]
    fn finds_matching_lightshow_sequence_and_audio_pair() {
        let zip_bytes = build_zip(&[
            ("nested/show1.fseq", b"sequence"),
            ("nested/show1.wav", b"audio"),
            ("preview.mp4", b"preview"),
        ]);
        let cursor = Cursor::new(zip_bytes);
        let mut archive = ZipArchive::new(cursor).unwrap();

        let pair = find_lightshow_pair(&mut archive).unwrap();

        assert_eq!(
            pair,
            (
                "nested/show1.fseq".to_string(),
                "nested/show1.wav".to_string(),
                "wav".to_string(),
            )
        );
    }

    #[test]
    fn rejects_lightshow_package_without_matching_audio_stem() {
        let zip_bytes = build_zip(&[("show1.fseq", b"sequence"), ("show2.wav", b"audio")]);
        let cursor = Cursor::new(zip_bytes);
        let mut archive = ZipArchive::new(cursor).unwrap();

        let result = find_lightshow_pair(&mut archive);

        assert!(result.is_err());
    }

    #[test]
    fn rejects_lightshow_usb_root_with_teslacam_folder() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let base = std::env::temp_dir().join(format!("tesla_lightshow_root_{suffix}"));
        fs::create_dir_all(base.join("TeslaCam")).unwrap();

        let result = validate_lightshow_usb_root(&base);

        assert!(result.is_err());
        fs::remove_dir_all(base).unwrap();
    }
}

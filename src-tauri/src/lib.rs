use serde::{Deserialize, Serialize};
use std::{
    fs,
    fs::File,
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
            Self::LockChime => PathBuf::from("LockChime").join("LockChime.wav"),
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
        return Err("Unsupported source format. Supported formats: MP3, WAV, OGG, FLAC.".to_string());
    }

    Ok(())
}

fn validate_source_tas(path: &Path) -> Result<(), String> {
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

    if extension != "tas" {
        return Err("Unsupported source format. Only .tas files are supported.".to_string());
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

fn read_tas_inspection(source_path: &Path) -> Result<TasInspectionResult, String> {
    let file =
        File::open(source_path).map_err(|error| format!("Failed to open .tas file: {error}"))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| format!("The .tas file is invalid or corrupted: {error}"))?;

    if archive.len() == 0 {
        return Err("The .tas file is empty and cannot be installed.".to_string());
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
        if lower_name.ends_with(".mp3")
            || lower_name.ends_with(".wav")
            || lower_name.ends_with(".flac")
        {
            has_audio_file = true;
        }
        if lower_name.ends_with(".mp4") || lower_name.ends_with(".webm") {
            has_preview_video = true;
        }

        entries.push(name);
    }

    let mut warnings = Vec::new();
    if !has_sequence_file {
        warnings.push("No .fseq sequence file was found in the .tas archive.".to_string());
    }
    if !has_audio_file {
        warnings.push(
            "No companion audio file (.mp3/.wav/.flac) was found in the .tas archive.".to_string(),
        );
    }

    Ok(TasInspectionResult {
        source_path: path_to_string(source_path),
        show_name: derive_show_name_from_path(source_path),
        entry_count: entries.len(),
        entries,
        total_uncompressed_bytes,
        has_sequence_file,
        has_audio_file,
        has_preview_video,
        warnings,
    })
}

fn build_lightshow_install_path(usb_mount_path: &Path, show_name: &str) -> PathBuf {
    usb_mount_path
        .join("LIGHTSHOW")
        .join(format!("{show_name}.tas"))
}

fn build_ffmpeg_args(input: &Path, output: &Path, normalize: bool) -> Vec<String> {
    let mut args = vec!["-y".to_string(), "-i".to_string(), path_to_string(input)];

    if normalize {
        args.push("-af".to_string());
        args.push("loudnorm=I=-16:TP=-1.5:LRA=11".to_string());
    }

    args.push("-ac".to_string());
    args.push("2".to_string());
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
    let ffmpeg_args = build_ffmpeg_args(&source_path, &converted_path, request.normalize);
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
    validate_source_tas(&source_path)?;
    read_tas_inspection(&source_path)
}

#[tauri::command]
fn install_lightshow(request: LightShowInstallRequest) -> Result<LightShowInstallResult, String> {
    let source_path = PathBuf::from(&request.source_path);
    validate_source_tas(&source_path)?;

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

    let inspection = read_tas_inspection(&source_path)?;
    if !inspection.has_sequence_file || !inspection.has_audio_file {
        return Err(
            "Light show archive is missing required .fseq and/or audio assets.".to_string(),
        );
    }

    let show_name = request
        .show_name
        .as_deref()
        .map(sanitize_show_name)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| inspection.show_name.clone());

    let install_path = build_lightshow_install_path(&usb_mount_path, &show_name);
    if let Some(parent) = install_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to prepare LIGHTSHOW destination: {error}"))?;
    }

    let already_exists = install_path.exists();
    if already_exists && !request.overwrite_existing {
        return Err(format!(
            "Destination already exists and overwrite is disabled: {}",
            path_to_string(&install_path)
        ));
    }

    fs::copy(&source_path, &install_path)
        .map_err(|error| format!("Failed to install .tas file to USB: {error}"))?;

    Ok(LightShowInstallResult {
        source_path: path_to_string(&source_path),
        installed_path: path_to_string(&install_path),
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

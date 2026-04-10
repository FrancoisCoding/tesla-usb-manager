use serde::{Deserialize, Serialize};
use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
};

const FAT32_LIMIT_BYTES: u64 = 32 * 1024 * 1024 * 1024;
const DEFAULT_VOLUME_LABEL: &str = "TESLAUSB";
const TESLA_FOLDERS: [&str; 4] = ["TeslaCam", "Sentry", "Music", "LIGHTSHOW"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsbDriveCandidate {
    pub id: String,
    pub mount_path: String,
    pub display_name: String,
    pub total_bytes: Option<u64>,
    pub free_bytes: Option<u64>,
    pub recommended_filesystem: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeslaFormatPlanRequest {
    pub mount_path: String,
    pub total_bytes: Option<u64>,
    pub expected_fingerprint: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TeslaFormatPlan {
    pub mount_path: String,
    pub volume_label: String,
    pub filesystem: String,
    pub fingerprint: String,
    pub folders_to_create: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareTeslaUsbLayoutRequest {
    pub mount_path: String,
    pub expected_fingerprint: Option<String>,
    pub total_bytes: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareTeslaUsbLayoutResult {
    pub mount_path: String,
    pub fingerprint: String,
    pub created_folders: Vec<String>,
}

// -- Windows disk helpers -----------------------------------------------

#[cfg(target_os = "windows")]
mod win_disk {
    use std::path::Path;

    type Bool = i32;
    type Dword = u32;
    type Lpcwstr = *const u16;
    type PuLargeInt = *mut u64;

    const DRIVE_REMOVABLE: Dword = 2;
    const DRIVE_FIXED: Dword = 3;

    extern "system" {
        fn GetDriveTypeW(lp_root_path_name: Lpcwstr) -> Dword;
        fn GetDiskFreeSpaceExW(
            lp_directory_name: Lpcwstr,
            lp_free_bytes_available: PuLargeInt,
            lp_total_number_of_bytes: PuLargeInt,
            lp_total_number_of_free_bytes: PuLargeInt,
        ) -> Bool;
    }

    fn to_wide(ss: &str) -> Vec<u16> {
        ss.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub fn disk_space(path: &Path) -> Option<(u64, u64)> {
        let wide = to_wide(&path.to_string_lossy());
        let mut free_avail: u64 = 0;
        let mut total: u64 = 0;
        let mut total_free: u64 = 0;
        let ok = unsafe {
            GetDiskFreeSpaceExW(wide.as_ptr(), &mut free_avail, &mut total, &mut total_free)
        };
        if ok != 0 && total > 0 {
            Some((total, free_avail))
        } else {
            None
        }
    }

    pub fn is_eligible(path: &Path) -> bool {
        let wide = to_wide(&path.to_string_lossy());
        let kind = unsafe { GetDriveTypeW(wide.as_ptr()) };
        kind == DRIVE_REMOVABLE || kind == DRIVE_FIXED
    }
}

// -- Unix disk helpers ---------------------------------------------------

#[cfg(not(target_os = "windows"))]
mod unix_disk {
    use std::path::Path;
    use std::process::Command;

    pub fn disk_space(path: &Path) -> Option<(u64, u64)> {
        let out = Command::new("df")
            .args(["-k", &path.to_string_lossy().as_ref()])
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&out.stdout);
        let mut lines = text.lines();
        lines.next();
        let line = lines.next()?;
        let cols: Vec<&str> = line.split_whitespace().collect();
        if cols.len() >= 4 {
            let total_kb: u64 = cols[1].parse().ok()?;
            let avail_kb: u64 = cols[3].parse().ok()?;
            Some((total_kb * 1024, avail_kb * 1024))
        } else {
            None
        }
    }
}

// -- Core helpers --------------------------------------------------------

pub fn recommended_filesystem(total_bytes: Option<u64>) -> &'static str {
    match total_bytes {
        Some(bytes) if bytes <= FAT32_LIMIT_BYTES => "FAT32",
        _ => "exFAT",
    }
}

pub fn folder_layout() -> Vec<String> {
    TESLA_FOLDERS
        .iter()
        .map(|name| (*name).to_string())
        .collect()
}

pub fn drive_fingerprint(mount_path: &str, total_bytes: Option<u64>) -> String {
    let mut hasher = DefaultHasher::new();
    mount_path.to_ascii_lowercase().hash(&mut hasher);
    total_bytes.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn normalize_mount_path(path: &str) -> Result<PathBuf, String> {
    let value = path.trim();
    if value.is_empty() {
        return Err("Mount path is required.".to_string());
    }

    let mount_path = PathBuf::from(value);
    if !mount_path.exists() {
        return Err(format!("Mount path does not exist: {value}"));
    }
    if !mount_path.is_dir() {
        return Err(format!("Mount path is not a directory: {value}"));
    }

    Ok(mount_path)
}

fn assert_expected_fingerprint(
    mount_path: &str,
    total_bytes: Option<u64>,
    expected_fingerprint: Option<&str>,
) -> Result<String, String> {
    let fingerprint = drive_fingerprint(mount_path, total_bytes);
    if let Some(expected) = expected_fingerprint {
        if expected != fingerprint {
            return Err(
                "Drive identity check failed. Re-select the USB drive before formatting."
                    .to_string(),
            );
        }
    }
    Ok(fingerprint)
}

fn detect_windows_mounts() -> Vec<PathBuf> {
    (b'D'..=b'Z')
        .map(|letter| PathBuf::from(format!("{}:\\", letter as char)))
        .filter(|path| path.exists() && path.is_dir() && win_disk::is_eligible(path))
        .collect()
}

fn detect_unix_mounts(base: &Path) -> Vec<PathBuf> {
    match fs::read_dir(base) {
        Ok(entries) => entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.is_dir())
            .collect(),
        Err(_) => Vec::new(),
    }
}

pub fn list_usb_drives_internal(paths: Vec<PathBuf>) -> Vec<UsbDriveCandidate> {
    paths
        .into_iter()
        .map(|path| {
            let mount_path = path.to_string_lossy().to_string();

            #[cfg(target_os = "windows")]
            let space = win_disk::disk_space(&path);
            #[cfg(not(target_os = "windows"))]
            let space = unix_disk::disk_space(&path);

            let (total_bytes, free_bytes) = match space {
                Some((total, free)) => (Some(total), Some(free)),
                None => (None, None),
            };

            UsbDriveCandidate {
                id: drive_fingerprint(&mount_path, total_bytes),
                display_name: mount_path.clone(),
                mount_path,
                recommended_filesystem: recommended_filesystem(total_bytes).to_string(),
                total_bytes,
                free_bytes,
            }
        })
        .collect()
}

#[tauri::command]
pub fn list_usb_drives() -> Vec<UsbDriveCandidate> {
    #[cfg(target_os = "windows")]
    let drives = list_usb_drives_internal(detect_windows_mounts());

    #[cfg(target_os = "macos")]
    let drives = list_usb_drives_internal(detect_unix_mounts(Path::new("/Volumes")));

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    let drives = list_usb_drives_internal({
        let mut mounts = detect_unix_mounts(Path::new("/media"));
        mounts.extend(detect_unix_mounts(Path::new("/run/media")));
        mounts
    });

    drives
}

#[tauri::command]
pub fn build_tesla_format_plan(request: TeslaFormatPlanRequest) -> Result<TeslaFormatPlan, String> {
    let mount_path = normalize_mount_path(&request.mount_path)?;
    let mount_value = mount_path.to_string_lossy().to_string();
    let fingerprint = assert_expected_fingerprint(
        &mount_value,
        request.total_bytes,
        request.expected_fingerprint.as_deref(),
    )?;

    let filesystem = recommended_filesystem(request.total_bytes).to_string();
    let mut warnings = Vec::new();
    if request.total_bytes.is_none() {
        warnings
            .push("Drive size was unavailable; defaulting to exFAT recommendation.".to_string());
    }

    Ok(TeslaFormatPlan {
        mount_path: mount_value,
        volume_label: DEFAULT_VOLUME_LABEL.to_string(),
        filesystem,
        fingerprint,
        folders_to_create: folder_layout(),
        warnings,
    })
}

#[tauri::command]
pub fn prepare_tesla_usb_layout(
    request: PrepareTeslaUsbLayoutRequest,
) -> Result<PrepareTeslaUsbLayoutResult, String> {
    let mount_path = normalize_mount_path(&request.mount_path)?;
    let mount_value = mount_path.to_string_lossy().to_string();
    let fingerprint = assert_expected_fingerprint(
        &mount_value,
        request.total_bytes,
        request.expected_fingerprint.as_deref(),
    )?;

    let mut created_folders = Vec::new();
    for folder in folder_layout() {
        let folder_path = mount_path.join(&folder);
        if !folder_path.exists() {
            fs::create_dir_all(&folder_path).map_err(|error| {
                format!(
                    "Failed to create Tesla folder '{}': {}",
                    folder_path.to_string_lossy(),
                    error
                )
            })?;
            created_folders.push(folder);
        }
    }

    Ok(PrepareTeslaUsbLayoutResult {
        mount_path: mount_value,
        fingerprint,
        created_folders,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chooses_fat32_for_32_gib_or_smaller() {
        assert_eq!(
            recommended_filesystem(Some(32 * 1024 * 1024 * 1024)),
            "FAT32"
        );
        assert_eq!(
            recommended_filesystem(Some(8 * 1024 * 1024 * 1024)),
            "FAT32"
        );
    }

    #[test]
    fn chooses_exfat_for_larger_or_unknown() {
        assert_eq!(
            recommended_filesystem(Some(64 * 1024 * 1024 * 1024)),
            "exFAT"
        );
        assert_eq!(recommended_filesystem(None), "exFAT");
    }

    #[test]
    fn folder_layout_matches_tesla_requirements() {
        assert_eq!(
            folder_layout(),
            vec![
                "TeslaCam".to_string(),
                "Sentry".to_string(),
                "Music".to_string(),
                "LIGHTSHOW".to_string()
            ]
        );
    }

    #[test]
    fn fingerprint_is_stable_for_same_input() {
        let a = drive_fingerprint("E:\\", Some(128));
        let b = drive_fingerprint("E:\\", Some(128));
        let c = drive_fingerprint("F:\\", Some(128));
        assert_eq!(a, b);
        assert_ne!(a, c);
    }
}

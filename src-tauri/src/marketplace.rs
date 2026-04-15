use reqwest::Url;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const MARKETPLACE_PAGE_URL: &str = "https://www.notateslaapp.com/tesla-custom-lock-sounds/";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceEntry {
    pub name: String,
    pub category: String,
    pub preview_url: String,
    pub download_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceCatalogRequest {
    #[serde(default)]
    pub refresh: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceCatalogResponse {
    pub source_url: String,
    pub fetched_at_epoch_ms: u128,
    pub cached: bool,
    pub entries: Vec<MarketplaceEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceDownloadRequest {
    pub download_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceDownloadResult {
    pub download_url: String,
    pub temp_path: String,
    pub bytes: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MarketplaceCatalogCache {
    source_url: String,
    fetched_at_epoch_ms: u128,
    entries: Vec<MarketplaceEntry>,
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn now_epoch_ms() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|error| format!("System clock error: {error}"))
}

fn normalize_category(raw: &str) -> String {
    let words: Vec<String> = raw
        .trim()
        .split(['-', '_', ' '])
        .filter(|part| !part.is_empty())
        .map(|part| {
            let lower = part.to_ascii_lowercase();
            let mut chars = lower.chars();
            match chars.next() {
                Some(first) => {
                    let mut value = String::new();
                    value.push(first.to_ascii_uppercase());
                    value.push_str(chars.as_str());
                    value
                }
                None => String::new(),
            }
        })
        .collect();

    if words.is_empty() {
        "Uncategorized".to_string()
    } else {
        words.join(" ")
    }
}

fn normalize_name(raw: &str) -> String {
    let trimmed = raw.trim();
    let bytes = trimmed.as_bytes();
    let mut cut_index = 0;

    while cut_index < bytes.len() && bytes[cut_index].is_ascii_digit() {
        cut_index += 1;
    }
    if cut_index > 0 && cut_index < bytes.len() && bytes[cut_index] == b'.' {
        cut_index += 1;
        while cut_index < bytes.len() && bytes[cut_index].is_ascii_whitespace() {
            cut_index += 1;
        }
    } else {
        cut_index = 0;
    }

    trimmed[cut_index..].trim().to_string()
}

fn resolve_marketplace_url(raw: &str) -> Result<Url, String> {
    let value = raw.trim();
    if value.is_empty() {
        return Err("Marketplace URL is empty.".to_string());
    }

    let base =
        Url::parse(MARKETPLACE_PAGE_URL).map_err(|error| format!("Invalid base URL: {error}"))?;
    let parsed = match Url::parse(value) {
        Ok(url) => url,
        Err(_) => base
            .join(value)
            .map_err(|error| format!("Invalid marketplace URL: {error}"))?,
    };

    match parsed.scheme() {
        "https" | "http" => Ok(parsed),
        _ => Err("Marketplace URL must use http or https.".to_string()),
    }
}

fn validate_download_url(raw: &str) -> Result<Url, String> {
    let url = resolve_marketplace_url(raw)?;
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    if host != "www.notateslaapp.com" && host != "notateslaapp.com" {
        return Err("Marketplace download URL must point to notateslaapp.com.".to_string());
    }
    if !url.path().starts_with("/assets/audio/") {
        return Err("Marketplace download URL must be an audio asset path.".to_string());
    }
    Ok(url)
}

fn sanitize_file_name(raw: &str) -> String {
    let mut value = String::with_capacity(raw.len());
    for char in raw.chars() {
        if char.is_ascii_alphanumeric() || char == '.' || char == '-' || char == '_' {
            value.push(char);
        } else {
            value.push('_');
        }
    }

    let trimmed = value.trim_matches('_');
    if trimmed.is_empty() {
        "marketplace-audio.wav".to_string()
    } else {
        trimmed.to_string()
    }
}

fn cache_path() -> PathBuf {
    std::env::temp_dir()
        .join("tesla-usb-manager")
        .join("marketplace")
        .join("catalog-cache.json")
}

fn read_cache() -> Result<Option<MarketplaceCatalogCache>, String> {
    let path = cache_path();
    if !path.exists() {
        return Ok(None);
    }

    let body = fs::read_to_string(&path).map_err(|error| {
        format!(
            "Failed to read marketplace cache '{}': {error}",
            path_to_string(&path)
        )
    })?;
    let parsed = serde_json::from_str::<MarketplaceCatalogCache>(&body)
        .map_err(|error| format!("Marketplace cache is invalid JSON: {error}"))?;
    Ok(Some(parsed))
}

fn write_cache(cache: &MarketplaceCatalogCache) -> Result<(), String> {
    let path = cache_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to prepare marketplace cache directory '{}': {error}",
                path_to_string(parent)
            )
        })?;
    }

    let body = serde_json::to_string_pretty(cache)
        .map_err(|error| format!("Failed to encode marketplace cache JSON: {error}"))?;
    fs::write(&path, body).map_err(|error| {
        format!(
            "Failed to write marketplace cache '{}': {error}",
            path_to_string(&path)
        )
    })
}

fn collect_text(element: scraper::ElementRef<'_>) -> String {
    element
        .text()
        .collect::<Vec<_>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub(crate) fn parse_catalog_entries(html: &str) -> Vec<MarketplaceEntry> {
    let document = Html::parse_document(html);

    let container_selector =
        Selector::parse("div.audio-player-container").expect("valid container selector");
    let card_selector = Selector::parse("div.mod.mod-audio-player").expect("valid card selector");
    let name_selector = Selector::parse("h2").expect("valid name selector");
    let download_selector = Selector::parse("a.download").expect("valid download selector");
    let preview_selector =
        Selector::parse("img.audio-player-button").expect("valid preview selector");

    let mut entries = Vec::new();

    for container in document.select(&container_selector) {
        let category = normalize_category(
            container
                .value()
                .attr("data-category")
                .unwrap_or("uncategorized"),
        );

        for card in container.select(&card_selector) {
            let name_raw = card
                .select(&name_selector)
                .next()
                .map(collect_text)
                .unwrap_or_default();
            let name = normalize_name(&name_raw);
            if name.is_empty() {
                continue;
            }

            let download_raw = match card
                .select(&download_selector)
                .next()
                .and_then(|node| node.value().attr("href"))
            {
                Some(value) => value,
                None => continue,
            };
            let preview_node = match card.select(&preview_selector).next() {
                Some(node) => node,
                None => continue,
            };
            let preview_raw = match preview_node.value().attr("data-audio") {
                Some(value) => value,
                None => continue,
            };
            let image_url = preview_node
                .value()
                .attr("src")
                .and_then(|src| resolve_marketplace_url(src).ok())
                .map(|url| url.to_string());

            let download_url = match resolve_marketplace_url(download_raw) {
                Ok(url) => url.to_string(),
                Err(_) => continue,
            };
            let preview_url = match resolve_marketplace_url(preview_raw) {
                Ok(url) => url.to_string(),
                Err(_) => continue,
            };

            entries.push(MarketplaceEntry {
                name,
                category: category.clone(),
                preview_url,
                download_url,
                image_url,
            });
        }
    }

    entries
}

async fn fetch_catalog() -> Result<MarketplaceCatalogCache, String> {
    let response = reqwest::get(MARKETPLACE_PAGE_URL)
        .await
        .map_err(|error| format!("Failed to request marketplace catalog: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Marketplace catalog request failed with status {}.",
            response.status()
        ));
    }

    let html = response
        .text()
        .await
        .map_err(|error| format!("Failed to read marketplace response body: {error}"))?;
    let entries = parse_catalog_entries(&html);
    if entries.is_empty() {
        return Err(
            "Marketplace parser returned no entries. Source format may have changed.".to_string(),
        );
    }

    Ok(MarketplaceCatalogCache {
        source_url: MARKETPLACE_PAGE_URL.to_string(),
        fetched_at_epoch_ms: now_epoch_ms()?,
        entries,
    })
}

#[tauri::command]
pub async fn fetch_marketplace_catalog(
    request: Option<MarketplaceCatalogRequest>,
) -> Result<MarketplaceCatalogResponse, String> {
    let refresh = request.map(|payload| payload.refresh).unwrap_or(false);
    if !refresh {
        if let Some(cache) = read_cache()? {
            return Ok(MarketplaceCatalogResponse {
                source_url: cache.source_url,
                fetched_at_epoch_ms: cache.fetched_at_epoch_ms,
                cached: true,
                entries: cache.entries,
            });
        }
    }

    let cache = fetch_catalog().await?;
    write_cache(&cache)?;

    Ok(MarketplaceCatalogResponse {
        source_url: cache.source_url,
        fetched_at_epoch_ms: cache.fetched_at_epoch_ms,
        cached: false,
        entries: cache.entries,
    })
}

#[tauri::command]
pub async fn download_marketplace_audio(
    request: MarketplaceDownloadRequest,
) -> Result<MarketplaceDownloadResult, String> {
    let url = validate_download_url(&request.download_url)?;
    let response = reqwest::get(url.clone())
        .await
        .map_err(|error| format!("Failed to download marketplace audio: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Marketplace download request failed with status {}.",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Failed to read marketplace download bytes: {error}"))?;

    if bytes.is_empty() {
        return Err("Marketplace download returned an empty file.".to_string());
    }

    let file_name = url
        .path_segments()
        .and_then(|mut segments| segments.next_back())
        .map(sanitize_file_name)
        .unwrap_or_else(|| "marketplace-audio.wav".to_string());

    let timestamp = now_epoch_ms()?;
    let temp_path = std::env::temp_dir()
        .join("tesla-usb-manager")
        .join("marketplace")
        .join(format!("{timestamp}-{file_name}"));
    if let Some(parent) = temp_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to prepare marketplace temp directory '{}': {error}",
                path_to_string(parent)
            )
        })?;
    }

    fs::write(&temp_path, &bytes).map_err(|error| {
        format!(
            "Failed to write marketplace audio '{}': {error}",
            path_to_string(&temp_path)
        )
    })?;

    Ok(MarketplaceDownloadResult {
        download_url: url.to_string(),
        temp_path: path_to_string(&temp_path),
        bytes: bytes.len(),
    })
}

const LIGHTSHOW_BASE: &str = "https://teslalightshare.io";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LightShowEntry {
    pub id: u64,
    pub title: String,
    pub author: String,
    pub upload_date: String,
    pub duration: String,
    pub download_count: u64,
    pub upvotes: u64,
    pub downvotes: u64,
    pub youtube_embed_url: String,
}
fn ls_default_page() -> u64 {
    1
}
fn ls_default_sort_type() -> String {
    "hot".to_string()
}
fn ls_default_sort_order() -> String {
    "desc".to_string()
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchLightShowsRequest {
    #[serde(default = "ls_default_page")]
    pub page: u64,
    pub category: Option<String>,
    #[serde(default = "ls_default_sort_type")]
    pub sort_type: String,
    #[serde(default = "ls_default_sort_order")]
    pub sort_order: String,
    pub search: Option<String>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchLightShowsResponse {
    pub page: u64,
    pub entries: Vec<LightShowEntry>,
    pub fetched_at_epoch_ms: u128,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadInstallLightShowRequest {
    pub show_id: u64,
    pub usb_mount_path: String,
    pub show_name: Option<String>,
    pub overwrite_existing: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadInstallLightShowResult {
    pub show_id: u64,
    pub installed_path: String,
    pub show_name: String,
    pub bytes: usize,
}
pub(crate) fn parse_lightshow_entries(html: &str) -> Vec<LightShowEntry> {
    let document = Html::parse_document(html);
    let card_sel = Selector::parse("div.show-card-container").expect("c");
    let link_sel = Selector::parse("a[href]").expect("l");
    let iframe_sel = Selector::parse("iframe[src]").expect("i");
    let vote_sel = Selector::parse("div.votes p.pe-1").expect("v");
    let dur_sel = Selector::parse("p.duration").expect("d");
    let dl_col_sel =
        Selector::parse("div.col-6.d-flex.align-items-center.justify-content-between p")
            .expect("dl");
    let creator_sel = Selector::parse("p.creator").expect("cr");
    let title_sel = Selector::parse("h5.card-title").expect("t");
    let mut entries: Vec<LightShowEntry> = Vec::new();
    for card in document.select(&card_sel) {
        let id: Option<u64> = card.select(&link_sel).find_map(|a| {
            let href = a.value().attr("href").unwrap_or_default();
            let segs: Vec<&str> = href.trim_end_matches('/').rsplit('/').collect();
            segs.first().and_then(|s| s.parse().ok())
        });
        let id = match id {
            Some(v) => v,
            None => continue,
        };
        let youtube_embed_url: String = card
            .select(&iframe_sel)
            .next()
            .and_then(|f| f.value().attr("src"))
            .unwrap_or_default()
            .to_string();
        let vote_values: Vec<u64> = card
            .select(&vote_sel)
            .map(|p| {
                let tx = collect_text(p);
                tx.parse().unwrap_or(0u64)
            })
            .collect();
        let upvotes = vote_values.get(0).copied().unwrap_or(0);
        let downvotes = vote_values.get(1).copied().unwrap_or(0);
        let duration: String = card
            .select(&dur_sel)
            .next()
            .map(collect_text)
            .unwrap_or_default();
        let dl_texts: Vec<String> = card.select(&dl_col_sel).map(collect_text).collect();
        let download_count: u64 = dl_texts
            .last()
            .and_then(|s| {
                let d: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
                d.parse().ok()
            })
            .unwrap_or(0);
        let creator_text = card
            .select(&creator_sel)
            .next()
            .map(collect_text)
            .unwrap_or_default();
        let author: String = creator_text.trim().to_string();
        let upload_date: String = String::new();
        let title: String = card
            .select(&title_sel)
            .next()
            .map(collect_text)
            .unwrap_or_default();
        if title.is_empty() {
            continue;
        }
        entries.push(LightShowEntry {
            id,
            title,
            author,
            upload_date,
            duration,
            download_count,
            upvotes,
            downvotes,
            youtube_embed_url,
        });
    }
    entries
}
fn sanitize_lightshow_name(raw: &str) -> String {
    let mut v = String::with_capacity(raw.len());
    for c in raw.chars() {
        if c.is_ascii_alphanumeric() {
            v.push(c);
        } else {
            v.push(char::from(95u8));
        }
    }
    let s = v
        .find(|c: char| c.is_ascii_alphanumeric())
        .unwrap_or(v.len());
    let e = v
        .rfind(|c: char| c.is_ascii_alphanumeric())
        .map(|i| i + 1)
        .unwrap_or(0);
    if s >= e {
        "lightshow".to_string()
    } else {
        v[s..e].to_string()
    }
}
fn lightshow_entry_stem(name: &str) -> Option<String> {
    Path::new(name)
        .file_stem()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string())
}
fn lightshow_entry_extension(name: &str) -> Option<String> {
    Path::new(name)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
}
fn find_lightshow_pair<R: std::io::Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
) -> Result<(String, String, String), String> {
    let mut sequences = Vec::new();
    let mut audio_files = Vec::new();

    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|e| format!("Read zip entry failed: {e}"))?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().to_string();
        let stem = match lightshow_entry_stem(&name) {
            Some(value) if !value.is_empty() => value,
            _ => continue,
        };
        let extension = match lightshow_entry_extension(&name) {
            Some(value) => value,
            None => continue,
        };

        if extension == "fseq" {
            sequences.push((stem, name));
        } else if extension == "mp3" || extension == "wav" {
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

    Err("Light show zip must contain matching .fseq and .mp3/.wav files.".to_string())
}
fn validate_lightshow_usb_root(usb_mount_path: &Path) -> Result<(), String> {
    if usb_mount_path.join("TeslaCam").exists() {
        return Err(
            "Tesla Light Show USB drives must not contain a base-level TeslaCam folder."
                .to_string(),
        );
    }

    for entry in
        fs::read_dir(usb_mount_path).map_err(|e| format!("Inspect USB root failed: {e}"))?
    {
        let entry = entry.map_err(|e| format!("Inspect USB root entry failed: {e}"))?;
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
async fn scrape_lightshow_zip_url(show_id: u64) -> Result<String, String> {
    let detail_url = format!("{}/light-show/{}", LIGHTSHOW_BASE, show_id);
    let response = reqwest::get(&detail_url)
        .await
        .map_err(|e| format!("Fetch detail failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("Detail HTTP {}", response.status()));
    }
    let html = response
        .text()
        .await
        .map_err(|e| format!("Read detail body failed: {e}"))?;
    let document = Html::parse_document(&html);
    let dl_sel = Selector::parse("a.download-zip").expect("dl-zip");
    let href = document
        .select(&dl_sel)
        .next()
        .and_then(|a| a.value().attr("href"))
        .ok_or_else(|| "No download link found.".to_string())?;
    let url = Url::parse(href)
        .or_else(|_| Url::parse(LIGHTSHOW_BASE).and_then(|b| b.join(href)))
        .map_err(|e| format!("Bad URL: {e}"))?;
    Ok(url.to_string())
}
#[tauri::command]
pub async fn fetch_lightshows(
    request: Option<FetchLightShowsRequest>,
) -> Result<FetchLightShowsResponse, String> {
    let req = request.unwrap_or_else(|| FetchLightShowsRequest {
        page: 1,
        category: None,
        sort_type: "hot".to_string(),
        sort_order: "desc".to_string(),
        search: None,
    });
    let mut base_url = Url::parse(LIGHTSHOW_BASE).map_err(|e| format!("Bad base: {e}"))?;
    if let Some(ref q) = req.search {
        base_url.set_path("/api/getCardsBySearch");
        base_url
            .query_pairs_mut()
            .append_pair("q", q)
            .append_pair("page", &req.page.to_string());
    } else {
        base_url.set_path("/api/getCards");
        base_url
            .query_pairs_mut()
            .append_pair("type", &req.sort_type)
            .append_pair("order", &req.sort_order)
            .append_pair("page", &req.page.to_string());
        if let Some(ref cat) = req.category {
            base_url.query_pairs_mut().append_pair("category", cat);
        }
    }
    let url = base_url.to_string();
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Fetch lightshows failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("Lightshow catalog HTTP {}", response.status()));
    }
    let html = response
        .text()
        .await
        .map_err(|e| format!("Read catalog body failed: {e}"))?;
    let entries = parse_lightshow_entries(&html);
    Ok(FetchLightShowsResponse {
        page: req.page,
        entries,
        fetched_at_epoch_ms: now_epoch_ms()?,
    })
}
#[tauri::command]
pub async fn download_install_lightshow(
    request: DownloadInstallLightShowRequest,
) -> Result<DownloadInstallLightShowResult, String> {
    let zip_url = scrape_lightshow_zip_url(request.show_id).await?;
    let response = reqwest::get(&zip_url)
        .await
        .map_err(|e| format!("Download zip failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("Zip download HTTP {}", response.status()));
    }
    let zip_bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Read zip bytes failed: {e}"))?;
    if zip_bytes.is_empty() {
        return Err("Lightshow zip was empty.".to_string());
    }
    let show_name = request
        .show_name
        .as_deref()
        .map(sanitize_lightshow_name)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| format!("show_{}", request.show_id));
    let usb_mount_path = PathBuf::from(&request.usb_mount_path);
    validate_lightshow_usb_root(&usb_mount_path)?;
    let lightshow_dir = usb_mount_path.join("LightShow");
    fs::create_dir_all(&lightshow_dir).map_err(|e| format!("Create LightShow dir failed: {e}"))?;
    let cursor = std::io::Cursor::new(zip_bytes.as_ref());
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("Open zip failed: {e}"))?;
    let (sequence_entry, audio_entry, audio_extension) = find_lightshow_pair(&mut archive)?;
    let sequence_path = lightshow_dir.join(format!("{show_name}.fseq"));
    let audio_path = lightshow_dir.join(format!("{show_name}.{audio_extension}"));
    if (sequence_path.exists() || audio_path.exists()) && !request.overwrite_existing {
        return Err(format!("Show already exists: {}", show_name));
    }

    let mut sequence_file = archive
        .by_name(&sequence_entry)
        .map_err(|e| format!("Read .fseq entry failed: {e}"))?;
    let mut sequence_content = Vec::new();
    std::io::Read::read_to_end(&mut sequence_file, &mut sequence_content)
        .map_err(|e| format!("Read .fseq content failed: {e}"))?;
    drop(sequence_file);

    let mut audio_file = archive
        .by_name(&audio_entry)
        .map_err(|e| format!("Read audio entry failed: {e}"))?;
    let mut audio_content = Vec::new();
    std::io::Read::read_to_end(&mut audio_file, &mut audio_content)
        .map_err(|e| format!("Read audio content failed: {e}"))?;

    fs::write(&sequence_path, &sequence_content).map_err(|e| format!("Write .fseq failed: {e}"))?;
    fs::write(&audio_path, &audio_content).map_err(|e| format!("Write audio failed: {e}"))?;
    let installed_path = format!(
        "{} + {}",
        path_to_string(&sequence_path),
        path_to_string(&audio_path)
    );
    Ok(DownloadInstallLightShowResult {
        show_id: request.show_id,
        installed_path,
        show_name,
        bytes: sequence_content.len() + audio_content.len(),
    })
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_catalog_entries_from_html_cards() {
        let html = r#"
            <div class="audio-player-container" data-category="most-popular">
                <div class="mod mod-audio-player">
                    <h2>1. Shutdown</h2>
                    <div class="audio-player-contents">
                        <div>
                            <h4>Windows</h4>
                            <a href="/assets/audio/retro/windows_shutdown.wav" class="fancy download">Download</a>
                        </div>
                        <img class="audio-player-button" data-audio="/assets/audio/retro/windows_shutdown.mp3" />
                    </div>
                </div>
            </div>
        "#;

        let entries = parse_catalog_entries(html);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "Shutdown");
        assert_eq!(entries[0].category, "Most Popular");
        assert_eq!(
            entries[0].download_url,
            "https://www.notateslaapp.com/assets/audio/retro/windows_shutdown.wav"
        );
        assert_eq!(
            entries[0].preview_url,
            "https://www.notateslaapp.com/assets/audio/retro/windows_shutdown.mp3"
        );
    }

    #[test]
    fn skips_cards_missing_required_links() {
        let html = r#"
            <div class="audio-player-container" data-category="cartoons">
                <div class="mod mod-audio-player">
                    <h2>Meep Meep</h2>
                    <div class="audio-player-contents">
                        <div>
                            <h4>Road Runner</h4>
                            <a href="/assets/audio/cartoons/road-runner_meep-meep.wav" class="fancy download">Download</a>
                        </div>
                    </div>
                </div>
                <div class="mod mod-audio-player">
                    <h2>Boing</h2>
                    <div class="audio-player-contents">
                        <div>
                            <h4>Beavis And Butthead</h4>
                            <a href="/assets/audio/cartoons/beavis-and-butthead_boing.wav" class="fancy download">Download</a>
                        </div>
                        <img class="audio-player-button" data-audio="/assets/audio/cartoons/beavis-and-butthead_boing.mp3" />
                    </div>
                </div>
            </div>
        "#;

        let entries = parse_catalog_entries(html);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "Boing");
    }

    #[test]
    fn rejects_download_urls_outside_allowed_host_and_path() {
        let invalid_host = validate_download_url("https://example.com/assets/audio/file.wav");
        assert!(invalid_host.is_err());

        let invalid_path =
            validate_download_url("https://www.notateslaapp.com/assets/images/file.wav");
        assert!(invalid_path.is_err());

        let valid_relative = validate_download_url("/assets/audio/retro/windows_shutdown.wav");
        assert!(valid_relative.is_ok());
    }
}

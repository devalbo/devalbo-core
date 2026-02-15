#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FsEntry {
    name: String,
    path: String,
    is_directory: bool,
    size: u64,
    mtime_ms: Option<u64>,
}

fn to_entry(path: &Path, metadata: &fs::Metadata) -> FsEntry {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    let mtime_ms = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64);

    FsEntry {
        name,
        path: path.to_string_lossy().to_string(),
        is_directory: metadata.is_dir(),
        size: metadata.len(),
        mtime_ms,
    }
}

#[tauri::command]
fn fs_get_base_dir() -> Result<String, String> {
    std::env::current_dir()
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn fs_read_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(path).map_err(|err| err.to_string())
}

#[tauri::command]
fn fs_write_file(path: String, data: Vec<u8>) -> Result<(), String> {
    let target = Path::new(&path);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    fs::write(target, data).map_err(|err| err.to_string())
}

#[tauri::command]
fn fs_readdir(path: String) -> Result<Vec<FsEntry>, String> {
    let mut out = Vec::new();
    let dir = fs::read_dir(path).map_err(|err| err.to_string())?;

    for item in dir {
        let item = item.map_err(|err| err.to_string())?;
        let full_path = item.path();
        let metadata = fs::metadata(&full_path).map_err(|err| err.to_string())?;
        out.push(to_entry(&full_path, &metadata));
    }

    Ok(out)
}

#[tauri::command]
fn fs_stat(path: String) -> Result<FsEntry, String> {
    let target = Path::new(&path);
    let metadata = fs::metadata(target).map_err(|err| err.to_string())?;
    Ok(to_entry(target, &metadata))
}

#[tauri::command]
fn fs_mkdir(path: String) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|err| err.to_string())
}

#[tauri::command]
fn fs_rm(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() {
        return Ok(());
    }

    let metadata = fs::metadata(target).map_err(|err| err.to_string())?;
    if metadata.is_dir() {
        fs::remove_dir_all(target).map_err(|err| err.to_string())
    } else {
        fs::remove_file(target).map_err(|err| err.to_string())
    }
}

#[tauri::command]
fn fs_exists(path: String) -> bool {
    Path::new(&path).exists()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            fs_get_base_dir,
            fs_read_file,
            fs_write_file,
            fs_readdir,
            fs_stat,
            fs_mkdir,
            fs_rm,
            fs_exists
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

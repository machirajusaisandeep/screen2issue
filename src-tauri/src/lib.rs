use serde::Serialize;
use std::{
    net::{SocketAddr, TcpListener, TcpStream},
    process::{Command, Stdio},
    time::Duration,
};
use tauri::Manager;

const LOCAL_ENGINE_HOST: &str = "127.0.0.1";
const LOCAL_ENGINE_PORT: u16 = 8765;
const LOCAL_ENGINE_RELATIVE_BIN: &str =
    "resources/local-engine/bin/screen2issue-local-engine-aarch64-apple-darwin/screen2issue-local-engine-aarch64-apple-darwin";
const LOCAL_ENGINE_RELATIVE_ROOT: &str = "resources/local-engine";

#[derive(Serialize)]
struct StartLocalEngineResponse {
    status: &'static str,
    message: String,
    pid: Option<u32>,
}

#[tauri::command]
fn start_local_engine(app: tauri::AppHandle) -> Result<StartLocalEngineResponse, String> {
    if is_local_engine_reachable() {
        return Ok(StartLocalEngineResponse {
            status: "already_running",
            message: "The bundled local engine is already responding on 127.0.0.1:8765.".into(),
            pid: None,
        });
    }

    let port_probe = TcpListener::bind((LOCAL_ENGINE_HOST, LOCAL_ENGINE_PORT));
    if port_probe.is_err() {
        return Ok(StartLocalEngineResponse {
            status: "port_conflict",
            message:
                "Port 8765 is already in use by another process, so Screen2Issue could not launch its bundled helper."
                    .into(),
            pid: None,
        });
    }
    drop(port_probe);

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Could not resolve the bundled resource directory: {error}"))?;

    let engine_root = resource_dir.join(LOCAL_ENGINE_RELATIVE_ROOT);
    let helper_path = resource_dir.join(LOCAL_ENGINE_RELATIVE_BIN);

    if !helper_path.exists() {
        return Err(format!(
            "Bundled local engine binary is missing at {}.",
            helper_path.display()
        ));
    }

    let child = Command::new(&helper_path)
        .env("SCREEN2ISSUE_RESOURCE_DIR", &engine_root)
        .env("SCREEN2ISSUE_ENGINE_PORT", LOCAL_ENGINE_PORT.to_string())
        .env("SCREEN2ISSUE_LOG_LEVEL", "warning")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Could not start the bundled local engine: {error}"))?;

    Ok(StartLocalEngineResponse {
        status: "starting",
        message: format!(
            "Bundled local engine started from {} and is booting on {}:{}.",
            helper_path.display(),
            LOCAL_ENGINE_HOST,
            LOCAL_ENGINE_PORT
        ),
        pid: Some(child.id()),
    })
}

fn is_local_engine_reachable() -> bool {
    let endpoint: SocketAddr = format!("{LOCAL_ENGINE_HOST}:{LOCAL_ENGINE_PORT}")
        .parse()
        .expect("local engine socket address must be valid");

    TcpStream::connect_timeout(&endpoint, Duration::from_millis(250)).is_ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![start_local_engine])
        .run(tauri::generate_context!())
        .expect("error while running Screen2Issue");
}

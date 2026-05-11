mod scanner;
mod ai;
mod reports;
mod types;

pub use types::*;

#[tauri::command]
async fn check_tool_installation(tool_name: String) -> Result<types::ToolStatus, String> {
    scanner::check_tool(&tool_name).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn run_scan(
    window: tauri::Window,
    file_path: Option<String>,
    contract_address: Option<String>,
    etherscan_api_key: Option<String>,
) -> Result<types::ScanResult, String> {
    scanner::run_full_scan(window, file_path, contract_address, etherscan_api_key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_ai_explanation(
    finding: types::Finding,
    provider: String,
    api_key: String,
) -> Result<String, String> {
    ai::explain_finding(finding, &provider, &api_key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn test_ai_connection(provider: String, api_key: String) -> Result<bool, String> {
    ai::test_connection(&provider, &api_key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn export_report(
    data: types::ReportData,
    format: String,
    output_path: String,
) -> Result<String, String> {
    reports::export(&data, &format, &output_path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_contract_from_etherscan(
    address: String,
    api_key: Option<String>,
    network: String,
) -> Result<String, String> {
    scanner::fetch_from_etherscan(&address, api_key.as_deref(), &network)
        .await
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            check_tool_installation,
            run_scan,
            get_ai_explanation,
            test_ai_connection,
            export_report,
            fetch_contract_from_etherscan,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
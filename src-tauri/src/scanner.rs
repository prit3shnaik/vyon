use crate::types::*;
use anyhow::{anyhow, Context, Result};
use serde_json::Value;
use std::process::Stdio;
use std::time::Instant;
use strsim::normalized_levenshtein;
use tauri::Emitter;
use tokio::process::Command;
use uuid::Uuid;

pub async fn check_tool(tool: &str) -> Result<ToolStatus> {
    let cmd = match tool {
        "slither" => "slither",
        "mythril" | "myth" => "myth",
        _ => return Err(anyhow!("Unknown tool: {}", tool)),
    };
    let output = Command::new(cmd).arg("--version").stdout(Stdio::piped()).stderr(Stdio::piped()).output().await;
    match output {
        Ok(o) => {
            let version_str = String::from_utf8_lossy(&o.stdout).to_string() + &String::from_utf8_lossy(&o.stderr).to_string();
            let version = version_str.lines().next().map(|l| l.trim().to_string());
            Ok(ToolStatus { name: tool.to_string(), installed: true, version, error: None })
        }
        Err(e) => Ok(ToolStatus { name: tool.to_string(), installed: false, version: None, error: Some(format!("Not found: {}", e)) }),
    }
}

pub async fn fetch_from_etherscan(address: &str, api_key: Option<&str>, network: &str) -> Result<String> {
    let base_url = match network {
        "mainnet" => "https://api.etherscan.io",
        "sepolia" => "https://api-sepolia.etherscan.io",
        _ => "https://api.etherscan.io",
    };
    let key = api_key.unwrap_or("YourApiKeyToken");
    let url = format!("{}/api?module=contract&action=getsourcecode&address={}&apikey={}", base_url, address, key);
    let client = reqwest::Client::new();
    let resp: Value = client.get(&url).send().await?.json().await?;
    if resp["status"] == "1" {
        let source = resp["result"][0]["SourceCode"].as_str().ok_or_else(|| anyhow!("No source code found"))?;
        if source.starts_with("{{") {
            let inner = &source[1..source.len() - 1];
            let files: Value = serde_json::from_str(inner)?;
            if let Some(sources) = files["sources"].as_object() {
                for (_, file_data) in sources {
                    if let Some(content) = file_data["content"].as_str() {
                        return Ok(content.to_string());
                    }
                }
            }
        }
        Ok(source.to_string())
    } else {
        Err(anyhow!("Etherscan error: {}", resp["message"]))
    }
}

pub async fn run_full_scan(window: tauri::Window, file_path: Option<String>, contract_address: Option<String>, etherscan_api_key: Option<String>) -> Result<ScanResult> {
    let start = Instant::now();
    let scan_id = Uuid::new_v4().to_string();
    emit_progress(&window, "init", 5, "Preparing scan environment...");

    let (actual_file, contract_name) = if let Some(fp) = file_path {
        let name = std::path::Path::new(&fp).file_stem().and_then(|s| s.to_str()).unwrap_or("Contract").to_string();
        (fp, name)
    } else if let Some(addr) = contract_address {
        emit_progress(&window, "fetch", 10, "Fetching contract from Etherscan...");
        let source = fetch_from_etherscan(&addr, etherscan_api_key.as_deref(), "mainnet").await?;
        let tmp = tempfile::NamedTempFile::new()?;
        let path = tmp.path().with_extension("sol");
        std::fs::write(&path, &source)?;
        std::mem::forget(tmp);
        (path.to_string_lossy().to_string(), format!("Contract_{}", &addr[..8]))
    } else {
        return Err(anyhow!("No file path or contract address provided"));
    };

    let mut all_findings: Vec<Finding> = Vec::new();
    let mut tools_used = Vec::new();
    let mut slither_error = None;
    let mut mythril_error = None;

    emit_progress(&window, "slither", 20, "Running Slither static analysis...");
    match run_slither(&actual_file).await {
        Ok(findings) => {
            emit_progress(&window, "slither", 50, &format!("Slither found {} issues", findings.len()));
            all_findings.extend(findings);
            tools_used.push("Slither".to_string());
        }
        Err(e) => { slither_error = Some(e.to_string()); emit_progress(&window, "slither_err", 50, &format!("Slither error: {}", e)); }
    }

    emit_progress(&window, "mythril", 55, "Running Mythril symbolic execution...");
    match run_mythril(&actual_file).await {
        Ok(findings) => {
            emit_progress(&window, "mythril", 80, &format!("Mythril found {} issues", findings.len()));
            all_findings.extend(findings);
            tools_used.push("Mythril".to_string());
        }
        Err(e) => { mythril_error = Some(e.to_string()); emit_progress(&window, "mythril_err", 80, &format!("Mythril error: {}", e)); }
    }

    emit_progress(&window, "dedup", 85, "Deduplicating findings...");
    let deduped = deduplicate_findings(all_findings);
    let findings: Vec<Finding> = deduped.into_iter().enumerate().map(|(i, mut f)| { f.id = format!("VYON-{:04}", i + 1); f }).collect();

    emit_progress(&window, "scoring", 92, "Calculating risk score...");
    let risk_score = calculate_risk_score(&findings);
    emit_progress(&window, "done", 100, "Scan complete!");

    Ok(ScanResult {
        findings, scan_duration_ms: start.elapsed().as_millis() as u64,
        tools_used, risk_score,
        contract_name: Some(contract_name),
        scan_id, timestamp: chrono::Utc::now().to_rfc3339(),
        slither_error, mythril_error,
    })
}

async fn run_slither(file_path: &str) -> Result<Vec<Finding>> {
    let output = Command::new("slither").args([file_path, "--json", "-", "--exclude-informational", "--no-fail-pedantic"]).stdout(Stdio::piped()).stderr(Stdio::piped()).output().await.context("Failed to execute slither")?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let json: Value = serde_json::from_str(&stdout).context("Failed to parse Slither JSON output")?;
    parse_slither_output(&json)
}

fn parse_slither_output(json: &Value) -> Result<Vec<Finding>> {
    let mut findings = Vec::new();
    let results = json["results"]["detectors"].as_array().or_else(|| json["detectors"].as_array()).ok_or_else(|| anyhow!("No detectors in Slither output"))?;
    for detector in results {
        let impact = detector["impact"].as_str().unwrap_or("Informational");
        let check = detector["check"].as_str().unwrap_or("unknown");
        let description = detector["description"].as_str().unwrap_or("").to_string();
        let location = detector["elements"].as_array().and_then(|els| els.first()).and_then(|el| {
            let file = el["source_mapping"]["filename_relative"].as_str()?;
            let start = el["source_mapping"]["lines"].as_array()?.first()?.as_u64()?;
            Some(format!("{}:{}", file, start))
        });
        findings.push(Finding {
            id: String::new(),
            title: check.replace('-', " ").replace('_', " ").split_whitespace().map(|w| { let mut c = w.chars(); match c.next() { None => String::new(), Some(f) => f.to_uppercase().collect::<String>() + c.as_str() } }).collect::<Vec<_>>().join(" "),
            description, severity: Severity::from_str(impact), tool: "Slither".to_string(),
            location, code_snippet: None,
            impact: Some(format!("Impact: {} | Confidence: {}", detector["impact"].as_str().unwrap_or("Unknown"), detector["confidence"].as_str().unwrap_or("Unknown"))),
            recommendation: Some(format!("Check: {} - Review Slither docs for remediation.", check)),
            fixed_code: None, confidence: detector["confidence"].as_str().map(|s| s.to_string()), swc_id: None,
        });
    }
    Ok(findings)
}

async fn run_mythril(file_path: &str) -> Result<Vec<Finding>> {
    let output = Command::new("myth").args(["analyze", file_path, "-o", "json", "--execution-timeout", "60"]).stdout(Stdio::piped()).stderr(Stdio::piped()).output().await.context("Failed to execute mythril")?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim().is_empty() { return Ok(Vec::new()); }
    let json: Value = serde_json::from_str(&stdout).context("Failed to parse Mythril JSON output")?;
    parse_mythril_output(&json)
}

fn parse_mythril_output(json: &Value) -> Result<Vec<Finding>> {
    let mut findings = Vec::new();
    let issues = json["issues"].as_array().ok_or_else(|| anyhow!("No issues array in Mythril output"))?;
    for issue in issues {
        let title = issue["title"].as_str().unwrap_or("Unknown Issue").to_string();
        let description = issue["description"]["head"].as_str().or_else(|| issue["description"].as_str()).unwrap_or("").to_string();
        let severity = issue["severity"].as_str().unwrap_or("Low");
        let swc = issue["swc-id"].as_str().map(|s| format!("SWC-{}", s));
        let location = if let (Some(filename), Some(lineno)) = (issue["filename"].as_str(), issue["lineno"].as_u64()) { Some(format!("{}:{}", filename, lineno)) } else { None };
        findings.push(Finding {
            id: String::new(), title, description, severity: Severity::from_str(severity),
            tool: "Mythril".to_string(), location,
            code_snippet: issue["code"].as_str().map(|s| s.to_string()),
            impact: issue["description"]["tail"].as_str().map(|s| s.to_string()),
            recommendation: Some("Apply appropriate security controls for this vulnerability.".to_string()),
            fixed_code: None, confidence: None, swc_id: swc,
        });
    }
    Ok(findings)
}

fn deduplicate_findings(findings: Vec<Finding>) -> Vec<Finding> {
    let mut deduped: Vec<Finding> = Vec::new();
    for finding in findings {
        let is_duplicate = deduped.iter().any(|existing| {
            normalized_levenshtein(&finding.title, &existing.title) > 0.85 ||
            normalized_levenshtein(&finding.description, &existing.description) > 0.90
        });
        if !is_duplicate { deduped.push(finding); }
    }
    deduped.sort_by(|a, b| b.severity.score().cmp(&a.severity.score()));
    deduped
}

fn calculate_risk_score(findings: &[Finding]) -> RiskScore {
    let critical = findings.iter().filter(|f| matches!(f.severity, Severity::Critical)).count();
    let high = findings.iter().filter(|f| matches!(f.severity, Severity::High)).count();
    let medium = findings.iter().filter(|f| matches!(f.severity, Severity::Medium)).count();
    let low = findings.iter().filter(|f| matches!(f.severity, Severity::Low)).count();
    let info = findings.iter().filter(|f| matches!(f.severity, Severity::Informational | Severity::Optimization)).count();
    let score = (critical * 40 + high * 20 + medium * 10 + low * 2).min(100) as u8;
    let label = if critical > 0 || score >= 70 { "Critical" } else if high > 0 || score >= 40 { "High" } else if medium > 0 || score >= 20 { "Medium" } else { "Low" }.to_string();
    RiskScore { label, score, critical_count: critical, high_count: high, medium_count: medium, low_count: low, info_count: info }
}

fn emit_progress(window: &tauri::Window, stage: &str, pct: u8, msg: &str) {
    let _ = window.emit("scan_progress", ScanProgress { stage: stage.to_string(), percentage: pct, message: msg.to_string() });
}
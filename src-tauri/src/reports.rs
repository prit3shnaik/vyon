use crate::types::{Finding, ReportData, Severity};
use anyhow::Result;

pub async fn export(data: &ReportData, format: &str, output_path: &str) -> Result<String> {
    let content = match format {
        "html" => generate_html(data),
        "markdown" | "md" => generate_markdown(data),
        "json" => serde_json::to_string_pretty(data)?,
        _ => return Err(anyhow::anyhow!("Unsupported format: {}", format)),
    };
    std::fs::write(output_path, &content)?;
    Ok(output_path.to_string())
}

fn severity_str(s: &Severity) -> &'static str {
    match s {
        Severity::Critical => "CRITICAL", Severity::High => "HIGH",
        Severity::Medium => "MEDIUM", Severity::Low => "LOW",
        Severity::Informational => "INFO", Severity::Optimization => "OPT",
    }
}

fn severity_color(s: &Severity) -> &'static str {
    match s {
        Severity::Critical => "#ff2d55", Severity::High => "#ff6b35",
        Severity::Medium => "#ffd60a", Severity::Low => "#34c759",
        Severity::Informational => "#636366", Severity::Optimization => "#5e5ce6",
    }
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

fn generate_html(data: &ReportData) -> String {
    let scan = &data.scan_result;
    let risk = &scan.risk_score;
    let findings_rows: String = scan.findings.iter().map(|f| {
        format!("<tr><td><span class='badge' style='background:{}'>{}</span></td><td>{}</td><td>{}</td><td>{}</td></tr>",
            severity_color(&f.severity), severity_str(&f.severity), html_escape(&f.title),
            f.location.as_deref().unwrap_or("-"), f.tool)
    }).collect();
    format!(r#"<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Vyon Report - {}</title>
<style>body{{font-family:monospace;background:#0a0a0a;color:#e0e0e0;padding:40px}}
h1{{color:#00ffff}}table{{width:100%;border-collapse:collapse}}
th,td{{padding:10px;border-bottom:1px solid #222;text-align:left}}
.badge{{padding:2px 8px;border-radius:3px;font-size:11px;font-weight:bold;color:#000}}</style></head>
<body><h1>⬡ VYON Security Report</h1>
<p>Contract: <strong>{}</strong> | Date: {} | Risk: <strong style="color:#ff2d55">{}</strong></p>
<p>Critical: {} | High: {} | Medium: {} | Low: {}</p>
<table><tr><th>Severity</th><th>Issue</th><th>Location</th><th>Tool</th></tr>{}</table>
</body></html>"#,
        data.contract_name, data.contract_name, data.generated_at,
        risk.label, risk.critical_count, risk.high_count, risk.medium_count, risk.low_count,
        findings_rows)
}

fn generate_markdown(data: &ReportData) -> String {
    let scan = &data.scan_result;
    let risk = &scan.risk_score;
    let mut md = format!("# Vyon Security Report\n\n**Contract:** {}\n**Date:** {}\n**Risk:** {}\n\n| Severity | Issue | Location | Tool |\n|---|---|---|---|\n",
        data.contract_name, data.generated_at, risk.label);
    for f in &scan.findings {
        md.push_str(&format!("| {} | {} | {} | {} |\n",
            severity_str(&f.severity), f.title,
            f.location.as_deref().unwrap_or("-"), f.tool));
    }
    md
}
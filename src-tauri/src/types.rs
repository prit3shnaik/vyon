use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    pub id: String,
    pub title: String,
    pub description: String,
    pub severity: Severity,
    pub tool: String,
    pub location: Option<String>,
    pub code_snippet: Option<String>,
    pub impact: Option<String>,
    pub recommendation: Option<String>,
    pub fixed_code: Option<String>,
    pub confidence: Option<String>,
    pub swc_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Informational,
    Optimization,
}

impl Severity {
    pub fn score(&self) -> u8 {
        match self {
            Severity::Critical => 5,
            Severity::High => 4,
            Severity::Medium => 3,
            Severity::Low => 2,
            Severity::Informational => 1,
            Severity::Optimization => 1,
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "critical" => Severity::Critical,
            "high" => Severity::High,
            "medium" => Severity::Medium,
            "low" => Severity::Low,
            "informational" | "info" => Severity::Informational,
            "optimization" => Severity::Optimization,
            _ => Severity::Informational,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub findings: Vec<Finding>,
    pub scan_duration_ms: u64,
    pub tools_used: Vec<String>,
    pub risk_score: RiskScore,
    pub contract_name: Option<String>,
    pub scan_id: String,
    pub timestamp: String,
    pub slither_error: Option<String>,
    pub mythril_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskScore {
    pub label: String,
    pub score: u8,
    pub critical_count: usize,
    pub high_count: usize,
    pub medium_count: usize,
    pub low_count: usize,
    pub info_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolStatus {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportData {
    pub scan_result: ScanResult,
    pub contract_name: String,
    pub contract_source: Option<String>,
    pub generated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub stage: String,
    pub percentage: u8,
    pub message: String,
}
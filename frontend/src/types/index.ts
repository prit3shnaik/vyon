export type Severity = "critical" | "high" | "medium" | "low" | "informational" | "optimization";

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  tool: string;
  location?: string;
  code_snippet?: string;
  impact?: string;
  recommendation?: string;
  fixed_code?: string;
  confidence?: string;
  swc_id?: string;
}

export interface RiskScore {
  label: string;
  score: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
}

export interface ScanResult {
  findings: Finding[];
  scan_duration_ms: number;
  tools_used: string[];
  risk_score: RiskScore;
  contract_name?: string;
  scan_id: string;
  timestamp: string;
  slither_error?: string;
  mythril_error?: string;
}

export interface ScanProgress {
  stage: string;
  percentage: number;
  message: string;
}

export type AIProvider = "openrouter" | "gemini" | "groq";

export interface AppSettings {
  ai_provider: AIProvider;
  openrouter_key: string;
  gemini_key: string;
  groq_key: string;
  etherscan_key: string;
}

export type View = "scan" | "results" | "settings";

export const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; label: string; priority: number }> = {
  critical:      { color: "#ff2d55", bg: "rgba(255,45,85,0.12)",   label: "CRITICAL", priority: 5 },
  high:          { color: "#ff6b35", bg: "rgba(255,107,53,0.12)",  label: "HIGH",     priority: 4 },
  medium:        { color: "#ffd60a", bg: "rgba(255,214,10,0.12)",  label: "MEDIUM",   priority: 3 },
  low:           { color: "#34c759", bg: "rgba(52,199,89,0.12)",   label: "LOW",      priority: 2 },
  informational: { color: "#636366", bg: "rgba(99,99,102,0.12)",   label: "INFO",     priority: 1 },
  optimization:  { color: "#5e5ce6", bg: "rgba(94,92,230,0.12)",   label: "OPT",      priority: 1 },
};

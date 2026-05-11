use crate::types::Finding;
use anyhow::{anyhow, Result};
use serde_json::{json, Value};

pub async fn explain_finding(finding: Finding, provider: &str, api_key: &str) -> Result<String> {
    let prompt = format!(
        "You are a smart contract security expert. Explain this vulnerability simply (2-3 paragraphs): what it is, why dangerous, how to fix.\n\nFinding: {}\nSeverity: {:?}\nDescription: {}\n{}",
        finding.title, finding.severity, finding.description,
        finding.code_snippet.as_deref().map(|c| format!("\nCode:\n```solidity\n{}\n```", c)).unwrap_or_default()
    );
    match provider {
        "openrouter" => call_openrouter(api_key, &prompt).await,
        "gemini" => call_gemini(api_key, &prompt).await,
        "groq" => call_groq(api_key, &prompt).await,
        _ => Err(anyhow!("Unknown AI provider: {}", provider)),
    }
}

pub async fn test_connection(provider: &str, api_key: &str) -> Result<bool> {
    match provider {
        "openrouter" => call_openrouter(api_key, "Say OK").await.map(|_| true),
        "gemini" => call_gemini(api_key, "Say OK").await.map(|_| true),
        "groq" => call_groq(api_key, "Say OK").await.map(|_| true),
        _ => Err(anyhow!("Unknown provider")),
    }
}

async fn call_openrouter(api_key: &str, prompt: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let body = json!({ "model": "qwen/qwq-32b:free", "messages": [{"role": "user", "content": prompt}], "max_tokens": 600 });
    let resp = client.post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("HTTP-Referer", "https://github.com/vyon-security/vyon")
        .header("X-Title", "Vyon Security Scanner")
        .json(&body).send().await?;
    if !resp.status().is_success() {
        let err: Value = resp.json().await.unwrap_or_default();
        return Err(anyhow!("OpenRouter error: {}", err["error"]["message"].as_str().unwrap_or("Unknown")));
    }
    let data: Value = resp.json().await?;
    data["choices"][0]["message"]["content"].as_str().map(|s| s.to_string()).ok_or_else(|| anyhow!("No content in response"))
}

async fn call_gemini(api_key: &str, prompt: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={}", api_key);
    let body = json!({ "contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"maxOutputTokens": 600} });
    let resp = client.post(&url).json(&body).send().await?;
    if !resp.status().is_success() {
        let err: Value = resp.json().await.unwrap_or_default();
        return Err(anyhow!("Gemini error: {}", err["error"]["message"].as_str().unwrap_or("Unknown")));
    }
    let data: Value = resp.json().await?;
    data["candidates"][0]["content"]["parts"][0]["text"].as_str().map(|s| s.to_string()).ok_or_else(|| anyhow!("No content in response"))
}

async fn call_groq(api_key: &str, prompt: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let body = json!({ "model": "llama3-70b-8192", "messages": [{"role": "user", "content": prompt}], "max_tokens": 600 });
    let resp = client.post("https://api.groq.com/openai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body).send().await?;
    if !resp.status().is_success() {
        let err: Value = resp.json().await.unwrap_or_default();
        return Err(anyhow!("Groq error: {}", err["error"]["message"].as_str().unwrap_or("Unknown")));
    }
    let data: Value = resp.json().await?;
    data["choices"][0]["message"]["content"].as_str().map(|s| s.to_string()).ok_or_else(|| anyhow!("No content in response"))
}
use crate::models::{guess_domains, KnownInfo, LogoResult, MetaInfo, ScrapeRequest, ScrapeResponse};
use std::time::Instant;

fn generate_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("res-{}-{}", n, std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis())
}

/// 主爬取入口
pub async fn scrape(request: ScrapeRequest) -> Result<ScrapeResponse, String> {
    let start = Instant::now();
    let query = request.query;
    let known = KnownInfo::from_name(&query);
    let domains = guess_domains(&query);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    // 使用 tokio::join! 并发执行5个源，无Semaphore简化版（tokio会自动调度）
    let (r1, r2, r3, r4, r5) = tokio::join!(
        fetch_clearbit(&client, &query, &domains),
        fetch_iconhorse(&client, &query, &domains),
        fetch_github_raw(&client, &query, known.as_ref()),
        fetch_wikipedia(&client, &query, known.as_ref()),
        fetch_favicon_svg(&client, &query, &domains),
    );

    let mut results = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for res in [r1, r2, r3, r4, r5] {
        if let Ok(mut items) = res {
            for item in items.drain(..) {
                if seen.insert(item.url.clone()) {
                    results.push(item);
                }
            }
        }
    }

    let elapsed = start.elapsed().as_millis() as u64;

    Ok(ScrapeResponse {
        success: true,
        query: query.clone(),
        results,
        meta: MetaInfo {
            sources_checked: 5,
            results_found: 0,
            elapsed_ms: elapsed,
        },
    })
}

async fn fetch_clearbit(
    client: &reqwest::Client,
    query: &str,
    domains: &[String],
) -> Result<Vec<LogoResult>, String> {
    let mut results = Vec::new();
    for domain in domains.iter().take(3) {
        let url = format!("https://logo.clearbit.com/{}?size=512", domain);
        match client.head(&url).send().await {
            Ok(resp) if resp.status().is_success() => {
                results.push(LogoResult {
                    id: generate_id(),
                    source: format!("Clearbit ({})", domain),
                    source_type: "clearbit".into(),
                    format: "png".into(),
                    url,
                    width: Some(512),
                    height: Some(512),
                    title: query.into(),
                });
                break;
            }
            _ => {}
        }
    }
    Ok(results)
}

async fn fetch_iconhorse(
    client: &reqwest::Client,
    query: &str,
    domains: &[String],
) -> Result<Vec<LogoResult>, String> {
    let mut results = Vec::new();
    for domain in domains.iter().take(3) {
        let url = format!("https://icon.horse/icon/{}", domain);
        match client.head(&url).send().await {
            Ok(resp) if resp.status().is_success() => {
                results.push(LogoResult {
                    id: generate_id(),
                    source: format!("IconHorse ({})", domain),
                    source_type: "favicon".into(),
                    format: "png".into(),
                    url,
                    width: None,
                    height: None,
                    title: query.into(),
                });
                break;
            }
            _ => {}
        }
    }
    Ok(results)
}

async fn fetch_github_raw(
    client: &reqwest::Client,
    query: &str,
    known: Option<&KnownInfo>,
) -> Result<Vec<LogoResult>, String> {
    let repo = match known.and_then(|k| k.github.clone()) {
        Some(r) => r,
        None => return Ok(Vec::new()),
    };

    let candidates = [
        format!("https://raw.githubusercontent.com/{}/main/logo.svg", repo),
        format!("https://raw.githubusercontent.com/{}/master/logo.svg", repo),
        format!("https://raw.githubusercontent.com/{}/main/icon.svg", repo),
        format!("https://raw.githubusercontent.com/{}/master/icon.svg", repo),
    ];

    let mut results = Vec::new();
    for url in &candidates {
        match client.head(url).send().await {
            Ok(resp) if resp.status().is_success() => {
                let ct = resp.headers().get("content-type")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("");
                if ct.contains("svg") || url.ends_with(".svg") {
                    results.push(LogoResult {
                        id: generate_id(),
                        source: format!("GitHub Raw ({})", repo),
                        source_type: "github".into(),
                        format: "svg".into(),
                        url: url.clone(),
                        width: None,
                        height: None,
                        title: query.into(),
                    });
                    break;
                }
            }
            _ => {}
        }
    }
    Ok(results)
}

fn encode_wiki(page: &str) -> String {
    page.chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            _ => format!("%{:02X}", c as u8),
        })
        .collect()
}

async fn fetch_wikipedia(
    client: &reqwest::Client,
    query: &str,
    known: Option<&KnownInfo>,
) -> Result<Vec<LogoResult>, String> {
    let page = match known.and_then(|k| k.wikipedia.clone()) {
        Some(p) => p,
        None => return Ok(Vec::new()),
    };

    let url = format!(
        "https://en.wikipedia.org/api/rest_v1/page/summary/{}",
        encode_wiki(&page)
    );

    match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => {
            match resp.json::<serde_json::Value>().await {
                Ok(json) => {
                    if let Some(thumb) = json.get("thumbnail")
                        .and_then(|t| t.get("source"))
                        .and_then(|s| s.as_str())
                    {
                        return Ok(vec![LogoResult {
                            id: generate_id(),
                            source: "Wikipedia".into(),
                            source_type: "wikipedia".into(),
                            format: "png".into(),
                            url: thumb.into(),
                            width: json.get("thumbnail")
                                .and_then(|t| t.get("width"))
                                .and_then(|w| w.as_u64())
                                .map(|w| w as u32),
                            height: json.get("thumbnail")
                                .and_then(|t| t.get("height"))
                                .and_then(|h| h.as_u64())
                                .map(|h| h as u32),
                            title: query.into(),
                        }]);
                    }
                }
                _ => {}
            }
        }
        _ => {}
    }
    Ok(Vec::new())
}

async fn fetch_favicon_svg(
    client: &reqwest::Client,
    query: &str,
    domains: &[String],
) -> Result<Vec<LogoResult>, String> {
    let mut results = Vec::new();
    for domain in domains.iter().take(2) {
        let urls = [
            format!("https://{}/favicon.svg", domain),
            format!("https://{}/icon.svg", domain),
            format!("https://{}/logo.svg", domain),
        ];
        for url in &urls {
            match client.head(url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    results.push(LogoResult {
                        id: generate_id(),
                        source: format!("Direct ({})", domain),
                        source_type: "direct".into(),
                        format: "svg".into(),
                        url: url.clone(),
                        width: None,
                        height: None,
                        title: query.into(),
                    });
                    break;
                }
                _ => {}
            }
        }
    }
    Ok(results)
}

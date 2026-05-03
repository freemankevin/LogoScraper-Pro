use logo_scraper::models::ScrapeRequest;
use std::env;

#[tokio::main]
async fn main() {
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 2 {
        eprintln!("Usage: logo-scraper-cli <query> [--formats svg,png]");
        std::process::exit(1);
    }

    let query = args[1].clone();
    let formats = args.iter()
        .find(|a| a.starts_with("--formats="))
        .map(|a| a.trim_start_matches("--formats=").split(',').map(|s| s.to_string()).collect())
        .unwrap_or_else(|| vec!["svg".into(), "png".into()]);

    println!("🚀 LogoScraper CLI v0.1.0");
    println!("   Query: {}", query);
    println!("   Formats: {:?}\n", formats);

    let request = ScrapeRequest { query, formats };
    
    match logo_scraper::scraper::scrape(request).await {
        Ok(response) => {
            println!("✅ Success! Found {} results in {}ms\n", 
                response.results.len(), 
                response.meta.elapsed_ms
            );
            
            for (i, result) in response.results.iter().enumerate() {
                println!("  [{}] {}", i + 1, result.source);
                println!("      Format: {} | URL: {}", result.format, result.url);
                if let (Some(w), Some(h)) = (result.width, result.height) {
                    println!("      Size: {}x{}", w, h);
                }
                println!();
            }
        }
        Err(e) => {
            eprintln!("❌ Error: {}", e);
            std::process::exit(1);
        }
    }
}

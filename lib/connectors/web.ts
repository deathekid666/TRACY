import type { CollectedResult, PublicConnector } from "./types";

/**
 * Safe development connector.
 * It creates search launch-points rather than scraping restricted/private sources.
 * Replace/extend with approved public APIs in production.
 */
export class WebDiscoveryConnector implements PublicConnector {
  id = "web-discovery";
  label = "Public web discovery";

  async search(query: string): Promise<CollectedResult[]> {
    const q = encodeURIComponent(query);
    return [
      { provider: "Google", title: `Search Google for “${query}”`, url: `https://www.google.com/search?q=${q}` },
      { provider: "Bing", title: `Search Bing for “${query}”`, url: `https://www.bing.com/search?q=${q}` },
      { provider: "DuckDuckGo", title: `Search DuckDuckGo for “${query}”`, url: `https://duckduckgo.com/?q=${q}` },
    ];
  }
}

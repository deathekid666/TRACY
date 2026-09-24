import type { CollectedResult, PublicConnector } from "./types";

type BraveResponse = {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
      age?: string;
      extra_snippets?: string[];
    }>;
  };
};

export class BraveWebConnector implements PublicConnector {
  id = "brave-web";
  label = "Brave Web Search";

  async search(query: string): Promise<CollectedResult[]> {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) {
      console.warn("[TRACY connector] Brave skipped: BRAVE_SEARCH_API_KEY is not configured");
      return [];
    }

    const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("count", "20");
    endpoint.searchParams.set("extra_snippets", "true");
    endpoint.searchParams.set("safesearch", "moderate");

    try {
      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`HTTP ${response.status}: ${detail.slice(0, 300)}`);
      }

      const data = (await response.json()) as BraveResponse;
      return (data.web?.results ?? [])
        .filter((item) => item.url && item.title)
        .map((item) => ({
          provider: "Brave Search",
          title: item.title!,
          url: item.url!,
          snippet: [item.description, ...(item.extra_snippets ?? [])]
            .filter(Boolean)
            .join(" "),
        }));
    } catch (error) {
      console.error("[TRACY connector] Brave failed", error);
      return [];
    }
  }
}

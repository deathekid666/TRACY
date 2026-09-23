import { db } from "@/lib/db";
import { WebDiscoveryConnector } from "@/lib/connectors/web";

const connectors = [new WebDiscoveryConnector()];

export async function collectPublicSources(caseId: string, query: string) {
  const results = (await Promise.all(connectors.map(c => c.search(query)))).flat();

  for (const result of results) {
    const source = await db.source.create({
      data: {
        caseId,
        url: result.url,
        title: result.title,
        provider: result.provider,
        metadata: { query, connector: "public-web-discovery" },
      },
    });
    await db.evidence.create({
      data: {
        caseId,
        sourceId: source.id,
        title: result.title,
        content: result.snippet ?? "Public discovery launch point",
        metadata: { kind: "DISCOVERY", query },
      },
    });
  }

  await db.event.create({
    data: {
      caseId,
      title: "Public-source discovery run",
      description: `Discovery generated ${results.length} source launch-points for: ${query}`,
      occurredAt: new Date(),
      metadata: { query, resultCount: results.length },
    },
  });

  return results;
}

import { db } from "@/lib/db";
import { SerperWebConnector } from "@/lib/connectors/serper";

const connector = new SerperWebConnector();

export async function collectPublicSources(caseId:string,query:string){
  // Phase 1 deliberately uses ONE proven Google query per click.
  // We expand/pivot only after the baseline search is verified in production.
  const results = await connector.search(query);
  const uniqueResults=[...new Map(results.map(r=>[r.url,r])).values()];
  let added=0,skipped=0;

  for(const result of uniqueResults){
    const exists=await db.source.findFirst({where:{caseId,url:result.url},select:{id:true}});
    if(exists){skipped++;continue;}

    const source=await db.source.create({
      data:{
        caseId,
        url:result.url,
        title:result.title,
        provider:result.provider,
        metadata:{query,connector:connector.id}
      }
    });

    await db.evidence.create({
      data:{
        caseId,
        sourceId:source.id,
        title:result.title,
        content:result.snippet||"Public Google search result",
        observedAt:result.observedAt?new Date(result.observedAt):new Date(),
        metadata:{kind:"PUBLIC_SEARCH_RESULT",query,provider:result.provider}
      }
    });
    added++;
  }

  await db.event.create({
    data:{
      caseId,
      title:"Public web discovery run",
      description:`Google discovery found ${uniqueResults.length} results; preserved ${added}, skipped ${skipped} duplicates for: ${query}`,
      occurredAt:new Date(),
      metadata:{query,resultCount:uniqueResults.length,added,skipped,connector:connector.id}
    }
  });

  return {results:uniqueResults,added,skipped,queries:[query]};
}

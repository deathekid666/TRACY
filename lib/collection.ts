import { db } from "@/lib/db";
import { GoogleNewsConnector, WikipediaConnector } from "@/lib/connectors/web";

const connectors=[new WikipediaConnector(),new GoogleNewsConnector()];

export async function collectPublicSources(caseId:string,query:string){
  const batches=await Promise.allSettled(connectors.map(c=>c.search(query)));
  const raw=batches.flatMap(b=>b.status==="fulfilled"?b.value:[]);
  const results=[...new Map(raw.map(r=>[r.url,r])).values()];
  let added=0,skipped=0;

  for(const result of results){
    const exists=await db.source.findFirst({where:{caseId,url:result.url},select:{id:true}});
    if(exists){skipped++;continue;}
    const source=await db.source.create({data:{caseId,url:result.url,title:result.title,provider:result.provider,metadata:{query,connector:"live-public-discovery"}}});
    await db.evidence.create({data:{caseId,sourceId:source.id,title:result.title,content:result.snippet||"Public-source result",observedAt:result.observedAt?new Date(result.observedAt):undefined,metadata:{kind:"PUBLIC_RESULT",query,provider:result.provider}}});
    added++;
  }

  await db.event.create({data:{caseId,title:"Public-source discovery run",description:`Discovery found ${results.length} public results; preserved ${added} new item(s), skipped ${skipped} duplicate(s) for: ${query}`,occurredAt:new Date(),metadata:{query,resultCount:results.length,added,skipped,connectors:connectors.map(c=>c.id)}}});
  return {results,added,skipped};
}

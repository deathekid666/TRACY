import { db } from "@/lib/db";
import { BingRssConnector, DuckDuckGoHtmlConnector, GoogleNewsConnector, WikipediaConnector } from "@/lib/connectors/web";
import { BraveWebConnector } from "@/lib/connectors/brave";

const connectors=[
  new BingRssConnector(),
  new DuckDuckGoHtmlConnector(),
  new WikipediaConnector(),
  new GoogleNewsConnector(),
  new BraveWebConnector(),
];

function unique(values:string[]){return [...new Set(values.map(v=>v.trim()).filter(Boolean))];}

async function buildQueries(caseId:string,input:string){
  const entities=await db.entity.findMany({where:{caseId},select:{type:true,label:true},take:30});
  const context=entities.filter(e=>e.label.toLowerCase()!==input.toLowerCase()).map(e=>e.label).slice(0,4);
  const words=input.trim().split(/\s+/);
  const reversed=words.length>=2&&words.length<=4?[...words].reverse().join(" "):"";
  return unique([
    input,
    reversed,
    `${input} ${context.join(" ")}`,
    `${input} site:linkedin.com/in`,
    `${input} filetype:pdf`,
    `${input} site:github.com`,
  ]).slice(0,6);
}

export async function collectPublicSources(caseId:string,query:string){
  const queries=await buildQueries(caseId,query);
  const tasks=queries.flatMap(q=>connectors.map(async connector=>({query:q,connector:connector.id,results:await connector.search(q)})));
  const batches=await Promise.allSettled(tasks);
  const completed=batches.filter((b):b is PromiseFulfilledResult<{query:string;connector:string;results:any[]}>>=>b.status==="fulfilled").map(b=>b.value);
  const raw=completed.flatMap(b=>b.results.map(result=>({...result,discoveryQuery:b.query,discoveryConnector:b.connector})));
  const results=[...new Map(raw.map(r=>[r.url,r])).values()];
  let added=0,skipped=0;

  for(const result of results){
    const exists=await db.source.findFirst({where:{caseId,url:result.url},select:{id:true}});
    if(exists){skipped++;continue;}
    const source=await db.source.create({data:{caseId,url:result.url,title:result.title,provider:result.provider,metadata:{query,discoveryQuery:result.discoveryQuery,connector:result.discoveryConnector}}});
    await db.evidence.create({data:{caseId,sourceId:source.id,title:result.title,content:result.snippet||"Public-source result",observedAt:result.observedAt?new Date(result.observedAt):undefined,metadata:{kind:"PUBLIC_RESULT",query,discoveryQuery:result.discoveryQuery,provider:result.provider}}});
    added++;
  }

  await db.event.create({data:{caseId,title:"Public-source discovery run",description:`Discovery ran ${queries.length} query variants, found ${results.length} unique public results; preserved ${added}, skipped ${skipped} duplicates for: ${query}`,occurredAt:new Date(),metadata:{query,queries,resultCount:results.length,added,skipped,connectors:connectors.map(c=>c.id)}}});
  return {results,added,skipped,queries};
}

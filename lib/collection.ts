import { db } from "@/lib/db";
import { SerperWebConnector } from "@/lib/connectors/serper";
import type { CollectedResult } from "@/lib/connectors/types";
import { extractEvidenceEntities } from "@/lib/evidence-extraction";
import { enrichPublicSources } from "@/lib/source-enrichment";

const connector = new SerperWebConnector();
const MAX_SEARCHES_PER_RUN = 4;

function norm(value:string){
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
}
function tokens(value:string){return norm(value).split(/\s+/).filter(Boolean);}
function domain(url:string){try{return new URL(url).hostname.replace(/^www\./,"")}catch{return ""}}
function usernameFromUrl(url:string){
  try{
    const u=new URL(url); const host=u.hostname.replace(/^www\./,""); const p=u.pathname.split("/").filter(Boolean);
    if(/linkedin\.com$/.test(host)&&p[0]==="in")return p[1]||"";
    if(/pinterest\.|facebook\.|instagram\.|github\.|x\.com$|twitter\./.test(host))return p[0]||"";
  }catch{}
  return "";
}

function scoreResult(query:string,result:CollectedResult){
  const q=norm(query); const qt=tokens(query);
  const title=norm(result.title); const snippet=norm(result.snippet||""); const url=norm(result.url);
  let score=0; const reasons:string[]=[];
  if(title.includes(q)){score+=55;reasons.push("exact name in title")}
  else {
    const hits=qt.filter(t=>title.split(" ").includes(t)).length;
    if(hits===qt.length&&qt.length){score+=42;reasons.push("all name tokens in title")}
    else if(hits){score+=Math.round(25*hits/qt.length);reasons.push("partial name match")}
  }
  if(snippet.includes(q)){score+=20;reasons.push("exact name in snippet")}
  const urlHits=qt.filter(t=>url.includes(t)).length;
  if(urlHits===qt.length&&qt.length){score+=15;reasons.push("name in URL")}
  const user=usernameFromUrl(result.url);
  if(user&&qt.every(t=>norm(user).includes(t))){score+=10;reasons.push("matching public username")}
  return {score:Math.min(score,100),reasons};
}

function classify(score:number){return score>=70?"STRONG":score>=45?"POSSIBLE":"NOISE"}

function buildPivots(query:string,ranked:Array<CollectedResult & {score:number;classification:string}>){
  const pivots:string[]=[];
  for(const r of ranked.filter(x=>x.classification==="STRONG")){
    const user=usernameFromUrl(r.url);
    if(user && norm(user)!==norm(query)) pivots.push(`"${user}"`);
  }
  pivots.push(`"${query}" filetype:pdf`);
  return [...new Set(pivots)].slice(0,MAX_SEARCHES_PER_RUN-1);
}

export async function collectPublicSources(caseId:string,query:string){
  const primary=await connector.search(query);
  const rankedPrimary=primary.map(r=>({...r,...scoreResult(query,r)})).map(r=>({...r,classification:classify(r.score)}));
  const pivots=buildPivots(query,rankedPrimary);
  const searches=[query,...pivots].slice(0,MAX_SEARCHES_PER_RUN);
  const extra=await Promise.all(pivots.map(async q=>(await connector.search(q)).map(r=>({...r,discoveryQuery:q}))));
  const all=[...rankedPrimary.map(r=>({...r,discoveryQuery:query})),...extra.flat().map(r=>({...r,...scoreResult(query,r)})).map(r=>({...r,classification:classify(r.score)}))];
  const uniqueResults=[...new Map(all.map(r=>[r.url,r])).values()].sort((a,b)=>b.score-a.score);
  let added=0,skipped=0,noise=0;
  const newSourceIds:string[]=[];

  for(const result of uniqueResults){
    if(result.classification==="NOISE"){noise++;continue;}
    const exists=await db.source.findFirst({where:{caseId,url:result.url},select:{id:true}});
    if(exists){skipped++;continue;}
    const source=await db.source.create({data:{
      caseId,url:result.url,title:result.title,provider:result.provider,
      metadata:{query,discoveryQuery:result.discoveryQuery,connector:connector.id,identityScore:result.score,classification:result.classification,reasons:result.reasons}
    }});
    newSourceIds.push(source.id);
    await db.evidence.create({data:{
      caseId,sourceId:source.id,title:result.title,content:result.snippet||"Public Google search result",
      observedAt:result.observedAt?new Date(result.observedAt):new Date(),
      metadata:{kind:"PUBLIC_SEARCH_RESULT",query,discoveryQuery:result.discoveryQuery,provider:result.provider,identityScore:result.score,classification:result.classification,reasons:result.reasons}
    }});
    added++;
  }

  const enrichment=await enrichPublicSources(caseId,newSourceIds);
  const extraction=await extractEvidenceEntities(caseId);

  await db.event.create({data:{caseId,title:"Identity-aware discovery run",
    description:`Ran ${searches.length}/${MAX_SEARCHES_PER_RUN} allowed searches; found ${uniqueResults.length} unique results, preserved ${added}, filtered ${noise} low-relevance results, skipped ${skipped} duplicates.`,
    occurredAt:new Date(),metadata:{query,searches,searchCount:searches.length,resultCount:uniqueResults.length,added,noise,skipped,connector:connector.id}
  }});
  return {results:uniqueResults.filter(r=>r.classification!=="NOISE"),added,skipped,queries:searches,noise,enrichment,extraction};
}

import { db } from "@/lib/db";
import { SerperWebConnector } from "@/lib/connectors/serper";
import type { CollectedResult } from "@/lib/connectors/types";
import { extractEvidenceEntities } from "@/lib/evidence-extraction";
import { enrichPublicSources } from "@/lib/source-enrichment";
import { buildSearchPlan } from "@/lib/search-planner";
import { getPublicPivots } from "@/lib/public-pivots";

const connector=new SerperWebConnector();
const MAX_INITIAL_SEARCHES=7;
const MAX_RECURSIVE_SEARCHES=5;

function norm(value:string){return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()}
function tokens(value:string){return norm(value).split(/\s+/).filter(Boolean)}
function usernameFromUrl(url:string){
  try{
    const u=new URL(url),host=u.hostname.replace(/^www\./,""),p=u.pathname.split("/").filter(Boolean);
    if(/linkedin\.com$/.test(host)&&p[0]==="in")return p[1]||"";
    if(/pinterest\.|facebook\.|instagram\.|github\.|reddit\.|x\.com$|twitter\./.test(host))return p[0]||"";
  }catch{}
  return "";
}
function scoreResult(query:string,result:CollectedResult){
  const q=norm(query),qt=tokens(query),title=norm(result.title),snippet=norm(result.snippet||""),url=norm(result.url);
  let score=0;const reasons:string[]=[];
  if(title.includes(q)){score+=55;reasons.push("exact query in title")}
  else{const hits=qt.filter(t=>title.split(" ").includes(t)).length;if(hits===qt.length&&qt.length){score+=42;reasons.push("all query tokens in title")}else if(hits){score+=Math.round(25*hits/qt.length);reasons.push("partial query match")}}
  if(snippet.includes(q)){score+=20;reasons.push("exact query in snippet")}
  const urlHits=qt.filter(t=>url.includes(t)).length;if(urlHits===qt.length&&qt.length){score+=15;reasons.push("query in URL")}
  const user=usernameFromUrl(result.url);if(user&&qt.every(t=>norm(user).includes(t))){score+=10;reasons.push("matching public username")}
  return {score:Math.min(score,100),reasons};
}
function classify(score:number){return score>=70?"STRONG":score>=45?"POSSIBLE":"NOISE"}

type Ranked=CollectedResult&{score:number;reasons:string[];classification:string;discoveryQuery:string};

async function runQueries(original:string,queries:string[]){
  const batches=await Promise.all(queries.map(async discoveryQuery=>{
    const results=await connector.search(discoveryQuery);
    return results.map(result=>{
      const scored=scoreResult(original,result);
      return {...result,...scored,classification:classify(scored.score),discoveryQuery} as Ranked;
    });
  }));
  return batches.flat();
}

async function preserve(caseId:string,original:string,results:Ranked[]){
  const unique=[...new Map(results.map(r=>[r.url,r])).values()].sort((a,b)=>b.score-a.score);
  let added=0,skipped=0,noise=0;const sourceIds:string[]=[];
  for(const result of unique){
    if(result.classification==="NOISE"){noise++;continue}
    const exists=await db.source.findFirst({where:{caseId,url:result.url},select:{id:true}});
    if(exists){skipped++;continue}
    const source=await db.source.create({data:{caseId,url:result.url,title:result.title,provider:result.provider,metadata:{query:original,discoveryQuery:result.discoveryQuery,connector:connector.id,identityScore:result.score,classification:result.classification,reasons:result.reasons}}});
    sourceIds.push(source.id);
    await db.evidence.create({data:{caseId,sourceId:source.id,title:result.title,content:result.snippet||"Public search result",observedAt:result.observedAt?new Date(result.observedAt):new Date(),metadata:{kind:"PUBLIC_SEARCH_RESULT",query:original,discoveryQuery:result.discoveryQuery,provider:result.provider,identityScore:result.score,classification:result.classification,reasons:result.reasons}}});
    added++;
  }
  return {unique,added,skipped,noise,sourceIds};
}

export async function collectPublicSources(caseId:string,query:string){
  const plan=buildSearchPlan(query);
  const initialQueries=plan.queries.slice(0,MAX_INITIAL_SEARCHES);
  const firstResults=await runQueries(query,initialQueries);
  const first=await preserve(caseId,query,firstResults);
  const firstEnrichment=await enrichPublicSources(caseId,first.sourceIds);
  const firstExtraction=await extractEvidenceEntities(caseId);

  const pivotQueries=(await getPublicPivots(caseId,query,MAX_RECURSIVE_SEARCHES)).filter(q=>!initialQueries.includes(q));
  let second={unique:[] as Ranked[],added:0,skipped:0,noise:0,sourceIds:[] as string[]};
  let secondEnrichment={attempted:0,fetched:0,failed:0};
  let secondExtraction={entitiesCreated:0,linksCreated:0};

  if(pivotQueries.length){
    const pivotResults=await runQueries(query,pivotQueries);
    second=await preserve(caseId,query,pivotResults);
    secondEnrichment=await enrichPublicSources(caseId,second.sourceIds);
    secondExtraction=await extractEvidenceEntities(caseId);
  }

  const all=[...first.unique,...second.unique];
  const uniqueResults=[...new Map(all.map(r=>[r.url,r])).values()].sort((a,b)=>b.score-a.score);
  const searches=[...initialQueries,...pivotQueries];
  const added=first.added+second.added,skipped=first.skipped+second.skipped,noise=first.noise+second.noise;

  await db.event.create({data:{caseId,title:"Recursive public-footprint discovery",description:`Ran ${searches.length} public searches across ${plan.kind.toLowerCase()} discovery and evidence-derived pivots; preserved ${added} new sources, filtered ${noise} low-relevance results and skipped ${skipped} duplicates.`,occurredAt:new Date(),metadata:{query,inputKind:plan.kind,initialQueries,pivotQueries,searchCount:searches.length,added,noise,skipped,firstEnrichment,secondEnrichment,firstExtraction,secondExtraction}}});

  return {results:uniqueResults.filter(r=>r.classification!=="NOISE"),added,skipped,queries:searches,noise,enrichment:{first:firstEnrichment,second:secondEnrichment},extraction:{first:firstExtraction,second:secondExtraction}};
}

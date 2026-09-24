import { db } from "@/lib/db";
import { SerperWebConnector } from "@/lib/connectors/serper";
import type { CollectedResult } from "@/lib/connectors/types";
import { extractEvidenceEntities } from "@/lib/evidence-extraction";
import { enrichPublicSources } from "@/lib/source-enrichment";
import { buildSearchPlan } from "@/lib/search-planner";
import { getPublicPivots } from "@/lib/public-pivots";
import { fetchPublicPage } from "@/lib/public-page";
import { CrossrefConnector } from "@/lib/connectors/crossref";
import { OpenAlexConnector } from "@/lib/connectors/openalex";
import { InternetArchiveConnector } from "@/lib/connectors/internet-archive";

const connector=new SerperWebConnector();
const independentConnectors=[new CrossrefConnector(),new OpenAlexConnector(),new InternetArchiveConnector()];
const MAX_INITIAL_SEARCHES=14;
const MAX_RECURSIVE_SEARCHES=4;
const MAX_SERPER_CALLS=18;
const MAX_DEEP_DOCUMENT_CHECKS=18;

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
function allTokensPresent(haystack:string,needles:string[]){const hs=new Set(norm(haystack).split(/\s+/).filter(Boolean));return needles.length>0&&needles.every(t=>hs.has(t))}
function reversedQuery(query:string){return query.trim().split(/\s+/).reverse().join(" ")}
function identityInText(text:string,query:string){
  const tt=tokens(text),qt=tokens(query);if(!tt.length||!qt.length)return false;
  const first=qt[0],last=qt[qt.length-1];
  for(let i=0;i<tt.length;i++){
    if(tt[i]===first){for(let j=i;j<Math.min(tt.length,i+12);j++)if(tt[j]===last)return true}
    if(tt[i]===last){for(let j=i;j<Math.min(tt.length,i+12);j++)if(tt[j]===first)return true}
  }
  return false;
}

function scoreResult(query:string,result:CollectedResult){
  const q=norm(query),rq=norm(reversedQuery(query)),qt=tokens(query);
  const title=norm(result.title),snippet=norm(result.snippet||""),url=norm(result.url);
  let score=0;const reasons:string[]=[];

  if(title.includes(q)||title.includes(rq)){score+=55;reasons.push("name phrase in title")}
  else if(allTokensPresent(title,qt)){score+=48;reasons.push("all name tokens in title")}

  if(snippet.includes(q)||snippet.includes(rq)){score+=35;reasons.push("name phrase in snippet")}
  else if(allTokensPresent(snippet,qt)){score+=32;reasons.push("all name tokens in snippet")}

  if(allTokensPresent(url,qt)){score+=15;reasons.push("name tokens in URL")}
  const user=usernameFromUrl(result.url);
  if(user&&qt.every(t=>norm(user).includes(t))){score+=10;reasons.push("matching public username")}

  return {score:Math.min(score,100),reasons};
}
function classify(score:number){return score>=70?"STRONG":score>=45?"POSSIBLE":"NOISE"}
function hasIdentityEvidence(query:string,result:CollectedResult){
  const qt=tokens(query);
  const title=result.title||"",snippet=result.snippet||"",url=result.url||"";
  return allTokensPresent(title,qt)||allTokensPresent(snippet,qt)||allTokensPresent(url,qt);
}
function isDocumentLike(r:CollectedResult){const s=(r.title+" "+r.url+" "+(r.snippet||"")).toLowerCase();return /\.pdf\b|pdf|document|liste|list|resultat|résultat|inscription|etudiant|étudiant|student|students|universit|facult|fsjes|fsjp|cv|resume|mémoire|memoire|soutenance|concours|scribd|academia|researchgate|drive\.google|docs\.google/.test(s)}
function isInstitutionLike(r:CollectedResult){const s=(r.title+" "+r.url+" "+(r.snippet||"")).toLowerCase();return /\.ac\.ma|\.edu\b|universit|facult|fsjes|fsjp|encg|est\b|ecole|école|institut|student|students|etudiant|étudiant/.test(s)}

type Ranked=CollectedResult&{score:number;reasons:string[];classification:string;discoveryQuery:string;page:number};

function pagesForQuery(query:string,index:number){
  if(index<4)return [1,2];
  return [1];
}

async function runIndependentSources(original:string){
  const batches=await Promise.all(independentConnectors.map(async source=>{
    try{
      const results=await source.search(original);
      return results.map(result=>{
        const scored=scoreResult(original,result);
        const identityVisible=hasIdentityEvidence(original,result);
        if(identityVisible){
          scored.score=Math.min(100,scored.score+12);
          scored.reasons.push(source.label+" independent-source signal");
        }else{
          scored.score=0;
          scored.reasons.push("rejected: no identity evidence in independent source metadata");
        }
        return {...result,...scored,classification:classify(scored.score),discoveryQuery:source.id,page:1} as Ranked;
      });
    }catch{
      return [] as Ranked[];
    }
  }));
  return batches.flat();
}

async function runScholarQueries(original:string){
  const names=[original,reversedQuery(original)];
  const batches=await Promise.all(names.map(async discoveryQuery=>{
    try{
      const results=await connector.searchScholar(discoveryQuery,1);
      return results.map(result=>{
        const scored=scoreResult(original,result);
        const identityVisible=hasIdentityEvidence(original,result);
        if(identityVisible){
          scored.score=Math.min(100,scored.score+28);
          scored.reasons.push("Google Scholar author/publication signal");
        }else{
          scored.score=0;
          scored.reasons.push("rejected: no identity evidence in Scholar result");
        }
        return {...result,...scored,classification:classify(scored.score),discoveryQuery:"SCHOLAR "+discoveryQuery,page:1} as Ranked;
      });
    }catch{
      return [] as Ranked[];
    }
  }));
  return batches.flat();
}

async function runQueries(original:string,queries:string[],deep=true){
  const jobs:Array<{query:string;page:number}>=[];
  for(let i=0;i<queries.length;i++){
    const pages=deep?pagesForQuery(queries[i],i):[1];
    for(const page of pages){
      if(jobs.length>=MAX_SERPER_CALLS)break;
      jobs.push({query:queries[i],page});
    }
    if(jobs.length>=MAX_SERPER_CALLS)break;
  }

  const batches=await Promise.all(jobs.map(async job=>{
    const results=await connector.searchPage(job.query,job.page);
    return results.map(result=>{
      const scored=scoreResult(original,result);
      const combined=result.title+" "+(result.snippet||"");
      const identityVisible=hasIdentityEvidence(original,result);
      if(identityVisible&&isDocumentLike(result)){scored.score=Math.min(100,scored.score+18);scored.reasons.push("document signal with identity evidence");if(allTokensPresent(combined,tokens(original))&&scored.score<60){scored.score=60;scored.reasons.push("all identity tokens inside document result")}}
      if(identityVisible&&isInstitutionLike(result)){scored.score=Math.min(100,scored.score+12);scored.reasons.push("institution signal with identity evidence");if(allTokensPresent(combined,tokens(original))&&scored.score<60){scored.score=60;scored.reasons.push("all identity tokens inside institutional result")}}
      if(!identityVisible){scored.score=0;scored.reasons.push("rejected: no identity evidence in result")}
      return {...result,...scored,classification:classify(scored.score),discoveryQuery:job.query,page:job.page} as Ranked;
    });
  }));
  return {results:batches.flat(),calls:jobs.length,jobs};
}

async function preserve(caseId:string,original:string,results:Ranked[]){
  const byUrl=new Map<string,Ranked>();
  for(const r of results){const prev=byUrl.get(r.url);if(!prev||r.score>prev.score)byUrl.set(r.url,r)}
  const unique=[...byUrl.values()].sort((a,b)=>b.score-a.score);
  let added=0,skipped=0,noise=0,deepValidated=0,deepRejected=0;
  const sourceIds:string[]=[];

  const saveResult=async(result:Ranked,content?:string,sha256?:string,contentType?:string)=>{
    const exists=await db.source.findFirst({where:{caseId,url:result.url},select:{id:true}});
    if(exists){skipped++;return}
    const source=await db.source.create({data:{
      caseId,url:result.url,title:result.title,provider:result.provider,
      metadata:{query:original,discoveryQuery:result.discoveryQuery,page:result.page,connector:connector.id,identityScore:result.score,classification:result.classification,reasons:result.reasons,documentLike:isDocumentLike(result),institutionLike:isInstitutionLike(result)}
    }});
    await db.evidence.create({data:{
      caseId,sourceId:source.id,title:result.title,content:result.snippet||"Public search result",
      observedAt:result.observedAt?new Date(result.observedAt):new Date(),
      metadata:{kind:"PUBLIC_SEARCH_RESULT",query:original,discoveryQuery:result.discoveryQuery,page:result.page,provider:result.provider,identityScore:result.score,classification:result.classification,reasons:result.reasons}
    }});
    if(content){
      await db.evidence.create({data:{
        caseId,sourceId:source.id,title:"Verified document/page content: "+result.title,content,sha256,observedAt:new Date(),
        metadata:{kind:"PUBLIC_PAGE_CAPTURE",requestedUrl:result.url,contentType:contentType||"unknown",identityVerified:true}
      }});
    }else sourceIds.push(source.id);
    added++;
  };

  for(const result of unique.filter(r=>r.classification!=="NOISE"))await saveResult(result);

  const deepCandidates=unique.filter(r=>r.classification==="NOISE"&&(isDocumentLike(r)||isInstitutionLike(r))).slice(0,MAX_DEEP_DOCUMENT_CHECKS);
  const checks=await Promise.all(deepCandidates.map(async result=>{
    const exists=await db.source.findFirst({where:{caseId,url:result.url},select:{id:true}});
    if(exists)return {result,page:null,exists:true};
    const page=await fetchPublicPage(result.url);
    return {result,page,exists:false};
  }));

  for(const checked of checks){
    if(checked.exists){skipped++;continue}
    if(!checked.page||!identityInText(checked.page.text,original)){deepRejected++;noise++;continue}
    checked.result.score=Math.max(65,checked.result.score);
    checked.result.classification="POSSIBLE";
    checked.result.reasons=[...checked.result.reasons.filter(r=>!r.startsWith("rejected:")),"identity found inside fetched public document/page"];
    await saveResult(checked.result,checked.page.text,checked.page.sha256,checked.page.contentType);
    deepValidated++;
  }

  const deepSet=new Set(deepCandidates.map(r=>r.url));
  noise+=unique.filter(r=>r.classification==="NOISE"&&!deepSet.has(r.url)).length;
  return {unique,added,skipped,noise,deepValidated,deepRejected,sourceIds};
}

export async function collectPublicSources(caseId:string,query:string){
  const stale=await db.source.findMany({where:{caseId,provider:{startsWith:"Google / Serper"}},select:{id:true,metadata:true}});
  const staleIds=stale.filter(s=>{const m=(s.metadata??{}) as Record<string,unknown>;return m.classification==="UNVERIFIED"||m.classification==="CANDIDATE"}).map(s=>s.id);
  if(staleIds.length){await db.evidence.deleteMany({where:{sourceId:{in:staleIds}}});await db.source.deleteMany({where:{id:{in:staleIds}}});}
  const plan=buildSearchPlan(query);
  const initialQueries=plan.queries.slice(0,MAX_INITIAL_SEARCHES);
  const firstRun=await runQueries(query,initialQueries,true);
  const scholarResults=plan.kind==="PERSON"?await runScholarQueries(query):[];
  const independentResults=plan.kind==="PERSON"?await runIndependentSources(query):[];
  const first=await preserve(caseId,query,[...firstRun.results,...scholarResults,...independentResults]);
  const firstEnrichment=await enrichPublicSources(caseId,first.sourceIds);
  const firstExtraction=await extractEvidenceEntities(caseId);

  const pivotQueries=(await getPublicPivots(caseId,query,MAX_RECURSIVE_SEARCHES)).filter(q=>!initialQueries.includes(q));
  let second={unique:[] as Ranked[],added:0,skipped:0,noise:0,deepValidated:0,deepRejected:0,sourceIds:[] as string[]};
  let secondCalls=0;
  let secondEnrichment={attempted:0,fetched:0,failed:0};
  let secondExtraction={entitiesCreated:0,linksCreated:0,removedUnsafePhones:0};

  if(pivotQueries.length){
    const pivotRun=await runQueries(query,pivotQueries,false);
    secondCalls=pivotRun.calls;
    second=await preserve(caseId,query,pivotRun.results);
    secondEnrichment=await enrichPublicSources(caseId,second.sourceIds);
    secondExtraction=await extractEvidenceEntities(caseId);
  }

  const all=[...first.unique,...second.unique];
  const finalByUrl=new Map<string,Ranked>();
  for(const r of all){const prev=finalByUrl.get(r.url);if(!prev||r.score>prev.score)finalByUrl.set(r.url,r)}
  const uniqueResults=[...finalByUrl.values()].sort((a,b)=>b.score-a.score);
  const added=first.added+second.added,skipped=first.skipped+second.skipped,noise=first.noise+second.noise;
  const deepValidated=first.deepValidated+second.deepValidated,deepRejected=first.deepRejected+second.deepRejected;
  const serperCalls=firstRun.calls+secondCalls;

  await db.event.create({data:{
    caseId,title:"Deep public-footprint discovery",
    description:`Used ${serperCalls} paginated public-web searches; preserved ${added} identity-supported sources, verified ${deepValidated} names inside fetched documents/pages, rejected ${deepRejected} deep candidates and filtered ${noise} unrelated results. Removed ${staleIds.length} stale unverified sources.`,
    occurredAt:new Date(),
    metadata:{query,inputKind:plan.kind,initialQueries,pivotQueries,serperCalls,scholarResultCount:scholarResults.length,independentResultCount:independentResults.length,added,noise,skipped,deepValidated,deepRejected,removedStale:staleIds.length,firstEnrichment,secondEnrichment,firstExtraction,secondExtraction}
  }});

  return {results:uniqueResults.filter(r=>r.classification!=="NOISE"),added,skipped,queries:[...initialQueries,...pivotQueries],noise,serperCalls,scholarResultCount:scholarResults.length,independentResultCount:independentResults.length,deepValidated,deepRejected,removedStale:staleIds.length,enrichment:{first:firstEnrichment,second:secondEnrichment},extraction:{first:firstExtraction,second:secondExtraction}};
}

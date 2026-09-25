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
import { buildNamePlatformQueries, buildUsernamePlatformQueries, type PlatformDiscoveryQuery } from "@/lib/platform-discovery";
import { curateSources } from "@/lib/source-curation";
import { buildAcademicQueries } from "@/lib/academic-discovery";
import { extractAcademicIntelligence } from "@/lib/academic-intelligence";
import { DISCOVERY_VERSION } from "@/lib/discovery-version";
import { sanitizePostgresJson, sanitizePostgresText } from "@/lib/postgres-sanitize";

const connector=new SerperWebConnector();
const independentConnectors=[new CrossrefConnector(),new OpenAlexConnector(),new InternetArchiveConnector()];
const MAX_INITIAL_SEARCHES=20;
const MAX_RECURSIVE_SEARCHES=4;
const MAX_SERPER_CALLS=30;
const MAX_DEEP_DOCUMENT_CHECKS=24;
const MAX_PLATFORM_CALLS=30;

const RESERVED_PIVOT_HANDLES=new Set([
  "public","profile","profiles","people","user","users","help","support","groups","pages",
  "reel","reels","explore","community","communities","business","search","topics","settings",
  "watch","events","marketplace","about","login","signin","signup","register"
]);

function validPivotHandle(value:string){
  const v=value.toLowerCase().replace(/^@/,"").trim();
  const looksLikeDomain=/\.(?:com|net|org|io|co|ma|fr|uk|me|tv|dev|app)$/i.test(v);
  const hasLetter=/[a-z]/.test(v);
  return /^[a-z0-9._-]{3,32}$/.test(v)&&hasLetter&&!looksLikeDomain&&!RESERVED_PIVOT_HANDLES.has(v);
}

function reservedPlatformArtifact(metadata:unknown){
  const m=(metadata??{}) as Record<string,unknown>;
  const q=typeof m.discoveryQuery==="string"?m.discoveryQuery:"";
  if(!q.startsWith("PLATFORM "))return false;
  for(const handle of RESERVED_PIVOT_HANDLES){
    if(q.includes('"'+handle+'"'))return true;
  }
  return false;
}
const SERPER_BATCH_SIZE=4;
const SERPER_BATCH_DELAY_MS=1100;

function norm(value:string){return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()}
function tokens(value:string){return norm(value).split(/\s+/).filter(Boolean)}
function usernameFromUrl(url:string){
  try{
    const u=new URL(url),host=u.hostname.replace(/^www\./,""),p=u.pathname.split("/").filter(Boolean);
    if(/reddit\.com$/.test(host)&&p[0]==="user")return p[1]||"";
    if(/snapchat\.com$/.test(host)&&p[0]==="add")return p[1]||"";
    if(/tiktok\.com$|threads\.net$|youtube\.com$/.test(host))return (p[0]||"").replace(/^@/,"");
    if(/pinterest\.|facebook\.|instagram\.|github\.|x\.com$|twitter\.|twitch\.tv$/.test(host))return p[0]||"";
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
  return identityInText(title+" "+snippet,query)||allTokensPresent(url,qt);
}
function surnameVisible(query:string,result:CollectedResult){
  const qt=tokens(query);
  const surname=qt[qt.length-1]||"";
  if(!surname)return false;
  return tokens((result.title||"")+" "+(result.snippet||"")+" "+(result.url||"")).includes(surname);
}
function isDocumentLike(r:CollectedResult){const s=(r.title+" "+r.url+" "+(r.snippet||"")).toLowerCase();return /\.pdf\b|pdf|document|liste|list|resultat|résultat|inscription|etudiant|étudiant|student|students|universit|facult|fsjes|fsjp|cv|resume|mémoire|memoire|soutenance|concours|scribd|academia|researchgate|drive\.google|docs\.google/.test(s)}
function isInstitutionLike(r:CollectedResult){const s=(r.title+" "+r.url+" "+(r.snippet||"")).toLowerCase();return /\.ac\.ma|\.edu\b|universit|facult|fsjes|fsjp|encg|est\b|ecole|école|institut|student|students|etudiant|étudiant/.test(s)}
function isAccountLike(r:CollectedResult){const s=(r.title+" "+r.url+" "+(r.snippet||"")).toLowerCase();return /profile|account|member|author|contributor|forum|community|user\b|github|reddit|medium|tumblr|twitch|instagram|facebook|linkedin|pinterest|threads\.net|tiktok|snapchat|discord|wechat|weixin|hypixel|op\.gg/.test(s)}
function isCommerceLike(r:CollectedResult){const s=(r.title+" "+r.url+" "+(r.snippet||"")).toLowerCase();return /payment|merchant|donation|donate|invoice|receipt|checkout|paypal|stripe|patreon|ko-fi|buymeacoffee|gofundme|crowdfunding|shop|store/.test(s)}
function academicCandidatePlausibility(original:string,r:CollectedResult){
  const q=tokens(original);
  const first=q[0]||"";
  const last=q[q.length-1]||"";
  const title=norm(r.title||"");
  const snippet=norm(r.snippet||"");
  const url=norm(r.url||"");
  const hay=title+" "+snippet+" "+url;
  let score=0;

  if(last&&hay.includes(last)){score+=55}
  if(first&&hay.includes(first)){score+=10}
  if(/student|etudiant|universit|facult|filiere|semestre|apogee|module|liste|list|resultat|inscription|academic|school/.test(hay)){score+=20}
  if(/scribd|\.ac\.ma|\.edu\b|researchgate|academia/.test(hay)){score+=10}
  if(first&&title.includes(first)&&last&&!title.includes(last)){score-=25}
  if(/ambassade|companies|company list|nizar qabbani|home to the world|generic|tourisme|tourism/.test(hay)){score-=35}

  return Math.max(0,Math.min(100,score));
}

function categoryFor(r:CollectedResult){
  if(isAccountLike(r))return "PUBLIC_ACCOUNT";
  if(isCommerceLike(r))return "PUBLIC_COMMERCE";
  if(isInstitutionLike(r))return "ACADEMIC";
  if(isDocumentLike(r))return "DOCUMENT";
  return "GENERAL";
}

type Ranked=CollectedResult&{score:number;reasons:string[];classification:string;discoveryQuery:string;page:number};

function pagesForQuery(query:string,index:number){
  if(index<2)return [1,2,3];
  if(/email|gmail|contact/i.test(query))return [1,2];
  if(/\bsite:|\bfiletype:/i.test(query))return [1,2];
  return [1];
}

async function runPlatformDiscovery(original:string,usernames:string[],includeName=true){
  const selected:PlatformDiscoveryQuery[]=[];
  if(includeName)selected.push(...buildNamePlatformQueries(original));

  const perUsername=usernames.slice(0,4).map(username=>buildUsernamePlatformQueries(username));
  for(let depth=0;depth<18&&selected.length<MAX_PLATFORM_CALLS;depth++){
    for(const list of perUsername){
      const item=list[depth];
      if(item)selected.push(item);
      if(selected.length>=MAX_PLATFORM_CALLS)break;
    }
  }

  const seen=new Set<string>();
  const jobs=selected.filter(item=>{
    if(seen.has(item.query))return false;
    seen.add(item.query);
    return true;
  }).slice(0,MAX_PLATFORM_CALLS);

  const batches:Ranked[][]=[];
  let failedCalls=0;

  for(let i=0;i<jobs.length;i+=SERPER_BATCH_SIZE){
    const group=jobs.slice(i,i+SERPER_BATCH_SIZE);
    const settled=await Promise.all(group.map(async job=>{
      try{
        const results=await connector.searchPage(job.query,1);
        return results.map(result=>{
          const rootVisible=hasIdentityEvidence(original,result);
          const seedVisible=hasIdentityEvidence(job.seed,result);
          if(!rootVisible&&!seedVisible){
            return {...result,score:0,reasons:["rejected: platform result does not contain root identity or pivot"],classification:"NOISE",discoveryQuery:"PLATFORM "+job.platform+" "+job.query,page:1} as Ranked;
          }

          const base=rootVisible?scoreResult(original,result):scoreResult(job.seed,result);
          if(isAccountLike(result)){
            base.score=Math.min(100,base.score+10);
            base.reasons.push("public "+job.platform+" account/profile signal");
          }

          if(rootVisible){
            base.reasons.push("root identity visible in platform result");
            return {...result,...base,classification:classify(base.score),discoveryQuery:"PLATFORM "+job.platform+" "+job.query,page:1} as Ranked;
          }

          base.score=Math.max(50,Math.min(base.score,65));
          base.reasons.push("username/handle reuse only; requires corroboration");
          return {...result,...base,classification:"POSSIBLE",discoveryQuery:"PLATFORM "+job.platform+" "+job.query,page:1} as Ranked;
        });
      }catch{
        failedCalls++;
        return [] as Ranked[];
      }
    }));
    batches.push(...settled);
    if(i+SERPER_BATCH_SIZE<jobs.length){
      await new Promise(resolve=>setTimeout(resolve,SERPER_BATCH_DELAY_MS));
    }
  }

  if(jobs.length){
    await new Promise(resolve=>setTimeout(resolve,SERPER_BATCH_DELAY_MS));
  }

  return {results:batches.flat(),calls:jobs.length,failedCalls,queries:jobs};
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

  const batches:Ranked[][]=[];
  let failedCalls=0;

  for(let i=0;i<jobs.length;i+=SERPER_BATCH_SIZE){
    const group=jobs.slice(i,i+SERPER_BATCH_SIZE);
    const settled=await Promise.all(group.map(async job=>{
      try{
        const results=await connector.searchPage(job.query,job.page);
        return results.map(result=>{
          const scored=scoreResult(original,result);
          const combined=result.title+" "+(result.snippet||"");
          const identityVisible=hasIdentityEvidence(original,result);
          if(identityVisible&&isDocumentLike(result)){scored.score=Math.min(100,scored.score+18);scored.reasons.push("document signal with identity evidence");if(allTokensPresent(combined,tokens(original))&&scored.score<60){scored.score=60;scored.reasons.push("all identity tokens inside document result")}}
          if(identityVisible&&isInstitutionLike(result)){scored.score=Math.min(100,scored.score+12);scored.reasons.push("institution signal with identity evidence");if(allTokensPresent(combined,tokens(original))&&scored.score<60){scored.score=60;scored.reasons.push("all identity tokens inside institutional result")}}
          if(identityVisible&&isAccountLike(result)){scored.score=Math.min(100,scored.score+10);scored.reasons.push("public account/profile signal")}
          if(identityVisible&&isCommerceLike(result)){scored.score=Math.min(100,scored.score+8);scored.reasons.push("public commerce/payment-page signal")}
          if(!identityVisible){scored.score=0;scored.reasons.push("rejected: no identity evidence in result")}
          return {...result,...scored,classification:classify(scored.score),discoveryQuery:job.query,page:job.page} as Ranked;
        });
      }catch{
        failedCalls++;
        return [] as Ranked[];
      }
    }));
    batches.push(...settled);
    if(i+SERPER_BATCH_SIZE<jobs.length){
      await new Promise(resolve=>setTimeout(resolve,SERPER_BATCH_DELAY_MS));
    }
  }

  if(jobs.length){
    await new Promise(resolve=>setTimeout(resolve,SERPER_BATCH_DELAY_MS));
  }
  return {results:batches.flat(),calls:jobs.length,failedCalls,jobs};
}

async function preserve(caseId:string,original:string,results:Ranked[],deepValidation=true,maxDeepChecks=MAX_DEEP_DOCUMENT_CHECKS,retainUnverifiedCandidates=false){
  // Keep one best result per URL for ranking/deep-fetch decisions, but preserve
  // every distinct search snippet for that URL as evidence. Different queries
  // frequently expose different facts (for example a contact-bearing snippet).
  const byUrl=new Map<string,Ranked>();
  for(const r of results){const prev=byUrl.get(r.url);if(!prev||r.score>prev.score)byUrl.set(r.url,r)}
  const unique=[...byUrl.values()].sort((a,b)=>b.score-a.score);
  const evidenceVariants=[...results]
    .filter(r=>r.classification!=="NOISE")
    .sort((a,b)=>b.score-a.score);
  let added=0,skipped=0,noise=0,deepValidated=0,deepRejected=0,retainedCandidates=0;
  const sourceIds:string[]=[];
  const retainedCandidateUrls=new Set<string>();

  const saveResult=async(result:Ranked,content?:string,sha256?:string,contentType?:string,pageMeta?:{publishedAt?:string;modifiedAt?:string;imageUrl?:string;finalUrl?:string;fetchMode?:string})=>{
    const exists=await db.source.findFirst({where:{caseId,url:result.url},select:{id:true,metadata:true}});
    if(exists){
      const current=(exists.metadata??{}) as Record<string,unknown>;
      const previousScore=typeof current.identityScore==="number"?current.identityScore:0;
      const shouldRefresh=result.score>=previousScore||String(current.classification??"")==="CANDIDATE";
      if(shouldRefresh){
        await db.source.update({
          where:{id:exists.id},
          data:{
            title:sanitizePostgresText(result.title),
            provider:sanitizePostgresText(result.provider),
            metadata:sanitizePostgresJson({
              ...current,
              query:original,
              discoveryQuery:result.discoveryQuery,
              page:result.page,
              connector:connector.id,
              identityScore:Math.max(previousScore,result.score),
              classification:result.classification,
              reasons:result.reasons,
              category:categoryFor(result),
              academicCandidatePlausibility:academicCandidatePlausibility(original,result),
              publishedAt:pageMeta?.publishedAt??result.publishedAt??current.publishedAt,
              modifiedAt:pageMeta?.modifiedAt??current.modifiedAt,
              imageUrl:pageMeta?.imageUrl??current.imageUrl,
              finalUrl:pageMeta?.finalUrl??current.finalUrl,
              fetchMode:pageMeta?.fetchMode??current.fetchMode,
              documentLike:isDocumentLike(result),
              institutionLike:isInstitutionLike(result),
              accountLike:isAccountLike(result),
              commerceLike:isCommerceLike(result)
            }) as any
          }
        });
      }

      const snippet=sanitizePostgresText(result.snippet||"");
      if(snippet&&snippet!=="Public search result"){
        const duplicateSnippet=await db.evidence.findFirst({
          where:{sourceId:exists.id,content:snippet},
          select:{id:true}
        });
        if(!duplicateSnippet){
          await db.evidence.create({data:{
            caseId,sourceId:exists.id,title:sanitizePostgresText(result.title),content:snippet,
            observedAt:result.observedAt?new Date(result.observedAt):new Date(),
            metadata:sanitizePostgresJson({kind:"PUBLIC_SEARCH_RESULT",query:original,discoveryQuery:result.discoveryQuery,page:result.page,provider:result.provider,publishedAt:result.publishedAt,identityScore:result.score,classification:result.classification,reasons:result.reasons})
          }});
        }
      }

      sourceIds.push(exists.id);
      skipped++;
      return
    }
    const source=await db.source.create({data:{
      caseId,url:sanitizePostgresText(result.url),title:sanitizePostgresText(result.title),provider:sanitizePostgresText(result.provider),
      metadata:sanitizePostgresJson({query:original,discoveryQuery:result.discoveryQuery,page:result.page,connector:connector.id,identityScore:result.score,classification:result.classification,reasons:result.reasons,category:categoryFor(result),academicCandidatePlausibility:academicCandidatePlausibility(original,result),publishedAt:pageMeta?.publishedAt??result.publishedAt,modifiedAt:pageMeta?.modifiedAt,imageUrl:pageMeta?.imageUrl,finalUrl:pageMeta?.finalUrl,fetchMode:pageMeta?.fetchMode,documentLike:isDocumentLike(result),institutionLike:isInstitutionLike(result),accountLike:isAccountLike(result),commerceLike:isCommerceLike(result)})
    }});
    await db.evidence.create({data:{
      caseId,sourceId:source.id,title:sanitizePostgresText(result.title),content:sanitizePostgresText(result.snippet||"Public search result"),
      observedAt:result.observedAt?new Date(result.observedAt):new Date(),
      metadata:sanitizePostgresJson({kind:"PUBLIC_SEARCH_RESULT",query:original,discoveryQuery:result.discoveryQuery,page:result.page,provider:result.provider,publishedAt:result.publishedAt,identityScore:result.score,classification:result.classification,reasons:result.reasons})
    }});
    if(content){
      await db.evidence.create({data:{
        caseId,sourceId:source.id,title:sanitizePostgresText("Verified document/page content: "+result.title),content:sanitizePostgresText(content),sha256,observedAt:new Date(),
        metadata:sanitizePostgresJson({kind:"PUBLIC_PAGE_CAPTURE",requestedUrl:result.url,contentType:contentType||"unknown",identityVerified:true,publishedAt:pageMeta?.publishedAt,modifiedAt:pageMeta?.modifiedAt,imageUrl:pageMeta?.imageUrl,finalUrl:pageMeta?.finalUrl,fetchMode:pageMeta?.fetchMode})
      }});
    }else sourceIds.push(source.id);
    added++;
  };

  for(const result of evidenceVariants)await saveResult(result);

  const deepCandidates=deepValidation?unique.filter(r=>r.classification==="NOISE"&&(isDocumentLike(r)||isInstitutionLike(r)||isAccountLike(r)||isCommerceLike(r))).slice(0,maxDeepChecks):[];
  const checks=await Promise.all(deepCandidates.map(async result=>{
    const exists=await db.source.findFirst({where:{caseId,url:result.url},select:{id:true}});
    if(exists)return {result,page:null,exists:true};
    const page=await fetchPublicPage(result.url);
    return {result,page,exists:false};
  }));

  for(const checked of checks){
    if(checked.exists){skipped++;continue}
    if(!checked.page||!identityInText(checked.page.text,original)){
      deepRejected++;
      noise++;
      if(retainUnverifiedCandidates&&surnameVisible(original,checked.result)){
        checked.result.score=Math.max(20,checked.result.score);
        checked.result.classification="CANDIDATE";
        checked.result.reasons=[...checked.result.reasons.filter(r=>!r.startsWith("rejected:")),"academic/document candidate retains the searched surname but full identity was not verified inside fetched content"];
        await saveResult(checked.result);
        retainedCandidateUrls.add(checked.result.url);
        retainedCandidates++;
      }
      continue
    }
    checked.result.score=Math.max(65,checked.result.score);
    checked.result.classification="POSSIBLE";
    checked.result.reasons=[...checked.result.reasons.filter(r=>!r.startsWith("rejected:")),"identity found inside fetched public document/page"];
    await saveResult(checked.result,checked.page.text,checked.page.sha256,checked.page.contentType,{publishedAt:checked.page.publishedAt,modifiedAt:checked.page.modifiedAt,imageUrl:checked.page.imageUrl,finalUrl:checked.page.finalUrl,fetchMode:checked.page.fetchMode});
    deepValidated++;
  }

  const deepSet=new Set(deepCandidates.map(r=>r.url));

  if(retainUnverifiedCandidates){
    const perQuery=new Map<string,number>();
    for(const result of unique){
      if(result.classification!=="NOISE")continue;
      if(deepSet.has(result.url)||retainedCandidateUrls.has(result.url))continue;
      if(!isDocumentLike(result)&&!isInstitutionLike(result))continue;
      if(!surnameVisible(original,result))continue;

      const count=perQuery.get(result.discoveryQuery)??0;
      if(count>=5)continue;
      perQuery.set(result.discoveryQuery,count+1);

      result.score=Math.max(15,result.score);
      result.classification="CANDIDATE";
      result.reasons=[...result.reasons.filter(r=>!r.startsWith("rejected:")),"academic/document candidate returned by exact-name academic search; retained for review"];
      await saveResult(result);
      retainedCandidateUrls.add(result.url);
      retainedCandidates++;
      if(retainedCandidates>=40)break;
    }
  }

  noise+=unique.filter(r=>r.classification==="NOISE"&&!deepSet.has(r.url)&&!retainedCandidateUrls.has(r.url)).length;
  return {unique,added,skipped,noise,deepValidated,deepRejected,retainedCandidates,sourceIds};
}

export async function collectPublicSources(caseId:string,query:string,mode:"quick"|"deep"="deep"){
  const badPivotSources=await db.source.findMany({where:{caseId},select:{id:true,metadata:true}});
  const badPivotIds=badPivotSources.filter(s=>reservedPlatformArtifact(s.metadata)).map(s=>s.id);
  if(badPivotIds.length){
    await db.evidence.deleteMany({where:{sourceId:{in:badPivotIds}}});
    await db.source.deleteMany({where:{id:{in:badPivotIds}}});
  }
  const stale=await db.source.findMany({where:{caseId,provider:{startsWith:"Google / Serper"}},select:{id:true,metadata:true}});
  const staleIds=stale.filter(s=>{const m=(s.metadata??{}) as Record<string,unknown>;return m.classification==="UNVERIFIED"}).map(s=>s.id);
  if(staleIds.length){await db.evidence.deleteMany({where:{sourceId:{in:staleIds}}});await db.source.deleteMany({where:{id:{in:staleIds}}});}
  const plan=buildSearchPlan(query);
  const initialLimit=mode==="quick"?8:MAX_INITIAL_SEARCHES;
  const initialQueries=plan.queries.slice(0,initialLimit);
  const firstRun=await runQueries(query,initialQueries,mode==="deep");
  const scholarResults=mode==="deep"&&plan.kind==="PERSON"?await runScholarQueries(query):[];
  const independentResults=mode==="deep"&&plan.kind==="PERSON"?await runIndependentSources(query):[];
  const academicQueries=plan.kind==="PERSON"?buildAcademicQueries(query).slice(0,mode==="quick"?8:18):[];
  const academicRun=academicQueries.length?await runQueries(query,academicQueries,mode==="deep"):{results:[] as Ranked[],calls:0,failedCalls:0,jobs:[] as Array<{query:string;page:number}>};
  const first=await preserve(caseId,query,[...firstRun.results,...scholarResults,...independentResults],mode==="deep");
  const academic=await preserve(caseId,query,academicRun.results,true,mode==="quick"?10:MAX_DEEP_DOCUMENT_CHECKS,true);
  const existingForEnrichment=await db.source.findMany({where:{caseId},orderBy:{collectedAt:"desc"},take:80,select:{id:true,metadata:true}});
  const staleEnrichmentIds=existingForEnrichment.filter(s=>{const m=(s.metadata??{}) as Record<string,unknown>;return m.enrichmentVersion!==DISCOVERY_VERSION||!m.fetchMode||(!m.publishedAt&&!m.imageUrl)}).map(s=>s.id);
  const firstEnrichmentIds=[...new Set([...first.sourceIds,...academic.sourceIds,...staleEnrichmentIds])];
  const firstEnrichment=await enrichPublicSources(caseId,firstEnrichmentIds,12);
  const firstExtraction=await extractEvidenceEntities(caseId);

  const usernameEntities=await db.entity.findMany({
    where:{caseId,type:"USERNAME"},
    orderBy:{createdAt:"desc"},
    take:12,
    select:{canonical:true,label:true}
  });
  const currentUsernameSeeds=usernameEntities
    .map(e=>(e.canonical||e.label).replace(/^@/,"").trim())
    .filter(validPivotHandle);

  const priorCases=plan.kind==="PERSON"?await db.case.findMany({
    where:{id:{not:caseId},title:{equals:query,mode:"insensitive"}},
    orderBy:{updatedAt:"desc"},
    take:8,
    include:{entities:{where:{type:"USERNAME"},take:20}}
  }):[];

  const priorUsernameSeeds=priorCases.flatMap(prior=>prior.entities
    .map(e=>(e.canonical||e.label).replace(/^@/,"").trim())
    .filter(validPivotHandle));

  const usernameSeeds=[...new Set([...currentUsernameSeeds,...priorUsernameSeeds])].slice(0,12);

  const emptyPlatformRun={results:[] as Ranked[],calls:0,failedCalls:0,queries:[] as PlatformDiscoveryQuery[]};
  const platformRun1=mode==="deep"&&plan.kind==="PERSON"?await runPlatformDiscovery(query,usernameSeeds,true):emptyPlatformRun;
  const platform1=await preserve(caseId,query,platformRun1.results.filter(r=>r.classification!=="NOISE"),false);
  const platformEnrichment1=mode==="deep"&&platform1.sourceIds.length?await enrichPublicSources(caseId,platform1.sourceIds,8):{attempted:0,fetched:0,failed:0};
  const platformExtraction1=platform1.sourceIds.length?await extractEvidenceEntities(caseId):{entitiesCreated:0,linksCreated:0,removedUnsafePhones:0};

  const usernameEntitiesAfterRound1=await db.entity.findMany({
    where:{caseId,type:"USERNAME"},
    orderBy:{createdAt:"desc"},
    take:20,
    select:{canonical:true,label:true}
  });
  const allUsernameSeedsAfterRound1=[...new Set(usernameEntitiesAfterRound1.map(e=>(e.canonical||e.label).replace(/^@/,"").trim()).filter(validPivotHandle))];
  const newUsernameSeeds=allUsernameSeedsAfterRound1.filter(seed=>!usernameSeeds.includes(seed));

  const platformRun2=mode==="deep"&&plan.kind==="PERSON"&&newUsernameSeeds.length?await runPlatformDiscovery(query,newUsernameSeeds,false):emptyPlatformRun;
  const platform2=await preserve(caseId,query,platformRun2.results.filter(r=>r.classification!=="NOISE"),false);
  const platformEnrichment2=mode==="deep"&&platform2.sourceIds.length?await enrichPublicSources(caseId,platform2.sourceIds,6):{attempted:0,fetched:0,failed:0};
  const platformExtraction2=platform2.sourceIds.length?await extractEvidenceEntities(caseId):{entitiesCreated:0,linksCreated:0,removedUnsafePhones:0};

  const pivotQueries=mode==="deep"?(await getPublicPivots(caseId,query,MAX_RECURSIVE_SEARCHES)).filter(q=>!initialQueries.includes(q)):[];
  let second={unique:[] as Ranked[],added:0,skipped:0,noise:0,deepValidated:0,deepRejected:0,retainedCandidates:0,sourceIds:[] as string[]};
  let secondCalls=0;
  let secondEnrichment={attempted:0,fetched:0,failed:0};
  let secondExtraction={entitiesCreated:0,linksCreated:0,removedUnsafePhones:0};

  if(pivotQueries.length){
    const pivotRun=await runQueries(query,pivotQueries,false);
    secondCalls=pivotRun.calls;
    second=await preserve(caseId,query,pivotRun.results,false);
    secondEnrichment=await enrichPublicSources(caseId,second.sourceIds,8);
    secondExtraction=await extractEvidenceEntities(caseId);
  }

  const all=[...first.unique,...academic.unique,...platform1.unique,...platform2.unique,...second.unique];
  const finalByUrl=new Map<string,Ranked>();
  for(const r of all){const prev=finalByUrl.get(r.url);if(!prev||r.score>prev.score)finalByUrl.set(r.url,r)}
  const uniqueResults=[...finalByUrl.values()].sort((a,b)=>b.score-a.score);
  const added=first.added+academic.added+platform1.added+platform2.added+second.added,skipped=first.skipped+academic.skipped+platform1.skipped+platform2.skipped+second.skipped,noise=first.noise+academic.noise+platform1.noise+platform2.noise+second.noise;
  const deepValidated=first.deepValidated+academic.deepValidated+platform1.deepValidated+platform2.deepValidated+second.deepValidated,deepRejected=first.deepRejected+academic.deepRejected+platform1.deepRejected+platform2.deepRejected+second.deepRejected;
  const serperCalls=firstRun.calls+academicRun.calls+platformRun1.calls+platformRun2.calls+secondCalls;
  const failedSerperCalls=(firstRun.failedCalls??0)+(academicRun.failedCalls??0)+(platformRun1.failedCalls??0)+(platformRun2.failedCalls??0);
  const curation=await curateSources(caseId,mode==="deep");
  const academicIntelligence=plan.kind==="PERSON"?await extractAcademicIntelligence(caseId,query):{records:[]};

  await db.event.create({data:{
    caseId,title:"Deep public-footprint discovery",
    description:`${mode==="quick"?"Quick":"Deep"} scan used ${serperCalls} rate-limited public-web searches; ${failedSerperCalls} calls failed after retries. Preserved ${added} identity-supported sources, verified ${deepValidated} names inside fetched documents/pages, rejected ${deepRejected} deep candidates and filtered ${noise} unrelated results. Removed ${staleIds.length} stale unverified sources.`,
    occurredAt:new Date(),
    metadata:{algorithmVersion:DISCOVERY_VERSION,mode,query,inputKind:plan.kind,initialQueries,academicQueries,pivotQueries,usernameSeeds,newUsernameSeeds,platformCalls:platformRun1.calls+platformRun2.calls,platformFailedCalls:platformRun1.failedCalls+platformRun2.failedCalls,platformRounds:[{round:1,usernames:usernameSeeds,queries:platformRun1.queries},{round:2,usernames:newUsernameSeeds,queries:platformRun2.queries}],serperCalls,failedSerperCalls,academicCalls:academicRun.calls,academicFailedCalls:academicRun.failedCalls,academicDeepValidated:academic.deepValidated,academicDeepRejected:academic.deepRejected,academicCandidatesRetained:academic.retainedCandidates,scholarResultCount:scholarResults.length,independentResultCount:independentResults.length,added,noise,skipped,deepValidated,deepRejected,removedStale:staleIds.length,removedReservedPivotArtifacts:badPivotIds.length,firstEnrichment,platformEnrichment1,platformEnrichment2,secondEnrichment,firstExtraction,platformExtraction1,platformExtraction2,secondExtraction,curation,academicIntelligence}
  }});

  return {mode,results:uniqueResults.filter(r=>r.classification!=="NOISE"),added,skipped,queries:[...initialQueries,...academicQueries,...pivotQueries],noise,serperCalls,failedSerperCalls,academicCalls:academicRun.calls,academicCandidatesRetained:academic.retainedCandidates,platformCalls:platformRun1.calls+platformRun2.calls,platformFailedCalls:platformRun1.failedCalls+platformRun2.failedCalls,usernameSeeds,newUsernameSeeds,scholarResultCount:scholarResults.length,independentResultCount:independentResults.length,deepValidated,deepRejected,removedStale:staleIds.length,curation,academicIntelligence,enrichment:{first:firstEnrichment,platformRound1:platformEnrichment1,platformRound2:platformEnrichment2,second:secondEnrichment},extraction:{first:firstExtraction,platformRound1:platformExtraction1,platformRound2:platformExtraction2,second:secondExtraction}};
}

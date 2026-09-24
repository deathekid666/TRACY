import { db } from "@/lib/db";

type CuratedDecision="KEEP"|"REVIEW"|"REJECT";

type AiDecision={
  sourceId:string;
  decision:CuratedDecision;
  category:string;
  summary:string;
  confidence:number;
};

type AiFact={
  type:string;
  value:string;
  confidence:number;
  sourceIds:string[];
};

function norm(value:string){
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9@._-]+/g," ").replace(/\s+/g," ").trim();
}

function tokens(value:string){
  return norm(value).split(" ").filter(Boolean);
}

function hasAll(haystack:string,needles:string[]){
  const set=new Set(tokens(haystack));
  return needles.length>0&&needles.every(t=>set.has(t));
}

function genericNoise(text:string,url:string){
  const s=(text+" "+url).toLowerCase();
  return /help center|how to |welcome to the forum|privacy statement|user agreement|log in|login|register |customer service|dictionary|définition|definition|app store|google play|watch videos|find reels|public user profile|community profile/.test(s);
}

function categoryFrom(source:{url:string;title:string|null;metadata:unknown}){
  const m=(source.metadata??{}) as Record<string,unknown>;
  const existing=String(m.category??"");
  if(existing&&existing!=="GENERAL")return existing;
  const s=((source.title??"")+" "+source.url).toLowerCase();
  if(/linkedin|zoominfo|company|employer|career|job/.test(s))return "PROFESSIONAL";
  if(/universit|faculty|fsjes|student|school|academic|scribd|\.ac\.|\.edu/.test(s))return "EDUCATION";
  if(/instagram|facebook|pinterest|tiktok|twitter|x\.com|threads|reddit|tumblr|twitch|youtube|snapchat|discord|wechat|forum|hypixel|op\.gg/.test(s))return "PUBLIC_ACCOUNT";
  if(/\.pdf|document|resume|cv/.test(s))return "DOCUMENT";
  return existing||"GENERAL";
}

function parseAiText(data:any){
  const chunks:string[]=[];
  for(const item of Array.isArray(data?.output)?data.output:[]){
    if(item?.type!=="message")continue;
    for(const part of Array.isArray(item.content)?item.content:[]){
      if(part?.type==="output_text"&&typeof part.text==="string")chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

async function aiReview(
  personName:string,
  candidates:Array<{id:string;url:string;title:string;snippet:string;deterministic:string}>
){
  const key=process.env.OPENAI_API_KEY;
  if(!key||!candidates.length)return {decisions:[] as AiDecision[],facts:[] as AiFact[],enabled:false};

  const prompt=[
    "You are curating public-source evidence for a self-audit dossier.",
    "Use only the supplied source title, URL and snippet. Do not infer facts that are not explicitly supported.",
    "Reject generic help pages, unrelated corporate pages, generic forum pages, shopping pages, and keyword collisions.",
    "A matching name or a trusted handle can support relevance, but handle-only matches should remain cautious.",
    "Extract useful public facts only when explicit: birth date, aliases, education, employment, public location, nationality, languages, public accounts, public professional facts.",
    "Do not extract medical information, government ID/passport data, passwords, private financial data or other private credentials.",
    "Return JSON only with this shape:",
    '{"decisions":[{"sourceId":"...","decision":"KEEP|REVIEW|REJECT","category":"...","summary":"...","confidence":0}],"facts":[{"type":"BIRTH_DATE|ALIAS|EDUCATION|EMPLOYMENT|LOCATION|NATIONALITY|LANGUAGE|OTHER","value":"...","confidence":0,"sourceIds":["..."]}]}',
    "Person: "+personName,
    "Sources:",
    JSON.stringify(candidates)
  ].join("\n");

  try{
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:process.env.OPENAI_CURATION_MODEL||"gpt-5.6-luna",
        input:prompt,
        max_output_tokens:5000
      }),
      cache:"no-store"
    });
    if(!response.ok)return {decisions:[] as AiDecision[],facts:[] as AiFact[],enabled:true};
    const data=await response.json();
    const text=parseAiText(data).replace(/^```json\s*/i,"").replace(/```$/,"").trim();
    const parsed=JSON.parse(text) as {decisions?:AiDecision[];facts?:AiFact[]};
    return {
      decisions:Array.isArray(parsed.decisions)?parsed.decisions:[],
      facts:Array.isArray(parsed.facts)?parsed.facts:[],
      enabled:true
    };
  }catch{
    return {decisions:[] as AiDecision[],facts:[] as AiFact[],enabled:true};
  }
}

export async function curateSources(caseId:string,useAi=true){
  const investigation=await db.case.findUnique({
    where:{id:caseId},
    include:{
      entities:true,
      sources:{
        include:{evidence:{orderBy:{collectedAt:"desc"},take:3}},
        orderBy:{collectedAt:"desc"},
        take:220
      }
    }
  });
  if(!investigation)return {kept:0,review:0,rejected:0,aiEnabled:false,facts:[] as AiFact[]};

  const person=investigation.entities.find(e=>e.type==="PERSON");
  const personName=person?.label||investigation.title;
  const nameTokens=tokens(personName);
  const usernames=investigation.entities
    .filter(e=>e.type==="USERNAME")
    .map(e=>norm(e.canonical||e.label).replace(/^@/,""))
    .filter(Boolean);

  const preliminary=new Map<string,{decision:CuratedDecision;reason:string;score:number;category:string;snippet:string}>();
  const aiCandidates:Array<{id:string;url:string;title:string;snippet:string;deterministic:string}>=[];

  for(const source of investigation.sources){
    const m=(source.metadata??{}) as Record<string,unknown>;
    const snippet=source.evidence.map(e=>e.content||"").join(" ").slice(0,1800);
    const combined=[source.title||"",source.url,snippet].join(" ");
    const titleAndSnippet=[source.title||"",snippet].join(" ");
    const rootMatch=hasAll(titleAndSnippet,nameTokens)||hasAll(source.url,nameTokens);
    const handleMatch=usernames.some(u=>u.length>=3&&norm(combined).includes(u));
    const identityScore=typeof m.identityScore==="number"?m.identityScore:0;
    let score=identityScore;
    const reasons:string[]=[];

    if(rootMatch){score+=35;reasons.push("root identity visible")}
    if(handleMatch){score+=15;reasons.push("known handle visible")}
    if(genericNoise(combined,source.url)&&!rootMatch&&!handleMatch){score-=70;reasons.push("generic or unrelated page")}
    if(!rootMatch&&!handleMatch){score-=35;reasons.push("no supported identity signal")}

    const decision:CuratedDecision=score>=75?"KEEP":score>=45?"REVIEW":"REJECT";
    const category=categoryFrom(source);
    preliminary.set(source.id,{decision,reason:reasons.join("; ")||"deterministic source review",score,category,snippet});

    if(decision!=="REJECT"&&aiCandidates.length<36){
      aiCandidates.push({
        id:source.id,
        url:source.url,
        title:source.title||source.url,
        snippet:snippet.slice(0,900),
        deterministic:decision+" — "+(reasons.join("; ")||"identity-supported source")
      });
    }
  }

  const ai=useAi?await aiReview(personName,aiCandidates):{decisions:[] as AiDecision[],facts:[] as AiFact[],enabled:false};
  const aiById=new Map(ai.decisions.map(d=>[d.sourceId,d]));

  let kept=0,review=0,rejected=0;
  const finalDecisionById=new Map<string,CuratedDecision>();
  const updates=investigation.sources.map(source=>{
    const pre=preliminary.get(source.id)!;
    const aiDecision=aiById.get(source.id);
    const decision=aiDecision?.decision??pre.decision;
    finalDecisionById.set(source.id,decision);
    if(decision==="KEEP")kept++;
    else if(decision==="REVIEW")review++;
    else rejected++;

    const current=(source.metadata??{}) as Record<string,unknown>;
    return db.source.update({
      where:{id:source.id},
      data:{metadata:{
        ...current,
        curatedDecision:decision,
        curatedReason:aiDecision?.summary||pre.reason,
        curatedConfidence:aiDecision?.confidence??Math.max(0,Math.min(100,pre.score)),
        curatedCategory:aiDecision?.category||pre.category,
        aiCurated:Boolean(aiDecision)
      }}
    });
  });

  for(let i=0;i<updates.length;i+=25){
    await Promise.all(updates.slice(i,i+25));
  }

  const deterministicFacts:AiFact[]=[];
  const seenBirth=new Set<string>();
  const birthPatterns=[
    /(?:date of birth|born(?: on)?|birthday)\s*[:\-]?\s*([0-3]?\d[\/\-.][01]?\d[\/\-.](?:19|20)\d{2})/i,
    /(?:date of birth|born(?: on)?|birthday)\s*[:\-]?\s*([A-Za-z]+\s+[0-3]?\d,?\s+(?:19|20)\d{2})/i,
    /(?:date of birth|born(?: on)?|birthday)\s*[:\-]?\s*([0-3]?\d\s+[A-Za-z]+\s+(?:19|20)\d{2})/i,
    /(?:né|née)(?:\s+le)?\s*[:\-]?\s*([0-3]?\d[\/\-.][01]?\d[\/\-.](?:19|20)\d{2})/i
  ];

  for(const source of investigation.sources){
    if(finalDecisionById.get(source.id)!=="KEEP")continue;
    const body=[source.title||"",...source.evidence.map(e=>e.content||"")].join(" ").slice(0,12000);
    for(const pattern of birthPatterns){
      const match=body.match(pattern);
      const value=match?.[1]?.trim();
      if(value&&!seenBirth.has(value.toLowerCase())){
        seenBirth.add(value.toLowerCase());
        deterministicFacts.push({type:"BIRTH_DATE",value,confidence:82,sourceIds:[source.id]});
        break;
      }
    }
  }

  const factMap=new Map<string,AiFact>();
  for(const fact of [...deterministicFacts,...ai.facts]){
    if(!fact||typeof fact.type!=="string"||typeof fact.value!=="string"||!fact.value.trim())continue;
    const key=fact.type+"|"+norm(fact.value);
    const previous=factMap.get(key);
    if(!previous||fact.confidence>previous.confidence)factMap.set(key,fact);
  }
  const facts=[...factMap.values()];

  await db.event.create({data:{
    caseId,
    title:"Source curation",
    description:"Curated "+investigation.sources.length+" sources: "+kept+" relevant, "+review+" review, "+rejected+" rejected/noise.",
    occurredAt:new Date(),
    metadata:{
      kept,review,rejected,
      aiEnabled:ai.enabled,
      aiRequested:useAi,
      aiDecisionCount:ai.decisions.length,
      facts
    }
  }});

  return {kept,review,rejected,aiEnabled:ai.enabled,facts};
}

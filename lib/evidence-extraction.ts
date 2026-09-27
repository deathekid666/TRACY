import { db } from "@/lib/db";
import { publicDiscoverySurface, usernameFromProfileUrl, validPublicHandle } from "@/lib/public-handles";

const EMAIL=/(?<![A-Z0-9._%+*•…-])[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}(?![A-Z0-9_%+*•…-])/gi;
const USERNAME=/(?<![\w.*%+•…-])@[a-zA-Z0-9._-]{3,32}\b/g;
const PHONE=/(?:\+?\d[\d\s().-]{7,}\d)/g;

function norm(value:string){
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
}
function tokens(value:string){return norm(value).split(" ").filter(Boolean)}
function queryFrom(metadata:unknown){
  const m=(metadata??{}) as Record<string,unknown>;
  return typeof m.query==="string"?m.query:"";
}
function kindFrom(metadata:unknown){
  const m=(metadata??{}) as Record<string,unknown>;
  return typeof m.kind==="string"?m.kind:"";
}
function nearIdentity(text:string,value:string,query:string,radius=180){
  const idx=text.toLowerCase().indexOf(value.toLowerCase());
  if(idx<0)return false;
  const window=text.slice(Math.max(0,idx-radius),Math.min(text.length,idx+value.length+radius));
  const wt=new Set(tokens(window));
  const qt=tokens(query);
  return qt.length>0&&qt.every(t=>wt.has(t));
}
function validUsername(value:string){
  return validPublicHandle(value);
}

function canonicalPhone(raw:string){
  const trimmed=raw.trim();
  const plus=trimmed.startsWith("+");
  const digits=trimmed.replace(/\D/g,"");
  if(digits.length<8||digits.length>15)return "";
  return plus?"+"+digits:digits;
}

export async function extractEvidenceEntities(caseId:string){
  const stale=await db.entity.findMany({
    where:{caseId,type:{in:["EMAIL","PHONE","DOMAIN","USERNAME"]}},
    select:{id:true,metadata:true}
  });
  const staleIds=stale.filter(e=>{
    const m=(e.metadata??{}) as Record<string,unknown>;
    return m.origin==="public-evidence-extraction";
  }).map(e=>e.id);
  if(staleIds.length)await db.entity.deleteMany({where:{id:{in:staleIds}}});

  const evidence=await db.evidence.findMany({
    where:{caseId,sourceId:{not:null}},
    include:{source:{select:{url:true,title:true,metadata:true}}},
    orderBy:{collectedAt:"desc"},
    take:160
  });

  let entitiesCreated=0,linksCreated=0;
  for(const item of evidence){
    if(!item.source)continue;
    const sm=(item.source.metadata??{}) as Record<string,unknown>;
    const cls=String(sm.classification??"");
    if(cls!=="STRONG"&&cls!=="POSSIBLE")continue;
    if(sm.curatedDecision==="REJECT"||publicDiscoverySurface(item.source.url))continue;

    const query=queryFrom(item.metadata)||queryFrom(item.source.metadata);
    const kind=kindFrom(item.metadata);
    const sourceTitle=item.source.title||"";
    const sourceTitleTokens=new Set(tokens(sourceTitle));
    const queryTokens=tokens(query);
    const sourceTitleMatchesIdentity=queryTokens.length>0&&queryTokens.every(t=>sourceTitleTokens.has(t));
    // Capture titles are generated from search titles. They must not supply
    // identity context for an unrelated contact found in a long page body.
    const text=kind==="PUBLIC_PAGE_CAPTURE"?(item.content||""):[item.title,item.content].filter(Boolean).join(" ");
    const found:Array<{type:"EMAIL"|"USERNAME"|"PHONE";raw:string;canonical:string}>=[];

    for(const raw of [...new Set(text.match(EMAIL)??[])].slice(0,10)){
      // A compact search-result snippet may safely inherit identity context from
      // its matching result title. Long page captures may contain unrelated
      // commenters/contacts, so those require the searched identity near the
      // literal address itself.
      const attributable=nearIdentity(text,raw,query,kind==="PUBLIC_SEARCH_RESULT"?320:520)
        ||(kind==="PUBLIC_SEARCH_RESULT"&&sourceTitleMatchesIdentity);
      if(attributable)found.push({type:"EMAIL",raw,canonical:raw.toLowerCase()});
    }

    if(kind==="PUBLIC_SEARCH_RESULT"){
      for(const raw of [...new Set(text.match(PHONE)??[])].slice(0,10)){
        const canonical=canonicalPhone(raw);
        if(canonical&&(nearIdentity(text,raw,query,220)||sourceTitleMatchesIdentity)){
          found.push({type:"PHONE",raw:raw.trim(),canonical});
        }
      }
    }

    const user=usernameFromProfileUrl(item.source.url);
    if(user&&(sourceTitleMatchesIdentity||nearIdentity(text,user,query,320))){
      found.push({type:"USERNAME",raw:"@"+user,canonical:user.toLowerCase()});
    }

    for(const raw of [...new Set(text.match(USERNAME)??[])].slice(0,10)){
      if(validUsername(raw)&&nearIdentity(text,raw,query))found.push({type:"USERNAME",raw,canonical:raw.slice(1).toLowerCase()});
    }

    for(const itemFound of found){
      let entity=await db.entity.findFirst({where:{caseId,type:itemFound.type,canonical:itemFound.canonical}});
      if(!entity){
        entity=await db.entity.create({
          data:{
            caseId,
            type:itemFound.type,
            label:itemFound.raw,
            canonical:itemFound.canonical,
            metadata:{origin:"public-evidence-extraction",confidence:"POSSIBLE",attribution:"contextual public-source match"}
          }
        });
        entitiesCreated++;
      }
      const exists=await db.evidenceEntity.findUnique({
        where:{evidenceId_entityId:{evidenceId:item.id,entityId:entity.id}}
      });
      if(!exists){
        await db.evidenceEntity.create({data:{evidenceId:item.id,entityId:entity.id}});
        linksCreated++;
      }
    }
  }

  await db.event.create({data:{
    caseId,
    title:"Evidence extraction run",
    description:"Extracted "+entitiesCreated+" context-supported identifiers and "+linksCreated+" evidence links. Full-page contacts require nearby identity evidence; title-only attribution is allowed only for compact public-search snippets.",
    occurredAt:new Date(),
    metadata:{entitiesCreated,linksCreated,removedUnsafeEntities:staleIds.length,emailExtraction:"page-near-identity; search-snippet-title-or-near-identity",usernamePromotion:"identity-context-required",phoneExtraction:"context-only",domainBodyExtraction:"disabled"}
  }});

  return {entitiesCreated,linksCreated,removedUnsafePhones:staleIds.length};
}

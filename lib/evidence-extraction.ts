import { db } from "@/lib/db";

const EMAIL=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const USERNAME=/@[a-zA-Z0-9._-]{3,32}\b/g;

function norm(value:string){
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
}
function tokens(value:string){return norm(value).split(" ").filter(Boolean)}
function queryFrom(metadata:unknown){
  const m=(metadata??{}) as Record<string,unknown>;
  return typeof m.query==="string"?m.query:"";
}
function nearIdentity(text:string,value:string,query:string){
  const idx=text.toLowerCase().indexOf(value.toLowerCase());
  if(idx<0)return false;
  const window=text.slice(Math.max(0,idx-180),Math.min(text.length,idx+value.length+180));
  const wt=new Set(tokens(window));
  const qt=tokens(query);
  return qt.length>0&&qt.every(t=>wt.has(t));
}

export async function extractEvidenceEntities(caseId:string){
  const stale=await db.entity.findMany({
    where:{caseId,type:{in:["PHONE","DOMAIN"]}},
    select:{id:true,metadata:true}
  });
  const staleIds=stale.filter(e=>{const m=(e.metadata??{}) as Record<string,unknown>;return m.origin==="public-evidence-extraction"}).map(e=>e.id);
  if(staleIds.length)await db.entity.deleteMany({where:{id:{in:staleIds}}});

  const evidence=await db.evidence.findMany({
    where:{caseId,sourceId:{not:null}},
    include:{source:{select:{url:true,metadata:true}}},
    orderBy:{collectedAt:"desc"},
    take:120
  });

  let entitiesCreated=0,linksCreated=0;
  for(const item of evidence){
    if(!item.source)continue;
    const sm=(item.source.metadata??{}) as Record<string,unknown>;
    const cls=String(sm.classification??"");
    if(cls!=="STRONG"&&cls!=="POSSIBLE")continue;

    const query=queryFrom(item.metadata)||queryFrom(item.source.metadata);
    const text=[item.title,item.content].filter(Boolean).join(" ");

    const found:Array<{type:"EMAIL"|"USERNAME";raw:string;canonical:string}>=[];
    for(const raw of [...new Set(text.match(EMAIL)??[])].slice(0,10)){
      if(nearIdentity(text,raw,query))found.push({type:"EMAIL",raw,canonical:raw.toLowerCase()});
    }

    try{
      const u=new URL(item.source.url);
      const host=u.hostname.replace(/^www\./,"");
      const p=u.pathname.split("/").filter(Boolean);
      let user="";
      if(/linkedin\.com$/.test(host)&&p[0]==="in")user=p[1]||"";
      else if(/facebook\.|instagram\.|pinterest\.|github\.|reddit\.|x\.com$|twitter\./.test(host))user=p[0]||"";
      if(user&&/^[a-z0-9._-]{3,32}$/i.test(user))found.push({type:"USERNAME",raw:"@"+user,canonical:user.toLowerCase()});
    }catch{}

    for(const raw of [...new Set(text.match(USERNAME)??[])].slice(0,10)){
      if(nearIdentity(text,raw,query))found.push({type:"USERNAME",raw,canonical:raw.slice(1).toLowerCase()});
    }

    for(const itemFound of found){
      let entity=await db.entity.findFirst({where:{caseId,type:itemFound.type,canonical:itemFound.canonical}});
      if(!entity){
        entity=await db.entity.create({data:{caseId,type:itemFound.type,label:itemFound.raw,canonical:itemFound.canonical,metadata:{origin:"public-evidence-extraction",confidence:"POSSIBLE"}}});
        entitiesCreated++;
      }
      const exists=await db.evidenceEntity.findUnique({where:{evidenceId_entityId:{evidenceId:item.id,entityId:entity.id}}});
      if(!exists){await db.evidenceEntity.create({data:{evidenceId:item.id,entityId:entity.id}});linksCreated++}
    }
  }

  await db.event.create({data:{
    caseId,title:"Evidence extraction run",
    description:"Extracted "+entitiesCreated+" context-supported identifiers and "+linksCreated+" evidence links. Generic phone/domain scraping is disabled.",
    occurredAt:new Date(),
    metadata:{entitiesCreated,linksCreated,removedUnsafeEntities:staleIds.length,phoneExtraction:"disabled",domainBodyExtraction:"disabled"}
  }});
  return {entitiesCreated,linksCreated,removedUnsafePhones:staleIds.length};
}

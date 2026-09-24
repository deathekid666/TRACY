import { db } from "@/lib/db";

const patterns = {
  EMAIL: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  DOMAIN: /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|ma|fr|co|me|ai|dev|tech|info|biz|edu|gov)\b/gi,
  USERNAME: /@[a-zA-Z0-9._-]{3,32}\b/g,
  PHONE: /(?:\+?\d[\d\s().-]{7,}\d)/g,
};

function clean(type:string,raw:string){
  if(type==="PHONE")return raw.replace(/[^+\d]/g,"");
  return raw.trim().toLowerCase().replace(/^@/,"");
}
function plausible(type:string,value:string){
  if(type==="PHONE"){const digits=value.replace(/\D/g,"");return digits.length>=8&&digits.length<=15}
  if(type==="DOMAIN")return !/^(google|facebook|linkedin|instagram|pinterest|twitter|x)\./i.test(value);
  return value.length>=3;
}

export async function extractEvidenceEntities(caseId:string){
  const evidence=await db.evidence.findMany({where:{caseId},orderBy:{collectedAt:"desc"},take:80});
  let entitiesCreated=0,linksCreated=0;
  for(const item of evidence){
    const text=[item.title,item.content].filter(Boolean).join(" ");
    for(const [type,regex] of Object.entries(patterns)){
      const matches=[...new Set(text.match(regex)??[])].slice(0,25);
      for(const raw of matches){
        const canonical=clean(type,raw); if(!plausible(type,canonical))continue;
        const entityType=type as "EMAIL"|"DOMAIN"|"USERNAME"|"PHONE";
        let entity=await db.entity.findFirst({where:{caseId,type:entityType,canonical}});
        if(!entity){
          entity=await db.entity.create({data:{caseId,type:entityType,label:raw.trim(),canonical,metadata:{origin:"public-evidence-extraction"}}});
          entitiesCreated++;
        }
        const exists=await db.evidenceEntity.findUnique({where:{evidenceId_entityId:{evidenceId:item.id,entityId:entity.id}}});
        if(!exists){await db.evidenceEntity.create({data:{evidenceId:item.id,entityId:entity.id}});linksCreated++;}
      }
    }
  }
  await db.event.create({data:{caseId,title:"Evidence extraction run",description:`Extracted ${entitiesCreated} new public identifiers and ${linksCreated} evidence links.`,occurredAt:new Date(),metadata:{entitiesCreated,linksCreated}}});
  return {entitiesCreated,linksCreated};
}

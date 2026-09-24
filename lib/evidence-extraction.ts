import { db } from "@/lib/db";

const patterns={EMAIL:/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,DOMAIN:/\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|ma|fr|co|me|ai|dev|tech|info|biz|edu|gov)\b/gi,USERNAME:/@[a-zA-Z0-9._-]{3,32}\b/g};
function clean(type:string,raw:string){return raw.trim().toLowerCase().replace(type==="USERNAME"?/^@/:/$^/,"")}
function plausible(type:string,value:string){if(type==="DOMAIN")return !/^(google|facebook|linkedin|instagram|pinterest|twitter|x)\./i.test(value);return value.length>=3}
export async function extractEvidenceEntities(caseId:string){
 const oldPhones=await db.entity.findMany({where:{caseId,type:"PHONE"},select:{id:true,metadata:true}});
 const unsafePhoneIds=oldPhones.filter(x=>{const m=(x.metadata??{}) as Record<string,unknown>;return m.origin==="public-evidence-extraction"}).map(x=>x.id);
 if(unsafePhoneIds.length)await db.entity.deleteMany({where:{id:{in:unsafePhoneIds}}});
 const evidence=await db.evidence.findMany({where:{caseId},orderBy:{collectedAt:"desc"},take:100});let entitiesCreated=0,linksCreated=0;
 for(const item of evidence){const text=[item.title,item.content].filter(Boolean).join(" ");for(const [type,regex] of Object.entries(patterns)){const matches=[...new Set(text.match(regex)??[])].slice(0,25);for(const raw of matches){const canonical=clean(type,raw);if(!plausible(type,canonical))continue;const entityType=type as "EMAIL"|"DOMAIN"|"USERNAME";let entity=await db.entity.findFirst({where:{caseId,type:entityType,canonical}});if(!entity){entity=await db.entity.create({data:{caseId,type:entityType,label:raw.trim(),canonical,metadata:{origin:"public-evidence-extraction",confidence:"UNVERIFIED"}}});entitiesCreated++}const exists=await db.evidenceEntity.findUnique({where:{evidenceId_entityId:{evidenceId:item.id,entityId:entity.id}}});if(!exists){await db.evidenceEntity.create({data:{evidenceId:item.id,entityId:entity.id}});linksCreated++}}}}
 await db.event.create({data:{caseId,title:"Evidence extraction run",description:"Extracted "+entitiesCreated+" public identifiers and "+linksCreated+" evidence links. Phone extraction is disabled until attribution is validated.",occurredAt:new Date(),metadata:{entitiesCreated,linksCreated,phoneExtraction:"disabled",removedUnsafePhones:unsafePhoneIds.length}}});return {entitiesCreated,linksCreated,removedUnsafePhones:unsafePhoneIds.length};
}

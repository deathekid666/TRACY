import { db } from "@/lib/db";

const patterns = {
  EMAIL: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  DOMAIN: /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|ma|fr|co|me|ai)\b/gi,
  USERNAME: /@[a-zA-Z0-9._-]{3,32}\b/g,
};

export async function extractEvidenceEntities(caseId:string){
  const evidence=await db.evidence.findMany({where:{caseId}});
  let entitiesCreated=0, linksCreated=0;

  for(const item of evidence){
    const text=[item.title,item.content].filter(Boolean).join(" ");
    for(const [type,regex] of Object.entries(patterns)){
      const matches=[...new Set(text.match(regex)??[])];
      for(const raw of matches){
        const label=raw.trim();
        const canonical=label.toLowerCase().replace(/^@/,"");
        let entity=await db.entity.findFirst({where:{caseId,type:type as "EMAIL"|"DOMAIN"|"USERNAME",canonical}});
        if(!entity){
          entity=await db.entity.create({data:{caseId,type:type as "EMAIL"|"DOMAIN"|"USERNAME",label,canonical,metadata:{origin:"evidence-extraction"}}});
          entitiesCreated++;
        }
        const exists=await db.evidenceEntity.findUnique({where:{evidenceId_entityId:{evidenceId:item.id,entityId:entity.id}}});
        if(!exists){await db.evidenceEntity.create({data:{evidenceId:item.id,entityId:entity.id}});linksCreated++;}
      }
    }
  }

  await db.event.create({data:{caseId,title:"Evidence extraction run",description:`Extracted ${entitiesCreated} new entities and ${linksCreated} evidence links.`,occurredAt:new Date(),metadata:{entitiesCreated,linksCreated}}});
  return {entitiesCreated,linksCreated};
}

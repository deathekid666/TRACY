import { db } from "@/lib/db";

const norm=(s:string)=>s.trim().toLowerCase().replace(/^@/,"");

export async function correlateCase(caseId:string){
  const entities=await db.entity.findMany({where:{caseId}});
  let created=0;
  for(let i=0;i<entities.length;i++){
    for(let j=i+1;j<entities.length;j++){
      const a=entities[i], b=entities[j];
      if(a.type===b.type) continue;
      const av=norm(a.canonical??a.label), bv=norm(b.canonical??b.label);
      let score=0;
      let reason="";
      if(av && bv && av===bv){score=.92;reason="Normalized identifiers match";}
      else if(av.length>=4 && bv.length>=4 && (av.includes(bv)||bv.includes(av))){score=.68;reason="Identifiers partially overlap";}
      if(score===0) continue;
      const exists=await db.relationship.findFirst({where:{caseId,OR:[{fromEntityId:a.id,toEntityId:b.id},{fromEntityId:b.id,toEntityId:a.id}]}});
      if(!exists){
        await db.relationship.create({data:{caseId,fromEntityId:a.id,toEntityId:b.id,type:"IDENTIFIER_OVERLAP",confidence:score,status:score>=.9?"PROBABLE":"POSSIBLE"}});
        created++;
      }
    }
  }
  await db.event.create({data:{caseId,title:"Entity correlation run",description:`Correlation created ${created} candidate relationship(s).`,occurredAt:new Date(),metadata:{created}}});
  return {created};
}

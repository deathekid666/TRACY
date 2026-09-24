import { db } from "@/lib/db";

function norm(value:string){
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
}
function esc(value:string){return value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}
function identityHit(text:string,query:string){
  const t=norm(text),q=norm(query),parts=q.split(" ").filter(Boolean);
  if(!q||!t)return false;
  if(t.includes(q))return true;
  const reversed=[...parts].reverse().join(" ");
  if(reversed!==q&&t.includes(reversed))return true;
  if(parts.length<2)return t.includes(q);
  const first=esc(parts[0]),last=esc(parts[parts.length-1]);
  const forward=new RegExp("\\b"+first+"\\b(?:\\s+[a-z0-9-]+){0,8}\\s+\\b"+last+"\\b","i");
  const backward=new RegExp("\\b"+last+"\\b(?:\\s+[a-z0-9-]+){0,8}\\s+\\b"+first+"\\b","i");
  return forward.test(t)||backward.test(t);
}

export async function validateCandidateSources(caseId:string,sourceIds:string[],query:string){
  const sources=await db.source.findMany({
    where:{caseId,id:{in:sourceIds}},
    include:{evidence:{select:{id:true,title:true,content:true,metadata:true}}}
  });
  let validated=0,rejected=0;

  for(const source of sources){
    const metadata=(source.metadata??{}) as Record<string,any>;
    if(metadata.classification!=="CANDIDATE")continue;
    const searchable=source.evidence.map(e=>[e.title,e.content].filter(Boolean).join(" ")).join(" ");
    if(identityHit(searchable,query)){
      const reasons=Array.isArray(metadata.reasons)?metadata.reasons:[];
      await db.source.update({
        where:{id:source.id},
        data:{metadata:{...metadata,classification:"POSSIBLE",identityScore:Math.max(Number(metadata.identityScore)||0,60),candidateValidated:true,reasons:[...reasons,"identity verified in fetched/source content"]}}
      });
      validated++;
    }else{
      await db.evidence.deleteMany({where:{sourceId:source.id}});
      await db.source.delete({where:{id:source.id}});
      rejected++;
    }
  }
  return {validated,rejected};
}

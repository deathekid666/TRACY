import { db } from "@/lib/db";

const SAFE_TYPES=new Set(["EMAIL","USERNAME"]);

export async function getPublicPivots(caseId:string,original:string,limit=8){
  const entities=await db.entity.findMany({
    where:{caseId,type:{in:["EMAIL","USERNAME"]}},
    orderBy:{createdAt:"desc"},
    take:30
  });

  const out:string[]=[];
  for(const e of entities){
    if(!SAFE_TYPES.has(e.type))continue;
    const value=(e.canonical||e.label).trim();
    if(!value||value.toLowerCase()===original.trim().toLowerCase())continue;

    if(e.type==="USERNAME"){
      const u=value.replace(/^@/,"");
      out.push('"'+u+'"');
      out.push('"'+u+'" profile account member');
      out.push('"'+u+'" forum author contributor');
    }else if(e.type==="EMAIL"){
      out.push('"'+value+'"');
      out.push('"'+value+'" profile account');
    }

    if(out.length>=limit)break;
  }

  return [...new Set(out)].slice(0,limit);
}

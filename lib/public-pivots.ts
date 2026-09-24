import { db } from "@/lib/db";

const SAFE_TYPES=new Set(["EMAIL","USERNAME","DOMAIN"]);

export async function getPublicPivots(caseId:string,original:string,limit=5){
  const entities=await db.entity.findMany({where:{caseId,type:{in:["EMAIL","USERNAME","DOMAIN"]}},orderBy:{createdAt:"desc"},take:30});
  const out:string[]=[];
  for(const e of entities){
    if(!SAFE_TYPES.has(e.type))continue;
    const value=(e.canonical||e.label).trim();
    if(!value||value.toLowerCase()===original.trim().toLowerCase())continue;
    if(e.type==="USERNAME")out.push(`"${value.replace(/^@/,"")}"`);
    else if(e.type==="EMAIL")out.push(`"${value}"`);
    else if(e.type==="DOMAIN")out.push(`site:${value.replace(/^https?:\/\//i,"").split("/")[0]}`);
    if(out.length>=limit)break;
  }
  return [...new Set(out)].slice(0,limit);
}

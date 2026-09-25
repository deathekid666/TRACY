import { db } from "@/lib/db";
import { fetchPublicPage } from "@/lib/public-page";
import { sanitizePostgresJson, sanitizePostgresText } from "@/lib/postgres-sanitize";
import { DISCOVERY_VERSION } from "@/lib/discovery-version";

const MAX_PAGES=12;
const MAX_CANDIDATES=60;

function classification(source:{metadata:unknown}){
  const metadata=(source.metadata??{}) as Record<string,unknown>;
  return String(metadata.classification??"");
}

export async function enrichPublicSources(caseId:string,sourceIds:string[],maxPages=MAX_PAGES){
  const candidateIds=sourceIds.slice(0,MAX_CANDIDATES);
  const sources=await db.source.findMany({where:{caseId,id:{in:candidateIds}}});
  const order=new Map(sourceIds.map((id,index)=>[id,index]));
  function priority(source:(typeof sources)[number]){
    const m=(source.metadata??{}) as Record<string,unknown>;
    const category=String(m.curatedCategory??m.category??"GENERAL");
    const hay=((source.title??"")+" "+source.url).toLowerCase();
    let score=0;
    if(category==="PROFESSIONAL"||/linkedin\.com|zoominfo\.com/.test(hay))score+=90;
    if(["ACADEMIC","EDUCATION","DOCUMENT"].includes(category)||/scribd\.com|\.ac\.ma|\.edu\b/.test(hay))score+=80;
    if(classification(source)==="STRONG")score+=35;
    else if(classification(source)==="POSSIBLE")score+=25;
    else if(classification(source)==="CANDIDATE")score+=15;
    if(/email|contact|gmail/.test(hay))score+=20;
    return score;
  }
  const prioritized=[...sources].sort((a,b)=>{
    const scoreDiff=priority(b)-priority(a);
    if(scoreDiff!==0)return scoreDiff;
    return (order.get(a.id)??9999)-(order.get(b.id)??9999);
  }).slice(0,Math.max(0,Math.min(MAX_PAGES,maxPages)));

  const outcomes=await Promise.all(prioritized.map(async source=>{
    const page=await fetchPublicPage(source.url);
    if(!page)return false;
    const currentMeta=(source.metadata??{}) as Record<string,unknown>;
    const nextMeta={
      ...currentMeta,
      publishedAt:page.publishedAt??(typeof currentMeta.publishedAt==="string"?currentMeta.publishedAt:undefined),
      modifiedAt:page.modifiedAt??(typeof currentMeta.modifiedAt==="string"?currentMeta.modifiedAt:undefined),
      imageUrl:page.imageUrl??(typeof currentMeta.imageUrl==="string"?currentMeta.imageUrl:undefined),
      finalUrl:page.finalUrl,
      fetchMode:page.fetchMode??"direct",
      enrichmentVersion:DISCOVERY_VERSION
    };
    await db.source.update({
      where:{id:source.id},
      data:{metadata:sanitizePostgresJson(nextMeta) as any}
    });
    await db.evidence.create({data:{
      caseId,sourceId:source.id,title:sanitizePostgresText(`Public page capture: ${source.title||page.finalUrl}`),content:sanitizePostgresText(page.text),
      sha256:page.sha256,observedAt:new Date(page.collectedAt),
      metadata:sanitizePostgresJson({kind:"PUBLIC_PAGE_CAPTURE",requestedUrl:source.url,finalUrl:page.finalUrl,status:page.status,contentType:page.contentType,fetchMode:page.fetchMode??"direct",publishedAt:page.publishedAt,modifiedAt:page.modifiedAt,imageUrl:page.imageUrl})
    }});
    return true;
  }));

  const fetched=outcomes.filter(Boolean).length;
  return {attempted:prioritized.length,fetched,failed:prioritized.length-fetched};
}

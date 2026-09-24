import { db } from "@/lib/db";
import { fetchPublicPage } from "@/lib/public-page";

const MAX_PAGES=12;
const MAX_CANDIDATES=60;

function classification(source:{metadata:unknown}){
  const metadata=(source.metadata??{}) as Record<string,unknown>;
  return String(metadata.classification??"");
}

export async function enrichPublicSources(caseId:string,sourceIds:string[]){
  const candidateIds=sourceIds.slice(0,MAX_CANDIDATES);
  const sources=await db.source.findMany({where:{caseId,id:{in:candidateIds}}});
  const order=new Map(sourceIds.map((id,index)=>[id,index]));
  const prioritized=[...sources].sort((a,b)=>{
    const ac=classification(a)==="CANDIDATE"?0:1;
    const bc=classification(b)==="CANDIDATE"?0:1;
    return ac-bc+(order.get(a.id)!-order.get(b.id)!)/10000;
  }).slice(0,MAX_PAGES);

  const outcomes=await Promise.all(prioritized.map(async source=>{
    const page=await fetchPublicPage(source.url);
    if(!page)return false;
    const currentMeta=(source.metadata??{}) as Record<string,unknown>;
    await db.source.update({
      where:{id:source.id},
      data:{metadata:{
        ...currentMeta,
        publishedAt:page.publishedAt??currentMeta.publishedAt,
        modifiedAt:page.modifiedAt??currentMeta.modifiedAt,
        imageUrl:page.imageUrl??currentMeta.imageUrl,
        finalUrl:page.finalUrl,
        fetchMode:page.fetchMode??"direct"
      }}
    });
    await db.evidence.create({data:{
      caseId,sourceId:source.id,title:`Public page capture: ${source.title||page.finalUrl}`,content:page.text,
      sha256:page.sha256,observedAt:new Date(page.collectedAt),
      metadata:{kind:"PUBLIC_PAGE_CAPTURE",requestedUrl:source.url,finalUrl:page.finalUrl,status:page.status,contentType:page.contentType,fetchMode:page.fetchMode??"direct",publishedAt:page.publishedAt,modifiedAt:page.modifiedAt,imageUrl:page.imageUrl}
    }});
    return true;
  }));

  const fetched=outcomes.filter(Boolean).length;
  return {attempted:prioritized.length,fetched,failed:prioritized.length-fetched};
}

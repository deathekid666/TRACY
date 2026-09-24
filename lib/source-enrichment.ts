import { db } from "@/lib/db";
import { fetchPublicPage } from "@/lib/public-page";

const MAX_PAGES=5;

export async function enrichPublicSources(caseId:string,sourceIds:string[]){
  const sources=await db.source.findMany({where:{caseId,id:{in:sourceIds.slice(0,MAX_PAGES)}}});
  let fetched=0,failed=0;
  for(const source of sources){
    const page=await fetchPublicPage(source.url);
    if(!page){failed++;continue;}
    await db.evidence.create({data:{
      caseId,sourceId:source.id,title:`Public page capture: ${source.title||page.finalUrl}`,content:page.text,
      sha256:page.sha256,observedAt:new Date(page.collectedAt),
      metadata:{kind:"PUBLIC_PAGE_CAPTURE",requestedUrl:source.url,finalUrl:page.finalUrl,status:page.status,contentType:page.contentType}
    }});
    fetched++;
  }
  return {attempted:sources.length,fetched,failed};
}

import { db } from "@/lib/db";
import { fetchPublicPage } from "@/lib/public-page";

const MAX_PAGES=12;

export async function enrichPublicSources(caseId:string,sourceIds:string[]){
  const orderedIds=sourceIds.slice(0,MAX_PAGES);
  const sources=await db.source.findMany({where:{caseId,id:{in:orderedIds}}});
  const byId=new Map(sources.map(s=>[s.id,s]));
  const ordered=orderedIds.map(id=>byId.get(id)).filter((s):s is NonNullable<typeof s>=>Boolean(s));

  const outcomes=await Promise.all(ordered.map(async source=>{
    const page=await fetchPublicPage(source.url);
    if(!page)return false;
    await db.evidence.create({data:{
      caseId,sourceId:source.id,title:`Public page capture: ${source.title||page.finalUrl}`,content:page.text,
      sha256:page.sha256,observedAt:new Date(page.collectedAt),
      metadata:{kind:"PUBLIC_PAGE_CAPTURE",requestedUrl:source.url,finalUrl:page.finalUrl,status:page.status,contentType:page.contentType}
    }});
    return true;
  }));

  const fetched=outcomes.filter(Boolean).length;
  return {attempted:ordered.length,fetched,failed:ordered.length-fetched};
}

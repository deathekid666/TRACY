import { NextResponse } from "next/server";
import { collectPublicSources } from "@/lib/collection";
import { fetchPublicPage } from "@/lib/public-page";
import { db } from "@/lib/db";

export const dynamic="force-dynamic";
export const maxDuration=300;

const CASE_ID="cmuh1yqc00000l70443x30qos";
const CASE_QUERY="nizar laassali";
const TEST_KEY="tracy-v5-acceptance-20260925";
const EMAIL=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export async function GET(request:Request){
  const url=new URL(request.url);
  if(url.searchParams.get("key")!==TEST_KEY)return NextResponse.json({error:"Not found"},{status:404});

  const mode=url.searchParams.get("mode")||"scan";
  if(mode==="linkedin"){
    const source=await db.source.findFirst({
      where:{caseId:CASE_ID,url:{contains:"linkedin.com/in/nizar-laassali",mode:"insensitive"}},
      orderBy:{collectedAt:"desc"}
    });
    if(!source)return NextResponse.json({error:"LinkedIn source not found"},{status:404});
    const page=await fetchPublicPage(source.url);
    const emails=[...new Set((page?.text.match(EMAIL)??[]).map(v=>v.toLowerCase()))];
    return NextResponse.json({
      sourceUrl:source.url,
      fetched:Boolean(page),
      fetchMode:page?.fetchMode,
      status:page?.status,
      textLength:page?.text.length??0,
      emails
    });
  }

  const result=await collectPublicSources(CASE_ID,CASE_QUERY,"quick");
  return NextResponse.json({
    added:result.added,
    noise:result.noise,
    failedSerperCalls:result.failedSerperCalls,
    academicCandidatesRetained:result.academicCandidatesRetained,
    results:result.results.map(r=>({title:r.title,url:r.url,classification:r.classification,score:r.score})).slice(0,80),
    academicIntelligence:result.academicIntelligence
  });
}

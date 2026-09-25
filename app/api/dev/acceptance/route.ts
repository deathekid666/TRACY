import { NextResponse } from "next/server";
import { collectPublicSources } from "@/lib/collection";

export const dynamic="force-dynamic";
export const maxDuration=300;

const TEST_KEY="tracy-osint-v2-acceptance-20260925";

export async function GET(request:Request){
  const url=new URL(request.url);
  if(url.searchParams.get("key")!==TEST_KEY){
    return NextResponse.json({error:"Not found"},{status:404});
  }
  const caseId=url.searchParams.get("caseId")||"";
  const query=url.searchParams.get("query")||"";
  const mode=url.searchParams.get("mode")==="quick"?"quick":"deep";
  if(!caseId||!query)return NextResponse.json({error:"caseId and query are required"},{status:400});

  const result=await collectPublicSources(caseId,query,mode);
  return NextResponse.json({
    mode:result.mode,
    added:result.added,
    skipped:result.skipped,
    noise:result.noise,
    serperCalls:result.serperCalls,
    failedSerperCalls:result.failedSerperCalls,
    academicCalls:result.academicCalls,
    academicCandidatesRetained:result.academicCandidatesRetained,
    platformCalls:result.platformCalls,
    platformFailedCalls:result.platformFailedCalls,
    usernameSeeds:result.usernameSeeds,
    newUsernameSeeds:result.newUsernameSeeds,
    deepValidated:result.deepValidated,
    deepRejected:result.deepRejected,
    curation:result.curation,
    academicIntelligence:result.academicIntelligence,
    results:result.results.slice(0,40).map(r=>({
      title:r.title,url:r.url,snippet:r.snippet,classification:r.classification,
      score:r.score,discoveryQuery:r.discoveryQuery
    }))
  });
}

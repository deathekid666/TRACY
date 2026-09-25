import { NextResponse } from "next/server";
import { collectPublicSources } from "@/lib/collection";
import { SerperWebConnector } from "@/lib/connectors/serper";

export const dynamic="force-dynamic";
export const maxDuration=300;

const TEST_KEY="tracy-osint-v2-acceptance-20260925";
const connector=new SerperWebConnector();

export async function GET(request:Request){
  const url=new URL(request.url);
  if(url.searchParams.get("key")!==TEST_KEY){
    return NextResponse.json({error:"Not found"},{status:404});
  }

  const probe=url.searchParams.get("probe")||"";
  if(probe==="handle"){
    const handle=(url.searchParams.get("handle")||"").replace(/^@/,"").trim();
    if(!handle)return NextResponse.json({error:"handle required"},{status:400});
    const queries=[
      '"'+handle+'"',
      'site:hypixel.net/members "'+handle+'"',
      '"'+handle+'" OP.GG',
      '"'+handle+'" tumblr'
    ];
    const results=[];
    for(const query of queries){
      const rows=await connector.searchPage(query,1);
      results.push({query,rows:rows.slice(0,10)});
    }
    return NextResponse.json({probe:"handle",handle,results});
  }

  if(probe==="contact"){
    const name=(url.searchParams.get("name")||"").trim();
    if(!name)return NextResponse.json({error:"name required"},{status:400});
    const queries=[
      '"'+name+'" email',
      '"'+name+'" gmail',
      'site:linkedin.com/in "'+name+'" email',
      'site:linkedin.com/in "'+name+'" gmail'
    ];
    const results=[];
    for(const query of queries){
      const rows=await connector.searchPage(query,1);
      results.push({query,rows:rows.slice(0,10)});
    }
    return NextResponse.json({probe:"contact",name,results});
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

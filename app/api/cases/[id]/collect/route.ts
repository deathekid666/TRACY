import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collectPublicSources } from "@/lib/collection";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const body=await request.json();
  const query=String(body.query??"").trim();
  const mode=body.mode==="quick"?"quick":"deep";

  if(!query){
    return NextResponse.json({error:"Search query is required"},{status:400});
  }

  const investigation=await db.case.findUnique({where:{id},select:{id:true}});
  if(!investigation){
    return NextResponse.json({error:"Case not found"},{status:404});
  }

  try{
    const outcome=await collectPublicSources(id,query,mode);
    if(outcome.providerStatus==="unavailable"){
      return NextResponse.json({
        error:"Search provider unavailable",
        detail:"Fresh web discovery could not run because the primary search provider failed on every request. Existing case evidence was preserved; this is not a zero-results scan.",
        providerStatus:outcome.providerStatus,
        searchProvider:outcome.searchProvider,
        failedSearchCalls:outcome.failedSerperCalls,
        totalSearchCalls:outcome.serperCalls
      },{status:503});
    }
    return NextResponse.json({
      count:outcome.added,
      found:outcome.results.length,
      skipped:outcome.skipped,
      results:outcome.results,
      queries:outcome.queries,
      filtered:outcome.noise,
      mode:outcome.mode,
      providerStatus:outcome.providerStatus,
      searchProvider:outcome.searchProvider,
      failedSearchCalls:outcome.failedSerperCalls,
      totalSearchCalls:outcome.serperCalls,
      curation:outcome.curation
    });
  }catch(error){
    console.error("Public discovery failed",error);
    const message=error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {error:"Public discovery failed",detail:message},
      {status:500}
    );
  }
}

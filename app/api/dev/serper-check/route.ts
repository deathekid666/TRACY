import { NextResponse } from "next/server";
import { SerperWebConnector } from "@/lib/connectors/serper";
import { collectPublicSources } from "@/lib/collection";

export const dynamic="force-dynamic";
export const maxDuration=300;
const KEY="tracy-serper-check-20260925";
const CASE_ID="cmuh1yqc00000l70443x30qos";

export async function GET(request:Request){
  const url=new URL(request.url);
  if(url.searchParams.get("key")!==KEY)return NextResponse.json({error:"Not found"},{status:404});
  const connector=new SerperWebConnector();
  const mode=url.searchParams.get("mode")||"health";
  try{
    if(mode==="scan"){
      const result=await collectPublicSources(CASE_ID,"nizar laassali","quick");
      return NextResponse.json({
        providerStatus:result.providerStatus,
        serperCalls:result.serperCalls,
        failedSerperCalls:result.failedSerperCalls,
        added:result.added,
        noise:result.noise,
        curation:result.curation,
        results:result.results.slice(0,50).map(r=>({
          title:r.title,url:r.url,snippet:r.snippet,
          classification:r.classification,score:r.score,reasons:r.reasons
        }))
      });
    }
    if(mode==="email"){
      const queries=[
        '"nizar laassali" email',
        '"nizar laassali" gmail',
        'site:linkedin.com/in "nizar laassali"',
        'site:linkedin.com/in "nizar laassali" email'
      ];
      const out=[];
      for(const q of queries){
        const rows=await connector.searchPage(q,1);
        out.push({query:q,results:rows.slice(0,10).map(r=>({title:r.title,url:r.url,snippet:r.snippet}))});
      }
      return NextResponse.json({ok:true,out});
    }
    const rows=await connector.searchPage('"nizar laassali"',1);
    return NextResponse.json({ok:true,count:rows.length,results:rows.slice(0,10).map(r=>({title:r.title,url:r.url,snippet:r.snippet}))});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500});
  }
}
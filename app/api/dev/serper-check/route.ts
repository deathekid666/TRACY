import { NextResponse } from "next/server";
import { SerperWebConnector } from "@/lib/connectors/serper";

export const dynamic="force-dynamic";
const KEY="tracy-serper-check-20260925";

export async function GET(request:Request){
  const url=new URL(request.url);
  if(url.searchParams.get("key")!==KEY)return NextResponse.json({error:"Not found"},{status:404});
  try{
    const rows=await new SerperWebConnector().searchPage('"nizar laassali"',1);
    return NextResponse.json({
      ok:true,
      count:rows.length,
      results:rows.slice(0,10).map(r=>({title:r.title,url:r.url,snippet:r.snippet}))
    });
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500});
  }
}
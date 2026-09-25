import { NextResponse } from "next/server";

export const dynamic="force-dynamic";
export const maxDuration=300;

const KEY="tracy-provider-acceptance-20260925";
const CASE_ID="cmuh1yqc00000l70443x30qos";

export async function GET(request:Request){
  const url=new URL(request.url);
  if(url.searchParams.get("key")!==KEY)return NextResponse.json({error:"Not found"},{status:404});
  const origin=url.origin;
  const response=await fetch(`${origin}/api/cases/${CASE_ID}/collect`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({query:"nizar laassali",mode:"quick"}),
    cache:"no-store"
  });
  const body=await response.json().catch(()=>({}));
  return NextResponse.json({status:response.status,body});
}

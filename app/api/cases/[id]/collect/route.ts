import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { collectPublicSources } from "@/lib/collection";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const body=await request.json();
  const query=String(body.query??"").trim();
  if(!query)return NextResponse.json({error:"Search query is required"},{status:400});
  const investigation=await db.case.findUnique({where:{id},select:{id:true}});
  if(!investigation)return NextResponse.json({error:"Case not found"},{status:404});
  try{
    const outcome=await collectPublicSources(id,query);
    return NextResponse.json({count:outcome.added,found:outcome.results.length,skipped:outcome.skipped,results:outcome.results});
  }catch(error){
    console.error("Public discovery failed",error);
    return NextResponse.json({error:"Public discovery failed"},{status:500});
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { correlateCase } from "@/lib/correlation";

export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const found=await db.case.findUnique({where:{id},select:{id:true}});
 if(!found) return NextResponse.json({error:"Case not found"},{status:404});
 return NextResponse.json(await correlateCase(id));
}

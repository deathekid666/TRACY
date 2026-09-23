import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedMockFinance } from "@/lib/mock-finance";
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;if(!await db.case.findUnique({where:{id},select:{id:true}}))return NextResponse.json({error:"Case not found"},{status:404});return NextResponse.json(await seedMockFinance(id));}

import{NextResponse}from"next/server";import{analyzeCase}from"@/lib/analyst";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const{id}=await params;const{question}=await request.json();try{return NextResponse.json(await analyzeCase(id,String(question??"")))}catch{return NextResponse.json({error:"Case not found"},{status:404})}}

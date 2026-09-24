import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SourceLibrary, type SourceLibraryItem } from "@/components/SourceLibrary";

function meta(value:unknown){return (value??{}) as Record<string,unknown>}

export const dynamic="force-dynamic";

export default async function Sources({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const c=await db.case.findUnique({where:{id},include:{sources:{orderBy:{collectedAt:"desc"}}}});
  if(!c) notFound();

  const items:SourceLibraryItem[]=c.sources.map(s=>{
    const m=meta(s.metadata);
    const decisionRaw=String(m.curatedDecision??"UNREVIEWED");
    const decision:SourceLibraryItem["decision"]=
      decisionRaw==="KEEP"||decisionRaw==="REVIEW"||decisionRaw==="REJECT"?decisionRaw:"UNREVIEWED";

    return {
      id:s.id,
      title:s.title??s.url,
      url:s.url,
      provider:s.provider??"SOURCE",
      collectedAt:s.collectedAt.toISOString(),
      publishedAt:typeof m.publishedAt==="string"?m.publishedAt:undefined,
      modifiedAt:typeof m.modifiedAt==="string"?m.modifiedAt:undefined,
      classification:String(m.classification??"UNCLASSIFIED"),
      category:String(m.curatedCategory??m.category??"GENERAL"),
      decision,
      confidence:typeof m.curatedConfidence==="number"?m.curatedConfidence:(typeof m.identityScore==="number"?m.identityScore:null),
      reason:String(m.curatedReason??""),
      aiCurated:Boolean(m.aiCurated),
      imageUrl:typeof m.imageUrl==="string"?m.imageUrl:undefined
    };
  });

  return <main className="min-h-screen p-6 md:p-10">
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href={`/cases/${id}`} className="text-sm text-slate-400 hover:text-white">← {c.title}</Link>
          <p className="mt-6 text-xs font-semibold tracking-[.3em] text-cyan-300">EVIDENCE LIBRARY</p>
          <h1 className="mt-2 text-3xl font-semibold">Sources</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Every gathered source is displayed by default. TRACY labels each item as relevant, candidate/review, duplicate or low-confidence noise so filtering never makes a finding disappear.</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-right">
          <div className="text-2xl font-semibold">{items.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Total collected</div>
        </div>
      </div>

      <div className="mt-8">
        <SourceLibrary items={items}/>
      </div>
    </div>
  </main>;
}

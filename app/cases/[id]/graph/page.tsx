import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { RelationshipGraph } from "@/components/RelationshipGraph";
import { RunCorrelation } from "@/components/RunCorrelation";

export const dynamic="force-dynamic";

export default async function GraphPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const c=await db.case.findUnique({where:{id},include:{entities:true,relations:true}});
 if(!c) notFound();
 return <main className="min-h-screen p-6 md:p-10"><div className="mx-auto max-w-7xl">
  <Link href={`/cases/${id}`} className="text-sm text-slate-400">← {c.title}</Link>
  <div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs tracking-[.3em] text-cyan-300">ENTITY INTELLIGENCE</p><h1 className="mt-2 text-3xl font-semibold">Relationship graph</h1><p className="mt-2 text-sm text-slate-400">Candidate links remain visibly confidence-scored and require investigator review.</p></div><RunCorrelation caseId={id}/></div>
  <div className="mt-7"><RelationshipGraph entities={c.entities.map(e=>({id:e.id,label:e.label,type:e.type}))} relations={c.relations.map(r=>({id:r.id,fromEntityId:r.fromEntityId,toEntityId:r.toEntityId,type:r.type,confidence:r.confidence,status:r.status}))}/></div>
  <div className="mt-6 grid gap-3">{c.relations.map(r=><div key={r.id} className="flex flex-wrap justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4"><div><span className="text-sm">{r.type}</span><span className="ml-3 text-xs text-slate-500">{r.status}</span></div><div className="text-sm text-cyan-300">{r.confidence?Math.round(r.confidence*100)+"% confidence":"Unscored"}</div></div>)}</div>
 </div></main>;
}

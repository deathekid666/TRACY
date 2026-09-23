import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ExtractEvidence } from "@/components/ExtractEvidence";

export const dynamic="force-dynamic";

export default async function EvidencePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const c=await db.case.findUnique({where:{id},include:{evidence:{include:{source:true,entities:{include:{entity:true}}},orderBy:{collectedAt:"desc"}}}});
 if(!c) notFound();
 return <main className="min-h-screen p-6 md:p-10"><div className="mx-auto max-w-7xl"><Link href={`/cases/${id}`} className="text-sm text-slate-400">← {c.title}</Link><div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs tracking-[.3em] text-cyan-300">EVIDENCE VAULT</p><h1 className="mt-2 text-3xl font-semibold">Evidence & extraction</h1><p className="mt-2 text-sm text-slate-400">Extract identifiers from collected evidence while preserving the source linkage.</p></div><ExtractEvidence caseId={id}/></div><div className="mt-8 grid gap-4">{c.evidence.map(e=><article key={e.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5"><div className="flex flex-wrap justify-between gap-3"><div><div className="text-xs text-cyan-300">{e.source?.provider??"EVIDENCE"}</div><h2 className="mt-2 font-medium">{e.title}</h2></div><div className="text-xs text-slate-600">{e.collectedAt.toISOString()}</div></div>{e.content&&<p className="mt-3 text-sm text-slate-400">{e.content}</p>}<div className="mt-4 flex flex-wrap gap-2">{e.entities.map(x=><span key={x.entityId} className="rounded-full border border-slate-700 px-3 py-1 text-xs"><span className="text-cyan-300">{x.entity.type}</span> · {x.entity.label}</span>)}</div></article>)}</div></div></main>;
}

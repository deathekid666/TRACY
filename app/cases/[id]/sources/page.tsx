import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

function meta(value:unknown){return (value??{}) as Record<string,unknown>}

export default async function Sources({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const c=await db.case.findUnique({where:{id},include:{sources:{orderBy:{collectedAt:"desc"}}}});
 if(!c) notFound();
 return <main className="min-h-screen p-8"><div className="mx-auto max-w-6xl">
  <Link href={`/cases/${id}`} className="text-sm text-slate-400">← {c.title}</Link>
  <h1 className="mt-5 text-3xl font-semibold">Sources</h1>
  <p className="mt-2 text-sm text-slate-400">Every source retains its provider, URL, confidence state and collection timestamp.</p>
  <div className="mt-8 grid gap-4">{c.sources.map(s=>{
    const m=meta(s.metadata);
    const classification=String(m.classification??"UNCLASSIFIED");
    const score=typeof m.identityScore==="number"?m.identityScore:null;
    return <article key={s.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs text-cyan-300">{s.provider??"SOURCE"}</div>
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] tracking-wider text-slate-400">{classification}</span>
        {score!==null&&<span className="text-[10px] text-slate-600">score {score}</span>}
      </div>
      <h2 className="mt-2 font-medium">{s.title??s.url}</h2>
      <a href={s.url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm text-slate-400 hover:text-cyan-200">{s.url}</a>
      <div className="mt-3 text-xs text-slate-600">Collected {s.collectedAt.toISOString()}</div>
    </article>
  })}</div>
 </div></main>;
}

import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CasesPage(){
  const cases=await db.case.findMany({orderBy:{updatedAt:"desc"},include:{_count:{select:{entities:true,evidence:true,sources:true}}}});
  return <main className="min-h-screen p-8 md:p-12"><div className="mx-auto max-w-6xl">
    <div className="flex items-center justify-between"><div><p className="text-sm tracking-[.3em] text-cyan-300">CASES</p><h1 className="mt-2 text-3xl font-semibold">Investigation workspace</h1></div><Link href="/cases/new" className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950">New case</Link></div>
    {cases.length===0?<div className="mt-10 rounded-2xl border border-dashed border-slate-700 p-10 text-center"><div className="text-lg">No cases yet</div><p className="mt-2 text-sm text-slate-400">Create the first TRACY investigation.</p></div>:
    <div className="mt-8 grid gap-4">{cases.map(c=><Link key={c.id} href={`/cases/${c.id}`} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 hover:border-cyan-300/30"><div className="flex items-start justify-between gap-4"><div><div className="text-lg font-medium">{c.title}</div><div className="mt-2 text-xs text-slate-500">{c.id}</div></div><span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{c.status}</span></div><div className="mt-5 flex gap-5 text-sm text-slate-400"><span>{c._count.entities} entities</span><span>{c._count.sources} sources</span><span>{c._count.evidence} evidence</span></div></Link>)}</div>}
  </div></main>;
}
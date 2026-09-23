import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const investigation = await db.case.findUnique({
    where: { id },
    include: { entities: true, sources: true, evidence: true, events: { orderBy: { occurredAt: "desc" } } },
  });
  if (!investigation) notFound();

  const tabs = ["Overview", "Timeline", "Graph", "Media", "Finance", "Sources", "AI Analyst"];

  return <main className="min-h-screen p-6 md:p-10">
    <div className="mx-auto max-w-7xl">
      <Link href="/cases" className="text-sm text-slate-400">← Cases</Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs tracking-[.3em] text-cyan-300">ACTIVE INVESTIGATION</p><h1 className="mt-2 text-4xl font-semibold">{investigation.title}</h1><p className="mt-2 text-sm text-slate-500">Case ID · {investigation.id}</p></div>
        <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-300">{investigation.status}</div>
      </div>
      <div className="mt-8 flex gap-2 overflow-x-auto border-b border-slate-800 pb-3">{tabs.map((tab,i)=><button key={tab} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm ${i===0?"bg-cyan-300 text-slate-950":"text-slate-400 hover:bg-slate-900"}`}>{tab}</button>)}</div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_.6fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
          <div className="flex items-center justify-between"><h2 className="text-lg font-medium">Target entities</h2><span className="text-xs text-slate-500">{investigation.entities.length} known</span></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{investigation.entities.map(e=><div key={e.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="text-xs tracking-wider text-cyan-300">{e.type}</div><div className="mt-1 font-medium">{e.label}</div></div>)}</div>
        </section>
        <aside className="grid gap-4">
          {[["Sources",investigation.sources.length],["Evidence",investigation.evidence.length],["Timeline events",investigation.events.length]].map(([l,n])=><div key={String(l)} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5"><div className="text-sm text-slate-400">{l}</div><div className="mt-2 text-3xl font-semibold">{n}</div></div>)}
        </aside>
      </div>
      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-6"><h2 className="text-lg font-medium">Collection status</h2><p className="mt-2 text-sm text-slate-400">The case model is live. Public-source connectors and evidence collection are the next pipeline stage.</p></section>
    </div>
  </main>;
}

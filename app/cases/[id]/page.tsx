import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CollectSources } from "@/components/CollectSources";

export const dynamic = "force-dynamic";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const investigation = await db.case.findUnique({
    where: { id },
    include: { entities: true, sources: {orderBy:{collectedAt:"desc"},take:5}, evidence: true, events: { orderBy: { occurredAt: "desc" },take:5 } },
  });
  if (!investigation) notFound();

  const person=investigation.entities.find(e=>e.type==="PERSON");
  const username=investigation.entities.find(e=>e.type==="USERNAME");
  const defaultQuery=person?.label ?? username?.label ?? investigation.title;
  const tabs=[
    ["Overview",`/cases/${id}`],
    ["Timeline",`/cases/${id}/timeline`],
    ["Graph",`/cases/${id}/graph`],
    ["Media",`/cases/${id}/media`],
    ["Finance","#"],
    ["Sources",`/cases/${id}/sources`],
    ["Evidence",`/cases/${id}/evidence`],
    ["AI Analyst","#"],
  ];

  return <main className="min-h-screen p-6 md:p-10"><div className="mx-auto max-w-7xl">
    <Link href="/cases" className="text-sm text-slate-400">← Cases</Link>
    <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs tracking-[.3em] text-cyan-300">ACTIVE INVESTIGATION</p><h1 className="mt-2 text-4xl font-semibold">{investigation.title}</h1><p className="mt-2 text-sm text-slate-500">Case ID · {investigation.id}</p></div><div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-300">{investigation.status}</div></div>
    <nav className="mt-8 flex gap-2 overflow-x-auto border-b border-slate-800 pb-3">{tabs.map(([tab,href],i)=><Link key={tab} href={href} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm ${i===0?"bg-cyan-300 text-slate-950":"text-slate-400 hover:bg-slate-900"}`}>{tab}</Link>)}</nav>
    <section className="mt-8 rounded-2xl border border-cyan-300/15 bg-cyan-300/[.03] p-5"><div className="mb-3"><h2 className="font-medium">Public-source discovery</h2><p className="mt-1 text-sm text-slate-400">Run a discovery pass and preserve the resulting source launch-points in this case.</p></div><CollectSources caseId={id} defaultQuery={defaultQuery}/></section>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_.6fr]">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-medium">Target entities</h2><span className="text-xs text-slate-500">{investigation.entities.length} known</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{investigation.entities.map(e=><div key={e.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="text-xs tracking-wider text-cyan-300">{e.type}</div><div className="mt-1 font-medium">{e.label}</div></div>)}</div></section>
      <aside className="grid gap-4">{[["Sources",investigation.sources.length],["Evidence",investigation.evidence.length],["Recent events",investigation.events.length]].map(([l,n])=><div key={String(l)} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5"><div className="text-sm text-slate-400">{l}</div><div className="mt-2 text-3xl font-semibold">{n}</div></div>)}</aside>
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6"><div className="flex justify-between"><h2 className="font-medium">Recent sources</h2><Link href={`/cases/${id}/sources`} className="text-xs text-cyan-300">View all →</Link></div><div className="mt-4 grid gap-3">{investigation.sources.length?investigation.sources.map(s=><div key={s.id} className="rounded-xl border border-slate-800 p-3"><div className="text-xs text-cyan-300">{s.provider}</div><div className="mt-1 truncate text-sm">{s.title}</div></div>):<p className="text-sm text-slate-500">No sources collected yet.</p>}</div></section>
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6"><div className="flex justify-between"><h2 className="font-medium">Recent timeline</h2><Link href={`/cases/${id}/timeline`} className="text-xs text-cyan-300">View all →</Link></div><div className="mt-4 grid gap-3">{investigation.events.length?investigation.events.map(e=><div key={e.id} className="rounded-xl border border-slate-800 p-3"><div className="text-xs text-slate-500">{e.occurredAt.toLocaleString()}</div><div className="mt-1 text-sm">{e.title}</div></div>):<p className="text-sm text-slate-500">No timeline events yet.</p>}</div></section>
    </div>
  </div></main>;
}
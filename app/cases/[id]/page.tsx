import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, BrainCircuit, Database, FileCheck2, Network, Radar, ShieldCheck, UserRound, Clock3, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { CollectSources } from "@/components/CollectSources";
import { RunCorrelation } from "@/components/RunCorrelation";
import { ExtractEvidence } from "@/components/ExtractEvidence";

export const dynamic = "force-dynamic";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const investigation = await db.case.findUnique({
    where: { id },
    include: {
      entities: { orderBy: { createdAt: "desc" } },
      sources: { orderBy: { collectedAt: "desc" }, take: 5 },
      evidence: { orderBy: { collectedAt: "desc" }, take: 5 },
      events: { orderBy: { occurredAt: "desc" }, take: 5 },
      relationships: { take: 5 },
      _count: { select: { entities:true, sources:true, evidence:true, events:true, relations:true, transactions:true } }
    },
  });
  if (!investigation) notFound();

  const person=investigation.entities.find(e=>e.type==="PERSON");
  const username=investigation.entities.find(e=>e.type==="USERNAME");
  const defaultQuery=person?.label ?? username?.label ?? investigation.title;
  const tabs=[
    ["Overview",`/cases/${id}`],["Timeline",`/cases/${id}/timeline`],["Graph",`/cases/${id}/graph`],
    ["Media",`/cases/${id}/media`],["Finance",`/cases/${id}/finance`],["Sources",`/cases/${id}/sources`],
    ["Evidence",`/cases/${id}/evidence`],["AI Analyst",`/cases/${id}/analyst`],
  ];
  const stats=[
    ["Entities",investigation._count.entities,UserRound],["Sources",investigation._count.sources,Database],
    ["Evidence",investigation._count.evidence,FileCheck2],["Links",investigation._count.relations,Network],
    ["Events",investigation._count.events,Clock3],["Transactions",investigation._count.transactions,Activity],
  ];

  return <main className="min-h-screen bg-[radial-gradient(circle_at_85%_0%,rgba(34,211,238,.08),transparent_26%)] p-5 md:p-8">
    <div className="mx-auto max-w-[1500px]">
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-4"><Link href="/" className="text-sm font-semibold tracking-[.35em] text-cyan-300">TRACY</Link><span className="h-5 w-px bg-slate-800"/><Link href="/cases" className="text-sm text-slate-400 hover:text-white">Investigations</Link></div>
        <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-400"/><span>Evidence workspace</span></div>
      </header>

      <section className="py-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div><div className="flex items-center gap-3"><span className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold tracking-[.2em] text-cyan-300">ACTIVE CASE</span><span className="text-xs text-slate-500">{investigation.id}</span></div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">{investigation.title}</h1>
          <p className="mt-2 text-sm text-slate-400">Unified intelligence workspace · public-source evidence and investigator-supplied data</p></div>
          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/[.08] px-4 py-2 text-xs font-medium text-emerald-300"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400"/>{investigation.status}</div>
        </div>
        <nav className="mt-7 flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/50 p-1.5">{tabs.map(([tab,href],i)=><Link key={tab} href={href} className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-sm transition ${i===0?"bg-slate-800 text-white shadow-sm":"text-slate-400 hover:bg-slate-900 hover:text-white"}`}>{tab}</Link>)}</nav>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{stats.map(([label,value,Icon]:any)=><div key={label} className="rounded-xl border border-slate-800 bg-slate-950/55 p-4"><div className="flex items-center justify-between text-slate-500"><span className="text-xs uppercase tracking-wider">{label}</span><Icon className="h-4 w-4"/></div><div className="mt-3 text-2xl font-semibold">{value}</div></div>)}</section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_.75fr]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-cyan-400/15 bg-slate-950/55">
            <div className="flex items-center gap-3 border-b border-slate-800 p-5"><div className="rounded-lg bg-cyan-400/10 p-2 text-cyan-300"><Radar className="h-5 w-5"/></div><div><h2 className="font-medium">Discovery console</h2><p className="text-xs text-slate-500">Collect and preserve public-source launch points for this investigation.</p></div></div>
            <div className="p-5"><CollectSources caseId={id} defaultQuery={defaultQuery}/><div className="mt-4 flex flex-wrap gap-3 border-t border-slate-800/80 pt-4"><ExtractEvidence caseId={id}/><RunCorrelation caseId={id}/></div></div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5">
            <div className="flex items-center justify-between"><div><h2 className="font-medium">Entity intelligence</h2><p className="mt-1 text-xs text-slate-500">Known identifiers associated with this case</p></div><Link href={`/cases/${id}/graph`} className="flex items-center gap-1 text-xs text-cyan-300">Open graph <ExternalLink className="h-3 w-3"/></Link></div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">{investigation.entities.length?investigation.entities.map(e=><div key={e.id} className="group rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:border-cyan-400/20"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold tracking-[.18em] text-cyan-300">{e.type}</span><span className="h-2 w-2 rounded-full bg-emerald-400/70"/></div><div className="mt-2 font-medium">{e.label}</div><div className="mt-1 truncate text-xs text-slate-600">{e.canonical||"Primary case identifier"}</div></div>):<p className="text-sm text-slate-500">No entities identified.</p>}</div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5"><div className="flex items-center justify-between"><h2 className="font-medium">Latest evidence</h2><Link href={`/cases/${id}/evidence`} className="text-xs text-cyan-300">Evidence vault →</Link></div><div className="mt-4 space-y-3">{investigation.evidence.length?investigation.evidence.map(e=><div key={e.id} className="border-l-2 border-cyan-400/30 py-1 pl-3"><div className="truncate text-sm">{e.title}</div><div className="mt-1 text-[11px] text-slate-600">{e.collectedAt.toLocaleString()}</div></div>):<Empty text="No evidence preserved yet."/ >}</div></section>
            <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5"><div className="flex items-center justify-between"><h2 className="font-medium">Activity timeline</h2><Link href={`/cases/${id}/timeline`} className="text-xs text-cyan-300">Full timeline →</Link></div><div className="mt-4 space-y-3">{investigation.events.length?investigation.events.map(e=><div key={e.id} className="flex gap-3"><div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-300"/><div><div className="text-sm">{e.title}</div><div className="mt-1 text-[11px] text-slate-600">{e.occurredAt.toLocaleString()}</div></div></div>):<Empty text="No activity recorded yet."/ >}</div></section>
          </div>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5"><div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-violet-300"/><h2 className="font-medium">Analyst briefing</h2></div><p className="mt-4 text-sm leading-6 text-slate-400">{investigation._count.evidence===0?"No evidence has been collected yet. Run public-source discovery, preserve evidence, then use the analyst to inspect supported findings.":`This case contains ${investigation._count.evidence} evidence item(s), ${investigation._count.entities} entities and ${investigation._count.relations} relationship(s) ready for review.`}</p><Link href={`/cases/${id}/analyst`} className="mt-5 block rounded-xl border border-violet-400/20 bg-violet-400/[.07] px-4 py-3 text-center text-sm text-violet-200 hover:bg-violet-400/10">Open AI Analyst</Link></section>
          <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5"><h2 className="font-medium">Recent sources</h2><div className="mt-4 space-y-3">{investigation.sources.length?investigation.sources.map(s=><div key={s.id} className="rounded-xl border border-slate-800 bg-slate-900/30 p-3"><div className="text-[10px] uppercase tracking-wider text-cyan-300">{s.provider||"WEB"}</div><div className="mt-1 truncate text-sm">{s.title||s.url}</div></div>):<Empty text="No sources collected."/ >}</div><Link href={`/cases/${id}/sources`} className="mt-4 block text-xs text-cyan-300">Review all sources →</Link></section>
          <section className="rounded-2xl border border-amber-400/10 bg-amber-400/[.025] p-5"><div className="text-xs font-semibold tracking-wider text-amber-300">ANALYSIS STANDARD</div><p className="mt-3 text-xs leading-5 text-slate-500">Keep observed facts separate from inferred relationships. Source provenance and confidence should remain visible throughout the investigation.</p></section>
        </aside>
      </div>
    </div>
  </main>;
}

function Empty({text}:{text:string}){return <p className="py-4 text-sm text-slate-600">{text}</p>}

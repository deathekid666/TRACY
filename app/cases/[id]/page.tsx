import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity, BriefcaseBusiness, Database, FileCheck2, GraduationCap,
  Mail, MapPin, Network, Radar, ShieldCheck, UserRound, Clock3,
  ExternalLink, Phone, AtSign, Image as ImageIcon, CalendarDays,
  Globe2, Sparkles, Fingerprint, ChevronRight
} from "lucide-react";
import { db } from "@/lib/db";
import { CollectSources } from "@/components/CollectSources";
import { AutoQuickScan } from "@/components/AutoQuickScan";

export const dynamic = "force-dynamic";

function meta(value:unknown){return (value??{}) as Record<string,unknown>}
function text(value:unknown){return typeof value==="string"?value:""}
function number(value:unknown){return typeof value==="number"?value:null}
function dateLabel(value:unknown){
  if(typeof value!=="string"||!value)return "Unknown";
  const d=new Date(value);
  return Number.isNaN(d.getTime())?value:d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
}
function decision(source:{metadata:unknown}){return String(meta(source.metadata).curatedDecision??"UNREVIEWED")}
function sourceCategory(source:{metadata:unknown}){const m=meta(source.metadata);return String(m.curatedCategory??m.category??"GENERAL")}

type AiFact={type:string;value:string;confidence:number;sourceIds:string[]};

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const investigation = await db.case.findUnique({
    where: { id },
    include: {
      entities: { orderBy: { createdAt: "asc" } },
      sources: { orderBy: { collectedAt: "desc" }, take: 160 },
      evidence: { orderBy: { collectedAt: "desc" }, take: 80 },
      events: { orderBy: { occurredAt: "desc" }, take: 20 },
      _count: { select: { entities:true, sources:true, evidence:true, events:true, relations:true, transactions:true } }
    },
  });
  if (!investigation) notFound();

  const person=investigation.entities.find(e=>e.type==="PERSON");
  const username=investigation.entities.find(e=>e.type==="USERNAME");
  const defaultQuery=person?.label ?? username?.label ?? investigation.title;
  const emails=investigation.entities.filter(e=>e.type==="EMAIL");
  const phones=investigation.entities.filter(e=>e.type==="PHONE");
  const usernames=investigation.entities.filter(e=>e.type==="USERNAME");
  const locations=investigation.entities.filter(e=>e.type==="LOCATION");
  const organizations=investigation.entities.filter(e=>e.type==="ORGANIZATION");

  const curationEvent=investigation.events.find(e=>e.title==="Source curation");
  const curationMeta=meta(curationEvent?.metadata);
  const facts=(Array.isArray(curationMeta.facts)?curationMeta.facts:[]) as AiFact[];
  const birthFact=facts.find(f=>f.type==="BIRTH_DATE");
  const aliases=facts.filter(f=>f.type==="ALIAS");
  const nationalities=facts.filter(f=>f.type==="NATIONALITY");
  const languages=facts.filter(f=>f.type==="LANGUAGE");
  const factLocations=facts.filter(f=>f.type==="LOCATION");
  const educationFacts=facts.filter(f=>f.type==="EDUCATION");
  const employmentFacts=facts.filter(f=>f.type==="EMPLOYMENT");
  const otherFacts=facts.filter(f=>!["BIRTH_DATE","ALIAS","NATIONALITY","LANGUAGE","LOCATION","EDUCATION","EMPLOYMENT"].includes(f.type));

  const visibleSources=investigation.sources.filter(s=>decision(s)!=="REJECT");
  const relevantSources=visibleSources.filter(s=>decision(s)==="KEEP");
  const reviewSources=visibleSources.filter(s=>decision(s)!=="KEEP");
  const rejectedCount=investigation.sources.filter(s=>decision(s)==="REJECT").length;

  const accounts=visibleSources.filter(s=>sourceCategory(s)==="PUBLIC_ACCOUNT");
  const documents=visibleSources.filter(s=>["DOCUMENT","ACADEMIC","EDUCATION"].includes(sourceCategory(s)));
  const professional=visibleSources.filter(s=>sourceCategory(s)==="PROFESSIONAL"||/linkedin|zoominfo|career|employer/i.test((s.title??"")+" "+s.url));

  const photos=Array.from(new Map(visibleSources.map(s=>{
    const m=meta(s.metadata);
    const image=text(m.imageUrl);
    return image?[image,{image,source:s}]:null;
  }).filter(Boolean) as Array<[string,{image:string;source:(typeof visibleSources)[number]}]>).values()).slice(0,6);

  const latestDiscovery=investigation.events.find(e=>e.title==="Deep public-footprint discovery");
  const discoveryMeta=meta(latestDiscovery?.metadata);
  const mode=text(discoveryMeta.mode)||"unknown";

  const tabs=[
    ["Dossier",`/cases/${id}`],["Timeline",`/cases/${id}/timeline`],["Graph",`/cases/${id}/graph`],
    ["Media",`/cases/${id}/media`],["Sources",`/cases/${id}/sources`],["Evidence",`/cases/${id}/evidence`],
    ["AI Analyst",`/cases/${id}/analyst`],
  ];

  return <main className="min-h-screen bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,.08),transparent_24%),radial-gradient(circle_at_85%_12%,rgba(139,92,246,.07),transparent_22%)] p-4 md:p-8">
    <div className="mx-auto max-w-[1500px]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-4"><Link href="/" className="text-sm font-semibold tracking-[.35em] text-cyan-300">TRACY</Link><span className="h-5 w-px bg-slate-800"/><Link href="/cases" className="text-sm text-slate-400 hover:text-white">Investigations</Link></div>
        <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-400"/><span>Public-source evidence dossier</span></div>
      </header>

      <nav className="mt-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/55 p-1.5">{tabs.map(([tab,href],i)=><Link key={tab} href={href} className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-sm transition ${i===0?"bg-slate-800 text-white":"text-slate-400 hover:bg-slate-900 hover:text-white"}`}>{tab}</Link>)}</nav>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/65 shadow-2xl shadow-black/20">
        <div className="grid lg:grid-cols-[1.45fr_.75fr]">
          <div className="p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold tracking-[.18em] text-emerald-300">PUBLIC DOSSIER</span>
              <span className="rounded-full border border-slate-700 px-3 py-1 text-[10px] uppercase tracking-[.14em] text-slate-500">{mode} scan</span>
            </div>
            <div className="mt-5 flex items-start gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
                {photos[0]?<img src={photos[0].image} alt="" className="h-full w-full object-cover"/>:<Fingerprint className="h-9 w-9 text-slate-600"/>}
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{person?.label||investigation.title}</h1>
                <div className="mt-3 flex flex-wrap gap-2">{usernames.slice(0,6).map(e=><span key={e.id} className="rounded-lg border border-cyan-400/15 bg-cyan-400/[.06] px-2.5 py-1 text-xs text-cyan-200">@{(e.canonical||e.label).replace(/^@/,"")}</span>)}</div>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">Consolidated public information. Facts stay separated from candidate matches, and every finding remains traceable to evidence.</p>
              </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Relevant sources" value={relevantSources.length} icon={FileCheck2}/>
              <Metric label="Accounts" value={accounts.length} icon={AtSign}/>
              <Metric label="Documents" value={documents.length} icon={Database}/>
              <Metric label="Filtered noise" value={rejectedCount} icon={ShieldCheck}/>
            </div>
          </div>

          <div className="border-t border-slate-800 bg-slate-950/75 p-6 lg:border-l lg:border-t-0 md:p-8">
            <div className="flex items-center justify-between"><div><div className="text-[10px] font-semibold tracking-[.22em] text-cyan-300">SCAN CONTROL</div><div className="mt-1 text-sm text-slate-400">Fast first, deep when needed.</div></div><Radar className="h-5 w-5 text-cyan-300"/></div>
            <div className="mt-5"><CollectSources caseId={id} defaultQuery={defaultQuery}/><AutoQuickScan caseId={id} query={defaultQuery} enabled={investigation._count.sources===0}/></div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_.75fr]">
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2">
            <InfoCard title="Identity" icon={UserRound}>
              <FactRow label="Full name" value={person?.label||investigation.title} confidence="Primary"/>
              <FactRow label="Date of birth" value={birthFact?.value||"Not established from public evidence"} confidence={birthFact?`${birthFact.confidence}%`:"—"}/>
              <FactRow label="Aliases" value={aliases.length?aliases.map(f=>f.value).join(" · "):"None established"} confidence={aliases.length?"Evidence linked":"—"}/>
              <FactRow label="Usernames" value={usernames.length?usernames.map(e=>"@"+(e.canonical||e.label).replace(/^@/,"")).join(" · "):"None established"} confidence={usernames.length?"Evidence linked":"—"}/>
              <FactRow label="Nationality" value={nationalities.length?nationalities.map(f=>f.value).join(" · "):"Not established"} confidence={nationalities.length?"Evidence linked":"—"}/>
              <FactRow label="Languages" value={languages.length?languages.map(f=>f.value).join(" · "):"Not established"} confidence={languages.length?"Evidence linked":"—"}/>
              <FactRow label="Locations" value={locations.length?locations.map(e=>e.label).join(" · "):(factLocations.length?factLocations.map(f=>f.value).join(" · "):"Not established")} confidence={(locations.length||factLocations.length)?"Evidence linked":"—"}/>
            </InfoCard>

            <InfoCard title="Public contact exposure" icon={Mail}>
              <FactRow label="Email" value={emails.length?emails.map(e=>e.label).join(" · "):"No verified public email extracted"} confidence={emails.length?"Public evidence":"—"}/>
              <FactRow label="Phone" value={phones.length?phones.map(e=>e.label).join(" · "):"No verified public phone extracted"} confidence={phones.length?"Public evidence":"—"}/>
              <FactRow label="Organizations" value={organizations.length?organizations.map(e=>e.label).join(" · "):"Not structured yet"} confidence={organizations.length?"Evidence linked":"—"}/>
            </InfoCard>
          </section>

          {photos.length>0&&<section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5">
            <div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-cyan-300"/><h2 className="font-medium">Public photos</h2></div><p className="mt-1 text-xs text-slate-500">Images are shown only when a public source exposes a preview image.</p></div><Link href={`/cases/${id}/media`} className="text-xs text-cyan-300">Media →</Link></div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{photos.map(p=><a key={p.image} href={p.source.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900"><img src={p.image} alt="" className="aspect-square w-full object-cover transition group-hover:scale-[1.03]"/><div className="truncate px-2 py-2 text-[10px] text-slate-500">{p.source.provider||"Public source"}</div></a>)}</div>
          </section>}

          <section className="grid gap-6 lg:grid-cols-2">
            <DossierSection title="Social & public accounts" icon={AtSign} items={accounts.slice(0,8)} caseId={id}/>
            <section className="space-y-6"><DossierSection title="Education & documents" icon={GraduationCap} items={documents.slice(0,8)} caseId={id}/>{educationFacts.length>0&&<FactList title="Education facts" facts={educationFacts}/>}</section>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-6"><DossierSection title="Professional footprint" icon={BriefcaseBusiness} items={professional.slice(0,8)} caseId={id}/>{employmentFacts.length>0&&<FactList title="Employment facts" facts={employmentFacts}/>}</section>
            <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5">
              <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-300"/><h2 className="font-medium">Extracted public facts</h2></div>
              <div className="mt-4 space-y-3">{otherFacts.length?otherFacts.slice(0,10).map((fact,i)=><div key={i} className="rounded-xl border border-slate-800 bg-slate-900/30 p-3"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[.16em] text-violet-300">{fact.type.replaceAll("_"," ")}</span><span className="text-[10px] text-slate-600">{fact.confidence}%</span></div><div className="mt-2 text-sm">{fact.value}</div></div>):<p className="text-sm leading-6 text-slate-500">No additional structured facts have been established yet. When AI curation is configured, supported facts are extracted from retained evidence rather than guessed.</p>}</div>
            </section>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-cyan-300"/><h2 className="font-medium">Source chronology</h2></div><p className="mt-1 text-xs text-slate-500">Original publication/release dates when the source exposes them; TRACY collection time stays separate.</p></div><Link href={`/cases/${id}/timeline`} className="text-xs text-cyan-300">Full timeline →</Link></div>
            <div className="mt-4 grid gap-3">{visibleSources.filter(s=>text(meta(s.metadata).publishedAt)).slice(0,8).map(s=><a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/30 p-3 hover:border-cyan-400/20"><div className="w-24 shrink-0 text-xs font-medium text-cyan-300">{dateLabel(meta(s.metadata).publishedAt)}</div><div className="min-w-0 flex-1"><div className="truncate text-sm">{s.title||s.url}</div><div className="mt-1 truncate text-[11px] text-slate-600">{s.provider||"SOURCE"}</div></div><ChevronRight className="h-4 w-4 text-slate-700"/></a>)}</div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5">
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-300"/><h2 className="font-medium">Exposure summary</h2></div>
            <div className="mt-4 space-y-3">
              <Exposure label="Public email" found={emails.length>0} detail={emails.length?`${emails.length} extracted`:"Not verified"}/>
              <Exposure label="Public phone" found={phones.length>0} detail={phones.length?`${phones.length} extracted`:"Not verified"}/>
              <Exposure label="Birth date" found={Boolean(birthFact)} detail={birthFact?birthFact.value:"Not established"}/>
              <Exposure label="Public accounts" found={accounts.length>0} detail={`${accounts.length} retained`}/>
              <Exposure label="Documents / academic" found={documents.length>0} detail={`${documents.length} retained`}/>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5">
            <div className="flex items-center justify-between"><div><h2 className="font-medium">Evidence quality</h2><p className="mt-1 text-xs text-slate-500">Curated before display.</p></div><FileCheck2 className="h-5 w-5 text-cyan-300"/></div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center"><SmallStat label="Relevant" value={relevantSources.length}/><SmallStat label="Review" value={reviewSources.length}/><SmallStat label="Hidden" value={rejectedCount}/></div>
            <Link href={`/cases/${id}/sources`} className="mt-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-3 text-sm hover:border-cyan-400/20"><span>Open filtered source library</span><ExternalLink className="h-4 w-4 text-cyan-300"/></Link>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5">
            <div className="flex items-center gap-2"><Network className="h-5 w-5 text-violet-300"/><h2 className="font-medium">Investigation map</h2></div>
            <div className="mt-4 grid grid-cols-2 gap-3"><SmallStat label="Entities" value={investigation._count.entities}/><SmallStat label="Evidence" value={investigation._count.evidence}/><SmallStat label="Links" value={investigation._count.relations}/><SmallStat label="Events" value={investigation._count.events}/></div>
            <Link href={`/cases/${id}/graph`} className="mt-4 block text-xs text-violet-300">Open relationship graph →</Link>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5">
            <div className="flex items-center gap-2"><Globe2 className="h-5 w-5 text-cyan-300"/><h2 className="font-medium">Latest retained sources</h2></div>
            <div className="mt-4 space-y-3">{visibleSources.slice(0,6).map(s=><a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-800 bg-slate-900/30 p-3 hover:border-cyan-400/20"><div className="text-[10px] uppercase tracking-wider text-cyan-300">{sourceCategory(s).replaceAll("_"," ")}</div><div className="mt-1 line-clamp-2 text-sm">{s.title||s.url}</div><div className="mt-2 flex justify-between text-[10px] text-slate-600"><span>{s.provider||"SOURCE"}</span><span>{text(meta(s.metadata).publishedAt)?dateLabel(meta(s.metadata).publishedAt):"date unknown"}</span></div></a>)}</div>
          </section>
        </aside>
      </div>
    </div>
  </main>;
}

function Metric({label,value,icon:Icon}:{label:string;value:number;icon:any}){return <div className="rounded-xl border border-slate-800 bg-slate-900/35 p-4"><div className="flex items-center justify-between text-slate-500"><span className="text-[10px] uppercase tracking-wider">{label}</span><Icon className="h-4 w-4"/></div><div className="mt-2 text-2xl font-semibold">{value}</div></div>}
function SmallStat({label,value}:{label:string;value:number}){return <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3"><div className="text-lg font-semibold">{value}</div><div className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{label}</div></div>}
function InfoCard({title,icon:Icon,children}:{title:string;icon:any;children:React.ReactNode}){return <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-cyan-300"/><h2 className="font-medium">{title}</h2></div><div className="mt-4 divide-y divide-slate-800">{children}</div></section>}
function FactRow({label,value,confidence}:{label:string;value:string;confidence:string}){return <div className="grid gap-1 py-3 sm:grid-cols-[120px_1fr_auto] sm:items-start"><div className="text-xs text-slate-500">{label}</div><div className="text-sm leading-5">{value}</div><div className="text-[10px] uppercase tracking-wider text-slate-600">{confidence}</div></div>}
function Exposure({label,found,detail}:{label:string;found:boolean;detail:string}){return <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/30 px-3 py-3"><div><div className="text-sm">{label}</div><div className="mt-1 text-[10px] text-slate-600">{detail}</div></div><span className={"h-2.5 w-2.5 rounded-full "+(found?"bg-amber-300":"bg-slate-700")}/></div>}
function DossierSection({title,icon:Icon,items,caseId}:{title:string;icon:any;items:Array<{id:string;url:string;title:string|null;provider:string|null;metadata:unknown}>;caseId:string}){return <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-cyan-300"/><h2 className="font-medium">{title}</h2></div><Link href={`/cases/${caseId}/sources`} className="text-xs text-cyan-300">All →</Link></div><div className="mt-4 space-y-3">{items.length?items.map(s=>{const m=meta(s.metadata);return <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-800 bg-slate-900/30 p-3 hover:border-cyan-400/20"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm">{s.title||s.url}</div><div className="mt-1 truncate text-[11px] text-slate-600">{s.provider||"SOURCE"}</div></div><span className="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 text-[9px] uppercase tracking-wider text-slate-500">{String(m.curatedDecision??m.classification??"")}</span></div>{text(m.publishedAt)&&<div className="mt-2 text-[10px] text-slate-600">Released {dateLabel(m.publishedAt)}</div>}</a>}):<p className="text-sm text-slate-500">Nothing established in this section yet.</p>}</div></section>}

function FactList({title,facts}:{title:string;facts:AiFact[]}){return <section className="rounded-2xl border border-slate-800 bg-slate-950/55 p-5"><h3 className="font-medium">{title}</h3><div className="mt-3 space-y-2">{facts.map((fact,i)=><div key={i} className="rounded-xl border border-slate-800 bg-slate-900/30 p-3"><div className="text-sm">{fact.value}</div><div className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{fact.confidence}% · {fact.sourceIds.length} source{fact.sourceIds.length===1?"":"s"}</div></div>)}</div></section>}

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AtSign, BriefcaseBusiness, CalendarDays, Database, ExternalLink,
  FileText, GraduationCap, Image as ImageIcon, Mail, Phone, ShieldCheck,
  Sparkles, UserRound
} from "lucide-react";
import { db } from "@/lib/db";

export const dynamic="force-dynamic";

function meta(value:unknown){return (value??{}) as Record<string,unknown>}
function text(value:unknown){return typeof value==="string"?value:""}
function category(source:{metadata:unknown}){
  const m=meta(source.metadata);
  return String(m.curatedCategory??m.category??"GENERAL");
}
function decision(source:{metadata:unknown}){
  return String(meta(source.metadata).curatedDecision??"UNREVIEWED");
}
function dateLabel(value:unknown){
  if(typeof value!=="string"||!value)return "Unknown";
  const d=new Date(value);
  return Number.isNaN(d.getTime())?value:d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
}
function badge(value:string){
  if(value==="KEEP")return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if(value==="REVIEW"||value==="UNREVIEWED")return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-slate-700 bg-slate-900 text-slate-400";
}

type AiFact={type:string;value:string;confidence:number;sourceIds:string[]};
type AcademicRecord={
  sourceId:string;
  sourceTitle:string;
  sourceUrl:string;
  institution?:string;
  academicYear?:string;
  semester?:string;
  session?:string;
  program?:string;
  module?:string;
  studentRecordId?:string;
  matchedName:string;
  confidence:number;
};

export default async function ReportPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const c=await db.case.findUnique({
    where:{id},
    include:{
      entities:{orderBy:{createdAt:"asc"}},
      sources:{orderBy:{collectedAt:"desc"},take:250},
      events:{orderBy:{occurredAt:"desc"},take:40},
      _count:{select:{sources:true,evidence:true,entities:true}}
    }
  });
  if(!c)notFound();

  const person=c.entities.find(e=>e.type==="PERSON");
  const emails=c.entities.filter(e=>e.type==="EMAIL");
  const phones=c.entities.filter(e=>e.type==="PHONE");
  const usernames=c.entities.filter(e=>e.type==="USERNAME");
  const orgs=c.entities.filter(e=>e.type==="ORGANIZATION");
  const locations=c.entities.filter(e=>e.type==="LOCATION");

  const curationEvent=c.events.find(e=>e.title==="Source curation");
  const curationMeta=meta(curationEvent?.metadata);
  const facts=(Array.isArray(curationMeta.facts)?curationMeta.facts:[]) as AiFact[];

  const academicEvent=c.events.find(e=>e.title==="Academic intelligence");
  const academicMeta=meta(academicEvent?.metadata);
  const academicRecords=(Array.isArray(academicMeta.records)?academicMeta.records:[]) as AcademicRecord[];

  const accounts=c.sources.filter(s=>category(s)==="PUBLIC_ACCOUNT");
  const professional=c.sources.filter(s=>category(s)==="PROFESSIONAL");
  const documents=c.sources.filter(s=>["DOCUMENT","ACADEMIC","EDUCATION"].includes(category(s)));
  const academicRecordSourceIds=new Set(academicRecords.map(r=>r.sourceId));
  const academicCandidates=documents.filter(s=>{const m=meta(s.metadata);const p=typeof m.academicCandidatePlausibility==="number"?m.academicCandidatePlausibility:0;return !academicRecordSourceIds.has(s.id)&&decision(s)!=="REJECT"&&(decision(s)!=="REVIEW"||p>=25)});
  const academicLowConfidence=documents.filter(s=>!academicRecordSourceIds.has(s.id)&&!academicCandidates.some(c=>c.id===s.id));
  const relevant=c.sources.filter(s=>decision(s)==="KEEP");
  const candidates=c.sources.filter(s=>decision(s)==="REVIEW"||decision(s)==="UNREVIEWED");
  const lowConfidence=c.sources.filter(s=>decision(s)==="REJECT");

  const photos=Array.from(new Map(c.sources.map(source=>{
    const image=text(meta(source.metadata).imageUrl);
    return image?[image,{image,source}]:null;
  }).filter(Boolean) as Array<[string,{image:string;source:(typeof c.sources)[number]}]>).values()).slice(0,12);

  const dob=facts.find(f=>f.type==="BIRTH_DATE");
  const aliases=facts.filter(f=>f.type==="ALIAS");
  const educationFacts=facts.filter(f=>f.type==="EDUCATION"||f.type==="QUALIFICATION");
  const employmentFacts=facts.filter(f=>["EMPLOYMENT","ROLE","ORGANIZATION"].includes(f.type));
  const otherFacts=facts.filter(f=>!["BIRTH_DATE","ALIAS","EDUCATION","QUALIFICATION","EMPLOYMENT","ROLE","ORGANIZATION"].includes(f.type));

  const sourceRows=[...c.sources].sort((a,b)=>{
    const rank=(v:string)=>v==="KEEP"?0:v==="REVIEW"||v==="UNREVIEWED"?1:2;
    const rd=rank(decision(a))-rank(decision(b));
    return rd!==0?rd:b.collectedAt.getTime()-a.collectedAt.getTime();
  });

  return <main className="min-h-screen bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,.07),transparent_25%),radial-gradient(circle_at_88%_10%,rgba(139,92,246,.06),transparent_22%)] p-4 md:p-8">
    <div className="mx-auto max-w-[1500px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href={`/cases/${id}`} className="text-sm text-slate-400 hover:text-white">← Back to dossier</Link>
          <p className="mt-6 text-xs font-semibold tracking-[.3em] text-cyan-300">INVESTIGATION REPORT</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">{person?.label||c.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Interface report built from everything TRACY gathered. Confirmed/relevant findings, candidates and low-confidence results remain visible and are labeled separately.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <ReportStat label="Relevant" value={relevant.length}/>
          <ReportStat label="Candidate" value={candidates.length}/>
          <ReportStat label="Low confidence" value={lowConfidence.length}/>
        </div>
      </div>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6">
          <div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-cyan-300"/><h2 className="text-lg font-medium">Identity summary</h2></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <ReportField label="Full name" value={person?.label||c.title}/>
            <ReportField label="Date of birth" value={dob?.value||"Not established"}/>
            <ReportField label="Aliases" value={aliases.length?aliases.map(f=>f.value).join(" · "):"None established"}/>
            <ReportField label="Usernames" value={usernames.length?usernames.map(e=>"@"+(e.canonical||e.label).replace(/^@/,"")).join(" · "):"None extracted"}/>
            <ReportField label="Locations" value={locations.length?locations.map(e=>e.label).join(" · "):"Not established"}/>
            <ReportField label="Organizations" value={orgs.length?orgs.map(e=>e.label).join(" · "):"Not structured"}/>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-300"/><h2 className="text-lg font-medium">Public contact exposure</h2></div>
          <div className="mt-5 space-y-3">
            <ContactRow icon={Mail} label="Email" values={emails.map(e=>e.label)}/>
            <ContactRow icon={Phone} label="Phone" values={phones.map(e=>e.label)}/>
            <ContactRow icon={AtSign} label="Accounts / handles" values={usernames.map(e=>"@"+(e.canonical||e.label).replace(/^@/,""))}/>
          </div>
        </div>
      </section>

      {photos.length>0&&<section className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/55 p-6">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><ImageIcon className="h-5 w-5 text-cyan-300"/><h2 className="text-lg font-medium">Public images gathered</h2></div><Link href={`/cases/${id}/media`} className="text-xs text-cyan-300">Open gallery →</Link></div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{photos.map(item=><a key={item.image} href={item.source.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40"><img src={item.image} alt="" className="aspect-square w-full object-cover"/><div className="truncate p-2 text-[10px] text-slate-500">{item.source.provider||"Source"}</div></a>)}</div>
      </section>}

      <section className="mt-6 rounded-3xl border border-cyan-400/15 bg-slate-950/60 p-6">
        <div className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-cyan-300"/><h2 className="text-lg font-medium">Education & academic report</h2></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {academicRecords.map((record,i)=><article key={record.sourceId+"-"+i} className="rounded-2xl border border-emerald-400/15 bg-slate-900/35 p-4">
            <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[.16em] text-emerald-300">{record.institution||"Academic public record"}</div><div className="mt-2 text-sm font-medium">{record.sourceTitle}</div></div><span className="text-[10px] text-slate-600">{record.confidence}%</span></div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {record.academicYear&&<Mini label="Academic year" value={record.academicYear}/>}
              {record.semester&&<Mini label="Semester" value={record.semester}/>}
              {record.session&&<Mini label="Session" value={record.session}/>}
              {record.program&&<Mini label="Program" value={record.program}/>}
              {record.module&&<Mini label="Module" value={record.module}/>}
              {record.studentRecordId&&<Mini label="Public record ID" value={record.studentRecordId}/>}
            </div>
            <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs text-cyan-300">Supporting source <ExternalLink className="h-3 w-3"/></a>
          </article>)}

          {academicCandidates.map(source=>{const d=decision(source);const m=meta(source.metadata);return <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="rounded-2xl border border-amber-400/15 bg-amber-400/[.025] p-4 hover:border-amber-400/25">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[10px] uppercase tracking-[.16em] text-amber-300">Academic candidate</div><div className="mt-2 line-clamp-2 text-sm font-medium">{source.title||source.url}</div><div className="mt-1 text-[10px] text-slate-600">{source.provider||"SOURCE"} · {text(m.discoveryQuery)||"academic search"}</div></div><span className={"rounded-full border px-2 py-1 text-[9px] uppercase tracking-wider "+badge(d)}>{d}</span></div>
            {text(m.curatedReason)&&<div className="mt-3 text-[10px] leading-5 text-slate-500">{text(m.curatedReason)}</div>}
          </a>})}

          {!academicRecords.length&&!academicCandidates.length&&<div className="rounded-2xl border border-dashed border-slate-800 p-5 text-sm text-slate-500">No plausible academic source has been gathered yet.</div>}
        </div>
        {academicLowConfidence.length>0&&<div className="mt-4 text-xs text-slate-600">{academicLowConfidence.length} low-plausibility academic search results remain available in the Complete source register below.</div>}
        {educationFacts.length>0&&<div className="mt-5 grid gap-3 md:grid-cols-2">{educationFacts.map((fact,i)=><FactCard key={i} fact={fact}/>)}</div>}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <ReportSourceGroup title="Social & public accounts" icon={AtSign} items={accounts}/>
        <ReportSourceGroup title="Professional footprint" icon={BriefcaseBusiness} items={professional}/>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <ReportSourceGroup title="Documents & academic sources" icon={Database} items={documents}/>
        <div className="rounded-3xl border border-slate-800 bg-slate-950/55 p-6">
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-300"/><h2 className="text-lg font-medium">Extracted report facts</h2></div>
          <div className="mt-4 grid gap-3">{[...employmentFacts,...otherFacts].length?[...employmentFacts,...otherFacts].map((fact,i)=><FactCard key={i} fact={fact}/>):<p className="text-sm text-slate-500">No additional structured facts extracted yet.</p>}</div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/55 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-cyan-300"/><h2 className="text-lg font-medium">Complete source register</h2></div><p className="mt-1 text-xs text-slate-500">Nothing is hidden here. Low-confidence and duplicate results remain visible with their status.</p></div><Link href={`/cases/${id}/sources`} className="text-xs text-cyan-300">Open filterable source library →</Link></div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-600"><tr><th className="px-3 py-3">Status</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">Released</th><th className="px-3 py-3">Collected</th></tr></thead>
            <tbody>{sourceRows.map(source=>{const m=meta(source.metadata);const d=decision(source);return <tr key={source.id} className="border-b border-slate-900 align-top"><td className="px-3 py-3"><span className={"rounded-full border px-2 py-1 text-[9px] uppercase tracking-wider "+badge(d)}>{d}</span></td><td className="px-3 py-3 text-slate-400">{category(source).replaceAll("_"," ")}</td><td className="px-3 py-3"><a href={source.url} target="_blank" rel="noreferrer" className="font-medium text-slate-200 hover:text-cyan-200">{source.title||source.url}</a><div className="mt-1 text-[10px] text-slate-600">{source.provider||"SOURCE"}</div>{text(m.curatedReason)&&<div className="mt-1 max-w-xl text-[10px] text-slate-500">{text(m.curatedReason)}</div>}</td><td className="px-3 py-3 text-slate-400">{dateLabel(m.publishedAt)}</td><td className="px-3 py-3 text-slate-400">{source.collectedAt.toLocaleDateString()}</td></tr>})}</tbody>
          </table>
        </div>
      </section>
    </div>
  </main>;
}

function ReportStat({label,value}:{label:string;value:number}){return <div className="min-w-24 rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-3"><div className="text-xl font-semibold">{value}</div><div className="mt-1 text-[9px] uppercase tracking-wider text-slate-600">{label}</div></div>}
function ReportField({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-600">{label}</div><div className="mt-1 text-sm leading-5">{value}</div></div>}
function ContactRow({icon:Icon,label,values}:{icon:any;label:string;values:string[]}){return <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3"><div className="flex items-center gap-2 text-xs text-slate-500"><Icon className="h-4 w-4"/>{label}</div><div className="mt-2 text-sm">{values.length?values.join(" · "):"Nothing verified yet"}</div></div>}
function Mini({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3"><div className="text-[9px] uppercase tracking-wider text-slate-600">{label}</div><div className="mt-1 text-xs text-slate-200">{value}</div></div>}
function FactCard({fact}:{fact:AiFact}){return <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3"><div className="flex items-center justify-between gap-3"><div className="text-[10px] uppercase tracking-wider text-violet-300">{fact.type.replaceAll("_"," ")}</div><div className="text-[10px] text-slate-600">{fact.confidence}%</div></div><div className="mt-2 text-sm">{fact.value}</div></div>}
function ReportSourceGroup({title,icon:Icon,items}:{title:string;icon:any;items:Array<{id:string;url:string;title:string|null;provider:string|null;collectedAt:Date;metadata:unknown}>}){return <section className="rounded-3xl border border-slate-800 bg-slate-950/55 p-6"><div className="flex items-center gap-2"><Icon className="h-5 w-5 text-cyan-300"/><h2 className="text-lg font-medium">{title}</h2><span className="ml-auto text-xs text-slate-600">{items.length}</span></div><div className="mt-4 space-y-3">{items.slice(0,20).map(source=>{const d=decision(source);const m=meta(source.metadata);return <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-800 bg-slate-900/30 p-3 hover:border-cyan-400/20"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="line-clamp-2 text-sm">{source.title||source.url}</div><div className="mt-1 text-[10px] text-slate-600">{source.provider||"SOURCE"} · {text(m.publishedAt)?dateLabel(m.publishedAt):"release date unknown"}</div></div><span className={"shrink-0 rounded-full border px-2 py-1 text-[9px] uppercase tracking-wider "+badge(d)}>{d}</span></div></a>})}{!items.length&&<p className="text-sm text-slate-500">No gathered source in this category yet.</p>}</div></section>}

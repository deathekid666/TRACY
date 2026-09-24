import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

function meta(value:unknown){return (value??{}) as Record<string,unknown>}

export const dynamic="force-dynamic";

export default async function Timeline({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const c=await db.case.findUnique({where:{id},include:{events:{orderBy:{occurredAt:"desc"}},sources:{orderBy:{collectedAt:"desc"},take:200}}});
 if(!c) notFound();
 const sourceMoments=c.sources.flatMap(source=>{
   const m=meta(source.metadata);
   const value=typeof m.publishedAt==="string"?m.publishedAt:"";
   if(!value||String(m.curatedDecision??"UNREVIEWED")==="REJECT")return [];
   const date=new Date(value);
   if(Number.isNaN(date.getTime()))return [];
   return [{id:"source-"+source.id,date,type:"SOURCE" as const,title:source.title||source.url,description:source.provider||"Public source",url:source.url}];
 });
 const eventMoments=c.events.map(event=>({id:"event-"+event.id,date:event.occurredAt,type:"EVENT" as const,title:event.title,description:event.description||"",url:""}));
 const moments=[...sourceMoments,...eventMoments].sort((a,b)=>b.date.getTime()-a.date.getTime());
 return <main className="min-h-screen p-6 md:p-10"><div className="mx-auto max-w-5xl">
  <Link href={`/cases/${id}`} className="text-sm text-slate-400">← {c.title}</Link>
  <p className="mt-6 text-xs tracking-[.3em] text-cyan-300">CHRONOLOGY</p>
  <h1 className="mt-2 text-3xl font-semibold">Public timeline</h1>
  <p className="mt-2 text-sm text-slate-400">Source release dates and TRACY investigation events are kept separate and sorted chronologically.</p>
  <div className="mt-8 border-l border-slate-800 pl-6">{moments.length?moments.map(item=><div key={item.id} className="relative pb-7">
    <span className={"absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full "+(item.type==="SOURCE"?"bg-cyan-300":"bg-violet-300")}/>
    <div className="text-xs text-slate-500">{item.date.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})} · {item.type==="SOURCE"?"SOURCE RELEASE":"TRACY EVENT"}</div>
    <div className="mt-1 font-medium">{item.title}</div>
    {item.description&&<p className="mt-1 text-sm text-slate-400">{item.description}</p>}
    {item.url&&<a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-cyan-300">Open source →</a>}
  </div>):<div className="text-sm text-slate-500">No dated source or event records yet.</div>}</div>
 </div></main>;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic="force-dynamic";

function meta(value:unknown){return (value??{}) as Record<string,unknown>}
function dateLabel(value:unknown){if(typeof value!=="string")return "Unknown";const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleDateString()}

export default async function MediaPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const c=await db.case.findUnique({where:{id},include:{sources:{orderBy:{collectedAt:"desc"},take:160}}});
 if(!c) notFound();
 const media=c.sources.flatMap(source=>{const m=meta(source.metadata);const image=typeof m.imageUrl==="string"?m.imageUrl:"";const decision=String(m.curatedDecision??"UNREVIEWED");const category=String(m.curatedCategory??m.category??"GENERAL");return image&&decision!=="REJECT"&&["PUBLIC_ACCOUNT","PROFESSIONAL"].includes(category)?[{source,image,publishedAt:m.publishedAt}]:[]});
 const unique=[...new Map(media.map(item=>[item.image,item])).values()];
 return <main className="min-h-screen p-6 md:p-10"><div className="mx-auto max-w-7xl">
  <Link href={`/cases/${id}`} className="text-sm text-slate-400">← {c.title}</Link>
  <p className="mt-6 text-xs tracking-[.3em] text-cyan-300">PUBLIC MEDIA</p>
  <h1 className="mt-2 text-3xl font-semibold">Source-linked images</h1>
  <p className="mt-2 max-w-3xl text-sm text-slate-400">Public preview images collected from relevant source pages. Images are not used for biometric identification.</p>
  <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{unique.length?unique.map(item=><a key={item.image} href={item.source.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/50 hover:border-cyan-400/25">
    <div className="aspect-square overflow-hidden bg-slate-900"><img src={item.image} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"/></div>
    <div className="p-4"><div className="text-[10px] uppercase tracking-wider text-cyan-300">{item.source.provider||"PUBLIC SOURCE"}</div><div className="mt-2 line-clamp-2 text-sm">{item.source.title||item.source.url}</div><div className="mt-3 text-[11px] text-slate-600">Published {dateLabel(item.publishedAt)}</div></div>
  </a>):<div className="rounded-2xl border border-dashed border-slate-700 p-8 text-sm text-slate-400">No public source images have been captured yet. A deep scan can enrich more profile and document pages.</div>}</div>
 </div></main>;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic="force-dynamic";

export default async function MediaPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const c=await db.case.findUnique({where:{id},include:{evidence:{where:{OR:[{metadata:{path:["kind"],equals:"MEDIA"}},{title:{contains:"video",mode:"insensitive"}},{title:{contains:"image",mode:"insensitive"}}]},include:{source:true},orderBy:{collectedAt:"desc"}}}});
 if(!c) notFound();
 return <main className="min-h-screen p-6 md:p-10"><div className="mx-auto max-w-7xl"><Link href={`/cases/${id}`} className="text-sm text-slate-400">← {c.title}</Link><p className="mt-6 text-xs tracking-[.3em] text-cyan-300">MEDIA INTELLIGENCE</p><h1 className="mt-2 text-3xl font-semibold">Public media evidence</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">Media discovered from public sources can be preserved here with its source and collection timestamp. Automated biometric identification is not performed.</p><div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{c.evidence.length?c.evidence.map(e=><article key={e.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5"><div className="text-xs text-cyan-300">{e.source?.provider??"MEDIA"}</div><h2 className="mt-2 font-medium">{e.title}</h2>{e.content&&<p className="mt-2 line-clamp-3 text-sm text-slate-400">{e.content}</p>}<div className="mt-4 text-xs text-slate-600">{e.collectedAt.toISOString()}</div></article>):<div className="rounded-2xl border border-dashed border-slate-700 p-8 text-sm text-slate-400">No media evidence collected yet.</div>}</div></div></main>;
}

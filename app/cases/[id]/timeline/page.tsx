import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export default async function Timeline({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const c=await db.case.findUnique({where:{id},include:{events:{orderBy:{occurredAt:"desc"}}}});
 if(!c) notFound();
 return <main className="min-h-screen p-8"><div className="mx-auto max-w-5xl"><Link href={`/cases/${id}`} className="text-sm text-slate-400">← {c.title}</Link><h1 className="mt-5 text-3xl font-semibold">Timeline</h1><div className="mt-8 grid gap-4">{c.events.map(e=><article key={e.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5"><time className="text-xs text-cyan-300">{e.occurredAt.toISOString()}</time><h2 className="mt-2 font-medium">{e.title}</h2>{e.description&&<p className="mt-2 text-sm text-slate-400">{e.description}</p>}</article>)}</div></div></main>;
}

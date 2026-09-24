"use client";

import { useMemo, useState } from "react";

export type SourceLibraryItem={
  id:string;
  title:string;
  url:string;
  provider:string;
  collectedAt:string;
  publishedAt?:string;
  modifiedAt?:string;
  classification:string;
  category:string;
  decision:"KEEP"|"REVIEW"|"REJECT"|"UNREVIEWED";
  confidence:number|null;
  reason:string;
  aiCurated:boolean;
  imageUrl?:string;
};

function dateLabel(value?:string){
  if(!value)return "Unknown";
  const d=new Date(value);
  return Number.isNaN(d.getTime())?value:d.toLocaleDateString();
}

export function SourceLibrary({items}:{items:SourceLibraryItem[]}){
  const [view,setView]=useState<"RELEVANT"|"REVIEW"|"HIDDEN"|"ALL">("RELEVANT");
  const [category,setCategory]=useState("ALL");
  const [query,setQuery]=useState("");

  const categories=useMemo(()=>["ALL",...Array.from(new Set(items.map(i=>i.category).filter(Boolean))).sort()],[items]);
  const counts=useMemo(()=>({
    relevant:items.filter(i=>i.decision==="KEEP").length,
    review:items.filter(i=>i.decision==="REVIEW"||i.decision==="UNREVIEWED").length,
    hidden:items.filter(i=>i.decision==="REJECT").length
  }),[items]);

  const filtered=useMemo(()=>items.filter(item=>{
    if(view==="RELEVANT"&&item.decision!=="KEEP")return false;
    if(view==="REVIEW"&&item.decision!=="REVIEW"&&item.decision!=="UNREVIEWED")return false;
    if(view==="HIDDEN"&&item.decision!=="REJECT")return false;
    if(category!=="ALL"&&item.category!==category)return false;
    const q=query.trim().toLowerCase();
    if(q&&!((item.title+" "+item.url+" "+item.provider).toLowerCase().includes(q)))return false;
    return true;
  }),[items,view,category,query]);

  return <div>
    <div className="grid gap-3 sm:grid-cols-3">
      <button onClick={()=>setView("RELEVANT")} className={"rounded-xl border p-4 text-left "+(view==="RELEVANT"?"border-emerald-400/40 bg-emerald-400/10":"border-slate-800 bg-slate-950/40")}>
        <div className="text-[10px] uppercase tracking-[.18em] text-slate-500">Relevant</div><div className="mt-1 text-2xl font-semibold">{counts.relevant}</div>
      </button>
      <button onClick={()=>setView("REVIEW")} className={"rounded-xl border p-4 text-left "+(view==="REVIEW"?"border-amber-400/40 bg-amber-400/10":"border-slate-800 bg-slate-950/40")}>
        <div className="text-[10px] uppercase tracking-[.18em] text-slate-500">Needs review</div><div className="mt-1 text-2xl font-semibold">{counts.review}</div>
      </button>
      <button onClick={()=>setView("HIDDEN")} className={"rounded-xl border p-4 text-left "+(view==="HIDDEN"?"border-rose-400/40 bg-rose-400/10":"border-slate-800 bg-slate-950/40")}>
        <div className="text-[10px] uppercase tracking-[.18em] text-slate-500">Filtered noise</div><div className="mt-1 text-2xl font-semibold">{counts.hidden}</div>
      </button>
    </div>

    <div className="mt-5 flex flex-col gap-3 lg:flex-row">
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filter title, domain or provider…"
        className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-cyan-400/40"/>
      <select value={category} onChange={e=>setCategory(e.target.value)}
        className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
        {categories.map(c=><option key={c} value={c}>{c==="ALL"?"All categories":c.replaceAll("_"," ")}</option>)}
      </select>
      <button onClick={()=>setView("ALL")} className="rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-400 hover:text-white">All raw sources</button>
    </div>

    <div className="mt-6 grid gap-4">
      {filtered.map(item=><article key={item.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/45">
        <div className="grid md:grid-cols-[1fr_auto]">
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider">
              <span className="text-cyan-300">{item.provider}</span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-400">{item.category.replaceAll("_"," ")}</span>
              <span className={"rounded-full border px-2 py-0.5 "+(item.decision==="KEEP"?"border-emerald-500/30 text-emerald-300":item.decision==="REJECT"?"border-rose-500/30 text-rose-300":"border-amber-500/30 text-amber-300")}>{item.decision}</span>
              {item.aiCurated&&<span className="rounded-full border border-violet-500/30 px-2 py-0.5 text-violet-300">AI reviewed</span>}
              {item.confidence!==null&&<span className="text-slate-600">{Math.round(item.confidence)}%</span>}
            </div>
            <h2 className="mt-3 text-base font-medium">{item.title}</h2>
            <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-xs text-slate-500 hover:text-cyan-200">{item.url}</a>
            {item.reason&&<p className="mt-3 text-sm leading-6 text-slate-400">{item.reason}</p>}
          </div>
          {item.imageUrl&&<div className="hidden w-44 border-l border-slate-800 bg-slate-900/30 md:block"><img src={item.imageUrl} alt="" className="h-full max-h-40 w-full object-cover"/></div>}
        </div>
        <div className="grid gap-2 border-t border-slate-800 bg-slate-950/60 px-5 py-3 text-[11px] text-slate-500 sm:grid-cols-3">
          <div><span className="text-slate-600">Published</span><div className="mt-0.5 text-slate-300">{dateLabel(item.publishedAt)}</div></div>
          <div><span className="text-slate-600">Modified</span><div className="mt-0.5 text-slate-300">{dateLabel(item.modifiedAt)}</div></div>
          <div><span className="text-slate-600">Collected by TRACY</span><div className="mt-0.5 text-slate-300">{dateLabel(item.collectedAt)}</div></div>
        </div>
      </article>)}
      {!filtered.length&&<div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500">No sources match this filter.</div>}
    </div>
  </div>;
}

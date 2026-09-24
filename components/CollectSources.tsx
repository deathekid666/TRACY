"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CollectSources({ caseId, defaultQuery }: { caseId: string; defaultQuery: string }) {
  const router = useRouter();
  const [query,setQuery]=useState(defaultQuery);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function run(e:FormEvent){
    e.preventDefault(); setBusy(true); setMessage("");
    const res=await fetch(`/api/cases/${caseId}/collect`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query})});
    const body=await res.json();
    setBusy(false);
    if(!res.ok){setMessage(body.error??"Collection failed");return;}
    setMessage(`Found ${body.found ?? body.count} · saved ${body.count} · duplicates ${body.skipped ?? 0}`);
    router.refresh();
  }

  return <form onSubmit={run} className="flex flex-col gap-3 sm:flex-row">
    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, username, email, domain…" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300/50"/>
    <button disabled={busy||!query.trim()} className="rounded-xl bg-cyan-300 px-5 py-3 font-medium text-slate-950 disabled:opacity-50">{busy?"Collecting…":"Discover public sources"}</button>
    {message&&<span className="self-center text-xs text-slate-400">{message}</span>}
  </form>;
}

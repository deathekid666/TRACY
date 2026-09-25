"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CollectSources({ caseId, defaultQuery }: { caseId: string; defaultQuery: string }) {
  const router = useRouter();
  const [query,setQuery]=useState(defaultQuery);
  const [busy,setBusy]=useState<"quick"|"deep"|null>(null);
  const [message,setMessage]=useState("");

  async function run(mode:"quick"|"deep",e?:FormEvent){
    e?.preventDefault();
    if(!query.trim()||busy)return;
    setBusy(mode);
    setMessage(mode==="quick"?"Running quick scan…":"Running deep scan. You can keep this case open while it works…");
    try{
      const res=await fetch(`/api/cases/${caseId}/collect`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({query,mode})
      });
      const body=await res.json();
      if(!res.ok){
        setMessage(body.detail||body.error||"Collection failed");
        return;
      }
      const curation=body.curation;
      const curated=curation?(`${curation.kept} relevant · ${curation.review} review · ${curation.rejected} hidden noise`):"";
      const providerNote=body.providerStatus==="degraded"?` · provider degraded (${body.failedSearchCalls}/${body.totalSearchCalls} failed)`:"";
      setMessage(`${mode==="quick"?"Quick":"Deep"} scan: saved ${body.count} · ${curated}${providerNote}`);
      router.refresh();
    }catch(err){
      setMessage(err instanceof Error?err.message:"Collection failed");
    }finally{
      setBusy(null);
    }
  }

  return <div>
    <form onSubmit={e=>run("quick",e)} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row">
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, username, email, domain…"
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300/50"/>
        <button disabled={Boolean(busy)||!query.trim()}
          className="rounded-xl bg-cyan-300 px-5 py-3 font-medium text-slate-950 disabled:opacity-50">
          {busy==="quick"?"Quick scanning…":"Quick scan"}
        </button>
        <button type="button" onClick={()=>run("deep")} disabled={Boolean(busy)||!query.trim()}
          className="rounded-xl border border-violet-400/30 bg-violet-400/10 px-5 py-3 font-medium text-violet-200 hover:bg-violet-400/15 disabled:opacity-50">
          {busy==="deep"?"Deep scanning…":"Deep scan"}
        </button>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-500">
        <span><b className="text-slate-300">Quick</b> — core identity, major profiles, first documents.</span>
        <span><b className="text-slate-300">Deep</b> — archives, documents, handle pivots, forums and independent indexes.</span>
      </div>
      {message&&<div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">{message}</div>}
    </form>
  </div>;
}

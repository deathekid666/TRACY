"use client";
import { FormEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getScanController } from "@/lib/scan-controller";

export function CollectSources({ caseId, defaultQuery, autoEnabled=false, version="" }: {
  caseId: string; defaultQuery: string; autoEnabled?: boolean; version?: string;
}) {
  const router=useRouter();
  const [query,setQuery]=useState(defaultQuery);
  const controller=useMemo(()=>getScanController(caseId),[caseId]);
  const {busy,message,error,revision}=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const lastRefresh=useRef(0);

  useEffect(()=>{
    controller.startAutomatic(defaultQuery,autoEnabled,version);
  },[controller,defaultQuery,autoEnabled,version]);

  useEffect(()=>{
    if(revision>lastRefresh.current){lastRefresh.current=revision;router.refresh()}
  },[revision,router]);

  function run(mode:"quick"|"deep",e?:FormEvent){
    e?.preventDefault();
    void controller.run(query,mode);
  }

  return <div>
    <form onSubmit={e=>run("quick",e)} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row">
        <input aria-label="Search identity" disabled={Boolean(busy)} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, username, email, domain…"
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
        <span><b className="text-slate-300">Quick</b> — first identity and profile results.</span>
        <span><b className="text-slate-300">Deep</b> — contacts, documents, archives and connected accounts.</span>
      </div>
      {message&&<div role={error?"alert":"status"} aria-live="polite" className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">{message}</div>}
    </form>
  </div>;
}

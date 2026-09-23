"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ExtractEvidence({caseId}:{caseId:string}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [msg,setMsg]=useState("");
 async function run(){setBusy(true);const r=await fetch(`/api/cases/${caseId}/extract`,{method:"POST"});const b=await r.json();setBusy(false);setMsg(r.ok?`${b.entitiesCreated} entities · ${b.linksCreated} evidence links`:b.error??"Failed");router.refresh();}
 return <div className="flex items-center gap-3"><button onClick={run} disabled={busy} className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-200 disabled:opacity-50">{busy?"Extracting…":"Extract entities from evidence"}</button>{msg&&<span className="text-xs text-slate-400">{msg}</span>}</div>;
}

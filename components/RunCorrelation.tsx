"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunCorrelation({caseId}:{caseId:string}){
 const router=useRouter(); const [busy,setBusy]=useState(false); const [msg,setMsg]=useState("");
 async function run(){setBusy(true);setMsg("");const r=await fetch(`/api/cases/${caseId}/correlate`,{method:"POST"});const b=await r.json();setBusy(false);setMsg(r.ok?`${b.created} candidate link(s) added`:b.error??"Failed");router.refresh();}
 return <div className="flex items-center gap-3"><button onClick={run} disabled={busy} className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">{busy?"Correlating…":"Run correlation"}</button>{msg&&<span className="text-xs text-slate-400">{msg}</span>}</div>;
}

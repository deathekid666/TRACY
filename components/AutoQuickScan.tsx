"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function AutoQuickScan({caseId,query,enabled}:{caseId:string;query:string;enabled:boolean}){
  const router=useRouter();
  const started=useRef(false);
  const [state,setState]=useState<"idle"|"running"|"done"|"error">("idle");

  useEffect(()=>{
    if(!enabled||started.current||!query.trim())return;
    started.current=true;
    const key="tracy:auto-quick:"+caseId;
    if(typeof window!=="undefined"&&sessionStorage.getItem(key)==="running")return;
    if(typeof window!=="undefined")sessionStorage.setItem(key,"running");
    setState("running");

    fetch(`/api/cases/${caseId}/collect`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({query,mode:"quick"})
    }).then(async response=>{
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.detail||body.error||"Quick scan failed");
      if(typeof window!=="undefined")sessionStorage.setItem(key,"done");
      setState("done");
      router.refresh();
    }).catch(()=>{
      if(typeof window!=="undefined")sessionStorage.removeItem(key);
      setState("error");
    });
  },[caseId,enabled,query,router]);

  if(!enabled||state==="idle")return null;

  return <div className={"mt-4 rounded-xl border px-4 py-3 text-xs "+(state==="error"?"border-rose-400/20 bg-rose-400/[.06] text-rose-200":"border-cyan-400/20 bg-cyan-400/[.06] text-cyan-100")}>
    {state==="running"&&<span>Quick scan is running while you review the dossier. Results will appear automatically.</span>}
    {state==="done"&&<span>Quick scan complete.</span>}
    {state==="error"&&<span>Quick scan did not complete. You can retry it from Scan control.</span>}
  </div>;
}

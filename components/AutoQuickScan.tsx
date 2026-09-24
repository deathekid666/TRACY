"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ScanState="idle"|"quick"|"deep"|"done"|"error";

export function AutoQuickScan({caseId,query,enabled}:{caseId:string;query:string;enabled:boolean}){
  const router=useRouter();
  const started=useRef(false);
  const [state,setState]=useState<ScanState>("idle");
  const [message,setMessage]=useState("");

  useEffect(()=>{
    if(!enabled||started.current||!query.trim())return;
    started.current=true;

    const key="tracy:auto-scan:"+caseId;
    const previous=typeof window!=="undefined"?sessionStorage.getItem(key):null;
    if(previous==="done")return;

    let cancelled=false;

    async function run(){
      try{
        setState("quick");
        setMessage("Quick scan running… core identity, contact and academic records first.");
        if(typeof window!=="undefined")sessionStorage.setItem(key,"quick");

        const quick=await fetch(`/api/cases/${caseId}/collect`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({query,mode:"quick"})
        });
        const quickBody=await quick.json().catch(()=>({}));
        if(!quick.ok)throw new Error(quickBody.detail||quickBody.error||"Quick scan failed");
        if(cancelled)return;

        router.refresh();

        setState("deep");
        setMessage("Quick results are ready. Deep scan is continuing automatically for old accounts, forums, archives, documents and handle pivots.");
        if(typeof window!=="undefined")sessionStorage.setItem(key,"deep");

        const deep=await fetch(`/api/cases/${caseId}/collect`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({query,mode:"deep"})
        });
        const deepBody=await deep.json().catch(()=>({}));
        if(!deep.ok)throw new Error(deepBody.detail||deepBody.error||"Deep scan failed");
        if(cancelled)return;

        if(typeof window!=="undefined")sessionStorage.setItem(key,"done");
        setState("done");
        setMessage("Automatic deep scan complete.");
        router.refresh();
      }catch(err){
        if(cancelled)return;
        if(typeof window!=="undefined")sessionStorage.removeItem(key);
        setState("error");
        setMessage(err instanceof Error?err.message:"Automatic scan failed");
      }
    }

    void run();
    return ()=>{cancelled=true};
  },[caseId,enabled,query,router]);

  if(!enabled||state==="idle")return null;

  return <div className={"mt-4 rounded-xl border px-4 py-3 text-xs "+(state==="error"?"border-rose-400/20 bg-rose-400/[.06] text-rose-200":"border-cyan-400/20 bg-cyan-400/[.06] text-cyan-100")}>
    {message}
  </div>;
}

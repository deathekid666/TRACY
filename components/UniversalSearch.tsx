"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

function detectType(value:string){
  const v=value.trim();
  if(/^\+?[\d\s().-]{7,}$/.test(v))return "PHONE";
  if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))return "EMAIL";
  if(/^https?:\/\//i.test(v))return "DOMAIN";
  if(/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(v))return "DOMAIN";
  if(/^@[a-z0-9._-]{2,}$/i.test(v))return "USERNAME";
  return "PERSON";
}

export default function UniversalSearch(){
  const router=useRouter();
  const [query,setQuery]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function submit(e:FormEvent){
    e.preventDefault();
    const value=query.trim();
    if(!value||busy)return;
    setBusy(true); setError("");
    try{
      const type=detectType(value);
      const payload:any={title:value,notes:"Created by TRACY universal search"};
      if(type==="PERSON")payload.fullName=value;
      if(type==="USERNAME")payload.username=value.replace(/^@/,"");
      if(type==="EMAIL")payload.email=value;
      if(type==="PHONE")payload.phone=value;
      if(type==="DOMAIN")payload.domain=value.replace(/^https?:\/\//i,"").split("/")[0];

      const created=await fetch("/api/cases",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const investigation=await created.json();
      if(!created.ok)throw new Error(investigation.error||"Could not start investigation");

      const collected=await fetch(`/api/cases/${investigation.id}/collect`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:value,mode:"quick"})});
      const outcome=await collected.json();
      if(!collected.ok)throw new Error(outcome.detail||outcome.error||"Search failed");
      router.push(`/cases/${investigation.id}`);
      router.refresh();
    }catch(err){
      setError(err instanceof Error?err.message:"Search failed");
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="w-full">
    <div className="search-shell">
      <input value={query} onChange={e=>setQuery(e.target.value)} autoFocus
        placeholder="Name, username, email, phone, domain..."
        className="search-input" aria-label="Universal investigation search"/>
      <button className="search-button" disabled={busy||!query.trim()}>{busy?"Searching…":"Search"}</button>
    </div>
    {busy&&<div className="mt-5 text-center text-sm text-slate-400">Running a quick scan first. Deep discovery can continue inside the case.</div>}
    {error&&<div className="mt-5 text-center text-sm text-red-300">{error}</div>}
  </form>
}

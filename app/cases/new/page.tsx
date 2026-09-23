"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const fields = [
  ["title","Case title","e.g. Operation Atlas"],
  ["fullName","Full name","Known or suspected name"],
  ["username","Username","Known handle"],
  ["email","Email","Known email"],
  ["phone","Phone","Known phone"],
  ["organization","Organization","Employer / company / group"],
  ["domain","Domain","Website or domain"],
  ["location","Known location","City / country"],
];

export default function NewCasePage(){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); setBusy(true); setError("");
    const data=Object.fromEntries(new FormData(e.currentTarget).entries());
    const res=await fetch("/api/cases",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
    const body=await res.json();
    if(!res.ok){setError(body.error??"Could not create case");setBusy(false);return;}
    router.push(`/cases/${body.id}`);
  }

  return <main className="min-h-screen p-8 md:p-12"><div className="mx-auto max-w-3xl">
    <p className="text-sm tracking-[.3em] text-cyan-300">NEW INVESTIGATION</p>
    <h1 className="mt-2 text-3xl font-semibold">Create a target profile</h1>
    <p className="mt-3 text-slate-400">Start with the identifiers already known. TRACY stores them as separate entities so they can later be correlated against evidence.</p>
    <form onSubmit={submit} className="mt-8 grid gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
      {fields.map(([name,label,placeholder])=><label key={name} className="grid gap-2"><span className="text-sm text-slate-300">{label}</span><input name={name} required={name==="title"} placeholder={placeholder} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300/50"/></label>)}
      <label className="grid gap-2"><span className="text-sm text-slate-300">Notes</span><textarea name="notes" rows={5} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300/50"/></label>
      {error&&<p className="text-sm text-red-300">{error}</p>}
      <button disabled={busy} className="mt-2 rounded-xl bg-cyan-300 px-5 py-3 font-medium text-slate-950 disabled:opacity-50">{busy?"Creating…":"Create investigation"}</button>
    </form>
  </div></main>;
}
"use client";
import {useState} from "react";import{useRouter}from"next/navigation";
export function SeedFinance({caseId}:{caseId:string}){const router=useRouter();const[busy,setBusy]=useState(false);async function run(){setBusy(true);await fetch(`/api/cases/${caseId}/finance/seed`,{method:"POST"});setBusy(false);router.refresh()}return <button onClick={run} disabled={busy} className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">{busy?"Generating…":"Load synthetic dataset"}</button>}

"use client";
import ReactFlow,{Background,Controls,MiniMap,MarkerType} from "reactflow";
import "reactflow/dist/style.css";

type N={id:string;label:string;type:string};
type E={id:string;fromEntityId:string;toEntityId:string;type:string;confidence:number|null;status:string};

export function RelationshipGraph({entities,relations}:{entities:N[];relations:E[]}){
 const nodes=entities.map((e,i)=>({id:e.id,position:{x:(i%4)*230,y:Math.floor(i/4)*150},data:{label:`${e.type}\n${e.label}`},style:{background:"#0f1d29",color:"#e8f0f5",border:"1px solid #27485a",borderRadius:12,width:190,padding:10,whiteSpace:"pre-line" as const}}));
 const edges=relations.map(r=>({id:r.id,source:r.fromEntityId,target:r.toEntityId,label:`${r.type} ${r.confidence?Math.round(r.confidence*100)+"%":""}`,markerEnd:{type:MarkerType.ArrowClosed},style:{strokeWidth:1.5},labelStyle:{fill:"#9fb3c2",fontSize:10}}));
 return <div className="h-[650px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950"><ReactFlow nodes={nodes} edges={edges} fitView><Background/><MiniMap/><Controls/></ReactFlow></div>;
}

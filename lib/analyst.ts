import { db } from "@/lib/db";
export async function analyzeCase(caseId:string,question:string){
 const c=await db.case.findUnique({where:{id:caseId},include:{entities:true,relations:true,sources:true,evidence:{include:{source:true}},events:true,transactions:true}});
 if(!c) throw new Error("Case not found");
 const q=question.toLowerCase();
 if(q.includes("source")||q.includes("evidence")) return {answer:`This case currently contains ${c.sources.length} sources and ${c.evidence.length} evidence records. Open the Evidence or Sources tab to inspect provenance.`,refs:c.evidence.slice(0,5).map(e=>({id:e.id,title:e.title,url:e.source?.url??null}))};
 if(q.includes("relation")||q.includes("connect")||q.includes("link")) return {answer:`TRACY currently has ${c.relations.length} candidate relationship(s). These are confidence-scored hypotheses, not automatically confirmed facts.`,refs:[]};
 if(q.includes("transaction")||q.includes("finance")||q.includes("payment")) return {answer:`The Finance Lab contains ${c.transactions.length} transaction(s); all records in the current development workflow are synthetic.`,refs:[]};
 return {answer:`Case “${c.title}” has ${c.entities.length} entities, ${c.sources.length} sources, ${c.evidence.length} evidence records, ${c.relations.length} relationships and ${c.events.length} timeline events. Ask about sources, evidence, relationships or the synthetic finance dataset.`,refs:[]};
}

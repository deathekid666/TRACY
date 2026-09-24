export type SearchPlan={kind:"PERSON"|"EMAIL"|"PHONE"|"USERNAME"|"DOMAIN"|"GENERAL";queries:string[]};

function unique(v:string[]){return [...new Set(v.map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean))]}
export function detectSearchKind(input:string):SearchPlan["kind"]{
 const v=input.trim();
 if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))return "EMAIL";
 if(/^\+?[\d\s().-]{7,}$/.test(v))return "PHONE";
 if(/^@[a-z0-9._-]{2,}$/i.test(v))return "USERNAME";
 if(/^https?:\/\//i.test(v)||/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(v))return "DOMAIN";
 if(v.split(/\s+/).length>=2)return "PERSON";
 return "GENERAL";
}
function nameVariants(q:string){
 const parts=q.trim().split(/\s+/).filter(Boolean);
 if(parts.length<2)return [q];
 return unique([q,[...parts].reverse().join(" "),q.toUpperCase(),[...parts].reverse().join(" ").toUpperCase()]);
}
export function buildSearchPlan(input:string):SearchPlan{
 const q=input.trim(),kind=detectSearchKind(q);
 if(kind!=="PERSON")return {kind,queries:unique([q,q+" profile",q+" document PDF",q+" contact"])};
 const names=nameVariants(q),a=names[0],b=names[1]||a;
 return {kind,queries:unique([a,b,a+" PDF document",b+" PDF document",a+" inscription liste resultat etudiant universite faculte",b+" inscription liste resultat etudiant universite faculte",a+" FSJES FSJP universite",a+" CV resume conference publication"])};
}

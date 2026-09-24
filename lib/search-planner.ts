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
function variants(q:string){const p=q.trim().split(/\s+/).filter(Boolean);return p.length>=2?unique([q,[...p].reverse().join(" ")]):[q]}
export function buildSearchPlan(input:string):SearchPlan{
 const q=input.trim(),kind=detectSearchKind(q);
 if(kind!=="PERSON")return {kind,queries:unique([q,q+" profile",q+" document",q+" contact"])};
 const v=variants(q),a=v[0],b=v[1]||a;
 return {kind,queries:unique([
  a,
  b,
  a+" universite faculte etudiant liste resultat inscription",
  b+" universite faculte etudiant liste resultat inscription",
  a+" FSJES FSJP ENCG EST faculte",
  b+" FSJES FSJP ENCG EST faculte",
  a+" CV rapport memoire soutenance conference",
  b+" PDF liste etudiants resultats concours"
 ])};
}

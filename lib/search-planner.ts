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

function variants(q:string){
  const p=q.trim().split(/\s+/).filter(Boolean);
  return p.length>=2?unique([q,[...p].reverse().join(" ")]):[q];
}

export function buildSearchPlan(input:string):SearchPlan{
  const q=input.trim(),kind=detectSearchKind(q);

  if(kind!=="PERSON"){
    return {kind,queries:unique([
      q,
      '"'+q+'"',
      q+" profile",
      q+" account member user",
      q+" document PDF",
      q+" contact"
    ])};
  }

  const v=variants(q),a=v[0],b=v[1]||a;

  return {kind,queries:unique([
    '"'+a+'"',
    '"'+b+'"',
    'site:linkedin.com/in "'+a+'"',
    'site:linkedin.com/in "'+a+'" email',
    'site:linkedin.com/in "'+a+'" gmail',
    '"'+a+'" email contact',
    '"'+a+'" gmail',
    '"'+a+'" "@gmail.com"',
    '"'+a+'" profile account member user',
    '"'+a+'" LinkedIn Instagram Facebook',
    '"'+a+'" phone telephone contact',
    '"'+a+'" CV resume',
    '"'+a+'" university student',
    'site:scribd.com "'+a+'"',
    'site:scribd.com "'+b+'"',
    'filetype:pdf "'+a+'"',
    'filetype:pdf "'+b+'"',
    'site:ac.ma "'+a+'"',
    'site:ac.ma "'+b+'"',
    '"'+a+'" étudiant liste student',
    '"'+b+'" étudiant liste student',
    '"'+a+'" inscription résultat concours',
    '"'+b+'" inscription résultat concours',
    '"'+a+'" université FSJES faculté',
    '"'+a+'" payment merchant donation invoice receipt',
    '"'+a+'" forum author contributor',
    '"'+b+'" profile account member user'
  ])};
}

export type SearchPlan={kind:"PERSON"|"EMAIL"|"PHONE"|"USERNAME"|"DOMAIN"|"GENERAL";queries:string[]};

function unique(values:string[]){return [...new Set(values.map(v=>v.trim()).filter(Boolean))]}

export function detectSearchKind(input:string):SearchPlan["kind"]{
  const v=input.trim();
  if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))return "EMAIL";
  if(/^\+?[\d\s().-]{7,}$/.test(v))return "PHONE";
  if(/^@[a-z0-9._-]{2,}$/i.test(v))return "USERNAME";
  if(/^https?:\/\//i.test(v)||/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(v))return "DOMAIN";
  if(v.split(/\s+/).length>=2)return "PERSON";
  return "GENERAL";
}

export function buildSearchPlan(input:string):SearchPlan{
  const q=input.trim(),kind=detectSearchKind(q),exact=q;
  const byKind:Record<SearchPlan["kind"],string[]>={
    PERSON:[
      q,
      exact,
      `${exact} email contact phone`,
      `${exact} profile bio CV resume`,
      `${exact} PDF`,
      `${exact} LinkedIn GitHub Facebook Instagram Twitter Pinterest`,
      `${exact} company employer organization conference publication`
    ],
    EMAIL:[exact,`${exact} profile`,`${exact} PDF`,`${exact} GitHub forum contact`],
    PHONE:[exact,`${exact} contact`,`${exact} profile`,`${exact} PDF`],
    USERNAME:[q,exact,`${exact} GitHub Reddit Instagram Facebook Twitter Pinterest`,`${exact} profile`],
    DOMAIN:[q,`${q.replace(/^https?:\/\//i,"").split("/")[0]} pages`,`${exact} contact`,`${exact} PDF`],
    GENERAL:[q,exact,`${exact} profile`,`${exact} PDF`]
  };
  return {kind,queries:unique(byKind[kind])};
}

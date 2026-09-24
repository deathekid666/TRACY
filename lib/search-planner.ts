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
  const q=input.trim(); const kind=detectSearchKind(q); const exact=`"${q}"`;
  const byKind:Record<SearchPlan["kind"],string[]>={
    PERSON:[
      q,exact,
      `${exact} (email OR contact OR phone)`,
      `${exact} (profile OR bio OR CV OR resume)`,
      `${exact} filetype:pdf`,
      `${exact} (LinkedIn OR GitHub OR Facebook OR Instagram OR X OR Twitter OR Pinterest)`,
      `${exact} (company OR employer OR organization OR conference OR publication)`
    ],
    EMAIL:[exact,`${exact} profile`,`${exact} filetype:pdf`,`${exact} (GitHub OR forum OR contact)`],
    PHONE:[exact,`${exact} contact`,`${exact} profile`,`${exact} filetype:pdf`],
    USERNAME:[q,exact,`${exact} (GitHub OR Reddit OR Instagram OR Facebook OR X OR Twitter OR Pinterest)`,`${exact} profile`],
    DOMAIN:[q,`site:${q.replace(/^https?:\/\//i,"").split("/")[0]}`,`${exact} contact`,`${exact} filetype:pdf`],
    GENERAL:[q,exact,`${exact} profile`,`${exact} filetype:pdf`]
  };
  return {kind,queries:unique(byKind[kind])};
}

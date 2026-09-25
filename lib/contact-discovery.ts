import { db } from "@/lib/db";

const RESERVED_HANDLES=new Set([
  "public","profile","profiles","people","user","users","help","support","groups","pages",
  "reel","reels","explore","community","communities","business","search","topics","settings",
  "watch","events","marketplace","about","login","signin","signup","register"
]);

const CONTACT_SURFACES=[
  "linkedin.com","github.com","gitlab.com","about.me","linktr.ee","medium.com",
  "researchgate.net","academia.edu","zoominfo.com"
];

function unique(values:string[]){
  return [...new Set(values.map(v=>v.replace(/\s+/g," ").trim()).filter(Boolean))];
}

function validHandle(value:string){
  const v=value.toLowerCase().replace(/^@/,"").trim();
  const looksLikeDomain=/\.(?:com|net|org|io|co|ma|fr|uk|me|tv|dev|app)$/i.test(v);
  return /^[a-z0-9._-]{3,32}$/.test(v)&&/[a-z]/.test(v)&&!looksLikeDomain&&!RESERVED_HANDLES.has(v);
}

function hostOf(url:string){
  try{return new URL(url).hostname.replace(/^www\./,"").toLowerCase()}catch{return ""}
}

function isContactSurface(host:string){
  return CONTACT_SURFACES.some(domain=>host===domain||host.endsWith("."+domain));
}

export type ContactEnrichmentPlan={
  queries:string[];
  sourceIds:string[];
  usernames:string[];
  sourceHosts:string[];
};

export async function buildContactEnrichmentPlan(caseId:string,personName:string,maxQueries=12):Promise<ContactEnrichmentPlan>{
  const [entities,sources]=await Promise.all([
    db.entity.findMany({
      where:{caseId,type:"USERNAME"},
      orderBy:{createdAt:"desc"},
      take:20,
      select:{canonical:true,label:true}
    }),
    db.source.findMany({
      where:{caseId},
      orderBy:{collectedAt:"desc"},
      take:120,
      select:{id:true,url:true,title:true,metadata:true}
    })
  ]);

  const usernames=unique(entities
    .map(e=>(e.canonical||e.label).replace(/^@/,""))
    .filter(validHandle))
    .slice(0,6);

  const supported=sources.filter(source=>{
    const m=(source.metadata??{}) as Record<string,unknown>;
    const classification=String(m.classification??"");
    const curated=String(m.curatedDecision??"");
    if(curated==="REJECT")return false;
    if(classification!=="STRONG"&&classification!=="POSSIBLE")return false;

    const category=String(m.curatedCategory??m.category??"");
    const host=hostOf(source.url);
    const hay=((source.title??"")+" "+source.url).toLowerCase();
    return category==="PROFESSIONAL"||isContactSurface(host)||/linkedin|github|gitlab|about\.me|linktr\.ee|zoominfo|researchgate|academia/.test(hay);
  });

  const sourceIds=unique(supported.map(s=>s.id)).slice(0,24);
  const sourceHosts=unique(supported.map(s=>hostOf(s.url)).filter(Boolean)).slice(0,8);

  const name=personName.replace(/"/g," ").replace(/\s+/g," ").trim();
  const queries:string[]=[
    `site:linkedin.com/in "${name}" email`,
    `site:linkedin.com/in "${name}" gmail`,
    `"${name}" email contact`,
    `"${name}" gmail`,
    `"${name}" "@gmail.com"`,
    `site:github.com "${name}" email`,
    `site:gitlab.com "${name}" email`,
    `site:about.me "${name}" email`,
    `site:linktr.ee "${name}" email`,
    `filetype:pdf "${name}" email`
  ];

  for(const username of usernames){
    queries.push(`"${name}" "${username}" email`);
    queries.push(`"${name}" "${username}" gmail`);
    queries.push(`"${name}" "@${username}" contact`);
  }

  for(const host of sourceHosts){
    queries.push(`site:${host} "${name}" email`);
  }

  return {
    queries:unique(queries).slice(0,Math.max(0,maxQueries)),
    sourceIds,
    usernames,
    sourceHosts
  };
}

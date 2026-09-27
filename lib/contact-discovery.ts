import { db } from "@/lib/db";
import { validPublicHandle as validHandle, publicDiscoverySurface } from "@/lib/public-handles";

const CONTACT_SURFACES=[
  "linkedin.com","github.com","gitlab.com","about.me","linktr.ee","medium.com",
  "researchgate.net","academia.edu","zoominfo.com"
];

function unique(values:string[]){
  return [...new Set(values.map(v=>v.replace(/\s+/g," ").trim()).filter(Boolean))];
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
    if(curated==="REJECT"||publicDiscoverySurface(source.url))return false;
    if(classification!=="STRONG"&&classification!=="POSSIBLE")return false;

    const category=String(m.curatedCategory??m.category??"");
    const host=hostOf(source.url);
    const hay=((source.title??"")+" "+source.url).toLowerCase();
    return category==="PROFESSIONAL"||isContactSurface(host)||/linkedin|github|gitlab|about\.me|linktr\.ee|zoominfo|researchgate|academia/.test(hay);
  });

  const sourceIds=unique(supported.map(s=>s.id)).slice(0,24);
  const sourceHosts=unique(supported.map(s=>hostOf(s.url)).filter(Boolean)).slice(0,8);

  const name=personName.replace(/"/g," ").replace(/\s+/g," ").trim();
  // Reserve room for every strategy. A long list of sites or handles used to
  // consume the whole budget before any broad contact query could run.
  const siteQueries=["email","contact"].flatMap(intent=>
    sourceHosts.map(host=>`site:${host} "${name}" ${intent}`));
  const handleQueries=["email","gmail","contact"].flatMap(intent=>
    usernames.map(username=>`"${name}" "${intent==="contact"?"@":""}${username}" ${intent}`));
  const nameQueries=[
    `"${name}" email contact`,
    `"${name}" gmail`,
    `"${name}" "@gmail.com"`,
    `filetype:pdf "${name}" email`,
    `site:linkedin.com/in "${name}" email`,
    `"${name}" phone contact`
  ];
  const queries:string[]=[];
  for(let i=0;i<Math.max(siteQueries.length,handleQueries.length,nameQueries.length);i++){
    for(const group of [siteQueries,handleQueries,nameQueries]){
      if(group[i])queries.push(group[i]);
    }
  }

  return {
    queries:unique(queries).slice(0,Math.max(0,maxQueries)),
    sourceIds,
    usernames,
    sourceHosts
  };
}

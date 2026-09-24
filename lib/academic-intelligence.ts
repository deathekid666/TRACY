import { db } from "@/lib/db";

type AcademicRecord={
  sourceId:string;
  sourceTitle:string;
  sourceUrl:string;
  institution?:string;
  academicYear?:string;
  semester?:string;
  session?:string;
  program?:string;
  module?:string;
  studentRecordId?:string;
  matchedName:string;
  confidence:number;
};

function meta(value:unknown){return (value??{}) as Record<string,unknown>}

function asciiDigits(value:string){
  const arabic="٠١٢٣٤٥٦٧٨٩";
  const persian="۰۱۲۳۴۵۶۷۸۹";
  return value
    .replace(/[٠-٩]/g,ch=>String(arabic.indexOf(ch)))
    .replace(/[۰-۹]/g,ch=>String(persian.indexOf(ch)))
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,"");
}

function norm(value:string){
  return asciiDigits(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function tokens(value:string){
  return norm(value).split(" ").filter(Boolean);
}

function identityMatch(text:string,name:string){
  const tt=tokens(text);
  const nt=tokens(name);
  if(nt.length<2||tt.length<2)return false;
  const first=nt[0],last=nt[nt.length-1];
  for(let i=0;i<tt.length;i++){
    if(tt[i]===first){
      for(let j=i;j<Math.min(tt.length,i+10);j++)if(tt[j]===last)return true;
    }
    if(tt[i]===last){
      for(let j=i;j<Math.min(tt.length,i+10);j++)if(tt[j]===first)return true;
    }
  }
  return false;
}

function capture(text:string,pattern:RegExp,max=120){
  const match=asciiDigits(text).match(pattern);
  const value=match?.[1]?.replace(/\s+/g," ").trim();
  return value?value.slice(0,max):undefined;
}

function institutionFrom(text:string,title:string){
  const combined=asciiDigits((title+" "+text.slice(0,5000)).replace(/\s+/g," "));
  return capture(
    combined,
    /((?:Université|University|Faculté|Faculty|École|Ecole|School|Institut|Institute)[^|•]{2,100}?)(?=\s(?:Année|Annee|Semestre|Session|Filière|Filiere|Module|N°|No\b)|$)/i,
    120
  );
}

function studentRecordIdNearName(text:string,name:string){
  const lower=norm(text);
  const variants=[norm(name),norm(name.split(/\s+/).reverse().join(" "))];
  let rawIndex=-1;
  for(const variant of variants){
    const i=lower.indexOf(variant);
    if(i>=0){rawIndex=i;break}
  }
  if(rawIndex<0)return undefined;

  const normalizedPrefix=lower.slice(Math.max(0,rawIndex-45),rawIndex);
  const matches=normalizedPrefix.match(/\b\d{6,12}\b/g);
  return matches?.at(-1);
}

function educationProfileEntries(text:string){
  const cleaned=asciiDigits(text).replace(/\s+/g," ");
  const marker=/(?:Education|Éducation|Formation|التعليم)\s*[:\-]?\s*/i.exec(cleaned);
  if(!marker)return [] as Array<{institution:string;academicYear:string}>;

  const start=(marker.index??0)+marker[0].length;
  const tail=cleaned.slice(start,start+2200);
  const stop=tail.search(/\b(?:Experience|Expérience|Employment|Skills|Activity|Activities)\b|(?:الخبرة|المهارات|النشاط)/i);
  const section=(stop>=0?tail.slice(0,stop):tail).trim();

  const entries:Array<{institution:string;academicYear:string}>=[];
  const re=/([A-ZÀ-Ý][A-Za-zÀ-ÿ0-9&.'()\/ -]{1,80}?)\s+((?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2}|Present|Current|Aujourd'hui))/g;
  for(const match of section.matchAll(re)){
    const institution=match[1].replace(/\s+/g," ").trim().replace(/^(?:Image|School|Education)\s+/i,"");
    const academicYear=match[2].replace(/\s+/g," ").trim();
    if(!institution||institution.length<2)continue;
    if(/^(?:and|the|in|at|from)$/i.test(institution))continue;
    entries.push({institution,academicYear});
    if(entries.length>=8)break;
  }
  return entries;
}

export async function extractAcademicIntelligence(caseId:string,personName:string){
  const sources=await db.source.findMany({
    where:{caseId},
    include:{evidence:{orderBy:{collectedAt:"desc"},take:8}},
    orderBy:{collectedAt:"desc"},
    take:260
  });

  const records:AcademicRecord[]=[];

  for(const source of sources){
    const sm=meta(source.metadata);
    const decision=String(sm.curatedDecision??"UNREVIEWED");
    if(decision==="REJECT")continue;

    const category=String(sm.curatedCategory??sm.category??"GENERAL");
    const sourceText=[source.title??"",...source.evidence.map(e=>e.content??"")].join(" ");
    const academicSignal=
      ["ACADEMIC","EDUCATION","DOCUMENT"].includes(category)||
      /universit|facult|student|étudiant|etudiant|année universitaire|annee universitaire|semestre|filière|filiere|apogee|module|education|éducation|formation|التعليم|school|college/i.test(sourceText);

    if(!academicSignal||!identityMatch(sourceText,personName))continue;

    const profileEntries=educationProfileEntries(sourceText);
    for(const entry of profileEntries){
      records.push({
        sourceId:source.id,
        sourceTitle:source.title??source.url,
        sourceUrl:source.url,
        institution:entry.institution,
        academicYear:entry.academicYear,
        matchedName:personName,
        confidence:84
      });
    }

    const academicYear=capture(sourceText,/(?:Année|Annee)\s+Universitaire\s*[:\-]?\s*(\d{4}\s*\/\s*\d{4})/i,20);
    const semester=capture(sourceText,/Semestre\s*[:\-]?\s*(S?\s*\d{1,2})/i,20);
    const session=capture(sourceText,/Session\s*[:\-]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{1,60})/i,70);
    const program=capture(sourceText,/(?:Filière|Filiere)\s*[:\-]?\s*([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9&' .\/-]{2,90})/i,100);
    const module=capture(sourceText,/Module\s*[:\-]?\s*([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9&' .\/-]{2,90})/i,100);
    const institution=institutionFrom(sourceText,source.title??"");
    const studentRecordId=studentRecordIdNearName(sourceText,personName);

    const hasDocumentRecord=Boolean(academicYear||semester||session||program||module||studentRecordId||institution);
    if(hasDocumentRecord){
      let confidence=62;
      if(academicYear||program||module)confidence+=12;
      if(institution)confidence+=10;
      if(studentRecordId)confidence+=8;
      confidence=Math.min(confidence,92);

      records.push({
        sourceId:source.id,
        sourceTitle:source.title??source.url,
        sourceUrl:source.url,
        institution,
        academicYear,
        semester,
        session,
        program,
        module,
        studentRecordId,
        matchedName:personName,
        confidence
      });
    }
  }

  const uniqueMap=new Map<string,AcademicRecord>();
  for(const record of records){
    const key=[
      record.sourceId,
      norm(record.institution??""),
      norm(record.academicYear??""),
      norm(record.program??""),
      norm(record.module??""),
      record.studentRecordId??""
    ].join("|");
    const previous=uniqueMap.get(key);
    if(!previous||record.confidence>previous.confidence)uniqueMap.set(key,record);
  }
  const unique=[...uniqueMap.values()];

  await db.event.create({
    data:{
      caseId,
      title:"Academic intelligence",
      description:"Extracted "+unique.length+" identity-matched public education/academic record(s) from retained evidence.",
      occurredAt:new Date(),
      metadata:{personName,records:unique}
    }
  });

  return {records:unique};
}

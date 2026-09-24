import type { CollectedResult, PublicConnector } from "./types";

type ArchiveDoc={identifier?:string;title?:string;description?:string|string[];creator?:string|string[];date?:string;mediatype?:string};
type ArchiveResponse={response?:{docs?:ArchiveDoc[]}};

function join(value?:string|string[]){return Array.isArray(value)?value.join(", "):(value||"")}

export class InternetArchiveConnector implements PublicConnector{
  id="internet-archive";
  label="Internet Archive";

  async search(query:string):Promise<CollectedResult[]>{
    const reversed=query.trim().split(/\s+/).reverse().join(" ");
    const url=new URL("https://archive.org/advancedsearch.php");
    url.searchParams.set("q",'\"'+query+'\" OR \"'+reversed+'\"');
    url.searchParams.append("fl[]","identifier");
    url.searchParams.append("fl[]","title");
    url.searchParams.append("fl[]","description");
    url.searchParams.append("fl[]","creator");
    url.searchParams.append("fl[]","date");
    url.searchParams.append("fl[]","mediatype");
    url.searchParams.set("rows","30");
    url.searchParams.set("page","1");
    url.searchParams.set("output","json");
    const response=await fetch(url,{cache:"no-store",headers:{"User-Agent":"TRACY-PublicResearch/1.0"}});
    if(!response.ok)return [];
    const data=(await response.json()) as ArchiveResponse;
    return (data.response?.docs??[]).flatMap(doc=>{
      if(!doc.identifier)return [];
      const title=doc.title||doc.identifier;
      const snippet=[join(doc.creator),join(doc.description),doc.date,doc.mediatype].filter(Boolean).join(" — ").slice(0,1200);
      const parsed=doc.date?new Date(doc.date):null;
      const publishedAt=parsed&&!Number.isNaN(parsed.getTime())?parsed.toISOString():undefined;
      return [{provider:"Internet Archive",title,url:"https://archive.org/details/"+doc.identifier,snippet,observedAt:new Date().toISOString(),publishedAt}];
    });
  }
}

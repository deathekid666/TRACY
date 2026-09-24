import type { CollectedResult, PublicConnector } from "./types";

type OAInstitution={display_name?:string};
type OAAuthor={id?:string;display_name?:string;works_count?:number;cited_by_count?:number;last_known_institutions?:OAInstitution[]};
type OAResponse={results?:OAAuthor[]};

function norm(value:string){return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()}
function tokens(value:string){return norm(value).split(/\s+/).filter(Boolean)}
function sameName(a:string,b:string){const bt=tokens(b);const at=new Set(tokens(a));return bt.length>1&&bt.every(t=>at.has(t))}

export class OpenAlexConnector implements PublicConnector{
  id="openalex";
  label="OpenAlex";

  async search(query:string):Promise<CollectedResult[]>{
    const url=new URL("https://api.openalex.org/authors");
    url.searchParams.set("search",query);
    url.searchParams.set("per-page","15");
    const response=await fetch(url,{cache:"no-store",headers:{"User-Agent":"TRACY-PublicResearch/1.0"}});
    if(!response.ok)return [];
    const data=(await response.json()) as OAResponse;
    return (data.results??[]).flatMap(author=>{
      const name=author.display_name||"";
      if(!sameName(name,query)||!author.id)return [];
      const institutions=(author.last_known_institutions??[]).map(i=>i.display_name).filter(Boolean).join(", ");
      const snippet=[name,institutions,author.works_count!=null?String(author.works_count)+" works":"",author.cited_by_count!=null?String(author.cited_by_count)+" citations":""].filter(Boolean).join(" — ");
      return [{provider:"OpenAlex",title:name+" — scholarly profile",url:author.id,snippet,observedAt:new Date().toISOString()}];
    });
  }
}

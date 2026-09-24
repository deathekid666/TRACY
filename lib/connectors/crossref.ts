import type { CollectedResult, PublicConnector } from "./types";

type CrossrefAuthor={given?:string;family?:string;ORCID?:string};
type CrossrefItem={DOI?:string;title?:string[];author?:CrossrefAuthor[];URL?:string;"container-title"?:string[];published?:{"date-parts"?:number[][]}};
type CrossrefResponse={message?:{items?:CrossrefItem[]}};

function norm(value:string){return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()}
function tokens(value:string){return norm(value).split(/\s+/).filter(Boolean)}
function sameName(a:string,b:string){const bt=tokens(b);const at=new Set(tokens(a));return bt.length>1&&bt.every(t=>at.has(t))}

export class CrossrefConnector implements PublicConnector{
  id="crossref";
  label="Crossref";

  async search(query:string):Promise<CollectedResult[]>{
    const url=new URL("https://api.crossref.org/works");
    url.searchParams.set("query.author",query);
    url.searchParams.set("rows","20");
    url.searchParams.set("select","DOI,title,author,URL,container-title,published");
    const response=await fetch(url,{cache:"no-store",headers:{"User-Agent":"TRACY-PublicResearch/1.0"}});
    if(!response.ok)return [];
    const data=(await response.json()) as CrossrefResponse;
    return (data.message?.items??[]).flatMap(item=>{
      const authors=(item.author??[]).map(a=>[a.given,a.family].filter(Boolean).join(" "));
      const matched=authors.find(a=>sameName(a,query));
      if(!matched)return [];
      const title=item.title?.[0]||item.DOI||"Crossref work";
      const year=item.published?.["date-parts"]?.[0]?.[0];
      const container=item["container-title"]?.[0];
      const snippet=[matched,container,year?String(year):"",item.DOI].filter(Boolean).join(" — ");
      const target=item.URL||(item.DOI?"https://doi.org/"+item.DOI:"");
      if(!target)return [];
      return [{provider:"Crossref",title,url:target,snippet,observedAt:new Date().toISOString()}];
    });
  }
}

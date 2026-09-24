import type { CollectedResult, PublicConnector } from "./types";

function clean(value:string){return value.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();}
function tag(block:string,name:string){const match=block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,"i"));return match?clean(match[1]):"";}

export class WikipediaConnector implements PublicConnector {
  id="wikipedia"; label="Wikipedia";
  async search(query:string):Promise<CollectedResult[]>{
    const endpoint=`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&format=json&origin=*`;
    try{
      const response=await fetch(endpoint,{headers:{"User-Agent":"TRACY/0.1 public-source-research"}});
      if(!response.ok)return [];
      const data=await response.json() as {query?:{search?:Array<{title:string;snippet:string;pageid:number}>}};
      return (data.query?.search??[]).slice(0,8).map(item=>({provider:"Wikipedia",title:item.title,url:`https://en.wikipedia.org/?curid=${item.pageid}`,snippet:clean(item.snippet)}));
    }catch{return []}
  }
}

export class GoogleNewsConnector implements PublicConnector {
  id="google-news-rss"; label="Google News";
  async search(query:string):Promise<CollectedResult[]>{
    const endpoint=`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`;
    try{
      const response=await fetch(endpoint,{headers:{"User-Agent":"Mozilla/5.0 TRACY public-source-research"}});
      if(!response.ok)return [];
      const xml=await response.text();
      return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,12).map(match=>{const block=match[1];const published=tag(block,"pubDate");return {provider:"Google News",title:tag(block,"title"),url:tag(block,"link"),snippet:tag(block,"description"),observedAt:published?new Date(published).toISOString():undefined};}).filter(x=>x.url&&x.title);
    }catch{return []}
  }
}

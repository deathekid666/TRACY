import type { CollectedResult, PublicConnector } from "./types";

function clean(value:string){return value.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();}
function tag(block:string,name:string){const match=block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,"i"));return match?clean(match[1]):"";}
function decodeDuckUrl(value:string){try{const u=new URL(value.startsWith("//")?"https:"+value:value);const target=u.searchParams.get("uddg");return target?decodeURIComponent(target):value}catch{return value}}

export class DuckDuckGoHtmlConnector implements PublicConnector {
  id="duckduckgo-html"; label="DuckDuckGo Web";
  async search(query:string):Promise<CollectedResult[]>{
    try{
      const response=await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,{headers:{"User-Agent":"Mozilla/5.0 (compatible; TRACY/0.1; public research)","Accept-Language":"en-US,en;q=0.9"},cache:"no-store"});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const html=await response.text(); const out:CollectedResult[]=[];
      const blocks=html.split('class="result results_links').slice(1,16);
      for(const block of blocks){
        const link=block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if(!link)continue;
        const snippet=block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>|class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);
        const url=decodeDuckUrl(clean(link[1]).replace(/&amp;/g,"&"));
        if(url.startsWith("http"))out.push({provider:"DuckDuckGo",title:clean(link[2]),url,snippet:clean(snippet?.[1]||snippet?.[2]||"")});
      }
      return out;
    }catch(error){console.error("[TRACY connector] DuckDuckGo failed",error);return []}
  }
}

export class WikipediaConnector implements PublicConnector {
  id="wikipedia"; label="Wikipedia";
  async search(query:string):Promise<CollectedResult[]>{
    try{const response=await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&format=json&origin=*`,{headers:{"User-Agent":"TRACY/0.1 public-source-research"},cache:"no-store"});if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json() as {query?:{search?:Array<{title:string;snippet:string;pageid:number}>}};return (data.query?.search??[]).slice(0,8).map(item=>({provider:"Wikipedia",title:item.title,url:`https://en.wikipedia.org/?curid=${item.pageid}`,snippet:clean(item.snippet)}));}catch(error){console.error("[TRACY connector] Wikipedia failed",error);return []}
  }
}

export class GoogleNewsConnector implements PublicConnector {
  id="google-news-rss"; label="Google News";
  async search(query:string):Promise<CollectedResult[]>{
    try{const response=await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`,{headers:{"User-Agent":"Mozilla/5.0 TRACY public-source-research"},cache:"no-store"});if(!response.ok)throw new Error(`HTTP ${response.status}`);const xml=await response.text();return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,12).map(match=>{const block=match[1];const published=tag(block,"pubDate");return {provider:"Google News",title:tag(block,"title"),url:tag(block,"link"),snippet:tag(block,"description"),observedAt:published?new Date(published).toISOString():undefined};}).filter(x=>x.url&&x.title);}catch(error){console.error("[TRACY connector] Google News failed",error);return []}
  }
}

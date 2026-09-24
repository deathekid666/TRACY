import type { CollectedResult, PublicConnector } from "./types";

type SerperResponse={organic?:Array<{title?:string;link?:string;snippet?:string;date?:string;position?:number;publicationInfo?:string;year?:number}>};

function simpleQuery(value:string){
  return value.replace(/["']/g,"").replace(/[()]/g," ").replace(/\s+/g," ").trim();
}

function fallbackQuery(value:string){
  return simpleQuery(value)
    .replace(/\bsite:([^\s]+)/gi,"$1")
    .replace(/\bfiletype:([^\s]+)/gi,"$1")
    .replace(/\s+/g," ")
    .trim();
}

function sleep(ms:number){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

export class SerperWebConnector implements PublicConnector{
  id="serper-google";
  label="Google via Serper";

  async search(query:string):Promise<CollectedResult[]>{
    return this.searchPage(query,1);
  }

  async searchPage(query:string,page=1):Promise<CollectedResult[]>{
    return this.searchEndpoint("/search",query,page,30,"Google / Serper");
  }

  async searchScholar(query:string,page=1):Promise<CollectedResult[]>{
    return this.searchEndpoint("/scholar",query,page,20,"Google Scholar / Serper");
  }

  private async searchEndpoint(endpoint:string,query:string,page:number,num:number,provider:string):Promise<CollectedResult[]>{
    const apiKey=process.env.SERPER_API_KEY;
    if(!apiKey)throw new Error("SERPER_API_KEY_NOT_CONFIGURED");

    const attempts=[query,simpleQuery(query),fallbackQuery(query)].filter((v,i,a)=>v&&a.indexOf(v)===i);
    let lastStatus=0,lastDetail="";

    for(const q of attempts){
      for(let retry=0;retry<4;retry++){
        const response=await fetch("https://google.serper.dev"+endpoint,{
          method:"POST",
          headers:{"X-API-KEY":apiKey,"Content-Type":"application/json"},
          body:JSON.stringify({q,gl:"ma",hl:"fr",num,page}),
          cache:"no-store",
        });

        if(response.ok){
          const data=(await response.json()) as SerperResponse;
          return (data.organic??[]).filter(item=>item.link&&item.title).map(item=>({
            provider:provider+" p"+page,
            title:item.title!,
            url:item.link!,
            snippet:[item.publicationInfo,item.snippet].filter(Boolean).join(" — "),
            observedAt:new Date().toISOString()
          }));
        }

        lastStatus=response.status;
        lastDetail=(await response.text()).slice(0,200);

        if(response.status===429){
          const retryAfter=response.headers.get("retry-after");
          const waitFromHeader=retryAfter?Number(retryAfter)*1000:0;
          const backoff=Math.max(waitFromHeader,1100*(retry+1));
          await sleep(Math.min(backoff,5000));
          continue;
        }

        break;
      }

      if(lastStatus!==400||!lastDetail.includes("Query pattern not allowed"))break;
    }

    throw new Error(`SERPER_HTTP_${lastStatus}: ${lastDetail}`);
  }
}

import type { CollectedResult, PublicConnector } from "./types";

type SerperResponse={organic?:Array<{title?:string;link?:string;snippet?:string;date?:string;position?:number}>};

function simpleQuery(value:string){
  return value.replace(/["']/g,"").replace(/[()]/g," ").replace(/\s+/g," ").trim();
}

export class SerperWebConnector implements PublicConnector{
  id="serper-google";
  label="Google via Serper";

  async search(query:string):Promise<CollectedResult[]>{
    const apiKey=process.env.SERPER_API_KEY;
    if(!apiKey)throw new Error("SERPER_API_KEY_NOT_CONFIGURED");

    const attempts=[query,simpleQuery(query)].filter((v,i,a)=>v&&a.indexOf(v)===i);
    let lastStatus=0,lastDetail="";

    for(const q of attempts){
      const response=await fetch("https://google.serper.dev/search",{
        method:"POST",
        headers:{"X-API-KEY":apiKey,"Content-Type":"application/json"},
        body:JSON.stringify({q,gl:"ma",num:10}),
        cache:"no-store",
      });
      if(response.ok){
        const data=(await response.json()) as SerperResponse;
        return (data.organic??[]).filter(item=>item.link&&item.title).map(item=>({
          provider:"Google / Serper",title:item.title!,url:item.link!,snippet:item.snippet,observedAt:new Date().toISOString()
        }));
      }
      lastStatus=response.status;
      lastDetail=(await response.text()).slice(0,200);
      if(response.status!==400||!lastDetail.includes("Query pattern not allowed"))break;
    }
    throw new Error(`SERPER_HTTP_${lastStatus}: ${lastDetail}`);
  }
}

import { createHash } from "crypto";

const MAX_HTML_BYTES=1_000_000;
const MAX_PDF_BYTES=8_000_000;
const TIMEOUT_MS=12_000;

function isPublicHttpUrl(value:string){
  try{
    const u=new URL(value);
    if(!["http:","https:"].includes(u.protocol))return false;
    const h=u.hostname.toLowerCase();
    if(h==="localhost"||h.endsWith(".local")||h==="0.0.0.0"||h==="127.0.0.1"||h==="::1")return false;
    if(/^10\./.test(h)||/^192\.168\./.test(h)||/^169\.254\./.test(h))return false;
    const m=h.match(/^172\.(\d+)\./);if(m&&Number(m[1])>=16&&Number(m[1])<=31)return false;
    return true;
  }catch{return false}
}

function decodeHtml(value:string){
  return value.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));
}

function textFromHtml(html:string){
  return decodeHtml(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi," ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/\s+/g," ")
    .trim()).slice(0,180_000);
}

async function readLimited(response:Response,maxBytes:number){
  const reader=response.body?.getReader();if(!reader)return null;
  let received=0;const chunks:Uint8Array[]=[];
  while(received<maxBytes){
    const {done,value}=await reader.read();if(done)break;
    if(value){
      const keep=value.slice(0,Math.max(0,maxBytes-received));
      chunks.push(keep);received+=keep.length;
    }
  }
  await reader.cancel().catch(()=>{});
  return Buffer.concat(chunks.map(c=>Buffer.from(c)));
}

export type PageSnapshot={url:string;finalUrl:string;status:number;contentType:string;text:string;sha256:string;collectedAt:string};

export async function fetchPublicPage(url:string):Promise<PageSnapshot|null>{
  if(!isPublicHttpUrl(url))return null;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const response=await fetch(url,{redirect:"follow",signal:controller.signal,cache:"no-store",headers:{"User-Agent":"TRACY-PublicResearch/1.0"}});
    const finalUrl=response.url||url;
    if(!isPublicHttpUrl(finalUrl)||!response.ok)return null;

    const contentType=response.headers.get("content-type")||"";
    const looksPdf=/application\/pdf/i.test(contentType)||/\.pdf(?:$|[?#])/i.test(finalUrl);
    const allowedText=/(text\/html|text\/plain|application\/xhtml\+xml)/i.test(contentType);
    if(!looksPdf&&!allowedText)return null;

    const bytes=await readLimited(response,looksPdf?MAX_PDF_BYTES:MAX_HTML_BYTES);
    if(!bytes||!bytes.length)return null;

    let text="";
    if(looksPdf){
      try{
        const pdfParse=(await import("pdf-parse")).default;
        const parsed=await pdfParse(bytes);
        text=(parsed.text||"").replace(/\s+/g," ").trim().slice(0,220_000);
      }catch{return null}
    }else{
      text=textFromHtml(bytes.toString("utf8"));
    }
    if(!text)return null;

    return {url,finalUrl,status:response.status,contentType:looksPdf?"application/pdf":contentType,text,sha256:createHash("sha256").update(bytes).digest("hex"),collectedAt:new Date().toISOString()};
  }catch{return null}finally{clearTimeout(timer)}
}

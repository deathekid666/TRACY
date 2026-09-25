export const RESERVED_HANDLE_WORDS=new Set([
  "public","profile","profiles","people","user","users","help","support","groups","pages",
  "reel","reels","explore","community","communities","business","search","topics","settings",
  "about","privacy","legal","login","signin","signup","register","marketplace","watch","events"
]);

export function isReservedHandle(value:string){
  const v=value.toLowerCase().replace(/^@/,"").trim();
  return !v||RESERVED_HANDLE_WORDS.has(v);
}

export function isReservedPivotArtifact(metadata:unknown){
  const m=(metadata??{}) as Record<string,unknown>;
  const query=typeof m.discoveryQuery==="string"?m.discoveryQuery:"";
  if(!query.startsWith("PLATFORM "))return false;
  for(const handle of RESERVED_HANDLE_WORDS){
    if(query.includes('"'+handle+'"'))return true;
  }
  return false;
}

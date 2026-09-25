export type PlatformDiscoveryQuery={
  seed:string;
  platform:string;
  query:string;
};

function clean(value:string){
  return value.trim().replace(/^@/,"");
}

export function buildNamePlatformQueries(name:string):PlatformDiscoveryQuery[]{
  const n=name.trim();
  return [
    {seed:n,platform:"Web-wide identity",query:'"'+n+'"'},
    {seed:n,platform:"Web-wide old references",query:'"'+n+'" profile member forum archive'},
    {seed:n,platform:"Instagram",query:'site:instagram.com "'+n+'"'},
    {seed:n,platform:"Facebook",query:'site:facebook.com "'+n+'"'},
    {seed:n,platform:"Facebook old/public",query:'site:facebook.com/public "'+n+'"'},
    {seed:n,platform:"Snapchat",query:'site:snapchat.com "'+n+'"'},
    {seed:n,platform:"Discord mentions",query:'"'+n+'" Discord'},
    {seed:n,platform:"WeChat mentions",query:'"'+n+'" WeChat OR 微信'},
    {seed:n,platform:"Forums",query:'"'+n+'" forum member profile'},
    {seed:n,platform:"TikTok",query:'site:tiktok.com "'+n+'"'},
    {seed:n,platform:"X",query:'site:x.com "'+n+'"'},
    {seed:n,platform:"Reddit",query:'site:reddit.com "'+n+'"'}
  ];
}

export function buildUsernamePlatformQueries(username:string):PlatformDiscoveryQuery[]{
  const u=clean(username);
  if(!u)return [];

  return [
    {seed:u,platform:"Web-wide handle",query:'"'+u+'"'},
    {seed:u,platform:"Handle platform bundle",query:'"'+u+'" Hypixel OR Tumblr OR OP.GG'},
    {seed:u,platform:"Hypixel",query:'site:hypixel.net/members "'+u+'"'},
    {seed:u,platform:"Gaming profiles",query:'"'+u+'" OP.GG OR Steam OR NameMC'},
    {seed:u,platform:"Tumblr",query:'"'+u+'" tumblr'},
    {seed:u,platform:"Forums",query:'"'+u+'" forum member profile'},
    {seed:u,platform:"Web-wide profile",query:'"'+u+'" profile account member'},
    {seed:u,platform:"Web-wide archive",query:'"'+u+'" archive old cached'},
    {seed:u,platform:"Web-wide documents",query:'"'+u+'" PDF document'},
    {seed:u,platform:"Web-wide email",query:'"'+u+'" email contact'},
    {seed:u,platform:"Web-wide phone",query:'"'+u+'" phone telephone contact'},
    {seed:u,platform:"Instagram",query:'site:instagram.com "'+u+'"'},
    {seed:u,platform:"Facebook",query:'site:facebook.com "'+u+'"'},
    {seed:u,platform:"Snapchat",query:'site:snapchat.com "'+u+'"'},
    {seed:u,platform:"Discord mentions",query:'"'+u+'" Discord'},
    {seed:u,platform:"WeChat mentions",query:'"'+u+'" WeChat OR 微信'},
    {seed:u,platform:"Reddit",query:'site:reddit.com "'+u+'"'},
    {seed:u,platform:"GitHub",query:'site:github.com "'+u+'"'},
    {seed:u,platform:"TikTok",query:'site:tiktok.com "'+u+'"'},
    {seed:u,platform:"X",query:'site:x.com "'+u+'"'},
    {seed:u,platform:"Threads",query:'site:threads.net "'+u+'"'},
    {seed:u,platform:"Pinterest",query:'site:pinterest.com "'+u+'"'},
    {seed:u,platform:"Twitch",query:'site:twitch.tv "'+u+'"'},
    {seed:u,platform:"YouTube",query:'site:youtube.com "'+u+'"'}
  ];
}

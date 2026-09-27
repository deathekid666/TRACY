import { afterEach, expect, it, vi } from "vitest";
import { fetchPublicPage, unavailablePublicPage } from "@/lib/public-page";

const profile="https://example.org/jamie";
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()});

it.each([
  "Title: Sign Up | LinkedIn URL Source: https://example.org/jamie Markdown Content: Join LinkedIn",
  "Sign In | LinkedIn Agree and Join",
  "Title: Just a moment… Verify you are human",
])("rejects authentication/challenge captures: %s",text=>{
  expect(unavailablePublicPage(text,profile)).toBe(true);
});

it("does not reject a public profile merely for including navigation sign-in links",()=>{
  expect(unavailablePublicPage("Jamie Example | LinkedIn Agree & Join LinkedIn Public biography",profile)).toBe(false);
});

function unavailableFetch(providerText="Jamie Example Contact: jamie@example.org"){
  return vi.fn().mockImplementation(async (url:string)=>{
    if(url==="https://scrape.serper.dev")return new Response(JSON.stringify({text:providerText,metadata:{title:"Jamie Example",url:profile}}),{status:200});
    if(url.startsWith("https://r.jina.ai/"))return new Response("Title: Sign Up | LinkedIn URL Source: "+profile+" Markdown Content: Join LinkedIn");
    return new Response("Sign in",{status:403});
  });
}

it("uses the existing provider only when explicitly enabled and stores literal returned text",async()=>{
  vi.stubEnv("SERPER_API_KEY","unit-test-key");
  const mock=unavailableFetch();
  vi.stubGlobal("fetch",mock);
  const page=await fetchPublicPage(profile,{providerFallback:true});
  expect(page).toMatchObject({url:profile,finalUrl:profile,fetchMode:"serper-page",text:"Jamie Example Contact: jamie@example.org"});
  expect(page?.sha256).toMatch(/^[a-f0-9]{64}$/);
  const call=mock.mock.calls.find(([url])=>url==="https://scrape.serper.dev")!;
  expect(JSON.parse(call[1].body)).toEqual({url:profile});
});

it("does not count sign-up pages as evidence when provider fallback is disabled",async()=>{
  vi.stubEnv("SERPER_API_KEY","unit-test-key");
  const mock=unavailableFetch();
  vi.stubGlobal("fetch",mock);
  expect(await fetchPublicPage(profile)).toBeNull();
  expect(mock.mock.calls.some(([url])=>url==="https://scrape.serper.dev")).toBe(false);
});

it("still rejects a challenge page returned by the fallback provider",async()=>{
  vi.stubEnv("SERPER_API_KEY","unit-test-key");
  vi.stubGlobal("fetch",unavailableFetch("Just a moment. Verify you are human."));
  expect(await fetchPublicPage(profile,{providerFallback:true})).toBeNull();
});

it("does not use the paid fallback when direct public text is available",async()=>{
  vi.stubEnv("SERPER_API_KEY","unit-test-key");
  const mock=vi.fn().mockResolvedValue(new Response("<html><title>Jamie Example</title><body>Public profile jamie@example.org</body></html>",{headers:{"content-type":"text/html"}}));
  vi.stubGlobal("fetch",mock);
  expect(await fetchPublicPage(profile,{providerFallback:true})).toMatchObject({fetchMode:"direct"});
  expect(mock).toHaveBeenCalledTimes(1);
});

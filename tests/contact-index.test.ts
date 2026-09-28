import { afterEach, expect, it, vi } from "vitest";
import { SerperWebConnector } from "@/lib/connectors/serper";

afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});

it("preserves the public index's literal snippet and provider attribution",async()=>{
  vi.stubEnv("SERPER_API_KEY","unit-test-key");
  const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({
    organic:[{title:"Jamie Example",link:"https://example.org/jamie",snippet:"Jamie Example contact: jamie@example.org"}],
  }),{status:200}));
  vi.stubGlobal("fetch",fetchMock);
  const result=await new SerperWebConnector().searchBingPage('"Jamie Example" email');
  expect(fetchMock.mock.calls[0][0]).toBe("https://bing.serper.dev/search");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({q:'"Jamie Example" email',num:20,page:1});
  expect(result[0]).toMatchObject({provider:"Bing / Serper p1",url:"https://example.org/jamie",snippet:"Jamie Example contact: jamie@example.org"});
});

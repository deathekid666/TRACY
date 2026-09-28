import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({
  search:vi.fn(),fullSearch:vi.fn(),enrich:vi.fn(),page:vi.fn(),contact:vi.fn(),
  curate:vi.fn(),extract:vi.fn(),
  db:{source:{findFirst:vi.fn(),create:vi.fn()},evidence:{create:vi.fn()},event:{create:vi.fn()}}
}));
vi.mock("@/lib/db",()=>({db:mocks.db}));
vi.mock("@/lib/connectors/serper",()=>({SerperWebConnector:class{
  id="serper-google";searchQuickPage=mocks.search;searchPage=mocks.fullSearch;
}}));
vi.mock("@/lib/source-enrichment",()=>({enrichPublicSources:mocks.enrich}));
vi.mock("@/lib/public-page",()=>({fetchPublicPage:mocks.page}));
vi.mock("@/lib/contact-discovery",()=>({buildContactEnrichmentPlan:mocks.contact}));
vi.mock("@/lib/source-curation",()=>({curateSources:mocks.curate}));
vi.mock("@/lib/evidence-extraction",()=>({extractEvidenceEntities:mocks.extract}));
import { collectPublicSources } from "@/lib/collection";

beforeEach(()=>{
  vi.resetAllMocks();
  mocks.search.mockResolvedValue([]);
  mocks.db.source.findFirst.mockResolvedValue(null);
  mocks.db.source.create.mockResolvedValue({id:"source-1"});
  mocks.curate.mockResolvedValue({kept:1,review:0,rejected:0});
  mocks.extract.mockResolvedValue({entitiesCreated:1,linksCreated:1});
});

it("returns identity-backed snippets without document or enrichment waits",async()=>{
  mocks.search.mockResolvedValueOnce([
    {title:"Jamie Example",snippet:"Jamie Example software engineer",url:"https://example.org/jamie",provider:"Google / Serper p1"},
    {title:"Jamie Somebody Else",snippet:"Unrelated person",url:"https://example.org/other",provider:"Google / Serper p1"}
  ]);
  const result=await collectPublicSources("case","Jamie Example","quick");
  expect(mocks.search).toHaveBeenCalledTimes(4);
  expect(result.added).toBe(1);
  expect(result.results.map(r=>r.url)).toEqual(["https://example.org/jamie"]);
  expect(mocks.db.evidence.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({content:"Jamie Example software engineer",sourceId:"source-1"})}));
  expect(mocks.fullSearch).not.toHaveBeenCalled();
  expect(mocks.enrich).not.toHaveBeenCalled();
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.contact).not.toHaveBeenCalled();
  expect(mocks.curate).toHaveBeenCalledWith("case",false);
  expect(mocks.extract).toHaveBeenCalledWith("case");
});

it("starts the four searches together and preserves successful results when one times out",async()=>{
  const resolvers:Array<(value:unknown[])=>void>=[];
  mocks.search.mockImplementation(()=>new Promise(resolve=>resolvers.push(resolve)));
  mocks.search.mockRejectedValueOnce(new Error("Timeout"));
  const pending=collectPublicSources("case","Jamie Example","quick");
  expect(mocks.search).toHaveBeenCalledTimes(4);
  for(const resolve of resolvers)resolve([]);
  expect((await pending).providerStatus).toBe("degraded");
});

it("reports total provider failure rather than a successful empty scan",async()=>{
  mocks.search.mockRejectedValue(new Error("Unavailable"));
  expect((await collectPublicSources("case","Jamie Example","quick")).providerStatus).toBe("unavailable");
});

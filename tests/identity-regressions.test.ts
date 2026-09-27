import { beforeEach, describe, expect, it, vi } from "vitest";
import { directProfileSurface, usernameFromProfileUrl, validPublicHandle } from "@/lib/public-handles";

const db = vi.hoisted(() => ({
  case: { findUnique: vi.fn() },
  source: { findMany: vi.fn(), update: vi.fn() },
  entity: { findMany: vi.fn(), deleteMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  evidence: { findMany: vi.fn() },
  evidenceEntity: { findUnique: vi.fn(), create: vi.fn() },
  event: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));
import { extractEvidenceEntities } from "@/lib/evidence-extraction";
import { curateSources } from "@/lib/source-curation";
import { buildContactEnrichmentPlan } from "@/lib/contact-discovery";
import { getPublicPivots } from "@/lib/public-pivots";

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  db.entity.findMany.mockResolvedValue([]);
  db.entity.create.mockImplementation(async ({data}) => ({id: "entity-" + data.canonical, ...data}));
  db.evidenceEntity.findUnique.mockResolvedValue(null);
});

describe("public account boundaries", () => {
  it.each([
    "https://www.tiktok.com/tag/calledbythegrave",
    "https://www.deviantart.com/tag/calledbythegrave",
    "https://www.facebook.com/public/Nizar-Laassali/",
    "https://www.instagram.com/explore/tags/nizar/",
    "https://x.com/search?q=nizar",
    "https://www.youtube.com/results?search_query=nizar",
  ])("never treats a directory or topic as a profile: %s", url => {
    expect(directProfileSurface(url)).toBe(false);
    expect(usernameFromProfileUrl(url)).toBe("");
  });
  it.each([
    ["https://www.tiktok.com/@exampleperson", "exampleperson"],
    ["https://www.instagram.com/example.person/", "example.person"],
    ["https://exampleperson.tumblr.com/", "exampleperson"],
    ["https://www.reddit.com/user/exampleperson", "exampleperson"],
  ])("preserves individual profile handles: %s", (url, handle) => {
    expect(directProfileSurface(url)).toBe(true);
    expect(usernameFromProfileUrl(url)).toBe(handle);
  });
  it("rejects domains and reserved roots as pivots", async () => {
    expect(validPublicHandle("hihonor.com")).toBe(false);
    expect(validPublicHandle("tag")).toBe(false);
    db.entity.findMany.mockResolvedValue([
      {type:"USERNAME",canonical:"hihonor.com"},
      {type:"USERNAME",canonical:"example.person"},
    ]);
    const pivots = await getPublicPivots("case", "Jamie Example");
    expect(pivots.join(" ")).not.toContain("hihonor");
    expect(pivots).toContain('"example.person"');
  });
  it("does not discard numeric Facebook profiles or YouTube channels", () => {
    expect(directProfileSurface("https://www.facebook.com/1000123456789")).toBe(true);
    expect(directProfileSurface("https://www.youtube.com/channel/UCexample")).toBe(true);
  });
});

function evidence(content: string, options: {kind?:string;url?:string;decision?:string} = {}) {
  return { id:"ev-1", title:"Jamie Example contact", content,
    metadata:{kind:options.kind||"PUBLIC_SEARCH_RESULT",query:"Jamie Example"},
    source:{title:"Jamie Example contact",url:options.url||"https://example.org/jamie",
      metadata:{classification:"STRONG",curatedDecision:options.decision||"KEEP"}} };
}

describe("literal evidence extraction", () => {
  it("does not turn full or masked email domains into usernames or invent an email", async () => {
    db.evidence.findMany.mockResolvedValue([evidence("Jamie Example: n***@hihonor.com and ab***xy@example.org. Public @example.person")]);
    await extractEvidenceEntities("case");
    const created=db.entity.create.mock.calls.map(([arg])=>arg.data);
    expect(created.map(e=>[e.type,e.canonical])).toEqual([["USERNAME","example.person"]]);
  });
  it("extracts a literal contextual email and links its actual evidence", async () => {
    db.evidence.findMany.mockResolvedValue([evidence("Jamie Example: jamie@example.org")]);
    await extractEvidenceEntities("case");
    expect(db.entity.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({type:"EMAIL",canonical:"jamie@example.org"})}));
    expect(db.evidenceEntity.create).toHaveBeenCalledWith({data:{evidenceId:"ev-1",entityId:"entity-jamie@example.org"}});
    expect(db.entity.create.mock.calls).toHaveLength(1);
  });
  it("does not borrow a generated capture title to attribute someone else's email", async () => {
    db.evidence.findMany.mockResolvedValue([evidence("Other Person: other@example.org", {kind:"PUBLIC_PAGE_CAPTURE"})]);
    await extractEvidenceEntities("case");
    expect(db.entity.create).not.toHaveBeenCalled();
  });
  it.each([
    {decision:"REJECT"},
    {url:"https://www.tiktok.com/tag/exampleperson"},
  ])("does not extract contacts or handles from rejected surfaces: %j", async options => {
    db.evidence.findMany.mockResolvedValue([evidence("Jamie Example: jamie@example.org @exampleperson", options)]);
    await extractEvidenceEntities("case");
    expect(db.entity.create).not.toHaveBeenCalled();
  });
});

function source(id:string,url:string,title:string,content:string,score=65,category="PUBLIC_ACCOUNT") {
  return {id,url,title,metadata:{identityScore:score,classification:"POSSIBLE",category},
    evidence:[{content,sha256:null}]};
}

it("keeps shared-handle candidates in REVIEW even if AI tries to promote them", async () => {
  db.case.findUnique.mockResolvedValue({
    title:"Nizar Laassali",
    entities:[{type:"PERSON",label:"Nizar Laassali"},{type:"USERNAME",canonical:"calledbythegrave"}],
    sources:[
      source("tag","https://www.tiktok.com/tag/calledbythegrave","Nizar Laassali topic","Nizar Laassali"),
      source("art","https://www.deviantart.com/tag/calledbythegrave","calledbythegrave art","",65,"GENERAL"),
      source("handle","https://www.tumlook.com/calledbythegrave","23 she/her @calledbythegrave - Tumblr Blog","Just a moment"),
      source("identity","https://ma.linkedin.com/in/nizar-laassali-b325221a9","Nizar Laassali","Nizar Laassali public profile",90,"PROFESSIONAL"),
      source("unrelated","https://example.org/qabbani","Nizar Qabbani","Nizar Qabbani",0,"GENERAL"),
    ],
  });
  vi.stubEnv("OPENAI_API_KEY","unit-test-only");
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({
    output:[{type:"message",content:[{type:"output_text",text:JSON.stringify({
      decisions:[{sourceId:"handle",decision:"KEEP",category:"PUBLIC_ACCOUNT",summary:"Shared handle",confidence:99}],
      facts:[],
    })}]}],
  })}));
  await curateSources("case",true);
  const updates=new Map(db.source.update.mock.calls.map(([arg])=>[arg.where.id,arg.data.metadata]));
  expect(updates.get("tag").curatedDecision).toBe("REJECT");
  expect(updates.get("art").curatedDecision).toBe("REJECT");
  expect(updates.get("handle").curatedDecision).toBe("REVIEW");
  expect(updates.get("handle").curatedConfidence).toBeLessThanOrEqual(65);
  expect(updates.get("identity").curatedDecision).toBe("KEEP");
  expect(updates.get("unrelated").curatedDecision).toBe("REJECT");
});

it.each([6,12])("reserves broad contact queries within a %i-query budget", async limit => {
  db.entity.findMany.mockResolvedValue(["exampleone","exampletwo","examplethree","hihonor.com"].map(canonical=>({canonical})));
  db.source.findMany.mockResolvedValue([
    source("li","https://ma.linkedin.com/in/example","Jamie Example","",90,"PROFESSIONAL"),
    source("zi","https://www.zoominfo.com/p/example","Jamie Example","",90,"PROFESSIONAL"),
  ]);
  const plan=await buildContactEnrichmentPlan("case","Jamie Example",limit);
  expect(plan.queries).toHaveLength(limit);
  expect(plan.queries).toContain('"Jamie Example" email contact');
  expect(plan.queries).toContain('"Jamie Example" gmail');
  expect(plan.queries.some(q=>q.startsWith("site:"))).toBe(true);
  expect(plan.queries.some(q=>q.includes('"exampleone"'))).toBe(true);
  expect(plan.usernames).not.toContain("hihonor.com");
  expect(plan.sourceIds).toEqual(["li","zi"]);
  if(limit===12)expect(plan.queries).toContain('"Jamie Example" "examplethree" email');
});

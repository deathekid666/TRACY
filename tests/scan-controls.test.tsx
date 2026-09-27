// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const refresh=vi.hoisted(()=>vi.fn());
vi.mock("next/navigation",()=>({useRouter:()=>({refresh})}));
import { CollectSources } from "@/components/CollectSources";
import { createScanController } from "@/lib/scan-controller";

function deferred() {
  let resolve!: (value: Response) => void;
  const promise=new Promise<Response>(r=>{resolve=r});
  return {promise,resolve};
}
const success=()=>new Response(JSON.stringify({count:2,curation:{kept:2,review:1,rejected:3}}),{status:200});
afterEach(()=>{cleanup();vi.unstubAllGlobals();sessionStorage.clear()});

it("keeps auto deep visible after quick refresh disables auto, blocks manual overlap, and refreshes completion",async()=>{
  const quick=deferred(),deep=deferred();
  const fetchMock=vi.fn().mockReturnValueOnce(quick.promise).mockReturnValueOnce(deep.promise);
  vi.stubGlobal("fetch",fetchMock);
  const view=(enabled:boolean)=><StrictMode><CollectSources caseId="lifecycle" defaultQuery="Jamie Example" autoEnabled={enabled} version="test"/></StrictMode>;
  const {rerender}=render(view(true));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect((screen.getByRole("button",{name:"Deep scan"}) as HTMLButtonElement).disabled).toBe(true);
  await act(async()=>quick.resolve(success()));
  await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2));
  rerender(view(false));
  expect(screen.getByRole("status").textContent).toContain("Deep scan is continuing");
  const deepButton=screen.getByRole("button",{name:"Deep scanning…"}) as HTMLButtonElement;
  expect(deepButton.disabled).toBe(true);
  fireEvent.click(deepButton);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await act(async()=>deep.resolve(success()));
  await waitFor(()=>expect(screen.getByRole("status").textContent).toContain("Deep scan: saved 2"));
  expect((screen.getByRole("button",{name:"Deep scan"}) as HTMLButtonElement).disabled).toBe(false);
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(sessionStorage.getItem("tracy:auto-scan:lifecycle:test")).toBe("done");
});

it("retains running scan state when the controls remount",async()=>{
  const pending=deferred();vi.stubGlobal("fetch",vi.fn().mockReturnValue(pending.promise));
  const first=render(<CollectSources caseId="remount" defaultQuery="Jamie Example"/>);
  fireEvent.click(screen.getByRole("button",{name:"Deep scan"}));
  first.unmount();
  render(<CollectSources caseId="remount" defaultQuery="Jamie Example"/>);
  expect((screen.getByRole("button",{name:"Deep scanning…"}) as HTMLButtonElement).disabled).toBe(true);
  await act(async()=>pending.resolve(success()));
  await waitFor(()=>expect(screen.getByRole("status").textContent).toContain("Deep scan: saved 2"));
});

it("shows provider failure, stops the sequence, and permits an explicit retry",async()=>{
  const fetchMock=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
    error:"Search provider unavailable",providerStatus:"unavailable",
  }),{status:503})).mockResolvedValueOnce(success());
  vi.stubGlobal("fetch",fetchMock);
  const controller=createScanController("failure");
  await controller.run("Jamie Example","quick","test-key");
  expect(controller.getSnapshot()).toMatchObject({busy:null,error:true,message:"Search provider unavailable"});
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem("test-key")).toBe("provider-unavailable");
  await controller.run("Jamie Example","deep");
  expect(controller.getSnapshot()).toMatchObject({busy:null,error:false,revision:1});
});

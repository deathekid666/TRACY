type Mode = "quick" | "deep";
type Snapshot = {
  busy: Mode | null;
  message: string;
  error: boolean;
  revision: number;
};

// Keep a running request independent of React's refresh/effect lifecycle.
// Automatic and manual controls subscribe to the same case state.
const controllers = new Map<string, ReturnType<typeof createScanController>>();

function sessionValue(key: string, value?: string) {
  try {
    if (value !== undefined) sessionStorage.setItem(key, value);
    return sessionStorage.getItem(key);
  } catch { return null; }
}

export function createScanController(caseId: string) {
  let snapshot: Snapshot = { busy: null, message: "", error: false, revision: 0 };
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener());
  };

  async function run(query: string, mode: Mode, automaticKey?: string) {
    if (snapshot.busy || !query.trim()) return;
    const modes: Mode[] = automaticKey ? ["quick", "deep"] : [mode];
    publish({ busy: modes[0], error: false, message: modes[0] === "quick" ? "Running quick scan…" : "Running deep scan…" });
    try {
      for (const step of modes) {
        if (automaticKey) sessionValue(automaticKey, step);
        publish({
          busy: step,
          message: step === "quick" ? "Finding first results… identity and public profiles."
            : automaticKey ? "Quick results are ready. Deep scan is continuing automatically…"
            : "Running deep scan. You can keep this case open while it works…",
        });
        const response = await fetch(`/api/cases/${caseId}/collect`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, mode: step }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (automaticKey && response.status === 503 && body.providerStatus === "unavailable") {
            sessionValue(automaticKey, "provider-unavailable");
          }
          throw new Error(body.detail || body.error || "Collection failed");
        }
        const c = body.curation;
        const curated = c ? ` · ${c.kept} relevant · ${c.review} review · ${c.rejected} hidden noise` : "";
        const provider = body.providerStatus === "degraded" ? ` · provider degraded (${body.failedSearchCalls}/${body.totalSearchCalls} failed)` : "";
        publish({ revision: snapshot.revision + 1, message: `${step === "quick" ? "Quick" : "Deep"} scan: saved ${body.count}${curated}${provider}` });
      }
      if (automaticKey) sessionValue(automaticKey, "done");
    } catch (error) {
      publish({ error: true, message: error instanceof Error ? error.message : "Collection failed" });
    } finally {
      publish({ busy: null });
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    run,
    startAutomatic(query: string, enabled: boolean, version: string) {
      if (!enabled || snapshot.busy || snapshot.message) return;
      const key = "tracy:auto-scan:" + caseId + ":" + version;
      if (["done", "provider-unavailable"].includes(sessionValue(key) || "")) return;
      void run(query, "quick", key);
    },
  };
}

export function getScanController(caseId: string) {
  let controller = controllers.get(caseId);
  if (!controller) {
    controller = createScanController(caseId);
    controllers.set(caseId, controller);
  }
  return controller;
}

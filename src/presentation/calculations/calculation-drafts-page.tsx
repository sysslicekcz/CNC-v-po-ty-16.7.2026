"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createCalculationEngineDependencies } from "./calculation-engine-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { CalculationsNav } from "./components/calculations-nav";
import { describeCalculationError } from "./calculation-error-messages";

const SOURCE_LABELS: Record<string, string> = {
  new: "Nový",
  technology_operation: "Z technologické operace",
  production_order: "Z výrobního příkazu",
  quote_item: "Z položky nabídky",
  copy: "Kopie",
  import: "Import",
};

/**
 * `CalculationDraftsPage` (AP-MCE-001 Fáze H §4/§27) - "Rozpracované
 * výpočty". Konceptu se dá "znovu otevřít v průvodci" (návrat na krok, §4)
 * nebo "explicitně zahodit" (§4/§27 - koncept nemá auditní stopu, mazání je
 * proto nastálé).
 */
export function CalculationDraftsPage() {
  const router = useRouter();
  const deps = useMemo(() => createCalculationEngineDependencies(), []);
  const snapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [drafts, setDrafts] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    return ensureAppBootstrapped()
      .then(() => deps.listCalculationDraftsUseCase.execute())
      .then(setDrafts)
      .catch((err) => setError(describeCalculationError(err)));
  }, [deps]);

  useEffect(() => {
    load();
  }, [load]);

  async function discard(id: string) {
    try {
      await deps.deleteCalculationDraftUseCase.execute({ id });
      await load();
    } catch (err) {
      setError(describeCalculationError(err));
    }
  }

  return (
    <div>
      <CalculationsNav snapshot={snapshot} />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 border-b border-border pb-6">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Výpočty výroby
          </div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">Rozpracované výpočty</h1>
        </header>

        {error && <p className="mb-6 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        {!drafts && !error && <p className="text-sm text-muted">Načítám…</p>}

        {drafts && drafts.length === 0 && <p className="text-sm text-muted">Žádné rozpracované výpočty.</p>}

        {drafts && drafts.length > 0 && (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-raised text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Zdroj</th>
                  <th className="px-3 py-2 text-left">Kategorie</th>
                  <th className="px-3 py-2 text-left">Krok</th>
                  <th className="px-3 py-2 text-left">Naposledy upraveno</th>
                  <th className="px-3 py-2 text-right">Akce</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d) => (
                  <tr key={String(d.id)} className="border-t border-border">
                    <td className="px-3 py-2">{SOURCE_LABELS[String(d.sourceType)] ?? String(d.sourceType)}</td>
                    <td className="px-3 py-2">{d.operationCategory ? String(d.operationCategory) : "—"}</td>
                    <td className="px-3 py-2">{String(d.currentStep)}</td>
                    <td className="px-3 py-2 text-muted">{new Date(String(d.updatedAt)).toLocaleString("cs-CZ")}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => router.push(`/calculations/new?draftId=${encodeURIComponent(String(d.id))}`)}
                        className="mr-2 rounded border border-accent px-2 py-1 text-xs text-accent hover:bg-accent/10"
                      >
                        Otevřít
                      </button>
                      <button onClick={() => discard(String(d.id))} className="rounded border border-danger/50 px-2 py-1 text-xs text-danger hover:bg-danger/10">
                        Zahodit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

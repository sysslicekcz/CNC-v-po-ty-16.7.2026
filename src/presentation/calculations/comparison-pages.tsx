"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createCalculationEngineDependencies } from "./calculation-engine-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { CalculationsNav } from "./components/calculations-nav";
import { describeCalculationError } from "./calculation-error-messages";
import { ProfileMultiSelect, ProfileOption } from "./components/profile-selector";
import { CalculationSummary } from "@/application/calculation-engine/dto/calculation-summary";
import { MachineComparisonEntry, MachineComparisonSort, sortMachineComparison } from "@/application/calculation-engine/workflow/use-cases/get-machine-comparison-use-case";
import { ToolComparisonEntry } from "@/application/calculation-engine/workflow/use-cases/get-tool-comparison-use-case";

const COMPARABLE_CATEGORIES = new Set(["turning", "milling", "grinding"]);

const MACHINE_SORT_OPTIONS: { value: MachineComparisonSort; label: string }[] = [
  { value: "combined_score", label: "Kombinované skóre" },
  { value: "fastest", label: "Nejkratší čas" },
  { value: "highest_confidence", label: "Nejvyšší confidence" },
  { value: "fewest_warnings", label: "Nejméně warningů" },
];

function useComparisonBase(deps: ReturnType<typeof createCalculationEngineDependencies>) {
  const searchParams = useSearchParams();
  const [calculationId, setCalculationId] = useState(searchParams?.get("calculationId") ?? "");
  const [eligibleCalculations, setEligibleCalculations] = useState<CalculationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureAppBootstrapped()
      .then(() => deps.listCalculationResultsUseCase.execute())
      .then((summaries) => setEligibleCalculations(summaries.filter((s) => COMPARABLE_CATEGORIES.has(s.operationCategory))))
      .catch((err) => setError(describeCalculationError(err)));
  }, [deps]);

  return { calculationId, setCalculationId, eligibleCalculations, error, setError };
}

function CalculationPicker({
  calculationId,
  onChange,
  eligibleCalculations,
}: {
  calculationId: string;
  onChange: (id: string) => void;
  eligibleCalculations: CalculationSummary[] | null;
}) {
  return (
    <div className="mb-6 max-w-md">
      <label className="mb-1 block text-xs text-muted">Výchozí výpočet (soustružení/frézování/broušení)</label>
      <select className="w-full rounded border border-border bg-surface px-2 py-1 text-sm" value={calculationId} onChange={(e) => onChange(e.target.value)}>
        <option value="">— vyberte výpočet —</option>
        {(eligibleCalculations ?? []).map((s) => (
          <option key={s.calculationId} value={s.calculationId}>
            {s.operationCategory} / {s.operationTypeId} - {new Date(s.calculatedAt).toLocaleDateString("cs-CZ")}
          </option>
        ))}
      </select>
      {eligibleCalculations && eligibleCalculations.length === 0 && <p className="mt-1 text-xs text-muted">Zatím žádný dokončený výpočet vhodný pro porovnání.</p>}
    </div>
  );
}

/**
 * `MachineComparisonPage` (AP-MCE-001 Fáze H §15) - vychází z existujícího
 * výpočtu (`RunMachineComparisonFromCalculationUseCase` znovupoužije jeho
 * uložený vstup, mění se jen kandidátní stroj), řazení (nejkratší čas/
 * nejvyšší confidence/nejnižší warningy/kombinované skóre) počítá a řadí
 * `sortMachineComparison` v Application vrstvě - stránka jen zvolené
 * kritérium předá dál, nepočítá skóre sama.
 */
export function MachineComparisonPage() {
  const deps = useMemo(() => createCalculationEngineDependencies(), []);
  const snapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);
  const { calculationId, setCalculationId, eligibleCalculations, error, setError } = useComparisonBase(deps);

  const [machineOptions, setMachineOptions] = useState<ProfileOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sort, setSort] = useState<MachineComparisonSort>("combined_score");
  const [entries, setEntries] = useState<MachineComparisonEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    deps.listMachineProfilesUseCase.execute().then(setMachineOptions).catch((err) => setError(describeCalculationError(err)));
  }, [deps, setError]);

  const labelFor = (id: string) => machineOptions.find((o) => o.id === id)?.label ?? id;

  async function runComparison() {
    setLoading(true);
    setError(null);
    try {
      const result = await deps.runMachineComparisonFromCalculationUseCase.execute({ calculationId, machineProfileIds: selectedIds });
      setEntries(result);
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setLoading(false);
    }
  }

  const sortedEntries = useMemo(() => (entries ? sortMachineComparison(entries, sort) : null), [entries, sort]);

  return (
    <div>
      <CalculationsNav snapshot={snapshot} />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 border-b border-border pb-6">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Výpočty výroby
          </div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">Porovnání strojů</h1>
        </header>

        {error && <p className="mb-6 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <CalculationPicker calculationId={calculationId} onChange={setCalculationId} eligibleCalculations={eligibleCalculations} />

        {calculationId && (
          <div className="space-y-4">
            <ProfileMultiSelect label="Kandidátní stroje" options={machineOptions} selectedIds={selectedIds} onChange={setSelectedIds} />
            <div className="flex items-center gap-3">
              <button
                onClick={runComparison}
                disabled={loading || selectedIds.length === 0}
                className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-30"
              >
                {loading ? "Počítám…" : "Porovnat"}
              </button>
              <select className="rounded border border-border bg-surface px-2 py-1 text-sm" value={sort} onChange={(e) => setSort(e.target.value as MachineComparisonSort)}>
                {MACHINE_SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {sortedEntries && (
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-raised text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Stroj</th>
                      <th className="px-3 py-2 text-left">Stav</th>
                      <th className="px-3 py-2 text-right">Čas [min]</th>
                      <th className="px-3 py-2 text-right">Confidence</th>
                      <th className="px-3 py-2 text-right">Skóre</th>
                      <th className="px-3 py-2 text-right">Nálezy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.map((e) => (
                      <tr key={e.machineProfileId} className="border-t border-border">
                        <td className="px-3 py-2">{labelFor(e.machineProfileId)}</td>
                        <td className="px-3 py-2">{e.blocked ? <span className="text-danger">Blokováno</span> : "OK"}</td>
                        <td className="px-3 py-2 text-right tabular">{e.totalOperationTimeMinutes?.toFixed(2) ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular">{e.confidenceScore !== undefined ? `${Math.round(e.confidenceScore * 100)} %` : "—"}</td>
                        <td className="px-3 py-2 text-right tabular">{e.combinedScore !== undefined ? e.combinedScore.toFixed(3) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular">{e.issues.length}</td>
                      </tr>
                    ))}
                    {sortedEntries.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted">
                          Žádné výsledky.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * `ToolComparisonPage` (AP-MCE-001 Fáze H §16) - cena/náklad na kus se
 * zobrazuje jen pokud je dostupná; `estimatedCostPerPieceMinor` je v tomhle
 * projektu VŽDY `undefined` (žádný cenový/nabídkový modul zatím neexistuje,
 * viz `GetToolComparisonUseCase` komentář) - stránka to ukazuje jako "není k
 * dispozici", NIKDY nedopočítává náklad sama z neúplných dat (§16).
 */
export function ToolComparisonPage() {
  const deps = useMemo(() => createCalculationEngineDependencies(), []);
  const snapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);
  const { calculationId, setCalculationId, eligibleCalculations, error, setError } = useComparisonBase(deps);

  const [toolOptions, setToolOptions] = useState<ProfileOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [entries, setEntries] = useState<ToolComparisonEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    deps.listToolProfilesUseCase.execute().then(setToolOptions).catch((err) => setError(describeCalculationError(err)));
  }, [deps, setError]);

  const labelFor = (id: string) => toolOptions.find((o) => o.id === id)?.label ?? id;

  async function runComparison() {
    setLoading(true);
    setError(null);
    try {
      const result = await deps.runToolComparisonFromCalculationUseCase.execute({ calculationId, toolProfileIds: selectedIds });
      setEntries(result);
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setLoading(false);
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
          <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">Porovnání nástrojů</h1>
        </header>

        {error && <p className="mb-6 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <CalculationPicker calculationId={calculationId} onChange={setCalculationId} eligibleCalculations={eligibleCalculations} />

        {calculationId && (
          <div className="space-y-4">
            <ProfileMultiSelect label="Kandidátní nástroje/kotouče" options={toolOptions} selectedIds={selectedIds} onChange={setSelectedIds} />
            <button
              onClick={runComparison}
              disabled={loading || selectedIds.length === 0}
              className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-30"
            >
              {loading ? "Počítám…" : "Porovnat"}
            </button>

            {entries && (
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface-raised text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Nástroj/kotouč</th>
                      <th className="px-3 py-2 text-left">Stav</th>
                      <th className="px-3 py-2 text-right">Čas [min]</th>
                      <th className="px-3 py-2 text-right">Confidence</th>
                      <th className="px-3 py-2 text-right">Náklad na kus</th>
                      <th className="px-3 py-2 text-right">Nálezy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.toolProfileId} className="border-t border-border">
                        <td className="px-3 py-2">{labelFor(e.toolProfileId)}</td>
                        <td className="px-3 py-2">{e.blocked ? <span className="text-danger">Blokováno</span> : "OK"}</td>
                        <td className="px-3 py-2 text-right tabular">{e.totalOperationTimeMinutes?.toFixed(2) ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular">{e.confidenceScore !== undefined ? `${Math.round(e.confidenceScore * 100)} %` : "—"}</td>
                        <td className="px-3 py-2 text-right tabular text-muted">{e.estimatedCostPerPieceMinor !== undefined ? e.estimatedCostPerPieceMinor : "není k dispozici"}</td>
                        <td className="px-3 py-2 text-right tabular">{e.issues.length}</td>
                      </tr>
                    ))}
                    {entries.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted">
                          Žádné výsledky.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

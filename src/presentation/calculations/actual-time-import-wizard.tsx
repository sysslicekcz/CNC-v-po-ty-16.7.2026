"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createCalculationEngineDependencies } from "./calculation-engine-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { CalculationsNav } from "./components/calculations-nav";
import { describeCalculationError } from "./calculation-error-messages";
import { parseCsvToImportRows, parseJsonToImportRows } from "@/infrastructure/calculation-engine/actual-time-import-parsers";
import { OperationCategory } from "@/application/calculation-engine/dto/calculation-engine-ui-types";

const CURRENT_USER_PLACEHOLDER = "lokální uživatel";

const COLUMN_FIELDS: { key: string; label: string }[] = [
  { key: "externalOrderColumn", label: "Výrobní příkaz" },
  { key: "externalOperationColumn", label: "Operace" },
  { key: "machineColumn", label: "Stroj" },
  { key: "workstationColumn", label: "Pracoviště" },
  { key: "employeeColumn", label: "Zaměstnanec" },
  { key: "quantityPlannedColumn", label: "Plánované ks" },
  { key: "quantityCompletedColumn", label: "Hotové ks" },
  { key: "quantityScrappedColumn", label: "Zmetky" },
  { key: "startedAtColumn", label: "Začátek" },
  { key: "finishedAtColumn", label: "Konec" },
  { key: "durationMinColumn", label: "Doba trvání [min]" },
  { key: "setupTimeMinColumn", label: "Seřízení [min]" },
];

type WizardStep = "mapping" | "data" | "result";

/**
 * `ActualTimeImportWizard` (AP-MCE-001 Fáze H §20) - VĚDOMĚ zjednodušeno na
 * 3 kroky (mapování -> vložení dat -> výsledek), ne devět z §20 - "náhled"
 * jako samostatný krok by v prezentační vrstvě musel volat doménovou funkci
 * `runActualTimeImport()` přímo (Fáze G, `domain/calculation-engine`), což by
 * porušilo Fáze B §16 "Presentation neimportuje nic z domain přímo" - místo
 * toho `ImportActualTimesUseCase` (Application) provede validaci i zápis v
 * JEDNOM kroku a výsledek (`totalRows`/`validRows`/`invalidRows`) se ukáže až
 * po dokončení.
 */
export function ActualTimeImportWizard() {
  const router = useRouter();
  const deps = useMemo(() => createCalculationEngineDependencies(), []);
  const snapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [step, setStep] = useState<WizardStep>("mapping");
  const [mappings, setMappings] = useState<Record<string, unknown>[]>([]);
  const [mappingId, setMappingId] = useState("");
  const [newMappingName, setNewMappingName] = useState("");
  const [externalSystemId, setExternalSystemId] = useState("");
  const [sourceFormat, setSourceFormat] = useState<"csv" | "json">("csv");
  const [defaultOperationCategory, setDefaultOperationCategory] = useState("turning");
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [rawText, setRawText] = useState("");
  const [delimiter, setDelimiter] = useState<"," | ";">(",");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ batch: Record<string, unknown>; createdRecordIds: string[] } | null>(null);

  useEffect(() => {
    ensureAppBootstrapped()
      .then(() => deps.listActualTimeImportMappingsUseCase.execute())
      .then(setMappings)
      .catch((err) => setError(describeCalculationError(err)));
  }, [deps]);

  async function createMapping() {
    setBusy(true);
    setError(null);
    try {
      const saved = await deps.saveActualTimeImportMappingUseCase.execute({
        name: newMappingName,
        externalSystemId,
        sourceFormat,
        columnMapping,
        defaultOperationCategory: defaultOperationCategory as OperationCategory,
      });
      setMappings([...mappings, saved]);
      setMappingId(String(saved.id));
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    setBusy(true);
    setError(null);
    try {
      const rows = sourceFormat === "csv" ? parseCsvToImportRows(rawText, delimiter) : parseJsonToImportRows(rawText);
      const mapping = mappings.find((m) => String(m.id) === mappingId);
      const category = (mapping?.defaultOperationCategory as string | undefined) ?? defaultOperationCategory;
      const imported = await deps.importActualTimesUseCase.execute({
        mappingId,
        rows,
        operationCategory: category as OperationCategory,
        recordedBy: CURRENT_USER_PLACEHOLDER,
      });
      setResult(imported);
      setStep("result");
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <CalculationsNav snapshot={snapshot} />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 border-b border-border pb-6">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Výpočty výroby
          </div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">Import skutečných časů</h1>
        </header>

        {error && <p className="mb-6 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        {step === "mapping" && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-muted">Existující mapování</label>
              <select className="w-full rounded border border-border bg-surface px-2 py-1 text-sm" value={mappingId} onChange={(e) => setMappingId(e.target.value)}>
                <option value="">— vybrat —</option>
                {mappings.map((m) => (
                  <option key={String(m.id)} value={String(m.id)}>
                    {String(m.name)} ({String(m.sourceFormat)})
                  </option>
                ))}
              </select>
            </div>

            <details className="rounded border border-border p-3">
              <summary className="cursor-pointer text-sm text-muted">Nebo vytvořit nové mapování</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input className="rounded border border-border bg-surface px-2 py-1 text-sm" placeholder="Název mapování" value={newMappingName} onChange={(e) => setNewMappingName(e.target.value)} />
                <input
                  className="rounded border border-border bg-surface px-2 py-1 text-sm"
                  placeholder="Zdrojový systém (id)"
                  value={externalSystemId}
                  onChange={(e) => setExternalSystemId(e.target.value)}
                />
                <select className="rounded border border-border bg-surface px-2 py-1 text-sm" value={sourceFormat} onChange={(e) => setSourceFormat(e.target.value as "csv" | "json")}>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
                <select className="rounded border border-border bg-surface px-2 py-1 text-sm" value={defaultOperationCategory} onChange={(e) => setDefaultOperationCategory(e.target.value)}>
                  <option value="turning">Soustružení</option>
                  <option value="milling">Frézování</option>
                  <option value="grinding">Broušení</option>
                  <option value="manual">Ruční</option>
                  <option value="inspection">Kontrola</option>
                </select>
                {COLUMN_FIELDS.map((f) => (
                  <input
                    key={f.key}
                    className="rounded border border-border bg-surface px-2 py-1 text-sm"
                    placeholder={`Sloupec: ${f.label}`}
                    value={columnMapping[f.key] ?? ""}
                    onChange={(e) => setColumnMapping({ ...columnMapping, [f.key]: e.target.value })}
                  />
                ))}
              </div>
              <button
                onClick={createMapping}
                disabled={busy || !newMappingName.trim() || !externalSystemId.trim()}
                className="mt-3 rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-30"
              >
                Uložit mapování
              </button>
            </details>

            <div className="flex justify-end pt-4">
              <button onClick={() => setStep("data")} disabled={!mappingId} className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-30">
                Pokračovat
              </button>
            </div>
          </div>
        )}

        {step === "data" && (
          <div className="space-y-4">
            {sourceFormat === "csv" && (
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs text-muted">Oddělovač</span>
                <select className="w-full rounded border border-border bg-surface px-2 py-1 text-sm" value={delimiter} onChange={(e) => setDelimiter(e.target.value as "," | ";")}>
                  <option value=",">Čárka (,)</option>
                  <option value=";">Středník (;)</option>
                </select>
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Vložte obsah souboru ({sourceFormat.toUpperCase()})</span>
              <textarea className="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-xs" rows={12} value={rawText} onChange={(e) => setRawText(e.target.value)} />
            </label>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep("mapping")} className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-raised">
                Zpět
              </button>
              <button onClick={runImport} disabled={busy || !rawText.trim()} className="rounded border border-ok px-3 py-1.5 text-sm text-ok hover:bg-ok/10 disabled:opacity-30">
                {busy ? "Importuji…" : "Importovat"}
              </button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className="rounded border border-ok/40 bg-ok/10 p-4 text-sm">
              <p>Celkem řádků: {String(result.batch.totalRows)}</p>
              <p>Validní: {String(result.batch.validRows)}</p>
              <p>Neplatné: {String(result.batch.invalidRows)}</p>
              <p>Vytvořeno záznamů: {result.createdRecordIds.length}</p>
            </div>
            <button onClick={() => router.push("/calculations/actual-times")} className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10">
              Zpět na seznam
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

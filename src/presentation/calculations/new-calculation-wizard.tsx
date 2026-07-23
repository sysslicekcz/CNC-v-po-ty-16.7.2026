"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createCalculationEngineDependencies } from "./calculation-engine-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { CalculationsNav } from "./components/calculations-nav";
import { describeCalculationError, describeCalculationIssue } from "./calculation-error-messages";
import { CalculationIssue, CalculationDraftSourceType } from "@/application/calculation-engine/dto/calculation-engine-ui-types";
import { OperationCalculationOutput } from "@/application/calculation-engine/dto/operation-calculation-output";
import { PreviewCalculationOutput } from "@/application/calculation-engine/workflow/use-cases/preview-calculation-use-case";
import { CALCULATION_FORM_OPTIONS, CALCULATION_FORM_REGISTRY, CalculationFormKey } from "./forms/calculation-form-registry";
import { GenericFeatureForm } from "./forms/generic-feature-form";
import { emptyGenericDraft, GenericCalculationDraft } from "./forms/form-field-types";
import { ProfileOption } from "./components/profile-selector";
import {
  buildTurningInput,
  buildMillingInput,
  buildGrindingInput,
  buildManualInput,
  buildInspectionInput,
} from "@/application/calculation-engine/workflow/forms/form-input-builders";

/** Žádný autentizační/uživatelský modul v projektu neexistuje (single-tenant,
 *  jen IndexedDB) - stejně jako `OfflineStatusIndicator`/`LocalOnlyBadge` je
 *  tohle čestný zástupný identifikátor, ne fingovaný login. */
const CURRENT_USER_PLACEHOLDER = "lokální uživatel";

type WizardStep = "source" | "strategy" | "form" | "review" | "result";
const STEPS: { key: WizardStep; label: string }[] = [
  { key: "source", label: "1. Zdroj výpočtu" },
  { key: "strategy", label: "2. Typ operace" },
  { key: "form", label: "3. Vstupy" },
  { key: "review", label: "4. Kontrola vstupů" },
  { key: "result", label: "5. Výsledek" },
];

const SOURCE_OPTIONS: { value: CalculationDraftSourceType; label: string }[] = [
  { value: "new", label: "Nový výpočet od začátku" },
  { value: "technology_operation", label: "Z technologické operace" },
  { value: "production_order", label: "Z výrobního příkazu" },
  { value: "quote_item", label: "Z položky nabídky" },
  { value: "copy", label: "Kopie existujícího výpočtu" },
  { value: "import", label: "Import" },
];

type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * `NewCalculationWizard` (AP-MCE-001 Fáze H §4) - průvodce novým výpočtem.
 * Kroky: zdroj -> typ operace (strategie) -> dynamický formulář (§5, přes
 * `CalculationFormRegistry`) -> kontrola vstupů -> výsledek. Náhled (krok 5,
 * před potvrzením) běží přes `PreviewCalculationUseCase` (§6 "nevytváří
 * oficiální CalculationResult"), teprve výslovné potvrzení volá persistentní
 * `Calculate*OperationUseCase`. Autosave (§4/§27) ukládá jen syrový stav
 * formuláře přes `SaveCalculationDraftUseCase` - NIKDY nevytváří
 * `CalculationResult` revizi.
 */
export function NewCalculationWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deps = useMemo(() => createCalculationEngineDependencies(), []);
  const snapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [step, setStep] = useState<WizardStep>("source");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<CalculationDraftSourceType>(
    () => (searchParams?.get("source") as CalculationDraftSourceType | null) ?? "new"
  );
  const [sourceReferenceId, setSourceReferenceId] = useState("");
  const [formKey, setFormKey] = useState<CalculationFormKey | "">("");
  const [draft, setDraft] = useState<GenericCalculationDraft>(emptyGenericDraft());
  const [materialOptions, setMaterialOptions] = useState<ProfileOption[] | undefined>(undefined);
  const [machineOptions, setMachineOptions] = useState<ProfileOption[] | undefined>(undefined);
  const [toolOptions, setToolOptions] = useState<ProfileOption[] | undefined>(undefined);

  const [issues, setIssues] = useState<CalculationIssue[] | null>(null);
  const [validating, setValidating] = useState(false);
  const [preview, setPreview] = useState<PreviewCalculationOutput | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [finalResult, setFinalResult] = useState<OperationCalculationOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const hydratedRef = useRef(false);
  const skipNextAutosaveRef = useRef(false);

  // Znovuotevření rozpracovaného konceptu (?draftId=...) nebo předvyplnění
  // zdroje z rychlé akce na dashboardu (?source=technology_operation).
  useEffect(() => {
    const existingDraftId = searchParams?.get("draftId");
    if (!existingDraftId) {
      hydratedRef.current = true;
      return;
    }
    ensureAppBootstrapped()
      .then(() => deps.getCalculationDraftUseCase.execute(existingDraftId))
      .then((plain) => {
        if (!plain) {
          hydratedRef.current = true;
          return;
        }
        const formState = plain.formState as Record<string, unknown>;
        skipNextAutosaveRef.current = true;
        setDraftId(plain.id as string);
        setSourceType(plain.sourceType as CalculationDraftSourceType);
        setSourceReferenceId((plain.sourceReferenceId as string) ?? "");
        if (typeof formState.formKey === "string") setFormKey(formState.formKey as CalculationFormKey);
        if (formState.draft) setDraft(formState.draft as GenericCalculationDraft);
        hydratedRef.current = true;
      })
      .catch((err) => {
        setError(describeCalculationError(err));
        hydratedRef.current = true;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registryEntry = formKey ? CALCULATION_FORM_REGISTRY[formKey] : null;

  // Naplní `MaterialProfileSelector`/`MachineProfileSelector`/`ToolProfile
  // Selector` (§10) - JEDNO načtení pro celý průvodce, stejná disciplína
  // jako `useFeatureAccessSnapshot`.
  useEffect(() => {
    let cancelled = false;
    ensureAppBootstrapped()
      .then(() =>
        Promise.all([deps.listMaterialProfilesUseCase.execute(), deps.listMachineProfilesUseCase.execute(), deps.listToolProfilesUseCase.execute()])
      )
      .then(([materials, machines, tools]) => {
        if (cancelled) return;
        setMaterialOptions(materials.map((m) => ({ id: m.id, label: m.label, isArchived: m.isArchived })));
        setMachineOptions(machines.map((m) => ({ id: m.id, label: m.label, isArchived: m.isArchived })));
        setToolOptions(tools.map((t) => ({ id: t.id, label: t.label, isArchived: t.isArchived })));
      })
      .catch(() => {
        // Nekritické - formulář prostě spadne zpátky na prosté textové zadání ID.
      });
    return () => {
      cancelled = true;
    };
  }, [deps]);

  // Autosave (debounce) - jen syrový stav formuláře, žádná validace/persist.
  useEffect(() => {
    if (!hydratedRef.current || !formKey) return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    setSaveStatus("saving");
    const timeout = setTimeout(() => {
      deps.saveCalculationDraftUseCase
        .execute({
          id: draftId ?? undefined,
          sourceType,
          sourceReferenceId: sourceType === "new" ? undefined : sourceReferenceId || undefined,
          operationCategory: registryEntry?.schema.category,
          currentStep: STEPS.findIndex((s) => s.key === step) + 1,
          formState: { formKey, draft },
          createdBy: CURRENT_USER_PLACEHOLDER,
        })
        .then((saved) => {
          setDraftId(saved.id as string);
          setSaveStatus("saved");
        })
        .catch(() => setSaveStatus("error"));
    }, 1500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, step, formKey, sourceType, sourceReferenceId]);

  function buildDomainInput() {
    if (!formKey || !registryEntry) throw new Error("Není zvolen typ operace.");
    switch (formKey) {
      case "turning":
        return buildTurningInput(draft, registryEntry.schema);
      case "milling":
        return buildMillingInput(draft, registryEntry.schema);
      case "grinding_cylindrical":
      case "grinding_surface":
        return buildGrindingInput(draft, registryEntry.schema);
      case "manual":
        return buildManualInput(draft, registryEntry.schema);
      case "inspection":
        return buildInspectionInput(draft, registryEntry.schema);
    }
  }

  async function handleValidate() {
    setValidating(true);
    setError(null);
    try {
      let result: CalculationIssue[];
      switch (formKey) {
        case "turning":
          result = await deps.validateTurningInputUseCase.execute(buildTurningInput(draft, registryEntry!.schema));
          break;
        case "milling":
          result = await deps.validateMillingInputUseCase.execute(buildMillingInput(draft, registryEntry!.schema));
          break;
        case "grinding_cylindrical":
        case "grinding_surface":
          result = await deps.validateGrindingInputUseCase.execute(buildGrindingInput(draft, registryEntry!.schema));
          break;
        case "manual":
          result = await deps.validateManualOperationInputUseCase.execute(buildManualInput(draft, registryEntry!.schema));
          break;
        case "inspection":
          result = await deps.validateInspectionInputUseCase.execute(buildInspectionInput(draft, registryEntry!.schema));
          break;
        default:
          result = [];
      }
      setIssues(result);
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setValidating(false);
    }
  }

  async function handlePreview() {
    setPreviewing(true);
    setError(null);
    try {
      const input = buildDomainInput()!;
      const result = await deps.previewCalculationUseCase.execute(input);
      setPreview(result);
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleCalculate() {
    setCalculating(true);
    setError(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const common = { idempotencyKey, requestedBy: CURRENT_USER_PLACEHOLDER, actorId: CURRENT_USER_PLACEHOLDER };
      let output: OperationCalculationOutput;
      switch (formKey) {
        case "turning":
          output = await deps.calculateTurningOperationUseCase.execute({ ...buildTurningInput(draft, registryEntry!.schema), ...common });
          break;
        case "milling":
          output = await deps.calculateMillingOperationUseCase.execute({ ...buildMillingInput(draft, registryEntry!.schema), ...common });
          break;
        case "grinding_cylindrical":
          output = await deps.calculateCylindricalGrindingOperationUseCase.execute({ ...buildGrindingInput(draft, registryEntry!.schema), ...common });
          break;
        case "grinding_surface":
          output = await deps.calculateSurfaceGrindingOperationUseCase.execute({ ...buildGrindingInput(draft, registryEntry!.schema), ...common });
          break;
        case "manual":
          output = await deps.calculateManualOperationUseCase.execute({ ...buildManualInput(draft, registryEntry!.schema), ...common });
          break;
        case "inspection":
          output = await deps.calculateInspectionOperationUseCase.execute({ ...buildInspectionInput(draft, registryEntry!.schema), ...common });
          break;
        default:
          throw new Error("Není zvolen typ operace.");
      }
      setFinalResult(output);
      if (draftId) await deps.deleteCalculationDraftUseCase.execute({ id: draftId });
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setCalculating(false);
    }
  }

  async function handleDiscard() {
    if (draftId) {
      try {
        await deps.deleteCalculationDraftUseCase.execute({ id: draftId });
      } catch {
        // koncept nemá auditní stopu (§27) - zahození nesmí selhat kvůli chybě mazání
      }
    }
    router.push("/calculations");
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const blockingErrorCount = issues?.filter((i) => i.severity === "error").length ?? 0;

  function goTo(next: WizardStep) {
    setError(null);
    setStep(next);
  }

  return (
    <div>
      <CalculationsNav snapshot={snapshot} />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-6">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Výpočty výroby
            </div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">Nový výpočet</h1>
          </div>
          <SaveStatusBadge status={saveStatus} />
        </header>

        <ol className="mb-8 flex flex-wrap gap-2 text-xs">
          {STEPS.map((s, i) => (
            <li
              key={s.key}
              className={`rounded-full border px-3 py-1 ${i === stepIndex ? "border-accent text-accent" : i < stepIndex ? "border-ok text-ok" : "border-border text-muted"}`}
            >
              {s.label}
            </li>
          ))}
        </ol>

        {error && <p className="mb-6 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        {step === "source" && (
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted">Odkud výpočet vzniká?</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {SOURCE_OPTIONS.map((o) => (
                <label key={o.value} className={`cursor-pointer rounded border px-3 py-2 text-sm ${sourceType === o.value ? "border-accent bg-accent/10" : "border-border"}`}>
                  <input type="radio" name="sourceType" className="mr-2" checked={sourceType === o.value} onChange={() => setSourceType(o.value)} />
                  {o.label}
                </label>
              ))}
            </div>
            {sourceType !== "new" && (
              <label className="block max-w-sm">
                <span className="mb-1 block text-xs text-muted">Id zdrojové entity</span>
                <input
                  className="w-full rounded border border-border bg-surface px-2 py-1 text-sm"
                  value={sourceReferenceId}
                  onChange={(e) => setSourceReferenceId(e.target.value)}
                  placeholder="např. id technologické operace"
                />
              </label>
            )}
            <div className="flex justify-between pt-4">
              <button onClick={handleDiscard} className="rounded border border-danger/50 px-3 py-1.5 text-sm text-danger hover:bg-danger/10">
                Zahodit
              </button>
              <button
                onClick={() => goTo("strategy")}
                disabled={sourceType !== "new" && !sourceReferenceId.trim()}
                className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-30"
              >
                Pokračovat
              </button>
            </div>
          </section>
        )}

        {step === "strategy" && (
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted">Jaký typ operace se počítá?</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {CALCULATION_FORM_OPTIONS.map((o) => (
                <label key={o.key} className={`cursor-pointer rounded border px-3 py-2 text-sm ${formKey === o.key ? "border-accent bg-accent/10" : "border-border"}`}>
                  <input
                    type="radio"
                    name="formKey"
                    className="mr-2"
                    checked={formKey === o.key}
                    onChange={() => {
                      setFormKey(o.key);
                      setDraft(emptyGenericDraft());
                      setIssues(null);
                      setPreview(null);
                    }}
                  />
                  {o.label}
                </label>
              ))}
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => goTo("source")} className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-raised">
                Zpět
              </button>
              <button onClick={() => goTo("form")} disabled={!formKey} className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-30">
                Pokračovat
              </button>
            </div>
          </section>
        )}

        {step === "form" && registryEntry && (
          <section className="space-y-4">
            <GenericFeatureForm
              schema={registryEntry.schema}
              draft={draft}
              onChange={setDraft}
              materialOptions={materialOptions}
              machineOptions={machineOptions}
              toolOptions={toolOptions}
            />
            <div className="flex justify-between pt-4">
              <button onClick={() => goTo("strategy")} className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-raised">
                Zpět
              </button>
              <button
                onClick={() => {
                  setIssues(null);
                  goTo("review");
                }}
                className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
              >
                Pokračovat na kontrolu
              </button>
            </div>
          </section>
        )}

        {step === "review" && (
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted">Kontrola vstupů</h2>
            <button onClick={handleValidate} disabled={validating} className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-50">
              {validating ? "Validuji…" : "Validovat vstupy"}
            </button>

            {issues && (
              <div className="space-y-1">
                {issues.length === 0 && <p className="text-sm text-ok">Žádné nálezy.</p>}
                {issues.map((issue, i) => (
                  <p key={i} className={`rounded border px-3 py-1.5 text-sm ${issue.severity === "error" ? "border-danger/40 bg-danger/10 text-danger" : "border-border text-muted"}`}>
                    <span className="mr-2 uppercase text-xs">{issue.severity}</span>
                    {describeCalculationIssue(issue)}
                  </p>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <button onClick={() => goTo("form")} className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-raised">
                Zpět na vstupy
              </button>
              <button
                onClick={() => goTo("result")}
                disabled={!issues || blockingErrorCount > 0}
                className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-30"
                title={blockingErrorCount > 0 ? "Nejprve odstraňte chyby (severity: error)." : undefined}
              >
                Pokračovat na výsledek
              </button>
            </div>
          </section>
        )}

        {step === "result" && (
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted">Náhled a výsledek</h2>

            {!finalResult && (
              <>
                <button onClick={handlePreview} disabled={previewing} className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-50">
                  {previewing ? "Počítám náhled…" : "Zobrazit náhled (neukládá)"}
                </button>
                <p className="text-xs text-muted">Náhled volá stejný výpočetní engine jako ostrý výpočet, ale nic neukládá - žádný CalculationResult zatím nevzniká.</p>

                {preview && (
                  <div className="rounded border border-border bg-surface p-4 text-sm">
                    <p>
                      Stav: <strong>{preview.blocked ? "blokováno" : "OK"}</strong>
                    </p>
                    {preview.totalOperationTimeMinutes !== undefined && <p>Celkový čas: {preview.totalOperationTimeMinutes.toFixed(2)} min</p>}
                    {preview.confidenceScore !== undefined && <p>Confidence: {Math.round(preview.confidenceScore * 100)} %</p>}
                    {preview.issues.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {preview.issues.map((issue, i) => (
                          <li key={i} className="text-xs text-muted">
                            {describeCalculationIssue(issue)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <button onClick={() => goTo("review")} className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-raised">
                    Zpět na kontrolu
                  </button>
                  <button onClick={handleCalculate} disabled={calculating} className="rounded border border-ok px-3 py-1.5 text-sm text-ok hover:bg-ok/10 disabled:opacity-50">
                    {calculating ? "Počítám a ukládám…" : "Spočítat a uložit"}
                  </button>
                </div>
              </>
            )}

            {finalResult && (
              <div className="space-y-4">
                <div className="rounded border border-ok/40 bg-ok/10 p-4 text-sm">
                  <p className="font-medium text-ok">Výpočet uložen ({finalResult.status}).</p>
                  {finalResult.finalOperationTimeMinutes !== undefined && <p>Celkový čas: {finalResult.finalOperationTimeMinutes.toFixed(2)} min</p>}
                  {finalResult.confidenceScore !== undefined && <p>Confidence: {Math.round(finalResult.confidenceScore * 100)} %</p>}
                </div>
                <button onClick={() => router.push(`/calculations/${finalResult.calculationId}`)} className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10">
                  Otevřít detail výpočtu
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const label = status === "saving" ? "Ukládám koncept…" : status === "saved" ? "Koncept uložen" : "Uložení konceptu selhalo";
  const toneClass = status === "error" ? "text-danger" : "text-muted";
  return <span className={`text-xs ${toneClass}`}>{label}</span>;
}

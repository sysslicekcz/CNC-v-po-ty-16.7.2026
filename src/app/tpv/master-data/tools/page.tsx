"use client";

import { useCallback, useMemo, useState } from "react";
import { createMasterDataDependencies } from "@/presentation/master-data/master-data-dependencies";
import { useMasterDataReload } from "@/presentation/master-data/use-master-data-reload";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { FeatureGate } from "@/presentation/components/feature-gate";
import { FeatureUnavailableNotice } from "@/presentation/components/feature-unavailable-notice";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { satisfiesAccess } from "@/domain/licensing/feature-access";
import { MasterDataNav } from "@/presentation/master-data/components/master-data-nav";
import { MasterDataToolbar, MasterDataStatusFilter } from "@/presentation/master-data/components/master-data-toolbar";
import { MasterDataStatusBadge } from "@/presentation/master-data/components/master-data-status-badge";
import { MasterDataEmptyState } from "@/presentation/master-data/components/master-data-empty-state";
import { ExportCsvButton } from "@/presentation/master-data/components/export-csv-button";
import { describeMasterDataError } from "@/presentation/master-data/master-data-error-messages";
import { Tool, ToolParameterValue } from "@/domain/entities/tool";
import { ToolType, ToolCategory, ToolParameterDefinition, ToolParameterValueType } from "@/domain/entities/tool-type";

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  turning_holder: "Soustružnický držák",
  turning_insert: "Soustružnická destička",
  milling_cutter: "Fréza",
  milling_insert: "Frézovací destička",
  drill: "Vrták",
  tap: "Závitník",
  reamer: "Výstružník",
  grinding_wheel: "Brusný kotouč",
  measuring_tool: "Měřidlo",
  other: "Jiné",
};

const VALUE_TYPE_LABELS: Record<ToolParameterValueType, string> = { number: "Číslo", text: "Text", boolean: "Ano/Ne", selection: "Výběr" };

type ToolPanel = { kind: "create" } | { kind: "edit"; tool: Tool } | null;
type ToolTypePanel = { kind: "create" } | { kind: "edit"; toolType: ToolType } | null;

/** Nástroje a typy nástrojů (Krok 5, zadání bod 17-19) - typ nástroje nese
 *  definici dynamických parametrů (`parameterDefinitions`), konkrétní nástroj
 *  nese jejich hodnoty (`parameters`). Obě podsekce na jedné stránce, protože
 *  formulář nástroje potřebuje seznam typů rovnou k dispozici. */
export default function ToolsPage() {
  const deps = useMemo(() => createMasterDataDependencies(), []);
  const featureAccessSnapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);
  const canManage = featureAccessSnapshot ? satisfiesAccess(featureAccessSnapshot.access[FeatureCodes.ToolsManage], "write") : false;

  const [tools, setTools] = useState<Tool[] | null>(null);
  const [toolTypes, setToolTypes] = useState<ToolType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MasterDataStatusFilter>("all");
  const [toolPanel, setToolPanel] = useState<ToolPanel>(null);
  const [toolTypePanel, setToolTypePanel] = useState<ToolTypePanel>(null);
  const [showToolTypes, setShowToolTypes] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [toolList, typeList] = await Promise.all([deps.listToolsUseCase.execute(), deps.listToolTypesUseCase.execute()]);
      setTools(toolList);
      setToolTypes(typeList);
    } catch (e) {
      setError(describeMasterDataError(e));
    }
  }, [deps]);

  useMasterDataReload(reload);

  const toolTypeName = (id: string) => toolTypes.find((t) => t.id === id)?.nazev ?? id;

  const filtered = useMemo(() => {
    if (!tools) return [];
    const term = search.trim().toLowerCase();
    return tools.filter((t) => {
      const active = t.stav === "aktivni";
      if (statusFilter === "active" && !active) return false;
      if (statusFilter === "inactive" && active) return false;
      if (!term) return true;
      return t.nazev.toLowerCase().includes(term) || (t.code?.toString().toLowerCase().includes(term) ?? false);
    });
  }, [tools, search, statusFilter]);

  const handleToolSubmit = async (values: ToolFormValues) => {
    const parameters = buildParameterValues(values.toolTypeId, toolTypes, values.parameters);
    if (toolPanel?.kind === "create") {
      await deps.createToolUseCase.execute({
        code: values.code || undefined,
        nazev: values.nazev,
        toolTypeId: values.toolTypeId,
        manufacturer: values.manufacturer || undefined,
        designation: values.designation || undefined,
        parameters,
        poznamka: values.poznamka || undefined,
      });
    } else if (toolPanel?.kind === "edit") {
      await deps.updateToolUseCase.execute(toolPanel.tool.id, {
        code: values.code || null,
        nazev: values.nazev,
        toolTypeId: values.toolTypeId,
        manufacturer: values.manufacturer || undefined,
        designation: values.designation || undefined,
        parameters,
        poznamka: values.poznamka || undefined,
      });
    }
    setToolPanel(null);
    await reload();
  };

  const toggleToolStatus = async (tool: Tool) => {
    try {
      if (tool.stav === "aktivni") await deps.deactivateToolUseCase.execute(tool.id);
      else await deps.reactivateToolUseCase.execute(tool.id);
      await reload();
    } catch (e) {
      setError(describeMasterDataError(e));
    }
  };

  const handleToolTypeSubmit = async (values: ToolTypeFormValues) => {
    if (toolTypePanel?.kind === "create") {
      await deps.createToolTypeUseCase.execute({
        kod: values.kod,
        nazev: values.nazev,
        category: values.category,
        parameterDefinitions: values.parameterDefinitions,
        popis: values.popis || undefined,
      });
    } else if (toolTypePanel?.kind === "edit") {
      await deps.updateToolTypeUseCase.execute(toolTypePanel.toolType.id, {
        kod: values.kod,
        nazev: values.nazev,
        category: values.category,
        parameterDefinitions: values.parameterDefinitions,
        popis: values.popis || undefined,
      });
    }
    setToolTypePanel(null);
    await reload();
  };

  const toggleToolTypeStatus = async (toolType: ToolType) => {
    try {
      if (toolType.stav === "aktivni") await deps.deactivateToolTypeUseCase.execute(toolType.id);
      await reload();
    } catch (e) {
      setError(describeMasterDataError(e));
    }
  };

  return (
    <FeatureGate
      snapshot={featureAccessSnapshot}
      feature={FeatureCodes.ToolsView}
      requiredAccess="read"
      loading={<div className="p-8 text-sm text-muted">Načítám oprávnění…</div>}
      fallback={
        <div className="p-8">
          <FeatureUnavailableNotice message="Vaše licence neumožňuje zobrazení nástrojů." />
        </div>
      }
    >
      <div className="flex min-h-screen flex-col">
        <div className="border-b border-border px-6 py-4">
          <h1 className="text-lg font-medium">Nástroje</h1>
        </div>
        <MasterDataNav />
        <div className="mx-auto w-full max-w-5xl p-6">
          <MasterDataToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Hledat podle názvu nebo kódu…"
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            addLabel="+ Nový nástroj"
            onAdd={canManage && toolTypes.length > 0 ? () => setToolPanel({ kind: "create" }) : undefined}
          />
          <div className="mb-4 flex justify-end">
            <ExportCsvButton
              filename="nastroje.csv"
              headers={["code", "nazev", "toolType", "manufacturer", "designation", "stav"]}
              rows={(tools ?? []).map((t) => [t.code?.toString() ?? "", t.nazev, toolTypeName(t.toolTypeId), t.manufacturer ?? "", t.designation ?? "", t.stav])}
            />
          </div>
          {canManage && toolTypes.length === 0 && (
            <p className="mb-3 text-sm text-muted">Nejdřív založte alespoň jeden typ nástroje níže.</p>
          )}

          {error && <p className="mb-3 text-sm text-danger">{error}</p>}
          {!tools && !error && <p className="text-sm text-muted">Načítám…</p>}
          {tools && filtered.length === 0 && (
            <MasterDataEmptyState
              hasAnyItems={tools.length > 0}
              noItemsMessage="Zatím nejsou založeny žádné nástroje. Nástroje se přiřazují k operacím a mají řezné podmínky pro konkrétní stroj."
              onAdd={canManage && toolTypes.length > 0 ? () => setToolPanel({ kind: "create" }) : undefined}
              addLabel="+ Nový nástroj"
            />
          )}

          {filtered.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2">Kód</th>
                  <th className="py-2 pr-2">Název</th>
                  <th className="py-2 pr-2">Typ</th>
                  <th className="py-2 pr-2">Výrobce</th>
                  <th className="py-2 pr-2">Stav</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-surface-raised">
                    <td className="py-2 pr-2">{t.code?.toString() ?? "—"}</td>
                    <td className="py-2 pr-2">{t.nazev}</td>
                    <td className="py-2 pr-2 text-muted">{toolTypeName(t.toolTypeId)}</td>
                    <td className="py-2 pr-2 text-muted">{t.manufacturer ?? "—"}</td>
                    <td className="py-2 pr-2">
                      <MasterDataStatusBadge active={t.stav === "aktivni"} />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2 text-xs">
                          <button onClick={() => setToolPanel({ kind: "edit", tool: t })} className="text-accent hover:underline">
                            Upravit
                          </button>
                          <button onClick={() => void toggleToolStatus(t)} className="text-muted hover:underline">
                            {t.stav === "aktivni" ? "Deaktivovat" : "Reaktivovat"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-8 border-t border-border pt-4">
            <button onClick={() => setShowToolTypes((v) => !v)} className="text-sm text-accent hover:underline">
              {showToolTypes ? "Skrýt typy nástrojů" : `Zobrazit typy nástrojů (${toolTypes.length})`}
            </button>
            {showToolTypes && (
              <div className="mt-3">
                <div className="mb-2 flex justify-end">
                  {canManage && (
                    <button
                      onClick={() => setToolTypePanel({ kind: "create" })}
                      className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
                    >
                      + Nový typ nástroje
                    </button>
                  )}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 pr-2">Kód</th>
                      <th className="py-2 pr-2">Název</th>
                      <th className="py-2 pr-2">Kategorie</th>
                      <th className="py-2 pr-2">Parametry</th>
                      <th className="py-2 pr-2">Stav</th>
                      <th className="py-2 pr-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {toolTypes.map((tt) => (
                      <tr key={tt.id} className="border-b border-border/50 hover:bg-surface-raised">
                        <td className="py-2 pr-2">{tt.kod}</td>
                        <td className="py-2 pr-2">{tt.nazev}</td>
                        <td className="py-2 pr-2 text-muted">{CATEGORY_LABELS[tt.category]}</td>
                        <td className="py-2 pr-2 text-muted">{tt.parameterDefinitions.map((p) => p.name).join(", ") || "—"}</td>
                        <td className="py-2 pr-2">
                          <MasterDataStatusBadge active={tt.stav === "aktivni"} />
                        </td>
                        <td className="py-2 pr-2 text-right">
                          {canManage && (
                            <div className="flex justify-end gap-2 text-xs">
                              <button onClick={() => setToolTypePanel({ kind: "edit", toolType: tt })} className="text-accent hover:underline">
                                Upravit
                              </button>
                              {tt.stav === "aktivni" && (
                                <button onClick={() => void toggleToolTypeStatus(tt)} className="text-muted hover:underline">
                                  Deaktivovat
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {toolPanel && (
        <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/40" onClick={() => setToolPanel(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-sm font-medium">{toolPanel.kind === "create" ? "Nový nástroj" : `Úprava: ${toolPanel.tool.nazev}`}</h2>
            <ToolForm
              initial={toolPanel.kind === "edit" ? toolToFormValues(toolPanel.tool) : emptyToolForm(toolTypes)}
              toolTypes={toolTypes}
              submitLabel={toolPanel.kind === "create" ? "Založit" : "Uložit"}
              onCancel={() => setToolPanel(null)}
              onSubmit={handleToolSubmit}
            />
          </div>
        </div>
      )}

      {toolTypePanel && (
        <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/40" onClick={() => setToolTypePanel(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-sm font-medium">{toolTypePanel.kind === "create" ? "Nový typ nástroje" : `Úprava: ${toolTypePanel.toolType.nazev}`}</h2>
            <ToolTypeForm
              initial={toolTypePanel.kind === "edit" ? toolTypeToFormValues(toolTypePanel.toolType) : EMPTY_TOOL_TYPE_FORM}
              submitLabel={toolTypePanel.kind === "create" ? "Založit" : "Uložit"}
              onCancel={() => setToolTypePanel(null)}
              onSubmit={handleToolTypeSubmit}
            />
          </div>
        </div>
      )}
    </FeatureGate>
  );
}

interface ToolFormValues {
  code: string;
  nazev: string;
  toolTypeId: string;
  manufacturer: string;
  designation: string;
  parameters: Record<string, string>;
  poznamka: string;
}

function emptyToolForm(toolTypes: ToolType[]): ToolFormValues {
  return { code: "", nazev: "", toolTypeId: toolTypes[0]?.id ?? "", manufacturer: "", designation: "", parameters: {}, poznamka: "" };
}

function toolToFormValues(tool: Tool): ToolFormValues {
  const parameters: Record<string, string> = {};
  for (const [key, value] of Object.entries(tool.parameters ?? {})) parameters[key] = String(value);
  return {
    code: tool.code?.toString() ?? "",
    nazev: tool.nazev,
    toolTypeId: tool.toolTypeId,
    manufacturer: tool.manufacturer ?? "",
    designation: tool.designation ?? "",
    parameters,
    poznamka: tool.poznamka ?? "",
  };
}

/** Převede formulářové stringy na typované `ToolParameterValue` podle
 *  `ToolType.parameterDefinitions` (Krok 5, zadání bod 19) - konverze číslo/
 *  boolean/text patří sem, ne do domény (viz `validateToolParameters`, které
 *  hodnoty jen validuje, nekonvertuje). */
function buildParameterValues(
  toolTypeId: string,
  toolTypes: ToolType[],
  raw: Record<string, string>
): Record<string, ToolParameterValue> {
  const definitions = toolTypes.find((t) => t.id === toolTypeId)?.parameterDefinitions ?? [];
  const result: Record<string, ToolParameterValue> = {};
  for (const def of definitions) {
    const value = raw[def.key];
    if (value === undefined || value === "") continue;
    if (def.valueType === "number") result[def.key] = Number(value);
    else if (def.valueType === "boolean") result[def.key] = value === "true";
    else result[def.key] = value;
  }
  return result;
}

function ToolForm({
  initial,
  toolTypes,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ToolFormValues;
  toolTypes: ToolType[];
  submitLabel: string;
  onSubmit: (values: ToolFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedType = toolTypes.find((t) => t.id === values.toolTypeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-sm">
      {error && <p className="rounded border border-danger px-2 py-1 text-danger">{error}</p>}
      <label className="flex flex-col gap-1">
        Kód
        <input
          value={values.code}
          onChange={(e) => setValues({ ...values, code: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        Název *
        <input
          required
          value={values.nazev}
          onChange={(e) => setValues({ ...values, nazev: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        Typ nástroje *
        <select
          required
          value={values.toolTypeId}
          onChange={(e) => setValues({ ...values, toolTypeId: e.target.value, parameters: {} })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        >
          {toolTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nazev}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Výrobce
        <input
          value={values.manufacturer}
          onChange={(e) => setValues({ ...values, manufacturer: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        Označení
        <input
          value={values.designation}
          onChange={(e) => setValues({ ...values, designation: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>

      {selectedType && selectedType.parameterDefinitions.length > 0 && (
        <fieldset className="space-y-2 rounded border border-border p-2">
          <legend className="px-1 text-xs uppercase tracking-wide text-muted">Parametry ({selectedType.nazev})</legend>
          {selectedType.parameterDefinitions.map((def) => (
            <ParameterInput
              key={def.key}
              definition={def}
              value={values.parameters[def.key] ?? ""}
              onChange={(value) => setValues({ ...values, parameters: { ...values.parameters, [def.key]: value } })}
            />
          ))}
        </fieldset>
      )}

      <label className="flex flex-col gap-1">
        Poznámka
        <textarea
          value={values.poznamka}
          onChange={(e) => setValues({ ...values, poznamka: e.target.value })}
          rows={2}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded border border-border px-3 py-1.5 hover:bg-surface-raised">
          Zrušit
        </button>
        <button type="submit" disabled={submitting} className="rounded border border-accent px-3 py-1.5 text-accent hover:bg-accent/10 disabled:opacity-50">
          {submitting ? "Ukládám…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function ParameterInput({
  definition,
  value,
  onChange,
}: {
  definition: ToolParameterDefinition;
  value: string;
  onChange: (value: string) => void;
}) {
  const label = `${definition.name}${definition.unit ? ` [${definition.unit}]` : ""}${definition.required ? " *" : ""}`;

  if (definition.valueType === "boolean") {
    return (
      <label className="flex flex-col gap-1">
        {label}
        <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent">
          <option value="">—</option>
          <option value="true">Ano</option>
          <option value="false">Ne</option>
        </select>
      </label>
    );
  }
  if (definition.valueType === "selection") {
    return (
      <label className="flex flex-col gap-1">
        {label}
        <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent">
          <option value="">—</option>
          {(definition.allowedValues ?? []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="flex flex-col gap-1">
      {label}
      <input
        required={definition.required}
        type={definition.valueType === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
      />
    </label>
  );
}

interface ToolTypeFormValues {
  kod: string;
  nazev: string;
  category: ToolCategory;
  parameterDefinitions: ToolParameterDefinition[];
  popis: string;
}

const EMPTY_TOOL_TYPE_FORM: ToolTypeFormValues = { kod: "", nazev: "", category: "milling_cutter", parameterDefinitions: [], popis: "" };

function toolTypeToFormValues(toolType: ToolType): ToolTypeFormValues {
  return {
    kod: toolType.kod,
    nazev: toolType.nazev,
    category: toolType.category,
    parameterDefinitions: [...toolType.parameterDefinitions],
    popis: toolType.popis ?? "",
  };
}

function ToolTypeForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ToolTypeFormValues;
  submitLabel: string;
  onSubmit: (values: ToolTypeFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const addParameter = () => {
    setValues({
      ...values,
      parameterDefinitions: [...values.parameterDefinitions, { key: "", name: "", valueType: "number", required: false }],
    });
  };

  const updateParameter = (index: number, patch: Partial<ToolParameterDefinition>) => {
    const next = [...values.parameterDefinitions];
    next[index] = { ...next[index], ...patch };
    setValues({ ...values, parameterDefinitions: next });
  };

  const removeParameter = (index: number) => {
    setValues({ ...values, parameterDefinitions: values.parameterDefinitions.filter((_, i) => i !== index) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-sm">
      {error && <p className="rounded border border-danger px-2 py-1 text-danger">{error}</p>}
      <label className="flex flex-col gap-1">
        Kód *
        <input
          required
          value={values.kod}
          onChange={(e) => setValues({ ...values, kod: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        Název *
        <input
          required
          value={values.nazev}
          onChange={(e) => setValues({ ...values, nazev: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        Kategorie
        <select
          value={values.category}
          onChange={(e) => setValues({ ...values, category: e.target.value as ToolCategory })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        >
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-2 rounded border border-border p-2">
        <legend className="px-1 text-xs uppercase tracking-wide text-muted">Definice parametrů</legend>
        {values.parameterDefinitions.map((def, index) => (
          <div key={index} className="grid grid-cols-6 gap-1 border-b border-border/50 pb-2">
            <input
              placeholder="klíč"
              value={def.key}
              onChange={(e) => updateParameter(index, { key: e.target.value })}
              className="col-span-2 rounded border border-border bg-transparent px-1 py-1 text-xs outline-none focus:border-accent"
            />
            <input
              placeholder="název"
              value={def.name}
              onChange={(e) => updateParameter(index, { name: e.target.value })}
              className="col-span-2 rounded border border-border bg-transparent px-1 py-1 text-xs outline-none focus:border-accent"
            />
            <select
              value={def.valueType}
              onChange={(e) => updateParameter(index, { valueType: e.target.value as ToolParameterValueType })}
              className="col-span-1 rounded border border-border bg-transparent px-1 py-1 text-xs outline-none focus:border-accent"
            >
              {Object.entries(VALUE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => removeParameter(index)} className="col-span-1 text-xs text-danger hover:underline">
              Odebrat
            </button>
            <label className="col-span-3 flex items-center gap-1 text-xs">
              <input type="checkbox" checked={def.required} onChange={(e) => updateParameter(index, { required: e.target.checked })} />
              povinný
            </label>
            <input
              placeholder="jednotka"
              value={def.unit ?? ""}
              onChange={(e) => updateParameter(index, { unit: e.target.value || undefined })}
              className="col-span-3 rounded border border-border bg-transparent px-1 py-1 text-xs outline-none focus:border-accent"
            />
            {def.valueType === "selection" && (
              <input
                placeholder="povolené hodnoty (čárkou)"
                value={(def.allowedValues ?? []).join(", ")}
                onChange={(e) =>
                  updateParameter(index, {
                    allowedValues: e.target.value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  })
                }
                className="col-span-6 rounded border border-border bg-transparent px-1 py-1 text-xs outline-none focus:border-accent"
              />
            )}
          </div>
        ))}
        <button type="button" onClick={addParameter} className="text-xs text-accent hover:underline">
          + Přidat parametr
        </button>
      </fieldset>

      <label className="flex flex-col gap-1">
        Popis
        <textarea
          value={values.popis}
          onChange={(e) => setValues({ ...values, popis: e.target.value })}
          rows={2}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded border border-border px-3 py-1.5 hover:bg-surface-raised">
          Zrušit
        </button>
        <button type="submit" disabled={submitting} className="rounded border border-accent px-3 py-1.5 text-accent hover:bg-accent/10 disabled:opacity-50">
          {submitting ? "Ukládám…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

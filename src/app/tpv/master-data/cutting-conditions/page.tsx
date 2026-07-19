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
import { ExportCsvButton } from "@/presentation/master-data/components/export-csv-button";
import { describeMasterDataError } from "@/presentation/master-data/master-data-error-messages";
import { ToolMachineCondition, MachiningMode, CuttingConditionSource } from "@/domain/entities/tool-machine-condition";
import { CuttingParameters } from "@/domain/value-objects/cutting-parameters";
import { Tool } from "@/domain/entities/tool";
import { Machine } from "@/domain/entities/machine";
import { OperationType } from "@/domain/entities/operation-type";
import { Material } from "@/domain/entities/material";

const MODE_LABELS: Record<MachiningMode, string> = { roughing: "Hrubování", finishing: "Dokončování", universal: "Univerzální" };
const SOURCE_LABELS: Record<CuttingConditionSource, string> = {
  manufacturer: "Výrobce nástroje",
  internal: "Interní norma",
  calculated: "Dopočteno",
  manual: "Ručně zadáno",
};

type PanelMode = { kind: "create" } | { kind: "edit"; condition: ToolMachineCondition } | null;

interface FormValues {
  toolId: string;
  machineId: string;
  operationTypeId: string;
  materialId: string;
  machiningMode: MachiningMode | "";
  source: CuttingConditionSource | "";
  priority: string;
  vc: string;
  feed: string;
  ap: string;
  note: string;
}

/** Profily řezných podmínek nástroje na konkrétním stroji (Krok 5, zadání bod
 *  20/38) - pro dvojici (nástroj, stroj) může existovat víc profilů podle typu
 *  operace/materiálu/režimu (viz `resolveCuttingConditions`). Bez smazání -
 *  jen deaktivace (repository nemá `delete` use case v tomto kroku). */
export default function CuttingConditionsPage() {
  const deps = useMemo(() => createMasterDataDependencies(), []);
  const featureAccessSnapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);
  const canManage = featureAccessSnapshot ? satisfiesAccess(featureAccessSnapshot.access[FeatureCodes.CuttingConditionsManage], "write") : false;

  const [conditions, setConditions] = useState<ToolMachineCondition[] | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [operationTypes, setOperationTypes] = useState<OperationType[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MasterDataStatusFilter>("all");
  const [panel, setPanel] = useState<PanelMode>(null);

  const reload = useCallback(async () => {
    try {
      const tenantId = deps.tenantContext.requireCurrentTenantId();
      const [conditionList, toolList, machineList, opTypeList, materialList] = await Promise.all([
        deps.listToolMachineConditionsUseCase.execute(),
        deps.toolRepository.list(tenantId),
        deps.machineRepository.list(tenantId),
        deps.listOperationTypesUseCase.execute(),
        deps.listMaterialsUseCase.execute(),
      ]);
      setConditions(conditionList);
      setTools(toolList);
      setMachines(machineList);
      setOperationTypes(opTypeList);
      setMaterials(materialList);
    } catch (e) {
      setError(describeMasterDataError(e));
    }
  }, [deps]);

  useMasterDataReload(reload);

  const toolName = (id: string) => tools.find((t) => t.id === id)?.nazev ?? id;
  const machineName = (id: string) => machines.find((m) => m.id === id)?.name ?? id;
  const operationTypeName = (id: string | undefined) => (id ? operationTypes.find((o) => o.id === id)?.nazev : undefined);
  const materialName = (id: string | undefined) => (id ? materials.find((m) => m.id === id)?.name : undefined);

  const filtered = useMemo(() => {
    if (!conditions) return [];
    return conditions.filter((c) => {
      const active = c.stav === "aktivni";
      if (statusFilter === "active" && !active) return false;
      if (statusFilter === "inactive" && active) return false;
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return toolName(c.toolId).toLowerCase().includes(term) || machineName(c.machineId).toLowerCase().includes(term);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditions, search, statusFilter, tools, machines]);

  const handleSubmit = async (values: FormValues) => {
    const parameters = CuttingParameters.of({
      vc: values.vc ? Number(values.vc) : undefined,
      feed: values.feed ? Number(values.feed) : undefined,
      ap: values.ap ? Number(values.ap) : undefined,
    });
    if (panel?.kind === "create") {
      await deps.createToolMachineConditionUseCase.execute({
        toolId: values.toolId,
        machineId: values.machineId,
        parameters,
        operationTypeId: values.operationTypeId || undefined,
        materialId: values.materialId || undefined,
        machiningMode: values.machiningMode || undefined,
        priority: values.priority ? Number(values.priority) : undefined,
        source: values.source || undefined,
        note: values.note || undefined,
      });
    } else if (panel?.kind === "edit") {
      await deps.updateToolMachineConditionUseCase.execute(panel.condition.id, {
        parameters,
        operationTypeId: values.operationTypeId || undefined,
        materialId: values.materialId || undefined,
        machiningMode: values.machiningMode || undefined,
        priority: values.priority ? Number(values.priority) : undefined,
        source: values.source || undefined,
        note: values.note || undefined,
      });
    }
    setPanel(null);
    await reload();
  };

  const toggleStatus = async (condition: ToolMachineCondition) => {
    try {
      if (condition.stav === "aktivni") await deps.deactivateToolMachineConditionUseCase.execute(condition.id);
      await reload();
    } catch (e) {
      setError(describeMasterDataError(e));
    }
  };

  return (
    <FeatureGate
      snapshot={featureAccessSnapshot}
      feature={FeatureCodes.CuttingConditionsView}
      requiredAccess="read"
      loading={<div className="p-8 text-sm text-muted">Načítám oprávnění…</div>}
      fallback={
        <div className="p-8">
          <FeatureUnavailableNotice message="Vaše licence neumožňuje zobrazení řezných podmínek." />
        </div>
      }
    >
      <div className="flex min-h-screen flex-col">
        <div className="border-b border-border px-6 py-4">
          <h1 className="text-lg font-medium">Řezné podmínky</h1>
        </div>
        <MasterDataNav />
        <div className="mx-auto w-full max-w-5xl p-6">
          <MasterDataToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Hledat podle nástroje nebo stroje…"
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            addLabel="+ Nový profil"
            onAdd={canManage && tools.length > 0 && machines.length > 0 ? () => setPanel({ kind: "create" }) : undefined}
          />
          <div className="mb-4 flex justify-end">
            <ExportCsvButton
              filename="rezne-podminky.csv"
              headers={["tool", "machine", "operationType", "material", "vc", "feed", "ap", "priority", "stav"]}
              rows={(conditions ?? []).map((c) => [
                toolName(c.toolId),
                machineName(c.machineId),
                operationTypeName(c.operationTypeId) ?? "",
                materialName(c.materialId) ?? "",
                c.parameters.vc !== undefined ? String(c.parameters.vc) : "",
                c.parameters.feed !== undefined ? String(c.parameters.feed) : "",
                c.parameters.ap !== undefined ? String(c.parameters.ap) : "",
                c.priority !== undefined ? String(c.priority) : "",
                c.stav,
              ])}
            />
          </div>
          {canManage && (tools.length === 0 || machines.length === 0) && (
            <p className="mb-3 text-sm text-muted">Nejdřív založte alespoň jeden nástroj a jeden stroj.</p>
          )}

          {error && <p className="mb-3 text-sm text-danger">{error}</p>}
          {!conditions && !error && <p className="text-sm text-muted">Načítám…</p>}
          {conditions && filtered.length === 0 && <p className="text-sm text-muted">Žádný záznam neodpovídá filtru.</p>}

          {filtered.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2">Nástroj</th>
                  <th className="py-2 pr-2">Stroj</th>
                  <th className="py-2 pr-2">Typ operace</th>
                  <th className="py-2 pr-2">Materiál</th>
                  <th className="py-2 pr-2">Vc / f / ap</th>
                  <th className="py-2 pr-2">Priorita</th>
                  <th className="py-2 pr-2">Stav</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-surface-raised">
                    <td className="py-2 pr-2">{toolName(c.toolId)}</td>
                    <td className="py-2 pr-2">{machineName(c.machineId)}</td>
                    <td className="py-2 pr-2 text-muted">{operationTypeName(c.operationTypeId) ?? "—"}</td>
                    <td className="py-2 pr-2 text-muted">{materialName(c.materialId) ?? "—"}</td>
                    <td className="py-2 pr-2 tabular text-muted">
                      {c.parameters.vc ?? "—"} / {c.parameters.feed ?? "—"} / {c.parameters.ap ?? "—"}
                    </td>
                    <td className="py-2 pr-2 text-muted">{c.priority ?? "—"}</td>
                    <td className="py-2 pr-2">
                      <MasterDataStatusBadge active={c.stav === "aktivni"} />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2 text-xs">
                          <button onClick={() => setPanel({ kind: "edit", condition: c })} className="text-accent hover:underline">
                            Upravit
                          </button>
                          {c.stav === "aktivni" && (
                            <button onClick={() => void toggleStatus(c)} className="text-muted hover:underline">
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
          )}
        </div>
      </div>

      {panel && (
        <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/40" onClick={() => setPanel(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-sm font-medium">{panel.kind === "create" ? "Nový profil řezných podmínek" : "Úprava profilu"}</h2>
            <ConditionForm
              initial={
                panel.kind === "edit"
                  ? {
                      toolId: panel.condition.toolId,
                      machineId: panel.condition.machineId,
                      operationTypeId: panel.condition.operationTypeId ?? "",
                      materialId: panel.condition.materialId ?? "",
                      machiningMode: panel.condition.machiningMode ?? "",
                      source: panel.condition.source ?? "",
                      priority: panel.condition.priority !== undefined ? String(panel.condition.priority) : "",
                      vc: panel.condition.parameters.vc !== undefined ? String(panel.condition.parameters.vc) : "",
                      feed: panel.condition.parameters.feed !== undefined ? String(panel.condition.parameters.feed) : "",
                      ap: panel.condition.parameters.ap !== undefined ? String(panel.condition.parameters.ap) : "",
                      note: panel.condition.note ?? "",
                    }
                  : {
                      toolId: tools[0]?.id ?? "",
                      machineId: machines[0]?.id ?? "",
                      operationTypeId: "",
                      materialId: "",
                      machiningMode: "",
                      source: "",
                      priority: "",
                      vc: "",
                      feed: "",
                      ap: "",
                      note: "",
                    }
              }
              tools={tools}
              machines={machines}
              operationTypes={operationTypes}
              materials={materials}
              toolEditable={panel.kind === "create"}
              submitLabel={panel.kind === "create" ? "Založit" : "Uložit"}
              onCancel={() => setPanel(null)}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      )}
    </FeatureGate>
  );
}

function ConditionForm({
  initial,
  tools,
  machines,
  operationTypes,
  materials,
  toolEditable,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormValues;
  tools: Tool[];
  machines: Machine[];
  operationTypes: OperationType[];
  materials: Material[];
  toolEditable: boolean;
  submitLabel: string;
  onSubmit: (values: FormValues) => Promise<void>;
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

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-sm">
      {error && <p className="rounded border border-danger px-2 py-1 text-danger">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          Nástroj *
          <select
            required
            disabled={!toolEditable}
            value={values.toolId}
            onChange={(e) => setValues({ ...values, toolId: e.target.value })}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent disabled:opacity-60"
          >
            {tools.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nazev}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Stroj *
          <select
            required
            disabled={!toolEditable}
            value={values.machineId}
            onChange={(e) => setValues({ ...values, machineId: e.target.value })}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent disabled:opacity-60"
          >
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Typ operace
          <select
            value={values.operationTypeId}
            onChange={(e) => setValues({ ...values, operationTypeId: e.target.value })}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          >
            <option value="">—</option>
            {operationTypes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nazev}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Materiál
          <select
            value={values.materialId}
            onChange={(e) => setValues({ ...values, materialId: e.target.value })}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          >
            <option value="">—</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Režim
          <select
            value={values.machiningMode}
            onChange={(e) => setValues({ ...values, machiningMode: e.target.value as MachiningMode | "" })}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          >
            <option value="">—</option>
            {Object.entries(MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Zdroj
          <select
            value={values.source}
            onChange={(e) => setValues({ ...values, source: e.target.value as CuttingConditionSource | "" })}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          >
            <option value="">—</option>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Priorita
          <input
            type="number"
            min={0}
            value={values.priority}
            onChange={(e) => setValues({ ...values, priority: e.target.value })}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          />
        </label>
        <div />
        <label className="flex flex-col gap-1">
          Vc [m/min]
          <input
            type="number"
            min={0}
            value={values.vc}
            onChange={(e) => setValues({ ...values, vc: e.target.value })}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          Posuv f
          <input
            type="number"
            min={0}
            value={values.feed}
            onChange={(e) => setValues({ ...values, feed: e.target.value })}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          ap [mm]
          <input
            type="number"
            min={0}
            value={values.ap}
            onChange={(e) => setValues({ ...values, ap: e.target.value })}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        Poznámka
        <textarea
          value={values.note}
          onChange={(e) => setValues({ ...values, note: e.target.value })}
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

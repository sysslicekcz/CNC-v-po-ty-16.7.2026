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
import { Material } from "@/domain/entities/material";
import { MaterialGroup } from "@/domain/entities/material-group";

type PanelMode = { kind: "create" } | { kind: "edit"; material: Material } | null;

interface FormValues {
  code: string;
  name: string;
  materialGroupId: string;
  standard: string;
  designation: string;
  densityKgPerM3: string;
  hardness: string;
  note: string;
}

/** Materiálové skupiny a materiály (Krok 5, zadání bod 22) - minimální model,
 *  jen podklad pro `ToolMachineCondition.materialId`. Žádná rozsáhlá databáze
 *  materiálových norem (viz docs/audits/step-5-audit.md). */
export default function MaterialsPage() {
  const deps = useMemo(() => createMasterDataDependencies(), []);
  const featureAccessSnapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);
  const canManage = featureAccessSnapshot ? satisfiesAccess(featureAccessSnapshot.access[FeatureCodes.MaterialsManage], "write") : false;

  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [groups, setGroups] = useState<MaterialGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MasterDataStatusFilter>("all");
  const [panel, setPanel] = useState<PanelMode>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupCode, setNewGroupCode] = useState("");

  const reload = useCallback(async () => {
    try {
      const [materialList, groupList] = await Promise.all([deps.listMaterialsUseCase.execute(), deps.listMaterialGroupsUseCase.execute()]);
      setMaterials(materialList);
      setGroups(groupList);
    } catch (e) {
      setError(describeMasterDataError(e));
    }
  }, [deps]);

  useMasterDataReload(reload);

  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? id;

  const filtered = useMemo(() => {
    if (!materials) return [];
    const term = search.trim().toLowerCase();
    return materials.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (!term) return true;
      return m.code.toString().toLowerCase().includes(term) || m.name.toLowerCase().includes(term);
    });
  }, [materials, search, statusFilter]);

  const handleSubmit = async (values: FormValues) => {
    if (panel?.kind === "create") {
      await deps.createMaterialUseCase.execute({
        code: values.code,
        name: values.name,
        materialGroupId: values.materialGroupId,
        standard: values.standard || undefined,
        designation: values.designation || undefined,
        densityKgPerM3: values.densityKgPerM3 ? Number(values.densityKgPerM3) : undefined,
        hardness: values.hardness ? Number(values.hardness) : undefined,
        note: values.note || undefined,
      });
    } else if (panel?.kind === "edit") {
      await deps.updateMaterialUseCase.execute(panel.material.id, {
        name: values.name,
        materialGroupId: values.materialGroupId,
        standard: values.standard || undefined,
        designation: values.designation || undefined,
        densityKgPerM3: values.densityKgPerM3 ? Number(values.densityKgPerM3) : undefined,
        hardness: values.hardness ? Number(values.hardness) : undefined,
        note: values.note || undefined,
      });
    }
    setPanel(null);
    await reload();
  };

  const toggleStatus = async (material: Material) => {
    try {
      if (material.status === "active") await deps.deactivateMaterialUseCase.execute(material.id);
      await reload();
    } catch (e) {
      setError(describeMasterDataError(e));
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await deps.createMaterialGroupUseCase.execute({ code: newGroupCode, name: newGroupName });
      setNewGroupCode("");
      setNewGroupName("");
      await reload();
    } catch (e) {
      setError(describeMasterDataError(e));
    }
  };

  return (
    <FeatureGate
      snapshot={featureAccessSnapshot}
      feature={FeatureCodes.MaterialsView}
      requiredAccess="read"
      loading={<div className="p-8 text-sm text-muted">Načítám oprávnění…</div>}
      fallback={
        <div className="p-8">
          <FeatureUnavailableNotice message="Vaše licence neumožňuje zobrazení materiálů." />
        </div>
      }
    >
      <div className="flex min-h-screen flex-col">
        <div className="border-b border-border px-6 py-4">
          <h1 className="text-lg font-medium">Materiály</h1>
        </div>
        <MasterDataNav />
        <div className="mx-auto w-full max-w-4xl p-6">
          <div className="mb-6 rounded border border-border p-3">
            <h2 className="mb-2 text-xs uppercase tracking-wide text-muted">Materiálové skupiny</h2>
            <div className="mb-2 flex flex-wrap gap-2 text-sm">
              {groups.map((g) => (
                <span key={g.id} className="rounded border border-border px-2 py-1">
                  {g.name} <span className="text-muted">({g.code.toString()})</span>
                </span>
              ))}
              {groups.length === 0 && <span className="text-sm text-muted">Zatím žádné skupiny.</span>}
            </div>
            {canManage && (
              <form onSubmit={handleAddGroup} className="flex gap-2 text-sm">
                <input
                  required
                  placeholder="Kód"
                  value={newGroupCode}
                  onChange={(e) => setNewGroupCode(e.target.value)}
                  className="w-24 rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
                />
                <input
                  required
                  placeholder="Název skupiny"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="flex-1 rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
                />
                <button type="submit" className="rounded border border-accent px-3 py-1 text-accent hover:bg-accent/10">
                  + Přidat skupinu
                </button>
              </form>
            )}
          </div>

          <MasterDataToolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            addLabel="+ Nový materiál"
            onAdd={canManage && groups.length > 0 ? () => setPanel({ kind: "create" }) : undefined}
          />
          <div className="mb-4 flex justify-end">
            <ExportCsvButton
              filename="materialy.csv"
              headers={["code", "name", "group", "standard", "designation", "densityKgPerM3", "hardness", "status"]}
              rows={(materials ?? []).map((m) => [
                m.code.toString(),
                m.name,
                groupName(m.materialGroupId),
                m.standard ?? "",
                m.designation ?? "",
                m.densityKgPerM3 !== undefined ? String(m.densityKgPerM3) : "",
                m.hardness !== undefined ? String(m.hardness) : "",
                m.status,
              ])}
            />
          </div>
          {canManage && groups.length === 0 && <p className="mb-3 text-sm text-muted">Nejdřív založte materiálovou skupinu výše.</p>}

          {error && <p className="mb-3 text-sm text-danger">{error}</p>}
          {!materials && !error && <p className="text-sm text-muted">Načítám…</p>}
          {materials && filtered.length === 0 && <p className="text-sm text-muted">Žádný materiál neodpovídá filtru.</p>}

          {filtered.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2">Kód</th>
                  <th className="py-2 pr-2">Název</th>
                  <th className="py-2 pr-2">Skupina</th>
                  <th className="py-2 pr-2">Norma</th>
                  <th className="py-2 pr-2">Stav</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-b border-border/50 hover:bg-surface-raised">
                    <td className="py-2 pr-2">{m.code.toString()}</td>
                    <td className="py-2 pr-2">{m.name}</td>
                    <td className="py-2 pr-2 text-muted">{groupName(m.materialGroupId)}</td>
                    <td className="py-2 pr-2 text-muted">{m.standard ?? "—"}</td>
                    <td className="py-2 pr-2">
                      <MasterDataStatusBadge active={m.status === "active"} />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2 text-xs">
                          <button onClick={() => setPanel({ kind: "edit", material: m })} className="text-accent hover:underline">
                            Upravit
                          </button>
                          {m.status === "active" && (
                            <button onClick={() => void toggleStatus(m)} className="text-muted hover:underline">
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
          <div className="h-full w-full max-w-sm overflow-y-auto border-l border-border bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-sm font-medium">{panel.kind === "create" ? "Nový materiál" : `Úprava: ${panel.material.name}`}</h2>
            <MaterialForm
              initial={
                panel.kind === "edit"
                  ? {
                      code: panel.material.code.toString(),
                      name: panel.material.name,
                      materialGroupId: panel.material.materialGroupId,
                      standard: panel.material.standard ?? "",
                      designation: panel.material.designation ?? "",
                      densityKgPerM3: panel.material.densityKgPerM3 !== undefined ? String(panel.material.densityKgPerM3) : "",
                      hardness: panel.material.hardness !== undefined ? String(panel.material.hardness) : "",
                      note: panel.material.note ?? "",
                    }
                  : { code: "", name: "", materialGroupId: groups[0]?.id ?? "", standard: "", designation: "", densityKgPerM3: "", hardness: "", note: "" }
              }
              groups={groups}
              codeEditable={panel.kind === "create"}
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

function MaterialForm({
  initial,
  groups,
  codeEditable,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormValues;
  groups: MaterialGroup[];
  codeEditable: boolean;
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
      <label className="flex flex-col gap-1">
        Kód *
        <input
          required
          disabled={!codeEditable}
          value={values.code}
          onChange={(e) => setValues({ ...values, code: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent disabled:opacity-60"
        />
      </label>
      <label className="flex flex-col gap-1">
        Název *
        <input
          required
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        Skupina *
        <select
          required
          value={values.materialGroupId}
          onChange={(e) => setValues({ ...values, materialGroupId: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Norma
        <input
          value={values.standard}
          onChange={(e) => setValues({ ...values, standard: e.target.value })}
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
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          Hustota [kg/m³]
          <input
            type="number"
            min={0}
            value={values.densityKgPerM3}
            onChange={(e) => setValues({ ...values, densityKgPerM3: e.target.value })}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          Tvrdost
          <input
            type="number"
            min={0}
            value={values.hardness}
            onChange={(e) => setValues({ ...values, hardness: e.target.value })}
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

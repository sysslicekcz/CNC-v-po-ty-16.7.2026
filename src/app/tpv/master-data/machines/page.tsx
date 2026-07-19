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
import { ConfirmDialog } from "@/presentation/master-data/components/confirm-dialog";
import { MachineForm, MachineFormValues, machineToFormValues, EMPTY_MACHINE_FORM } from "@/presentation/master-data/components/machine-form";
import { ExportCsvButton } from "@/presentation/master-data/components/export-csv-button";
import { MachineCsvImportPanel, MACHINE_CSV_HEADERS } from "@/presentation/master-data/components/machine-csv-import-panel";
import { describeMasterDataError } from "@/presentation/master-data/master-data-error-messages";
import { Machine } from "@/domain/entities/machine";
import { CapacityGroup } from "@/domain/entities/capacity-group";
import { OperationType } from "@/domain/entities/operation-type";
import { MachineCapability } from "@/domain/entities/machine-capability";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";

type PanelMode = { kind: "create" } | { kind: "edit"; machine: Machine } | { kind: "import" } | null;
type PendingAction = { kind: "deactivate" | "reactivate" | "delete"; machine: Machine } | null;

/** Seznam a správa strojů (Krok 5, zadání bod 33-34) - nejpodrobněji
 *  specifikovaná entita: založení/úprava, přiřazení do skupiny kapacity,
 *  přiřazení schopností (typů operací), deaktivace/reaktivace, chráněné
 *  smazání. */
export default function MachinesPage() {
  const deps = useMemo(() => createMasterDataDependencies(), []);
  const featureAccessSnapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [capacityGroups, setCapacityGroups] = useState<CapacityGroup[]>([]);
  const [operationTypes, setOperationTypes] = useState<OperationType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MasterDataStatusFilter>("all");
  const [panel, setPanel] = useState<PanelMode>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [expandedMachineId, setExpandedMachineId] = useState<string | null>(null);

  const canManage = featureAccessSnapshot ? satisfiesAccess(featureAccessSnapshot.access[FeatureCodes.MachinesManage], "write") : false;

  const reload = useCallback(async () => {
    try {
      const [machineList, groupList, opTypeList] = await Promise.all([
        deps.listMachinesUseCase.execute(),
        deps.listCapacityGroupsUseCase.execute(),
        deps.listOperationTypesUseCase.execute(),
      ]);
      setMachines(machineList);
      setCapacityGroups(groupList);
      setOperationTypes(opTypeList);
    } catch (e) {
      setError(describeMasterDataError(e));
    }
  }, [deps]);

  useMasterDataReload(reload);

  const filtered = useMemo(() => {
    if (!machines) return [];
    const term = search.trim().toLowerCase();
    return machines.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (!term) return true;
      return m.code.toString().toLowerCase().includes(term) || m.name.toLowerCase().includes(term);
    });
  }, [machines, search, statusFilter]);

  const capacityGroupName = (id: string | undefined) => capacityGroups.find((g) => g.id === id)?.name;

  const handleCreate = async (values: MachineFormValues) => {
    const machine = await deps.createMachineUseCase.execute({
      code: values.code,
      name: values.name,
      designation: values.designation || undefined,
      maxRpm: values.maxRpm ? Number(values.maxRpm) : undefined,
      hourlyRate: HourlyRate.of(Number(values.hourlyRateAmount) || 0, values.hourlyRateCurrency || "CZK"),
      note: values.note || undefined,
    });
    // CreateMachineUseCase nepřijímá category/manufacturer/model/maxPowerKw
    // (jen základní pole při založení) - pokud je uživatel vyplnil rovnou,
    // dotáhnou se druhým voláním, ať formulář nemusí vyplňovat 2x.
    if (values.category || values.manufacturer || values.model || values.maxPowerKw) {
      await deps.updateMachineUseCase.execute(machine.id, {
        category: values.category || undefined,
        manufacturer: values.manufacturer || undefined,
        model: values.model || undefined,
        maxPowerKw: values.maxPowerKw ? Number(values.maxPowerKw) : undefined,
      });
    }
    setPanel(null);
    await reload();
  };

  const handleUpdate = async (machineId: string, values: MachineFormValues) => {
    await deps.updateMachineUseCase.execute(machineId, {
      code: values.code,
      name: values.name,
      designation: values.designation || undefined,
      category: values.category || undefined,
      manufacturer: values.manufacturer || undefined,
      model: values.model || undefined,
      maxRpm: values.maxRpm ? Number(values.maxRpm) : undefined,
      maxPowerKw: values.maxPowerKw ? Number(values.maxPowerKw) : undefined,
      hourlyRate: HourlyRate.of(Number(values.hourlyRateAmount) || 0, values.hourlyRateCurrency || "CZK"),
      note: values.note || undefined,
    });
    setPanel(null);
    await reload();
  };

  const handlePendingConfirm = async () => {
    if (!pendingAction) return;
    try {
      if (pendingAction.kind === "deactivate") await deps.deactivateMachineUseCase.execute(pendingAction.machine.id);
      if (pendingAction.kind === "reactivate") await deps.reactivateMachineUseCase.execute(pendingAction.machine.id);
      if (pendingAction.kind === "delete") await deps.deleteMachineUseCase.execute(pendingAction.machine.id);
      setPendingAction(null);
      await reload();
    } catch (e) {
      setError(describeMasterDataError(e));
      setPendingAction(null);
    }
  };

  return (
    <FeatureGate
      snapshot={featureAccessSnapshot}
      feature={FeatureCodes.MachinesView}
      requiredAccess="read"
      loading={<div className="p-8 text-sm text-muted">Načítám oprávnění…</div>}
      fallback={
        <div className="p-8">
          <FeatureUnavailableNotice message="Vaše licence neumožňuje zobrazení strojů." />
        </div>
      }
    >
      <div className="flex min-h-screen flex-col">
        <div className="border-b border-border px-6 py-4">
          <h1 className="text-lg font-medium">Stroje</h1>
        </div>
        <MasterDataNav />
        <div className="mx-auto w-full max-w-5xl p-6">
          <MasterDataToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Hledat podle kódu nebo názvu…"
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            addLabel="+ Nový stroj"
            onAdd={canManage ? () => setPanel({ kind: "create" }) : undefined}
          />
          <div className="mb-4 flex justify-end gap-2">
            {canManage && (
              <button onClick={() => setPanel({ kind: "import" })} className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-raised">
                Import CSV
              </button>
            )}
            <ExportCsvButton
              filename="stroje.csv"
              headers={MACHINE_CSV_HEADERS}
              rows={(machines ?? []).map((m) => [
                m.code.toString(),
                m.name,
                m.designation ?? "",
                m.category ?? "",
                m.manufacturer ?? "",
                m.model ?? "",
                m.maxRpm !== undefined ? String(m.maxRpm) : "",
                m.maxPowerKw !== undefined ? String(m.maxPowerKw) : "",
                String(m.hourlyRate.amount),
                m.hourlyRate.currency,
                m.note ?? "",
              ])}
            />
          </div>

          {error && <p className="mb-3 text-sm text-danger">{error}</p>}
          {!machines && !error && <p className="text-sm text-muted">Načítám…</p>}
          {machines && filtered.length === 0 && (
            <MasterDataEmptyState
              hasAnyItems={machines.length > 0}
              noItemsMessage="Zatím nejsou založeny žádné stroje. Stroje se přiřazují k operacím v technologickém postupu a mají vlastní hodinovou sazbu."
              noMatchMessage="Žádný stroj neodpovídá filtru."
              onAdd={canManage ? () => setPanel({ kind: "create" }) : undefined}
              addLabel="+ Nový stroj"
            />
          )}

          {filtered.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2">Kód</th>
                  <th className="py-2 pr-2">Název</th>
                  <th className="py-2 pr-2">Kategorie</th>
                  <th className="py-2 pr-2">Sazba</th>
                  <th className="py-2 pr-2">Skupina kapacity</th>
                  <th className="py-2 pr-2">Stav</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((machine) => (
                  <MachineRow
                    key={machine.id}
                    machine={machine}
                    capacityGroupName={capacityGroupName(machine.capacityGroupId)}
                    canManage={canManage}
                    expanded={expandedMachineId === machine.id}
                    onToggleExpand={() => setExpandedMachineId(expandedMachineId === machine.id ? null : machine.id)}
                    onEdit={() => setPanel({ kind: "edit", machine })}
                    onDeactivate={() => setPendingAction({ kind: "deactivate", machine })}
                    onReactivate={() => setPendingAction({ kind: "reactivate", machine })}
                    onDelete={() => setPendingAction({ kind: "delete", machine })}
                    deps={deps}
                    capacityGroups={capacityGroups}
                    operationTypes={operationTypes}
                    onChanged={reload}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {panel && panel.kind === "import" && (
        <MachineCsvImportPanel
          createMachineUseCase={deps.createMachineUseCase}
          onClose={() => setPanel(null)}
          onImported={reload}
        />
      )}

      {panel && (panel.kind === "create" || panel.kind === "edit") && (
        <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/40" onClick={() => setPanel(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-sm font-medium">{panel.kind === "create" ? "Nový stroj" : `Úprava: ${panel.machine.name}`}</h2>
            <MachineForm
              initial={panel.kind === "edit" ? machineToFormValues(panel.machine) : EMPTY_MACHINE_FORM}
              submitLabel={panel.kind === "create" ? "Založit" : "Uložit"}
              onCancel={() => setPanel(null)}
              onSubmit={(values) => (panel.kind === "create" ? handleCreate(values) : handleUpdate(panel.machine.id, values))}
            />
          </div>
        </div>
      )}

      {pendingAction && (
        <ConfirmDialog
          title={
            pendingAction.kind === "deactivate" ? "Deaktivovat stroj?" : pendingAction.kind === "reactivate" ? "Reaktivovat stroj?" : "Smazat stroj?"
          }
          message={
            pendingAction.kind === "delete"
              ? `Stroj "${pendingAction.machine.name}" bude trvale smazán. Pokud je používaný, smazání se odmítne - použijte deaktivaci.`
              : `Stroj "${pendingAction.machine.name}" bude ${pendingAction.kind === "deactivate" ? "deaktivován" : "znovu aktivován"}.`
          }
          confirmLabel={pendingAction.kind === "delete" ? "Smazat" : "Potvrdit"}
          danger={pendingAction.kind === "delete"}
          onConfirm={handlePendingConfirm}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </FeatureGate>
  );
}

interface MachineRowProps {
  machine: Machine;
  capacityGroupName: string | undefined;
  canManage: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onDelete: () => void;
  deps: ReturnType<typeof createMasterDataDependencies>;
  capacityGroups: CapacityGroup[];
  operationTypes: OperationType[];
  onChanged: () => Promise<void>;
}

function MachineRow({
  machine,
  capacityGroupName,
  canManage,
  expanded,
  onToggleExpand,
  onEdit,
  onDeactivate,
  onReactivate,
  onDelete,
  deps,
  capacityGroups,
  operationTypes,
  onChanged,
}: MachineRowProps) {
  return (
    <>
      <tr className="border-b border-border/50 hover:bg-surface-raised">
        <td className="cursor-pointer py-2 pr-2" onClick={onToggleExpand}>
          {machine.code.toString()}
        </td>
        <td className="cursor-pointer py-2 pr-2" onClick={onToggleExpand}>
          {machine.name}
        </td>
        <td className="py-2 pr-2 text-muted">{machine.category ?? "—"}</td>
        <td className="py-2 pr-2 tabular">
          {machine.hourlyRate.amount} {machine.hourlyRate.currency}
        </td>
        <td className="py-2 pr-2 text-muted">{capacityGroupName ?? "—"}</td>
        <td className="py-2 pr-2">
          <MasterDataStatusBadge active={machine.status === "active"} />
        </td>
        <td className="py-2 pr-2 text-right">
          {canManage && (
            <div className="flex justify-end gap-2 text-xs">
              <button onClick={onEdit} className="text-accent hover:underline">
                Upravit
              </button>
              {machine.status === "active" ? (
                <button onClick={onDeactivate} className="text-muted hover:underline">
                  Deaktivovat
                </button>
              ) : (
                <button onClick={onReactivate} className="text-ok hover:underline">
                  Reaktivovat
                </button>
              )}
              <button onClick={onDelete} className="text-danger hover:underline">
                Smazat
              </button>
            </div>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border/50">
          <td colSpan={7} className="bg-surface-raised/50 p-3">
            <MachineDetailPanel
              machine={machine}
              canManage={canManage}
              deps={deps}
              capacityGroups={capacityGroups}
              operationTypes={operationTypes}
              onChanged={onChanged}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function MachineDetailPanel({
  machine,
  canManage,
  deps,
  capacityGroups,
  operationTypes,
  onChanged,
}: {
  machine: Machine;
  canManage: boolean;
  deps: ReturnType<typeof createMasterDataDependencies>;
  capacityGroups: CapacityGroup[];
  operationTypes: OperationType[];
  onChanged: () => Promise<void>;
}) {
  const [capabilities, setCapabilities] = useState<MachineCapability[] | null>(null);
  const [newOperationTypeId, setNewOperationTypeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const loadCapabilities = useCallback(async () => {
    const tenantId = deps.tenantContext.requireCurrentTenantId();
    setCapabilities(await deps.machineCapabilityRepository.findByMachineId(machine.id, tenantId));
  }, [deps, machine.id]);

  useMasterDataReload(loadCapabilities);

  const handleAssignCapacityGroup = async (capacityGroupId: string) => {
    try {
      await deps.assignMachineToCapacityGroupUseCase.execute(machine.id, capacityGroupId || undefined);
      await onChanged();
    } catch (e) {
      setLocalError(describeMasterDataError(e));
    }
  };

  const handleAssignCapability = async () => {
    if (!newOperationTypeId) return;
    setBusy(true);
    try {
      await deps.assignMachineCapabilityUseCase.execute({ machineId: machine.id, operationTypeId: newOperationTypeId });
      setNewOperationTypeId("");
      await loadCapabilities();
    } catch (e) {
      setLocalError(describeMasterDataError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveCapability = async (id: string) => {
    setBusy(true);
    try {
      await deps.removeMachineCapabilityUseCase.execute(id);
      await loadCapabilities();
    } catch (e) {
      setLocalError(describeMasterDataError(e));
    } finally {
      setBusy(false);
    }
  };

  const operationTypeName = (id: string) => operationTypes.find((o) => o.id === id)?.nazev ?? id;

  return (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      {localError && <p className="text-danger sm:col-span-2">{localError}</p>}
      <div>
        <h3 className="mb-1 text-xs uppercase tracking-wide text-muted">Skupina kapacity</h3>
        <select
          disabled={!canManage}
          value={machine.capacityGroupId ?? ""}
          onChange={(e) => void handleAssignCapacityGroup(e.target.value)}
          className="w-full rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        >
          <option value="">— žádná —</option>
          {capacityGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        {machine.note && <p className="mt-3 whitespace-pre-wrap text-muted">{machine.note}</p>}
      </div>
      <div>
        <h3 className="mb-1 text-xs uppercase tracking-wide text-muted">Schopnosti (typy operací)</h3>
        {capabilities === null && <p className="text-muted">Načítám…</p>}
        {capabilities && capabilities.length === 0 && <p className="text-muted">Zatím žádné.</p>}
        <ul className="space-y-1">
          {capabilities?.map((c) => (
            <li key={c.id} className="flex items-center justify-between">
              <span>
                {operationTypeName(c.operationTypeId)}
                {!c.enabled && <span className="ml-1 text-muted">(vypnuto)</span>}
              </span>
              {canManage && (
                <button disabled={busy} onClick={() => void handleRemoveCapability(c.id)} className="text-xs text-danger hover:underline">
                  Odebrat
                </button>
              )}
            </li>
          ))}
        </ul>
        {canManage && (
          <div className="mt-2 flex gap-2">
            <select
              value={newOperationTypeId}
              onChange={(e) => setNewOperationTypeId(e.target.value)}
              className="flex-1 rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
            >
              <option value="">Vybrat typ operace…</option>
              {operationTypes
                .filter((o) => !capabilities?.some((c) => c.operationTypeId === o.id))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nazev}
                  </option>
                ))}
            </select>
            <button
              disabled={busy || !newOperationTypeId}
              onClick={() => void handleAssignCapability()}
              className="rounded border border-accent px-2 py-1 text-xs text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              Přidat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
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
import { OperationType, OperationCategory, OperationTypeResourceRequirement } from "@/domain/entities/operation-type";
import { OperationTypeCapabilityRequirement } from "@/domain/entities/operation-type-capability-requirement";
import { CapabilityType } from "@/domain/entities/capability-type";

const CATEGORY_LABELS: Record<OperationCategory, string> = {
  turning: "Soustružení",
  milling: "Frézování",
  grinding: "Broušení",
  cutting: "Řezání",
  inspection: "Kontrola",
  ndt: "NDT",
  preparation: "Příprava",
  other: "Jiné",
};

const RESOURCE_REQUIREMENT_LABELS: Record<OperationTypeResourceRequirement, string> = {
  machine: "Vyžaduje stroj",
  external: "Vyžaduje kooperaci",
  either: "Stroj nebo kooperace",
  none: "Žádný zdroj",
};

type PanelMode = { kind: "create" } | { kind: "edit"; operationType: OperationType } | null;

interface FormValues {
  kod: string;
  nazev: string;
  kategorie: OperationCategory;
  resourceRequirement: OperationTypeResourceRequirement;
  requiresSetupTime: boolean;
  requiresUnitTime: boolean;
  popis: string;
}

const EMPTY_FORM: FormValues = {
  kod: "",
  nazev: "",
  kategorie: "milling",
  resourceRequirement: "machine",
  requiresSetupTime: true,
  requiresUnitTime: true,
  popis: "",
};

/** Editovatelný číselník typů operací (Krok 5, zadání bod 12/27) - dřív jen
 *  seedovaný systémový číselník. Sekce vazeb na typy vlastností se rozbaluje
 *  po kliknutí na řádek (stejný vzor jako Stroje). */
export default function OperationTypesPage() {
  const deps = useMemo(() => createMasterDataDependencies(), []);
  const featureAccessSnapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);
  const canManage = featureAccessSnapshot ? satisfiesAccess(featureAccessSnapshot.access[FeatureCodes.OperationTypesManage], "write") : false;

  const [items, setItems] = useState<OperationType[] | null>(null);
  const [capabilityTypes, setCapabilityTypes] = useState<CapabilityType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MasterDataStatusFilter>("all");
  const [panel, setPanel] = useState<PanelMode>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [opTypes, capTypes] = await Promise.all([deps.listOperationTypesUseCase.execute(), deps.listCapabilityTypesUseCase.execute()]);
      setItems(opTypes);
      setCapabilityTypes(capTypes);
    } catch (e) {
      setError(describeMasterDataError(e));
    }
  }, [deps]);

  useMasterDataReload(reload);

  const filtered = useMemo(() => {
    if (!items) return [];
    const term = search.trim().toLowerCase();
    return items.filter((i) => {
      const active = i.stav === "aktivni";
      if (statusFilter === "active" && !active) return false;
      if (statusFilter === "inactive" && active) return false;
      if (!term) return true;
      return i.kod.toLowerCase().includes(term) || i.nazev.toLowerCase().includes(term);
    });
  }, [items, search, statusFilter]);

  const handleSubmit = async (values: FormValues) => {
    if (panel?.kind === "create") {
      await deps.createOperationTypeUseCase.execute(values);
    } else if (panel?.kind === "edit") {
      await deps.updateOperationTypeUseCase.execute(panel.operationType.id, values);
    }
    setPanel(null);
    await reload();
  };

  const toggleStatus = async (operationType: OperationType) => {
    try {
      if (operationType.stav === "aktivni") await deps.deactivateOperationTypeUseCase.execute(operationType.id);
      else await deps.reactivateOperationTypeUseCase.execute(operationType.id);
      await reload();
    } catch (e) {
      setError(describeMasterDataError(e));
    }
  };

  return (
    <FeatureGate
      snapshot={featureAccessSnapshot}
      feature={FeatureCodes.OperationTypesView}
      requiredAccess="read"
      loading={<div className="p-8 text-sm text-muted">Načítám oprávnění…</div>}
      fallback={
        <div className="p-8">
          <FeatureUnavailableNotice message="Vaše licence neumožňuje zobrazení typů operací." />
        </div>
      }
    >
      <div className="flex min-h-screen flex-col">
        <div className="border-b border-border px-6 py-4">
          <h1 className="text-lg font-medium">Typy operací</h1>
        </div>
        <MasterDataNav />
        <div className="mx-auto w-full max-w-5xl p-6">
          <MasterDataToolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            addLabel="+ Nový typ operace"
            onAdd={canManage ? () => setPanel({ kind: "create" }) : undefined}
          />
          <div className="mb-4 flex justify-end">
            <ExportCsvButton
              filename="typy-operaci.csv"
              headers={["kod", "nazev", "kategorie", "resourceRequirement", "requiresSetupTime", "requiresUnitTime", "popis", "stav"]}
              rows={(items ?? []).map((ot) => [
                ot.kod,
                ot.nazev,
                ot.kategorie,
                ot.resourceRequirement,
                String(ot.requiresSetupTime),
                String(ot.requiresUnitTime),
                ot.popis ?? "",
                ot.stav,
              ])}
            />
          </div>

          {error && <p className="mb-3 text-sm text-danger">{error}</p>}
          {!items && !error && <p className="text-sm text-muted">Načítám…</p>}
          {items && filtered.length === 0 && <p className="text-sm text-muted">Žádný záznam neodpovídá filtru.</p>}

          {filtered.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2">Kód</th>
                  <th className="py-2 pr-2">Název</th>
                  <th className="py-2 pr-2">Kategorie</th>
                  <th className="py-2 pr-2">Zdroj</th>
                  <th className="py-2 pr-2">Stav</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((ot) => (
                  <Fragment key={ot.id}>
                    <tr className="border-b border-border/50 hover:bg-surface-raised">
                      <td className="cursor-pointer py-2 pr-2" onClick={() => setExpandedId(expandedId === ot.id ? null : ot.id)}>
                        {ot.kod}
                      </td>
                      <td className="cursor-pointer py-2 pr-2" onClick={() => setExpandedId(expandedId === ot.id ? null : ot.id)}>
                        {ot.nazev}
                      </td>
                      <td className="py-2 pr-2 text-muted">{CATEGORY_LABELS[ot.kategorie]}</td>
                      <td className="py-2 pr-2 text-muted">{RESOURCE_REQUIREMENT_LABELS[ot.resourceRequirement]}</td>
                      <td className="py-2 pr-2">
                        <MasterDataStatusBadge active={ot.stav === "aktivni"} />
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {canManage && (
                          <div className="flex justify-end gap-2 text-xs">
                            <button onClick={() => setPanel({ kind: "edit", operationType: ot })} className="text-accent hover:underline">
                              Upravit
                            </button>
                            <button onClick={() => void toggleStatus(ot)} className="text-muted hover:underline">
                              {ot.stav === "aktivni" ? "Deaktivovat" : "Reaktivovat"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {expandedId === ot.id && (
                      <tr className="border-b border-border/50">
                        <td colSpan={6} className="bg-surface-raised/50 p-3">
                          <CapabilityRequirementsPanel operationType={ot} capabilityTypes={capabilityTypes} canManage={canManage} deps={deps} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {panel && (
        <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/40" onClick={() => setPanel(null)}>
          <div className="h-full w-full max-w-sm overflow-y-auto border-l border-border bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-sm font-medium">{panel.kind === "create" ? "Nový typ operace" : `Úprava: ${panel.operationType.nazev}`}</h2>
            <OperationTypeForm
              initial={
                panel.kind === "edit"
                  ? {
                      kod: panel.operationType.kod,
                      nazev: panel.operationType.nazev,
                      kategorie: panel.operationType.kategorie,
                      resourceRequirement: panel.operationType.resourceRequirement,
                      requiresSetupTime: panel.operationType.requiresSetupTime,
                      requiresUnitTime: panel.operationType.requiresUnitTime,
                      popis: panel.operationType.popis ?? "",
                    }
                  : EMPTY_FORM
              }
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

function OperationTypeForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormValues;
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
          value={values.kategorie}
          onChange={(e) => setValues({ ...values, kategorie: e.target.value as OperationCategory })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        >
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Vyžadovaný zdroj
        <select
          value={values.resourceRequirement}
          onChange={(e) => setValues({ ...values, resourceRequirement: e.target.value as OperationTypeResourceRequirement })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        >
          {Object.entries(RESOURCE_REQUIREMENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={values.requiresSetupTime}
          onChange={(e) => setValues({ ...values, requiresSetupTime: e.target.checked })}
        />
        Vyžaduje seřizovací čas
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={values.requiresUnitTime}
          onChange={(e) => setValues({ ...values, requiresUnitTime: e.target.checked })}
        />
        Vyžaduje kusový čas
      </label>
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

function CapabilityRequirementsPanel({
  operationType,
  capabilityTypes,
  canManage,
  deps,
}: {
  operationType: OperationType;
  capabilityTypes: CapabilityType[];
  canManage: boolean;
  deps: ReturnType<typeof createMasterDataDependencies>;
}) {
  const [requirements, setRequirements] = useState<OperationTypeCapabilityRequirement[] | null>(null);
  const [newCapabilityTypeId, setNewCapabilityTypeId] = useState("");
  const [newRequirement, setNewRequirement] = useState<"required" | "recommended">("required");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const tenantId = deps.tenantContext.requireCurrentTenantId();
    setRequirements(await deps.operationTypeCapabilityRequirementRepository.findByOperationTypeId(operationType.id, tenantId));
  }, [deps, operationType.id]);

  useMasterDataReload(load);

  const capabilityTypeName = (id: string) => capabilityTypes.find((c) => c.id === id)?.name ?? id;

  const handleAdd = async () => {
    if (!newCapabilityTypeId) return;
    setBusy(true);
    try {
      await deps.configureOperationTypeCapabilitiesUseCase.execute({
        operationTypeId: operationType.id,
        capabilityTypeId: newCapabilityTypeId,
        requirement: newRequirement,
      });
      setNewCapabilityTypeId("");
      await load();
    } catch (e) {
      setLocalError(describeMasterDataError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id: string) => {
    setBusy(true);
    try {
      await deps.removeOperationTypeCapabilityRequirementUseCase.execute(id);
      await load();
    } catch (e) {
      setLocalError(describeMasterDataError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-sm">
      <h3 className="mb-1 text-xs uppercase tracking-wide text-muted">Vyžadované/doporučené vlastnosti stroje</h3>
      {localError && <p className="text-danger">{localError}</p>}
      {requirements === null && <p className="text-muted">Načítám…</p>}
      {requirements && requirements.length === 0 && <p className="text-muted">Zatím žádné vazby.</p>}
      <ul className="space-y-1">
        {requirements?.map((r) => (
          <li key={r.id} className="flex items-center justify-between">
            <span>
              {capabilityTypeName(r.capabilityTypeId)} - {r.requirement === "required" ? "vyžadováno" : "doporučeno"}
              {r.expectedValue !== undefined && <span className="ml-1 text-muted">(očekáváno: {String(r.expectedValue)})</span>}
            </span>
            {canManage && (
              <button disabled={busy} onClick={() => void handleRemove(r.id)} className="text-xs text-danger hover:underline">
                Odebrat
              </button>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <div className="mt-2 flex gap-2">
          <select
            value={newCapabilityTypeId}
            onChange={(e) => setNewCapabilityTypeId(e.target.value)}
            className="flex-1 rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          >
            <option value="">Vybrat vlastnost…</option>
            {capabilityTypes
              .filter((c) => !requirements?.some((r) => r.capabilityTypeId === c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <select
            value={newRequirement}
            onChange={(e) => setNewRequirement(e.target.value as "required" | "recommended")}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          >
            <option value="required">Vyžadováno</option>
            <option value="recommended">Doporučeno</option>
          </select>
          <button
            disabled={busy || !newCapabilityTypeId}
            onClick={() => void handleAdd()}
            className="rounded border border-accent px-2 py-1 text-xs text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            Přidat
          </button>
        </div>
      )}
    </div>
  );
}

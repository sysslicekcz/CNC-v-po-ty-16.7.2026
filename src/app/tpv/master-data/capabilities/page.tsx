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
import { CapabilityType, CapabilityValueType } from "@/domain/entities/capability-type";

const VALUE_TYPE_LABELS: Record<CapabilityValueType, string> = {
  boolean: "Ano/Ne",
  number: "Číslo",
  text: "Text",
  selection: "Výběr z možností",
};

type PanelMode = { kind: "create" } | { kind: "edit"; capabilityType: CapabilityType } | null;

interface FormValues {
  code: string;
  name: string;
  valueType: CapabilityValueType;
  unit: string;
  allowedValues: string;
}

const EMPTY_FORM: FormValues = { code: "", name: "", valueType: "number", unit: "", allowedValues: "" };

/** Registr typů technických vlastností strojů (Krok 5, zadání bod 10-11) -
 *  NENÍ totéž jako `MachineCapability` (schopnost provádět typ operace, stránka
 *  Stroje) - viz docs/adr/machine-capabilities-use-explicit-types.md. Hodnoty
 *  na konkrétním stroji se přiřazují ze stránky Stroje. */
export default function CapabilityTypesPage() {
  const deps = useMemo(() => createMasterDataDependencies(), []);
  const featureAccessSnapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);
  const canManage = featureAccessSnapshot ? satisfiesAccess(featureAccessSnapshot.access[FeatureCodes.MachinesManage], "write") : false;

  const [items, setItems] = useState<CapabilityType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MasterDataStatusFilter>("all");
  const [panel, setPanel] = useState<PanelMode>(null);

  const reload = useCallback(async () => {
    try {
      setItems(await deps.listCapabilityTypesUseCase.execute());
    } catch (e) {
      setError(describeMasterDataError(e));
    }
  }, [deps]);

  useMasterDataReload(reload);

  const filtered = useMemo(() => {
    if (!items) return [];
    const term = search.trim().toLowerCase();
    return items.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (!term) return true;
      return i.code.toLowerCase().includes(term) || i.name.toLowerCase().includes(term);
    });
  }, [items, search, statusFilter]);

  const handleSubmit = async (values: FormValues) => {
    const allowedValues = values.allowedValues
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (panel?.kind === "create") {
      await deps.createCapabilityTypeUseCase.execute({
        code: values.code,
        name: values.name,
        valueType: values.valueType,
        unit: values.unit || undefined,
        allowedValues: values.valueType === "selection" ? allowedValues : undefined,
      });
    } else if (panel?.kind === "edit") {
      await deps.updateCapabilityTypeUseCase.execute(panel.capabilityType.id, {
        name: values.name,
        unit: values.unit || undefined,
        allowedValues: values.valueType === "selection" ? allowedValues : undefined,
      });
    }
    setPanel(null);
    await reload();
  };

  const toggleStatus = async (capabilityType: CapabilityType) => {
    try {
      await deps.updateCapabilityTypeUseCase.execute(capabilityType.id, {
        status: capabilityType.status === "active" ? "inactive" : "active",
      });
      await reload();
    } catch (e) {
      setError(describeMasterDataError(e));
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
          <FeatureUnavailableNotice message="Vaše licence neumožňuje zobrazení typů vlastností." />
        </div>
      }
    >
      <div className="flex min-h-screen flex-col">
        <div className="border-b border-border px-6 py-4">
          <h1 className="text-lg font-medium">Typy vlastností strojů</h1>
          <p className="text-sm text-muted">Technický registr vlastností (např. max. průměr soustružení, live tooling).</p>
        </div>
        <MasterDataNav />
        <div className="mx-auto w-full max-w-3xl p-6">
          <MasterDataToolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            addLabel="+ Nový typ vlastnosti"
            onAdd={canManage ? () => setPanel({ kind: "create" }) : undefined}
          />
          <div className="mb-4 flex justify-end">
            <ExportCsvButton
              filename="typy-vlastnosti.csv"
              headers={["code", "name", "valueType", "unit", "allowedValues", "status"]}
              rows={(items ?? []).map((c) => [c.code, c.name, c.valueType, c.unit ?? "", (c.allowedValues ?? []).join("|"), c.status])}
            />
          </div>

          {error && <p className="mb-3 text-sm text-danger">{error}</p>}
          {!items && !error && <p className="text-sm text-muted">Načítám…</p>}
          {items && filtered.length === 0 && (
            <MasterDataEmptyState
              hasAnyItems={items.length > 0}
              noItemsMessage="Zatím nejsou založeny žádné typy vlastností strojů. Vlastnosti (např. max. průměr, live tooling) se přiřazují strojům a typům operací."
              onAdd={canManage ? () => setPanel({ kind: "create" }) : undefined}
              addLabel="+ Nová vlastnost"
            />
          )}

          {filtered.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2">Kód</th>
                  <th className="py-2 pr-2">Název</th>
                  <th className="py-2 pr-2">Typ hodnoty</th>
                  <th className="py-2 pr-2">Jednotka</th>
                  <th className="py-2 pr-2">Stav</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-surface-raised">
                    <td className="py-2 pr-2">{c.code}</td>
                    <td className="py-2 pr-2">{c.name}</td>
                    <td className="py-2 pr-2 text-muted">{VALUE_TYPE_LABELS[c.valueType]}</td>
                    <td className="py-2 pr-2 text-muted">{c.unit ?? "—"}</td>
                    <td className="py-2 pr-2">
                      <MasterDataStatusBadge active={c.status === "active"} />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2 text-xs">
                          <button onClick={() => setPanel({ kind: "edit", capabilityType: c })} className="text-accent hover:underline">
                            Upravit
                          </button>
                          <button onClick={() => void toggleStatus(c)} className="text-muted hover:underline">
                            {c.status === "active" ? "Deaktivovat" : "Reaktivovat"}
                          </button>
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
            <h2 className="mb-3 text-sm font-medium">{panel.kind === "create" ? "Nový typ vlastnosti" : `Úprava: ${panel.capabilityType.name}`}</h2>
            <CapabilityTypeForm
              initial={
                panel.kind === "edit"
                  ? {
                      code: panel.capabilityType.code,
                      name: panel.capabilityType.name,
                      valueType: panel.capabilityType.valueType,
                      unit: panel.capabilityType.unit ?? "",
                      allowedValues: (panel.capabilityType.allowedValues ?? []).join(", "),
                    }
                  : EMPTY_FORM
              }
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

function CapabilityTypeForm({
  initial,
  codeEditable,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormValues;
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
        Typ hodnoty *
        <select
          disabled={!codeEditable}
          value={values.valueType}
          onChange={(e) => setValues({ ...values, valueType: e.target.value as CapabilityValueType })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent disabled:opacity-60"
        >
          {Object.entries(VALUE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Jednotka
        <input
          value={values.unit}
          onChange={(e) => setValues({ ...values, unit: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>
      {values.valueType === "selection" && (
        <label className="flex flex-col gap-1">
          Povolené hodnoty (oddělené čárkou) *
          <input
            required
            value={values.allowedValues}
            onChange={(e) => setValues({ ...values, allowedValues: e.target.value })}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          />
        </label>
      )}
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

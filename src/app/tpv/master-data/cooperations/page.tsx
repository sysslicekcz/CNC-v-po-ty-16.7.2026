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
import { ConfirmDialog } from "@/presentation/master-data/components/confirm-dialog";
import { describeMasterDataError } from "@/presentation/master-data/master-data-error-messages";
import { ExternalOperationResource } from "@/domain/entities/external-operation-resource";
import { Supplier } from "@/domain/entities/supplier";
import { Money } from "@/domain/value-objects/money";

type ResourcePanel = { kind: "create" } | { kind: "edit"; resource: ExternalOperationResource } | null;
type SupplierPanel = { kind: "create" } | { kind: "edit"; supplier: Supplier } | null;
type PendingAction = { kind: "deactivate" | "reactivate" | "delete"; resource: ExternalOperationResource } | null;

interface ResourceFormValues {
  code: string;
  name: string;
  supplierId: string;
  defaultLeadTimeDays: string;
  defaultCostAmount: string;
  note: string;
}

interface SupplierFormValues {
  code: string;
  name: string;
  registrationNumber: string;
  email: string;
  phone: string;
}

const EMPTY_RESOURCE_FORM: ResourceFormValues = { code: "", name: "", supplierId: "", defaultLeadTimeDays: "", defaultCostAmount: "", note: "" };
const EMPTY_SUPPLIER_FORM: SupplierFormValues = { code: "", name: "", registrationNumber: "", email: "", phone: "" };

/** Kooperace (externí zpracování) a jejich dodavatelé (Krok 5, zadání bod
 *  15-16) - kooperace NENÍ Machine (docs/adr/0018), dodavatel NENÍ Customer
 *  (samostatná entita, viz Supplier). Obě podsekce sdílejí jednu stránku,
 *  protože spolu úzce souvisí (`ExternalOperationResource.supplierId`). */
export default function CooperationsPage() {
  const deps = useMemo(() => createMasterDataDependencies(), []);
  const featureAccessSnapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);
  const canManage = featureAccessSnapshot ? satisfiesAccess(featureAccessSnapshot.access[FeatureCodes.CooperationsManage], "write") : false;

  const [resources, setResources] = useState<ExternalOperationResource[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MasterDataStatusFilter>("all");
  const [resourcePanel, setResourcePanel] = useState<ResourcePanel>(null);
  const [supplierPanel, setSupplierPanel] = useState<SupplierPanel>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [showSuppliers, setShowSuppliers] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [resourceList, supplierList] = await Promise.all([
        deps.listExternalOperationResourcesUseCase.execute(),
        deps.listSuppliersUseCase.execute(),
      ]);
      setResources(resourceList);
      setSuppliers(supplierList);
    } catch (e) {
      setError(describeMasterDataError(e));
    }
  }, [deps]);

  useMasterDataReload(reload);

  const filtered = useMemo(() => {
    if (!resources) return [];
    const term = search.trim().toLowerCase();
    return resources.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!term) return true;
      return r.code.toString().toLowerCase().includes(term) || r.name.toLowerCase().includes(term);
    });
  }, [resources, search, statusFilter]);

  const supplierName = (id: string | undefined) => suppliers.find((s) => s.id === id)?.name;

  const handleResourceSubmit = async (values: ResourceFormValues) => {
    const defaultCost = values.defaultCostAmount ? Money.of(Number(values.defaultCostAmount), "CZK") : undefined;
    if (resourcePanel?.kind === "create") {
      await deps.createExternalOperationResourceUseCase.execute({
        code: values.code,
        name: values.name,
        supplierId: values.supplierId || undefined,
        note: values.note || undefined,
      });
    } else if (resourcePanel?.kind === "edit") {
      await deps.updateExternalOperationResourceUseCase.execute(resourcePanel.resource.id, {
        code: values.code,
        name: values.name,
        supplierId: values.supplierId || undefined,
        defaultLeadTimeDays: values.defaultLeadTimeDays ? Number(values.defaultLeadTimeDays) : undefined,
        defaultCost,
        note: values.note || undefined,
      });
    }
    setResourcePanel(null);
    await reload();
  };

  const handleSupplierSubmit = async (values: SupplierFormValues) => {
    if (supplierPanel?.kind === "create") {
      await deps.createSupplierUseCase.execute({
        code: values.code || undefined,
        name: values.name,
        registrationNumber: values.registrationNumber || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
      });
    } else if (supplierPanel?.kind === "edit") {
      await deps.updateSupplierUseCase.execute(supplierPanel.supplier.id, {
        code: values.code || null,
        name: values.name,
        registrationNumber: values.registrationNumber || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
      });
    }
    setSupplierPanel(null);
    await reload();
  };

  const handlePendingConfirm = async () => {
    if (!pendingAction) return;
    try {
      if (pendingAction.kind === "deactivate") await deps.deactivateExternalOperationResourceUseCase.execute(pendingAction.resource.id);
      if (pendingAction.kind === "reactivate") await deps.reactivateExternalOperationResourceUseCase.execute(pendingAction.resource.id);
      if (pendingAction.kind === "delete") await deps.deleteExternalOperationResourceUseCase.execute(pendingAction.resource.id);
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
      feature={FeatureCodes.CooperationsView}
      requiredAccess="read"
      loading={<div className="p-8 text-sm text-muted">Načítám oprávnění…</div>}
      fallback={
        <div className="p-8">
          <FeatureUnavailableNotice message="Vaše licence neumožňuje zobrazení kooperací." />
        </div>
      }
    >
      <div className="flex min-h-screen flex-col">
        <div className="border-b border-border px-6 py-4">
          <h1 className="text-lg font-medium">Kooperace</h1>
        </div>
        <MasterDataNav />
        <div className="mx-auto w-full max-w-5xl p-6">
          <MasterDataToolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            addLabel="+ Nová kooperace"
            onAdd={canManage ? () => setResourcePanel({ kind: "create" }) : undefined}
          />
          <div className="mb-4 flex justify-end">
            <ExportCsvButton
              filename="kooperace.csv"
              headers={["code", "name", "supplier", "defaultLeadTimeDays", "defaultCostAmount", "note", "status"]}
              rows={(resources ?? []).map((r) => [
                r.code.toString(),
                r.name,
                supplierName(r.supplierId) ?? "",
                r.defaultLeadTimeDays !== undefined ? String(r.defaultLeadTimeDays) : "",
                r.defaultCost !== undefined ? String(r.defaultCost.amount) : "",
                r.note ?? "",
                r.status,
              ])}
            />
          </div>

          {error && <p className="mb-3 text-sm text-danger">{error}</p>}
          {!resources && !error && <p className="text-sm text-muted">Načítám…</p>}
          {resources && filtered.length === 0 && <p className="text-sm text-muted">Žádný záznam neodpovídá filtru.</p>}

          {filtered.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2">Kód</th>
                  <th className="py-2 pr-2">Název</th>
                  <th className="py-2 pr-2">Dodavatel</th>
                  <th className="py-2 pr-2">Dodací lhůta</th>
                  <th className="py-2 pr-2">Stav</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-surface-raised">
                    <td className="py-2 pr-2">{r.code.toString()}</td>
                    <td className="py-2 pr-2">{r.name}</td>
                    <td className="py-2 pr-2 text-muted">{supplierName(r.supplierId) ?? "—"}</td>
                    <td className="py-2 pr-2 text-muted">{r.defaultLeadTimeDays !== undefined ? `${r.defaultLeadTimeDays} dní` : "—"}</td>
                    <td className="py-2 pr-2">
                      <MasterDataStatusBadge active={r.status === "active"} />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2 text-xs">
                          <button onClick={() => setResourcePanel({ kind: "edit", resource: r })} className="text-accent hover:underline">
                            Upravit
                          </button>
                          {r.status === "active" ? (
                            <button onClick={() => setPendingAction({ kind: "deactivate", resource: r })} className="text-muted hover:underline">
                              Deaktivovat
                            </button>
                          ) : (
                            <button onClick={() => setPendingAction({ kind: "reactivate", resource: r })} className="text-ok hover:underline">
                              Reaktivovat
                            </button>
                          )}
                          <button onClick={() => setPendingAction({ kind: "delete", resource: r })} className="text-danger hover:underline">
                            Smazat
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
            <button onClick={() => setShowSuppliers((v) => !v)} className="text-sm text-accent hover:underline">
              {showSuppliers ? "Skrýt dodavatele" : `Zobrazit dodavatele (${suppliers.length})`}
            </button>
            {showSuppliers && (
              <div className="mt-3">
                <div className="mb-2 flex justify-end">
                  {canManage && (
                    <button
                      onClick={() => setSupplierPanel({ kind: "create" })}
                      className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
                    >
                      + Nový dodavatel
                    </button>
                  )}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 pr-2">Kód</th>
                      <th className="py-2 pr-2">Název</th>
                      <th className="py-2 pr-2">E-mail</th>
                      <th className="py-2 pr-2">Telefon</th>
                      <th className="py-2 pr-2">Stav</th>
                      <th className="py-2 pr-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s) => (
                      <tr key={s.id} className="border-b border-border/50 hover:bg-surface-raised">
                        <td className="py-2 pr-2">{s.code?.toString() ?? "—"}</td>
                        <td className="py-2 pr-2">{s.name}</td>
                        <td className="py-2 pr-2 text-muted">{s.email ?? "—"}</td>
                        <td className="py-2 pr-2 text-muted">{s.phone ?? "—"}</td>
                        <td className="py-2 pr-2">
                          <MasterDataStatusBadge active={s.status === "active"} />
                        </td>
                        <td className="py-2 pr-2 text-right">
                          {canManage && (
                            <div className="flex justify-end gap-2 text-xs">
                              <button onClick={() => setSupplierPanel({ kind: "edit", supplier: s })} className="text-accent hover:underline">
                                Upravit
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    if (s.status === "active") await deps.deactivateSupplierUseCase.execute(s.id);
                                    await reload();
                                  } catch (e) {
                                    setError(describeMasterDataError(e));
                                  }
                                }}
                                className="text-muted hover:underline"
                              >
                                {s.status === "active" ? "Deaktivovat" : "—"}
                              </button>
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

      {resourcePanel && (
        <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/40" onClick={() => setResourcePanel(null)}>
          <div className="h-full w-full max-w-sm overflow-y-auto border-l border-border bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-sm font-medium">{resourcePanel.kind === "create" ? "Nová kooperace" : `Úprava: ${resourcePanel.resource.name}`}</h2>
            <ResourceForm
              initial={
                resourcePanel.kind === "edit"
                  ? {
                      code: resourcePanel.resource.code.toString(),
                      name: resourcePanel.resource.name,
                      supplierId: resourcePanel.resource.supplierId ?? "",
                      defaultLeadTimeDays: resourcePanel.resource.defaultLeadTimeDays !== undefined ? String(resourcePanel.resource.defaultLeadTimeDays) : "",
                      defaultCostAmount: resourcePanel.resource.defaultCost !== undefined ? String(resourcePanel.resource.defaultCost.amount) : "",
                      note: resourcePanel.resource.note ?? "",
                    }
                  : EMPTY_RESOURCE_FORM
              }
              suppliers={suppliers}
              submitLabel={resourcePanel.kind === "create" ? "Založit" : "Uložit"}
              onCancel={() => setResourcePanel(null)}
              onSubmit={handleResourceSubmit}
            />
          </div>
        </div>
      )}

      {supplierPanel && (
        <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/40" onClick={() => setSupplierPanel(null)}>
          <div className="h-full w-full max-w-sm overflow-y-auto border-l border-border bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-sm font-medium">{supplierPanel.kind === "create" ? "Nový dodavatel" : `Úprava: ${supplierPanel.supplier.name}`}</h2>
            <SupplierForm
              initial={
                supplierPanel.kind === "edit"
                  ? {
                      code: supplierPanel.supplier.code?.toString() ?? "",
                      name: supplierPanel.supplier.name,
                      registrationNumber: supplierPanel.supplier.registrationNumber ?? "",
                      email: supplierPanel.supplier.email ?? "",
                      phone: supplierPanel.supplier.phone ?? "",
                    }
                  : EMPTY_SUPPLIER_FORM
              }
              submitLabel={supplierPanel.kind === "create" ? "Založit" : "Uložit"}
              onCancel={() => setSupplierPanel(null)}
              onSubmit={handleSupplierSubmit}
            />
          </div>
        </div>
      )}

      {pendingAction && (
        <ConfirmDialog
          title={
            pendingAction.kind === "deactivate" ? "Deaktivovat kooperaci?" : pendingAction.kind === "reactivate" ? "Reaktivovat kooperaci?" : "Smazat kooperaci?"
          }
          message={
            pendingAction.kind === "delete"
              ? `Kooperace "${pendingAction.resource.name}" bude trvale smazána. Pokud je používaná, smazání se odmítne.`
              : `Kooperace "${pendingAction.resource.name}" bude ${pendingAction.kind === "deactivate" ? "deaktivována" : "znovu aktivována"}.`
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

function ResourceForm({
  initial,
  suppliers,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ResourceFormValues;
  suppliers: Supplier[];
  submitLabel: string;
  onSubmit: (values: ResourceFormValues) => Promise<void>;
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
          value={values.code}
          onChange={(e) => setValues({ ...values, code: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
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
        Dodavatel
        <select
          value={values.supplierId}
          onChange={(e) => setValues({ ...values, supplierId: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        >
          <option value="">— žádný —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Dodací lhůta [dny]
        <input
          type="number"
          value={values.defaultLeadTimeDays}
          onChange={(e) => setValues({ ...values, defaultLeadTimeDays: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        Výchozí cena [CZK]
        <input
          type="number"
          min={0}
          value={values.defaultCostAmount}
          onChange={(e) => setValues({ ...values, defaultCostAmount: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>
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

function SupplierForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: SupplierFormValues;
  submitLabel: string;
  onSubmit: (values: SupplierFormValues) => Promise<void>;
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
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        IČO
        <input
          value={values.registrationNumber}
          onChange={(e) => setValues({ ...values, registrationNumber: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        E-mail
        <input
          type="email"
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1">
        Telefon
        <input
          value={values.phone}
          onChange={(e) => setValues({ ...values, phone: e.target.value })}
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

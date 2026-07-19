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
import { ConfirmDialog } from "@/presentation/master-data/components/confirm-dialog";
import { ExportCsvButton } from "@/presentation/master-data/components/export-csv-button";
import { describeMasterDataError } from "@/presentation/master-data/master-data-error-messages";
import { CapacityGroup } from "@/domain/entities/capacity-group";

type PanelMode = { kind: "create" } | { kind: "edit"; group: CapacityGroup } | null;
type PendingAction = { kind: "deactivate" | "reactivate" | "delete"; group: CapacityGroup } | null;

interface FormValues {
  code: string;
  name: string;
  note: string;
}

const EMPTY_FORM: FormValues = { code: "", name: "", note: "" };

/** Skupiny sdílené kapacity (Krok 5) - více strojů/podnikových kódů může
 *  odkazovat na stejnou skupinu (docs/adr/0017). Tahle stránka je jen správa
 *  samotných skupin; přiřazení stroje ke skupině se dělá na stránce Stroje. */
export default function CapacityGroupsPage() {
  const deps = useMemo(() => createMasterDataDependencies(), []);
  const featureAccessSnapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);
  const canManage = featureAccessSnapshot ? satisfiesAccess(featureAccessSnapshot.access[FeatureCodes.MachinesCapacityGroups], "write") : false;

  const [groups, setGroups] = useState<CapacityGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MasterDataStatusFilter>("all");
  const [panel, setPanel] = useState<PanelMode>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const reload = useCallback(async () => {
    try {
      setGroups(await deps.listCapacityGroupsUseCase.execute());
    } catch (e) {
      setError(describeMasterDataError(e));
    }
  }, [deps]);

  useMasterDataReload(reload);

  const filtered = useMemo(() => {
    if (!groups) return [];
    const term = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (!term) return true;
      return g.code.toString().toLowerCase().includes(term) || g.name.toLowerCase().includes(term);
    });
  }, [groups, search, statusFilter]);

  const handleSubmit = async (values: FormValues) => {
    if (panel?.kind === "create") {
      await deps.createCapacityGroupUseCase.execute({ code: values.code, name: values.name, note: values.note || undefined });
    } else if (panel?.kind === "edit") {
      await deps.updateCapacityGroupUseCase.execute(panel.group.id, {
        code: values.code,
        name: values.name,
        note: values.note || undefined,
      });
    }
    setPanel(null);
    await reload();
  };

  const handlePendingConfirm = async () => {
    if (!pendingAction) return;
    try {
      if (pendingAction.kind === "deactivate") await deps.deactivateCapacityGroupUseCase.execute(pendingAction.group.id);
      if (pendingAction.kind === "reactivate") await deps.reactivateCapacityGroupUseCase.execute(pendingAction.group.id);
      if (pendingAction.kind === "delete") await deps.deleteCapacityGroupUseCase.execute(pendingAction.group.id);
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
      feature={FeatureCodes.MachinesCapacityGroups}
      requiredAccess="read"
      loading={<div className="p-8 text-sm text-muted">Načítám oprávnění…</div>}
      fallback={
        <div className="p-8">
          <FeatureUnavailableNotice message="Vaše licence neumožňuje zobrazení skupin kapacity." />
        </div>
      }
    >
      <div className="flex min-h-screen flex-col">
        <div className="border-b border-border px-6 py-4">
          <h1 className="text-lg font-medium">Skupiny kapacity</h1>
        </div>
        <MasterDataNav />
        <div className="mx-auto w-full max-w-3xl p-6">
          <MasterDataToolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            addLabel="+ Nová skupina"
            onAdd={canManage ? () => setPanel({ kind: "create" }) : undefined}
          />
          <div className="mb-4 flex justify-end">
            <ExportCsvButton
              filename="skupiny-kapacity.csv"
              headers={["code", "name", "note", "status"]}
              rows={(groups ?? []).map((g) => [g.code.toString(), g.name, g.note ?? "", g.status])}
            />
          </div>

          {error && <p className="mb-3 text-sm text-danger">{error}</p>}
          {!groups && !error && <p className="text-sm text-muted">Načítám…</p>}
          {groups && filtered.length === 0 && <p className="text-sm text-muted">Žádná skupina neodpovídá filtru.</p>}

          {filtered.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2">Kód</th>
                  <th className="py-2 pr-2">Název</th>
                  <th className="py-2 pr-2">Stav</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id} className="border-b border-border/50 hover:bg-surface-raised">
                    <td className="py-2 pr-2">{g.code.toString()}</td>
                    <td className="py-2 pr-2">{g.name}</td>
                    <td className="py-2 pr-2">
                      <MasterDataStatusBadge active={g.status === "active"} />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2 text-xs">
                          <button onClick={() => setPanel({ kind: "edit", group: g })} className="text-accent hover:underline">
                            Upravit
                          </button>
                          {g.status === "active" ? (
                            <button onClick={() => setPendingAction({ kind: "deactivate", group: g })} className="text-muted hover:underline">
                              Deaktivovat
                            </button>
                          ) : (
                            <button onClick={() => setPendingAction({ kind: "reactivate", group: g })} className="text-ok hover:underline">
                              Reaktivovat
                            </button>
                          )}
                          <button onClick={() => setPendingAction({ kind: "delete", group: g })} className="text-danger hover:underline">
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
        </div>
      </div>

      {panel && (
        <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/40" onClick={() => setPanel(null)}>
          <div className="h-full w-full max-w-sm overflow-y-auto border-l border-border bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-sm font-medium">{panel.kind === "create" ? "Nová skupina kapacity" : `Úprava: ${panel.group.name}`}</h2>
            <CapacityGroupForm
              initial={panel.kind === "edit" ? { code: panel.group.code.toString(), name: panel.group.name, note: panel.group.note ?? "" } : EMPTY_FORM}
              submitLabel={panel.kind === "create" ? "Založit" : "Uložit"}
              onCancel={() => setPanel(null)}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      )}

      {pendingAction && (
        <ConfirmDialog
          title={
            pendingAction.kind === "deactivate" ? "Deaktivovat skupinu?" : pendingAction.kind === "reactivate" ? "Reaktivovat skupinu?" : "Smazat skupinu?"
          }
          message={
            pendingAction.kind === "delete"
              ? `Skupina "${pendingAction.group.name}" bude trvale smazána. Pokud je používaná (přiřazený stroj), smazání se odmítne.`
              : `Skupina "${pendingAction.group.name}" bude ${pendingAction.kind === "deactivate" ? "deaktivována" : "znovu aktivována"}.`
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

function CapacityGroupForm({
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

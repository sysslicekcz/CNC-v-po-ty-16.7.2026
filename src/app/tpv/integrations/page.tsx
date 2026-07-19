"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { createIntegrationDependencies } from "@/presentation/integrations/integration-dependencies";
import { useMasterDataReload } from "@/presentation/master-data/use-master-data-reload";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { FeatureGate } from "@/presentation/components/feature-gate";
import { FeatureUnavailableNotice } from "@/presentation/components/feature-unavailable-notice";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { satisfiesAccess } from "@/domain/licensing/feature-access";
import { MasterDataStatusBadge } from "@/presentation/master-data/components/master-data-status-badge";
import { MasterDataEmptyState } from "@/presentation/master-data/components/master-data-empty-state";
import { ConfirmDialog } from "@/presentation/master-data/components/confirm-dialog";
import { describeMasterDataError } from "@/presentation/master-data/master-data-error-messages";
import { ExternalSystem, ExternalSystemType } from "@/domain/integrations/external-system";

const TYPE_LABELS: Record<ExternalSystemType, string> = {
  erp: "ERP",
  mes: "MES",
  accounting: "Účetnictví",
  planning: "Plánování",
  file_exchange: "Výměna souborů",
  custom: "Vlastní",
};

type PanelMode = { kind: "create" } | null;
type PendingAction = { kind: "deactivate" | "reactivate"; system: ExternalSystem } | null;

interface FormValues {
  code: string;
  name: string;
  type: ExternalSystemType;
  connectorType: string;
}

const EMPTY_FORM: FormValues = { code: "", name: "", type: "erp", connectorType: "" };

/**
 * Přehled a správa připojených externích systémů (ERP, MES, účetnictví, …) -
 * Krok 6 (integrace/UX dotažení). Doménová vrstva (`ExternalSystem`,
 * `ErpConnectorRegistry`, licenční `integration.erp.*` funkce) existuje od
 * Kroku 3.5, ale žádná stránka ji dosud nepoužívala - appka byla ERP-neutrální
 * jen v architektuře, ne viditelně v UI. Appka nezná napevno žádný konkrétní
 * konektor (Helios je jen příklad `connectorType`, viz
 * docs/adr/erp-agnostic-integration-layer.md) - konkrétní napojení (skutečná
 * synchronizace dat) je mimo rozsah tohoto kroku, tahle stránka jen eviduje
 * "s jakým externím systémem appka komunikuje".
 */
export default function IntegrationsPage() {
  const deps = useMemo(() => createIntegrationDependencies(), []);
  const featureAccessSnapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);
  const canManage = featureAccessSnapshot
    ? satisfiesAccess(featureAccessSnapshot.access[FeatureCodes.IntegrationErpConfigure], "write")
    : false;

  const [systems, setSystems] = useState<ExternalSystem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelMode>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const reload = useCallback(async () => {
    try {
      setSystems(await deps.listExternalSystemsUseCase.execute());
    } catch (e) {
      setError(describeMasterDataError(e));
    }
  }, [deps]);

  useMasterDataReload(reload);

  const handleCreate = async (values: FormValues) => {
    await deps.createExternalSystemUseCase.execute({
      code: values.code,
      name: values.name,
      type: values.type,
      connectorType: values.connectorType,
    });
    setPanel(null);
    await reload();
  };

  const handlePendingConfirm = async () => {
    if (!pendingAction) return;
    try {
      if (pendingAction.kind === "deactivate") await deps.deactivateExternalSystemUseCase.execute(pendingAction.system.id);
      if (pendingAction.kind === "reactivate") await deps.reactivateExternalSystemUseCase.execute(pendingAction.system.id);
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
      feature={FeatureCodes.IntegrationErpView}
      requiredAccess="read"
      loading={<div className="p-8 text-sm text-muted">Načítám oprávnění…</div>}
      fallback={
        <div className="p-8">
          <FeatureUnavailableNotice message="Vaše licence neumožňuje zobrazení ERP integrací." />
        </div>
      }
    >
      <div className="flex min-h-screen flex-col">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-medium">Integrace ERP</h1>
              <p className="text-sm text-muted">Připojené externí systémy (ERP, MES, účetnictví, výměna souborů, …).</p>
            </div>
            <Link href="/tpv" className="text-sm text-muted hover:text-accent">
              ← Přehled
            </Link>
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl p-6">
          <div className="mb-4 flex justify-end">
            {canManage && (
              <button
                onClick={() => setPanel({ kind: "create" })}
                className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
              >
                + Nový externí systém
              </button>
            )}
          </div>

          {error && <p className="mb-3 text-sm text-danger">{error}</p>}
          {!systems && !error && <p className="text-sm text-muted">Načítám…</p>}
          {systems && systems.length === 0 && (
            <MasterDataEmptyState
              hasAnyItems={false}
              noItemsMessage="Zatím není připojen žádný externí systém. Appka je ERP-neutrální - konkrétní konektor (Helios, SAP, K2, vlastní REST API, …) se přidá jako záznam zde."
              onAdd={canManage ? () => setPanel({ kind: "create" }) : undefined}
              addLabel="+ Nový externí systém"
            />
          )}

          {systems && systems.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2">Kód</th>
                  <th className="py-2 pr-2">Název</th>
                  <th className="py-2 pr-2">Typ</th>
                  <th className="py-2 pr-2">Konektor</th>
                  <th className="py-2 pr-2">Stav</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {systems.map((s) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-surface-raised">
                    <td className="py-2 pr-2">{s.code}</td>
                    <td className="py-2 pr-2">{s.name}</td>
                    <td className="py-2 pr-2">{TYPE_LABELS[s.type]}</td>
                    <td className="py-2 pr-2 text-muted">{s.connectorType}</td>
                    <td className="py-2 pr-2">
                      <MasterDataStatusBadge active={s.status === "active"} />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2 text-xs">
                          {s.status === "active" ? (
                            <button onClick={() => setPendingAction({ kind: "deactivate", system: s })} className="text-muted hover:underline">
                              Deaktivovat
                            </button>
                          ) : (
                            <button onClick={() => setPendingAction({ kind: "reactivate", system: s })} className="text-ok hover:underline">
                              Reaktivovat
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
            <h2 className="mb-3 text-sm font-medium">Nový externí systém</h2>
            <ExternalSystemForm onCancel={() => setPanel(null)} onSubmit={handleCreate} />
          </div>
        </div>
      )}

      {pendingAction && (
        <ConfirmDialog
          title={pendingAction.kind === "deactivate" ? "Deaktivovat systém?" : "Reaktivovat systém?"}
          message={`Systém "${pendingAction.system.name}" bude ${pendingAction.kind === "deactivate" ? "deaktivován" : "znovu aktivován"}.`}
          confirmLabel="Potvrdit"
          onConfirm={handlePendingConfirm}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </FeatureGate>
  );
}

function ExternalSystemForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (values: FormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(describeMasterDataError(err));
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
        Typ systému
        <select
          value={values.type}
          onChange={(e) => setValues({ ...values, type: e.target.value as ExternalSystemType })}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        >
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Konektor *
        <input
          required
          value={values.connectorType}
          onChange={(e) => setValues({ ...values, connectorType: e.target.value })}
          placeholder="např. helios, sap, k2, custom-rest"
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded border border-border px-3 py-1.5 hover:bg-surface-raised">
          Zrušit
        </button>
        <button type="submit" disabled={submitting} className="rounded border border-accent px-3 py-1.5 text-accent hover:bg-accent/10 disabled:opacity-50">
          {submitting ? "Ukládám…" : "Založit"}
        </button>
      </div>
    </form>
  );
}

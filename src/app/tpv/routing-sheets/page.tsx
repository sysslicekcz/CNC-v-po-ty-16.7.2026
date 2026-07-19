"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createRoutingSheetEditorDependencies } from "@/presentation/routing-sheets/routing-sheet-editor-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { FeatureGate } from "@/presentation/components/feature-gate";
import { FeatureUnavailableNotice } from "@/presentation/components/feature-unavailable-notice";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { RoutingSheetListItemDto } from "@/application/routing-sheets/dto/routing-sheet-list-item-dto";
import { RoutingSheetStatusBadge } from "@/presentation/routing-sheets/components/status-indicators";
import { describeRoutingSheetError } from "@/presentation/routing-sheets/routing-sheet-error-messages";

type StatusFilter = "all" | "draft" | "released" | "archived";

/**
 * Seznam technologických postupů (Krok 4, zadání bod 34) - jednoduchý
 * přehled nad `ListRoutingSheetsUseCase`, filtrování stavu/hledání dělá
 * tahle stránka nad plnou sadou (žádný server-side filtr/stránkování -
 * odpovídá rozsahu "ne kapacitní/reportingový nástroj").
 */
export default function RoutingSheetsListPage() {
  const router = useRouter();
  const deps = useMemo(() => createRoutingSheetEditorDependencies(), []);
  const featureAccessSnapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [items, setItems] = useState<RoutingSheetListItemDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let cancelled = false;
    ensureAppBootstrapped()
      .then(() => deps.listRoutingSheetsUseCase.execute())
      .then((result) => {
        if (!cancelled) setItems(result);
      })
      .catch((e) => {
        if (!cancelled) setError(describeRoutingSheetError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [deps]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!term) return true;
      return item.drawingNumber.toLowerCase().includes(term) || item.partName.toLowerCase().includes(term);
    });
  }, [items, search, statusFilter]);

  return (
    <FeatureGate
      snapshot={featureAccessSnapshot}
      feature={FeatureCodes.RoutingView}
      requiredAccess="read"
      loading={<div className="p-8 text-sm text-muted">Načítám oprávnění…</div>}
      fallback={
        <div className="p-8">
          <FeatureUnavailableNotice message="Vaše licence neumožňuje zobrazení technologických postupů." />
        </div>
      }
    >
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-medium">Technologické postupy</h1>
          <button
            onClick={() => router.push("/tpv/routing-sheets/new")}
            className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
          >
            + Nový postup
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat podle čísla výkresu nebo názvu dílu…"
            className="w-full max-w-sm rounded border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
          >
            <option value="all">Všechny stavy</option>
            <option value="draft">Draft</option>
            <option value="released">Vydáno</option>
            <option value="archived">Archivováno</option>
          </select>
        </div>

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        {!items && !error && <p className="text-sm text-muted">Načítám…</p>}

        {items && filtered.length === 0 && (
          <p className="text-sm text-muted">
            {items.length === 0 ? "Zatím žádné technologické postupy." : "Žádný postup neodpovídá filtru."}
          </p>
        )}

        {filtered.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-2">Výkres</th>
                <th className="py-2 pr-2">Díl</th>
                <th className="py-2 pr-2">Revize</th>
                <th className="py-2 pr-2">Stav</th>
                <th className="py-2 pr-2">Operací</th>
                <th className="py-2 pr-2">Aktualizováno</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => router.push(`/tpv/routing-sheets/${item.id}`)}
                  className="cursor-pointer border-b border-border/50 hover:bg-surface-raised"
                >
                  <td className="py-2 pr-2">{item.drawingNumber || "—"}</td>
                  <td className="py-2 pr-2">{item.partName || "—"}</td>
                  <td className="py-2 pr-2">
                    {item.revision}
                    {item.isDefault && <span className="ml-1 text-xs text-muted">(výchozí)</span>}
                  </td>
                  <td className="py-2 pr-2">
                    <RoutingSheetStatusBadge status={item.status} />
                  </td>
                  <td className="py-2 pr-2">{item.operationCount}</td>
                  <td className="py-2 pr-2 text-muted">
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleString("cs-CZ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </FeatureGate>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createRoutingSheetEditorDependencies } from "@/presentation/routing-sheets/routing-sheet-editor-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { FeatureGate } from "@/presentation/components/feature-gate";
import { FeatureUnavailableNotice } from "@/presentation/components/feature-unavailable-notice";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { satisfiesAccess } from "@/domain/licensing/feature-access";
import { IndexedDbOrderRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-order-repository";
import { Part } from "@/domain/entities/part";
import { Order } from "@/domain/entities/order";
import { describeRoutingSheetError } from "@/presentation/routing-sheets/routing-sheet-error-messages";

/**
 * Založení nového technologického postupu (Krok 4, zadání bod 35) - výběr
 * dílu (Part), na kterém postup vznikne. Zobrazuje i číslo zakázky (Order) jen
 * jako kontext výběru, orderRepository se instancuje lokálně - není součástí
 * sdílených editor-dependencies (ty potřebuje jen samotný editor).
 */
export default function NewRoutingSheetPage() {
  const router = useRouter();
  const deps = useMemo(() => createRoutingSheetEditorDependencies(), []);
  const orderRepository = useMemo(() => new IndexedDbOrderRepository(), []);
  const featureAccessSnapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [parts, setParts] = useState<Part[] | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([deps.partRepository.findAll(), orderRepository.findAll()]).then(([p, o]) => {
      if (!cancelled) {
        setParts(p);
        setOrders(o);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [deps, orderRepository]);

  const ordersById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);

  const filteredParts = useMemo(() => {
    if (!parts) return [];
    const term = search.trim().toLowerCase();
    if (!term) return parts;
    return parts.filter((p) => {
      const order = ordersById.get(p.orderId);
      return (
        p.nazev.toLowerCase().includes(term) ||
        (p.cisloVykresu ?? "").toLowerCase().includes(term) ||
        (order?.cisloZakazky ?? "").toLowerCase().includes(term)
      );
    });
  }, [parts, search, ordersById]);

  const canEdit = featureAccessSnapshot ? satisfiesAccess(featureAccessSnapshot.access[FeatureCodes.RoutingEdit], "write") : false;

  const handleCreate = async () => {
    if (!selectedPartId) return;
    setBusy(true);
    setError(null);
    try {
      const routingSheet = await deps.createRoutingSheetUseCase.execute({
        partId: selectedPartId,
        name: name.trim() || undefined,
      });
      router.push(`/tpv/routing-sheets/${routingSheet.id}`);
    } catch (e) {
      setError(describeRoutingSheetError(e));
      setBusy(false);
    }
  };

  return (
    <FeatureGate
      snapshot={featureAccessSnapshot}
      feature={FeatureCodes.RoutingEdit}
      requiredAccess="write"
      loading={<div className="p-8 text-sm text-muted">Načítám oprávnění…</div>}
      fallback={
        <div className="p-8">
          <FeatureUnavailableNotice message="Vaše licence neumožňuje zakládat technologické postupy." />
        </div>
      }
    >
      <div className="mx-auto max-w-2xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => router.push("/tpv/routing-sheets")} className="text-sm text-muted hover:text-accent">
            ← Zpět
          </button>
          <h1 className="text-lg font-medium">Nový technologický postup</h1>
        </div>

        <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Díl</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hledat podle čísla výkresu, dílu nebo zakázky…"
          className="mb-2 w-full rounded border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
        />

        {!parts && <p className="text-sm text-muted">Načítám díly…</p>}
        {parts && filteredParts.length === 0 && <p className="text-sm text-muted">Žádný díl neodpovídá hledání.</p>}

        {filteredParts.length > 0 && (
          <ul className="mb-4 max-h-64 divide-y divide-border overflow-y-auto rounded border border-border">
            {filteredParts.map((part) => {
              const order = ordersById.get(part.orderId);
              const selected = part.id === selectedPartId;
              return (
                <li key={part.id}>
                  <button
                    onClick={() => setSelectedPartId(part.id)}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-surface-raised ${selected ? "bg-accent/10 text-accent" : ""}`}
                  >
                    <div className="font-medium">{part.cisloVykresu || part.nazev}</div>
                    <div className="text-xs text-muted">
                      {part.nazev}
                      {order ? ` · zakázka ${order.cisloZakazky}` : ""}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Název postupu (volitelné)</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ponechte prázdné pro výchozí název"
          className="mb-4 w-full rounded border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent"
        />

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={!selectedPartId || !canEdit || busy}
          className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Zakládám…" : "Založit postup"}
        </button>
      </div>
    </FeatureGate>
  );
}

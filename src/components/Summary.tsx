"use client";

import { OPERATIONS } from "@/lib/operations";
import { computeOperation, Row } from "@/lib/results";

function formatMin(v: number) {
  return v.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toHms(totalMin: number) {
  const totalSec = Math.round(totalMin * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Summary({ byId }: { byId: Record<string, Row[]> }) {
  const perOp = OPERATIONS.map((op) => ({ op, result: computeOperation(op.id, byId[op.id] ?? []) }));

  const opTotal = perOp
    .filter((p) => p.op.id !== "pripravneCasy")
    .reduce((sum, p) => sum + p.result.total, 0);
  const prepTotal = perOp.find((p) => p.op.id === "pripravneCasy")?.result.total ?? 0;
  const grandTotal = opTotal + prepTotal;

  const withData = perOp.filter((p) => p.result.rows.length > 0);

  return (
    <div className="space-y-6">
      {/* Signature: digital time-clock readout */}
      <div className="rounded-xl border border-accent-dim bg-surface p-6">
        <div className="mb-4 text-xs uppercase tracking-[0.2em] text-muted">Celkový výrobní čas</div>
        <div className="font-mono text-5xl font-semibold text-accent tabular sm:text-6xl">
          {toHms(grandTotal)}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4 text-sm">
          <div>
            <div className="text-muted">Operace</div>
            <div className="tabular text-lg">{formatMin(opTotal)} min</div>
          </div>
          <div>
            <div className="text-muted">Příprava</div>
            <div className="tabular text-lg">{formatMin(prepTotal)} min</div>
          </div>
          <div>
            <div className="text-muted">Celkem</div>
            <div className="tabular text-lg text-accent">{formatMin(grandTotal)} min</div>
          </div>
        </div>
      </div>

      {withData.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-muted">
          Zatím nejsou zadané žádné kontury. Vyplň data v některé ze záložek nahoře.
        </div>
      ) : (
        <div className="space-y-4">
          {withData.map(({ op, result }) => (
            <div key={op.id} className="rounded-lg border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <span className="text-sm font-medium">{op.title}</span>
                <span className="tabular text-sm text-accent">{formatMin(result.total)} min</span>
              </div>
              <ul className="divide-y divide-border/60">
                {result.rows.map((r, i) => (
                  <li key={i} className="flex items-center justify-between px-4 py-1.5 text-sm">
                    <span className="text-muted">
                      {r.label}
                      {r.kontura ? <span className="text-foreground"> · {r.kontura}</span> : null}
                    </span>
                    {r.cas === null ? (
                      <span className="tabular text-danger">{r.note}</span>
                    ) : (
                      <span className="tabular">{formatMin(r.cas)} min</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

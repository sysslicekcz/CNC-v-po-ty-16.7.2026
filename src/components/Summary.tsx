"use client";

import { OPERATIONS } from "@/lib/operations";
import { computeOperation, Row } from "@/lib/results";
import { formatPartLabel } from "@/lib/entities";

function formatMin(v: number) {
  return v.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatKc(v: number) {
  return v.toLocaleString("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 });
}

function toHms(totalMin: number) {
  const totalSec = Math.round(totalMin * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export interface SummaryPartInfo {
  customerNazev: string;
  inquiryNazev: string;
  partCisloVykresu: string;
  partNazev: string;
}

export default function Summary({
  byId,
  partInfo,
  sazba,
}: {
  byId: Record<string, Row[]>;
  partInfo?: SummaryPartInfo;
  /** Hodinová sazba stroje přiřazeného k této poloze (Kč/hod) - když je zadaná, dopočte se cena. */
  sazba?: number;
}) {
  const perOp = OPERATIONS.map((op) => ({ op, result: computeOperation(op.id, byId[op.id] ?? []) }));

  const opTotal = perOp
    .filter((p) => p.op.id !== "pripravneCasy")
    .reduce((sum, p) => sum + p.result.total, 0);
  const prepTotal = perOp.find((p) => p.op.id === "pripravneCasy")?.result.total ?? 0;
  const grandTotal = opTotal + prepTotal;
  const cena = sazba !== undefined ? (grandTotal / 60) * sazba : undefined;

  const withData = perOp.filter((p) => p.result.rows.length > 0);

  return (
    <div className="print-area space-y-6">
      <div className="flex justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-accent hover:text-accent"
        >
          Tisk / PDF
        </button>
      </div>
      {/* Signature: digital time-clock readout */}
      <div className="rounded-xl border border-accent-dim bg-surface p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.2em] text-muted">Celkový výrobní čas</div>
          {partInfo && (
            <div className="space-y-1 text-right text-sm">
              <div>
                <span className="text-xs text-muted">Zákazník: </span>
                <span className="text-foreground">{partInfo.customerNazev}</span>
              </div>
              <div>
                <span className="text-xs text-muted">Poptávka/Zakázka: </span>
                <span className="text-foreground">{partInfo.inquiryNazev}</span>
              </div>
              <div>
                <span className="text-xs text-muted">Díl: </span>
                <span className="text-foreground">
                  {formatPartLabel({ cisloVykresu: partInfo.partCisloVykresu, nazev: partInfo.partNazev })}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="font-mono text-5xl font-semibold text-accent tabular sm:text-6xl">
          {toHms(grandTotal)}
        </div>
        <div className={"mt-4 grid gap-4 border-t border-border pt-4 text-sm " + (cena !== undefined ? "grid-cols-4" : "grid-cols-3")}>
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
          {cena !== undefined && (
            <div>
              <div className="text-muted">Cena</div>
              <div className="tabular text-lg text-accent">{formatKc(cena)}</div>
            </div>
          )}
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

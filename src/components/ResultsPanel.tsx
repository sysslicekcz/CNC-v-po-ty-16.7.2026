"use client";

import { CalcOutput } from "@/lib/calc";

function formatMin(v: number) {
  return v.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ResultsPanel({ result }: { result: CalcOutput }) {
  if (result.rows.length === 0) return null;
  return (
    <div className="mt-4 rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-sm text-muted">
        <span>Výsledný čas obrábění</span>
        <span className="tabular text-accent">
          Σ {formatMin(result.total)} min
        </span>
      </div>
      <ul className="divide-y divide-border/60">
        {result.rows.map((r, i) => (
          <li key={i} className="flex items-center justify-between px-4 py-2 text-sm">
            <span className="text-muted">
              {r.label}
              {r.kontura ? <span className="text-foreground"> · {r.kontura}</span> : null}
            </span>
            {r.cas === null ? (
              <span className="tabular text-danger">{r.note ?? "neplatná data"}</span>
            ) : (
              <span className="tabular">{formatMin(r.cas)} min</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

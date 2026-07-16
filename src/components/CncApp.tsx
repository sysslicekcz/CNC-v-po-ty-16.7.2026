"use client";

import { useMemo, useState } from "react";
import { OPERATIONS } from "@/lib/operations";
import { computeOperation } from "@/lib/results";
import { useLocalRows } from "@/lib/useLocalRows";
import DataTable from "./DataTable";
import ResultsPanel from "./ResultsPanel";
import Summary from "./Summary";

function OperationTab({ id }: { id: string }) {
  const config = OPERATIONS.find((o) => o.id === id)!;
  const { rows, setRows, hydrated } = useLocalRows(id);
  const result = useMemo(() => computeOperation(id, rows), [id, rows]);

  if (!hydrated) return null;

  return (
    <div>
      <DataTable columns={config.columns} rows={rows} onChange={setRows} />
      <ResultsPanel result={result} />
    </div>
  );
}

export default function CncApp() {
  const [active, setActive] = useState<string>("summary");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-1 border-b border-border pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Dílenský výpočet časů
        </div>
        <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
          CNC Časovač
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Přepočet strojních časů z řezných podmínek — soustružení, vrtání, zápichy, frézování
          drážek a broušení. Data se ukládají v prohlížeči.
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-1.5 border-b border-border pb-4">
        <TabButton active={active === "summary"} onClick={() => setActive("summary")}>
          Výstupy
        </TabButton>
        {OPERATIONS.map((op) => (
          <TabButton key={op.id} active={active === op.id} onClick={() => setActive(op.id)}>
            {op.shortTitle}
          </TabButton>
        ))}
      </nav>

      <main>
        {active === "summary" ? (
          <Summary />
        ) : (
          <div>
            <h2 className="mb-3 text-lg font-medium">
              {OPERATIONS.find((o) => o.id === active)!.title}
            </h2>
            <OperationTab id={active} />
          </div>
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-md px-3 py-1.5 text-sm transition " +
        (active
          ? "bg-accent text-[#17130a] font-medium"
          : "text-muted hover:bg-surface-raised hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

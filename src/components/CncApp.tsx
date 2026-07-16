"use client";

import { useMemo, useState } from "react";
import { OPERATIONS, TOOL_OPERATIONS, getToolColumns } from "@/lib/operations";
import { computeOperation, Row } from "@/lib/results";
import { useAllRows } from "@/lib/useAllRows";
import { useAllTools } from "@/lib/useAllTools";
import { collectKonturaNames } from "@/lib/konturaNames";
import DataTable from "./DataTable";
import ResultsPanel from "./ResultsPanel";
import Summary from "./Summary";

function OperationTab({
  id,
  rows,
  setRows,
  konturaOptions,
  tools,
}: {
  id: string;
  rows: Row[];
  setRows: (rows: Row[]) => void;
  konturaOptions: string[];
  tools: Row[] | undefined;
}) {
  const config = OPERATIONS.find((o) => o.id === id)!;
  const result = useMemo(() => computeOperation(id, rows), [id, rows]);
  const toolColumns = tools ? getToolColumns(config) : undefined;

  return (
    <div>
      <DataTable
        title={config.title}
        columns={config.columns}
        rows={rows}
        onChange={setRows}
        konturaOptions={konturaOptions}
        tools={tools}
        toolColumns={toolColumns}
      />
      <ResultsPanel result={result} />
    </div>
  );
}

function ToolsTab({
  id,
  rows,
  setRows,
}: {
  id: string;
  rows: Row[];
  setRows: (rows: Row[]) => void;
}) {
  const config = TOOL_OPERATIONS.find((o) => o.id === id)!;
  const columns = getToolColumns(config);

  return (
    <DataTable
      title={`Nástroje — ${config.title}`}
      columns={columns}
      rows={rows}
      onChange={setRows}
      konturaOptions={[]}
      itemKind="nastroj"
    />
  );
}

export default function CncApp() {
  const [active, setActive] = useState<string>("summary");
  const [toolsActive, setToolsActive] = useState<string>(TOOL_OPERATIONS[0].id);
  const { hydrated, byId, setById } = useAllRows();
  const { hydrated: toolsHydrated, byId: toolsById, setById: setToolsById } = useAllTools();
  const konturaOptions = useMemo(() => collectKonturaNames(byId), [byId]);

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
        <TabButton active={active === "nastroje"} onClick={() => setActive("nastroje")}>
          Nástroje
        </TabButton>
      </nav>

      <main>
        {!hydrated || !toolsHydrated ? null : active === "summary" ? (
          <Summary byId={byId} />
        ) : active === "nastroje" ? (
          <div>
            <h2 className="mb-3 text-lg font-medium">Katalog nástrojů</h2>
            <p className="mb-4 max-w-2xl text-sm text-muted">
              Předdefinuj nástroje s jejich posuvy, řeznými rychlostmi a rozměry. Při zadávání
              kontury je pak půjde vybrat ze seznamu a příslušná pole se předvyplní.
            </p>
            <nav className="mb-4 flex flex-wrap gap-1.5">
              {TOOL_OPERATIONS.map((op) => (
                <TabButton
                  key={op.id}
                  active={toolsActive === op.id}
                  onClick={() => setToolsActive(op.id)}
                >
                  {op.shortTitle}
                </TabButton>
              ))}
            </nav>
            <ToolsTab id={toolsActive} rows={toolsById[toolsActive]} setRows={setToolsById[toolsActive]} />
          </div>
        ) : (
          <div>
            <h2 className="mb-3 text-lg font-medium">
              {OPERATIONS.find((o) => o.id === active)!.title}
            </h2>
            <OperationTab
              id={active}
              rows={byId[active]}
              setRows={setById[active]}
              konturaOptions={konturaOptions}
              tools={toolsById[active]}
            />
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

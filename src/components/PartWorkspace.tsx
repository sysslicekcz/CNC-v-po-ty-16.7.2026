"use client";

import { useMemo, useState } from "react";
import { OPERATIONS, getToolColumns } from "@/lib/operations";
import { computeOperation, Row } from "@/lib/results";
import { useAllPartRows } from "@/lib/usePartRows";
import { useAllTools } from "@/lib/useAllTools";
import { collectKonturaNames, nextKonturaNumber } from "@/lib/konturaNames";
import DataTable from "./DataTable";
import AddKonturaModal from "./AddKonturaModal";
import ResultsPanel from "./ResultsPanel";
import Summary from "./Summary";
import TabButton from "./TabButton";

function OperationTab({
  id,
  rows,
  setRows,
  konturaOptions,
  autoKonturaStart,
  tools,
}: {
  id: string;
  rows: Row[];
  setRows: (rows: Row[]) => void;
  konturaOptions: string[];
  autoKonturaStart: number;
  tools: Row[] | undefined;
}) {
  const [showModal, setShowModal] = useState(false);
  const config = OPERATIONS.find((o) => o.id === id)!;
  const result = useMemo(() => computeOperation(id, rows), [id, rows]);
  const toolColumns = tools ? getToolColumns(config) : undefined;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-medium">{config.title}</h3>
        <button
          onClick={() => setShowModal(true)}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-accent hover:text-accent"
        >
          + Přidat konturu
        </button>
      </div>
      <DataTable columns={config.columns} rows={rows} onChange={setRows} konturaOptions={konturaOptions} />
      <ResultsPanel result={result} />
      {showModal && (
        <AddKonturaModal
          title={config.title}
          columns={config.columns}
          prevRow={rows[rows.length - 1]}
          konturaOptions={konturaOptions}
          autoKonturaStart={autoKonturaStart}
          tools={tools}
          toolColumns={toolColumns}
          onClose={() => setShowModal(false)}
          onSubmit={(row) => setRows([...rows, row])}
        />
      )}
    </div>
  );
}

export default function PartWorkspace({ partId }: { partId: string }) {
  const [active, setActive] = useState<string>("summary");
  const { hydrated, byId, setById } = useAllPartRows(partId);
  const { hydrated: toolsHydrated, byId: toolsById } = useAllTools();
  const konturaOptions = useMemo(() => collectKonturaNames(byId), [byId]);
  const autoKontura = useMemo(() => nextKonturaNumber(byId), [byId]);

  return (
    <div>
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

      {!hydrated || !toolsHydrated ? null : active === "summary" ? (
        <Summary byId={byId} />
      ) : (
        <OperationTab
          id={active}
          rows={byId[active]}
          setRows={setById[active]}
          konturaOptions={konturaOptions}
          autoKonturaStart={autoKontura}
          tools={toolsById[active]}
        />
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { OPERATIONS, getToolColumns } from "@/lib/operations";
import { computeOperation, Row } from "@/lib/results";
import { useAllPartRows } from "@/lib/usePartRows";
import { useAllTools } from "@/lib/useAllTools";
import { collectKonturaNames, nextKonturaNumber } from "@/lib/konturaNames";
import { Machine } from "@/lib/entities";
import DataTable from "./DataTable";
import AddKonturaModal from "./AddKonturaModal";
import ResultsPanel from "./ResultsPanel";
import Summary, { SummaryPartInfo } from "./Summary";
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

// partId parametr useAllPartRows dostává od volajícího (CncApp PartRouter) id
// POLOHY, ne id dílu - partOperationRows jsou uložené per poloha (viz entities.ts
// ensureDefaultPosition, kde výchozí poloha schválně sdílí id s dílem).
export default function PartWorkspace({
  positionId,
  partInfo,
  machines,
  strojId,
  onSetStroj,
}: {
  positionId: string;
  partInfo: SummaryPartInfo;
  machines: Machine[];
  strojId: string | undefined;
  onSetStroj: (strojId: string | undefined) => void;
}) {
  const [active, setActive] = useState<string>("summary");
  const { hydrated, byId, setById } = useAllPartRows(positionId);
  const { hydrated: toolsHydrated, byId: toolsById } = useAllTools();
  const konturaOptions = useMemo(() => collectKonturaNames(byId), [byId]);
  const autoKontura = useMemo(() => nextKonturaNumber(byId), [byId]);
  const sazba = machines.find((m) => m.id === strojId)?.sazba;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <label className="text-muted">Stroj:</label>
        {machines.length === 0 ? (
          <span className="text-muted">
            zatím žádné - založ je v záložce{" "}
            <span className="text-foreground">Stroje</span>
          </span>
        ) : (
          <select
            value={strojId ?? ""}
            onChange={(e) => onSetStroj(e.target.value || undefined)}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          >
            <option value="">— bez stroje —</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nazev}
              </option>
            ))}
          </select>
        )}
      </div>

      <nav className="mb-4 flex flex-wrap gap-1.5 border-b border-border pb-3">
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
        <Summary byId={byId} partInfo={partInfo} sazba={sazba} />
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

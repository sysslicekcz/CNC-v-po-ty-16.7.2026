"use client";

import { useMemo, useState } from "react";
import { OPERATIONS, filterOperationsForMachine, getToolColumns } from "@/lib/operations";
import { computeOperation, Row } from "@/lib/results";
import { useAllPartRows } from "@/lib/usePartRows";
import { useAllTools } from "@/lib/useAllTools";
import { useUndoableRows } from "@/lib/useUndoableRows";
import { actionButtonClass } from "@/lib/actionButtonClass";
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
  const { onChange, clearAll, undo, canUndo } = useUndoableRows(rows, setRows);

  return (
    <div>
      <h3 className="mb-3 text-base font-medium">{config.title}</h3>
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => setShowModal(true)} className={actionButtonClass()}>
          + Přidat konturu
        </button>
        <button onClick={undo} disabled={!canUndo} className={actionButtonClass(!canUndo)}>
          Krok zpět
        </button>
        <button onClick={clearAll} disabled={rows.length === 0} className={actionButtonClass(rows.length === 0)}>
          Smazat všechny kontury
        </button>
      </div>
      <DataTable columns={config.columns} rows={rows} onChange={onChange} konturaOptions={konturaOptions} />
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
          onSubmit={(row) => onChange([...rows, row])}
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
  onAddPosition,
}: {
  positionId: string;
  partInfo: SummaryPartInfo;
  machines: Machine[];
  strojId: string | undefined;
  onSetStroj: (strojId: string | undefined) => void;
  /** Díl má jedinou polohu - na Výstupech (vedle Tisk/PDF) se nabídne rychlé
   *  přidání druhé. U víc poloh appka místo toho ukazuje výběr polohy (viz PartRouter). */
  onAddPosition?: () => void;
}) {
  const [active, setActive] = useState<string>("summary");
  const { hydrated, byId, setById } = useAllPartRows(positionId);
  const machine = machines.find((m) => m.id === strojId);
  const { hydrated: toolsHydrated, byId: toolsById } = useAllTools(strojId);
  const konturaOptions = useMemo(() => collectKonturaNames(byId), [byId]);
  const autoKontura = useMemo(() => nextKonturaNumber(byId), [byId]);
  const sazba = machine?.sazba;
  const visibleOps = useMemo(() => filterOperationsForMachine(OPERATIONS, machine?.operace), [machine]);
  // Když se přiřazený stroj změní a naposledy zvolená operace pro něj zmizí z
  // nabídky (stroj ji neumí), odvodí se rovnou náhradní "Výstupy" - žádný extra
  // efekt/setState není potřeba, je to čistě odvozená hodnota z "active" + "visibleOps".
  const effectiveActive = active === "summary" || visibleOps.some((op) => op.id === active) ? active : "summary";

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
        <TabButton active={effectiveActive === "summary"} onClick={() => setActive("summary")}>
          Výstupy
        </TabButton>
        {visibleOps.map((op) => (
          <TabButton key={op.id} active={effectiveActive === op.id} onClick={() => setActive(op.id)}>
            {op.shortTitle}
          </TabButton>
        ))}
      </nav>

      {!hydrated || !toolsHydrated ? null : effectiveActive === "summary" ? (
        <Summary byId={byId} partInfo={partInfo} sazba={sazba} onAddPosition={onAddPosition} />
      ) : (
        <OperationTab
          key={effectiveActive}
          id={effectiveActive}
          rows={byId[effectiveActive]}
          setRows={setById[effectiveActive]}
          konturaOptions={konturaOptions}
          autoKonturaStart={autoKontura}
          tools={toolsById[effectiveActive]}
        />
      )}
    </div>
  );
}

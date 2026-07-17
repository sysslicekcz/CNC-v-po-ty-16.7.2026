"use client";

import { useState } from "react";
import { Row } from "./results";

/** Obalí "rows"/"setRows" (z useAllPartRows nebo useAllTools) o jednu úroveň historie:
 *  kdykoli se řádků ubude - ať už smazáním jednoho v DataTable, nebo přes clearAll -
 *  uloží se stav před tím, a "Krok zpět" ho vrátí. Žádné redo, jen poslední krok.
 *  Volající musí komponentu remountovat (např. přes key) při přepnutí na jinou
 *  operaci/nástroj, ať si "Krok zpět" neponechá stav z předchozí tabulky. */
export function useUndoableRows(rows: Row[], setRows: (rows: Row[]) => void) {
  const [snapshot, setSnapshot] = useState<Row[] | null>(null);

  const onChange = (next: Row[]) => {
    if (next.length < rows.length) setSnapshot(rows);
    setRows(next);
  };

  const clearAll = () => {
    if (rows.length === 0) return;
    if (!window.confirm(`Smazat všech ${rows.length} řádků? Půjde to vrátit tlačítkem „Krok zpět“.`)) return;
    onChange([]);
  };

  const undo = () => {
    if (!snapshot) return;
    setRows(snapshot);
    setSnapshot(null);
  };

  return { onChange, clearAll, undo, canUndo: snapshot !== null };
}

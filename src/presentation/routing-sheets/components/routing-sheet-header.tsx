"use client";

import { useState } from "react";
import { RoutingSheetEditorDto } from "@/application/routing-sheets/dto/routing-sheet-editor-dto";
import { RoutingSheetStatusBadge, SaveStatusIndicator } from "./status-indicators";
import { SaveStatus } from "../use-routing-sheet-editor";

export interface RoutingSheetHeaderProps {
  routingSheet: RoutingSheetEditorDto;
  saveStatus: SaveStatus;
  saveError?: string;
  readOnly: boolean;
  canRelease: boolean;
  onBack: () => void;
  onUpdateHeader: (input: { name?: string; description?: string }) => void;
  onSave: () => void;
  onRequestRelease: () => void;
  onRequestNewRevision: () => void;
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function RoutingSheetHeader({
  routingSheet,
  saveStatus,
  saveError,
  readOnly,
  canRelease,
  onBack,
  onUpdateHeader,
  onSave,
  onRequestRelease,
  onRequestNewRevision,
}: RoutingSheetHeaderProps) {
  const [name, setName] = useState(routingSheet.name);
  const [description, setDescription] = useState(routingSheet.description);

  return (
    <header className="border-b border-border bg-surface">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2">
        <button onClick={onBack} className="rounded border border-border px-2 py-1 text-sm hover:border-accent">
          ← Zpět
        </button>
        <div className="text-sm">
          <span className="font-mono text-muted">{routingSheet.partNumber || "bez čísla výkresu"}</span>
          <span className="mx-2 text-muted">·</span>
          <span>{routingSheet.partName}</span>
        </div>
        <span className="text-sm text-muted">Revize {routingSheet.revision}</span>
        <RoutingSheetStatusBadge status={routingSheet.status} />
        <div className="ml-auto flex items-center gap-3">
          <SaveStatusIndicator status={saveStatus} lastSavedAt={routingSheet.updatedAt} errorMessage={saveError} />
          {!readOnly && (
            <button onClick={onSave} className="rounded border border-border px-3 py-1 text-sm hover:border-accent" title="Ctrl/Cmd + S">
              Uložit
            </button>
          )}
          {routingSheet.status === "draft" && canRelease && (
            <button
              onClick={onRequestRelease}
              className="rounded border border-ok px-3 py-1 text-sm text-ok hover:bg-ok/10"
            >
              Vydat
            </button>
          )}
          {routingSheet.status === "released" && (
            <button
              onClick={onRequestNewRevision}
              className="rounded border border-accent px-3 py-1 text-sm text-accent hover:bg-accent/10"
            >
              Vytvořit novou revizi
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-border px-4 py-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Název postupu</label>
          {readOnly ? (
            <div className="text-sm">{routingSheet.name}</div>
          ) : (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name !== routingSheet.name && onUpdateHeader({ name })}
              className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent"
            />
          )}
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs uppercase tracking-wide text-muted">Popis</label>
          {readOnly ? (
            <div className="text-sm text-muted">{routingSheet.description || "-"}</div>
          ) : (
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== routingSheet.description && onUpdateHeader({ description })}
              className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-accent"
            />
          )}
        </div>
        <div className="text-xs text-muted">
          <div>Poslední uložení: {formatDateTime(routingSheet.updatedAt)}</div>
          <div>Vydáno: {formatDateTime(routingSheet.releasedAt)}</div>
          {routingSheet.sourceRoutingSheetId && <div>Vzniklo kopií existující revize</div>}
        </div>
      </div>
    </header>
  );
}

"use client";

import { RoutingSheetStav } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { SaveStatus } from "../use-routing-sheet-editor";

const STATUS_LABELS: Record<RoutingSheetStav, string> = {
  draft: "Draft",
  released: "Vydáno",
  archived: "Archivováno",
};

const STATUS_CLASSES: Record<RoutingSheetStav, string> = {
  draft: "border-accent-dim text-accent",
  released: "border-ok text-ok",
  archived: "border-border text-muted",
};

export function RoutingSheetStatusBadge({ status }: { status: RoutingSheetStav }) {
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  idle: "",
  saving: "Ukládám…",
  saved: "Uloženo",
  unsaved: "Neuložené změny",
  error: "Uložení se nezdařilo",
};

export function SaveStatusIndicator({
  status,
  lastSavedAt,
  errorMessage,
}: {
  status: SaveStatus;
  lastSavedAt?: string;
  errorMessage?: string;
}) {
  const label = SAVE_STATUS_LABELS[status];
  if (!label) return null;

  const colorClass = status === "error" ? "text-danger" : status === "unsaved" ? "text-accent" : "text-muted";

  return (
    <div className={`flex items-center gap-2 text-xs ${colorClass}`} role="status" aria-live="polite">
      <span>{label}</span>
      {status === "saved" && lastSavedAt && (
        <span className="text-muted">
          {new Date(lastSavedAt).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
      {status === "error" && errorMessage && <span>- {errorMessage}</span>}
    </div>
  );
}

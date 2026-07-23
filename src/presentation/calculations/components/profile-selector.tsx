"use client";

import { useState } from "react";

export interface ProfileOption {
  id: string;
  label: string;
  isArchived: boolean;
}

const inputClass = "w-full rounded border border-border bg-surface px-2 py-1 text-sm focus:border-accent focus:outline-none";
const labelClass = "mb-1 block text-xs text-muted";

/**
 * `ProfileSelect` (AP-MCE-001 Fáze H §10 "MaterialProfileSelector/Machine
 * ProfileSelector/ToolProfileSelector - search/filter") - jeden generický
 * vyhledatelný výběrník nad `ProfileOption[]` (id + popisek + archivace),
 * který `NewCalculationWizard` naplní přes `List*ProfilesUseCase`. Archivované
 * profily jsou ve výchozím stavu SCHOVANÉ (přepínač je odkryje) - výběrník
 * nesmí nabízet archivovaný profil jako rovnocennou volbu bez upozornění.
 */
export function ProfileSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  options: ProfileOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [filter, setFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const filtered = options.filter((o) => (showArchived || !o.isArchived) && o.label.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <span className={labelClass}>{label}</span>
      <input className={`${inputClass} mb-1`} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={placeholder ?? "Hledat…"} />
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {filtered.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
            {o.isArchived ? " (archivováno)" : ""}
          </option>
        ))}
      </select>
      <label className="mt-1 flex items-center gap-1.5 text-xs text-muted">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Zobrazit i archivované
      </label>
    </div>
  );
}

export function MaterialProfileSelector(props: { options: ProfileOption[]; value: string; onChange: (id: string) => void }) {
  return <ProfileSelect label="Materiál" {...props} />;
}

export function MachineProfileSelector(props: { options: ProfileOption[]; value: string; onChange: (id: string) => void }) {
  return <ProfileSelect label="Stroj" {...props} />;
}

export function ToolProfileSelector(props: { options: ProfileOption[]; value: string; onChange: (id: string) => void }) {
  return <ProfileSelect label="Nástroj/kotouč (výchozí)" {...props} />;
}

/** Zaškrtávací výběr VÍCE profilů najednou (AP-MCE-001 Fáze H §15/§16
 *  "Porovnání strojů/nástrojů") - záměrně checkbox seznam, ne `<select
 *  multiple>` (klávesnicově přístupnější, §30). */
export function ProfileMultiSelect({
  label,
  options,
  selectedIds,
  onChange,
}: {
  label: string;
  options: ProfileOption[];
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
}) {
  const [filter, setFilter] = useState("");
  const filtered = options.filter((o) => !o.isArchived && o.label.toLowerCase().includes(filter.toLowerCase()));

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]);
  }

  return (
    <div>
      <span className={labelClass}>{label}</span>
      <input className={`${inputClass} mb-2`} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Hledat…" />
      <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-border p-2">
        {filtered.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selectedIds.includes(o.id)} onChange={() => toggle(o.id)} />
            {o.label}
          </label>
        ))}
        {filtered.length === 0 && <p className="text-xs text-muted">Žádné profily neodpovídají hledání.</p>}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Machine, MachineCategory } from "@/domain/entities/machine";

const CATEGORY_LABELS: Record<MachineCategory, string> = {
  lathe: "Soustruh",
  milling: "Frézka",
  turn_mill: "Soustružnicko-frézovací centrum",
  grinding: "Bruska",
  drilling: "Vrtačka",
  saw: "Pila",
  inspection: "Měření/kontrola",
  assembly: "Montáž",
  other: "Jiné",
};

export interface MachineFormValues {
  code: string;
  name: string;
  designation: string;
  category: MachineCategory | "";
  manufacturer: string;
  model: string;
  maxRpm: string;
  maxPowerKw: string;
  hourlyRateAmount: string;
  hourlyRateCurrency: string;
  note: string;
}

export function machineToFormValues(machine: Machine): MachineFormValues {
  return {
    code: machine.code.toString(),
    name: machine.name,
    designation: machine.designation ?? "",
    category: machine.category ?? "",
    manufacturer: machine.manufacturer ?? "",
    model: machine.model ?? "",
    maxRpm: machine.maxRpm !== undefined ? String(machine.maxRpm) : "",
    maxPowerKw: machine.maxPowerKw !== undefined ? String(machine.maxPowerKw) : "",
    hourlyRateAmount: String(machine.hourlyRate.amount),
    hourlyRateCurrency: machine.hourlyRate.currency,
    note: machine.note ?? "",
  };
}

export const EMPTY_MACHINE_FORM: MachineFormValues = {
  code: "",
  name: "",
  designation: "",
  category: "",
  manufacturer: "",
  model: "",
  maxRpm: "",
  maxPowerKw: "",
  hourlyRateAmount: "0",
  hourlyRateCurrency: "CZK",
  note: "",
};

export interface MachineFormProps {
  initial: MachineFormValues;
  submitLabel: string;
  onSubmit: (values: MachineFormValues) => Promise<void>;
  onCancel: () => void;
}

/** Formulář pro založení/úpravu stroje (Krok 5, zadání bod 33-34) - stejná
 *  komponenta pro create i update, rozdíl jen v `initial`/`submitLabel`. Číselné
 *  vstupy se drží jako string (kvůli prázdnému políčku), parsují se až při odeslání. */
export function MachineForm({ initial, submitLabel, onSubmit, onCancel }: MachineFormProps) {
  const [values, setValues] = useState<MachineFormValues>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof MachineFormValues>(key: K, value: MachineFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-sm">
      {error && <p className="rounded border border-danger px-2 py-1 text-danger">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          Kód *
          <input
            required
            value={values.code}
            onChange={(e) => set("code", e.target.value)}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          Název *
          <input
            required
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          Označení
          <input
            value={values.designation}
            onChange={(e) => set("designation", e.target.value)}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          Kategorie
          <select
            value={values.category}
            onChange={(e) => set("category", e.target.value as MachineCategory | "")}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          >
            <option value="">—</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Výrobce
          <input
            value={values.manufacturer}
            onChange={(e) => set("manufacturer", e.target.value)}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          Model
          <input
            value={values.model}
            onChange={(e) => set("model", e.target.value)}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          Max. otáčky [ot/min]
          <input
            type="number"
            value={values.maxRpm}
            onChange={(e) => set("maxRpm", e.target.value)}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          Max. výkon [kW]
          <input
            type="number"
            value={values.maxPowerKw}
            onChange={(e) => set("maxPowerKw", e.target.value)}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          Hodinová sazba *
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={values.hourlyRateAmount}
            onChange={(e) => set("hourlyRateAmount", e.target.value)}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          Měna
          <input
            value={values.hourlyRateCurrency}
            onChange={(e) => set("hourlyRateCurrency", e.target.value)}
            className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        Poznámka
        <textarea
          value={values.note}
          onChange={(e) => set("note", e.target.value)}
          rows={2}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded border border-border px-3 py-1.5 hover:bg-surface-raised">
          Zrušit
        </button>
        <button type="submit" disabled={submitting} className="rounded border border-accent px-3 py-1.5 text-accent hover:bg-accent/10 disabled:opacity-50">
          {submitting ? "Ukládám…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

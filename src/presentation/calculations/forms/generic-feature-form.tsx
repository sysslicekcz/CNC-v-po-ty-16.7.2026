"use client";

import { GenericCalculationDraft, GenericFeatureDraft, StrategyFormSchema, newFeatureDraft, duplicateFeatureDraft } from "./form-field-types";
import { fieldKey } from "./generic-field-parsing";
import { ProfileOption, MaterialProfileSelector, MachineProfileSelector, ToolProfileSelector } from "../components/profile-selector";

const inputClass = "w-full rounded border border-border bg-surface px-2 py-1 text-sm focus:border-accent focus:outline-none";
const labelClass = "mb-1 block text-xs text-muted";

function TextInput({ label, value, onChange, unit }: { label: string; value: string; onChange: (v: string) => void; unit?: string }) {
  return (
    <label className="block">
      <span className={labelClass}>
        {label} {unit && <span className="text-muted">[{unit}]</span>}
      </span>
      <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function NumberInput({ label, value, onChange, unit }: { label: string; value: string; onChange: (v: string) => void; unit?: string }) {
  return (
    <label className="block">
      <span className={labelClass}>
        {label} {unit && <span className="text-muted">[{unit}]</span>}
      </span>
      <input type="number" className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function CheckboxInput({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 pt-5 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function SelectInput({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * `GenericFeatureForm` (AP-MCE-001 Fáze H §5) - JEDNA komponenta pro VŠECH
 * šest registrovaných formulářů (§5 "Nevytvářej jeden obří formulář s
 * podmínkami pro všechny strategie" - tahle komponenta žádnou podmínku podle
 * KATEGORIE nemá, jen vykresluje `StrategyFormSchema`, který jí dodá
 * `CalculationFormRegistry`). Pracuje nad prostým UI stavem
 * (`GenericCalculationDraft` - `Record<string,string|boolean>`), NIKDY nad
 * doménovou entitou (§5 "Doménové entity nepoužívej jako mutable form
 * state").
 */
export function GenericFeatureForm({
  schema,
  draft,
  onChange,
  materialOptions,
  machineOptions,
  toolOptions,
}: {
  schema: StrategyFormSchema;
  draft: GenericCalculationDraft;
  onChange: (next: GenericCalculationDraft) => void;
  /** Nabídka `MaterialProfileSelector`/`MachineProfileSelector`/`ToolProfile
   *  Selector` (AP-MCE-001 Fáze H §10) - `undefined` (např. dokud se profily
   *  nenačtou) přepne odpovídající pole zpátky na prosté textové zadání ID. */
  materialOptions?: ProfileOption[];
  machineOptions?: ProfileOption[];
  toolOptions?: ProfileOption[];
}) {
  const updateOperationField = (key: string, value: string | boolean) => {
    onChange({ ...draft, operationFields: { ...draft.operationFields, [fieldKey("feature", key)]: value } });
  };

  const addFeature = () => {
    const subtype = schema.subtypeOptions[0]?.value ?? "";
    onChange({ ...draft, features: [...draft.features, newFeatureDraft(subtype, draft.features.length)] });
  };

  const updateFeature = (index: number, next: GenericFeatureDraft) => {
    const features = [...draft.features];
    features[index] = next;
    onChange({ ...draft, features });
  };

  const removeFeature = (index: number) => {
    onChange({ ...draft, features: draft.features.filter((_, i) => i !== index) });
  };

  const duplicateFeature = (index: number) => {
    const copy = duplicateFeatureDraft(draft.features[index]);
    const features = [...draft.features];
    features.splice(index + 1, 0, copy);
    onChange({ ...draft, features });
  };

  const moveFeature = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.features.length) return;
    const features = [...draft.features];
    [features[index], features[target]] = [features[target], features[index]];
    onChange({ ...draft, features });
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-medium text-muted">Společné vstupy</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <TextInput label="Typ operace (id)" value={draft.operationTypeId} onChange={(v) => onChange({ ...draft, operationTypeId: v })} />
          <NumberInput label="Množství (ks)" value={draft.quantity} onChange={(v) => onChange({ ...draft, quantity: v })} />
          {materialOptions ? (
            <MaterialProfileSelector options={materialOptions} value={draft.materialId} onChange={(v) => onChange({ ...draft, materialId: v })} />
          ) : (
            <TextInput label="Materiál (id)" value={draft.materialId} onChange={(v) => onChange({ ...draft, materialId: v })} />
          )}
          {machineOptions ? (
            <MachineProfileSelector options={machineOptions} value={draft.machineId} onChange={(v) => onChange({ ...draft, machineId: v })} />
          ) : (
            <TextInput label="Stroj (id)" value={draft.machineId} onChange={(v) => onChange({ ...draft, machineId: v })} />
          )}
          {toolOptions ? (
            <ToolProfileSelector options={toolOptions} value={draft.toolId} onChange={(v) => onChange({ ...draft, toolId: v })} />
          ) : (
            <TextInput label="Nástroj/kotouč (id, výchozí)" value={draft.toolId} onChange={(v) => onChange({ ...draft, toolId: v })} />
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-muted">Parametry operace</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {schema.operationFields.map((f) => {
            const key = fieldKey(f.group, f.key);
            const value = draft.operationFields[key];
            if (f.type === "checkbox") {
              return <CheckboxInput key={key} label={f.label} checked={Boolean(value)} onChange={(v) => updateOperationField(f.key, v)} />;
            }
            if (f.type === "select" && f.options) {
              return <SelectInput key={key} label={f.label} value={typeof value === "string" ? value : ""} onChange={(v) => updateOperationField(f.key, v)} options={f.options} />;
            }
            if (f.type === "number") {
              return <NumberInput key={key} label={f.label} value={typeof value === "string" ? value : ""} onChange={(v) => updateOperationField(f.key, v)} unit={f.unit} />;
            }
            return <TextInput key={key} label={f.label} value={typeof value === "string" ? value : ""} onChange={(v) => updateOperationField(f.key, v)} unit={f.unit} />;
          })}
        </div>
      </section>

      {schema.featuresOptional && (
        <section>
          <h3 className="mb-2 text-sm font-medium text-muted">Bez technologických úseků (jednoduchý čas)</h3>
          <NumberInput label="Základní jednotkový čas" value={draft.baseUnitTimeMin ?? ""} onChange={(v) => onChange({ ...draft, baseUnitTimeMin: v })} unit="min" />
          <p className="mt-1 text-xs text-muted">Vyplňte, pokud operace nemá žádné technologické úseky níž - jinak se použije rozpad podle úseků.</p>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted">Technologické úseky ({draft.features.length})</h3>
          <button onClick={addFeature} className="rounded border border-accent px-2 py-1 text-xs text-accent hover:bg-accent/10">
            + Přidat úsek
          </button>
        </div>

        <div className="space-y-4">
          {draft.features.map((feature, index) => (
            <FeatureEditor
              key={feature.id}
              schema={schema}
              feature={feature}
              index={index}
              total={draft.features.length}
              onChange={(next) => updateFeature(index, next)}
              onRemove={() => removeFeature(index)}
              onDuplicate={() => duplicateFeature(index)}
              onMove={(direction) => moveFeature(index, direction)}
            />
          ))}
          {draft.features.length === 0 && <p className="text-sm text-muted">Zatím žádné technologické úseky.</p>}
        </div>
      </section>
    </div>
  );
}

function FeatureEditor({
  schema,
  feature,
  index,
  total,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
}: {
  schema: StrategyFormSchema;
  feature: GenericFeatureDraft;
  index: number;
  total: number;
  onChange: (next: GenericFeatureDraft) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const updateField = (key: string, group: string, value: string | boolean) => {
    onChange({ ...feature, fields: { ...feature.fields, [`${group}.${key}`]: value } });
  };

  const applicableFields = schema.featureFields.filter((f) => !f.appliesToSubtypes || f.appliesToSubtypes.includes(feature.subtype));

  return (
    <div className="rounded border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-muted">Úsek {index + 1}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="rounded border border-border px-2 py-0.5 text-xs disabled:opacity-30" aria-label="Posunout nahoru" title="Posunout nahoru">
            ↑
          </button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="rounded border border-border px-2 py-0.5 text-xs disabled:opacity-30" aria-label="Posunout dolů" title="Posunout dolů">
            ↓
          </button>
          <button onClick={onDuplicate} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-surface-raised">
            Duplikovat
          </button>
          <button onClick={onRemove} className="rounded border border-danger/50 px-2 py-0.5 text-xs text-danger hover:bg-danger/10">
            Odstranit
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SelectInput label="Podtyp" value={feature.subtype} onChange={(v) => onChange({ ...feature, subtype: v })} options={schema.subtypeOptions} />
        {schema.machiningModeOptions && (
          <SelectInput label="Režim obrábění" value={feature.machiningMode ?? ""} onChange={(v) => onChange({ ...feature, machiningMode: v })} options={schema.machiningModeOptions} />
        )}
        {schema.measurementRequirementOptions && (
          <SelectInput
            label="Požadavek na měření"
            value={feature.measurementRequirement ?? ""}
            onChange={(v) => onChange({ ...feature, measurementRequirement: v })}
            options={schema.measurementRequirementOptions}
          />
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {applicableFields.map((f) => {
          const key = `${f.group}.${f.key}`;
          const value = feature.fields[key];
          if (f.type === "checkbox") {
            return <CheckboxInput key={key} label={f.label} checked={Boolean(value)} onChange={(v) => updateField(f.key, f.group, v)} />;
          }
          if (f.type === "select" && f.options) {
            return <SelectInput key={key} label={f.label} value={typeof value === "string" ? value : ""} onChange={(v) => updateField(f.key, f.group, v)} options={f.options} />;
          }
          if (f.type === "number") {
            return <NumberInput key={key} label={f.label} value={typeof value === "string" ? value : ""} onChange={(v) => updateField(f.key, f.group, v)} unit={f.unit} />;
          }
          return <TextInput key={key} label={f.label} value={typeof value === "string" ? value : ""} onChange={(v) => updateField(f.key, f.group, v)} unit={f.unit} />;
        })}
      </div>

      <div className="mt-3">
        <TextInput label="Poznámka" value={feature.notes ?? ""} onChange={(v) => onChange({ ...feature, notes: v })} />
      </div>
    </div>
  );
}

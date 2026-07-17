"use client";

import { useEffect, useState } from "react";
import { NASTROJ_DRUHY, NASTROJ_TYP_OPTIONS, TOOL_CATALOG_COLUMNS } from "@/lib/toolCatalog";
import { Row } from "@/lib/results";

const FIELD_BY_KEY = new Map(TOOL_CATALOG_COLUMNS.map((c) => [c.key, c]));

/** Zakládání nástroje: nejdřív se vybere druh (soustružnický nůž/vrták/fréza/...),
 *  a teprve podle něj se nabídnou pole k vyplnění - místo aby appka rovnou hodila
 *  všech devět možných parametrů najednou, i těch, co pro daný druh nástroje
 *  nedávají smysl. Nástroj se pořád ukládá jako obecný řádek (TOOL_CATALOG_COLUMNS
 *  v lib/toolCatalog.ts) - druh je jen pomůcka při zakládání, nikam se neukládá. */
export default function AddToolModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (row: Row) => void;
  onClose: () => void;
}) {
  const [nazev, setNazev] = useState("");
  const [druh, setDruh] = useState("");
  const [typ, setTyp] = useState("univerzalni");
  const [values, setValues] = useState<Record<string, string>>({});
  const [poznamka, setPoznamka] = useState("");
  const [justAdded, setJustAdded] = useState(false);

  const druhDef = NASTROJ_DRUHY.find((d) => d.value === druh);
  const canSubmit = Boolean(nazev.trim()) && Boolean(druhDef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(false), 1500);
    return () => clearTimeout(t);
  }, [justAdded]);

  const buildRow = (): Row | null => {
    if (!druhDef) return null;
    const trimmedNazev = nazev.trim();
    if (!trimmedNazev) return null;
    const row: Row = {
      nazev: trimmedNazev,
      typ: druhDef.showTyp ? typ : "univerzalni",
      poznamka: poznamka.trim() || null,
    };
    for (const c of TOOL_CATALOG_COLUMNS) {
      if (c.key === "nazev" || c.key === "typ" || c.key === "poznamka") continue;
      const raw = values[c.key];
      row[c.key] = druhDef.fields.includes(c.key) && raw !== undefined && raw !== "" ? Number(raw) : null;
    }
    return row;
  };

  const handleAddAndContinue = (e: React.FormEvent) => {
    e.preventDefault();
    const row = buildRow();
    if (!row) return;
    onSubmit(row);
    // Druh/Typ zůstává - další nástroj stejného druhu je běžnější než náhodný přeskok.
    setNazev("");
    setValues({});
    setPoznamka("");
    setJustAdded(true);
  };

  const handleAddAndClose = () => {
    const row = buildRow();
    if (!row) return;
    onSubmit(row);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <form
        onSubmit={handleAddAndContinue}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-xl border border-border bg-surface p-5 sm:max-w-md sm:rounded-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-medium">Nový nástroj</h3>
          {justAdded && <span className="text-sm text-ok">✓ Přidáno</span>}
        </div>

        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Název nástroje</span>
            <input
              autoFocus
              type="text"
              value={nazev}
              onChange={(e) => setNazev(e.target.value)}
              placeholder="např. Nůž VBMT 16"
              className="w-full rounded border border-border bg-transparent px-2 py-1.5 outline-none focus:border-accent"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted">Druh nástroje</span>
            <select
              value={druh}
              onChange={(e) => setDruh(e.target.value)}
              className="w-full rounded border border-border bg-transparent px-2 py-1.5 outline-none focus:border-accent"
            >
              <option value="" disabled>
                — vyber druh nástroje —
              </option>
              {NASTROJ_DRUHY.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          {!druhDef ? (
            <p className="text-sm text-muted">Podle vybraného druhu se níže nabídnou jen pole, která má smysl vyplnit.</p>
          ) : (
            <>
              {druhDef.showTyp && (
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Typ</span>
                  <select
                    value={typ}
                    onChange={(e) => setTyp(e.target.value)}
                    className="w-full rounded border border-border bg-transparent px-2 py-1.5 outline-none focus:border-accent"
                  >
                    {NASTROJ_TYP_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {druhDef.fields.map((key) => {
                const col = FIELD_BY_KEY.get(key);
                if (!col) return null;
                return (
                  <label key={key} className="block text-sm">
                    <span className="mb-1 block text-muted">
                      {col.label}
                      {col.unit ? <span className="text-muted/70"> [{col.unit}]</span> : null}
                    </span>
                    <input
                      type="number"
                      step="any"
                      value={values[key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      placeholder="0"
                      className="w-full rounded border border-border bg-transparent px-2 py-1.5 outline-none focus:border-accent"
                    />
                  </label>
                );
              })}
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Poznámka</span>
                <input
                  type="text"
                  value={poznamka}
                  onChange={(e) => setPoznamka(e.target.value)}
                  placeholder="—"
                  className="w-full rounded border border-border bg-transparent px-2 py-1.5 outline-none focus:border-accent"
                />
              </label>
            </>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={handleAddAndClose}
            disabled={!canSubmit}
            className={
              "rounded-md border px-3 py-1.5 text-sm transition " +
              (canSubmit
                ? "border-border text-foreground hover:border-accent hover:text-accent"
                : "cursor-not-allowed border-border text-muted/40")
            }
          >
            Přidat a zavřít
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={
              "rounded-md px-3 py-1.5 text-sm font-medium " +
              (canSubmit ? "bg-accent text-[#17130a]" : "cursor-not-allowed bg-accent/30 text-[#17130a]/50")
            }
          >
            Přidat a další
          </button>
        </div>
      </form>
    </div>
  );
}

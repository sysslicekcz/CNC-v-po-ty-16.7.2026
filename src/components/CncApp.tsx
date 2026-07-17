"use client";

import { useEffect, useRef, useState } from "react";
import { useCustomers, useInquiries, useParts, usePositions, useMachines, formatPartLabel, Part, Position, Machine } from "@/lib/entities";
import { useSearchIndex, filterEntries, SearchEntry } from "@/lib/search";
import { migrateLegacyDataIfNeeded } from "@/lib/migrateLegacy";
import { checkAvailable } from "@/lib/db";
import {
  TOOL_OPERATIONS,
  MACHINE_OPERATIONS,
  filterOperationsForMachine,
  getToolColumns,
  OperationConfig,
  ColumnDef,
} from "@/lib/operations";
import { useAllTools } from "@/lib/useAllTools";
import { useUndoableRows } from "@/lib/useUndoableRows";
import { computePositionTotal } from "@/lib/positionTotal";
import { Row } from "@/lib/results";
import DataTable from "./DataTable";
import AddKonturaModal from "./AddKonturaModal";
import EntityList from "./EntityList";
import Breadcrumbs, { Crumb } from "./Breadcrumbs";
import PartWorkspace, { actionButtonClass } from "./PartWorkspace";
import BackupView from "./BackupView";
import TabButton from "./TabButton";
import UndoToast from "./UndoToast";

type View =
  | { level: "home" }
  | { level: "customer"; customerId: string; customerNazev: string }
  | { level: "inquiry"; customerId: string; customerNazev: string; inquiryId: string; inquiryNazev: string }
  | {
      level: "part";
      customerId: string;
      customerNazev: string;
      inquiryId: string;
      inquiryNazev: string;
      partId: string;
      partCisloVykresu: string;
      partNazev: string;
      positionId?: string;
      positionNazev?: string;
    }
  | { level: "nastroje" }
  | { level: "stroje" }
  | { level: "zalohy" };

function formatMin(v: number) {
  return v.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}

function formatKc(v: number) {
  return v.toLocaleString("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 });
}

function labelForView(v: View): string {
  switch (v.level) {
    case "customer":
      return v.customerNazev;
    case "inquiry":
      return v.inquiryNazev;
    case "part":
      return formatPartLabel({ cisloVykresu: v.partCisloVykresu, nazev: v.partNazev });
    default:
      return "Domů";
  }
}

function HomeView({
  onOpenCustomer,
  onOpenPart,
}: {
  onOpenCustomer: (id: string, nazev: string) => void;
  onOpenPart: (entry: SearchEntry) => void;
}) {
  const { items, hydrated, add, remove } = useCustomers();
  const { entries } = useSearchIndex();
  const [query, setQuery] = useState("");
  const results = filterEntries(entries, query);

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-muted">
          Hledat díl podle čísla výkresu, názvu, poptávky/zakázky nebo zákazníka
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="např. 1234-56 nebo Hřídel"
          className="w-full max-w-md rounded border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      {query.trim() ? (
        <div className="overflow-hidden rounded-lg border border-border">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted">Nic nenalezeno.</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {results.map((r) => (
                <li key={r.partId}>
                  <button
                    onClick={() => onOpenPart(r)}
                    className="flex w-full flex-col items-start gap-0.5 px-4 py-2 text-left hover:bg-surface-raised/50"
                  >
                    <span className="text-sm text-foreground">
                      {r.partCisloVykresu ? (
                        <>
                          <span className="tabular text-accent">{r.partCisloVykresu}</span>
                          <span className="text-muted"> · </span>
                        </>
                      ) : null}
                      {r.partNazev}
                    </span>
                    <span className="text-xs text-muted">
                      {r.customerNazev} / {r.inquiryNazev}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <EntityList
          title="Zákazníci"
          items={items}
          hydrated={hydrated}
          onAdd={(f) => add(f.nazev)}
          onRemove={remove}
          onOpen={(c) => onOpenCustomer(c.id, c.nazev)}
          addPlaceholder="Název zákazníka"
          emptyMessage="Zatím žádní zákazníci. Založ prvního tlačítkem níže."
          deleteNoun="zákazníka"
        />
      )}
    </div>
  );
}

function CustomerView({
  customerId,
  onOpenInquiry,
}: {
  customerId: string;
  onOpenInquiry: (id: string, nazev: string) => void;
}) {
  const { items, hydrated, add, remove } = useInquiries(customerId);
  return (
    <EntityList
      title="Poptávky/Zakázky"
      items={items}
      hydrated={hydrated}
      onAdd={(f) => add(f.nazev)}
      onRemove={remove}
      onOpen={(i) => onOpenInquiry(i.id, i.nazev)}
      addPlaceholder="Název/číslo poptávky/zakázky"
      emptyMessage="Zatím žádné poptávky/zakázky. Založ první tlačítkem níže."
      deleteNoun="poptávku/zakázku"
      renderExtra={(i) => `založeno ${formatDate(i.createdAt)}`}
    />
  );
}

function InquiryView({
  inquiryId,
  onOpenPart,
}: {
  inquiryId: string;
  onOpenPart: (part: Part) => void;
}) {
  const { items, hydrated, add, remove } = useParts(inquiryId);
  return (
    <EntityList
      title="Díly"
      items={items}
      hydrated={hydrated}
      onAdd={(f) => add(f.cisloVykresu, f.nazev)}
      onRemove={remove}
      onOpen={onOpenPart}
      addPlaceholder="Název dílu"
      emptyMessage="Zatím žádné díly. Založ první níže."
      deleteNoun="díl"
      extraField={{ key: "cisloVykresu", label: "Číslo výkresu", position: "before" }}
      renderLabel={(p) => (
        <span>
          {p.cisloVykresu ? (
            <>
              <span className="tabular text-accent">{p.cisloVykresu}</span>
              <span className="text-muted"> · </span>
            </>
          ) : null}
          <span className="text-foreground">{p.nazev}</span>
        </span>
      )}
      renderExtra={(p) => `založeno ${formatDate(p.createdAt)}`}
      filterPredicate={(p, q) =>
        p.nazev.toLocaleLowerCase("cs").includes(q) || (p.cisloVykresu ?? "").toLocaleLowerCase("cs").includes(q)
      }
      confirmLabel={(p) => (p.cisloVykresu ? `${p.cisloVykresu} – ${p.nazev}` : p.nazev)}
      sortOptions={[
        { label: "Nejnovější" },
        { label: "Číslo výkresu", compare: (a, b) => (a.cisloVykresu ?? "").localeCompare(b.cisloVykresu ?? "", "cs", { numeric: true }) },
        { label: "Název", compare: (a, b) => a.nazev.localeCompare(b.nazev, "cs") },
      ]}
    />
  );
}

// Naprostá většina dílů má jedinou polohu (upnutí) - tu si appka najde/založí sama
// a rovnou otevře pracovní prostor, žádný výběr navíc. "Poloha" se v UI objeví,
// až jich je víc (nebo si uživatel druhou vyžádá tlačítkem "+ Přidat polohu").
function PartRouter({
  view,
  onOpenPosition,
  onClearPosition,
}: {
  view: Extract<View, { level: "part" }>;
  onOpenPosition: (position: Position) => void;
  onClearPosition: () => void;
}) {
  const { items, hydrated, add, remove, setStroj } = usePositions(view.partId);
  const { items: machines, hydrated: machinesHydrated } = useMachines();
  const [totals, setTotals] = useState<Record<string, number>>({});
  // Auto-výběr jediné polohy smí proběhnout jen jednou za život komponenty (=za
  // jeden vstup do dílu) - jinak by kliknutí na "spravovat polohy"/"+ Přidat polohu"
  // (které positionId ve view vyčistí) hned zase skočilo zpátky do té samé polohy.
  const autoSelected = useRef(false);

  useEffect(() => {
    if (!hydrated || items.length <= 1) return;
    let cancelled = false;
    Promise.all(items.map(async (p) => [p.id, await computePositionTotal(p.id)] as const)).then((pairs) => {
      if (!cancelled) setTotals(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, items]);

  useEffect(() => {
    if (hydrated && items.length === 1 && !view.positionId && !autoSelected.current) {
      autoSelected.current = true;
      onOpenPosition(items[0]);
    }
  }, [hydrated, items, view.positionId, onOpenPosition]);

  if (!hydrated || !machinesHydrated) return null;

  if (view.positionId) {
    const position = items.find((p) => p.id === view.positionId);
    return (
      <div>
        {items.length > 1 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-muted">Poloha:</span>
            {items.map((p) => (
              <TabButton key={p.id} active={p.id === view.positionId} onClick={() => onOpenPosition(p)}>
                {p.nazev}
              </TabButton>
            ))}
            <button
              onClick={onClearPosition}
              className="ml-1 text-sm text-muted underline decoration-dotted hover:text-accent"
            >
              spravovat polohy
            </button>
          </div>
        )}
        <PartWorkspace
          positionId={view.positionId}
          partInfo={{
            customerNazev: view.customerNazev,
            inquiryNazev: view.inquiryNazev,
            partCisloVykresu: view.partCisloVykresu,
            partNazev: view.partNazev,
          }}
          machines={machines}
          strojId={position?.strojId}
          onSetStroj={(strojId) => setStroj(view.positionId!, strojId)}
        />
        {items.length === 1 && (
          <button onClick={onClearPosition} className={"mt-4 " + actionButtonClass()}>
            + Přidat polohu
          </button>
        )}
      </div>
    );
  }

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  const grandCost = items.reduce((sum, p) => {
    const sazba = machines.find((m) => m.id === p.strojId)?.sazba;
    const time = totals[p.id];
    return sazba !== undefined && time !== undefined ? sum + (time / 60) * sazba : sum;
  }, 0);
  const anyStrojAssigned = items.some((p) => p.strojId);

  return (
    <div className="space-y-4">
      {items.length > 1 && (
        <div className="rounded-lg border border-accent-dim bg-surface p-4 text-sm">
          <span className="text-muted">Celkem za díl: </span>
          <span className="tabular text-accent">{formatMin(grandTotal)} min</span>
          {anyStrojAssigned && (
            <>
              <span className="text-muted"> · </span>
              <span className="tabular text-accent">{formatKc(grandCost)}</span>
            </>
          )}
        </div>
      )}
      <EntityList
        title="Polohy"
        items={items}
        hydrated={hydrated}
        onAdd={(f) => add(f.nazev)}
        onRemove={remove}
        onOpen={onOpenPosition}
        addPlaceholder={`Název polohy (např. Poloha ${items.length + 1})`}
        emptyMessage="Zatím žádné polohy."
        deleteNoun="polohu"
        renderExtra={(p) => (totals[p.id] !== undefined ? `${formatMin(totals[p.id])} min` : "")}
        canRemove={() => items.length > 1}
      />
    </div>
  );
}

function ToolCatalogTab({
  config,
  columns,
  rows,
  setRows,
  isPrep,
}: {
  config: OperationConfig;
  columns: ColumnDef[];
  rows: Row[];
  setRows: (rows: Row[]) => void;
  isPrep: boolean;
}) {
  const [showModal, setShowModal] = useState(false);
  const { onChange, clearAll, undo, canUndo } = useUndoableRows(rows, setRows);
  const addLabel = isPrep ? "+ Přidat šablonu" : "+ Přidat nástroj";
  const clearLabel = isPrep ? "Smazat všechny šablony" : "Smazat všechny nástroje";

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => setShowModal(true)} className={actionButtonClass()}>
          {addLabel}
        </button>
        <button onClick={undo} disabled={!canUndo} className={actionButtonClass(!canUndo)}>
          Krok zpět
        </button>
        <button onClick={clearAll} disabled={rows.length === 0} className={actionButtonClass(rows.length === 0)}>
          {clearLabel}
        </button>
      </div>
      <DataTable columns={columns} rows={rows} onChange={onChange} konturaOptions={[]} itemKind="nastroj" />
      {showModal && (
        <AddKonturaModal
          title={`${isPrep ? "Šablony" : "Nástroje"} — ${config.title}`}
          columns={columns}
          prevRow={rows[rows.length - 1]}
          konturaOptions={[]}
          onClose={() => setShowModal(false)}
          onSubmit={(row) => onChange([...rows, row])}
        />
      )}
    </>
  );
}

function ToolsView({
  toolsActive,
  setToolsActive,
  strojId,
  setStrojId,
}: {
  toolsActive: string;
  setToolsActive: (id: string) => void;
  strojId: string | undefined;
  setStrojId: (id: string | undefined) => void;
}) {
  const { items: machines, hydrated: machinesHydrated } = useMachines();
  const machine = machines.find((m) => m.id === strojId);
  const opsForMachine = filterOperationsForMachine(TOOL_OPERATIONS, machine?.operace);
  // Katalog je teď per stroj - pokud aktuálně vybraná záložka operace u zvoleného
  // stroje nedává smysl (stroj tu operaci neumí, nebo se teprve vybírá stroj),
  // rovnou spadneme na první operaci, kterou stroj podporuje.
  const effectiveActive = opsForMachine.some((o) => o.id === toolsActive) ? toolsActive : opsForMachine[0]?.id;

  // Volá se, až když je CncApp jistě po migraci (viz "!migrated ? null : ..." níže) -
  // kdyby se tenhle hook volal dřív, mohl by načíst katalog nástrojů ještě před tím,
  // než ho migrace ze staré localStorage stihne dopsat do IndexedDB.
  const { hydrated: toolsHydrated, byId, setById } = useAllTools(strojId);

  useEffect(() => {
    if (effectiveActive && effectiveActive !== toolsActive) setToolsActive(effectiveActive);
  }, [effectiveActive, toolsActive, setToolsActive]);

  if (!machinesHydrated) return null;

  if (machines.length === 0) {
    return (
      <div>
        <h2 className="mb-3 text-lg font-medium">Katalog nástrojů a šablon</h2>
        <p className="max-w-2xl text-sm text-muted">
          Katalog nástrojů je veden zvlášť pro každý stroj. Nejdřív založ aspoň jeden stroj v záložce{" "}
          <span className="text-foreground">Stroje</span>.
        </p>
      </div>
    );
  }

  const config = effectiveActive ? TOOL_OPERATIONS.find((o) => o.id === effectiveActive)! : undefined;
  const columns = config ? getToolColumns(config) : [];
  const rows = effectiveActive ? byId[effectiveActive] : [];
  const isPrep = effectiveActive === "pripravneCasy";

  return (
    <div>
      <h2 className="mb-3 text-lg font-medium">Katalog nástrojů a šablon</h2>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Katalog nástrojů je veden zvlášť pro každý stroj - vyber stroj a jen u něj přednastav nástroje,
        které umí (podle operací zvolených u stroje v záložce Stroje).
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <label className="text-muted">Stroj:</label>
        <select
          value={strojId ?? ""}
          onChange={(e) => setStrojId(e.target.value || undefined)}
          className="rounded border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        >
          <option value="" disabled>
            — vyber stroj —
          </option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nazev}
            </option>
          ))}
        </select>
      </div>

      {!strojId || !config ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted">
          Vyber stroj, jehož katalog nástrojů chceš spravovat.
        </div>
      ) : !toolsHydrated ? null : (
        <>
          <nav className="mb-4 flex flex-wrap gap-1.5">
            {opsForMachine.map((op) => (
              <TabButton key={op.id} active={effectiveActive === op.id} onClick={() => setToolsActive(op.id)}>
                {op.shortTitle}
              </TabButton>
            ))}
          </nav>
          <ToolCatalogTab
            key={`${strojId}:${effectiveActive}`}
            config={config}
            columns={columns}
            rows={rows}
            setRows={setById[effectiveActive]}
            isPrep={isPrep}
          />
        </>
      )}
    </div>
  );
}

function MachineForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Machine;
  onSubmit: (fields: { nazev: string; sazba: number; operace: string[] }) => void;
  onCancel: () => void;
}) {
  const [nazev, setNazev] = useState(initial?.nazev ?? "");
  const [sazba, setSazba] = useState(initial ? String(initial.sazba) : "");
  const [operace, setOperace] = useState<string[]>(initial?.operace ?? MACHINE_OPERATIONS.map((o) => o.id));

  const toggle = (id: string) => {
    setOperace((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNazev = nazev.trim();
    const sazbaNum = Number(sazba);
    if (!trimmedNazev || !Number.isFinite(sazbaNum) || sazbaNum < 0) return;
    onSubmit({ nazev: trimmedNazev, sazba: sazbaNum, operace });
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={nazev}
          onChange={(e) => setNazev(e.target.value)}
          placeholder="Název stroje"
          className="flex-1 rounded border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <input
          type="number"
          value={sazba}
          onChange={(e) => setSazba(e.target.value)}
          placeholder="Sazba Kč/hod"
          className="w-36 rounded border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <div className="mb-1.5 text-xs uppercase tracking-wide text-muted">Podporované operace</div>
        <div className="flex flex-wrap gap-1.5">
          {MACHINE_OPERATIONS.map((op) => {
            const active = operace.includes(op.id);
            return (
              <button
                type="button"
                key={op.id}
                onClick={() => toggle(op.id)}
                aria-pressed={active}
                className={
                  "rounded-md border px-2.5 py-1 text-sm transition " +
                  (active
                    ? "border-accent-dim bg-accent-dim/30 text-accent"
                    : "border-border text-muted hover:text-foreground")
                }
              >
                {op.shortTitle}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={actionButtonClass()}>
          {initial ? "Uložit" : "+ Přidat stroj"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
        >
          Zrušit
        </button>
      </div>
    </form>
  );
}

function StrojeView() {
  const { items, hydrated, add, update, remove } = useMachines();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  if (!hydrated) return null;
  const editing = items.find((m) => m.id === editingId);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Stroje</h2>
      <p className="max-w-2xl text-sm text-muted">
        Založ stroje s jejich hodinovou sazbou a operacemi, které umí (např. soustruh neumí brousit).
        U poloh dílů pak půjde vybrat, na kterém stroji se dělaly - appka k výrobnímu času dopočítá
        cenu a v pracovním prostoru dílu nabídne jen operace, které ten stroj podporuje.
      </p>

      {editing ? (
        <MachineForm
          initial={editing}
          onSubmit={(fields) => {
            update(editing.id, fields);
            setEditingId(null);
          }}
          onCancel={() => setEditingId(null)}
        />
      ) : showAdd ? (
        <MachineForm
          onSubmit={(fields) => {
            add(fields.nazev, fields.sazba, fields.operace);
            setShowAdd(false);
          }}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button onClick={() => setShowAdd(true)} className={actionButtonClass()}>
          + Přidat stroj
        </button>
      )}

      <EntityList
        title="Seznam strojů"
        items={items}
        hydrated={hydrated}
        onAdd={() => {}}
        onRemove={(id) => {
          remove(id);
          if (editingId === id) setEditingId(null);
        }}
        onOpen={(m) => {
          setShowAdd(false);
          setEditingId(m.id);
        }}
        addPlaceholder=""
        emptyMessage="Zatím žádné stroje. Založ první tlačítkem výše."
        deleteNoun="stroj"
        hideAddForm
        renderExtra={(m) => `${formatKc(m.sazba)}/hod`}
      />
    </div>
  );
}

export default function CncApp() {
  const [migrated, setMigrated] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ level: "home" });
  const [toolsActive, setToolsActive] = useState<string>(TOOL_OPERATIONS[0].id);
  const [nastrojeStrojId, setNastrojeStrojId] = useState<string | undefined>(undefined);
  // Poslední navštívené místo mimo Nástroje/Zálohy - umožňuje se odtamtud vrátit
  // jedním krokem přímo tam, kde uživatel byl (ne jen na Domů). Nastavuje se přímo
  // při renderu (ne v efektu), stejným způsobem jako React doporučuje pro odvozený
  // stav navázaný na změnu jiného stavu.
  const [prevView, setPrevView] = useState(view);
  const [lastLocation, setLastLocation] = useState<View>({ level: "home" });
  const isUtilityLevel = (l: View["level"]) => l === "nastroje" || l === "stroje" || l === "zalohy";

  if (prevView !== view) {
    setPrevView(view);
    if (!isUtilityLevel(view.level)) setLastLocation(view);
  }

  useEffect(() => {
    // Odděleně od migrace (ta chyby polyká, aby appka naběhla i při jejím
    // selhání) - tady chceme selhání IndexedDB naopak zachytit a ukázat.
    checkAvailable().catch((err) =>
      setDbError(err instanceof Error ? err.message : "Úložiště dat se nepodařilo otevřít.")
    );
    migrateLegacyDataIfNeeded().then(() => setMigrated(true));
  }, []);

  if (dbError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="mb-3 font-mono text-xl font-semibold text-danger">Úložiště dat je nedostupné</h1>
        <p className="mb-2 text-sm text-muted">
          CNC Časovač ukládá data do IndexedDB v tomto prohlížeči, ale nepodařilo se ji otevřít:
        </p>
        <p className="mb-4 rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">{dbError}</p>
        <p className="text-sm text-muted">
          Nejčastější příčina je soukromé/anonymní prohlížení nebo zákaz IndexedDB firemní politikou
          prohlížeče. Zkus appku otevřít v běžném (ne anonymním) okně, případně v jiném prohlížeči.
        </p>
      </div>
    );
  }

  let crumbs: Crumb[] = [];
  let current: string | undefined;

  if (isUtilityLevel(view.level)) {
    if (lastLocation.level !== "home") {
      crumbs = [{ label: `← ${labelForView(lastLocation)}`, onClick: () => setView(lastLocation) }];
    }
    current = view.level === "nastroje" ? "Nástroje" : view.level === "stroje" ? "Stroje" : "Zálohy";
  } else if (view.level === "customer") {
    crumbs = [{ label: "Domů", onClick: () => setView({ level: "home" }) }];
    current = view.customerNazev;
  } else if (view.level === "inquiry") {
    crumbs = [
      { label: "Domů", onClick: () => setView({ level: "home" }) },
      {
        label: view.customerNazev,
        onClick: () => setView({ level: "customer", customerId: view.customerId, customerNazev: view.customerNazev }),
      },
    ];
    current = view.inquiryNazev;
  } else if (view.level === "part") {
    crumbs = [
      { label: "Domů", onClick: () => setView({ level: "home" }) },
      {
        label: view.customerNazev,
        onClick: () => setView({ level: "customer", customerId: view.customerId, customerNazev: view.customerNazev }),
      },
      {
        label: view.inquiryNazev,
        onClick: () =>
          setView({
            level: "inquiry",
            customerId: view.customerId,
            customerNazev: view.customerNazev,
            inquiryId: view.inquiryId,
            inquiryNazev: view.inquiryNazev,
          }),
      },
    ];
    const partLabel = formatPartLabel({ cisloVykresu: view.partCisloVykresu, nazev: view.partNazev });
    if (view.positionNazev) {
      crumbs.push({ label: partLabel, onClick: () => setView({ ...view, positionId: undefined, positionNazev: undefined }) });
      current = view.positionNazev;
    } else {
      current = partLabel;
    }
  }

  const isHome = view.level === "home";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {isHome ? (
        <header className="mb-8 flex flex-col gap-1 border-b border-border pb-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Dílenský výpočet časů
          </div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
            CNC Časovač
          </h1>
          <p className="max-w-2xl text-sm text-muted">
            Přepočet strojních časů z řezných podmínek — soustružení, vrtání, zápichy, frézování
            drážek a broušení. Data se ukládají v prohlížeči.
          </p>
        </header>
      ) : (
        <header className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <h1 className="font-mono text-base font-semibold tracking-tight text-muted">CNC Časovač</h1>
        </header>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <nav className="flex flex-wrap gap-1.5">
          <TabButton active={!isUtilityLevel(view.level)} onClick={() => setView({ level: "home" })}>
            Domů
          </TabButton>
          <TabButton active={view.level === "nastroje"} onClick={() => setView({ level: "nastroje" })}>
            Nástroje
          </TabButton>
          <TabButton active={view.level === "stroje"} onClick={() => setView({ level: "stroje" })}>
            Stroje
          </TabButton>
          <TabButton active={view.level === "zalohy"} onClick={() => setView({ level: "zalohy" })}>
            Zálohy
          </TabButton>
        </nav>
        <Breadcrumbs items={crumbs} current={current} />
      </div>

      <main>
        {!migrated ? null : view.level === "home" ? (
          <HomeView
            onOpenCustomer={(id, nazev) => setView({ level: "customer", customerId: id, customerNazev: nazev })}
            onOpenPart={(r) =>
              setView({
                level: "part",
                customerId: r.customerId,
                customerNazev: r.customerNazev,
                inquiryId: r.inquiryId,
                inquiryNazev: r.inquiryNazev,
                partId: r.partId,
                partCisloVykresu: r.partCisloVykresu,
                partNazev: r.partNazev,
              })
            }
          />
        ) : view.level === "customer" ? (
          <CustomerView
            customerId={view.customerId}
            onOpenInquiry={(id, nazev) =>
              setView({
                level: "inquiry",
                customerId: view.customerId,
                customerNazev: view.customerNazev,
                inquiryId: id,
                inquiryNazev: nazev,
              })
            }
          />
        ) : view.level === "inquiry" ? (
          <InquiryView
            inquiryId={view.inquiryId}
            onOpenPart={(part) =>
              setView({
                level: "part",
                customerId: view.customerId,
                customerNazev: view.customerNazev,
                inquiryId: view.inquiryId,
                inquiryNazev: view.inquiryNazev,
                partId: part.id,
                partCisloVykresu: part.cisloVykresu,
                partNazev: part.nazev,
              })
            }
          />
        ) : view.level === "part" ? (
          <PartRouter
            view={view}
            onOpenPosition={(p) => setView({ ...view, positionId: p.id, positionNazev: p.nazev })}
            onClearPosition={() => setView({ ...view, positionId: undefined, positionNazev: undefined })}
          />
        ) : view.level === "nastroje" ? (
          <ToolsView
            toolsActive={toolsActive}
            setToolsActive={setToolsActive}
            strojId={nastrojeStrojId}
            setStrojId={setNastrojeStrojId}
          />
        ) : view.level === "stroje" ? (
          <StrojeView />
        ) : (
          <BackupView />
        )}
      </main>
      <UndoToast />
    </div>
  );
}

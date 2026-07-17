"use client";

import { useEffect, useRef, useState } from "react";
import { useCustomers, useInquiries, useParts, usePositions, useMachines, formatPartLabel, Part, Position, Machine } from "@/lib/entities";
import { useSearchIndex, filterEntries, SearchEntry } from "@/lib/search";
import { migrateLegacyDataIfNeeded, migrateMachineCatalogIfNeeded } from "@/lib/migrateLegacy";
import { checkAvailable } from "@/lib/db";
import { MACHINE_OPERATIONS, OPERATIONS, ColumnDef } from "@/lib/operations";
import { deriveMachineType, TOOL_CATALOG_COLUMNS } from "@/lib/toolCatalog";
import { useToolCatalog, useSetupTemplates } from "@/lib/useToolCatalog";
import { useUndoableRows } from "@/lib/useUndoableRows";
import { computePositionTotal } from "@/lib/positionTotal";
import { Row } from "@/lib/results";
import DataTable from "./DataTable";
import AddKonturaModal from "./AddKonturaModal";
import EntityList from "./EntityList";
import Breadcrumbs, { Crumb } from "./Breadcrumbs";
import PartWorkspace from "./PartWorkspace";
import { actionButtonClass } from "@/lib/actionButtonClass";
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
  | { level: "stroj"; strojId: string; strojNazev: string; strojTab?: "parametry" | "nastroje" | "serizeni" }
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
    case "stroj":
      return v.strojNazev;
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
          onAddPosition={items.length === 1 ? onClearPosition : undefined}
        />
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

/** Obecná editace jednoho seznamu řádků (katalog nástrojů, nebo šablony přípravných
 *  časů) - použité v obou příslušných záložkách detailu stroje, viz MachineDetailView. */
function CatalogTab({
  title,
  columns,
  rows,
  setRows,
  itemKind,
  addLabel,
  clearLabel,
}: {
  title: string;
  columns: ColumnDef[];
  rows: Row[];
  setRows: (rows: Row[]) => void;
  itemKind: "nastroj" | "sablona";
  addLabel: string;
  clearLabel: string;
}) {
  const [showModal, setShowModal] = useState(false);
  const { onChange, clearAll, undo, canUndo } = useUndoableRows(rows, setRows);

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
      <DataTable columns={columns} rows={rows} onChange={onChange} konturaOptions={[]} itemKind={itemKind} />
      {showModal && (
        <AddKonturaModal
          title={title}
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

const PRIPRAVA_CONFIG = OPERATIONS.find((o) => o.id === "pripravneCasy")!;

function MachineDetailView({
  strojId,
  strojTab,
  onSetTab,
  onBack,
}: {
  strojId: string;
  strojTab: "parametry" | "nastroje" | "serizeni";
  onSetTab: (tab: "parametry" | "nastroje" | "serizeni") => void;
  onBack: () => void;
}) {
  const { items: machines, hydrated: machinesHydrated, update } = useMachines();
  const machine = machines.find((m) => m.id === strojId);
  const { rows: toolRows, setRows: setToolRows, hydrated: toolsHydrated } = useToolCatalog(strojId);
  const { rows: setupRows, setRows: setSetupRows, hydrated: setupHydrated } = useSetupTemplates(strojId);

  if (!machinesHydrated) return null;
  if (!machine) {
    return <p className="text-sm text-muted">Stroj nenalezen.</p>;
  }

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        <TabButton active={strojTab === "parametry"} onClick={() => onSetTab("parametry")}>
          Parametry stroje
        </TabButton>
        <TabButton active={strojTab === "nastroje"} onClick={() => onSetTab("nastroje")}>
          Nástroje
        </TabButton>
        <TabButton active={strojTab === "serizeni"} onClick={() => onSetTab("serizeni")}>
          Seřízení
        </TabButton>
      </nav>

      {strojTab === "parametry" ? (
        <div className="space-y-4">
          <div className="text-sm">
            <span className="text-muted">Typ stroje: </span>
            <span className="text-accent">{deriveMachineType(machine.operace)}</span>
            <span className="text-muted/70"> (odvozeno z podporovaných operací)</span>
          </div>
          <MachineForm initial={machine} onSubmit={(fields) => update(machine.id, fields)} onCancel={onBack} />
        </div>
      ) : strojTab === "nastroje" ? (
        !toolsHydrated ? null : (
          <CatalogTab
            title={`Nástroje — ${machine.nazev}`}
            columns={TOOL_CATALOG_COLUMNS}
            rows={toolRows}
            setRows={setToolRows}
            itemKind="nastroj"
            addLabel="+ Přidat nástroj"
            clearLabel="Smazat všechny nástroje"
          />
        )
      ) : !setupHydrated ? null : (
        <CatalogTab
          title={`Seřízení — ${machine.nazev}`}
          columns={PRIPRAVA_CONFIG.columns}
          rows={setupRows}
          setRows={setSetupRows}
          itemKind="sablona"
          addLabel="+ Přidat šablonu"
          clearLabel="Smazat všechny šablony"
        />
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
  onSubmit: (fields: { nazev: string; maximalniOtacky: number; sazba?: number; operace: string[] }) => void;
  onCancel: () => void;
}) {
  const [nazev, setNazev] = useState(initial?.nazev ?? "");
  const [maximalniOtacky, setMaximalniOtacky] = useState(
    initial?.maximalniOtacky !== undefined ? String(initial.maximalniOtacky) : ""
  );
  const [sazba, setSazba] = useState(initial?.sazba !== undefined ? String(initial.sazba) : "");
  const [operace, setOperace] = useState<string[]>(initial?.operace ?? MACHINE_OPERATIONS.map((o) => o.id));

  const toggle = (id: string) => {
    setOperace((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNazev = nazev.trim();
    const otackyNum = Number(maximalniOtacky);
    if (!trimmedNazev || !Number.isFinite(otackyNum) || otackyNum <= 0) return;
    let sazbaNum: number | undefined;
    if (sazba.trim() !== "") {
      const n = Number(sazba);
      if (!Number.isFinite(n) || n < 0) return;
      sazbaNum = n;
    }
    onSubmit({ nazev: trimmedNazev, maximalniOtacky: otackyNum, sazba: sazbaNum, operace });
  };

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={nazev}
          onChange={(e) => setNazev(e.target.value)}
          placeholder="Název stroje"
          className="flex-1 rounded border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <input
          type="number"
          value={maximalniOtacky}
          onChange={(e) => setMaximalniOtacky(e.target.value)}
          placeholder="Max. otáčky ot/min"
          className="w-40 rounded border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <input
          type="number"
          value={sazba}
          onChange={(e) => setSazba(e.target.value)}
          placeholder="Sazba Kč/hod (volitelné)"
          className="w-44 rounded border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-accent"
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

function StrojeView({ onOpenMachine }: { onOpenMachine: (m: Machine) => void }) {
  const { items, hydrated, add, remove } = useMachines();
  const [showAdd, setShowAdd] = useState(false);

  if (!hydrated) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Stroje</h2>
      <p className="max-w-2xl text-sm text-muted">
        Založ stroje s jejich maximálními otáčkami a operacemi, které umí (např. soustruh neumí brousit).
        Typ stroje (soustruh/frézka/bruska/...) appka odvodí sama z povolených operací. U poloh dílů pak
        půjde vybrat, na kterém stroji se dělaly - appka k výrobnímu času dopočítá cenu (je-li u stroje
        zadaná sazba) a v pracovním prostoru dílu nabídne jen operace a nástroje, které ten stroj podporuje.
      </p>

      {showAdd ? (
        <MachineForm
          onSubmit={(fields) => {
            add(fields);
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
        onRemove={remove}
        onOpen={(m) => {
          setShowAdd(false);
          onOpenMachine(m);
        }}
        addPlaceholder=""
        emptyMessage="Zatím žádné stroje. Založ první tlačítkem výše."
        deleteNoun="stroj"
        hideAddForm
        renderExtra={(m) => `${deriveMachineType(m.operace)}${m.sazba !== undefined ? ` · ${formatKc(m.sazba)}/hod` : ""}`}
      />
    </div>
  );
}

export default function CncApp() {
  const [migrated, setMigrated] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ level: "home" });
  // Poslední navštívené místo mimo Stroje/Zálohy - umožňuje se odtamtud vrátit
  // jedním krokem přímo tam, kde uživatel byl (ne jen na Domů). Nastavuje se přímo
  // při renderu (ne v efektu), stejným způsobem jako React doporučuje pro odvozený
  // stav navázaný na změnu jiného stavu.
  const [prevView, setPrevView] = useState(view);
  const [lastLocation, setLastLocation] = useState<View>({ level: "home" });
  // "stroj" (detail stroje) se breadcrumbem vrací na "stroje" (seznam), ne na
  // poslední navštívené místo v Domů stromu - proto se počítá jako "utility"
  // stejně jako stroje/zálohy (viz i nav tlačítko Domů níže).
  const isUtilityLevel = (l: View["level"]) => l === "stroj" || l === "stroje" || l === "zalohy";

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
    migrateLegacyDataIfNeeded().then(() => migrateMachineCatalogIfNeeded().then(() => setMigrated(true)));
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

  if (view.level === "stroj") {
    crumbs = [{ label: "Stroje", onClick: () => setView({ level: "stroje" }) }];
    current = view.strojNazev;
  } else if (isUtilityLevel(view.level)) {
    if (lastLocation.level !== "home") {
      crumbs = [{ label: `← ${labelForView(lastLocation)}`, onClick: () => setView(lastLocation) }];
    }
    current = view.level === "stroje" ? "Stroje" : "Zálohy";
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
          <TabButton
            active={view.level === "stroje" || view.level === "stroj"}
            onClick={() => setView({ level: "stroje" })}
          >
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
        ) : view.level === "stroj" ? (
          <MachineDetailView
            strojId={view.strojId}
            strojTab={view.strojTab ?? "parametry"}
            onSetTab={(tab) => setView({ ...view, strojTab: tab })}
            onBack={() => setView({ level: "stroje" })}
          />
        ) : view.level === "stroje" ? (
          <StrojeView
            onOpenMachine={(m) => setView({ level: "stroj", strojId: m.id, strojNazev: m.nazev, strojTab: "parametry" })}
          />
        ) : (
          <BackupView />
        )}
      </main>
      <UndoToast />
    </div>
  );
}

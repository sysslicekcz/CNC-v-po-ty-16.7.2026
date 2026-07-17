"use client";

import { useEffect, useRef, useState } from "react";
import { useCustomers, useInquiries, useParts, usePositions, formatPartLabel, Part, Position } from "@/lib/entities";
import { useSearchIndex, filterEntries, SearchEntry } from "@/lib/search";
import { migrateLegacyDataIfNeeded } from "@/lib/migrateLegacy";
import { TOOL_OPERATIONS, getToolColumns } from "@/lib/operations";
import { useAllTools } from "@/lib/useAllTools";
import { computePositionTotal } from "@/lib/positionTotal";
import DataTable from "./DataTable";
import AddKonturaModal from "./AddKonturaModal";
import EntityList from "./EntityList";
import PartList from "./PartList";
import Breadcrumbs, { Crumb } from "./Breadcrumbs";
import PartWorkspace from "./PartWorkspace";
import BackupView from "./BackupView";
import TabButton from "./TabButton";

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
  | { level: "zalohy" };

function formatMin(v: number) {
  return v.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
          onAdd={add}
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
      onAdd={add}
      onRemove={remove}
      onOpen={(i) => onOpenInquiry(i.id, i.nazev)}
      addPlaceholder="Název/číslo poptávky/zakázky"
      emptyMessage="Zatím žádné poptávky/zakázky. Založ první tlačítkem níže."
      deleteNoun="poptávku/zakázku"
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
  return <PartList items={items} hydrated={hydrated} onAdd={add} onRemove={remove} onOpen={onOpenPart} />;
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
  const { items, hydrated, add, remove } = usePositions(view.partId);
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

  if (!hydrated) return null;

  if (view.positionId) {
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
        />
        {items.length === 1 && (
          <button
            onClick={onClearPosition}
            className="mt-4 text-sm text-muted underline decoration-dotted hover:text-accent"
          >
            + Přidat polohu
          </button>
        )}
      </div>
    );
  }

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {items.length > 1 && (
        <div className="rounded-lg border border-accent-dim bg-surface p-4 text-sm">
          <span className="text-muted">Celkem za díl: </span>
          <span className="tabular text-accent">{formatMin(grandTotal)} min</span>
        </div>
      )}
      <EntityList
        title="Polohy"
        items={items}
        hydrated={hydrated}
        onAdd={add}
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

function ToolsView({
  toolsActive,
  setToolsActive,
}: {
  toolsActive: string;
  setToolsActive: (id: string) => void;
}) {
  // Volá se, až když je CncApp jistě po migraci (viz "!migrated ? null : ..." níže) -
  // kdyby se tenhle hook volal dřív, mohl by načíst katalog nástrojů ještě před tím,
  // než ho migrace ze staré localStorage stihne dopsat do IndexedDB.
  const { hydrated, byId, setById } = useAllTools();
  const [showModal, setShowModal] = useState(false);
  if (!hydrated) return null;
  const config = TOOL_OPERATIONS.find((o) => o.id === toolsActive)!;
  const columns = getToolColumns(config);
  const rows = byId[toolsActive];
  const isPrep = toolsActive === "pripravneCasy";
  const addLabel = isPrep ? "+ Přidat šablonu" : "+ Přidat nástroj";

  return (
    <div>
      <h2 className="mb-3 text-lg font-medium">Katalog nástrojů a šablon</h2>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        {isPrep
          ? "Předdefinuj časté přípravné úkony s jejich časem. Při zadávání přípravného času je pak půjde vybrat ze seznamu a čas se předvyplní."
          : "Předdefinuj nástroje s jejich posuvy, řeznými rychlostmi a rozměry. Při zadávání kontury je pak půjde vybrat ze seznamu a příslušná pole se předvyplní."}
      </p>
      <nav className="mb-4 flex flex-wrap gap-1.5">
        {TOOL_OPERATIONS.map((op) => (
          <TabButton key={op.id} active={toolsActive === op.id} onClick={() => setToolsActive(op.id)}>
            {op.shortTitle}
          </TabButton>
        ))}
      </nav>
      <div className="mb-3">
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-accent hover:text-accent"
        >
          {addLabel}
        </button>
      </div>
      <DataTable columns={columns} rows={rows} onChange={setById[toolsActive]} konturaOptions={[]} itemKind="nastroj" />
      {showModal && (
        <AddKonturaModal
          title={`${isPrep ? "Šablony" : "Nástroje"} — ${config.title}`}
          columns={columns}
          prevRow={rows[rows.length - 1]}
          konturaOptions={[]}
          onClose={() => setShowModal(false)}
          onSubmit={(row) => setById[toolsActive]([...rows, row])}
        />
      )}
    </div>
  );
}

export default function CncApp() {
  const [migrated, setMigrated] = useState(false);
  const [view, setView] = useState<View>({ level: "home" });
  const [toolsActive, setToolsActive] = useState<string>(TOOL_OPERATIONS[0].id);
  // Poslední navštívené místo mimo Nástroje/Zálohy - umožňuje se odtamtud vrátit
  // jedním krokem přímo tam, kde uživatel byl (ne jen na Domů). Nastavuje se přímo
  // při renderu (ne v efektu), stejným způsobem jako React doporučuje pro odvozený
  // stav navázaný na změnu jiného stavu.
  const [prevView, setPrevView] = useState(view);
  const [lastLocation, setLastLocation] = useState<View>({ level: "home" });
  if (prevView !== view) {
    setPrevView(view);
    if (view.level !== "nastroje" && view.level !== "zalohy") setLastLocation(view);
  }

  useEffect(() => {
    migrateLegacyDataIfNeeded().then(() => setMigrated(true));
  }, []);

  let crumbs: Crumb[] = [];
  let current: string | undefined;

  if (view.level === "nastroje" || view.level === "zalohy") {
    if (lastLocation.level !== "home") {
      crumbs = [{ label: `← ${labelForView(lastLocation)}`, onClick: () => setView(lastLocation) }];
    }
    current = view.level === "nastroje" ? "Nástroje" : "Zálohy";
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
          <TabButton
            active={view.level !== "nastroje" && view.level !== "zalohy"}
            onClick={() => setView({ level: "home" })}
          >
            Domů
          </TabButton>
          <TabButton active={view.level === "nastroje"} onClick={() => setView({ level: "nastroje" })}>
            Nástroje
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
          <ToolsView toolsActive={toolsActive} setToolsActive={setToolsActive} />
        ) : (
          <BackupView />
        )}
      </main>
    </div>
  );
}

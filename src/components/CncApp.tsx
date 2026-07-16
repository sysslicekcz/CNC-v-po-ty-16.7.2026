"use client";

import { useEffect, useState } from "react";
import { useCustomers, useInquiries, useParts, formatPartLabel, Part } from "@/lib/entities";
import { useSearchIndex, filterEntries, SearchEntry } from "@/lib/search";
import { migrateLegacyDataIfNeeded } from "@/lib/migrateLegacy";
import { TOOL_OPERATIONS, getToolColumns } from "@/lib/operations";
import { useAllTools } from "@/lib/useAllTools";
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
    }
  | { level: "nastroje" }
  | { level: "zalohy" };

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
          Hledat díl podle čísla výkresu, názvu, poptávky nebo zákazníka
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
      title="Poptávky"
      items={items}
      hydrated={hydrated}
      onAdd={add}
      onRemove={remove}
      onOpen={(i) => onOpenInquiry(i.id, i.nazev)}
      addPlaceholder="Název/číslo poptávky"
      emptyMessage="Zatím žádné poptávky. Založ první tlačítkem níže."
      deleteNoun="poptávku"
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

  return (
    <div>
      <h2 className="mb-3 text-lg font-medium">Katalog nástrojů</h2>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Předdefinuj nástroje s jejich posuvy, řeznými rychlostmi a rozměry. Při zadávání
        kontury je pak půjde vybrat ze seznamu a příslušná pole se předvyplní.
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
          + Přidat nástroj
        </button>
      </div>
      <DataTable columns={columns} rows={rows} onChange={setById[toolsActive]} konturaOptions={[]} itemKind="nastroj" />
      {showModal && (
        <AddKonturaModal
          title={`Nástroje — ${config.title}`}
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
    current = formatPartLabel({ cisloVykresu: view.partCisloVykresu, nazev: view.partNazev });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
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

      <nav className="mb-4 flex flex-wrap gap-1.5 border-b border-border pb-4">
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
          <PartWorkspace partId={view.partId} />
        ) : view.level === "nastroje" ? (
          <ToolsView toolsActive={toolsActive} setToolsActive={setToolsActive} />
        ) : (
          <BackupView />
        )}
      </main>
    </div>
  );
}

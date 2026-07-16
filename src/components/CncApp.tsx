"use client";

import { useEffect, useState } from "react";
import { useCustomers, useInquiries, useParts } from "@/lib/entities";
import { useSearchIndex, filterEntries, SearchEntry } from "@/lib/search";
import { migrateLegacyDataIfNeeded } from "@/lib/migrateLegacy";
import { TOOL_OPERATIONS, getToolColumns } from "@/lib/operations";
import { useAllTools } from "@/lib/useAllTools";
import DataTable from "./DataTable";
import EntityList from "./EntityList";
import Breadcrumbs, { Crumb } from "./Breadcrumbs";
import PartWorkspace from "./PartWorkspace";
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
      partNazev: string;
    }
  | { level: "nastroje" };

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
          Hledat díl, poptávku nebo zákazníka
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="např. Hřídel 1"
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
                    <span className="text-sm text-foreground">{r.partNazev}</span>
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
  onOpenPart: (id: string, nazev: string) => void;
}) {
  const { items, hydrated, add, remove } = useParts(inquiryId);
  return (
    <EntityList
      title="Díly"
      items={items}
      hydrated={hydrated}
      onAdd={add}
      onRemove={remove}
      onOpen={(p) => onOpenPart(p.id, p.nazev)}
      addPlaceholder="Název dílu"
      emptyMessage="Zatím žádné díly. Založ první tlačítkem níže."
      deleteNoun="díl"
    />
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
  if (!hydrated) return null;
  const config = TOOL_OPERATIONS.find((o) => o.id === toolsActive)!;
  const columns = getToolColumns(config);

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
      <DataTable
        title={`Nástroje — ${config.title}`}
        columns={columns}
        rows={byId[toolsActive]}
        onChange={setById[toolsActive]}
        konturaOptions={[]}
        itemKind="nastroj"
      />
    </div>
  );
}

export default function CncApp() {
  const [migrated, setMigrated] = useState(false);
  const [view, setView] = useState<View>({ level: "home" });
  const [toolsActive, setToolsActive] = useState<string>(TOOL_OPERATIONS[0].id);

  useEffect(() => {
    migrateLegacyDataIfNeeded().then(() => setMigrated(true));
  }, []);

  let crumbs: Crumb[] = [];
  let current: string | undefined;

  if (view.level === "customer") {
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
    current = view.partNazev;
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
        <TabButton active={view.level !== "nastroje"} onClick={() => setView({ level: "home" })}>
          Domů
        </TabButton>
        <TabButton active={view.level === "nastroje"} onClick={() => setView({ level: "nastroje" })}>
          Nástroje
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
            onOpenPart={(id, nazev) =>
              setView({
                level: "part",
                customerId: view.customerId,
                customerNazev: view.customerNazev,
                inquiryId: view.inquiryId,
                inquiryNazev: view.inquiryNazev,
                partId: id,
                partNazev: nazev,
              })
            }
          />
        ) : view.level === "part" ? (
          <PartWorkspace partId={view.partId} />
        ) : (
          <ToolsView toolsActive={toolsActive} setToolsActive={setToolsActive} />
        )}
      </main>
    </div>
  );
}

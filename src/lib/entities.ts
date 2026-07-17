"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getAll, getAllByIndex, put, del } from "./db";
import { Row } from "./results";

export interface Customer {
  id: string;
  nazev: string;
  createdAt: number;
}

export interface Inquiry {
  id: string;
  customerId: string;
  nazev: string;
  createdAt: number;
}

export interface Part {
  id: string;
  inquiryId: string;
  cisloVykresu: string;
  nazev: string;
  createdAt: number;
}

export interface Position {
  id: string;
  partId: string;
  nazev: string;
  createdAt: number;
  /** Stroj přiřazený k tomuto upnutí (pro dopočet ceny) - volitelné, jedna poloha = jeden stroj. */
  strojId?: string;
}

export interface Machine {
  id: string;
  nazev: string;
  /** Hodinová sazba stroje v Kč/hod. */
  sazba: number;
  createdAt: number;
}

/** Zobrazovací popisek dílu - "číslo výkresu · název", nebo jen název u starších/
 *  migrovaných dílů bez čísla výkresu. */
export function formatPartLabel(part: Pick<Part, "cisloVykresu" | "nazev">): string {
  return part.cisloVykresu ? `${part.cisloVykresu} · ${part.nazev}` : part.nazev;
}

const byNewest = <T extends { createdAt: number }>(a: T, b: T) => b.createdAt - a.createdAt;

interface PartOperationRowsRecord {
  id: string;
  partId: string;
  opId: string;
  rows: Row[];
}

export interface UndoEntry {
  label: string;
  restore: () => Promise<void>;
}

// Jednoduchý externí store (mimo React strom) pro "poslední smazané, obnovit" -
// zásahy do dat (mazání zákazníka/poptávky/dílu/polohy) mohou přijít z různých
// komponent, takže se hodí jedno globální místo místo prokládání přes props/context.
let undoEntry: UndoEntry | null = null;
const undoListeners = new Set<() => void>();

function setUndoEntry(entry: UndoEntry | null) {
  undoEntry = entry;
  undoListeners.forEach((l) => l());
}

// Obnovení zapisuje do IndexedDB mimo "svůj" hook (může se týkat úplně jiné
// komponenty, než která zrovna mazala) - ostatní use*() hooky se přes tuhle
// událost dozví, že mají znovu načíst svoje data z DB.
const DATA_RESTORED_EVENT = "cnc:data-restored";

function useReloadOnRestore(reload: () => void) {
  useEffect(() => {
    window.addEventListener(DATA_RESTORED_EVENT, reload);
    return () => window.removeEventListener(DATA_RESTORED_EVENT, reload);
  });
}

/** Zobrazí "poslední smazané, obnovit" toast (viz UndoToast.tsx u kořene appky). */
export function useUndoDelete() {
  const entry = useSyncExternalStore(
    (cb) => {
      undoListeners.add(cb);
      return () => undoListeners.delete(cb);
    },
    () => undoEntry,
    () => null
  );

  const restore = async () => {
    if (!entry) return;
    setUndoEntry(null);
    await entry.restore();
    window.dispatchEvent(new Event(DATA_RESTORED_EVENT));
  };

  const dismiss = () => setUndoEntry(null);

  return { entry, restore, dismiss };
}

/** Pokud díl ještě nemá žádnou polohu, založí výchozí "Poloha 1" - schválně se
 *  stejným id jako má díl. Díky tomu starší operační řádky uložené pod id dílu
 *  (z doby před zavedením poloh) automaticky "patří" téhle poloze, aniž by se
 *  cokoli kopírovalo. Volá se jak hned při založení dílu, tak líně (safety net)
 *  z usePositions při prvním zobrazení staršího dílu. */
export async function ensureDefaultPosition(partId: string): Promise<void> {
  const existing = await getAllByIndex<Position>("positions", "partId", partId);
  if (existing.length > 0) return;
  await put<Position>("positions", { id: partId, partId, nazev: "Poloha 1", createdAt: Date.now() });
}

async function deletePositionCascade(positionId: string): Promise<void> {
  const rows = await getAllByIndex<{ id: string }>("partOperationRows", "partId", positionId);
  await Promise.all(rows.map((r) => del("partOperationRows", r.id)));
  await del("positions", positionId);
}

async function deletePartCascade(partId: string): Promise<void> {
  const positions = await getAllByIndex<Position>("positions", "partId", partId);
  await Promise.all(positions.map((p) => deletePositionCascade(p.id)));
  await del("parts", partId);
}

async function deleteInquiryCascade(inquiryId: string): Promise<void> {
  const parts = await getAllByIndex<Part>("parts", "inquiryId", inquiryId);
  await Promise.all(parts.map((p) => deletePartCascade(p.id)));
  await del("inquiries", inquiryId);
}

async function deleteCustomerCascade(customerId: string): Promise<void> {
  const inquiries = await getAllByIndex<Inquiry>("inquiries", "customerId", customerId);
  await Promise.all(inquiries.map((i) => deleteInquiryCascade(i.id)));
  await del("customers", customerId);
}

// --- Snapshoty celého podstromu pro undo mazání - zachytí se PŘED cascade
// smazáním výše, a při "Vrátit zpět" se stejným tvarem zase zapíšou zpátky. ---

interface PositionSnapshot {
  position: Position;
  rows: PartOperationRowsRecord[];
}
interface PartSnapshot {
  part: Part;
  positions: PositionSnapshot[];
}
interface InquirySnapshot {
  inquiry: Inquiry;
  parts: PartSnapshot[];
}
interface CustomerSnapshot {
  customer: Customer;
  inquiries: InquirySnapshot[];
}

async function snapshotPosition(position: Position): Promise<PositionSnapshot> {
  const rows = await getAllByIndex<PartOperationRowsRecord>("partOperationRows", "partId", position.id);
  return { position, rows };
}
async function snapshotPart(part: Part): Promise<PartSnapshot> {
  const positions = await getAllByIndex<Position>("positions", "partId", part.id);
  return { part, positions: await Promise.all(positions.map(snapshotPosition)) };
}
async function snapshotInquiry(inquiry: Inquiry): Promise<InquirySnapshot> {
  const parts = await getAllByIndex<Part>("parts", "inquiryId", inquiry.id);
  return { inquiry, parts: await Promise.all(parts.map(snapshotPart)) };
}
async function snapshotCustomer(customer: Customer): Promise<CustomerSnapshot> {
  const inquiries = await getAllByIndex<Inquiry>("inquiries", "customerId", customer.id);
  return { customer, inquiries: await Promise.all(inquiries.map(snapshotInquiry)) };
}

async function restorePosition(s: PositionSnapshot): Promise<void> {
  await put("positions", s.position);
  await Promise.all(s.rows.map((r) => put("partOperationRows", r)));
}
async function restorePart(s: PartSnapshot): Promise<void> {
  await put("parts", s.part);
  await Promise.all(s.positions.map(restorePosition));
}
async function restoreInquiry(s: InquirySnapshot): Promise<void> {
  await put("inquiries", s.inquiry);
  await Promise.all(s.parts.map(restorePart));
}
async function restoreCustomer(s: CustomerSnapshot): Promise<void> {
  await put("customers", s.customer);
  await Promise.all(s.inquiries.map(restoreInquiry));
}

/** Stroje jsou globální katalog (nezávislý na dílu), stejně jako katalog nástrojů. */
export function useMachines() {
  const [items, setItems] = useState<Machine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const reload = () => {
    getAll<Machine>("machines").then((rows) => {
      setItems(rows.sort(byNewest));
      setHydrated(true);
    });
  };

  useEffect(() => {
    reload();
  }, []);
  useReloadOnRestore(reload);

  const add = async (nazev: string, sazba: number) => {
    await put<Machine>("machines", { id: crypto.randomUUID(), nazev, sazba, createdAt: Date.now() });
    reload();
  };

  const remove = async (id: string) => {
    await del("machines", id);
    reload();
  };

  return { items, hydrated, add, remove };
}

export function useCustomers() {
  const [items, setItems] = useState<Customer[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const reload = () => {
    getAll<Customer>("customers").then((rows) => {
      setItems(rows.sort(byNewest));
      setHydrated(true);
    });
  };

  useEffect(() => {
    reload();
  }, []);
  useReloadOnRestore(reload);

  const add = async (nazev: string) => {
    await put<Customer>("customers", { id: crypto.randomUUID(), nazev, createdAt: Date.now() });
    reload();
  };

  const remove = async (id: string) => {
    const item = items.find((c) => c.id === id);
    if (!item) return;
    const snap = await snapshotCustomer(item);
    await deleteCustomerCascade(id);
    setUndoEntry({ label: `zákazník „${item.nazev}“`, restore: () => restoreCustomer(snap) });
    reload();
  };

  return { items, hydrated, add, remove };
}

export function useInquiries(customerId: string) {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const reload = () => {
    getAllByIndex<Inquiry>("inquiries", "customerId", customerId).then((rows) => {
      setItems(rows.sort(byNewest));
      setHydrated(true);
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload zavírá nad customerId
  }, [customerId]);
  useReloadOnRestore(reload);

  const add = async (nazev: string) => {
    await put<Inquiry>("inquiries", { id: crypto.randomUUID(), customerId, nazev, createdAt: Date.now() });
    reload();
  };

  const remove = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const snap = await snapshotInquiry(item);
    await deleteInquiryCascade(id);
    setUndoEntry({ label: `poptávka/zakázka „${item.nazev}“`, restore: () => restoreInquiry(snap) });
    reload();
  };

  return { items, hydrated, add, remove };
}

export function useParts(inquiryId: string) {
  const [items, setItems] = useState<Part[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const reload = () => {
    getAllByIndex<Part>("parts", "inquiryId", inquiryId).then((rows) => {
      setItems(rows.sort(byNewest));
      setHydrated(true);
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload zavírá nad inquiryId
  }, [inquiryId]);
  useReloadOnRestore(reload);

  const add = async (cisloVykresu: string, nazev: string) => {
    const id = crypto.randomUUID();
    await put<Part>("parts", { id, inquiryId, cisloVykresu, nazev, createdAt: Date.now() });
    await ensureDefaultPosition(id);
    reload();
  };

  const remove = async (id: string) => {
    const item = items.find((p) => p.id === id);
    if (!item) return;
    const snap = await snapshotPart(item);
    await deletePartCascade(id);
    setUndoEntry({ label: `díl „${formatPartLabel(item)}“`, restore: () => restorePart(snap) });
    reload();
  };

  return { items, hydrated, add, remove };
}

/** Polohy (upnutí) dílu. Běžný díl má jednu, kterou appka nikde jako výběr
 *  neukazuje (viz PartRouter v CncApp.tsx) - "objeví" se, až jich je víc. */
export function usePositions(partId: string) {
  const [items, setItems] = useState<Position[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const reload = () => {
    (async () => {
      let rows = await getAllByIndex<Position>("positions", "partId", partId);
      if (rows.length === 0) {
        await ensureDefaultPosition(partId);
        rows = await getAllByIndex<Position>("positions", "partId", partId);
      }
      setItems(rows.sort(byNewest));
      setHydrated(true);
    })();
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload zavírá nad partId
  }, [partId]);
  useReloadOnRestore(reload);

  const add = async (nazev: string) => {
    await put<Position>("positions", { id: crypto.randomUUID(), partId, nazev, createdAt: Date.now() });
    reload();
  };

  const remove = async (id: string) => {
    if (items.length <= 1) return; // díl musí mít vždy aspoň jednu polohu
    const item = items.find((p) => p.id === id);
    if (!item) return;
    const snap = await snapshotPosition(item);
    await deletePositionCascade(id);
    setUndoEntry({ label: `poloha „${item.nazev}“`, restore: () => restorePosition(snap) });
    reload();
  };

  const setStroj = async (id: string, strojId: string | undefined) => {
    const current = items.find((p) => p.id === id);
    if (!current) return;
    await put<Position>("positions", { ...current, strojId });
    reload();
  };

  return { items, hydrated, add, remove, setStroj };
}

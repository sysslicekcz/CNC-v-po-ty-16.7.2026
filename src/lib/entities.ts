"use client";

import { useEffect, useState } from "react";
import { getAll, getAllByIndex, put, del } from "./db";

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
}

/** Zobrazovací popisek dílu - "číslo výkresu · název", nebo jen název u starších/
 *  migrovaných dílů bez čísla výkresu. */
export function formatPartLabel(part: Pick<Part, "cisloVykresu" | "nazev">): string {
  return part.cisloVykresu ? `${part.cisloVykresu} · ${part.nazev}` : part.nazev;
}

const byNewest = <T extends { createdAt: number }>(a: T, b: T) => b.createdAt - a.createdAt;

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

  const add = async (nazev: string) => {
    await put<Customer>("customers", { id: crypto.randomUUID(), nazev, createdAt: Date.now() });
    reload();
  };

  const remove = async (id: string) => {
    await deleteCustomerCascade(id);
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

  const add = async (nazev: string) => {
    await put<Inquiry>("inquiries", { id: crypto.randomUUID(), customerId, nazev, createdAt: Date.now() });
    reload();
  };

  const remove = async (id: string) => {
    await deleteInquiryCascade(id);
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

  const add = async (cisloVykresu: string, nazev: string) => {
    const id = crypto.randomUUID();
    await put<Part>("parts", { id, inquiryId, cisloVykresu, nazev, createdAt: Date.now() });
    await ensureDefaultPosition(id);
    reload();
  };

  const remove = async (id: string) => {
    await deletePartCascade(id);
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

  const add = async (nazev: string) => {
    await put<Position>("positions", { id: crypto.randomUUID(), partId, nazev, createdAt: Date.now() });
    reload();
  };

  const remove = async (id: string) => {
    if (items.length <= 1) return; // díl musí mít vždy aspoň jednu polohu
    await deletePositionCascade(id);
    reload();
  };

  return { items, hydrated, add, remove };
}

"use client";

import { useEffect, useState } from "react";
import { getAll } from "./db";
import { Customer, Inquiry, Part } from "./entities";

export interface SearchEntry {
  customerId: string;
  customerNazev: string;
  inquiryId: string;
  inquiryNazev: string;
  partId: string;
  partNazev: string;
}

async function buildIndex(): Promise<SearchEntry[]> {
  const [customers, inquiries, parts] = await Promise.all([
    getAll<Customer>("customers"),
    getAll<Inquiry>("inquiries"),
    getAll<Part>("parts"),
  ]);
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const inquiryById = new Map(inquiries.map((i) => [i.id, i]));

  const entries: SearchEntry[] = [];
  for (const part of parts) {
    const inquiry = inquiryById.get(part.inquiryId);
    if (!inquiry) continue;
    const customer = customerById.get(inquiry.customerId);
    if (!customer) continue;
    entries.push({
      customerId: customer.id,
      customerNazev: customer.nazev,
      inquiryId: inquiry.id,
      inquiryNazev: inquiry.nazev,
      partId: part.id,
      partNazev: part.nazev,
    });
  }
  return entries;
}

/** Lehký index zákazník/poptávka/díl pro vyhledávání na Domů. Znovu se natáhne
 *  při každém mountu (Domů se re-mountuje při každém návratu z jiné úrovně). */
export function useSearchIndex() {
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    buildIndex().then((e) => {
      setEntries(e);
      setHydrated(true);
    });
  }, []);

  return { entries, hydrated };
}

export function filterEntries(entries: SearchEntry[], query: string): SearchEntry[] {
  const q = query.trim().toLocaleLowerCase("cs");
  if (!q) return [];
  return entries.filter(
    (e) =>
      e.partNazev.toLocaleLowerCase("cs").includes(q) ||
      e.inquiryNazev.toLocaleLowerCase("cs").includes(q) ||
      e.customerNazev.toLocaleLowerCase("cs").includes(q)
  );
}

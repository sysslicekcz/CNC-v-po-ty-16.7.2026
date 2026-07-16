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
  nazev: string;
  createdAt: number;
}

const byNewest = <T extends { createdAt: number }>(a: T, b: T) => b.createdAt - a.createdAt;

async function deletePartCascade(partId: string): Promise<void> {
  const rows = await getAllByIndex<{ id: string }>("partOperationRows", "partId", partId);
  await Promise.all(rows.map((r) => del("partOperationRows", r.id)));
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

  const add = async (nazev: string) => {
    await put<Part>("parts", { id: crypto.randomUUID(), inquiryId, nazev, createdAt: Date.now() });
    reload();
  };

  const remove = async (id: string) => {
    await deletePartCascade(id);
    reload();
  };

  return { items, hydrated, add, remove };
}

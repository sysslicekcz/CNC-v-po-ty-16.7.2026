"use client";

import { useEffect, useState } from "react";
import { Row } from "./results";

const STORAGE_PREFIX = "cnc-casovac:";

export function useLocalRows(operationId: string) {
  const key = STORAGE_PREFIX + operationId;
  const [rows, setRows] = useState<Row[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage on mount
      if (raw) setRows(JSON.parse(raw));
    } catch {
      // ignore corrupted storage
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(key, JSON.stringify(rows));
  }, [rows, hydrated, key]);

  return { rows, setRows, hydrated };
}

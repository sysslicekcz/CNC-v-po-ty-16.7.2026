"use client";

import { useEffect, useState } from "react";
import { GetFeatureAccessSnapshotUseCase } from "@/application/licensing/get-feature-access-snapshot-use-case";
import { FeatureAccessSnapshot } from "@/application/licensing/feature-access-snapshot";

/** Načte `FeatureAccessSnapshot` JEDNOU při připojení komponenty a předá ho
 *  dolů přes `FeatureGate` (zadání Krok 4, bod 17: "jedno načtení pro celou
 *  obrazovku/session", ne dotaz za každé tlačítko zvlášť). */
export function useFeatureAccessSnapshot(useCase: GetFeatureAccessSnapshotUseCase): FeatureAccessSnapshot | null {
  const [snapshot, setSnapshot] = useState<FeatureAccessSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    useCase
      .execute()
      .then((result) => {
        if (!cancelled) setSnapshot(result);
      })
      .catch((error) => {
        console.error("[FeatureAccessSnapshot] načtení selhalo:", error);
      });
    return () => {
      cancelled = true;
    };
  }, [useCase]);

  return snapshot;
}

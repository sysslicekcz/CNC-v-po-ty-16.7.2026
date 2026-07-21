import { ManualTimeProfileSnapshot } from "./manual-time-profile-snapshot";
import type { ManualQuantityBasis } from "./manual-operation-subtype";
import type { ManualTimeStandardSource } from "./manual-time-standard";

/** Typovaný "pohled" na `ManualTimeProfileSnapshot.resolvedData` (AP-MCE-001
 *  Fáze F §1/§5) - stejný důvod jako Fáze C/D/E `*-context-views.ts`, JEDINÉ
 *  místo, které z plochého tvaru čte konkrétní, typovaná pole. */
export interface ManualTimeStandardView {
  baseTimeMin: number;
  quantityBasis: ManualQuantityBasis;
  source: ManualTimeStandardSource;
  standardName: string;
  standardVersion: string;
}

export function readManualTimeStandardView(snapshot: ManualTimeProfileSnapshot): ManualTimeStandardView {
  const data = snapshot.resolvedData as Record<string, unknown>;
  return {
    baseTimeMin: data.baseTimeMin as number,
    quantityBasis: data.quantityBasis as ManualQuantityBasis,
    source: data.source as ManualTimeStandardSource,
    standardName: data.standardName as string,
    standardVersion: data.standardVersion as string,
  };
}

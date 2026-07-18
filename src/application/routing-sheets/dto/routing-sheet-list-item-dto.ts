import { RoutingSheetStav } from "@/domain/aggregates/routing-sheet/routing-sheet";

/** Souhrnný řádek pro seznam technologických postupů (Krok 4, zadání bod 34) -
 *  lehčí než plný `RoutingSheetEditorDto` (žádné Operation/Position/Activity
 *  detaily), počítá se jen `operationCount`. */
export interface RoutingSheetListItemDto {
  id: string;
  partId: string;
  drawingNumber: string;
  partName: string;
  revision: number;
  status: RoutingSheetStav;
  operationCount: number;
  isDefault: boolean;
  updatedAt?: string;
  releasedAt?: string;
}

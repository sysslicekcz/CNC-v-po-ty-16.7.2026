"use client";

import { useParams } from "next/navigation";
import { RoutingSheetEditorPage } from "@/presentation/routing-sheets/routing-sheet-editor-page";

/** Tenká route obálka (Krok 4) - client component, `id` čte přes `useParams`
 *  (viz node_modules/next/dist/docs/01-app - dynamické segmenty jsou v této
 *  verzi Next.js Promise, ale `useParams` v Client Component obchází await).
 *  RoutingSheet ID obsahuje ":" (`tpv-routing-sheet:<uuid>`), který se v URL
 *  segmentu ukládá percent-encoded - `useParams` v této verzi Next.js ho
 *  nedekóduje automaticky, proto explicitní `decodeURIComponent` (ověřeno
 *  ručním testem v prohlížeči - bez něj `GetRoutingSheetEditorUseCase` hledal
 *  neexistující ID a hlásil NotFoundError). */
export default function RoutingSheetEditorRoutePage() {
  const params = useParams<{ id: string }>();
  return <RoutingSheetEditorPage routingSheetId={decodeURIComponent(params.id)} />;
}

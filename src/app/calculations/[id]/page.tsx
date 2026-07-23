"use client";

import { useParams } from "next/navigation";
import { CalculationResultPage } from "@/presentation/calculations/calculation-result-page";

/** Tenká route obálka - stejný vzor jako `tpv/routing-sheets/[id]/page.tsx`
 *  (client component, `id` přes `useParams`, obchází Next.js 15 Promise
 *  `params`). */
export default function CalculationResultRoutePage() {
  const params = useParams<{ id: string }>();
  return <CalculationResultPage calculationId={decodeURIComponent(params.id)} />;
}

"use client";

import { Suspense } from "react";
import { NewCalculationWizard } from "@/presentation/calculations/new-calculation-wizard";

export default function Page() {
  return (
    <Suspense fallback={<div className="px-6 py-8 text-sm text-muted">Načítám…</div>}>
      <NewCalculationWizard />
    </Suspense>
  );
}

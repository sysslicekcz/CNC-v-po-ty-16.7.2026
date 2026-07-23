"use client";

import { Suspense } from "react";
import { ToolComparisonPage } from "@/presentation/calculations/comparison-pages";

export default function Page() {
  return (
    <Suspense fallback={<div className="px-6 py-8 text-sm text-muted">Načítám…</div>}>
      <ToolComparisonPage />
    </Suspense>
  );
}

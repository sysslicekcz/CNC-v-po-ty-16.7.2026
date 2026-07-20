/**
 * Životní cyklus jednoho `CalculationResult` (AP-MCE-001 §09/§12). Pojmenování
 * záměrně stejné jako u existujícího `MigrationRunRecord.status`
 * (`infrastructure/persistence/indexeddb/records/migration-records.ts`) -
 * `pending` → `completed`/`completed_with_warnings`/`failed`, žádný nový vzor
 * stavů pro totéž. Prezentační vrstva (mimo rozsah Fáze A) si může "ok"/
 * "ok_with_warnings" z AP-MCE-001 §12 odvodit mapováním, doména ale používá
 * tenhle plnější, konzistentní název.
 *
 * `superseded` pokrývá AP-MCE-001 §15 - výsledek, který nahradila novější
 * revize (nikdy se nemaže, jen se takhle označí, viz `CalculationResult`).
 */
export type CalculationStatus = "pending" | "completed" | "completed_with_warnings" | "failed" | "superseded";

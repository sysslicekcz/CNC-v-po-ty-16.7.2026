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
 *
 * AP-MCE-001 Fáze H §14 - ADITIVNÍ rozšíření o schvalovací workflow
 * ("Draft, Calculated, Approved"): `needs_review`/`approved`/`rejected`/
 * `archived` jsou NOVÉ stavy nad rámec Fáze A. `draft`/`validating` ze
 * zadání §14 NEJSOU tady - ty popisují stav PŘED vznikem `CalculationResult`
 * (rozpracovaný formulář průvodce), pokrývá je nová entita `CalculationDraft`
 * (Fáze H), ne tenhle enum. Žádná existující strategie/use case tyhle nové
 * hodnoty nenastavuje - jen nové Fáze H use cases (`SubmitCalculationForReview
 * UseCase`/`ApproveCalculationUseCase`/`RejectCalculationUseCase`/
 * `ArchiveCalculationUseCase`), takže rozšíření je čistě aditivní.
 */
export type CalculationStatus =
  | "pending"
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "superseded"
  | "needs_review"
  | "approved"
  | "rejected"
  | "archived";

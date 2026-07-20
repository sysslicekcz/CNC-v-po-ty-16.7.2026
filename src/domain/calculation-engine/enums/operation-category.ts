/**
 * Diskriminátor typu operace pro `CalculationStrategyRegistry.resolve(...)`
 * (AP-MCE-001 §11) - ZÁMĚRNĚ jen re-export existujícího
 * `OperationType.kategorie` (`domain/entities/operation-type.ts`), ne nový,
 * konkurenční enum. Kmenová data (Krok 5) už přesně tenhle rozsah hodnot mají
 * ("turning"/"milling"/"grinding"/"cutting"/"inspection"/"ndt"/"preparation"/
 * "other"), včetně kategorií, které AP-MCE-001 §02 vědomě nechává mimo MVP
 * ("ndt", "other") - Manufacturing Calculation Engine na ně jen ukazuje
 * stejným typem, aby přidání strategie pro novou kategorii (Fáze pozdější než
 * G) nikdy nevyžadovalo změnu tohoto souboru.
 */
export type { OperationCategory } from "@/domain/entities/operation-type";

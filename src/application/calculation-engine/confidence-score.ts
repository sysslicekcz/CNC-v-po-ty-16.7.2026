import { CalculationIssue } from "@/domain/calculation-engine/entities/types";

/**
 * MVP heuristika pro `CalculationResult.confidenceScore` (AP-MCE-001 §24:
 * "žádná kalibrační historie ještě neexistuje, na které by šlo postavit
 * datově podloženou definici - MVP heuristika penalizuje výstrahy, přesná
 * definice se revidovala, až Fáze G/§13 dodá kalibrační data").
 *
 * Fáze A: každý `warning` sráží skóre o 0.1, `information`/`recommendation`
 * ho nemění (nejsou to problémy s výsledkem, jen doplňkový kontext), dolní
 * mez 0.5 - i hodně varování pořád dá "spočítáno, ale zkontrolujte", ne
 * "nedůvěryhodné". Volající s `blocked` výsledkem (`status === "failed"`)
 * tuhle funkci vůbec nevolá - neúspěšný výpočet nemá skóre, viz
 * `CalculationResult.create`.
 */
export function computeConfidenceScore(issues: readonly CalculationIssue[]): number {
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  return Math.max(0.5, 1 - warningCount * 0.1);
}

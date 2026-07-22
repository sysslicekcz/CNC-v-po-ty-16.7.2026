import type { OperationCategory } from "../enums/operation-category";
import { ExternalReferenceSummary } from "../shared/external-reference-summary";
import { CalculationIssue } from "../entities/types";
import { calibrationIssue } from "./calibration-issue-codes";
import { ActualTimeRecord } from "./actual-time-record";

export type ActualTimeMatchStatus = "matched" | "ambiguous" | "unmatched" | "manually_matched" | "rejected_match";
export type ActualTimeMatchMethod = "explicit_calculation_id" | "external_operation_reference" | "production_order_and_sequence" | "item_type_machine_period" | "manual";

/** Nízká confidence nesmí vytvořit automatické schválené spárování (§6) -
 *  metoda, jejíž vlastní confidence je POD touhle hranicí, i jediného
 *  kandidáta vrátí jako `"ambiguous"` (čeká na ruční potvrzení), ne `"matched"`. */
const MIN_AUTO_MATCH_CONFIDENCE = 0.6;

/** Zúžený výřez `CalculationResult`/`CalculationRequest` (Application vrstva
 *  je NAČTE z repozitáře PŘED voláním matcheru, viz stejný "pure Domain
 *  dostane už načtené kandidáty" vzor jako `resolveManualTimeStandard`) - jen
 *  pole, která matching skutečně potřebuje. */
export interface CalculationCandidateForMatching {
  calculationId: string;
  calculationRevision: number;
  operationCategory: OperationCategory;
  machineId?: string;
  externalReferences: readonly ExternalReferenceSummary[];
  productionOrderId?: string;
  operationSequence?: number;
  calculatedAt: string;
}

export interface ActualTimeMatchResult {
  matchedCalculationId?: string;
  matchedRevision?: number;
  matchMethod?: ActualTimeMatchMethod;
  confidence: number;
  status: ActualTimeMatchStatus;
  warnings: CalculationIssue[];
  alternativeCandidates: readonly CalculationCandidateForMatching[];
}

function referencesOverlap(a: readonly ExternalReferenceSummary[], b: readonly ExternalReferenceSummary[]): boolean {
  return a.some((refA) => b.some((refB) => refA.externalSystemId === refB.externalSystemId && refA.externalEntityType === refB.externalEntityType && ((refA.externalId !== undefined && refA.externalId === refB.externalId) || (refA.externalCode !== undefined && refA.externalCode === refB.externalCode))));
}

function withinPeriod(record: ActualTimeRecord, candidate: CalculationCandidateForMatching, windowDays = 90): boolean {
  const reference = record.productionStartedAt ?? record.recordedAt;
  const diffMs = Math.abs(new Date(reference).getTime() - new Date(candidate.calculatedAt).getTime());
  return diffMs <= windowDays * 24 * 60 * 60 * 1000;
}

function toResult(status: ActualTimeMatchStatus, method: ActualTimeMatchMethod | undefined, confidence: number, matched: CalculationCandidateForMatching | undefined, alternatives: readonly CalculationCandidateForMatching[], warnings: CalculationIssue[]): ActualTimeMatchResult {
  return {
    matchedCalculationId: matched?.calculationId,
    matchedRevision: matched?.calculationRevision,
    matchMethod: method,
    confidence,
    status,
    warnings,
    alternativeCandidates: alternatives,
  };
}

/** Jeden match nalezený konkrétní úrovní priority - `resolveSingleMatch`
 *  rozhodne, jestli se smí stát `"matched"` (confidence nad prahem), nebo
 *  zůstává `"ambiguous"` a čeká na ruční potvrzení (§6 "Nízká důvěryhodnost
 *  nesmí vytvořit automatické schválené spárování") - JEDNO místo pro tohle
 *  pravidlo, aplikované stejně na všechny čtyři úrovně priority. */
function resolveSingleMatch(method: ActualTimeMatchMethod, confidence: number, candidate: CalculationCandidateForMatching): ActualTimeMatchResult {
  if (confidence < MIN_AUTO_MATCH_CONFIDENCE) {
    return toResult("ambiguous", method, confidence, undefined, [candidate], [calibrationIssue("LOW_MATCH_CONFIDENCE", `Spárování metodou '${method}' má nízkou důvěryhodnost (${confidence}) - vyžaduje ruční potvrzení.`)]);
  }
  return toResult("matched", method, confidence, candidate, [], []);
}

function resolveAmbiguousMatch(method: ActualTimeMatchMethod, confidence: number, matches: readonly CalculationCandidateForMatching[], message: string): ActualTimeMatchResult {
  return toResult("ambiguous", method, confidence, undefined, matches, [calibrationIssue("CALCULATION_MATCH_AMBIGUOUS", message)]);
}

/**
 * `ActualTimeCalculationMatcher` (AP-MCE-001 Fáze G §6) - ČISTÁ funkce,
 * priorita PŘESNĚ podle zadání: (1) explicitní `calculationId`+revize, (2)
 * external operation reference, (3) production order + operation sequence,
 * (4) kategorie operace + stroj + časové období (MVP náhrada za
 * "drawing/item" - appka zatím nemá samostatnou "výkres" entitu, nejbližší
 * dostupné kritérium je `operationCategory` + `machineId`, zdokumentovaná
 * náhrada), (5) ruční spárování (mimo tuhle funkci - `status: "unmatched"`
 * čeká na `MatchActualTimeToCalculationUseCase` s explicitním `calculationId`
 * od uživatele, výsledný stav je pak `"manually_matched"`).
 */
export function matchActualTimeToCalculation(record: ActualTimeRecord, candidates: readonly CalculationCandidateForMatching[]): ActualTimeMatchResult {
  // 1. explicitní calculationId (+ volitelně revize)
  if (record.calculationId) {
    const exact = candidates.filter((c) => c.calculationId === record.calculationId && (record.calculationRevision === undefined || c.calculationRevision === record.calculationRevision));
    if (exact.length === 1) return resolveSingleMatch("explicit_calculation_id", 1, exact[0]);
    if (exact.length > 1) return resolveAmbiguousMatch("explicit_calculation_id", 1, exact, `Pro calculationId "${record.calculationId}" existuje víc odpovídajících revizí.`);
  }

  // 2. external operation reference
  if (record.externalReferences.length > 0) {
    const matches = candidates.filter((c) => referencesOverlap(c.externalReferences, record.externalReferences));
    if (matches.length === 1) return resolveSingleMatch("external_operation_reference", 0.9, matches[0]);
    if (matches.length > 1) return resolveAmbiguousMatch("external_operation_reference", 0.9, matches, "Externí reference odkazuje na víc výpočtů zároveň.");
  }

  // 3. production order + operation sequence
  if (record.productionOrderId && record.operationSequence !== undefined) {
    const matches = candidates.filter((c) => c.productionOrderId === record.productionOrderId && c.operationSequence === record.operationSequence);
    if (matches.length === 1) return resolveSingleMatch("production_order_and_sequence", 0.8, matches[0]);
    if (matches.length > 1) return resolveAmbiguousMatch("production_order_and_sequence", 0.8, matches, "Výrobní zakázka + pořadí operace odpovídá víc výpočtům.");
  }

  // 4. kategorie operace + stroj + časové období (MVP náhrada za "drawing/item")
  const periodMatches = candidates.filter((c) => c.operationCategory === record.operationCategory && (!record.machineId || !c.machineId || c.machineId === record.machineId) && withinPeriod(record, c));
  if (periodMatches.length === 1) return resolveSingleMatch("item_type_machine_period", 0.5, periodMatches[0]);
  if (periodMatches.length > 1) return resolveAmbiguousMatch("item_type_machine_period", 0.5, periodMatches, "Víc výpočtů odpovídá kategorii/stroji/období.");

  return toResult("unmatched", undefined, 0, undefined, [], [calibrationIssue("CALCULATION_MATCH_NOT_FOUND", `Pro ActualTimeRecord "${record.id}" nebyl nalezen žádný odpovídající výpočet.`)]);
}

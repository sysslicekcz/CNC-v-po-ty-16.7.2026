import { ValidationError } from "@/domain/errors/validation-error";

/**
 * Devět podporovaných režimů výběru vzorku (AP-MCE-001 Fáze F §8, přesné
 * názvy ze zadání) - určuje, KOLIK kusů z dávky se skutečně kontroluje
 * (`inspectedPieceCount`), nikoliv jak dlouho trvá kontrola JEDNOHO kusu (to
 * řeší `inspection-calculation-strategy.ts` §10).
 */
export type InspectionSamplingMode =
  | "first_piece_only"
  | "every_piece"
  | "every_nth_piece"
  | "fixed_sample_size"
  | "percentage_sample"
  | "first_and_last"
  | "first_middle_last"
  | "batch_based"
  | "custom_explicit";

export interface SamplingPlanInput {
  mode: InspectionSamplingMode;
  quantity: number;
  /** `every_nth_piece` - frekvence N (kontroluje se každý N-tý kus). */
  frequency?: number;
  /** `percentage_sample` - podíl 0..1. */
  percentage?: number;
  /** `fixed_sample_size` - pevný počet kusů. */
  sampleSize?: number;
  /** `batch_based` - velikost dávky, ze které se kontroluje 1 kus. */
  batchSize?: number;
  /** `custom_explicit` - explicitně zadaný, už rozhodnutý počet kusů. */
  explicitCount?: number;
}

export interface SamplingPlanResult {
  inspectedPieceCount: number;
  mode: InspectionSamplingMode;
  formula: string;
  /** Popis výběru (AP-MCE-001 Fáze F §8 "sampleIndexes nebo popis výběru") -
   *  MVP zjednodušení na slovní popis místo konkrétních indexů kusů (žádná
   *  strategie zatím nepotřebuje vědět KTERÉ konkrétní kusy, jen KOLIK). */
  selectionDescription: string;
  /** `true`, pokud parametr specifický pro režim chyběl a použila se
   *  zdokumentovaná výchozí hodnota (§8 "warningy") - volající si podle toho
   *  přidá `SAMPLING_RULE_DEFAULTED`. */
  wasDefaulted: boolean;
}

/**
 * `resolveSampleCount` (AP-MCE-001 Fáze F §8) - ČISTÁ, deterministická
 * funkce, PŘESNÉ vzorce pro `every_nth_piece`/`percentage_sample`/
 * `first_and_last` podle zadání, zbylých šest režimů zdokumentováno stejnou
 * disciplínou. "Pokud se později přidají normované sampling plány, nesmí
 * být nutné přepisovat InspectionCalculationStrategy" (§8) - proto strategie
 * čte jen `{ inspectedPieceCount, formula, ... }`, nikdy vlastní switch podle
 * `mode`.
 */
export function resolveSampleCount(input: SamplingPlanInput): SamplingPlanResult {
  const { mode, quantity } = input;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ValidationError(`resolveSampleCount: 'quantity' musí být kladné celé číslo, dostal jsem "${quantity}".`);
  }

  switch (mode) {
    case "first_piece_only":
      return { inspectedPieceCount: Math.min(1, quantity), mode, formula: "min(1, quantity)", selectionDescription: "první kus", wasDefaulted: false };
    case "every_piece":
      return { inspectedPieceCount: quantity, mode, formula: "quantity", selectionDescription: "všechny kusy (100 %)", wasDefaulted: false };
    case "every_nth_piece": {
      const wasDefaulted = input.frequency === undefined;
      const frequency = input.frequency ?? 1;
      if (!Number.isInteger(frequency) || frequency <= 0) {
        throw new ValidationError(`resolveSampleCount: 'frequency' musí být kladné celé číslo, dostal jsem "${frequency}".`);
      }
      return {
        inspectedPieceCount: Math.ceil(quantity / frequency),
        mode,
        formula: "ceil(quantity / frequency)",
        selectionDescription: `každý ${frequency}. kus`,
        wasDefaulted,
      };
    }
    case "fixed_sample_size": {
      const wasDefaulted = input.sampleSize === undefined;
      const sampleSize = input.sampleSize ?? quantity;
      if (!Number.isInteger(sampleSize) || sampleSize <= 0) {
        throw new ValidationError(`resolveSampleCount: 'sampleSize' musí být kladné celé číslo, dostal jsem "${sampleSize}".`);
      }
      return { inspectedPieceCount: Math.min(sampleSize, quantity), mode, formula: "min(sampleSize, quantity)", selectionDescription: `pevný vzorek ${sampleSize} ks`, wasDefaulted };
    }
    case "percentage_sample": {
      const wasDefaulted = input.percentage === undefined;
      const percentage = input.percentage ?? 1;
      if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 1) {
        throw new ValidationError(`resolveSampleCount: 'percentage' musí být v rozsahu (0, 1], dostal jsem "${percentage}".`);
      }
      return {
        inspectedPieceCount: Math.ceil(quantity * percentage),
        mode,
        formula: "ceil(quantity * percentage)",
        selectionDescription: `${(percentage * 100).toFixed(0)} % dávky`,
        wasDefaulted,
      };
    }
    case "first_and_last":
      return {
        inspectedPieceCount: quantity === 1 ? 1 : 2,
        mode,
        formula: "quantity === 1 ? 1 : 2",
        selectionDescription: quantity === 1 ? "první kus" : "první a poslední kus",
        wasDefaulted: false,
      };
    case "first_middle_last": {
      const inspectedPieceCount = Math.min(quantity, 3);
      return {
        inspectedPieceCount,
        mode,
        formula: "min(quantity, 3)",
        selectionDescription: inspectedPieceCount === 3 ? "první, prostřední a poslední kus" : `${inspectedPieceCount} kus(y) (dávka menší než 3)`,
        wasDefaulted: false,
      };
    }
    case "batch_based": {
      const wasDefaulted = input.batchSize === undefined;
      const batchSize = input.batchSize ?? quantity;
      if (!Number.isInteger(batchSize) || batchSize <= 0) {
        throw new ValidationError(`resolveSampleCount: 'batchSize' musí být kladné celé číslo, dostal jsem "${batchSize}".`);
      }
      return {
        inspectedPieceCount: Math.ceil(quantity / batchSize),
        mode,
        formula: "ceil(quantity / batchSize)",
        selectionDescription: `1 kus na dávku o velikosti ${batchSize}`,
        wasDefaulted,
      };
    }
    case "custom_explicit": {
      const wasDefaulted = input.explicitCount === undefined;
      const explicitCount = input.explicitCount ?? quantity;
      if (!Number.isInteger(explicitCount) || explicitCount < 0) {
        throw new ValidationError(`resolveSampleCount: 'explicitCount' musí být nezáporné celé číslo, dostal jsem "${explicitCount}".`);
      }
      return {
        inspectedPieceCount: Math.min(explicitCount, quantity),
        mode,
        formula: "min(explicitCount, quantity)",
        selectionDescription: "explicitně zadaný výběr",
        wasDefaulted,
      };
    }
    default: {
      const exhaustive: never = mode;
      throw new ValidationError(`resolveSampleCount: neznámý sampling mode "${exhaustive}".`);
    }
  }
}

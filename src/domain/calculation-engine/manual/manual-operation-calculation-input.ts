import { OperationCalculationInputBase } from "../contracts/operation-calculation-input";
import type { ManualOperationSubtype, ProductionSeriality } from "./manual-operation-subtype";
import { ManualOperationFeature } from "./manual-operation-feature";

/**
 * Vstup ruční operace (AP-MCE-001 Fáze F §2) - ADITIVNÍ rozšíření
 * existujícího `OperationCalculationInputBase` (Fáze A), stejný vzor jako
 * Fáze C/D/E. `materialId` (povinné v základu) se dědí beze změny - i ruční
 * operace (odjehlení, balení, ...) se vždy vztahuje ke KONKRÉTNÍMU dílu/
 * materiálu, stejně jako u strojních kategorií.
 *
 * §2 zmiňuje `tenantId`/`siteId` jako pole vstupu - APLIKAČNÍ vrstva
 * (`TenantContext.requireCurrentTenantId()`) je ale JEDINÝ zdroj tenanta pro
 * VŠECHNY existující vstupy (Fáze A-E), domain vstup ho nikdy nenese jako
 * pole (viz `CalculateTurningOperationUseCase` apod.) - zavedení výjimky jen
 * pro Fázi F by bylo nekonzistentní "novou architekturou", proto tahle dvě
 * pole zůstávají mimo `ManualOperationCalculationInput`, tenantId/siteId se
 * i tady řeší přes `TenantContext`.
 */
export interface ManualOperationCalculationInput extends OperationCalculationInputBase {
  workstationId?: string;
  /** §2 "manualOperationSubtype" na úrovni operace - výchozí subtype pro
   *  operace BEZ `features` rozpadu (viz `baseUnitTimeMin`); operace S
   *  featury nese subtype PER FEATURE (`ManualOperationFeature.subtype`,
   *  stejný princip jako Fáze C/D/E "subtype je vlastnost technologického
   *  úseku, ne celé operace"). */
  manualOperationSubtype?: ManualOperationSubtype;
  employeeQualificationId?: string;
  /** Kvalifikace vyžadované operací JAKO CELKEM (nad rámec featurů, které
   *  mohou mít vlastní `employeeQualificationId` požadavek). */
  requiredQualificationIds?: string[];
  productionSeriality?: ProductionSeriality;
  batchSize?: number;
  setupTimeMin?: number;
  preparationTimeMin?: number;
  /** §2 "baseUnitTimeMin" - záložní jednotkový čas na operaci JAKO CELEK,
   *  použije se, pokud operace nemá žádný `features` rozpad (jednoduchý,
   *  jednosegmentový ruční úkon zadaný přímo na operaci). */
  baseUnitTimeMin?: number;
  handlingTimePerPieceMin?: number;
  auxiliaryTimePerPieceMin?: number;
  cleanupTimeMin?: number;
  firstPieceTimeMin?: number;
  interBatchTimeMin?: number;
  waitingTimeMin?: number;
  fixedAllowanceMin?: number;
  percentageAllowance?: number;
  operatorSkillCoefficient?: number;
  complexityCoefficient?: number;
  ergonomicCoefficient?: number;
  fatigueCoefficient?: number;
  workplaceCoefficient?: number;
  calibrationProfileId?: string;
  ruleVersionId?: string;
  notes?: string;

  /** Ruční úseky operace, v pořadí zpracování (§3) - nepovinné (operace bez
   *  featurů použije `baseUnitTimeMin` přímo, viz výš). */
  features?: ManualOperationFeature[];
}

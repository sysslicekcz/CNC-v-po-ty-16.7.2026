import { RuleVersion } from "../rules/rule-version";
import { MaterialProfileSnapshot } from "../profiles/material-profile-snapshot";
import { MachineProfileSnapshot } from "../profiles/machine-profile-snapshot";
import { ToolProfileSnapshot } from "../profiles/tool-profile-snapshot";
import { CuttingConditionSnapshot } from "../cutting-conditions/cutting-condition-snapshot";

/**
 * Vše, co strategie/engine potřebuje NAD RÁMEC samotného vstupu, aby zůstala
 * čistá funkce bez I/O (AP-MCE-001 §11: "strategie je pure - žádný přístup k
 * repozitářům"). Application vrstva (`CalculateOperationUseCase`) kontext
 * sestaví PŘED voláním `CalculationEngine.calculate(...)`.
 *
 * Fáze A nese jen `ruleVersion` - `material`/`machine`/`tool` profily
 * (`MaterialProfile`/`MachineProfile`/`ToolProfile`, AP-MCE-001 §06-08) a
 * `cuttingCondition`/`calibration` přibudou jako ADITIVNÍ, nepovinná pole až
 * ve Fázi B/G (existence materiálu/stroje/nástroje se v Fázi A ověřuje přímo
 * přes existující `MaterialRepository`/`MachineRepository`/`ToolRepository` v
 * use casu, ne přes profil - viz `CalculateOperationUseCase`). Přidání těchto
 * polí nikdy nebude vyžadovat změnu existujících strategií, protože ještě
 * žádná neexistuje (Fáze A neregistruje žádnou konkrétní `CalculationStrategy`).
 */
export interface CalculationContext {
  ruleVersion: RuleVersion;
  /** AP-MCE-001 Fáze B §6 - sestavuje `CalculationContextResolver`
   *  (Application vrstva) PŘED voláním `CalculationEngine.calculate(...)`,
   *  strategie sama repozitáře nikdy nevolá (§06 "strategie nesmí sama
   *  načítat data z repozitáře"). `toolProfileSnapshot` je nepovinný i
   *  koncepčně (operace bez nástroje, např. kontrola/NDT), ostatní jsou
   *  nepovinné jen technicky (dokud je ještě žádná `CalculationStrategy`
   *  v aktuální fázi nevyžaduje - viz Fáze A komentář výše). */
  materialProfileSnapshot?: MaterialProfileSnapshot;
  machineProfileSnapshot?: MachineProfileSnapshot;
  toolProfileSnapshot?: ToolProfileSnapshot;
  cuttingConditionSnapshot?: CuttingConditionSnapshot;
  /** `MachineProfile.calibrationProfileId`, pokud stroj má kalibrační profil
   *  přiřazený - samotná `CalibrationProfile` entita/repozitář je mimo rozsah
   *  Fáze B (zadání žádá jen referenční pole na `MachineProfile`, ne plný
   *  kalibrační model - ten čeká na fázi, která kalibrační data skutečně
   *  používá). */
  calibrationProfileId?: string;
}

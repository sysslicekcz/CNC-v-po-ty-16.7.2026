import { SerializedMoney } from "../../value-objects/money";
import { CuttingParametersProps } from "../../value-objects/cutting-parameters";

export type CalculationInputRow = Record<string, string | number | null>;

export interface OpResult {
  label: string;
  kontura: string;
  cas: number | null; // null = chyba/varování, viz `note`
  note?: string;
}

/** Tvarem odpovídá dnešnímu CalcOutput z lib/calc.ts - doména má vlastní typ, aby
 *  nezávisela na umístění staré implementace. Adapter v infrastructure/calculation
 *  mezi nimi převádí. */
export interface CalcOutput {
  rows: OpResult[];
  total: number;
}

/** Activity musí umět existovat i bez Calculation (kontrola, NDT, odjehlení,
 *  čištění, balení, kooperace, ruční operace) - "calculation" je dnes převažující,
 *  ostatní hodnoty jsou připravené na budoucí moduly. */
export type ActivityKind = "calculation" | "manual" | "inspection" | "ndt" | "external";

export type SerializedHourlyRate = SerializedMoney;
export type SerializedCuttingParameters = CuttingParametersProps;

/** Zamrzlá kopie popisných/cenových údajů stroje a nástroje z okamžiku výpočtu -
 *  pozdější přejmenování/přecenění Machine/Tool nezmění historicky uložený výsledek.
 *  Sestavuje ji Application vrstva (má přístup k MachineRepository/ToolRepository),
 *  doména sama repozitáře nevolá - viz zadání, bod 10. */
export interface CalculationSnapshot {
  machineId?: string;
  machineCode?: string;
  machineName?: string;
  machineHourlyRate?: SerializedHourlyRate;

  toolId?: string;
  toolCode?: string;
  toolName?: string;
  toolTypeId?: string;

  operationTypeId: string;
  operationTypeCode: string;

  cuttingParameters?: SerializedCuttingParameters;

  calculatedAt: string; // ISO 8601
  applicationVersion?: string;
  calculationEngineVersion: string;
  gitCommit?: string;
}

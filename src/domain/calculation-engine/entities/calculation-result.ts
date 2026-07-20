import { ValidationError } from "@/domain/errors/validation-error";
import { InvalidStateError } from "@/domain/errors/invalid-state-error";
import { Time } from "../value-objects/time";
import { CalculationStatus } from "../enums/calculation-status";
import { CalculationBreakdown } from "./calculation-breakdown";
import { CalculationIssue } from "./types";

/**
 * Výsledek jednoho výpočtu (AP-MCE-001 §09/§15) - immutable po vytvoření,
 * stejná disciplína jako existující `Calculation` (ADR 0006): žádné settery,
 * `withManualOverride`/`supersede` vždy vrací NOVOU instanci.
 *
 * `manualOverrideMinutes` je záměrně jen jedno číslo (mirror existujícího
 * `Calculation.manualCorrection`/`finalTime`), NE plnohodnotná `ManualOverride`
 * entita s auditní stopou (uživatel/důvod/revize) - ta je z AP-MCE-001 §09/§14
 * a patří do fáze, která implementuje ruční úpravy jako celek. Tohle pole je
 * vpřed-kompatibilní háček: pozdější fáze může `ManualOverride` entity ukládat
 * VEDLE (přes `CalculationRepository`) a tohle pole dál číst jako "aktuálně
 * platná přepsaná hodnota", beze změny tvaru `CalculationResult` samotného.
 *
 * `supersedesResultId` nese řetězec revizí (AP-MCE-001 §15) - přepočet nikdy
 * nemutuje starý výsledek, jen vytvoří nový se stejnou `calculationRequestId`
 * (typicky jinou) a odkazem na to, co nahrazuje.
 */
export interface CalculationResultProps {
  id: string;
  tenantId: string;
  calculationRequestId: string;
  status: CalculationStatus;
  /** `undefined` pouze pro `status === "failed"` - neúspěšný výpočet nemá
   *  rozpad, jen `issues`. */
  breakdown?: CalculationBreakdown;
  /** 0..1 - AP-MCE-001 §12/§24: heuristika v Fázi A (viz use case), přesná
   *  definice čeká na kalibrační data (§24 "Open — revisit once §13 has
   *  data"). `undefined` pro `status === "failed"`. */
  confidenceScore?: number;
  issues: readonly CalculationIssue[];
  engineVersion: string;
  strategyVersion?: string;
  ruleVersionId: string;
  calculatedAt: string; // ISO 8601
  supersedesResultId?: string;
  manualOverrideMinutes?: number;
  /** AP-MCE-001 Fáze B §10 - immutable snapshoty profilů POUŽITÝCH při tomhle
   *  konkrétním výpočtu (`CalculationContextResolver`, Application vrstva).
   *  ADITIVNÍ rozšíření Fáze A: `undefined`, dokud volající kontext nesestaví
   *  (Fáze A žádnou strategii/profily nemá). Uložené jako plochá data
   *  (`toJSON()`/`Record<string, unknown>`), NE jako živé instance tříd -
   *  `CalculationResult` musí zůstat serializovatelný beze změny při pozdější
   *  změně master dat (§10: "starý výsledek se nikdy nezmění"). */
  materialProfileSnapshot?: Readonly<Record<string, unknown>>;
  machineProfileSnapshot?: Readonly<Record<string, unknown>>;
  toolProfileSnapshot?: Readonly<Record<string, unknown>>;
  cuttingConditionSnapshot?: Readonly<Record<string, unknown>>;
}

export class CalculationResult {
  private readonly props: Readonly<CalculationResultProps>;

  private constructor(props: CalculationResultProps) {
    this.props = Object.freeze({
      ...props,
      issues: Object.freeze([...props.issues]),
    });
  }

  static create(props: CalculationResultProps): CalculationResult {
    if (!props.id.trim()) throw new ValidationError("CalculationResult: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("CalculationResult: 'tenantId' nesmí být prázdné.");
    if (!props.calculationRequestId.trim()) {
      throw new ValidationError("CalculationResult: 'calculationRequestId' nesmí být prázdné.");
    }
    if (!props.engineVersion.trim()) throw new ValidationError("CalculationResult: 'engineVersion' nesmí být prázdný.");
    if (!props.ruleVersionId.trim()) throw new ValidationError("CalculationResult: 'ruleVersionId' nesmí být prázdné.");
    if (props.status !== "failed" && !props.breakdown) {
      throw new ValidationError(`CalculationResult ve stavu "${props.status}" musí mít 'breakdown'.`);
    }
    if (props.confidenceScore !== undefined && (props.confidenceScore < 0 || props.confidenceScore > 1)) {
      throw new ValidationError(`'confidenceScore' musí být v rozsahu 0..1, dostal jsem "${props.confidenceScore}".`);
    }
    return new CalculationResult(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get calculationRequestId(): string {
    return this.props.calculationRequestId;
  }
  get status(): CalculationStatus {
    return this.props.status;
  }
  get breakdown(): CalculationBreakdown | undefined {
    return this.props.breakdown;
  }
  get confidenceScore(): number | undefined {
    return this.props.confidenceScore;
  }
  get issues(): readonly CalculationIssue[] {
    return this.props.issues;
  }
  get engineVersion(): string {
    return this.props.engineVersion;
  }
  get strategyVersion(): string | undefined {
    return this.props.strategyVersion;
  }
  get ruleVersionId(): string {
    return this.props.ruleVersionId;
  }
  get calculatedAt(): string {
    return this.props.calculatedAt;
  }
  get supersedesResultId(): string | undefined {
    return this.props.supersedesResultId;
  }
  get manualOverrideMinutes(): number | undefined {
    return this.props.manualOverrideMinutes;
  }
  get materialProfileSnapshot(): Readonly<Record<string, unknown>> | undefined {
    return this.props.materialProfileSnapshot;
  }
  get machineProfileSnapshot(): Readonly<Record<string, unknown>> | undefined {
    return this.props.machineProfileSnapshot;
  }
  get toolProfileSnapshot(): Readonly<Record<string, unknown>> | undefined {
    return this.props.toolProfileSnapshot;
  }
  get cuttingConditionSnapshot(): Readonly<Record<string, unknown>> | undefined {
    return this.props.cuttingConditionSnapshot;
  }

  get isFailed(): boolean {
    return this.props.status === "failed";
  }

  get isSuperseded(): boolean {
    return this.props.status === "superseded";
  }

  /** Vypočtený čas operace (AP-MCE-001 §03 `totalOperationTime`) - vyhodí,
   *  pokud výpočet selhal (`breakdown` neexistuje). Pro bezpečné čtení bez
   *  výjimky použij `status`/`breakdown` přímo. */
  get computedOperationTime(): Time {
    if (!this.props.breakdown) {
      throw new InvalidStateError(`CalculationResult "${this.props.id}" nemá breakdown (status "${this.props.status}").`);
    }
    return this.props.breakdown.totalOperationTime;
  }

  /** Ruční přepis má přednost před vypočteným časem - stejné pravidlo jako
   *  existující `Calculation.finalTime`. */
  get finalOperationTime(): Time {
    return this.props.manualOverrideMinutes !== undefined ? Time.ofMinutes(this.props.manualOverrideMinutes) : this.computedOperationTime;
  }

  /** Vrací NOVOU instanci se stejnými daty výpočtu, jen s jinou/žádnou ruční
   *  úpravou - nikdy nemutuje `this` (viz komentář u třídy). */
  withManualOverride(minutes: number | undefined): CalculationResult {
    if (minutes !== undefined && (!Number.isFinite(minutes) || minutes < 0)) {
      throw new ValidationError(`Ruční úprava času nesmí být záporná, dostal jsem "${minutes}".`);
    }
    return new CalculationResult({ ...this.props, manualOverrideMinutes: minutes });
  }

  /** Označí tenhle výsledek za nahrazený novější revizí (AP-MCE-001 §15) -
   *  vrací NOVOU instanci, historický záznam se nikdy nepřepisuje na místě;
   *  volající (Application use case) uloží obě instance vedle sebe. */
  asSuperseded(): CalculationResult {
    if (this.props.status === "superseded") return this;
    return new CalculationResult({ ...this.props, status: "superseded" });
  }
}

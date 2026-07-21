import { ValidationError } from "@/domain/errors/validation-error";
import { Time } from "../value-objects/time";
import { Quantity } from "../value-objects/quantity";
import { TurningCalculationBreakdown } from "../turning/turning-calculation-breakdown";
import { MillingCalculationBreakdown } from "../milling/milling-calculation-breakdown";

/**
 * Rozpad výsledku výpočtu podle přesného modelu z AP-MCE-001 §03 - TŘI
 * vrstvy skládání (engineering čas → multiplikativní koeficienty → aditivní
 * přirážky), nikdy zploštěné do jednoho čísla bez cesty zpět k tomu, jak
 * vzniklo (zadání: "Výpočet nesmí vracet pouze jedno číslo bez vysvětlení").
 *
 * Fáze A neimplementuje žádnou konkrétní strategii (Turning/Milling/...), takže
 * `toolWearCoefficient` je tu zatím JEDEN plochý koeficient pro celou dávku,
 * ne funkce polohy kusu v dávce `ToolWearFactor(i)` z AP-MCE-001 §03 - to je
 * vědomé zjednodušení rozsahu (viz AP-MCE-001 §24 "Tool wear: continuous vs.
 * discrete - Decided: discrete pro MVP"). Až konkrétní strategie potřebu
 * postupně rostoucího opotřebení skutečně bude mít, přibude `toolWearFactorAt
 * (pieceIndex)` jako ADITIVNÍ rozšíření tohohle rozhraní, ne jeho přepis.
 *
 * Immutable po vytvoření - stejná disciplína jako existující
 * `Calculation`/`CalculationSnapshot` (ADR 0006): `Object.freeze` a žádné
 * settery, každá změna vytváří novou instanci.
 */
export interface CalculationBreakdownProps {
  /** Layer 1 - čas na jeden kus PŘED aplikací koeficientů (Layer 2). */
  rawUnitTime: Time;
  setupTime: Time;
  firstPieceInspectionTime: Time;
  finalInspectionTime: Time;
  /** Čas JEDNÉ výměny nástroje/upnutí - kolikrát k ní v dávce dojde určují
   *  `plannedToolChanges`/`plannedFixtureChanges`. */
  toolChangeTime: Time;
  fixtureChangeTime: Time;
  handlingTime: Time;
  inOperationInspectionTime: Time;
  measurementTime: Time;
  interOperationMoveTime: Time;
  auxiliaryTime: Time;
  waitingTime: Time;

  quantity: Quantity;
  plannedToolChanges: number;
  plannedFixtureChanges: number;

  /** Layer 2 - multiplikativní koeficienty, výchozí hodnota 1 (žádný vliv). */
  operatorSkillCoefficient: number;
  machineCoefficient: number;
  materialCoefficient: number;
  complexityCoefficient: number;
  toolWearCoefficient: number;
  historicalCalibrationCoefficient: number;

  /** Layer 3 - aditivní přirážky, aplikované AŽ NA konci skládání. */
  percentageAllowance: number;
  fixedAllowance: Time;

  /** AP-MCE-001 Fáze C §9 "Rozšiř CalculationBreakdown o turning část" -
   *  ADITIVNÍ pole, `undefined` pro všechny výsledky mimo `Turning
   *  CalculationStrategy` (a i pro tu skutečně jen doplňuje - Layer 1/2/3
   *  pole výš zůstávají jediným zdrojem pravdy pro `totalOperationTime`,
   *  tohle nese jen VYSVĚTLENÍ/detail po jednotlivých `TurningFeature`,
   *  viz komentář u `TurningCalculationBreakdown`). */
  turningDetail?: TurningCalculationBreakdown;

  /** AP-MCE-001 Fáze D §16 "Rozšiř CalculationBreakdown o milling část" -
   *  stejný aditivní princip jako `turningDetail` (`undefined` pro všechny
   *  výsledky mimo `MillingCalculationStrategy`). */
  millingDetail?: MillingCalculationBreakdown;
}

function assertNonNegativeCoefficient(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationError(`Koeficient "${name}" nesmí být záporný, dostal jsem "${value}".`);
  }
}

function assertNonNegativeCount(name: string, value: number): void {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new ValidationError(`Počet "${name}" musí být nezáporné celé číslo, dostal jsem "${value}".`);
  }
}

export class CalculationBreakdown {
  private readonly props: Readonly<CalculationBreakdownProps>;

  private constructor(props: CalculationBreakdownProps) {
    this.props = Object.freeze({ ...props });
  }

  static create(props: CalculationBreakdownProps): CalculationBreakdown {
    assertNonNegativeCoefficient("operatorSkillCoefficient", props.operatorSkillCoefficient);
    assertNonNegativeCoefficient("machineCoefficient", props.machineCoefficient);
    assertNonNegativeCoefficient("materialCoefficient", props.materialCoefficient);
    assertNonNegativeCoefficient("complexityCoefficient", props.complexityCoefficient);
    assertNonNegativeCoefficient("toolWearCoefficient", props.toolWearCoefficient);
    assertNonNegativeCoefficient("historicalCalibrationCoefficient", props.historicalCalibrationCoefficient);
    assertNonNegativeCoefficient("percentageAllowance", props.percentageAllowance);
    assertNonNegativeCount("plannedToolChanges", props.plannedToolChanges);
    assertNonNegativeCount("plannedFixtureChanges", props.plannedFixtureChanges);
    return new CalculationBreakdown(props);
  }

  /** Koeficienty/přirážky výchozí na "beze změny" (1 / 0) - použití: strategie,
   *  které v Fázi A ještě nepočítají s korekcemi, ať nemusí všude vypisovat
   *  šest jedniček. */
  static createWithDefaults(
    props: Pick<
      CalculationBreakdownProps,
      | "rawUnitTime"
      | "setupTime"
      | "quantity"
      | "handlingTime"
      | "finalInspectionTime"
      | "firstPieceInspectionTime"
      | "toolChangeTime"
      | "fixtureChangeTime"
      | "inOperationInspectionTime"
      | "measurementTime"
      | "interOperationMoveTime"
      | "auxiliaryTime"
      | "waitingTime"
      | "plannedToolChanges"
      | "plannedFixtureChanges"
    > &
      Partial<
        Pick<
          CalculationBreakdownProps,
          | "operatorSkillCoefficient"
          | "machineCoefficient"
          | "materialCoefficient"
          | "complexityCoefficient"
          | "toolWearCoefficient"
          | "historicalCalibrationCoefficient"
          | "percentageAllowance"
          | "fixedAllowance"
        >
      >
  ): CalculationBreakdown {
    return CalculationBreakdown.create({
      ...props,
      operatorSkillCoefficient: props.operatorSkillCoefficient ?? 1,
      machineCoefficient: props.machineCoefficient ?? 1,
      materialCoefficient: props.materialCoefficient ?? 1,
      complexityCoefficient: props.complexityCoefficient ?? 1,
      toolWearCoefficient: props.toolWearCoefficient ?? 1,
      historicalCalibrationCoefficient: props.historicalCalibrationCoefficient ?? 1,
      percentageAllowance: props.percentageAllowance ?? 0,
      fixedAllowance: props.fixedAllowance ?? Time.zero(),
    });
  }

  get rawUnitTime(): Time {
    return this.props.rawUnitTime;
  }
  get setupTime(): Time {
    return this.props.setupTime;
  }
  get firstPieceInspectionTime(): Time {
    return this.props.firstPieceInspectionTime;
  }
  get finalInspectionTime(): Time {
    return this.props.finalInspectionTime;
  }
  get toolChangeTime(): Time {
    return this.props.toolChangeTime;
  }
  get fixtureChangeTime(): Time {
    return this.props.fixtureChangeTime;
  }
  get handlingTime(): Time {
    return this.props.handlingTime;
  }
  get inOperationInspectionTime(): Time {
    return this.props.inOperationInspectionTime;
  }
  get measurementTime(): Time {
    return this.props.measurementTime;
  }
  get interOperationMoveTime(): Time {
    return this.props.interOperationMoveTime;
  }
  get auxiliaryTime(): Time {
    return this.props.auxiliaryTime;
  }
  get waitingTime(): Time {
    return this.props.waitingTime;
  }
  get quantity(): Quantity {
    return this.props.quantity;
  }
  get plannedToolChanges(): number {
    return this.props.plannedToolChanges;
  }
  get plannedFixtureChanges(): number {
    return this.props.plannedFixtureChanges;
  }
  get operatorSkillCoefficient(): number {
    return this.props.operatorSkillCoefficient;
  }
  get machineCoefficient(): number {
    return this.props.machineCoefficient;
  }
  get materialCoefficient(): number {
    return this.props.materialCoefficient;
  }
  get complexityCoefficient(): number {
    return this.props.complexityCoefficient;
  }
  get toolWearCoefficient(): number {
    return this.props.toolWearCoefficient;
  }
  get historicalCalibrationCoefficient(): number {
    return this.props.historicalCalibrationCoefficient;
  }
  get percentageAllowance(): number {
    return this.props.percentageAllowance;
  }
  get fixedAllowance(): Time {
    return this.props.fixedAllowance;
  }
  get turningDetail(): TurningCalculationBreakdown | undefined {
    return this.props.turningDetail;
  }
  get millingDetail(): MillingCalculationBreakdown | undefined {
    return this.props.millingDetail;
  }

  /** UnitTimeAdjusted (AP-MCE-001 §03) - čas na jeden kus PO aplikaci všech
   *  Layer 2 koeficientů, jednotné pro celou dávku v Fázi A (viz komentář
   *  u třídy o `toolWearCoefficient`). */
  get unitTimeAdjusted(): Time {
    const combinedCoefficient =
      this.props.machineCoefficient *
      this.props.materialCoefficient *
      this.props.complexityCoefficient *
      this.props.toolWearCoefficient *
      this.props.operatorSkillCoefficient *
      this.props.historicalCalibrationCoefficient;
    return this.props.rawUnitTime.times(combinedCoefficient);
  }

  /** Vše, co se škáluje s počtem kusů, plus výměny nástroje/upnutí v dávce. */
  get batchVariableTime(): Time {
    const perPiece = this.unitTimeAdjusted.plus(this.props.handlingTime).plus(this.props.inOperationInspectionTime);
    return perPiece
      .times(this.props.quantity.pieces)
      .plus(this.props.toolChangeTime.times(this.props.plannedToolChanges))
      .plus(this.props.fixtureChangeTime.times(this.props.plannedFixtureChanges));
  }

  /** Vše, co se platí jednou za dávku bez ohledu na počet kusů. */
  get batchFixedTime(): Time {
    return this.props.setupTime
      .times(this.props.complexityCoefficient)
      .plus(this.props.firstPieceInspectionTime)
      .plus(this.props.finalInspectionTime)
      .plus(this.props.measurementTime)
      .plus(this.props.waitingTime);
  }

  /** Součet Layer 1+2 PŘED aplikací Layer 3 přirážek. */
  get totalOperationTimeRaw(): Time {
    return this.batchFixedTime.plus(this.batchVariableTime);
  }

  /** Konečný čas operace VČETNĚ přirážek (Layer 3) - tohle je hodnota, kterou
   *  Planning Engine smí převzít (AP-MCE-001 §01: "Planning Engine smí pouze
   *  předat vstupy a převzít vypočtený čas"). */
  get totalOperationTime(): Time {
    return this.totalOperationTimeRaw.withPercentageAllowance(this.props.percentageAllowance).plus(this.props.fixedAllowance);
  }

  /** Rekonstruuje instanci ze SUROVÝCH polí uložených `toJSON()` výstupem -
   *  odvozené hodnoty (`unitTimeAdjusted`, `totalOperationTime`, ...) se
   *  ignorují, dopočítají se znovu getterem. Použití: `IndexedDbCalculation
   *  Repository` při čtení uloženého `CalculationResult`. */
  static fromJSON(json: Record<string, unknown>): CalculationBreakdown {
    return CalculationBreakdown.create({
      rawUnitTime: Time.fromJSON(json.rawUnitTime as number),
      setupTime: Time.fromJSON(json.setupTime as number),
      firstPieceInspectionTime: Time.fromJSON(json.firstPieceInspectionTime as number),
      finalInspectionTime: Time.fromJSON(json.finalInspectionTime as number),
      toolChangeTime: Time.fromJSON(json.toolChangeTime as number),
      fixtureChangeTime: Time.fromJSON(json.fixtureChangeTime as number),
      handlingTime: Time.fromJSON(json.handlingTime as number),
      inOperationInspectionTime: Time.fromJSON(json.inOperationInspectionTime as number),
      measurementTime: Time.fromJSON(json.measurementTime as number),
      interOperationMoveTime: Time.fromJSON(json.interOperationMoveTime as number),
      auxiliaryTime: Time.fromJSON(json.auxiliaryTime as number),
      waitingTime: Time.fromJSON(json.waitingTime as number),
      quantity: Quantity.fromJSON(json.quantity as number),
      plannedToolChanges: json.plannedToolChanges as number,
      plannedFixtureChanges: json.plannedFixtureChanges as number,
      operatorSkillCoefficient: json.operatorSkillCoefficient as number,
      machineCoefficient: json.machineCoefficient as number,
      materialCoefficient: json.materialCoefficient as number,
      complexityCoefficient: json.complexityCoefficient as number,
      toolWearCoefficient: json.toolWearCoefficient as number,
      historicalCalibrationCoefficient: json.historicalCalibrationCoefficient as number,
      percentageAllowance: json.percentageAllowance as number,
      fixedAllowance: Time.fromJSON(json.fixedAllowance as number),
      // `turningDetail`/`millingDetail` jsou ploché, čistě datové struktury
      // (žádné vnořené hodnotové objekty s vlastní `fromJSON`) - reprodukují
      // se beze změny.
      turningDetail: json.turningDetail as TurningCalculationBreakdown | undefined,
      millingDetail: json.millingDetail as MillingCalculationBreakdown | undefined,
    });
  }

  toJSON(): Record<string, unknown> {
    return {
      rawUnitTime: this.props.rawUnitTime.toJSON(),
      setupTime: this.props.setupTime.toJSON(),
      firstPieceInspectionTime: this.props.firstPieceInspectionTime.toJSON(),
      finalInspectionTime: this.props.finalInspectionTime.toJSON(),
      toolChangeTime: this.props.toolChangeTime.toJSON(),
      fixtureChangeTime: this.props.fixtureChangeTime.toJSON(),
      handlingTime: this.props.handlingTime.toJSON(),
      inOperationInspectionTime: this.props.inOperationInspectionTime.toJSON(),
      measurementTime: this.props.measurementTime.toJSON(),
      interOperationMoveTime: this.props.interOperationMoveTime.toJSON(),
      auxiliaryTime: this.props.auxiliaryTime.toJSON(),
      waitingTime: this.props.waitingTime.toJSON(),
      quantity: this.props.quantity.toJSON(),
      plannedToolChanges: this.props.plannedToolChanges,
      plannedFixtureChanges: this.props.plannedFixtureChanges,
      operatorSkillCoefficient: this.props.operatorSkillCoefficient,
      machineCoefficient: this.props.machineCoefficient,
      materialCoefficient: this.props.materialCoefficient,
      complexityCoefficient: this.props.complexityCoefficient,
      toolWearCoefficient: this.props.toolWearCoefficient,
      historicalCalibrationCoefficient: this.props.historicalCalibrationCoefficient,
      percentageAllowance: this.props.percentageAllowance,
      fixedAllowance: this.props.fixedAllowance.toJSON(),
      turningDetail: this.props.turningDetail,
      millingDetail: this.props.millingDetail,
      // Odvozené hodnoty se serializují taky - konzumenti (API, UI) je nemusí
      // přepočítávat znovu, viz AP-MCE-001 §05 "Výpočet nesmí vracet pouze
      // jedno číslo bez vysvětlení".
      unitTimeAdjusted: this.unitTimeAdjusted.toJSON(),
      batchVariableTime: this.batchVariableTime.toJSON(),
      batchFixedTime: this.batchFixedTime.toJSON(),
      totalOperationTimeRaw: this.totalOperationTimeRaw.toJSON(),
      totalOperationTime: this.totalOperationTime.toJSON(),
    };
  }
}

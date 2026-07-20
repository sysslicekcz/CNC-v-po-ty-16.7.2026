import { ValidationError } from "@/domain/errors/validation-error";
import type { OperationCategory } from "../enums/operation-category";
import { CuttingSpeed } from "../value-objects/cutting-speed";
import { FeedRate } from "../value-objects/feed-rate";
import { Length } from "../value-objects/length";
import { SpindleSpeed } from "../value-objects/spindle-speed";

/** Odkud řezná podmínka pochází - rozšiřuje existující `CuttingConditionSource`
 *  (`domain/entities/tool-machine-condition.ts`: "manufacturer"|"internal"|
 *  "calculated"|"manual") o zdroje, které vznikají teprve při RESOLVOVÁNÍ
 *  (ne při uložení záznamu) - viz `CuttingConditionResolver`. */
export type CuttingConditionSource =
  | "explicit"
  | "tenant_approved"
  | "tool_machine_material"
  | "tool_recommendation"
  | "material_recommendation"
  | "system_default";

export interface CuttingConditionProps {
  id: string;
  tenantId: string;
  materialProfileId: string;
  machineProfileId?: string;
  toolProfileId?: string;
  operationCategory: OperationCategory;
  operationSubtype?: string;
  cuttingSpeed?: CuttingSpeed;
  feedPerRevolution?: FeedRate;
  feedPerTooth?: FeedRate;
  feedRate?: FeedRate;
  depthOfCut?: Length;
  widthOfCut?: Length;
  spindleSpeed?: SpindleSpeed;
  coolantMode?: string;
  source: CuttingConditionSource;
  priority: number;
  /** 0..1 - AP-MCE-001 Fáze B §5. */
  confidence: number;
  ruleVersion: string;
  validFrom: string;
  validTo?: string;
}

/**
 * Výpočetní read-model řezných podmínek (AP-MCE-001 Fáze B §5) - staví se NAD
 * existující `ToolMachineCondition` (Krok 5), nenahrazuje ji: `ToolMachine
 * ConditionRepository`/UI zůstávají beze změny, `CuttingConditionFactory`
 * (viz samostatný soubor) z ní jen sestaví bohatší read-model s poli, která
 * `ToolMachineCondition` nemá (`feedRate`, `widthOfCut`, `coolantMode`,
 * `confidence`, platnost). Immutable po vytvoření.
 */
export class CuttingCondition {
  private readonly props: Readonly<CuttingConditionProps>;

  private constructor(props: CuttingConditionProps) {
    this.props = Object.freeze({ ...props });
  }

  static create(props: CuttingConditionProps): CuttingCondition {
    if (!props.id.trim()) throw new ValidationError("CuttingCondition: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("CuttingCondition: 'tenantId' nesmí být prázdné.");
    if (!props.materialProfileId.trim()) throw new ValidationError("CuttingCondition: 'materialProfileId' nesmí být prázdné.");
    if (!props.ruleVersion.trim()) throw new ValidationError("CuttingCondition: 'ruleVersion' nesmí být prázdná.");
    if (!Number.isFinite(props.confidence) || props.confidence < 0 || props.confidence > 1) {
      throw new ValidationError(`CuttingCondition: 'confidence' musí být v rozsahu 0..1, dostal jsem "${props.confidence}".`);
    }
    if (props.validTo && props.validTo < props.validFrom) {
      throw new ValidationError("CuttingCondition: 'validTo' nesmí být dřív než 'validFrom'.");
    }
    return new CuttingCondition(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get materialProfileId(): string {
    return this.props.materialProfileId;
  }
  get machineProfileId(): string | undefined {
    return this.props.machineProfileId;
  }
  get toolProfileId(): string | undefined {
    return this.props.toolProfileId;
  }
  get operationCategory(): OperationCategory {
    return this.props.operationCategory;
  }
  get operationSubtype(): string | undefined {
    return this.props.operationSubtype;
  }
  get cuttingSpeed(): CuttingSpeed | undefined {
    return this.props.cuttingSpeed;
  }
  get feedPerRevolution(): FeedRate | undefined {
    return this.props.feedPerRevolution;
  }
  get feedPerTooth(): FeedRate | undefined {
    return this.props.feedPerTooth;
  }
  get feedRate(): FeedRate | undefined {
    return this.props.feedRate;
  }
  get depthOfCut(): Length | undefined {
    return this.props.depthOfCut;
  }
  get widthOfCut(): Length | undefined {
    return this.props.widthOfCut;
  }
  get spindleSpeed(): SpindleSpeed | undefined {
    return this.props.spindleSpeed;
  }
  get coolantMode(): string | undefined {
    return this.props.coolantMode;
  }
  get source(): CuttingConditionSource {
    return this.props.source;
  }
  get priority(): number {
    return this.props.priority;
  }
  get confidence(): number {
    return this.props.confidence;
  }
  get ruleVersion(): string {
    return this.props.ruleVersion;
  }
  get validFrom(): string {
    return this.props.validFrom;
  }
  get validTo(): string | undefined {
    return this.props.validTo;
  }

  isValidAt(instant: string): boolean {
    if (instant < this.props.validFrom) return false;
    if (this.props.validTo && instant > this.props.validTo) return false;
    return true;
  }

  matches(criteria: {
    toolProfileId?: string;
    machineProfileId?: string;
    materialProfileId: string;
    operationCategory: OperationCategory;
  }): boolean {
    if (this.props.materialProfileId !== criteria.materialProfileId) return false;
    if (this.props.operationCategory !== criteria.operationCategory) return false;
    if (this.props.toolProfileId && this.props.toolProfileId !== criteria.toolProfileId) return false;
    if (this.props.machineProfileId && this.props.machineProfileId !== criteria.machineProfileId) return false;
    return true;
  }
}

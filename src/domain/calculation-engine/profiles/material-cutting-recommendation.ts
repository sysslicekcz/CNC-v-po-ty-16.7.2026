import { ValidationError } from "@/domain/errors/validation-error";
import type { OperationCategory } from "../enums/operation-category";

/**
 * Jedna doporučená hodnota řezné rychlosti NEBO posuvu pro materiál
 * (AP-MCE-001 Fáze B §2) - STEJNÁ struktura pro `recommendedCuttingSpeeds` i
 * `recommendedFeeds` na `MaterialProfile` (liší se jen `unit`, např. "m/min"
 * pro řeznou rychlost, "mm/ot"/"mm/zub" pro posuv) - žádné dvě podobné třídy.
 *
 * `unit` je obecný string, ne uzavřený union - `CuttingSpeed`/`FeedRate`
 * hodnotové objekty (Fáze A) mají svou vlastní validaci pro POUŽITÍ v
 * kontextu jedné konkrétní operace; tahle třída je jen DATOVÝ KATALOG
 * doporučení materiálu, který strategie/resolver later převede na konkrétní
 * `CuttingSpeed`/`FeedRate` podle toho, co zrovna počítá.
 */
export interface MaterialCuttingRecommendationProps {
  operationCategory: OperationCategory;
  machiningSubtype?: string;
  toolMaterial?: string;
  minimumValue?: number;
  recommendedValue: number;
  maximumValue?: number;
  unit: string;
  source: string;
  /** 0..1 - důvěryhodnost doporučení (výrobce nástroje > interní zkušenost >
   *  dopočtená hodnota). */
  confidence: number;
}

export class MaterialCuttingRecommendation {
  private readonly props: Readonly<MaterialCuttingRecommendationProps>;

  private constructor(props: MaterialCuttingRecommendationProps) {
    this.props = Object.freeze({ ...props });
  }

  static create(props: MaterialCuttingRecommendationProps): MaterialCuttingRecommendation {
    if (!Number.isFinite(props.recommendedValue) || props.recommendedValue <= 0) {
      throw new ValidationError(`'recommendedValue' musí být kladné číslo, dostal jsem "${props.recommendedValue}".`);
    }
    if (props.minimumValue !== undefined && props.minimumValue > props.recommendedValue) {
      throw new ValidationError("'minimumValue' nesmí být větší než 'recommendedValue'.");
    }
    if (props.maximumValue !== undefined && props.maximumValue < props.recommendedValue) {
      throw new ValidationError("'maximumValue' nesmí být menší než 'recommendedValue'.");
    }
    if (!props.unit.trim()) throw new ValidationError("MaterialCuttingRecommendation: 'unit' nesmí být prázdná.");
    if (!props.source.trim()) throw new ValidationError("MaterialCuttingRecommendation: 'source' nesmí být prázdný.");
    if (!Number.isFinite(props.confidence) || props.confidence < 0 || props.confidence > 1) {
      throw new ValidationError(`'confidence' musí být v rozsahu 0..1, dostal jsem "${props.confidence}".`);
    }
    return new MaterialCuttingRecommendation(props);
  }

  get operationCategory(): OperationCategory {
    return this.props.operationCategory;
  }
  get machiningSubtype(): string | undefined {
    return this.props.machiningSubtype;
  }
  get toolMaterial(): string | undefined {
    return this.props.toolMaterial;
  }
  get minimumValue(): number | undefined {
    return this.props.minimumValue;
  }
  get recommendedValue(): number {
    return this.props.recommendedValue;
  }
  get maximumValue(): number | undefined {
    return this.props.maximumValue;
  }
  get unit(): string {
    return this.props.unit;
  }
  get source(): string {
    return this.props.source;
  }
  get confidence(): number {
    return this.props.confidence;
  }

  /** `true`, pokud tahle položka odpovídá zadané kombinaci - použití: výběr
   *  nejvhodnějšího doporučení z `MaterialProfile.recommendedCuttingSpeeds`. */
  matches(criteria: { operationCategory: OperationCategory; machiningSubtype?: string; toolMaterial?: string }): boolean {
    if (this.props.operationCategory !== criteria.operationCategory) return false;
    if (this.props.machiningSubtype && this.props.machiningSubtype !== criteria.machiningSubtype) return false;
    if (this.props.toolMaterial && this.props.toolMaterial !== criteria.toolMaterial) return false;
    return true;
  }

  toJSON(): MaterialCuttingRecommendationProps {
    return { ...this.props };
  }

  static fromJSON(json: MaterialCuttingRecommendationProps): MaterialCuttingRecommendation {
    return MaterialCuttingRecommendation.create(json);
  }
}

import { ValidationError } from "@/domain/errors/validation-error";
import { CuttingParameters } from "@/domain/value-objects/cutting-parameters";
import type { OperationCategory } from "../enums/operation-category";

/**
 * Výchozí řezné podmínky nástroje PRO KONKRÉTNÍ kategorii/podtyp operace
 * (AP-MCE-001 Fáze B §4 `defaultCuttingParameters`) - nástroj může mít různé
 * výchozí Vc/feed/ap pro soustružení vs. vrtání stejným tělem apod.
 *
 * ZÁMĚRNĚ NEDUPLIKUJE existující `domain/value-objects/cutting-parameters.ts`
 * (vc/feed/ap) - `Tool.defaultCuttingParameters` už ho používá dnes (Krok 3/5)
 * a `resolveCuttingConditions()` s ním počítá. Tahle třída je tenká obálka,
 * která k existujícím `CuttingParameters` přidává PRO JAKOU operaci platí -
 * to `CuttingParameters` samo o sobě nenese.
 */
export interface ToolCuttingParametersProps {
  operationCategory: OperationCategory;
  operationSubtype?: string;
  parameters: CuttingParameters;
}

export class ToolCuttingParameters {
  private readonly props: Readonly<ToolCuttingParametersProps>;

  private constructor(props: ToolCuttingParametersProps) {
    this.props = Object.freeze({ ...props });
  }

  static create(props: ToolCuttingParametersProps): ToolCuttingParameters {
    if (!props.parameters) throw new ValidationError("ToolCuttingParameters: 'parameters' je povinné.");
    return new ToolCuttingParameters(props);
  }

  get operationCategory(): OperationCategory {
    return this.props.operationCategory;
  }
  get operationSubtype(): string | undefined {
    return this.props.operationSubtype;
  }
  get parameters(): CuttingParameters {
    return this.props.parameters;
  }

  matches(criteria: { operationCategory: OperationCategory; operationSubtype?: string }): boolean {
    if (this.props.operationCategory !== criteria.operationCategory) return false;
    if (this.props.operationSubtype && this.props.operationSubtype !== criteria.operationSubtype) return false;
    return true;
  }

  toJSON(): { operationCategory: OperationCategory; operationSubtype?: string; parameters: ReturnType<CuttingParameters["toJSON"]> } {
    return {
      operationCategory: this.props.operationCategory,
      operationSubtype: this.props.operationSubtype,
      parameters: this.props.parameters.toJSON(),
    };
  }

  static fromJSON(json: {
    operationCategory: OperationCategory;
    operationSubtype?: string;
    parameters: ReturnType<CuttingParameters["toJSON"]>;
  }): ToolCuttingParameters {
    return ToolCuttingParameters.create({
      operationCategory: json.operationCategory,
      operationSubtype: json.operationSubtype,
      parameters: CuttingParameters.fromJSON(json.parameters),
    });
  }
}

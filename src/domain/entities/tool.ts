import { ValidationError } from "../errors/validation-error";
import { CuttingParameters } from "../value-objects/cutting-parameters";
import { ToolCode } from "../value-objects/tool-code";
import { EntityStav } from "./common";

/** Dynamická hodnota parametru definovaného na `ToolType.parameterDefinitions`
 *  (Krok 5, zadání bod 19) - klíč odpovídá `ToolParameterDefinition.key`.
 *  Validace proti definici (povinnost, typ, `allowedValues`) dělá use case
 *  (`CreateToolUseCase`/`UpdateToolUseCase`), ne tahle entita - `Tool` sám o
 *  sobě `ToolType` nenačítá. */
export type ToolParameterValue = string | number | boolean;

export interface ToolProps {
  id: string;
  tenantId: string;
  code?: ToolCode;
  nazev: string;
  toolTypeId: string;
  manufacturer?: string;
  designation?: string;
  parameters?: Record<string, ToolParameterValue>;
  stav: EntityStav;
  radius?: number;
  defaultCuttingParameters?: CuttingParameters;
  poznamka?: string;
}

/** Nástroj je globální entita v rámci tenanta (ne vlastněná strojem) - řezné
 *  podmínky pro konkrétní stroj drží samostatně ToolMachineCondition. `code`
 *  je volitelný podnikový/ERP kód (Krok 3.5, bod 18) - pokud vyplněný, musí být
 *  unikátní v rámci tenanta (hlídá use case, ne VO). `manufacturer`/`designation`/
 *  `parameters` (Krok 5, zadání bod 17-19) - `parameters` nese dynamické hodnoty
 *  podle `ToolType.parameterDefinitions`, `radius`/`defaultCuttingParameters`
 *  zůstávají zachovaná pevná pole z dřívějška (řezné podmínky mají vlastní typ,
 *  ne obecný bag), aby se nerozbilo nic, co na nich už stojí
 *  (cutting-condition-resolver.ts). */
export class Tool {
  private constructor(private props: ToolProps) {}

  static create(props: ToolProps): Tool {
    if (!props.tenantId.trim()) throw new ValidationError("Tool: 'tenantId' nesmí být prázdné.");
    if (!props.nazev.trim()) throw new ValidationError("Tool: 'nazev' nesmí být prázdný.");
    if (!props.toolTypeId.trim()) throw new ValidationError("Tool: 'toolTypeId' nesmí být prázdné.");
    return new Tool({ ...props });
  }

  static restore(props: ToolProps): Tool {
    return new Tool({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get code(): ToolCode | undefined {
    return this.props.code;
  }
  get nazev(): string {
    return this.props.nazev;
  }
  get toolTypeId(): string {
    return this.props.toolTypeId;
  }
  get manufacturer(): string | undefined {
    return this.props.manufacturer;
  }
  get designation(): string | undefined {
    return this.props.designation;
  }
  get parameters(): Readonly<Record<string, ToolParameterValue>> | undefined {
    return this.props.parameters;
  }
  get stav(): EntityStav {
    return this.props.stav;
  }
  get radius(): number | undefined {
    return this.props.radius;
  }
  get defaultCuttingParameters(): CuttingParameters | undefined {
    return this.props.defaultCuttingParameters;
  }
  get poznamka(): string | undefined {
    return this.props.poznamka;
  }

  rename(nazev: string): void {
    if (!nazev.trim()) throw new ValidationError("Tool: 'nazev' nesmí být prázdný.");
    this.props.nazev = nazev;
  }

  changeCode(code: ToolCode | undefined): void {
    this.props.code = code;
  }

  /** Změna typu nástroje NEMAŽE existující `parameters` automaticky (zadání
   *  bod 37 - "nemaž hodnoty bez potvrzení") - o zahození nekompatibilních
   *  hodnot rozhoduje volající (UI/use case) explicitně přes `updateDetails`. */
  changeToolType(toolTypeId: string): void {
    if (!toolTypeId.trim()) throw new ValidationError("Tool: 'toolTypeId' nesmí být prázdné.");
    this.props.toolTypeId = toolTypeId;
  }

  updateDetails(input: {
    manufacturer?: string;
    designation?: string;
    parameters?: Record<string, ToolParameterValue>;
    radius?: number;
    defaultCuttingParameters?: CuttingParameters;
    poznamka?: string;
  }): void {
    if (input.manufacturer !== undefined) this.props.manufacturer = input.manufacturer || undefined;
    if (input.designation !== undefined) this.props.designation = input.designation || undefined;
    if (input.parameters !== undefined) this.props.parameters = input.parameters;
    if (input.radius !== undefined) this.props.radius = input.radius;
    if (input.defaultCuttingParameters !== undefined) this.props.defaultCuttingParameters = input.defaultCuttingParameters;
    if (input.poznamka !== undefined) this.props.poznamka = input.poznamka || undefined;
  }

  setStav(stav: EntityStav): void {
    this.props.stav = stav;
  }
}

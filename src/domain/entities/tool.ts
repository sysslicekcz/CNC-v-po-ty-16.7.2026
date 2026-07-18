import { ValidationError } from "../errors/validation-error";
import { CuttingParameters } from "../value-objects/cutting-parameters";
import { ToolCode } from "../value-objects/tool-code";
import { EntityStav } from "./common";

export interface ToolProps {
  id: string;
  tenantId: string;
  code?: ToolCode;
  nazev: string;
  toolTypeId: string;
  stav: EntityStav;
  radius?: number;
  defaultCuttingParameters?: CuttingParameters;
  poznamka?: string;
}

/** Nástroj je globální entita v rámci tenanta (ne vlastněná strojem) - řezné
 *  podmínky pro konkrétní stroj drží samostatně ToolMachineCondition. `code`
 *  je volitelný podnikový/ERP kód (Krok 3.5, bod 18) - pokud vyplněný, musí být
 *  unikátní v rámci tenanta (hlídá use case, ne VO). Pole jako výrobce/držák/
 *  ISO označení/katalogové číslo/sklad/cena záměrně chybí (viz zadání) - jde je
 *  přidat později jako volitelná pole bez zásahu do existující struktury. */
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
}

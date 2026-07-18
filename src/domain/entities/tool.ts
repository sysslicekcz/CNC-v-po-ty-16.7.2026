import { ValidationError } from "../errors/validation-error";
import { CuttingParameters } from "../value-objects/cutting-parameters";
import { EntityStav } from "./operation-type";

export interface ToolProps {
  id: string;
  nazev: string;
  toolTypeId: string;
  stav: EntityStav;
  radius?: number;
  vychoziParametry?: CuttingParameters;
  poznamka?: string;
  // Připraveno pro budoucí rozšíření beze změny struktury - viz zadání
  // (výrobce, držák, ISO označení, katalogové číslo, sklad, životnost, cena):
  vyrobce?: string;
  drzak?: string;
  isoOznaceni?: string;
  katalogoveCislo?: string;
}

/** Nástroj je globální entita (ne vlastněná strojem) - viz report, řezné podmínky
 *  pro konkrétní stroj drží samostatně ToolMachineCondition. */
export class Tool {
  private constructor(private props: ToolProps) {}

  static create(props: ToolProps): Tool {
    if (!props.nazev.trim()) throw new ValidationError("Tool: 'nazev' nesmí být prázdný.");
    if (!props.toolTypeId.trim()) throw new ValidationError("Tool: 'toolTypeId' nesmí být prázdné.");
    return new Tool({ ...props });
  }

  get id(): string {
    return this.props.id;
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
  get vychoziParametry(): CuttingParameters | undefined {
    return this.props.vychoziParametry;
  }
  get poznamka(): string | undefined {
    return this.props.poznamka;
  }
  get vyrobce(): string | undefined {
    return this.props.vyrobce;
  }
  get drzak(): string | undefined {
    return this.props.drzak;
  }
  get isoOznaceni(): string | undefined {
    return this.props.isoOznaceni;
  }
  get katalogoveCislo(): string | undefined {
    return this.props.katalogoveCislo;
  }
}

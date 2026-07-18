import { ValidationError } from "../errors/validation-error";
import { EntityStav } from "./operation-type";

export interface ToolTypeProps {
  id: string;
  kod: string;
  nazev: string;
  popis?: string;
  stav: EntityStav;
}

/** Typ nástroje jako číselníková entita - stejné zdůvodnění jako u OperationType:
 *  nový typ nástroje se přidá jako data, ne jako zásah do schématu/kódu. */
export class ToolType {
  private constructor(private readonly props: ToolTypeProps) {}

  static create(props: ToolTypeProps): ToolType {
    if (!props.id.trim()) throw new ValidationError("ToolType: 'id' nesmí být prázdné.");
    if (!props.kod.trim()) throw new ValidationError("ToolType: 'kod' nesmí být prázdný.");
    if (!props.nazev.trim()) throw new ValidationError("ToolType: 'nazev' nesmí být prázdný.");
    return new ToolType({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get kod(): string {
    return this.props.kod;
  }
  get nazev(): string {
    return this.props.nazev;
  }
  get popis(): string | undefined {
    return this.props.popis;
  }
  get stav(): EntityStav {
    return this.props.stav;
  }
}

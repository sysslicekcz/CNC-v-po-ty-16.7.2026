import { ValidationError } from "../errors/validation-error";
import { EntityStav } from "./common";

/** Otevřený, ale předdefinovaný seznam běžných kategorií (Krok 5, zadání bod 18) -
 *  "other" pokrývá vše, co appka dopředu nezná; tenant si vlastní kategorie
 *  nezakládá jako samostatná data (na rozdíl od `OperationType`, kde je celá
 *  entita datovým číselníkem) - kategorie nástroje je jen klasifikační štítek. */
export type ToolCategory =
  | "turning_holder"
  | "turning_insert"
  | "milling_cutter"
  | "milling_insert"
  | "drill"
  | "tap"
  | "reamer"
  | "grinding_wheel"
  | "measuring_tool"
  | "other";

export type ToolParameterValueType = "number" | "text" | "boolean" | "selection";

/** Definice jednoho dynamického parametru nástroje daného typu (Krok 5, zadání
 *  bod 19) - `key` je stabilní programový identifikátor (např. "diameter"),
 *  `name` čitelný popisek. Uložené na `ToolType`, hodnoty samotné na `Tool.parameters`. */
export interface ToolParameterDefinition {
  key: string;
  name: string;
  valueType: ToolParameterValueType;
  unit?: string;
  required: boolean;
  allowedValues?: string[];
}

export interface ToolTypeProps {
  id: string;
  /** Krok 5 - stejný důvod jako u `OperationType.tenantId` (viz
   *  docs/audits/step-5-audit.md). */
  tenantId: string;
  kod: string;
  nazev: string;
  category: ToolCategory;
  parameterDefinitions: ToolParameterDefinition[];
  stav: EntityStav;
  popis?: string;
}

/** Typ nástroje jako datový číselník - stejné zdůvodnění jako u OperationType.
 *  `parameterDefinitions` řídí, jaké dynamické parametry smí/musí mít `Tool`
 *  tohoto typu (validuje `CreateToolUseCase`/`UpdateToolUseCase`, ne entita
 *  samotná - `ToolType` typovou definici jen NESE). */
export class ToolType {
  private constructor(private props: ToolTypeProps) {}

  static create(props: ToolTypeProps): ToolType {
    if (!props.tenantId.trim()) throw new ValidationError("ToolType: 'tenantId' nesmí být prázdné.");
    if (!props.id.trim()) throw new ValidationError("ToolType: 'id' nesmí být prázdné.");
    if (!props.kod.trim()) throw new ValidationError("ToolType: 'kod' nesmí být prázdný.");
    if (!props.nazev.trim()) throw new ValidationError("ToolType: 'nazev' nesmí být prázdný.");
    const keys = new Set<string>();
    for (const def of props.parameterDefinitions) {
      if (!def.key.trim()) throw new ValidationError("ToolType: klíč parametru nesmí být prázdný.");
      if (keys.has(def.key)) throw new ValidationError(`ToolType: duplicitní klíč parametru "${def.key}".`);
      keys.add(def.key);
    }
    return new ToolType({ ...props });
  }

  static restore(props: ToolTypeProps): ToolType {
    return new ToolType({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get kod(): string {
    return this.props.kod;
  }
  get nazev(): string {
    return this.props.nazev;
  }
  get category(): ToolCategory {
    return this.props.category;
  }
  get parameterDefinitions(): readonly ToolParameterDefinition[] {
    return this.props.parameterDefinitions;
  }
  get stav(): EntityStav {
    return this.props.stav;
  }
  get popis(): string | undefined {
    return this.props.popis;
  }

  rename(nazev: string): void {
    if (!nazev.trim()) throw new ValidationError("ToolType: 'nazev' nesmí být prázdný.");
    this.props.nazev = nazev;
  }

  changeCode(kod: string): void {
    if (!kod.trim()) throw new ValidationError("ToolType: 'kod' nesmí být prázdný.");
    this.props.kod = kod;
  }

  updateDetails(input: { category?: ToolCategory; parameterDefinitions?: ToolParameterDefinition[]; popis?: string }): void {
    if (input.category !== undefined) this.props.category = input.category;
    if (input.parameterDefinitions !== undefined) {
      const keys = new Set<string>();
      for (const def of input.parameterDefinitions) {
        if (!def.key.trim()) throw new ValidationError("ToolType: klíč parametru nesmí být prázdný.");
        if (keys.has(def.key)) throw new ValidationError(`ToolType: duplicitní klíč parametru "${def.key}".`);
        keys.add(def.key);
      }
      this.props.parameterDefinitions = input.parameterDefinitions;
    }
    if (input.popis !== undefined) this.props.popis = input.popis || undefined;
  }

  setStav(stav: EntityStav): void {
    this.props.stav = stav;
  }
}

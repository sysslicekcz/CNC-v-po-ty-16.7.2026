export interface MachineProps {
  /** Stejné jako id navazujícího Resource (class-table inheritance - jeden
   *  logický zdroj, dva řádky: obecná data v Resource, detail tady). */
  id: string;
  oznaceni?: string;
  maxOtacky?: number;
  /** Odvozeno doménovou službou ResourceTypeClassifier z ResourceCapability,
   *  cachované tady kvůli řazení/filtrování v seznamech. Nikdy se nezadává ručně. */
  typStroje?: string;
}

/** Detailní rozšíření Resource pro resourceType = "machine". Samostatně nedává smysl -
 *  vždy existuje jen ve dvojici s odpovídajícím Resource záznamem. */
export class Machine {
  private constructor(private props: MachineProps) {}

  static create(props: MachineProps): Machine {
    return new Machine({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get oznaceni(): string | undefined {
    return this.props.oznaceni;
  }
  get maxOtacky(): number | undefined {
    return this.props.maxOtacky;
  }
  get typStroje(): string | undefined {
    return this.props.typStroje;
  }

  /** Volá ResourceTypeClassifier po každé změně ResourceCapability daného zdroje. */
  setTypStroje(typStroje: string): void {
    this.props.typStroje = typStroje;
  }
}

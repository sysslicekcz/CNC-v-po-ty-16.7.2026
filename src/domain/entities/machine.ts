import { ValidationError } from "../errors/validation-error";
import { HourlyRate } from "../value-objects/hourly-rate";
import { EntityStav } from "./common";

export interface MachineProps {
  id: string;
  nazev: string;
  oznaceni?: string;
  maxOtacky?: number;
  hourlyRate: HourlyRate;
  stav: EntityStav;
  poznamka?: string;
}

/** Stroj je vlastní jednoduchý agregát (vlastní MachineRepository), ne vnitřní
 *  entita něčeho jiného. Typ stroje se sem neukládá jako ručně zadané pole - odvozuje
 *  se z MachineCapability přes services/machine-type-classifier.ts (samostatný
 *  agregát, vlastní MachineCapabilityRepository - viz zadání, bod 13). Použito je
 *  přímo Machine, ne obecná abstrakce Resource - kooperace/měřidla/přípravky zatím
 *  neexistují, zavádět pro ně abstrakci předem by bylo předčasné (viz docs/adr/0010).*/
export class Machine {
  private constructor(private props: MachineProps) {}

  static create(props: MachineProps): Machine {
    if (!props.nazev.trim()) throw new ValidationError("Machine: 'nazev' nesmí být prázdný.");
    return new Machine({ ...props });
  }

  static restore(props: MachineProps): Machine {
    return new Machine({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get nazev(): string {
    return this.props.nazev;
  }
  get oznaceni(): string | undefined {
    return this.props.oznaceni;
  }
  get maxOtacky(): number | undefined {
    return this.props.maxOtacky;
  }
  get hourlyRate(): HourlyRate {
    return this.props.hourlyRate;
  }
  get stav(): EntityStav {
    return this.props.stav;
  }
  get poznamka(): string | undefined {
    return this.props.poznamka;
  }

  setHourlyRate(hourlyRate: HourlyRate): void {
    this.props.hourlyRate = hourlyRate;
  }

  setStav(stav: EntityStav): void {
    this.props.stav = stav;
  }
}

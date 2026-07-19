import { ValidationError } from "../errors/validation-error";

/**
 * Uživatelsky zadávaný výrobní/ERP kód stroje (Krok 3.5) - NENÍ totéž co
 * Machine.id (interní stabilní identita, viz docs/adr/0015). Helios bude
 * párovat stroje podle tohoto kódu, ne podle interního id.
 *
 * Pravidla: nesmí být prázdný, ořízne okolní mezery, zachovává pomlčky a
 * velikost písmen (žádná normalizace na upper/lowercase - projekt nemá
 * definované jednotné pravidlo a kódy jako "300-58140" i "KOOP-TEP" musí zůstat
 * čitelné přesně tak, jak je uživatel/Helios zadal). Záměrně bez restriktivního
 * regexu - kódy nejsou jen číslice (viz "SP-430", "DNM750", "KALIRNA-EXTERNI").
 */
export class MachineCode {
  private constructor(private readonly value: string) {}

  static create(value: string): MachineCode {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new ValidationError("MachineCode nesmí být prázdný.");
    }
    return new MachineCode(trimmed);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }

  static fromJSON(value: string): MachineCode {
    return MachineCode.create(value);
  }

  equals(other: MachineCode): boolean {
    return this.value === other.value;
  }
}

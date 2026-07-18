import { OperationCategory } from "../entities/operation-type";

/** Odvodí zobrazovaný typ stroje z množiny kategorií operací, které umí (viz
 *  Resource.resourceCapabilities -> OperationType.kategorie). Čistá funkce, žádný
 *  přístup k repozitářům - volající (use case) jí předá už načtené kategorie a
 *  výsledek uloží na Machine.setTypStroje(). */
export function classifyMachineType(categories: OperationCategory[]): string {
  const relevant: Set<OperationCategory> = new Set(
    categories.filter((c) => c !== "Preparation" && c !== "Other")
  );

  const has = (c: OperationCategory) => relevant.has(c);
  const only = (...allowed: OperationCategory[]) =>
    relevant.size > 0 && [...relevant].every((c) => allowed.includes(c));

  if (relevant.size === 0) return "Nezařazený zdroj";
  if (only("Inspection", "NDT")) return "Kontrolní / NDT pracoviště";
  if (only("Cutting")) return "Dělicí pracoviště";
  if (only("Grinding")) return "Bruska";
  if (only("Turning")) return "Soustruh";
  if (only("Milling")) return "Frézka";
  if (only("Turning", "Milling")) return "Soustružnické centrum";
  if (has("Milling") && (has("Turning") || has("Grinding") || relevant.size >= 3)) {
    return "Víceúčelové obráběcí centrum";
  }
  return "Víceúčelové obráběcí centrum";
}

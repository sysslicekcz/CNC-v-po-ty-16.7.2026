import { OperationCategory } from "../entities/operation-type";

/** Odvodí zobrazovaný typ stroje z množiny kategorií operací, které umí (podle
 *  enabled MachineCapability -> OperationType.kategorie). Čistá funkce, žádný
 *  přístup k repozitářům - volající (use case) jí předá už načtené kategorie. */
export function classifyMachineType(categories: OperationCategory[]): string {
  const relevant: Set<OperationCategory> = new Set(
    categories.filter((c) => c !== "preparation" && c !== "other")
  );

  const has = (c: OperationCategory) => relevant.has(c);
  const only = (...allowed: OperationCategory[]) =>
    relevant.size > 0 && [...relevant].every((c) => allowed.includes(c));

  if (relevant.size === 0) return "Nezařazený stroj";
  if (only("inspection", "ndt")) return "Kontrolní / NDT pracoviště";
  if (only("cutting")) return "Dělicí pracoviště";
  if (only("grinding")) return "Bruska";
  if (only("turning")) return "Soustruh";
  if (only("milling")) return "Frézka";
  if (only("turning", "milling")) return "Soustružnické centrum";
  if (has("milling") && (has("turning") || has("grinding") || relevant.size >= 3)) {
    return "Víceúčelové obráběcí centrum";
  }
  return "Víceúčelové obráběcí centrum";
}

import { computeOperation } from "@/lib/results";
import { CalculationEngine } from "@/domain/services/calculation-engine";
import { CalcOutput, CalculationInputRow } from "@/domain/aggregates/routing-sheet/types";

/**
 * Implementace doménového portu CalculationEngine nad existujícím
 * src/lib/calc.ts + src/lib/results.ts (computeOperation). Vzorce se v tomto
 * kroku neupravují - adapter jen dává doméně/aplikační vrstvě čistý vstupní bod
 * bez toho, aby doména sama importovala ze `src/lib` (Dependency Inversion -
 * doména definuje rozhraní, infrastruktura ho implementuje, ne naopak).
 *
 * Existující UI (ResultsPanel apod.) dál volá lib/results.ts přímo beze změny.
 * Až se lib/calc.ts fyzicky přesune do domény (plánovaný pozdější krok), tenhle
 * adapter zmizí.
 *
 * Dnes existuje jen jedna verze algoritmu (CURRENT_ALGORITHM_VERSION) - pokud by
 * volající předal jinou hodnotu `algorithmVersion`, adapter ji nemá jak
 * respektovat (staré vzorce nejsou verzované). To je zaznamenané omezení, ne
 * tichá chyba - viz README v tomto adresáři / docs/adr/0006.
 */
export class LegacyCalculationEngine implements CalculationEngine {
  compute(calculationType: string, inputParameters: unknown, _algorithmVersion: string): CalcOutput {
    void _algorithmVersion; // viz komentář výše - jediná dostupná verze vzorců
    return computeOperation(calculationType, inputParameters as CalculationInputRow[]);
  }
}

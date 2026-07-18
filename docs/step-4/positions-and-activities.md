# Upnutí (Position) a technologické činnosti (Activity) v editoru

## Hierarchie

`RoutingSheet → Operation → Position (upnutí) → Activity (technologická činnost) → Calculation` - beze změny z Kroku 2/3. Krok 4 přidává jen UI a chybějící veřejné mutátory (`Operation.movePosition`, `Position.rename`, `Position.setSortKey`).

## UI vzor: řádková tabulka, ne modál na políčko

Zadání (bod 12) vyžaduje, aby drobné úpravy nevyžadovaly těžké modály. `OperationPositionList` zobrazuje upnutí jako sbalitelné sekce (výchozí rozbalené), `OperationActivityTable` uvnitř každé sekce jako řádkovou tabulku (# / Činnost / Nástroj / Čas / akce) - přiřazení nástroje je inline `<select>`, přejmenování upnutí je inline input s commit-on-blur, žádný samostatný formulář/modál pro jednu drobnou úpravu.

Jediný modál v téhle části editoru je `CalculationPanel` (výpočet je vždycky víceřádkový vstup s víc parametry, tam modál dává smysl).

## Reorder bez drag-and-drop

`dnd-kit` (ani jiná DnD knihovna) NENÍ v projektu nainstalovaná a Krok 4 ji vědomě nepřidává. Přeuspořádání upnutí i činností funguje VÝHRADNĚ přes tlačítka ↑/↓ (`onMove(id, "up" | "down")`) - splňuje to zadání i jako přístupnostní alternativu (bod z accessibility požadavků), ne jen jako provizorium. Plnohodnotné drag-and-drop je zdokumentovaný budoucí vylepšení, ne chybějící funkce.

## Přidání činnosti

Mini-formulář (výběr typu operace z `MACHINE_OPERATIONS` číselníku z `src/lib/operations.ts` - STEJNÝ číselník jako legací appka) + tlačítko "Přidat" - žádný modál. Typ operace se mapuje na `OperationType.id` přes `OperationType.kod === MACHINE_OPERATIONS[i].id` konvenci (ověřeno v `operation-type-seed.ts`).

## Validace

`positions-ambiguous-order` (error, defenzivní - u dvou upnutí se stejným `sortKey`, nemělo by běžně nastat), `activity-unknown-operation-type` (error - činnost odkazuje na neexistující/smazaný typ operace).

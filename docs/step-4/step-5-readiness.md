# Připravenost na Krok 5

Co Krok 4 záměrně NEŘEŠIL (mimo rozsah zadání), a co by následující krok mohl najít připravené.

## Explicitně mimo rozsah Kroku 4 (podle zadání)

Kapacitní plánování, Ganttovy diagramy, automatické plánování výroby, synchronizace s výrobním ERP, správa uživatelů/rolí, víceosobé schvalovací workflow, elektronický podpis, plnohodnotný výrobní terminál, automatická generace NC programů, modul kvality, správa licencí/fakturace - žádné z toho Krok 4 nezavádí, ani jako skeleton.

## Co je připravené, ale nezapojené (kandidáti na dokončení v Kroku 5)

- **`ReleasedRoutingSheetSnapshot` zobrazení** - use case (`GetReleasedRoutingSheetUseCase`) i data existují, chybí UI cesta k němu (viz `docs/step-4/known-limitations.md`, bod 1).
- **Tisk vydaného postupu** - existující `.print-area` vzor z legacy appky je připravený k převzetí.
- **`calculations.advanced`** - licenční kód existuje, čeká na doménové rozlišení typů kalkulace.
- **Externí reference na operaci** (Krok 3.5 dodatek - `ExternalReference`/`ErpConnector`) - `RoutingOperationEditor` zobrazuje `externalReferences` jako READ-ONLY info box, ale editor nemá UI pro jejich zakládání/mazání - to je mimo rozsah Kroku 4 (integrace samotná byla Krok 3.5).

## Domény, které Krok 5 může rozšířit beze změny existujícího tvaru

- `OperationResourceAssignment` union je otevřený vzor - přidání třetího typu zdroje (kdyby vznikl) by šlo bez zásahu do stávajících dvou větví.
- `RoutingSheetEditorLookups` (mapper) je navržený tak, aby přijímal dodatečné dávkově natažené číselníky bez zásahu do existujících.
- `ValidateRoutingSheetUseCase` je čistá funkce nad polem pravidel - přidání nového pravidla je jeden nový `if`/push blok, ne architektonická změna.

## Doporučení pro Krok 5

1. Dořešit zobrazení přes `ReleasedRoutingSheetSnapshot` místo živé `RoutingSheet` u vydaných postupů (bod 1 výše) - nejvyšší priorita, protože je to přesně scénář, který snapshot měl řešit.
2. Zvážit potvrzovací dialog/undo pro mazání operací (viz `docs/step-4/known-limitations.md`, bod 7).
3. Pokud appka poroste o víc podobných React hooků/komponent, zvážit zavedení `@testing-library/react` - Krok 4 rozsah UI komponent (13 nových) je poslední bod, kdy je únosné jít bez něj.

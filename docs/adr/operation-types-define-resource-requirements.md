# Typ operace nese informaci o vyžadovaném zdroji, ale nevynucuje ji

## Status
Přijato (Krok 5 - Správa kmenových dat TPV)

## Context
Editor technologického postupu (Krok 4) umožňuje přiřadit operaci stroj NEBO kooperaci NEBO nic (`OperationResourceAssignment`), ale doména dřív nevěděla, jaký zdroj daný typ operace typicky POTŘEBUJE - uživatel mohl omylem přiřadit kooperaci k typu operace, který dává smysl jen na stroji, aniž by dostal jakékoliv varování. Krok 5 zpřístupňuje `OperationType` jako editovatelná data (viz `docs/adr/business-codes-are-tenant-scoped.md`) - vhodná chvíle přidat i tuhle informaci.

## Decision
`OperationType.resourceRequirement: "machine"|"external"|"either"|"none"` nese deklaraci, jaký druh zdroje typ operace typicky potřebuje. Zároveň se přidávají `requiresSetupTime: boolean`/`requiresUnitTime: boolean` (jestli typ operace obvykle potřebuje seřizovací/kusový čas).

**Pole je jen informativní, editor postupu z Kroku 4 ho v TOMHLE kroku NEVYNUCUJE** - technolog může operaci přiřadit i "nesprávnému" typu zdroje, appka to nezablokuje ani nevaruje. Rozhodnutí je vědomé zúžení rozsahu (zadání Kroku 5 se soustředí na správu kmenových dat, ne na validaci editoru) - pole existuje jako připravený podklad pro budoucí validaci/varování (Krok 6+).

## Consequences
- `resourceRequirement`/`requiresSetupTime`/`requiresUnitTime` jsou dnes čistě popisná metadata - jejich hodnota neovlivňuje žádné běhové chování appky.
- Budoucí rozšíření (validace v `ValidateRoutingSheetUseCase`, varování v UI) může tahle pole přímo použít, aniž by musela měnit doménový model `OperationType` znovu.
- Riziko: uživatel může nastavit `resourceRequirement` a pak ho v praxi ignorovat bez jakékoliv zpětné vazby appky - přijato jako dočasný stav, zdokumentováno v `docs/step-5/known-limitations.md` a `docs/step-5/step-6-readiness.md`.

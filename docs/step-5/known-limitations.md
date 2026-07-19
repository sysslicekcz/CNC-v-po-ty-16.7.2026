# Krok 5 – známá omezení

Vědomě přijatá omezení a mezery objevené při implementaci, ne přehlédnuté chyby. Stejný formát jako `docs/step-4/known-limitations.md`.

1. **`ResolveCuttingConditionUseCase` není zapojený do `CalculateOperationUseCase`.** Řezné podmínky se dají spravovat a dotazovat, ale kalkulační panel Kroku 4 je automaticky nenabízí/nepředvyplňuje. Viz `docs/step-5/integration-with-calculations.md`.

2. **`OperationTypeCapabilityRequirement` nefiltruje výběr strojů v editoru.** Vazby "typ operace vyžaduje vlastnost X" se dají spravovat, ale `ResourceSelector` (Krok 4) o nich neví - žádné doporučování/filtrování kompatibilních strojů podle capabilit. Zadání to explicitně vylučuje z rozsahu ("žádný automatický výběr stroje").

3. **Čtyři starší entity (`OperationType`, `Tool`, `ToolType`, `ToolMachineCondition`) používají Czech `EntityStav` místo nového `MasterDataStatus`.** Funkčně identické, jen jiná jména hodnot (`"aktivni"/"neaktivni"` vs. `"active"/"inactive"`) - vědomě nesjednoceno, viz `docs/step-5/master-data-principles.md`.

4. **`ReactivateSupplierUseCase` neexistuje** - jen `DeactivateSupplierUseCase`. Drobná mezera oproti symetrii ostatních entit (Machine/CapacityGroup/ExternalOperationResource/OperationType/Tool mají obojí).

5. **`MaterialGroup` nemá `UpdateMaterialGroupUseCase`** - jen create/deactivate/list. Přejmenování skupiny po založení není přes UI možné v tomto kroku.

6. **CSV import s náhledem před commitem je implementovaný jen pro Machine** - ostatních 7 sekcí má jen export. Zdůvodněno v `docs/step-5/import-export.md` (rozdílná pole/FK vazby napříč entitami, univerzální import komponenta by byla přesně ta abstrakce, které se zadání vyhýbá).

7. **Import není jedna atomická DB transakce přes všechny řádky** - každý řádek se aplikuje samostatným voláním use casu. Selhání jednoho řádku nezablokuje ostatní, ale taky nejde "vše nebo nic" vrátit zpět jedním kliknutím.

8. **Kontroly použití (`MasterDataUsageChecker`) pro Machine/Tool/OperationType/ExternalOperationResource jsou globální/konzervativní sken, ne přesně tenant-scoped** - protože `Operation`/`Activity` (Krok 4) nejsou tenant-scoped přímo. Nikdy méně bezpečné, jen případně přehnaně opatrné (odmítne smazání, i když by ve skutečnosti šlo). Viz `docs/step-5/deactivation-and-history.md`.

9. **Některé usage-kontroly dělají plný `tpvGetAll` sken tabulky** (`Activity.toolId`, `Operation.externalResourceId`) místo indexovaného dotazu - vědomý kompromis, aby se nemusela dělat další DB verze jen kvůli delete-guardům. Při velkém počtu technologických postupů to bude pomalejší, ne nesprávné.

10. **Žádný React testing harness (stejné jako Krok 3.5/4).** Testy pokrývají doménu, application use casy, repository (přes `fake-indexeddb`) a jednu čistou UI logiku (`buildPreview` z CSV importu) - NE skutečné vykreslení React komponent. UI ověřeno ručně přes Playwright (živý prohlížeč): založení/úprava/deaktivace napříč všemi 8 sekcemi, přiřazení capability, CSV export+import round-trip, žádné console chyby. Viz `docs/step-5/known-limitations.md` bod 8 z Kroku 4 pro stejné odůvodnění.

11. **Testová sada je reprezentativní, ne vyčerpávající vůči zadání (sekce 61-73).** Pokryty jsou klíčové cesty pro každou entitu (create/update/deactivate/reactivate, unikátnost kódu, licenční brány, alespoň jeden limit), tenant izolace (reprezentativní podmnožina entit, ne všech 13), jeden plný integrační test (kmenová data → editor → kalkulace → zamrzlý snapshot), CSV utility a 5 architektonických testů. Nepokryté kombinace (např. všechny licenční stavy × všechny akce, nebo kompletní UI klávesové zkratky) nejsou testované jednotlivě.

12. **`ToolRepository`/`OperationTypeRepository`/`MachineCapabilityRepository`/`ToolMachineConditionRepository` byly netenant-scoped od Kroku 3.5/4 - TOHLE JE OPRAVENO Krokem 5** (uvedeno tady pro úplnost, protože `docs/step-4/known-limitations.md` bod 11 tenhle stav ještě popisoval jako otevřenou mezeru - Krok 5 ji uzavřel).

13. **Migrace strojů/nástrojů ze staré appky (`/dev/tpv-migration`) nevyplňuje nová pole** (`category`, `manufacturer`, `model`, `maxPowerKw`, `parameters`, `supplierId`, ...) - zůstávají `undefined`, uživatel je doplní ručně přes nový formulář po migraci.

14. **`Part.material` (volný text) se nepřevádí na `Material` FK.** Nová entita `Material` existuje nezávisle - propojení volného textu na strukturovaná data by riskovalo špatné párování a je mimo rozsah.

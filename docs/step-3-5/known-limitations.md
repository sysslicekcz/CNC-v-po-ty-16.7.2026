# Krok 3.5 – známá omezení

Vědomě přijatá omezení tohoto kroku, ne přehlédnuté mezery. Každé má odkaz na to, proč je přijatelné teď a co by ho řešilo příště.

1. **`tenantId` je jen na vybraných entitách.** `Customer`, `Order`, `Part`, `RoutingSheet`, `Operation`, `Position`, `Activity`, `Calculation` nemají `tenantId` - jen `Machine`, `MachineCapability`, `Tool`, `ToolMachineCondition`, `CapacityGroup`, `ExternalOperationResource`, `License`, `MigrationRunRecord`, `MigrationIssueRecord`. Viz `docs/adr/0019`. Řeší se rozšířením v budoucím kroku, až appka bude multi-tenantní i v UI.

2. **Smazání `CapacityGroup` neodpojí napojené stroje.** `Machine.capacityGroupId` zůstane ukazovat na smazané id - repository sám neuklízí cizí odkazy. Otestováno v `capacity-group-repository.test.ts`. Řešením by byl buď kaskádový úklid v use casu, nebo (bezpečněji) zákaz smazání skupiny s napojenými stroji - zatím neimplementováno, protože UI pro správu skupin v tomhle kroku neexistuje.

3. **`ExternalSystemReference` (`src/domain/value-objects/external-system-reference.ts`) je nepoužitý typ.** Připravený tvar dat pro budoucí Helios párování (bod 16 zadání), nikde ve zbytku appky zapojený. Bezpečné - je to jen typová deklarace bez chování.

4. **Žádný React testing harness.** Projekt nemá `@testing-library/react`/`jsdom`/`happy-dom` v devDependencies (jen `vitest` + `fake-indexeddb`, zavedené v Kroku 2/3 pro doménové/persistenční testy). `FeatureGate` je proto testovaný přes vytaženou čistou funkci `resolveFeatureGateState()` (`feature-gate-logic.ts`), ne přes skutečné vykreslení komponenty do DOM. Přidání testing harness je vědomě odloženo, aby se nezaváděla nová závislost jen kvůli jedné komponentě - až vznikne víc UI komponent (Krok 4 - editor postupů), stojí za to zavést pořádně.

5. **`DevelopmentLicenseProvider` čte `process.env.NODE_ENV` přímo (s možností přepsat pro testy).** Bezpečný default (jen `"development"` rozšiřuje přístup), ale appka nemá formální "environment gate" mechanismus mimo tuhle jednu kontrolu - pokud by appka získala víc podobných dev-only přepínačů, stálo by za to je sjednotit.

6. **`LicenseValidationRecord`/store `tpvLicenseValidation` je založený, ale nepoužitý.** `License.validation` se dnes ukládá vnořeně přímo v `LicenseRecord.validation` (mapper `license-mapper.ts`), samostatný store `tpvLicenseValidation` je připravený pro budoucí odlehčené periodické ověřování bez nutnosti načítat celou licenci - v tomhle kroku se nezapisuje ani nečte.

7. **Fyzické smazání stroje/kooperace/skupiny nemá vlastní use case.** `DeactivateMachineUseCase` preferuje deaktivaci; `MachineRepository.delete()`/`CapacityGroupRepository.delete()`/`ExternalOperationResourceRepository.delete()` na úrovni repozitáře existují (a jsou otestované), ale žádný use case je v tomhle kroku nevystavuje - vědomě, aby se předešlo náhodnému mazání dat s historickými vazbami.

8. **Legacy migrovaná data (běhy z Kroku 3, DB_VERSION 1) nejdou znovu načíst mapperem bez opětovného spuštění migrace**, protože `Machine.code`/`Machine.tenantId` jsou nově povinná pole domény. Přijatelné - jde o interní vývojové prostředí bez produkčních dat (viz `docs/audits/step-3-5-audit.md`).

# Krok 3.5 – známá omezení

Vědomě přijatá omezení tohoto kroku, ne přehlédnuté mezery. Každé má odkaz na to, proč je přijatelné teď a co by ho řešilo příště.

1. **`tenantId` je jen na vybraných entitách.** `Customer`, `Order`, `Part`, `RoutingSheet`, `Operation`, `Position`, `Activity`, `Calculation` nemají `tenantId` - jen `Machine`, `MachineCapability`, `Tool`, `ToolMachineCondition`, `CapacityGroup`, `ExternalOperationResource`, `License`, `MigrationRunRecord`, `MigrationIssueRecord`. Viz `docs/adr/0019`. Řeší se rozšířením v budoucím kroku, až appka bude multi-tenantní i v UI.

2. **Smazání `CapacityGroup` neodpojí napojené stroje.** `Machine.capacityGroupId` zůstane ukazovat na smazané id - repository sám neuklízí cizí odkazy. Otestováno v `capacity-group-repository.test.ts`. Řešením by byl buď kaskádový úklid v use casu, nebo (bezpečněji) zákaz smazání skupiny s napojenými stroji - zatím neimplementováno, protože UI pro správu skupin v tomhle kroku neexistuje.

3. **`ExternalSystemReference` (`src/domain/value-objects/external-system-reference.ts`) je nepoužitý typ, nahrazený plnohodnotným `ExternalSystem`/`ExternalReference` modelem.** Původně připravený jako předběžný tvar dat pro budoucí párování s externím systémem (bod 16 zadání Krok 3.5), po dodatku "ERP-nezávislá architektura" ho nahrazuje `src/domain/integrations/external-system.ts` + `external-reference.ts`. `ExternalSystemReference` zůstává v kódu jako nepoužitý typ (bezpečné - jen typová deklarace bez chování), zatím nesmazaný, aby se zbytečně neměnilo víc, než je nutné.

4. **Žádný React testing harness.** Projekt nemá `@testing-library/react`/`jsdom`/`happy-dom` v devDependencies (jen `vitest` + `fake-indexeddb`, zavedené v Kroku 2/3 pro doménové/persistenční testy). `FeatureGate` je proto testovaný přes vytaženou čistou funkci `resolveFeatureGateState()` (`feature-gate-logic.ts`), ne přes skutečné vykreslení komponenty do DOM. Přidání testing harness je vědomě odloženo, aby se nezaváděla nová závislost jen kvůli jedné komponentě - až vznikne víc UI komponent (Krok 4 - editor postupů), stojí za to zavést pořádně.

5. **`DevelopmentLicenseProvider` čte `process.env.NODE_ENV` přímo (s možností přepsat pro testy).** Bezpečný default (jen `"development"` rozšiřuje přístup), ale appka nemá formální "environment gate" mechanismus mimo tuhle jednu kontrolu - pokud by appka získala víc podobných dev-only přepínačů, stálo by za to je sjednotit.

6. **`LicenseValidationRecord`/store `tpvLicenseValidation` je založený, ale nepoužitý.** `License.validation` se dnes ukládá vnořeně přímo v `LicenseRecord.validation` (mapper `license-mapper.ts`), samostatný store `tpvLicenseValidation` je připravený pro budoucí odlehčené periodické ověřování bez nutnosti načítat celou licenci - v tomhle kroku se nezapisuje ani nečte.

7. **Fyzické smazání stroje/kooperace/skupiny nemá vlastní use case.** `DeactivateMachineUseCase` preferuje deaktivaci; `MachineRepository.delete()`/`CapacityGroupRepository.delete()`/`ExternalOperationResourceRepository.delete()` na úrovni repozitáře existují (a jsou otestované), ale žádný use case je v tomhle kroku nevystavuje - vědomě, aby se předešlo náhodnému mazání dat s historickými vazbami.

8. **Legacy migrovaná data (běhy z Kroku 3, DB_VERSION 1) nejdou znovu načíst mapperem bez opětovného spuštění migrace**, protože `Machine.code`/`Machine.tenantId` jsou nově povinná pole domény. Přijatelné - jde o interní vývojové prostředí bez produkčních dat (viz `docs/audits/step-3-5-audit.md`).

9. **`ErpConnectorRegistry`/`ErpConnector` jsou jen kontrakty bez reálné implementace.** V appce existuje jen testovací `FakeErpConnector` (`src/infrastructure/integrations/testing/fake-erp-connector.ts`), který se nikde nezapojuje do skutečného běhu appky. Žádný konkrétní ERP konektor (Helios ani jiný) není v tomhle dodatku implementovaný - vědomě, viz `docs/adr/anti-corruption-layer-for-erp-connectors.md` ("V tomto kroku postačí testovací FakeErpConnector").

10. **`GetFeatureAccessSnapshotUseCase` zatím prochází jen uzavřený katalog `FeatureCode`, ne dynamické `ConnectorFeatureCode`.** `FeatureAccessSnapshot.access` tedy neobsahuje `connector.helios`/`connector.sap` apod., i když `FeatureAccessService`/`License` je už umí vyhodnotit (viz `default-feature-access-service.test.ts`, `connector-license-decoupling.test.ts`). Rozšíření snapshotu o dynamické konektorové kódy (typicky podle toho, co vrátí `ErpConnectorRegistry.list()`) je odložené na krok, kdy vznikne UI pro správu konektorů.

11. **`IntegrationRun`/`IntegrationIssue` mají hotovou persistenci (`tpvIntegrationRuns`, `tpvIntegrationIssues`, repozitáře), ale žádný use case je zatím nezapisuje.** Nic v appce dnes reálně neimportuje/nesynchronizuje data s externím systémem - persistence je připravená pro budoucí konektor, ne aktivně používaná.

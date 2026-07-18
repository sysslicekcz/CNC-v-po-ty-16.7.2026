# Licenční model

Viz `docs/adr/0020` až `docs/adr/0023` pro jednotlivá rozhodnutí. Tenhle dokument je souhrnný přehled celého toku.

## Co Krok 3.5 NEIMPLEMENTUJE

Plnou ERP integraci (import/export/sync dat s reálným konkrétním systémem), auto-sync, platby, billing, subscription management, plnou autentizaci, uživatelské role, vzdálený licenční server. Postavený je jen **lokální, offline funkční základ**, na který se dá bezpečně navázat - viz `docs/step-3-5/erp-integration.md` pro integrační vrstvu samotnou.

## Katalog: FeatureCode, FeatureAccess, LicenseLimitCode

- `FeatureCode` (`src/domain/licensing/feature-code.ts`) - stabilní seznam string literálů (`routing.view`, `machines.manage`, `integration.erp.sync`, ...) - integrační funkce jsou ERP-neutrální (`integration.erp.*`/`integration.file.*`), NE vázané na konkrétní ERP (viz `docs/adr/erp-agnostic-integration-layer.md`). `FeatureCodes` je pohodlný objekt se stejnými hodnotami pro autocomplete. Dostupnost KONKRÉTNÍHO konektoru řídí samostatný dynamický `ConnectorFeatureCode` (`connector.helios`, `connector.sap`, ...) - `LicenseFeatureCode = FeatureCode | ConnectorFeatureCode`.
- `FeatureAccess` = `"none" | "read" | "write" | "full"` (`src/domain/licensing/feature-access.ts`) - řazený model přístupu, `satisfiesAccess(actual, required)` porovnává úrovně.
- `LicenseLimitCode` (`src/domain/licensing/license-limit-code.ts`) - `users.max`, `machines.max`, `routingSheets.active.max`, `calculations.monthly.max`, `storage.mb.max`, `integrations.systems.max` (počet připojených externích systémů).

## Entita License

`License` (`src/domain/licensing/license.ts`): `id`, `tenantId`, `planCode` (jen popisný štítek - **nikdy** se podle něj nerozhoduje, viz `docs/adr/0020`), `status` (`trial|active|expired|suspended|cancelled`), `validFrom`/`validUntil`, `features: LicensedFeature[]`, `limits: LicenseLimit[]`, `issuedAt`/`updatedAt`, volitelný `validation` (příprava na budoucí vzdálené ověřování - grace period, dnes se aktivně nevyužívá).

`getFeatureAccess(code)` vrací `undefined`, pokud funkce v licenci vůbec není zmíněná (= chová se jako `"none"`, ale rozdíl je vidět, kdyby byl v budoucnu potřeba).

## Tok rozhodování: DefaultFeatureAccessService

Jediná implementace `FeatureAccessService` (`src/application/licensing/default-feature-access-service.ts`). `resolveActiveLicense()` postupně ověří:

1. Tenant existuje a je `isActive` (jinak `TenantNotActiveError`).
2. Licence není `suspended` (jinak `LicenseSuspendedError`).
3. Licence není `expired`/`cancelled` MIMO grace period (jinak `LicenseExpiredError`).
4. Licence je v `validFrom`/`validUntil` platnosti MIMO grace period (jinak `LicenseExpiredError`).

Teprve pak `getAccess`/`require`/`canUse`/`getLimit`/`assertWithinLimit` pracují nad vrácenou licencí. `require()` rozlišuje `FeatureNotLicensedError` (funkce vůbec není v licenci) od `ReadOnlyLicenseError` (funkce je, ale jen na nižší úrovni přístupu, než se požaduje).

## LicenseProvider vs. LicenseRepository

- `LicenseRepository` (port, `src/domain/repositories/license-repository.ts`) - čistě persistence: `findByTenantId`, `save`.
- `LicenseProvider` (port, `src/domain/licensing/license-provider.ts`) - "efektivní aktuální licence k použití". Implementace:
  - `LocalLicenseProvider` (`src/infrastructure/licensing/local-license-provider.ts`) - čte z `LicenseRepository`, chybějící licenci hlásí jako `LicenseUnavailableError` (nikdy tiše nepovolí vše).
  - `DevelopmentLicenseProvider` (`src/infrastructure/licensing/development-license-provider.ts`) - dekorátor nad libovolným `LicenseProvider`. **JEN** pokud `isDevelopmentEnv()` (výchozí: `process.env.NODE_ENV === "development"`) vrátí `true`, rozšíří licenci na `"full"` přístup ke VŠEM `FeatureCode` - jinak je čistý passthrough na `fallback`. V produkci se tedy nikdy nerozšíří přístup, i kdyby byl tenhle dekorátor omylem zapojený.

Oddělení umožňuje budoucí kompozici (lokální + vzdálené ověření, grace period) beze změny use casů, které závisí jen na `LicenseProvider`.

## Výchozí lokální licence

`ensureDefaultTenantAndLicense()` (`src/infrastructure/licensing/seed-default-tenant.ts`) idempotentně vytvoří licenci odpovídající tomu, co appka DNES fakticky umí:

```
features: routing.view (full), routing.edit (full), calculations.basic (full),
          machines.view (full), machines.manage (full), tools.view (full), tools.manage (full)
limits: [] (bez omezení)
status: active, validFrom: epoch (0), bez validUntil (trvalá)
```

Funkce, které appka ještě nemá v UI (plánování, ERP integrace, kooperace, capacity groups), NEJSOU v licenci uvedené - `FeatureAccessService` je vrátí jako `"none"`, dokud nebudou skutečně implementované a vědomě licenčně zpřístupněné.

## Vynucení v Application vrstvě, ne jen v UI

Viz `docs/adr/0021`. Každý chráněný use case (`CreateMachineUseCase`, `CreateCapacityGroupUseCase`, `CreateExternalOperationResourceUseCase`, ...) volá `featureAccessService.require(...)`/`assertWithinLimit(...)` explicitně - není to automatické (žádný middleware/dekorátor). `FeatureGate` (UI) je jen druhá, ne jediná ochrana.

## FeatureAccessSnapshot a FeatureGate

`GetFeatureAccessSnapshotUseCase` (`src/application/licensing/get-feature-access-snapshot-use-case.ts`) projde CELÝ katalog `FeatureCode` a sestaví `FeatureAccessSnapshot` (`{tenantId, tenantActive, access: Record<FeatureCode, FeatureAccess>, licenseError?}`) - jedno načtení pro celé UI, místo aby si každá komponenta volala `FeatureAccessService` zvlášť. Chyba při vyhodnocení licence (neaktivní tenant, vypršelá/pozastavená licence) se nepropaguje jako výjimka celého use casu - promítne se do `licenseError` a všechny funkce dostanou `"none"`.

`FeatureGate` (`src/presentation/components/feature-gate.tsx`) je čistě prezentační - řídí se podle snapshotu, rozhodovací logika je vytažená do `resolveFeatureGateState()` (`feature-gate-logic.ts`), aby šla plně otestovat bez React rendereru (projekt zatím nemá testing-library/jsdom v devDependencies - viz `docs/step-3-5/known-limitations.md`). Stavy: `loading` (snapshot ještě `null`), `error` (`licenseError` vyplněný), `denied` (nedostatečný přístup), `granted`.

## Licence jednotlivých konektorů

`ErpConnectorDescriptor.requiredFeatureCode` (`src/domain/integrations/erp-connector-registry.ts`) umožňuje, aby konkrétní konektor (Helios, SAP, vlastní REST API, ...) vyžadoval vlastní `ConnectorFeatureCode` (typicky `connector.<connectorType>`) navíc k obecným `integration.erp.*` funkcím - organizace tak může mít licencovaný ERP import obecně, ale konkrétní konektor (např. `connector.sap`) zůstane nedostupný, dokud ho licence explicitně neuvede. `FeatureAccessService.require(connectorFeatureCode("helios"), ...)` funguje stejně jako pro libovolný jiný `FeatureCode` - žádné rozšíření kontraktu nebylo potřeba (viz `connector-license-decoupling.test.ts`). Odebrání licence konektoru NIKDY nemaže dřív importovaná data (`ExternalReference`/`ExternalSystem` na licenci vůbec nezávisí) - viz `docs/adr/0022` a `docs/adr/erp-agnostic-integration-layer.md`.

## Limity nikdy nemažou data

Viz `docs/adr/0022`. `assertWithinLimit()` je čistě READ - nikdy nemaže ani neupravuje existující entity. Snížení limitu ovlivní jen PŘÍŠTÍ pokusy o vytvoření nového záznamu.

## Licence ≠ uživatelská oprávnění

Viz `docs/adr/0023`. Licence odpovídá na "co smí ORGANIZACE", ne "co smí KONKRÉTNÍ UŽIVATEL" - appka dnes nemá pojem uživatel/role/přihlašování vůbec.

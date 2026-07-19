# Krok 3.5 – architektura přidaných vrstev

Shrnutí toho, co Krok 3.5 přidal nad architekturu z Kroku 2/3 (Clean Architecture: `domain` → `application` → `infrastructure`, plus nová `presentation` vrstva pro UI komponenty). Detail jednotlivých témat je v samostatných dokumentech v tomhle adresáři a v ADR 0015-0023. Dodatek "ERP-nezávislá architektura" (viz `docs/step-3-5/erp-integration.md`, ADR `erp-agnostic-integration-layer`/`external-system-reference-mapping`/`anti-corruption-layer-for-erp-connectors`) navíc přidal `src/domain/integrations/` a `src/infrastructure/integrations/` - appka je ERP-neutrální integrační architektura, ne appka připravená konkrétně na Helios.

## Co bylo přidáno, po vrstvách

### `src/domain`
- **Entity**: `Tenant`, `CapacityGroup`, `ExternalOperationResource`.
- **Value Objects**: `MachineCode`, `TenantCode`, `CapacityGroupCode`, `ExternalResourceCode`, `ToolCode`, `ExternalSystemReference` (nepoužitý typ, nahrazený `ExternalSystem`/`ExternalReference`, viz `known-limitations.md`).
- **Licensing** (`src/domain/licensing/`): `FeatureCode`/`FeatureCodes`/`ConnectorFeatureCode`/`LicenseFeatureCode`, `FeatureAccess`, `LicenseLimitCode`, `License`, `LicenseProvider` (port), `FeatureAccessService` (port).
- **Integrations** (`src/domain/integrations/`, dodatek "ERP-nezávislá architektura") - `ExternalSystem`, `ExternalReference` (+ `ExternalReferenceEntityType`), `ExternalEntityResolver`, `ErpConnector` (+ `ConnectorCapabilities`, `ExternalMachineData`, import/export/sync request/result typy), `ErpConnectorRegistry` (+ `ErpConnectorDescriptor`), `IntegrationRun`, `IntegrationIssue`. Žádný z těchto typů nezná jméno konkrétního ERP - viz `docs/step-3-5/erp-integration.md`.
- **Repository rozhraní**: `TenantRepository`, `CapacityGroupRepository`, `ExternalOperationResourceRepository`, `LicenseRepository`, `ExternalSystemRepository`, `ExternalReferenceRepository`, `IntegrationRunRepository`, `IntegrationIssueRepository`. `MachineRepository` přepsáno na tenant-scoped (`findById(id, tenantId)` atd.).
- **Services**: `TenantContext` (port).
- **Errors**: `MachineCodeAlreadyExistsError`, `UnknownMachineCodeError`, `CapacityGroupCodeAlreadyExistsError`, `ExternalResourceCodeAlreadyExistsError`, `ExternalSystemCodeAlreadyExistsError`, `DuplicateExternalReferenceError`, `UnknownConnectorTypeError`, a licenční chyby (`license-errors.ts`).
- **Rozšíření existujících entit**: `Machine` (anglické názvy polí, `tenantId`, `code`, `capacityGroupId`), `MachineCapability`/`Tool`/`ToolMachineCondition` (`tenantId`), `CalculationSnapshot` (`machineCode`, `toolCode`).

### `src/application`
- `src/application/tenants/get-current-tenant-use-case.ts`
- `src/application/licensing/` - `DefaultFeatureAccessService` (jediná implementace `FeatureAccessService`), `FeatureAccessSnapshot` DTO, `GetFeatureAccessSnapshotUseCase`.
- `src/application/machines/` - `CreateMachineUseCase`, `UpdateMachineUseCase`, `DeactivateMachineUseCase`, `ResolveMachineByCodeUseCase`, `AssignMachineToCapacityGroupUseCase`.
- `src/application/capacity-groups/create-capacity-group-use-case.ts`
- `src/application/cooperations/create-external-operation-resource-use-case.ts`
- `src/application/integrations/default-external-entity-resolver.ts` - jediná implementace `ExternalEntityResolver`.
- `src/application/events/application-event.ts` - jen typové deklarace, žádný event bus.

### `src/infrastructure`
- `src/infrastructure/services/local-tenant-context.ts` - implementace `TenantContext`.
- `src/infrastructure/licensing/` - `LocalLicenseProvider`, `DevelopmentLicenseProvider`, `seed-default-tenant.ts`.
- `src/infrastructure/integrations/` (dodatek "ERP-nezávislá architektura") - `InMemoryErpConnectorRegistry` (implementace `ErpConnectorRegistry`), `testing/FakeErpConnector` (jen pro testy, nikdy zapojený do provozu appky).
- `src/infrastructure/persistence/indexeddb/` - nové records/mappers/repository implementace pro Tenant/CapacityGroup/ExternalOperationResource/License/ExternalSystem/ExternalReference/IntegrationRun/IntegrationIssue, `tpv-db.ts` povýšeno na `DB_VERSION = 3` (aditivní upgrady v2 pak v3).
- `src/infrastructure/migration/` - `migrate-machines.ts` rozšířeno o `tenantId`+`code` fallback, seed tenanta/licence volaný na začátku `runMigrationEngine`.

### `src/presentation` (nová vrstva)
- `feature-gate.tsx` + `feature-gate-logic.ts` (čistá rozhodovací funkce, testovatelná bez DOM) + `feature-unavailable-notice.tsx`.

## Diagram závislostí (jen nové/změněné části)

```
presentation/FeatureGate
        │ čte
        ▼
application/GetFeatureAccessSnapshotUseCase
        │ používá
        ▼
domain/FeatureAccessService (port) ◄──implementuje── application/DefaultFeatureAccessService
        │ používá                                              │ používá
        ▼                                                      ▼
domain/TenantContext (port)                     domain/LicenseProvider (port)
        ▲ implementuje                                          ▲ implementuje
infrastructure/LocalTenantContext          infrastructure/LocalLicenseProvider ──obaluje── DevelopmentLicenseProvider
                                                                 │ čte
                                                                 ▼
                                            infrastructure/IndexedDbLicenseRepository
```

Směr závislostí zůstává striktně dovnitř (infrastructure → application → domain), stejně jako v Kroku 2/3 - žádná výjimka.

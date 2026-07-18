# Krok 3.5 – architektura přidaných vrstev

Shrnutí toho, co Krok 3.5 přidal nad architekturu z Kroku 2/3 (Clean Architecture: `domain` → `application` → `infrastructure`, plus nová `presentation` vrstva pro UI komponenty). Detail jednotlivých témat je v samostatných dokumentech v tomhle adresáři a v ADR 0015-0023.

## Co bylo přidáno, po vrstvách

### `src/domain`
- **Entity**: `Tenant`, `CapacityGroup`, `ExternalOperationResource`.
- **Value Objects**: `MachineCode`, `TenantCode`, `CapacityGroupCode`, `ExternalResourceCode`, `ToolCode`, `ExternalSystemReference` (nepoužitý typ, příprava na Helios).
- **Licensing** (`src/domain/licensing/`): `FeatureCode`/`FeatureCodes`, `FeatureAccess`, `LicenseLimitCode`, `License`, `LicenseProvider` (port), `FeatureAccessService` (port).
- **Repository rozhraní**: `TenantRepository`, `CapacityGroupRepository`, `ExternalOperationResourceRepository`, `LicenseRepository`. `MachineRepository` přepsáno na tenant-scoped (`findById(id, tenantId)` atd.).
- **Services**: `TenantContext` (port).
- **Errors**: `MachineCodeAlreadyExistsError`, `UnknownMachineCodeError`, `CapacityGroupCodeAlreadyExistsError`, `ExternalResourceCodeAlreadyExistsError`, a licenční chyby (`license-errors.ts`).
- **Rozšíření existujících entit**: `Machine` (anglické názvy polí, `tenantId`, `code`, `capacityGroupId`), `MachineCapability`/`Tool`/`ToolMachineCondition` (`tenantId`), `CalculationSnapshot` (`machineCode`, `toolCode`).

### `src/application`
- `src/application/tenants/get-current-tenant-use-case.ts`
- `src/application/licensing/` - `DefaultFeatureAccessService` (jediná implementace `FeatureAccessService`), `FeatureAccessSnapshot` DTO, `GetFeatureAccessSnapshotUseCase`.
- `src/application/machines/` - `CreateMachineUseCase`, `UpdateMachineUseCase`, `DeactivateMachineUseCase`, `ResolveMachineByCodeUseCase`, `AssignMachineToCapacityGroupUseCase`.
- `src/application/capacity-groups/create-capacity-group-use-case.ts`
- `src/application/cooperations/create-external-operation-resource-use-case.ts`
- `src/application/events/application-event.ts` - jen typové deklarace, žádný event bus.

### `src/infrastructure`
- `src/infrastructure/services/local-tenant-context.ts` - implementace `TenantContext`.
- `src/infrastructure/licensing/` - `LocalLicenseProvider`, `DevelopmentLicenseProvider`, `seed-default-tenant.ts`.
- `src/infrastructure/persistence/indexeddb/` - nové records/mappers/repository implementace pro Tenant/CapacityGroup/ExternalOperationResource/License, `tpv-db.ts` povýšeno na `DB_VERSION = 2` (aditivní upgrade).
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

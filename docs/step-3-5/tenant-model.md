# Tenant model

Viz `docs/adr/0019-tenant-aware-data-model.md` pro rozhodnutí a zdůvodnění. Tenhle dokument popisuje praktické fungování.

## Co je Tenant

`Tenant` (`src/domain/entities/tenant.ts`) je zákaznická organizace PROVOZUJÍCÍ appku (např. konkrétní strojírenská firma, která appku používá) - NENÍ to totéž jako doménový `Customer` (obchodní zákazník, pro kterého tenant vyrábí díly). `TenantStatus` je `"active" | "trial" | "suspended" | "inactive"`, `Tenant.isActive` je `true` pro `active`/`trial`.

## Dnešní stav: jeden tenant

Appka běží jednouživatelsky/offline. Existuje jediný `DEFAULT_TENANT_ID = "tenant:local-default"`, seedovaný idempotentně funkcí `ensureDefaultTenantAndLicense()` (`src/infrastructure/licensing/seed-default-tenant.ts`) - volá se na začátku `runMigrationEngine()` a bude se volat i z budoucího app bootstrapu (Krok 4+), pokud appka poběží bez migrace.

`LocalTenantContext` (`src/infrastructure/services/local-tenant-context.ts`) vždy vrací `DEFAULT_TENANT_ID` - žádné přihlašování, žádný výběr organizace.

## Jak se to rozšíří na víc tenantů

`TenantContext` je port (`src/domain/services/tenant-context.ts`) - budoucí server/cloud varianta (mimo rozsah tohoto kroku) doplní jinou implementaci (odvozující tenantId ze session/auth), aniž by se měnily use casy nebo tenant-scoped repozitáře. Tenant-scoped repozitáře (`MachineRepository`, `CapacityGroupRepository`, `ExternalOperationResourceRepository`) berou `tenantId` jako explicitní parametr metod - `findById(id, tenantId)`, `list(tenantId)` atd. - takže testy i budoucí multi-tenant provoz fungují beze změny signatur.

## Co (zatím) NENÍ tenant-scoped

`Customer`, `Order`, `Part`, `RoutingSheet`, `Operation`, `Position`, `Activity`, `Calculation` zůstávají BEZ `tenantId` - viz `docs/step-3-5/known-limitations.md`. `OperationType`/`ToolType` jsou záměrně globální číselníky (ne tenant-scoped) i do budoucna - typy operací/nástrojů jsou vlastnost appky, ne organizace.

## Testy

`src/infrastructure/licensing/seed-default-tenant.test.ts` - existence po seedu, idempotence (opakované volání nepřepíše ručně změněný stav), bezpečnost opakovaného volání (žádný unique-index konflikt).

# 0019 – Tenant jako explicitní entita, tenantId jen na vybraných agregátech

## Status
Přijato

## Context
Krok 3.5 připravuje appku na víc zákaznických organizací (tenantů), ale appka dnes běží jednouživatelsky/offline a nemá žádné přihlašování. Zavést `tenantId` plošně na všechny entity (Customer, Order, Part, RoutingSheet, Operation, Position, Activity, Calculation) by byl rozsáhlý zásah bez okamžitého přínosu.

## Decision
- Nová entita `Tenant` (`src/domain/entities/tenant.ts`) - zákaznická organizace PROVOZUJÍCÍ appku, ne totéž co doménový `Customer` (obchodní zákazník, pro kterého tenant vyrábí). Existuje jediný `DEFAULT_TENANT_ID = "tenant:local-default"`, seedovaný idempotentně (`src/infrastructure/licensing/seed-default-tenant.ts`).
- `TenantContext` (port v `src/domain/services/tenant-context.ts`, implementace `LocalTenantContext` v infrastructure) - jediné místo, které "ví", jaký je aktuální tenant. Dnes vždy vrací `DEFAULT_TENANT_ID`; budoucí server/cloud varianta nahradí implementaci (ne API), tenanto-vědomé use casy se nezmění.
- `tenantId` bylo přidáno JEN na entity, kde to má okamžitý smysl pro tenhle krok: `Machine`, `MachineCapability`, `Tool`, `ToolMachineCondition`, `CapacityGroup`, `ExternalOperationResource`, `License`, a persistenční `MigrationRunRecord`/`MigrationIssueRecord`. `Customer`/`Order`/`Part`/`RoutingSheet`/`Operation`/`Position`/`Activity`/`Calculation` zůstávají BEZ `tenantId` - zdokumentováno jako vědomé, dočasné omezení (viz `docs/step-3-5/known-limitations.md`), ne přehlédnutí.
- Tenant-scoped repozitáře (Machine, CapacityGroup, ExternalOperationResource) berou `tenantId` jako explicitní parametr metod (`findById(id, tenantId)`), ne implicitně přes skrytý `TenantContext` uvnitř repozitáře - kvůli testovatelnosti a explicitnosti.

## Consequences
- Multi-tenant model existuje a je otestovaný (izolace mezi tenanty, unikátnost `[tenantId, code]`) tam, kde appka dnes reálně potřebuje Helios kódy/licence, aniž by vyžadoval přepsání celého zbytku domény najednou.
- Rozšíření `tenantId` na zbytek domény (Customer/Order/.../Calculation) je odložené na budoucí krok, až bude appka skutečně multi-tenantní i v UI, ne jen v datovém modelu.

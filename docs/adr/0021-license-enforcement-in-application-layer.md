# 0021 – Licence se vynucuje v Application vrstvě, UI je jen druhá (ne jediná) ochrana

## Status
Přijato

## Context
Licenční kontrola jen v UI (schování tlačítka) je snadné obejít (přímé volání use casu, vlastní klient) a nechrání nic. Zároveň appka potřebuje UI, které se chová rozumně (nezobrazuje akce, které stejně selžou).

## Decision
- `FeatureAccessService` (port v `src/domain/licensing/feature-access-service.ts`, jediná implementace `DefaultFeatureAccessService` v `src/application/licensing/`) je určený pro volání z Application use casů (`CreateMachineUseCase.require(FeatureCodes.MachinesManage, "write")` apod.), NE jen z UI.
- `LicenseProvider` (efektivní aktuální licence) je oddělený od `LicenseRepository` (čistá persistence) - `DefaultFeatureAccessService` závisí jen na `LicenseProvider`, aby šlo licenci v budoucnu skládat (lokální + vzdálené ověření, grace period) beze změny use casů.
- UI komponenta `FeatureGate` (`src/presentation/components/feature-gate.tsx`) čte předpočítaný `FeatureAccessSnapshot` (`GetFeatureAccessSnapshotUseCase`) a jen řídí, co se vykreslí - výslovně zdokumentováno v komentáři, že schování tlačítka NENÍ náhrada za kontrolu v use casu.

## Consequences
- Každý nový chráněný use case musí explicitně zavolat `FeatureAccessService.require(...)`/`assertWithinLimit(...)` - není to automatické, musí se na to myslet při psaní use casu (žádný middleware/dekorátor to nedělá za autora v tomhle kroku).
- I kdyby UI mělo chybu nebo bylo obejité, backend (use case) požadavek odmítne.

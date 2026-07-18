# 0020 – Licence řízená přes FeatureCode/FeatureAccess/limity, nikdy podle planCode

## Status
Přijato

## Context
Budoucí licenční tiery (mimo rozsah tohoto kroku - žádné platby/billing/subscription management) potřebují mít od začátku správný datový model, jinak každá nová úroveň licence vyžaduje zásah do kódu na desítkách míst (`if (planCode === "enterprise")`).

## Decision
- `FeatureCode` (`src/domain/licensing/feature-code.ts`) - centrální, stabilní katalog "co appka umí" (`routing.view`, `machines.manage`, `integration.helios.sync`, ...). Jediný zdroj pravdy, žádné rovnocenné varianty stejné funkce.
- `FeatureAccess` (`"none"|"read"|"write"|"full"`) - úroveň přístupu k jedné funkci, ne prostý boolean.
- `LicenseLimitCode` - samostatný katalog číselných limitů (`machines.max`, `users.max`, ...), oddělený od feature přístupu.
- `License` (`src/domain/licensing/license.ts`) drží `status`, `validFrom`/`validUntil`, seznam `LicensedFeature[]` a `LicenseLimit[]`. `planCode` je jen popisný štítek (pro zobrazení uživateli/fakturaci) - explicitně ZAKÁZANÝ vzor je `if (planCode === "enterprise") { ... }` kdekoliv v use casech. Zdroj pravdy je vždy kombinace `status` + platnost + `features` + `limits`.
- Chybějící `FeatureCode` v `license.features` znamená `"none"` (funkce v licenci vůbec není zmíněná), ne chybu - `License.getFeatureAccess()` vrací `undefined`, volající (`FeatureAccessService.getAccess`) to překlopí na `"none"`.

## Consequences
- Nový licenční tier = nová kombinace `features`/`limits` v datech, ne nová větev kódu.
- UI a use casy se ptají jen "smí tenant dělat X s úrovní Y" / "je hodnota Z pod limitem W" - nikdy se neptají na `planCode`.

# 0023 – Licence (co appka smí) a uživatelská oprávnění (kdo smí co) jsou oddělené koncepty

## Status
Přijato

## Context
Krok 3.5 zavádí licenční model, ale explicitně NEIMPLEMENTUJE plnou autentizaci ani uživatelské role (viz zadání - mimo rozsah kroku). Je snadné tyhle dva koncepty zaměnit, protože oba nakonec něco "povolují" nebo "zakazují".

## Decision
Licence (`License`, `FeatureAccessService`) odpovídá na otázku "co tahle ORGANIZACE (tenant) má v rámci svého tarifu k dispozici" - nezávisle na tom, KDO konkrétní akci provádí. Otázka "smí TENHLE UŽIVATEL v rámci organizace dělat X" (role, oprávnění jednotlivých uživatelů) je samostatný, budoucí koncept, který v tomhle kroku vůbec neexistuje - appka dnes nemá pojem "uživatel" ani přihlašování.

`FeatureAccessService` a `TenantContext` proto o uživatelích nic nevědí a nikdy vědět nebudou přimíchaní do stejného rozhraní - budoucí autorizační vrstva (Krok 5+) bude muset kontrolu skládat ("licence dovoluje ORGANIZACI feature X" AND "role dovoluje TOMUTO uživateli feature X"), ne jedno nahrazovat druhým.

## Consequences
- Dnešní `FeatureGate`/`FeatureAccessService` nejsou (a neměly by být) použité jako budoucí mechanismus uživatelských oprávnění - až vznikne autentizace, přibude samostatný `AuthorizationService`/obdoba, ne rozšíření licenčního API o uživatele.
- Zabraňuje to typické chybě "licence = permissions", která by později vyžadovala rozsáhlý refaktoring při zavedení skutečných uživatelských rolí.

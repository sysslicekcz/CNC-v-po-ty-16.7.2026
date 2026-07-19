# 0003 – Stroj je vlastnost Operation, ne Activity

## Status
Přijato

## Context
Nástroj se v revizi modelu přesunul z `Operation` na `Activity` (jedna operace může používat víc nástrojů). Vyvstala otázka, jestli se má stejně přesunout i stroj.

## Decision
Stroj (`machineId`) zůstává na `Operation`, ne na `Activity`/`Position`. Operace je přiřazena maximálně jednomu stroji – to odpovídá reálnému výrobnímu kroku ("tahle operace běží na PUMA 700"), zatímco nástroje se v rámci jednoho stroje/upnutí střídají (revolverová hlava, výměna nástroje). Validace shody stroje s typem operace (`MachineCapabilityRepository`) proto probíhá per `Activity.operationTypeId` proti `Operation.machineId`, ne naopak.

## Consequences
- Asymetrie "stroj nahoře, nástroj dole" je záměrná, ne nedopatření – odpovídá tomu, jak se ve skutečnosti operace na dílně přiřazují.
- `Operation.assignMachine()` je "hloupý" setter; kontrolu proti capabilitám existujících `Activity` dělá až budoucí Application use case (doména nesmí sama volat `MachineCapabilityRepository`).

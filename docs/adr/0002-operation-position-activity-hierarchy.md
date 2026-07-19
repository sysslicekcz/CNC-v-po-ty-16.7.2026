# 0002 – Hierarchie Operation → Position → Activity

## Status
Přijato

## Context
Reálná výroba: jedna operace (např. "Op20 – Hrubovací soustružení – PUMA 700") může vyžadovat víc upnutí (např. obrobení z obou stran), a v rámci jednoho upnutí může proběhnout víc technologických činností různými nástroji (např. hrubovací soustružení a následné vrtání ve stejném upnutí). Dřívější návrh (Position nad Operation, jeden výpočet na upnutí) tohle neuměl vyjádřit.

## Decision
`Operation` (max. jeden stroj) → `Position` (upnutí, 1:N na operaci) → `Activity` (technologická činnost/kalkulační blok, 1:N na upnutí, max. jeden nástroj). `Activity` nese `operationTypeId` (klasifikace pro shodu se strojem) a `calculationType` (tvar vstupu/vzorec) – to jsou dvě různé osy, i když se dnes hodnotově kryjí. `Activity` může existovat i bez `Calculation` (`kind`: `manual`/`inspection`/`ndt`/`external`) pro budoucí kontrolu, NDT, odjehlení atd.

## Consequences
- Přesně odpovídá reálným datům dnešní appky: `partOperationRows` (opId + rows) na jedné pozici = budoucí víc `Activity` pod jedním `Position`.
- O jednu úroveň víc než plochý model – v UI je potřeba to prezentovat srozumitelně (riziko k ověření při návrhu obrazovky postupu, ne v tomto kroku).
- `operationTypeId` vs. `calculationType` jako dvě pole nese riziko záměny při implementaci use casů – zmírněno komentáři a jasným pojmenováním.
